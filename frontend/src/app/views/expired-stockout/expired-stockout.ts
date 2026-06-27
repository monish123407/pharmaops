import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { ExpiredStockoutService, ExpiredStockoutItem } from '../../services/expired-stockout.service';
import { AuthService } from '../../services/auth.service';
import { Supplier } from '../../models/types';

@Component({
  selector: 'app-expired-stockout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expired-stockout.html',
  styleUrl: './expired-stockout.css'
})
export class ExpiredStockoutComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly stockoutService = inject(ExpiredStockoutService);
  private readonly auth = inject(AuthService);

  // Wholesalers catalog signals
  wholesalers = signal<Supplier[]>([]);
  wholesalerQuery = signal<string>('');
  wholesalerDropdownOpen = signal<boolean>(false);
  selectedWholesaler = signal<Supplier | null>(null);
  activeWholesalerItemIndex = signal<number>(0);

  // Expired items signal
  expiredItems = signal<ExpiredStockoutItem[]>([]);
  loading = signal<boolean>(false);

  // Selection signals
  selectedItemsMap = signal<Map<number, boolean>>(new Map()); // medicineId -> isChecked

  // Feedback notifications signals
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'danger'>('success');
  toastActive = signal<boolean>(false);

  ngOnInit() {
    this.loadWholesalers();
  }

  loadWholesalers() {
    this.supplierService.getAll().subscribe({
      next: (data) => this.wholesalers.set(data),
      error: (err) => console.error('Failed to load wholesalers', err)
    });
  }

  // Filtered wholesalers based on search query
  filteredWholesalers = computed(() => {
    const query = this.wholesalerQuery().toLowerCase().trim();
    if (!query) return this.wholesalers();
    return this.wholesalers().filter(w => 
      w.name.toLowerCase().includes(query) || 
      w.contactName.toLowerCase().includes(query)
    );
  });

  // Open dropdown on search bar focus
  onWholesalerFocus() {
    this.wholesalerDropdownOpen.set(true);
    this.activeWholesalerItemIndex.set(0);
  }

  // Close dropdown on click outside
  closeWholesalerDropdown() {
    setTimeout(() => {
      this.wholesalerDropdownOpen.set(false);
      if (this.selectedWholesaler()) {
        this.wholesalerQuery.set(this.selectedWholesaler()!.name);
      } else {
        this.wholesalerQuery.set('');
      }
    }, 240);
  }

  onWholesalerQueryChange(val: string) {
    this.wholesalerQuery.set(val);
    this.wholesalerDropdownOpen.set(true);
    this.activeWholesalerItemIndex.set(0);
  }

  onWholesalerKeyDown(event: any, key: 'up' | 'down' | 'enter' | 'escape') {
    const isOpen = this.wholesalerDropdownOpen();
    const filtered = this.filteredWholesalers();

    if (!isOpen) {
      if (key === 'escape') {
        event.preventDefault();
        this.clearWholesaler();
      }
      return;
    }

    if (filtered.length === 0) {
      if (key === 'escape') {
        event.preventDefault();
        this.wholesalerDropdownOpen.set(false);
      }
      return;
    }

    if (key === 'down') {
      event.preventDefault();
      const nextIndex = (this.activeWholesalerItemIndex() + 1) % filtered.length;
      this.activeWholesalerItemIndex.set(nextIndex);
    } else if (key === 'up') {
      event.preventDefault();
      const prevIndex = (this.activeWholesalerItemIndex() - 1 + filtered.length) % filtered.length;
      this.activeWholesalerItemIndex.set(prevIndex);
    } else if (key === 'enter') {
      event.preventDefault();
      const selected = filtered[this.activeWholesalerItemIndex()];
      if (selected) {
        this.selectWholesaler(selected);
      }
    } else if (key === 'escape') {
      event.preventDefault();
      this.wholesalerDropdownOpen.set(false);
    }
  }

  // Handle wholesaler selection
  selectWholesaler(wholesaler: Supplier) {
    this.selectedWholesaler.set(wholesaler);
    this.wholesalerQuery.set(wholesaler.name);
    this.wholesalerDropdownOpen.set(false);
    this.loadExpiredItems(wholesaler.name);
  }

  // Clear selected wholesaler and reset
  clearWholesaler() {
    this.selectedWholesaler.set(null);
    this.wholesalerQuery.set('');
    this.activeWholesalerItemIndex.set(0);
    this.expiredItems.set([]);
    this.selectedItemsMap.set(new Map());
  }

  // Fetch expired medicines
  loadExpiredItems(wholesalerName: string) {
    this.loading.set(true);
    this.selectedItemsMap.set(new Map());
    this.stockoutService.getExpiredByWholesaler(wholesalerName).subscribe({
      next: (data) => {
        this.expiredItems.set(data);
        this.loading.set(false);
        // Default check all to true
        const map = new Map<number, boolean>();
        data.forEach(item => map.set(item.medicineId, true));
        this.selectedItemsMap.set(map);
      },
      error: (err) => {
        console.error('Failed to fetch expired medicines', err);
        this.loading.set(false);
        this.showToast('Failed to load expired medicines. Please try again.', 'danger');
      }
    });
  }

  // Checkbox interactions
  toggleSelectItem(medicineId: number) {
    this.selectedItemsMap.update(map => {
      const newMap = new Map(map);
      newMap.set(medicineId, !newMap.get(medicineId));
      return newMap;
    });
  }

  isItemSelected(medicineId: number): boolean {
    return !!this.selectedItemsMap().get(medicineId);
  }

  // Bulk select toggles
  isAllSelected = computed(() => {
    const items = this.expiredItems();
    if (items.length === 0) return false;
    return items.every(item => this.isItemSelected(item.medicineId));
  });

  toggleAllSelected() {
    const currentAll = this.isAllSelected();
    this.selectedItemsMap.update(map => {
      const newMap = new Map<number, boolean>();
      this.expiredItems().forEach(item => {
        newMap.set(item.medicineId, !currentAll);
      });
      return newMap;
    });
  }

  // Cost and Quantity aggregates
  selectedCount = computed(() => {
    let count = 0;
    this.expiredItems().forEach(item => {
      if (this.isItemSelected(item.medicineId)) count++;
    });
    return count;
  });

  totalCostLoss = computed(() => {
    let total = 0;
    this.expiredItems().forEach(item => {
      if (this.isItemSelected(item.medicineId)) {
        total += item.costPrice * item.stockLevel;
      }
    });
    return total;
  });

  // Action stockout
  onStockoutSelected() {
    const selected = this.expiredItems().filter(item => this.isItemSelected(item.medicineId));
    if (selected.length === 0) {
      this.showToast('Please select at least one expired batch to stock out.', 'danger');
      return;
    }

    const disposedBy = this.auth.userFullName() || 'System Admin';
    const totalToDispose = selected.length;
    let completedCount = 0;
    let successCount = 0;

    selected.forEach(item => {
      this.stockoutService.disposeBatch(
        item.medicineId,
        item.stockLevel,
        'Expired Stockout (Wholesaler Return)',
        disposedBy
      ).subscribe({
        next: () => {
          completedCount++;
          successCount++;
          if (completedCount === totalToDispose) {
            this.handleStockoutFinished(successCount, totalToDispose);
          }
        },
        error: (err) => {
          console.error(`Failed to dispose medicine ID ${item.medicineId}`, err);
          completedCount++;
          if (completedCount === totalToDispose) {
            this.handleStockoutFinished(successCount, totalToDispose);
          }
        }
      });
    });
  }

  private handleStockoutFinished(successCount: number, total: number) {
    if (successCount === total) {
      this.showToast(`Successfully stocked out ${successCount} expired medicine batch(es)!`, 'success');
    } else {
      this.showToast(`Stocked out ${successCount} of ${total} expired batches. Some errors occurred.`, 'danger');
    }
    // Reload items
    const wholesaler = this.selectedWholesaler();
    if (wholesaler) {
      this.loadExpiredItems(wholesaler.name);
    }
  }

  private showToast(message: string, type: 'success' | 'danger') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastActive.set(true);
    setTimeout(() => this.toastActive.set(false), 5000);
  }
}
