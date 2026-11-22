import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs/operators';
import { SupplierService } from '../../services/supplier.service';
import { MedicineMasterService } from '../../services/medicine-master.service';
import { PurchaseBillService } from '../../services/purchase-bill.service';
import { AuthService } from '../../services/auth.service';
import { Supplier, MedicineMaster, PurchaseBill, PurchaseBillItem } from '../../models/types';

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

@Component({
  selector: 'app-purchase-bills',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MatSnackBarModule],
  templateUrl: './purchase-bills.html',
  styleUrl: './purchase-bills.css'
})
export class PurchaseBillsComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly masterService = inject(MedicineMasterService);
  private readonly billService = inject(PurchaseBillService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  // States Signals
  wholesalers = signal<Supplier[]>([]);
  mastersCatalog = signal<MedicineMaster[]>([]);
  billHistory = signal<PurchaseBill[]>([]);
  loading = signal<boolean>(true);
  
  // Searchable placed orders signals
  placedOrders = signal<OrderEntry[]>([]);
  selectedOrder = signal<OrderEntry | null>(null);
  orderQuery = signal<string>('');
  orderDropdownOpen = signal<boolean>(false);
  
  // Workspace view mode
  viewMode = signal<'entry' | 'draft' | 'saved'>('entry');

  // Header Form Signals
  invoiceNo = signal<string>('');
  invoiceDate = signal<string>(new Date().toISOString().split('T')[0]);
  selectedSupplier = signal<string>('');
  netAmount = signal<number>(0);

  // Supplier Search autocomplete signals
  supplierSearchQuery = signal<string>('');
  supplierDropdownOpen = signal<boolean>(false);
  activeSupplierItemIndex = signal<number>(0);

  // Table Items Signals
  items = signal<PurchaseBillItem[]>([]);

  // Search widgets per row
  rowSearchQueries = signal<string[]>([]);
  rowDropdownOpen = signal<boolean[]>([]);
  rowSearchMode = signal<boolean[]>([]); // true = show search input even if product selected
  activeListItemIndex = signal<number>(0);

  // Batch Number Autocomplete per row
  rowBatchQuery = signal<string[]>([]);
  rowBatchDropdownOpen = signal<boolean[]>([]);
  activeBatchItemIndex = signal<number>(0);

  // Mismatch Modal Signal
  isMismatchModalOpen = signal<boolean>(false);

  // Edit Bill Modal Signal
  isEditModalOpen = signal<boolean>(false);

  // Editing Mode Signals
  editingBillId = signal<number | null>(null);
  editingBillNumber = signal<string | null>(null);
  editingTokenNumber = signal<number | null>(null);

  // Medicine Master On-The-Fly Edit Signals
  isMasterEditModalOpen = signal<boolean>(false);
  editingMasterIndex = signal<number>(-1);
  editingMasterModel = signal<MedicineMaster | null>(null);

  // Master Edit Form Signals
  masterProductName = signal<string>('');
  masterComposition = signal<string>('');
  masterProductCode = signal<string>('');
  masterCompanyName = signal<string>('');
  masterCategory = signal<'food' | 'cosmetics' | 'medicine' | 'others'>('medicine');
  masterProductType = signal<string>('');
  masterProductQuantity = signal<string>('');
  masterHsnCode = signal<string>('');
  masterCgst = signal<number>(6.0);
  masterSgst = signal<number>(6.0);
  masterRackLocation = signal<string>('');
  masterReorderLevel = signal<number | null>(null);

  // Computed live invoice-level calculations
  grossAmount = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.rate * item.quantity), 0);
  });

  discountAmount = computed(() => {
    return this.items().reduce((sum, item) => {
      const rowTotal = item.rate * item.quantity;
      return sum + (rowTotal * (item.discountPercentage / 100));
    }, 0);
  });

  cgstAmount = computed(() => {
    return this.items().reduce((sum, item) => {
      const rowTotal = item.rate * item.quantity;
      const taxable = rowTotal - (rowTotal * (item.discountPercentage / 100));
      return sum + (taxable * (item.cgstRate / 100));
    }, 0);
  });

  sgstAmount = computed(() => {
    return this.items().reduce((sum, item) => {
      const rowTotal = item.rate * item.quantity;
      const taxable = rowTotal - (rowTotal * (item.discountPercentage / 100));
      return sum + (taxable * (item.sgstRate / 100));
    }, 0);
  });

  rawCalculatedTotal = computed(() => {
    return this.grossAmount() - this.discountAmount() + this.cgstAmount() + this.sgstAmount();
  });

  calculatedTotal = computed(() => {
    return Math.round(this.rawCalculatedTotal());
  });

  roundOff = computed(() => {
    return this.calculatedTotal() - this.rawCalculatedTotal();
  });

  filteredPlacedOrders = computed(() => {
    const q = this.orderQuery().trim().toLowerCase();
    const pending = this.placedOrders().filter(o => o.status === 'PENDING');
    if (!q) return pending;
    return this.placedOrders().filter(o => 
      o.wholesalerName.toLowerCase().includes(q) || 
      o.items.some(i => i.medicineName.toLowerCase().includes(q))
    );
  });

  filteredSuppliers = computed(() => {
    const q = this.supplierSearchQuery().trim().toLowerCase();
    const all = this.wholesalers();
    if (!q) return all;
    return all.filter(s => s.name.toLowerCase().includes(q));
  });

  // History Ledger Filter Signals
  historySearchQuery = signal<string>('');
  historyStartDate = signal<string>('');
  historyEndDate = signal<string>('');

  clearHistoryFilters() {
    this.historySearchQuery.set('');
    this.historyStartDate.set('');
    this.historyEndDate.set('');
  }

  filteredBillHistory = computed(() => {
    const mode = this.viewMode();
    let history = this.billHistory();

    // 1. Pre-filter by viewMode
    if (mode === 'draft') {
      history = history.filter(bill => Math.abs(bill.netAmount - bill.totalAmount) > 0.05);
    } else if (mode === 'saved') {
      history = history.filter(bill => Math.abs(bill.netAmount - bill.totalAmount) <= 0.05);
    } else {
      return [];
    }

    // 2. Filter by general search text query
    const query = this.historySearchQuery().trim().toLowerCase();
    if (query) {
      history = history.filter(bill => {
        const supName = (bill.supplierName || '').toLowerCase();
        const billNo = (bill.billNumber || '').toLowerCase();
        const invNo = (bill.invoiceNumber || '').toLowerCase();
        const tokenStr = bill.tokenNumber ? String(bill.tokenNumber) : '';
        const tokenHash = bill.tokenNumber ? '#' + bill.tokenNumber : '';
        const netAmt = String(bill.netAmount);
        const totAmt = String(bill.totalAmount);
        
        return supName.includes(query) ||
               billNo.includes(query) ||
               invNo.includes(query) ||
               tokenStr === query ||
               tokenStr.includes(query) ||
               tokenHash.includes(query) ||
               netAmt.includes(query) ||
               totAmt.includes(query);
      });
    }

    // 3. Filter by Start Date
    const start = this.historyStartDate();
    if (start) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      history = history.filter(bill => {
        const date = bill.purchaseDate ? new Date(bill.purchaseDate) : null;
        return date && date >= startDate;
      });
    }

    // 4. Filter by End Date
    const end = this.historyEndDate();
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      history = history.filter(bill => {
        const date = bill.purchaseDate ? new Date(bill.purchaseDate) : null;
        return date && date <= endDate;
      });
    }

    return history;
  });

  ngOnInit() {
    this.loadInitialData();
    this.addNewRow(); // Default start with one row

    // Listen to route changes to update viewMode
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateViewMode();
    });
    this.updateViewMode();
  }

  loadBillIntoForm(bill: PurchaseBill) {
    this.editingBillId.set(bill.id || null);
    this.editingBillNumber.set(bill.billNumber || null);
    this.editingTokenNumber.set(bill.tokenNumber || null);

    this.invoiceNo.set(bill.invoiceNumber);
    this.invoiceDate.set(bill.invoiceDate || new Date().toISOString().split('T')[0]);
    this.selectedSupplier.set(bill.supplierName);
    this.netAmount.set(bill.netAmount);

    const mappedItems: PurchaseBillItem[] = bill.items.map(item => ({
      id: item.id,
      productName: item.productName,
      productCode: item.productCode,
      quantity: item.quantity,
      loose: item.loose,
      batchNumber: item.batchNumber,
      hsnCode: item.hsnCode,
      expiryDate: item.expiryDate,
      mrp: item.mrp,
      rate: item.rate,
      total: item.total,
      discountPercentage: item.discountPercentage,
      taxableAmount: item.taxableAmount,
      cgstRate: item.cgstRate,
      sgstRate: item.sgstRate,
      cgstAmount: item.cgstAmount,
      sgstAmount: item.sgstAmount,
      reorderLevel: item.reorderLevel !== undefined && item.reorderLevel !== null ? item.reorderLevel : undefined,
      rackLocation: item.rackLocation ?? ''
    }));

    this.items.set(mappedItems);
    this.rowSearchQueries.set(mappedItems.map(() => ''));
    this.rowDropdownOpen.set(mappedItems.map(() => false));
    this.rowSearchMode.set(mappedItems.map(() => false));
    this.rowBatchQuery.set(mappedItems.map(item => item.batchNumber || ''));
    this.rowBatchDropdownOpen.set(mappedItems.map(() => false));
  }

  updateViewMode() {
    const url = this.router.url;
    if (url.includes('/purchase/draft')) {
      this.viewMode.set('draft');
    } else if (url.includes('/purchase/saved')) {
      this.viewMode.set('saved');
    } else {
      this.viewMode.set('entry');
      // Load and clear the cross-route active edit state
      if (this.billService.activeEditBill) {
        this.loadBillIntoForm(this.billService.activeEditBill);
        this.billService.activeEditBill = null;
      }
    }
  }

  loadInitialData() {
    this.loading.set(true);
    // Load suppliers
    this.supplierService.getAll().subscribe({
      next: (sups) => this.wholesalers.set(sups)
    });
    // Load masters catalog
    this.masterService.getAll().subscribe({
      next: (masters) => this.mastersCatalog.set(masters)
    });
    // Load purchase bills history
    this.billService.getAll().subscribe({
      next: (bills) => {
        this.billHistory.set(bills);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.loadPlacedOrdersFromStorage();
  }

  loadPlacedOrdersFromStorage() {
    try {
      const raw = localStorage.getItem('pharmacy_purchase_orders');
      if (raw) {
        this.placedOrders.set(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Failed to load placed orders from storage:', e);
    }
  }

  onOrderSearchInput(val: string) {
    this.orderQuery.set(val);
    this.orderDropdownOpen.set(true);
  }

  closeOrderDropdown() {
    setTimeout(() => this.orderDropdownOpen.set(false), 240);
  }

  onSupplierSearch(val: string) {
    this.supplierSearchQuery.set(val);
    this.supplierDropdownOpen.set(true);
    this.activeSupplierItemIndex.set(0);
    const match = this.wholesalers().find(s => s.name.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      this.selectedSupplier.set(match.name);
    } else {
      this.selectedSupplier.set('');
    }
  }

  selectSupplier(sup: Supplier) {
    this.selectedSupplier.set(sup.name);
    this.supplierSearchQuery.set(sup.name);
    this.supplierDropdownOpen.set(false);
  }

  clearSupplierSelection() {
    this.selectedSupplier.set('');
    this.supplierSearchQuery.set('');
  }

  closeSupplierDropdown() {
    setTimeout(() => {
      this.supplierDropdownOpen.set(false);
      if (this.selectedSupplier()) {
        this.supplierSearchQuery.set(this.selectedSupplier());
      } else {
        this.supplierSearchQuery.set('');
      }
    }, 240);
  }

  onSupplierSearchKeyDown(event: any, key: 'up' | 'down' | 'enter' | 'escape') {
    const isOpen = this.supplierDropdownOpen();
    const filtered = this.filteredSuppliers();

    if (!isOpen) {
      if (key === 'enter') {
        event.preventDefault();
        this.onHeaderEnter(event, 'supplier');
      } else if (key === 'escape') {
        event.preventDefault();
        this.clearSupplierSelection();
      }
      return;
    }

    if (filtered.length === 0) {
      if (key === 'escape') {
        event.preventDefault();
        this.supplierDropdownOpen.set(false);
      }
      return;
    }

    if (key === 'down') {
      event.preventDefault();
      const nextIndex = (this.activeSupplierItemIndex() + 1) % filtered.length;
      this.activeSupplierItemIndex.set(nextIndex);
    } else if (key === 'up') {
      event.preventDefault();
      const prevIndex = (this.activeSupplierItemIndex() - 1 + filtered.length) % filtered.length;
      this.activeSupplierItemIndex.set(prevIndex);
    } else if (key === 'enter') {
      event.preventDefault();
      const selected = filtered[this.activeSupplierItemIndex()];
      if (selected) {
        this.selectSupplier(selected);
      }
      setTimeout(() => {
        this.onHeaderEnter(event, 'supplier');
      }, 50);
    } else if (key === 'escape') {
      event.preventDefault();
      this.supplierDropdownOpen.set(false);
    }
  }

  selectPlacedOrder(order: OrderEntry) {
    this.selectedOrder.set(order);
    this.orderQuery.set(`Order for ${order.wholesalerName} (${this.formatPlacedOrderDate(order.orderDate)})`);
    this.orderDropdownOpen.set(false);

    // Auto-populate wholesaler
    this.selectedSupplier.set(order.wholesalerName);

    // Populate rows
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const defaultExpiry = nextYear.toISOString().split('T')[0];

    const newItems: PurchaseBillItem[] = order.items.map(item => {
      const master = this.mastersCatalog().find(m => m.productCode === item.sku);
      const cgstRate = master ? master.cgst : 6.0;
      const sgstRate = master ? master.sgst : 6.0;
      const hsnCode = master ? master.hsnCode : '3004';
      const reorderLevel = master && master.reorderLevel !== undefined ? master.reorderLevel : undefined;
      const rackLocation = master ? master.rackLocation || '' : '';

      return {
        productName: item.medicineName,
        productCode: item.sku,
        quantity: item.quantityOrdered,
        loose: 0,
        batchNumber: '',
        hsnCode,
        expiryDate: defaultExpiry,
        mrp: 0.0,
        rate: 0.0,
        total: 0.0,
        discountPercentage: 0.0,
        taxableAmount: 0.0,
        cgstRate,
        sgstRate,
        cgstAmount: 0.0,
        sgstAmount: 0.0,
        reorderLevel,
        rackLocation
      };
    });

    this.items.set(newItems);
    this.rowSearchQueries.set(newItems.map(() => ''));
    this.rowDropdownOpen.set(newItems.map(() => false));
    this.rowSearchMode.set(newItems.map(() => false));
    this.rowBatchQuery.set(newItems.map(() => ''));
    this.rowBatchDropdownOpen.set(newItems.map(() => false));

    this.snackBar.open(`📥 Loaded order placed with ${order.wholesalerName} containing ${newItems.length} item(s)!`, 'Close', {
      duration: 4500,
      panelClass: ['snackbar-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  formatPlacedOrderDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  getItemsSummaryString(order: OrderEntry): string {
    return order.items.map(i => `${i.medicineName} (${i.quantityOrdered} ${i.unit})`).join(', ');
  }

  // Row Management
  addNewRow() {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const defaultExpiry = nextYear.toISOString().split('T')[0];

    const newItem: PurchaseBillItem = {
      productName: '',
      productCode: '',
      quantity: 1,
      loose: 0,
      batchNumber: '',
      hsnCode: '3004',
      expiryDate: defaultExpiry,
      mrp: 0.0,
      rate: 0.0,
      total: 0.0,
      discountPercentage: 0.0,
      taxableAmount: 0.0,
      cgstRate: 6.0,
      sgstRate: 6.0,
      cgstAmount: 0.0,
      sgstAmount: 0.0,
      reorderLevel: undefined,
      rackLocation: ''
    };

    this.items.update(prev => [...prev, newItem]);
    this.rowSearchQueries.update(prev => [...prev, '']);
    this.rowDropdownOpen.update(prev => [...prev, false]);
    this.rowSearchMode.update(prev => [...prev, false]);
    this.rowBatchQuery.update(prev => [...prev, '']);
    this.rowBatchDropdownOpen.update(prev => [...prev, false]);
  }

  removeItemRow(index: number) {
    if (this.items().length <= 1) {
      this.showSnackbar('A purchase bill must contain at least one item formulation.', 'danger');
      return;
    }
    this.items.update(prev => prev.filter((_, i) => i !== index));
    this.rowSearchQueries.update(prev => prev.filter((_, i) => i !== index));
    this.rowDropdownOpen.update(prev => prev.filter((_, i) => i !== index));
    this.rowSearchMode.update(prev => prev.filter((_, i) => i !== index));
    this.rowBatchQuery.update(prev => prev.filter((_, i) => i !== index));
    this.rowBatchDropdownOpen.update(prev => prev.filter((_, i) => i !== index));
  }

  // Handle Input Changes on Row and trigger live calculations
  onRowInputChange(index: number, field: keyof PurchaseBillItem, value: any, event?: any) {
    this.items.update(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'quantity') {
        row.quantity = +value || 0;
      } else if (field === 'loose') {
        row.loose = +value || 0;
      } else if (field === 'rate') {
        row.rate = +value || 0.0;
      } else if (field === 'mrp') {
        row.mrp = +value || 0.0;
      } else if (field === 'discountPercentage') {
        row.discountPercentage = +value || 0.0;
      } else if (field === 'batchNumber') {
        row.batchNumber = value;
        // Keep batch dropdown query in sync
        this.rowBatchQuery.update(prev => { const c = [...prev]; c[index] = value; return c; });
      } else if (field === 'expiryDate') {
        let clean = value.trim();
        const isDelete = event && (event.inputType?.startsWith('delete') || event.inputType === 'deleteContentBackward');
        const digits = clean.replace(/\D/g, '');
        
        if (digits.length >= 2) {
          if (isDelete && digits.length === 2 && clean.length === 2) {
            row.expiryDate = digits;
          } else {
            row.expiryDate = digits.substring(0, 2) + '/' + digits.substring(2);
          }
        } else {
          row.expiryDate = digits;
        }

        const match = row.expiryDate.match(/^(\d{1,2})\/(\d{2,4})$/);
        if (match) {
          const month = parseInt(match[1], 10);
          let year = parseInt(match[2], 10);
          if (match[2].length === 2) {
            year = 2000 + year;
          }
          if (month >= 1 && month <= 12) {
            const lastDay = new Date(year, month, 0).getDate();
            const paddedMonth = String(month).padStart(2, '0');
            row.expiryDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
          }
        }
      } else if (field === 'cgstRate') {
        row.cgstRate = +value || 0.0;
      } else if (field === 'sgstRate') {
        row.sgstRate = +value || 0.0;
      } else if (field === 'productCode') {
        row.productCode = value;
        if (!value) {
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          const defaultExpiry = nextYear.toISOString().split('T')[0];

          row.productName = '';
          row.quantity = 1;
          row.loose = 0;
          row.batchNumber = '';
          row.hsnCode = '3004';
          row.expiryDate = defaultExpiry;
          row.mrp = 0.0;
          row.rate = 0.0;
          row.total = 0.0;
          row.discountPercentage = 0.0;
          row.taxableAmount = 0.0;
          row.cgstRate = 6.0;
          row.sgstRate = 6.0;
          row.cgstAmount = 0.0;
          row.sgstAmount = 0.0;
          row.reorderLevel = undefined;
          row.rackLocation = '';

          this.rowSearchQueries.update(qPrev => {
            const qUpdated = [...qPrev];
            qUpdated[index] = '';
            return qUpdated;
          });
          this.rowDropdownOpen.update(dPrev => {
            const dUpdated = [...dPrev];
            dUpdated[index] = false;
            return dUpdated;
          });
        }
      } else if (field === 'reorderLevel') {
        row.reorderLevel = value ? +value : undefined;
      } else if (field === 'rackLocation') {
        row.rackLocation = value;
      }

      // Re-calculate row math
      row.total = row.rate * row.quantity;
      const discountVal = row.total * (row.discountPercentage / 100);
      row.taxableAmount = row.total - discountVal;
      row.cgstAmount = row.taxableAmount * (row.cgstRate / 100);
      row.sgstAmount = row.taxableAmount * (row.sgstRate / 100);

      updated[index] = row;
      return updated;
    });
  }

  // Row Master Lookup Autocomplete Helpers
  onSearchMasterRow(index: number, query: string) {
    this.rowSearchQueries.update(prev => {
      const updated = [...prev];
      updated[index] = query;
      return updated;
    });
    this.rowDropdownOpen.update(prev => {
      const updated = [...prev];
      updated[index] = query.trim().length > 0;
      return updated;
    });
    this.activeListItemIndex.set(0); // Select the first one by default!
  }

  onSearchKeyDown(event: any, rowIndex: number, key: 'up' | 'down' | 'enter' | 'escape') {
    const isDropdownOpen = this.rowDropdownOpen()[rowIndex];
    if (!isDropdownOpen) {
      if (key === 'down' || key === 'up') {
        const query = this.rowSearchQueries()[rowIndex]?.trim();
        if (query) {
          event.preventDefault();
          this.rowDropdownOpen.update(prev => {
            const updated = [...prev];
            updated[rowIndex] = true;
            return updated;
          });
          this.activeListItemIndex.set(0);
          this.scrollActiveListItemIntoView();
        }
      } else if (key === 'enter') {
        // Dropdown closed + Enter → go to Qty
        event.preventDefault();
        // Exit search mode first if active
        if (this.rowSearchMode()[rowIndex]) {
          this.rowSearchMode.update(prev => { const c = [...prev]; c[rowIndex] = false; return c; });
          setTimeout(() => this.focusInput(rowIndex, 'qty'), 60);
        } else {
          this.focusInput(rowIndex, 'qty');
        }
      } else if (key === 'escape') {
        // Dropdown closed + Escape → go back to header
        event.preventDefault();
        this.onInputEscape(event, rowIndex, 'search');
      }
      return;
    }

    const filteredList = this.getFilteredMastersRow(rowIndex);
    if (filteredList.length === 0) return;

    if (key === 'down') {
      event.preventDefault(); // Stop cursor moving in text input
      const current = this.activeListItemIndex();
      const nextIndex = (current + 1) % filteredList.length;
      this.activeListItemIndex.set(nextIndex);
      this.scrollActiveListItemIntoView();
    } else if (key === 'up') {
      event.preventDefault(); // Stop cursor moving in text input
      const current = this.activeListItemIndex();
      const prevIndex = (current - 1 + filteredList.length) % filteredList.length;
      this.activeListItemIndex.set(prevIndex);
      this.scrollActiveListItemIntoView();
    } else if (key === 'enter') {
      event.preventDefault();
      const current = this.activeListItemIndex();
      if (current >= 0 && current < filteredList.length) {
        this.onSelectMasterRow(rowIndex, filteredList[current]);
      }
    } else if (key === 'escape') {
      event.preventDefault();
      // Dropdown is open — just close it
      this.rowDropdownOpen.update(prev => {
        const updated = [...prev];
        updated[rowIndex] = false;
        return updated;
      });
    }
  }

  scrollActiveListItemIntoView() {
    setTimeout(() => {
      const dropdown = document.querySelector(`.row-autocomplete-dropdown`);
      if (dropdown) {
        const activeItem = dropdown.querySelector(`.autocomplete-row-item.active-item`);
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, 10);
  }

  getFilteredMastersRow(index: number): MedicineMaster[] {
    const query = this.rowSearchQueries()[index]?.trim().toLowerCase();
    if (!query) return [];
    return this.mastersCatalog().filter(m =>
      m.productName.toLowerCase().includes(query) ||
      m.productCode.toLowerCase().includes(query)
    );
  }

  // ── Batch Number Autocomplete ──────────────────────────────────────────────

  /** Collect all unique batch entries (batchNumber + expiry + mrp + rate) for a productCode from history. */
  getExistingBatchOptions(productCode: string): PurchaseBillItem[] {
    if (!productCode) return [];
    const seen = new Set<string>();
    const results: PurchaseBillItem[] = [];
    for (const bill of this.billHistory()) {
      for (const item of bill.items) {
        if (item.productCode === productCode && item.batchNumber) {
          if (!seen.has(item.batchNumber)) {
            seen.add(item.batchNumber);
            results.push(item);
          }
        }
      }
    }
    return results;
  }

  /** Filter batch options for a row by what the user has typed in the batch input. */
  getFilteredBatchOptions(index: number): PurchaseBillItem[] {
    const productCode = this.items()[index]?.productCode;
    if (!productCode) return [];
    const query = (this.rowBatchQuery()[index] || '').trim().toLowerCase();
    const all = this.getExistingBatchOptions(productCode);
    if (!query) return all;
    return all.filter(b => b.batchNumber.toLowerCase().includes(query));
  }

  onBatchInputChange(index: number, value: string) {
    // Update the batch number on the row immediately (so user can type freely)
    this.onRowInputChange(index, 'batchNumber', value);
    // Update batch query
    this.rowBatchQuery.update(prev => { const c = [...prev]; c[index] = value; return c; });
    // Show dropdown only if product is selected AND there are existing options
    const filtered = this.getFilteredBatchOptions(index);
    this.rowBatchDropdownOpen.update(prev => {
      const c = [...prev]; c[index] = filtered.length > 0; return c;
    });
    this.activeBatchItemIndex.set(0);
  }

  onBatchKeyDown(event: any, rowIndex: number, key: 'up' | 'down' | 'enter' | 'escape') {
    const isOpen = this.rowBatchDropdownOpen()[rowIndex];
    const filtered = this.getFilteredBatchOptions(rowIndex);

    if (!isOpen) {
      if (key === 'enter') {
        event.preventDefault();
        this.focusInput(rowIndex, 'expiry');
      } else if (key === 'escape') {
        event.preventDefault();
        this.onInputEscape(event, rowIndex, 'batch');
      }
      return;
    }

    if (key === 'down') {
      event.preventDefault();
      this.activeBatchItemIndex.set((this.activeBatchItemIndex() + 1) % filtered.length);
    } else if (key === 'up') {
      event.preventDefault();
      this.activeBatchItemIndex.set((this.activeBatchItemIndex() - 1 + filtered.length) % filtered.length);
    } else if (key === 'enter') {
      event.preventDefault();
      const idx = this.activeBatchItemIndex();
      if (idx >= 0 && idx < filtered.length) {
        this.onSelectBatch(rowIndex, filtered[idx]);
      }
    } else if (key === 'escape') {
      event.preventDefault();
      this.rowBatchDropdownOpen.update(prev => { const c = [...prev]; c[rowIndex] = false; return c; });
    }
  }

  onSelectBatch(rowIndex: number, batchItem: PurchaseBillItem) {
    // Auto-fill row fields from the selected historic batch
    this.items.update(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      row.batchNumber = batchItem.batchNumber;
      row.expiryDate = batchItem.expiryDate;
      row.mrp = batchItem.mrp;
      row.rate = batchItem.rate;
      row.cgstRate = batchItem.cgstRate;
      row.sgstRate = batchItem.sgstRate;
      row.discountPercentage = batchItem.discountPercentage;
      // Recalculate
      row.total = row.rate * row.quantity;
      const discountVal = row.total * (row.discountPercentage / 100);
      row.taxableAmount = row.total - discountVal;
      row.cgstAmount = row.taxableAmount * (row.cgstRate / 100);
      row.sgstAmount = row.taxableAmount * (row.sgstRate / 100);
      updated[rowIndex] = row;
      return updated;
    });
    // Close dropdown and sync query
    this.rowBatchQuery.update(prev => { const c = [...prev]; c[rowIndex] = batchItem.batchNumber; return c; });
    this.rowBatchDropdownOpen.update(prev => { const c = [...prev]; c[rowIndex] = false; return c; });
    // Move focus to next field (expiry)
    this.focusInput(rowIndex, 'expiry');
  }

  closeBatchDropdown(index: number) {
    setTimeout(() => {
      this.rowBatchDropdownOpen.update(prev => { const c = [...prev]; c[index] = false; return c; });
    }, 160); // small delay so click on dropdown item fires first
  }

  onSelectMasterRow(index: number, master: MedicineMaster) {
    this.items.update(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      row.productName = master.productName;
      row.productCode = master.productCode;
      row.hsnCode = master.hsnCode;
      row.cgstRate = master.cgst;
      row.sgstRate = master.sgst;
      row.reorderLevel = master.reorderLevel !== undefined && master.reorderLevel !== null ? master.reorderLevel : undefined;
      row.rackLocation = master.rackLocation || '';



      // Re-calculate row totals with new tax rates
      row.total = row.rate * row.quantity;
      const discountVal = row.total * (row.discountPercentage / 100);
      row.taxableAmount = row.total - discountVal;
      row.cgstAmount = row.taxableAmount * (row.cgstRate / 100);
      row.sgstAmount = row.taxableAmount * (row.sgstRate / 100);

      updated[index] = row;
      return updated;
    });

    // Reset dropdown & exit search mode
    this.rowSearchQueries.update(prev => {
      const updated = [...prev];
      updated[index] = '';
      return updated;
    });
    this.rowDropdownOpen.update(prev => {
      const updated = [...prev];
      updated[index] = false;
      return updated;
    });
    this.rowSearchMode.update(prev => {
      const updated = [...prev];
      updated[index] = false;
      return updated;
    });

    // Autofocus Qty input of this row
    this.focusInput(index, 'qty');
  }

  onSubmitBill(event: Event) {
    event.preventDefault();

    // Auto-remove the last row if it has no product selected (empty trailing row)
    const currentItems = this.items();
    if (currentItems.length > 1) {
      const lastItem = currentItems[currentItems.length - 1];
      if (!lastItem.productCode && !lastItem.batchNumber.trim()) {
        const lastIdx = currentItems.length - 1;
        this.items.update(prev => prev.slice(0, -1));
        this.rowSearchQueries.update(prev => prev.slice(0, -1));
        this.rowDropdownOpen.update(prev => prev.slice(0, -1));
        this.rowSearchMode.update(prev => prev.slice(0, -1));
        this.rowBatchQuery.update(prev => prev.slice(0, -1));
        this.rowBatchDropdownOpen.update(prev => prev.slice(0, -1));
      }
    }

    if (!this.invoiceNo().trim()) {
      this.showSnackbar('Please enter the Supplier Wholesaler Invoice Number.', 'danger');
      return;
    }
    if (!this.selectedSupplier()) {
      this.showSnackbar('Please select the Wholesaler from the Supplier ledger.', 'danger');
      return;
    }
    if (this.items().some(item => !item.productCode || !item.batchNumber.trim() || item.quantity <= 0)) {
      this.showSnackbar('Please ensure all rows have registered products, valid batch numbers, and stock quantities.', 'danger');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const hasInvalidExpiry = this.items().some(item => !item.expiryDate || !dateRegex.test(item.expiryDate));
    // if (hasInvalidExpiry) {
    //   this.showSnackbar('Please ensure all rows have a valid expiry date in MM/YY format (e.g. 05/26).', 'danger');
    //   return;
    // }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasExpiredItems = this.items().some(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) < today;
    });
    // if (hasExpiredItems) {
    //   this.showSnackbar('🛑 Error: Expiry date for one or more formulations in the grid is in the past! Cannot record expired stock.', 'danger');
    //   return;
    // }

    // Block items expiring in the current month
    const hasCurrentMonthExpiry = this.items().some(item => {
      if (!item.expiryDate) return false;
      const exp = new Date(item.expiryDate);
      return exp.getFullYear() === today.getFullYear() && exp.getMonth() === today.getMonth();
    });
    // if (hasCurrentMonthExpiry) {
    //   this.showSnackbar('🛑 Error: One or more items expire this month. Cannot record stock expiring in the current month.', 'danger');
    //   return;
    // }

    // Compare Net Amount vs Calculated Total (allowing rounding margins)
    const net = this.netAmount();
    const calculated = this.calculatedTotal();

    if (Math.abs(net - calculated) > 0.05) {
      // Trigger warning mismatch popup
      this.isMismatchModalOpen.set(true);
    } else {
      // Direct save
      this.saveBill();
    }
  }

  saveBill() {
    const billData: PurchaseBill = {
      invoiceNumber: this.invoiceNo().trim(),
      invoiceDate: this.invoiceDate(),
      supplierName: this.selectedSupplier(),
      netAmount: this.netAmount(),
      grossAmount: this.grossAmount(),
      discountAmount: this.discountAmount(),
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      totalAmount: this.calculatedTotal(),
      items: this.items()
    };

    const isEdit = this.editingBillId() !== null;
    const request$ = isEdit
      ? this.billService.update(this.editingBillId()!, billData)
      : this.billService.create(billData);

    request$.subscribe({
      next: (savedBill) => {
        // If this bill was loaded from a placed order, mark that order as RECEIVED
        const order = this.selectedOrder();
        if (order) {
          const updatedOrders = this.placedOrders().map(o =>
            o.id === order.id ? { ...o, status: 'RECEIVED' as const } : o
          );
          this.placedOrders.set(updatedOrders);
          localStorage.setItem('pharmacy_purchase_orders', JSON.stringify(updatedOrders));
          this.selectedOrder.set(null);
          this.orderQuery.set('');
        }

        // Auto-update supplier profile with new brands
        const supplierName = this.selectedSupplier();
        const sup = this.wholesalers().find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        if (sup && sup.id) {
          let hasNewBrand = false;
          let currentCompanies = (sup.suppliedCompanies || '')
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);

          this.items().forEach(item => {
            const master = this.mastersCatalog().find(m => m.productCode === item.productCode);
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
                this.wholesalers.update(list => list.map(s => s.id === savedSup.id ? savedSup : s));
              },
              error: (err) => {
                console.error('Failed to auto-update supplier supplied companies:', err);
              }
            });
          }
        }

        if (isEdit) {
          this.billHistory.update(prev => prev.map(b => b.id === savedBill.id ? savedBill : b));
          this.showSnackbar(`Wholesaler invoice ${savedBill.invoiceNumber} updated successfully! Token No: ${savedBill.tokenNumber}. Active stock inventory has been automatically reconciled.`, 'info');
        } else {
          this.billHistory.update(prev => [savedBill, ...prev]);
          this.showSnackbar(`Wholesaler invoice ${savedBill.invoiceNumber} recorded successfully! Generated Bill No: ${savedBill.billNumber}. Token No: ${savedBill.tokenNumber}. Active inventory has been automatically updated.`, 'info');
        }
        this.isMismatchModalOpen.set(false);
        this.isEditModalOpen.set(false); // Close edit modal popup
        this.editingBillId.set(null);
        this.editingBillNumber.set(null);
        this.editingTokenNumber.set(null);
        this.resetBillForm();

        // Redirect to appropriate view mode
        const isMismatch = Math.abs(savedBill.netAmount - savedBill.totalAmount) > 0.05;
        if (isMismatch) {
          this.router.navigate(['/purchase/draft']);
        } else {
          this.router.navigate(['/purchase/saved']);
        }
      },
      error: (err) => {
        this.showSnackbar(err.error || 'Failed to save purchase bill. Verify product code constraint details.', 'danger');
      }
    });
  }

  onEditBill(bill: PurchaseBill) {
    this.loadBillIntoForm(bill);
    this.isEditModalOpen.set(true);
    setTimeout(() => {
      document.getElementById('modal-header-supplier-search')?.focus();
    }, 150);
  }

  onCloseEditModal() {
    this.isEditModalOpen.set(false);
    this.editingBillId.set(null);
    this.editingBillNumber.set(null);
    this.editingTokenNumber.set(null);
    this.resetBillForm();
  }

  onCancelEdit() {
    this.onCloseEditModal();
  }

  resetBillForm() {
    this.invoiceNo.set('');
    this.invoiceDate.set(new Date().toISOString().split('T')[0]);
    this.selectedSupplier.set('');
    this.supplierSearchQuery.set('');
    this.activeSupplierItemIndex.set(0);
    this.netAmount.set(0.0);
    this.editingTokenNumber.set(null);
    this.items.set([]);
    this.rowSearchQueries.set([]);
    this.rowDropdownOpen.set([]);
    this.rowSearchMode.set([]);
    this.rowBatchQuery.set([]);
    this.rowBatchDropdownOpen.set([]);
    this.addNewRow(); // Start fresh with one row
  }

  trackItemBy(index: number, item: any) {
    return index;
  }

  // On-The-Fly Medicine Master Edit Handlers
  onOpenEditMasterModal(rowIndex: number, master: MedicineMaster, event: Event) {
    event.stopPropagation(); // Prevent autocomplete row select selection!
    
    this.editingMasterIndex.set(rowIndex);
    this.editingMasterModel.set(master);

    // Load fields
    this.masterProductName.set(master.productName);
    this.masterComposition.set(master.composition);
    this.masterProductCode.set(master.productCode);
    this.masterCompanyName.set(master.companyName);
    this.masterCategory.set(master.category);
    this.masterProductType.set(master.productType);
    this.masterProductQuantity.set(master.productQuantity);
    this.masterHsnCode.set(master.hsnCode);
    this.masterCgst.set(master.cgst);
    this.masterSgst.set(master.sgst);
    this.masterRackLocation.set(master.rackLocation || '');
    this.masterReorderLevel.set(master.reorderLevel !== undefined && master.reorderLevel !== null ? master.reorderLevel : null);

    this.isMasterEditModalOpen.set(true);
  }

  onOpenAddMasterModal(rowIndex: number, typedName: string, event: Event) {
    event.stopPropagation(); // Prevent autocomplete row select selection!
    
    this.editingMasterIndex.set(rowIndex);
    this.editingMasterModel.set(null); // null indicates Add/Register mode

    // Pre-populate with typed details
    this.masterProductName.set(typedName.trim());
    this.masterComposition.set('');
    
    // Auto-generate a clean SKU base from product name
    const skuBase = typedName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-');
    this.masterProductCode.set(skuBase ? `SKU-${skuBase}` : '');
    
    this.masterCompanyName.set('');
    this.masterCategory.set('medicine');
    this.masterProductType.set('Tablet');
    this.masterProductQuantity.set('10 tabs/strip');
    this.masterHsnCode.set('3004');
    this.masterCgst.set(6.0);
    this.masterSgst.set(6.0);
    this.masterRackLocation.set('');
    this.masterReorderLevel.set(null);

    this.isMasterEditModalOpen.set(true);
  }

  onCloseMasterEditModal() {
    this.isMasterEditModalOpen.set(false);
    this.editingMasterModel.set(null);
    this.editingMasterIndex.set(-1);
  }

  onMasterHsnChange(hsn: string) {
    this.masterHsnCode.set(hsn);
    const cleanHsn = hsn.trim();
    if (cleanHsn === '3002' || cleanHsn === '9021') {
      // 5% GST: Vaccines, Blood fractions, Cardiac Stents, Orthopaedic appliances
      this.masterCgst.set(2.5);
      this.masterSgst.set(2.5);
    } else if (cleanHsn === '3304' || cleanHsn === '2106' || cleanHsn === '3808' || cleanHsn === '4015' || cleanHsn === '9025' || cleanHsn === '9027') {
      // 18% GST: Cosmetics, Food/Protein Supplements, Hand Sanitizers, Surgical Gloves, BP Monitors/Thermometers
      this.masterCgst.set(9.0);
      this.masterSgst.set(9.0);
    } else if (cleanHsn === '30066030') {
      // 0% GST (Nil Rated): Oral contraceptives
      this.masterCgst.set(0.0);
      this.masterSgst.set(0.0);
    } else {
      // 12% GST: Standard Formulations (3004), Medicaments mixed (3003), Bandages/Dressings (3005), Sterile sutures (3006), Surgical instruments (9018)
      this.masterCgst.set(6.0);
      this.masterSgst.set(6.0);
    }
  }

  onSaveMasterEdit(event: Event) {
    event.preventDefault();

    const currentMaster = this.editingMasterModel();
    const isEdit = currentMaster !== null;

    const payload: MedicineMaster = {
      id: isEdit ? currentMaster.id : undefined,
      productName: this.masterProductName().trim(),
      composition: this.masterComposition().trim(),
      productCode: this.masterProductCode().trim(),
      companyName: this.masterCompanyName().trim(),
      category: this.masterCategory(),
      productType: this.masterProductType().trim(),
      productQuantity: this.masterProductQuantity().trim(),
      hsnCode: this.masterHsnCode().trim(),
      cgst: this.masterCgst(),
      sgst: this.masterSgst(),
      rackLocation: this.masterRackLocation().trim() || undefined,
      reorderLevel: this.masterReorderLevel() !== null ? this.masterReorderLevel()! : undefined,
      active: true
    };

    const request$ = isEdit && currentMaster.id
      ? this.masterService.update(currentMaster.id, payload)
      : this.masterService.create(payload);

    request$.subscribe({
      next: (savedMaster) => {
        // 1. Update the local masters catalog signal so autocomplete reflects changes
        if (isEdit) {
          this.mastersCatalog.update(catalog => 
            catalog.map(m => m.id === savedMaster.id ? savedMaster : m)
          );
        } else {
          this.mastersCatalog.update(catalog => [...catalog, savedMaster]);
        }

        // 2. Auto-select and auto-fill the updated/created details inside the dynamic table row immediately!
        const rowIndex = this.editingMasterIndex();
        if (rowIndex >= 0) {
          this.onSelectMasterRow(rowIndex, savedMaster);
        }

        this.onCloseMasterEditModal();
        
        const message = isEdit
          ? `Medicine Master for ${savedMaster.productName} updated successfully! Grid details have been auto-filled.`
          : `New static Product ${savedMaster.productName} registered in Master Directory! Grid details have been auto-filled.`;
        this.showSnackbar(message, 'info');
      },
      error: (err) => {
        this.showSnackbar(err.error || 'Failed to save Medicine Master details. Verify Product Code (SKU) uniqueness constraints.', 'danger');
      }
    });
  }

  isTabletOrCapsule(productCode: string): boolean {
    if (!productCode) return true; // default fallback
    const master = this.mastersCatalog().find(m => m.productCode === productCode);
    if (!master) return true; // default fallback
    const type = master.productType?.toLowerCase() || '';
    return type.includes('tablet') || type.includes('capsule');
  }

  formatDateToMMYYYY(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    if (/^\d{2}\/\d{4}$/.test(dateStr) || /^\d{2}\/?\d{0,4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      return `${month}/${year}`;
    }
    return dateStr;
  }

  // Glassmorphic Custom Snackbar Notifications
  snackbarMessage = signal<string | null>(null);
  snackbarType = signal<'danger' | 'warning' | 'info'>('info');
  private snackbarTimeoutId: any = null;

  showSnackbar(message: string, type: 'danger' | 'warning' | 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: type === 'danger' ? ['snackbar-danger'] : type === 'warning' ? ['snackbar-warning'] : ['snackbar-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  closeSnackbar() {
    this.snackBar.dismiss();
  }

  /**
   * Validates the expiry date for a row.
   * Returns true if there is a BLOCKING error (current month or past date) —
   * caller should keep cursor on the expiry field.
   * Returns false when the date is valid (or just a warning — cursor may advance).
   */
  checkExpiryAlert(index: number, refocusOnError = true): boolean {
    const items = this.items();
    if (index < 0 || index >= items.length) return false;
    const row = items[index];
    const value = row.expiryDate;
    if (!value) return false;

    const formatted = this.formatDateToMMYYYY(value);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(value)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(value);
      const drugName = row.productName ? `"${row.productName}"` : 'This medicine';

      // BLOCK: expiry is the current calendar month
      const isSameMonth =
        expDate.getFullYear() === today.getFullYear() &&
        expDate.getMonth() === today.getMonth();

      // if (isSameMonth) {
      //   this.showSnackbar(
      //     `🛑 ${drugName} expires this month (${formatted})! Cannot accept stock expiring in the current month.`,
      //     'danger'
      //   );
      //   if (refocusOnError) this.focusInput(index, 'expiry');
      //   return true; // blocking error
      // }

      // // BLOCK: already expired (past date)
      // if (expDate < today) {
      //   this.showSnackbar(
      //     `🛑 ${drugName} is EXPIRED! Expiry: ${formatted}. Cannot accept already-expired stock.`,
      //     'danger'
      //   );
      //   if (refocusOnError) this.focusInput(index, 'expiry');
      //   return true; // blocking error
      // }

      // WARNING: expires within 3 months (non-blocking — cursor may advance)
      // const threeMonthsLimit = new Date();
      // threeMonthsLimit.setMonth(threeMonthsLimit.getMonth() + 3);
      // threeMonthsLimit.setHours(0, 0, 0, 0);
      // if (expDate <= threeMonthsLimit) {
      //   this.showSnackbar(`⚠️ ${drugName} expires soon (within 3 months)! Expiry: ${formatted}`, 'warning');
      // }
    }
    return false; // no blocking error
  }

  focusInput(row: number, field: string) {
    setTimeout(() => {
      const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
      const element = document.getElementById(`${idPrefix}${field}-input-${row}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onInputEnter(event: Event, rowIndex: number, field: string) {
    event.preventDefault();

    // Validate expiry on Enter — block navigation if current month or past date
    if (field === 'expiry') {
      const hasError = this.checkExpiryAlert(rowIndex, true);
      if (hasError) return; // cursor already refocused inside checkExpiryAlert
    }

    const order = ['qty', 'free', 'batch', 'expiry', 'reorder', 'rack', 'mrp', 'rate', 'discount', 'cgst', 'sgst'];
    const idx = order.indexOf(field);
    if (idx >= 0 && idx < order.length - 1) {
      this.focusInput(rowIndex, order[idx + 1]);
    } else if (field === 'sgst') {
      if (rowIndex === this.items().length - 1) {
        this.addNewRow();
      }
      const nextRowIndex = rowIndex + 1;
      if (this.items()[nextRowIndex]?.productCode) {
        this.enterSearchMode(nextRowIndex);
      } else {
        this.focusInput(nextRowIndex, 'search');
      }
    }
  }

  // Enter search mode for a row so search input reappears in DOM without clearing the selected product
  enterSearchMode(index: number) {
    const item = this.items()[index];
    this.rowSearchQueries.update(prev => {
      const copy = [...prev];
      copy[index] = item.productName || '';
      return copy;
    });
    this.rowDropdownOpen.update(prev => {
      const copy = [...prev];
      copy[index] = false;
      return copy;
    });
    this.rowSearchMode.update(prev => {
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });
    setTimeout(() => {
      const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
      const el = document.getElementById(`${idPrefix}search-input-${index}`);
      if (el) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
    }, 50);
  }

  onInputEscape(event: Event, rowIndex: number, field: string) {
    event.preventDefault();
    const order = ['search', 'qty', 'free', 'batch', 'expiry', 'reorder', 'rack', 'mrp', 'rate', 'discount', 'cgst', 'sgst'];
    const idx = order.indexOf(field);
    if (idx > 1) {
      this.focusInput(rowIndex, order[idx - 1]);
    } else if (idx === 1) {
      // From 'qty' → go back to search input
      if (this.items()[rowIndex]?.productCode) {
        // Product selected: enter search mode so input appears in DOM
        this.enterSearchMode(rowIndex);
      } else {
        const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
        const searchEl = document.getElementById(`${idPrefix}search-input-${rowIndex}`);
        if (searchEl) {
          searchEl.focus();
          if (searchEl instanceof HTMLInputElement) searchEl.select();
        }
      }
    } else if (field === 'search') {
      // From search → go back to header (Net Amount field)
      if (rowIndex > 0) {
        this.focusInput(rowIndex - 1, 'sgst');
      } else {
        // First row → go back to Net Amount header field
        const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
        const netAmountEl = document.getElementById(`${idPrefix}header-netAmount`);
        if (netAmountEl) netAmountEl.focus();
      }
    }
  }

  onHeaderEnter(event: Event, field: 'supplier' | 'invoiceNo' | 'invoiceDate' | 'netAmount') {
    event.preventDefault();
    const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
    if (field === 'supplier') {
      document.getElementById(`${idPrefix}header-invoiceNo`)?.focus();
    } else if (field === 'invoiceNo') {
      document.getElementById(`${idPrefix}header-invoiceDate`)?.focus();
    } else if (field === 'invoiceDate') {
      document.getElementById(`${idPrefix}header-netAmount`)?.focus();
    } else if (field === 'netAmount') {
      // Move to first row search input. If product already selected, activate search mode so input is rendered
      if (this.items()[0]?.productCode) {
        this.enterSearchMode(0);
      } else {
        const searchEl = document.getElementById(`${idPrefix}search-input-0`);
        if (searchEl) { searchEl.focus(); if (searchEl instanceof HTMLInputElement) searchEl.select(); }
      }
    }
  }

  onHeaderEscape(event: Event, field: 'supplier' | 'invoiceNo' | 'invoiceDate' | 'netAmount') {
    event.preventDefault();
    const idPrefix = this.isEditModalOpen() ? 'modal-' : '';
    if (field === 'invoiceNo') {
      document.getElementById(`${idPrefix}header-supplier-search`)?.focus();
    } else if (field === 'invoiceDate') {
      document.getElementById(`${idPrefix}header-invoiceNo`)?.focus();
    } else if (field === 'netAmount') {
      document.getElementById(`${idPrefix}header-invoiceDate`)?.focus();
    }
  }

  deleteBill(bill: PurchaseBill) {
    if (!bill.id) return;
    const confirmMsg = `⚠️ Are you sure you want to delete Wholesaler Invoice: ${bill.invoiceNumber || 'N/A'} (Token: #${bill.tokenNumber || 'N/A'})?\n\nThis will permanently delete this invoice and automatically reverse all stock levels associated with it.`;
    if (confirm(confirmMsg)) {
      this.loading.set(true);
      this.billService.delete(bill.id).subscribe({
        next: () => {
          this.snackBar.open(`🗑️ Purchase Invoice deleted successfully!`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.loadInitialData();
        },
        error: (err) => {
          this.loading.set(false);
          this.snackBar.open(`🛑 Failed to delete purchase invoice.`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          console.error(err);
        }
      });
    }
  }
}
