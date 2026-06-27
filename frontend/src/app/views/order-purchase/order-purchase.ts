import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { SupplierService } from '../../services/supplier.service';
import { MedicineService } from '../../services/medicine.service';
import { MedicineMasterService } from '../../services/medicine-master.service';
import { Supplier, Medicine, MedicineMaster } from '../../models/types';

// ── Local storage shape ──────────────────────────────────────────────────────
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
  quantityOrdered: number;  // in strips / packs (user-facing)
  unit: string;             // 'strips' | 'packs'
}

const STORAGE_KEY = 'pharmacy_purchase_orders';

@Component({
  selector: 'app-order-purchase',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, RouterLink],
  templateUrl: './order-purchase.html',
  styleUrl: './order-purchase.css'
})
export class OrderPurchaseComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly medicineService = inject(MedicineService);
  private readonly masterService = inject(MedicineMasterService);
  private readonly snackBar = inject(MatSnackBar);

  // ── Raw data ────────────────────────────────────────────────────────────────
  suppliers = signal<Supplier[]>([]);
  medicines = signal<Medicine[]>([]);
  masters = signal<MedicineMaster[]>([]);
  orders = signal<OrderEntry[]>([]);

  // ── Wholesaler search ───────────────────────────────────────────────────────
  supplierQuery = signal<string>('');
  supplierDropdownOpen = signal<boolean>(false);
  selectedSupplier = signal<Supplier | null>(null);
  activeSupplierIndex = signal<number>(0);

  filteredSuppliers = computed(() => {
    const q = this.supplierQuery().trim().toLowerCase();
    if (!q) return this.suppliers();
    return this.suppliers().filter(s => s.name.toLowerCase().includes(q));
  });

  // ── Low-stock row model ─────────────────────────────────────────────────────
  lowStockRows = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const groupMap = new Map<string, Medicine[]>();
    this.medicines().forEach(m => {
      if (!m.sku) return;
      if (!groupMap.has(m.sku)) groupMap.set(m.sku, []);
      groupMap.get(m.sku)!.push(m);
    });

    const rows: LowStockRow[] = [];
    groupMap.forEach((batches, sku) => {
      const totalStock = batches.reduce((s, b) => s + (b.stockLevel || 0), 0);
      const reorder = Math.max(...batches.map(b => b.reorderLevel || 0), 10);
      if (totalStock > reorder) return; // not low stock

      const first = batches[0];
      const master = this.masters().find(m => m.productCode === sku);
      const isTab = master ? (master.productType?.toLowerCase().includes('tablet') || master.productType?.toLowerCase().includes('capsule')) : true;
      const packSize = master ? this.parsePackSize(master.productQuantity) : 10;
      const unit = isTab ? 'strips' : 'packs';
      const stockInUnits = isTab ? Math.floor(totalStock / packSize) : totalStock;
      const reorderInUnits = isTab ? Math.ceil(reorder / packSize) : reorder;

      // Previous orders for this SKU
      const prevOrders = this.getPrevOrdersForSku(sku);

      rows.push({
        sku,
        name: first.name || sku,
        genericName: first.genericName || '',
        totalStockUnits: stockInUnits,
        reorderLimitUnits: reorderInUnits,
        unit,
        packSize,
        isTablet: isTab,
        prevOrders
      });
    });

    const sup = this.selectedSupplier();
    if (!sup) {
      return rows.map(r => ({ ...r, isSupplied: false })).sort((a, b) => a.name.localeCompare(b.name));
    }

    const suppliedCompaniesList = (sup.suppliedCompanies || '')
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(c => c.length > 0);

    const matches: LowStockRow[] = [];
    const rest: LowStockRow[] = [];

    rows.forEach(row => {
      const master = this.masters().find(m => m.productCode === row.sku);
      const company = (master?.companyName || '').trim().toLowerCase();
      
      const isSupplied = suppliedCompaniesList.some(sc => company.includes(sc) || sc.includes(company));
      if (isSupplied && company.length > 0) {
        matches.push({ ...row, isSupplied: true });
      } else {
        rest.push({ ...row, isSupplied: false });
      }
    });

    matches.sort((a, b) => a.name.localeCompare(b.name));
    rest.sort((a, b) => a.name.localeCompare(b.name));

    return [...matches, ...rest];
  });

  // ── Selection state per row ─────────────────────────────────────────────────
  selectedSkus = signal<Set<string>>(new Set());
  orderQty = signal<Map<string, number>>(new Map());

  // ── View helpers ────────────────────────────────────────────────────────────
  isAllSelected = computed(() => {
    const rows = this.lowStockRows();
    return rows.length > 0 && rows.every(r => this.selectedSkus().has(r.sku));
  });



  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit() {
    this.supplierService.getAll().subscribe(data => this.suppliers.set(data));
    this.medicineService.getAll().subscribe(data => this.medicines.set(data));
    this.masterService.getAll().subscribe(data => this.masters.set(data));
    this.loadOrdersFromStorage();
  }

  // ── Wholesaler search ───────────────────────────────────────────────────────
  onSupplierInput(value: string) {
    this.supplierQuery.set(value);
    this.supplierDropdownOpen.set(true);
    this.selectedSupplier.set(null);
    this.activeSupplierIndex.set(0);
    this.clearSelection();
  }

  selectSupplier(sup: Supplier) {
    this.selectedSupplier.set(sup);
    this.supplierQuery.set(sup.name);
    this.supplierDropdownOpen.set(false);
    this.clearSelection();
  }

  closeSupplierDropdown() {
    setTimeout(() => this.supplierDropdownOpen.set(false), 160);
  }

  onSupplierKeyDown(event: Event, key: 'down' | 'up') {
    if (!this.supplierDropdownOpen()) {
      this.supplierDropdownOpen.set(true);
      this.activeSupplierIndex.set(0);
      return;
    }
    const filtered = this.filteredSuppliers();
    if (filtered.length === 0) return;

    event.preventDefault();
    const current = this.activeSupplierIndex();
    if (key === 'down') {
      const next = (current + 1) % filtered.length;
      this.activeSupplierIndex.set(next);
    } else if (key === 'up') {
      const prev = (current - 1 + filtered.length) % filtered.length;
      this.activeSupplierIndex.set(prev);
    }
  }

  onSupplierSearchEnter(event: Event) {
    event.preventDefault();
    const selected = this.selectedSupplier();
    if (selected) {
      this.focusQtyInput(0);
      return;
    }
    const filtered = this.filteredSuppliers();
    if (filtered.length > 0) {
      const idx = Math.min(Math.max(0, this.activeSupplierIndex()), filtered.length - 1);
      this.selectSupplier(filtered[idx]);
      this.focusQtyInput(0);
    }
  }

  focusQtyInput(index: number) {
    setTimeout(() => {
      const element = document.getElementById(`qty-input-${index}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 60);
  }

  onQtyKeyDown(event: Event, sku: string, index: number, key: 'enter' | 'down' | 'up') {
    event.preventDefault();
    if (key === 'enter') {
      this.selectSkuIfUnselected(sku);
      this.focusQtyInput(index + 1);
    } else if (key === 'down') {
      this.focusQtyInput(index + 1);
    } else if (key === 'up') {
      this.focusQtyInput(index - 1);
    }
  }

  selectSkuIfUnselected(sku: string) {
    if (!this.selectedSkus().has(sku)) {
      this.selectedSkus.update(prev => {
        const next = new Set(prev);
        next.add(sku);
        return next;
      });
    }
  }

  // ── Selection ───────────────────────────────────────────────────────────────
  isSelected(sku: string) { return this.selectedSkus().has(sku); }

  toggleRow(sku: string) {
    this.selectedSkus.update(prev => {
      const next = new Set(prev);
      if (next.has(sku)) { next.delete(sku); } else { next.add(sku); }
      return next;
    });
    if (!this.orderQty().has(sku)) {
      this.setQty(sku, 1);
    }
  }

  toggleAll() {
    const rows = this.lowStockRows();
    if (this.isAllSelected()) {
      this.selectedSkus.set(new Set());
    } else {
      const all = new Set<string>(rows.map(r => r.sku));
      this.selectedSkus.set(all);
      rows.forEach(r => { if (!this.orderQty().has(r.sku)) this.setQty(r.sku, 1); });
    }
  }

  getQty(sku: string): number {
    return this.orderQty().get(sku) ?? 1;
  }

  setQty(sku: string, value: number) {
    this.orderQty.update(prev => {
      const next = new Map(prev);
      next.set(sku, Math.max(1, Math.round(value)));
      return next;
    });
  }

  onQtyInput(sku: string, raw: string) {
    const val = parseInt(raw, 10);
    if (!isNaN(val)) this.setQty(sku, val);
  }

  clearSelection() {
    this.selectedSkus.set(new Set());
    this.orderQty.set(new Map());
  }

  selectedCount = computed(() => this.selectedSkus().size);

  // ── Place Order ─────────────────────────────────────────────────────────────
  placeOrder() {
    const sup = this.selectedSupplier();
    if (!sup) {
      this.showSnackbar('Please select a wholesaler before placing the order.', 'danger');
      return;
    }
    const selected = Array.from(this.selectedSkus());
    if (selected.length === 0) {
      this.showSnackbar('Please select at least one medicine to order.', 'danger');
      return;
    }

    const rows = this.lowStockRows();
    const items: OrderItem[] = selected.map(sku => {
      const row = rows.find(r => r.sku === sku)!;
      return {
        sku,
        medicineName: row.name,
        quantityOrdered: this.getQty(sku),
        unit: row.unit
      };
    });

    const entry: OrderEntry = {
      id: crypto.randomUUID(),
      wholesalerName: sup.name,
      orderDate: new Date().toISOString(),
      items,
      status: 'PENDING'
    };

    // ── Auto-add new medicine brands to wholesaler supplied companies ─────────
    let hasNewBrand = false;
    let currentCompanies = (sup.suppliedCompanies || '')
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    selected.forEach(sku => {
      const master = this.masters().find(m => m.productCode === sku);
      const company = master?.companyName?.trim();
      if (company && !currentCompanies.some(c => c.toLowerCase() === company.toLowerCase())) {
        currentCompanies.push(company);
        hasNewBrand = true;
      }
    });

    if (hasNewBrand && sup.id) {
      sup.suppliedCompanies = currentCompanies.join(', ');
      this.supplierService.update(sup.id, sup).subscribe({
        next: (updatedSup) => {
          this.suppliers.update(list => list.map(s => s.id === updatedSup.id ? updatedSup : s));
          this.selectedSupplier.set(updatedSup);
        },
        error: () => {
          this.showSnackbar('Warning: Failed to auto-update wholesaler supplied brands list.', 'danger');
        }
      });
    }

    this.orders.update(prev => [entry, ...prev]);
    this.saveOrdersToStorage();
    this.clearSelection();

    this.showSnackbar(
      `✅ Order placed with ${sup.name} for ${items.length} medicine${items.length > 1 ? 's' : ''}!`,
      'info'
    );
  }



  // ── Previous orders for a SKU ───────────────────────────────────────────────
  getPrevOrdersForSku(sku: string): PrevOrderInfo[] {
    const result: PrevOrderInfo[] = [];
    for (const order of this.orders()) {
      const item = order.items.find(i => i.sku === sku);
      if (item) {
        result.push({
          wholesalerName: order.wholesalerName,
          quantityOrdered: item.quantityOrdered,
          unit: item.unit,
          orderDate: order.orderDate,
          status: order.status
        });
      }
    }
    return result.slice(0, 3); // show last 3
  }

  totalOrderedForSku(sku: string): number {
    return this.orders()
      .filter(o => o.status === 'PENDING')
      .flatMap(o => o.items)
      .filter(i => i.sku === sku)
      .reduce((sum, i) => sum + i.quantityOrdered, 0);
  }

  // ── Storage ─────────────────────────────────────────────────────────────────
  loadOrdersFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.orders.set(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  saveOrdersToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders()));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  parsePackSize(qty: string | undefined): number {
    if (!qty) return 10;
    const m = qty.match(/(\d+)/);
    return m ? +m[1] : 10;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  trackBy(_: number, item: any) { return item.sku ?? item.id; }

  showSnackbar(msg: string, type: 'info' | 'danger') {
    this.snackBar.open(msg, 'Close', {
      duration: 4500,
      panelClass: type === 'danger' ? ['snackbar-danger'] : ['snackbar-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}

// ── Local interfaces ─────────────────────────────────────────────────────────
interface LowStockRow {
  sku: string;
  name: string;
  genericName: string;
  totalStockUnits: number;
  reorderLimitUnits: number;
  unit: string;
  packSize: number;
  isTablet: boolean;
  prevOrders: PrevOrderInfo[];
  isSupplied?: boolean;
}

interface PrevOrderInfo {
  wholesalerName: string;
  quantityOrdered: number;
  unit: string;
  orderDate: string;
  status: string;
}
