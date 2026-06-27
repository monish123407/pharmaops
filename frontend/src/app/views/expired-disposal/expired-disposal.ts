import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { ApiConfigService } from '../../services/api-config.service';

@Component({
  selector: 'app-expired-disposal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './expired-disposal.html',
  styleUrl: './expired-disposal.css'
})
export class ExpiredDisposalComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);
  private readonly apiConfig = inject(ApiConfigService);

  // Active view tab state: 'expired' or 'history'
  activeTab = signal<'expired' | 'history'>('expired');

  // Active signals
  expiredBatches = signal<any[]>([]);
  disposalHistory = signal<any[]>([]);

  // Search filter query
  searchQuery = signal<string>('');

  // Modal disposal form signals
  isDisposalModalOpen = signal<boolean>(false);
  selectedBatch = signal<any | null>(null);
  disposeQuantity = signal<number>(1);
  disposeReason = signal<string>('Expired');

  // Computed signals for filtering active expired stock
  filteredExpiredBatches = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.expiredBatches();
    if (!query) return list;
    return list.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.sku.toLowerCase().includes(query) ||
      (item.batchNumber && item.batchNumber.toLowerCase().includes(query))
    );
  });

  // Computed signals for filtering history logs
  filteredHistory = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.disposalHistory();
    if (!query) return list;
    return list.filter(item => 
      item.productName.toLowerCase().includes(query) || 
      item.sku.toLowerCase().includes(query) ||
      (item.batchNumber && item.batchNumber.toLowerCase().includes(query))
    );
  });

  // Computed signal to calculate total expired units (active)
  totalExpiredUnits = computed(() => {
    return this.expiredBatches().reduce((sum, item) => sum + (item.stockLevel || 0), 0);
  });

  // Computed signal to calculate cumulative write-off loss value (cost price of all disposed batches)
  totalFinancialLoss = computed(() => {
    return this.disposalHistory().reduce((sum, item) => sum + ((item.quantityDisposed || 0) * (item.costPrice || 0)), 0);
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // 1. Fetch active expired batches
    this.http.get<any[]>(this.apiConfig.apiUrl('/api/medicines/expired')).subscribe({
      next: (data) => {
        this.expiredBatches.set(data);
      },
      error: (err) => {
        console.error('Failed to load expired batches', err);
        this.showSnackbar('Error loading expired batches ledger.', 'danger');
      }
    });

    // 2. Fetch disposed batches history
    this.http.get<any[]>(this.apiConfig.apiUrl('/api/disposed-batches')).subscribe({
      next: (data) => {
        this.disposalHistory.set(data);
      },
      error: (err) => {
        console.error('Failed to load disposal history', err);
        this.showSnackbar('Error loading write-off logs history.', 'danger');
      }
    });
  }

  // Active disposal modal trigger
  openDisposalModal(batch: any) {
    this.selectedBatch.set(batch);
    this.disposeQuantity.set(batch.stockLevel || 1);
    this.disposeReason.set('Expired');
    this.isDisposalModalOpen.set(true);
    setTimeout(() => {
      document.getElementById('dispose-qty-input')?.focus();
    }, 150);
  }

  closeDisposalModal() {
    this.isDisposalModalOpen.set(false);
    this.selectedBatch.set(null);
  }

  // Handle disposal submit
  submitDisposal(event: Event) {
    event.preventDefault();
    const batch = this.selectedBatch();
    if (!batch) return;

    const qty = this.disposeQuantity();
    if (qty <= 0) {
      this.showSnackbar('Disposal quantity must be greater than zero.', 'warning');
      return;
    }
    if (qty > batch.stockLevel) {
      this.showSnackbar(`Disposal quantity cannot exceed current stock level (${batch.stockLevel}).`, 'warning');
      return;
    }

    const payload = {
      medicineId: batch.id,
      quantityDisposed: qty,
      reason: this.disposeReason(),
      disposedBy: this.auth.userFullName() || 'Pharmacist Admin'
    };

    this.http.post(this.apiConfig.apiUrl('/api/disposed-batches'), payload).subscribe({
      next: (res: any) => {
        this.showSnackbar(`Successfully disposed of ${qty} units of ${batch.name}.`, 'success');
        this.closeDisposalModal();
        this.loadData(); // Hot-refresh signals
      },
      error: (err) => {
        console.error('Disposal write-off request failed', err);
        this.showSnackbar('Disposal write-off request failed. Please check parameters.', 'danger');
      }
    });
  }

  // Helper helper to calculate days since expiration
  getDaysExpired(expiryDateStr: string): number {
    if (!expiryDateStr) return 0;
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    // Normalize dates to midnight
    expiry.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = Math.abs(today.getTime() - expiry.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private showSnackbar(message: string, panelClass: 'success' | 'warning' | 'danger') {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: [`snackbar-${panelClass}`]
    });
  }
}
