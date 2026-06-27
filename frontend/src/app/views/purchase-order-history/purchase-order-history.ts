import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { SupplierService } from '../../services/supplier.service';
import { MedicineMasterService } from '../../services/medicine-master.service';
import { Supplier, MedicineMaster } from '../../models/types';

export interface OrderEntry {
  id: string;               // uuid
  wholesalerName: string;
  orderDate: string;        // ISO
  items: OrderItem[];
  status: 'PENDING' | 'RECEIVED';
}

export interface OrderItem {
  sku: string;
  medicineName: string;
  quantityOrdered: number;
  unit: string;
}

const STORAGE_KEY = 'pharmacy_purchase_orders';

@Component({
  selector: 'app-purchase-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink, MatSnackBarModule],
  templateUrl: './purchase-order-history.html',
  styleUrl: './purchase-order-history.css'
})
export class PurchaseOrderHistoryComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly masterService = inject(MedicineMasterService);
  private readonly snackBar = inject(MatSnackBar);

  suppliers = signal<Supplier[]>([]);
  masters = signal<MedicineMaster[]>([]);

  // ── Raw Data Signal ───────────────────────────────────────────────────────
  orders = signal<OrderEntry[]>([]);

  // ── Search & Filter Signals ────────────────────────────────────────────────
  searchText = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  statusFilter = signal<'ALL' | 'PENDING' | 'RECEIVED'>('ALL');

  // ── Computed Filtered List ─────────────────────────────────────────────────
  filteredOrders = computed(() => {
    let list = this.orders();

    // 1. Text filter (Wholesaler, Order ID, Medicine Name, or SKU)
    const text = this.searchText().trim().toLowerCase();
    if (text) {
      list = list.filter(o => 
        o.wholesalerName.toLowerCase().includes(text) ||
        o.id.toLowerCase().includes(text) ||
        o.items.some(i => 
          i.medicineName.toLowerCase().includes(text) || 
          i.sku.toLowerCase().includes(text)
        )
      );
    }

    // 2. Status filter
    const status = this.statusFilter();
    if (status !== 'ALL') {
      list = list.filter(o => o.status === status);
    }

    // 3. Date range filter (inclusive of boundaries)
    const startStr = this.startDate();
    const endStr = this.endDate();

    if (startStr) {
      const start = new Date(startStr);
      start.setHours(0, 0, 0, 0);
      list = list.filter(o => new Date(o.orderDate) >= start);
    }

    if (endStr) {
      const end = new Date(endStr);
      end.setHours(23, 59, 59, 999);
      list = list.filter(o => new Date(o.orderDate) <= end);
    }

    // Sort descending by order date
    return list.sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadOrders();
    this.supplierService.getAll().subscribe(data => this.suppliers.set(data));
    this.masterService.getAll().subscribe(data => this.masters.set(data));
  }

  // ── Data Management ────────────────────────────────────────────────────────
  loadOrders() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.orders.set(JSON.parse(raw));
      }
    } catch (e) {
      this.showSnackbar('Failed to load purchase orders from storage.', 'danger');
    }
  }

  saveOrders(updatedList: OrderEntry[]) {
    this.orders.set(updatedList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  }

  // ── Operations ─────────────────────────────────────────────────────────────
  markReceived(orderId: string) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;

    const updated = this.orders().map(o => 
      o.id === orderId ? { ...o, status: 'RECEIVED' as const } : o
    );
    this.saveOrders(updated);

    // Auto-update supplier profile with new brands
    const supplierName = order.wholesalerName;
    const sup = this.suppliers().find(s => s.name.toLowerCase() === supplierName.toLowerCase());
    if (sup && sup.id) {
      let hasNewBrand = false;
      let currentCompanies = (sup.suppliedCompanies || '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      order.items.forEach(item => {
        const master = this.masters().find(m => m.productCode === item.sku);
        const company = master?.companyName?.trim();
        if (company && !currentCompanies.some(c => c.toLowerCase() === company.toLowerCase())) {
          currentCompanies.push(company);
          hasNewBrand = true;
        }
      });

      if (hasNewBrand) {
        const updatedSup = {
          ...sup,
          suppliedCompanies: currentCompanies.join(', ')
        };
        this.supplierService.update(sup.id, updatedSup).subscribe({
          next: (savedSup) => {
            this.suppliers.update(list => list.map(s => s.id === savedSup.id ? savedSup : s));
            this.showSnackbar(`✅ Order marked as received & wholesaler supplied brands auto-updated!`, 'info');
          },
          error: (err) => {
            console.error('Failed to auto-update supplier supplied companies:', err);
            this.showSnackbar('✅ Order marked as received successfully.', 'info');
          }
        });
        return;
      }
    }

    this.showSnackbar('✅ Order marked as received successfully.', 'info');
  }

  deleteOrder(orderId: string) {
    const wholesaler = this.orders().find(o => o.id === orderId)?.wholesalerName || 'Order';
    const updated = this.orders().filter(o => o.id !== orderId);
    this.saveOrders(updated);
    this.showSnackbar(`🗑️ Purchase order with ${wholesaler} removed successfully.`, 'info');
  }

  clearFilters() {
    this.searchText.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.statusFilter.set('ALL');
    this.showSnackbar('Filters cleared.', 'info');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  showSnackbar(msg: string, type: 'info' | 'danger') {
    this.snackBar.open(msg, 'Close', {
      duration: 4000,
      panelClass: type === 'danger' ? ['snackbar-danger'] : ['snackbar-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
