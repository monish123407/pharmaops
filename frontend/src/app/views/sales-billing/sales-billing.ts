import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MedicineService } from '../../services/medicine.service';
import { SalesService } from '../../services/sales.service';
import { PrescriptionService } from '../../services/prescription.service';
import { MedicineMasterService } from '../../services/medicine-master.service';
import { AuthService } from '../../services/auth.service';
import { CustomerService } from '../../services/customer.service';
import { Medicine, MedicineMaster, Prescription, Sale, CheckoutRequest, CheckoutItem } from '../../models/types';

export interface GroupedCatalogItem {
  name: string;
  genericName: string;
  sku: string;
  rackLocation: string;
  totalStockLevel: number;
  minPrice: number;
  maxPrice: number;
  batches: Medicine[];
}

export interface POSRowItem {
  medicineId?: number;
  productName?: string;
  sku?: string;
  batchNumber?: string;
  expiryDate?: string;
  sellingPrice?: number;
  gstRate?: number;
  hsnCode?: string;
  stockLevel?: number;
  packSize?: number;
  isTabletOrCapsule?: boolean;
  strips?: number;
  loose?: number;
  quantity?: number;
  totalQuantity?: number;
  rowTotal?: number;
  discountPercentage?: number;
}

@Component({
  selector: 'app-sales-billing',
  standalone: true,
  imports: [DecimalPipe, DatePipe, MatSnackBarModule],
  templateUrl: './sales-billing.html',
  styleUrl: './sales-billing.css'
})
export class SalesBillingComponent implements OnInit {
  private readonly medicineService = inject(MedicineService);
  private readonly salesService = inject(SalesService);
  private readonly prescriptionService = inject(PrescriptionService);
  private readonly masterService = inject(MedicineMasterService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly customerService = inject(CustomerService);

  // Catalog State Signals
  catalog = signal<Medicine[]>([]);
  mastersCatalog = signal<MedicineMaster[]>([]);
  catalogSearch = signal<string>('');
  catalogLoading = signal<boolean>(true);

  // Batch Selector Modal State
  isBatchSelectorOpen = signal<boolean>(false);
  batchSelectorOptions = signal<Medicine[]>([]);
  selectedCatalogFormulationName = signal<string>('');
  activeBatchIndex = signal<number>(0); // keyboard-focused row in batch modal

  // Cart/Grid State Signals (initially one empty row!)
  cart = signal<POSRowItem[]>([{}]);

  // Header Form Inputs Signals
  customerName = signal<string>('');
  patientPhone = signal<string>('');
  doctorName = signal<string>('');
  patientAddress = signal<string>('');
  paymentMethod = signal<string>('Cash');
  discountPercentage = signal<number>(0);
  salesHistory = signal<Sale[]>([]);

  // Autocomplete Signals
  rowSearchQueries = signal<string[]>(['']);
  rowDropdownOpen = signal<boolean[]>([false]);
  rowSearchMode = signal<boolean[]>([false]); // true = show search input even if medicine selected
  activeListItemIndex = signal<number>(-1);
  activeBatchSelectionRowIndex = signal<number | null>(null);

  linkPrescription = signal<boolean>(false);
  pendingPrescriptions = signal<Prescription[]>([]);
  selectedPrescriptionId = signal<number | null>(null);

  // Transaction Actions Signals
  checkingOut = signal<boolean>(false);
  activeInvoice = signal<Sale | null>(null);
  linkedPrescriptionDetail = signal<Prescription | null>(null);

  // Computed signal for live incremental search - groups active catalog records by SKU
  filteredCatalog = computed(() => {
    const list = this.catalog();
    const search = this.catalogSearch().trim().toLowerCase();

    // Group active medicines by SKU
    const skuMap = new Map<string, Medicine[]>();
    list.forEach(m => {
      if (m.active === undefined || m.active) {
        if (!skuMap.has(m.sku)) {
          skuMap.set(m.sku, []);
        }
        skuMap.get(m.sku)!.push(m);
      }
    });

    let groupedCatalog: GroupedCatalogItem[] = [];

    skuMap.forEach((batches, sku) => {
      const first = batches[0];
      const totalStock = batches.reduce((sum, b) => sum + b.stockLevel, 0);
      const rackLocations = Array.from(new Set(batches.map(b => b.rackLocation).filter(r => !!r)));
      const rackStr = rackLocations.join(', ') || 'Unassigned';
      
      const prices = batches.map(b => b.sellingPrice);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      groupedCatalog.push({
        name: first.name,
        genericName: first.genericName,
        sku: sku,
        rackLocation: rackStr,
        totalStockLevel: totalStock,
        minPrice,
        maxPrice,
        batches
      });
    });

    if (search) {
      groupedCatalog = groupedCatalog.filter(m => 
        m.name.toLowerCase().includes(search) || 
        m.genericName.toLowerCase().includes(search) || 
        m.sku.toLowerCase().includes(search)
      );
    }

    return groupedCatalog;
  });

  // Computed totals signal for cart checkouts
  grossTotal = computed(() => {
    return this.cart().reduce((sum, row) => sum + (row.rowTotal || 0), 0);
  });

  discountAmount = computed(() => {
    return this.cart().reduce((sum, row) => {
      if (!row.medicineId || !row.rowTotal) return sum;
      const pct = row.discountPercentage !== undefined ? row.discountPercentage : 0;
      return sum + (row.rowTotal * pct) / 100;
    }, 0);
  });

  subtotal = computed(() => {
    return this.cart().reduce((sum, row) => {
      if (!row.medicineId || !row.rowTotal) return sum;
      const rate = row.gstRate !== undefined ? row.gstRate : 12.0;
      const pct = row.discountPercentage !== undefined ? row.discountPercentage : 0;
      const rowDiscount = (row.rowTotal * pct) / 100;
      const rowNet = Math.max(0, row.rowTotal - rowDiscount);
      const taxable = rowNet / (1 + rate / 100);
      return sum + taxable;
    }, 0);
  });

  rawGrandTotal = computed(() => {
    return this.cart().reduce((sum, row) => {
      if (!row.medicineId || !row.rowTotal) return sum;
      const pct = row.discountPercentage !== undefined ? row.discountPercentage : 0;
      const rowDiscount = (row.rowTotal * pct) / 100;
      return sum + Math.max(0, row.rowTotal - rowDiscount);
    }, 0);
  });

  grandTotal = computed(() => {
    return Math.floor(this.rawGrandTotal());
  });

  roundOff = computed(() => {
    return this.grandTotal() - this.rawGrandTotal();
  });

  taxAmount = computed(() => {
    const grand = this.rawGrandTotal();
    const sub = this.subtotal();
    return Math.max(0, grand - sub);
  });

  hsnSummary = computed(() => {
    const invoice = this.activeInvoice();
    if (!invoice || !invoice.items) return [];

    const summaryMap = new Map<string, { hsn: string; rate: number; taxable: number; gst: number }>();

    invoice.items.forEach(item => {
      const hsn = item.hsnCode || '3004';
      const rate = item.gstRate !== undefined ? item.gstRate : 12.0;
      const key = `${hsn}-${rate}`;

      const itemSubtotal = item.subtotal;
      const itemDiscount = (itemSubtotal * (item.discountPercentage || 0)) / 100;
      const itemNet = Math.max(0, itemSubtotal - itemDiscount);

      const taxable = itemNet / (1 + rate / 100);
      const gst = itemNet - taxable;

      if (summaryMap.has(key)) {
        const exist = summaryMap.get(key)!;
        exist.taxable += taxable;
        exist.gst += gst;
      } else {
        summaryMap.set(key, { hsn, rate, taxable, gst });
      }
    });

    return Array.from(summaryMap.values());
  });

  constructor() {
    effect(() => {
      const invoice = this.activeInvoice();
      if (invoice) {
        document.documentElement.classList.add('pos-print-mode');
      } else {
        document.documentElement.classList.remove('pos-print-mode');
      }
    });
  }

  ngOnInit() {
    this.loadCatalog();
    this.loadPendingPrescriptions();
    this.loadMasters();
    this.loadSalesHistory();
  }

  loadCatalog() {
    this.catalogLoading.set(true);
    this.medicineService.getAll().subscribe({
      next: (data) => {
        this.catalog.set(data);
        this.catalogLoading.set(false);
      },
      error: () => this.catalogLoading.set(false)
    });
  }

  loadMasters() {
    this.masterService.getAll().subscribe({
      next: (data) => this.mastersCatalog.set(data)
    });
  }

  loadSalesHistory() {
    this.salesService.getAllSales().subscribe({
      next: (data) => this.salesHistory.set(data),
      error: (err) => console.error('Failed to load sales history', err)
    });
  }

  loadPendingPrescriptions() {
    this.prescriptionService.getAll().subscribe({
      next: (data) => {
        this.pendingPrescriptions.set(data.filter(p => p.status === 'PENDING'));
        this.resolveQueryParams();
      }
    });
  }

  resolveQueryParams() {
    this.route.queryParams.subscribe(params => {
      const prescId = params['prescriptionId'];
      if (prescId) {
        this.linkPrescription.set(true);
        setTimeout(() => {
          this.onPrescriptionSelect(prescId.toString());
        }, 100);
      }
    });
  }

  // Autocomplete Lookup for specific rows
  getFilteredCatalogForRow(query: string): GroupedCatalogItem[] {
    const search = query.trim().toLowerCase();
    if (!search) return [];

    const list = this.catalog();
    const skuMap = new Map<string, Medicine[]>();
    list.forEach(m => {
      if (m.active === undefined || m.active) {
        if (!skuMap.has(m.sku)) {
          skuMap.set(m.sku, []);
        }
        skuMap.get(m.sku)!.push(m);
      }
    });

    const groupedList: GroupedCatalogItem[] = [];
    skuMap.forEach((batches, sku) => {
      const first = batches[0];
      const totalStock = batches.reduce((sum, b) => sum + b.stockLevel, 0);
      const rackLocations = Array.from(new Set(batches.map(b => b.rackLocation).filter(r => !!r)));
      const rackStr = rackLocations.join(', ') || 'Unassigned';
      
      const prices = batches.map(b => b.sellingPrice);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      groupedList.push({
        name: first.name,
        genericName: first.genericName,
        sku: sku,
        rackLocation: rackStr,
        totalStockLevel: totalStock,
        minPrice,
        maxPrice,
        batches
      });
    });

    return groupedList.filter(m => 
      m.name.toLowerCase().includes(search) || 
      m.genericName.toLowerCase().includes(search) || 
      m.sku.toLowerCase().includes(search)
    );
  }

  onSearchMasterRow(index: number, value: string) {
    this.rowSearchQueries.update(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });

    this.rowDropdownOpen.update(prev => {
      const copy = [...prev];
      copy[index] = value.trim().length > 0;
      return copy;
    });
    
    this.activeListItemIndex.set(0);
  }

  onSelectMasterRow(index: number, master: GroupedCatalogItem) {
    if (!master || !master.sku) return;

    // Filter available active, in-stock, and non-expired batches
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeBatches = this.catalog().filter(m =>
      m.sku === master.sku &&
      m.stockLevel > 0 &&
      (m.active === undefined || m.active) &&
      (!m.expiryDate || new Date(m.expiryDate) > today)   // exclude expired batches
    );
    
    if (activeBatches.length === 0) {
      this.snackBar.open('Insufficient stock for this medicine formulation.', 'Close', { duration: 4000 });
      return;
    }
    
    if (activeBatches.length === 1) {
      this.populateRowWithBatch(index, activeBatches[0]);
    } else {
      activeBatches.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        const timeA = new Date(a.expiryDate).getTime();
        const timeB = new Date(b.expiryDate).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeA - timeB;
      });
      
      this.activeBatchSelectionRowIndex.set(index);
      this.batchSelectorOptions.set(activeBatches);
      this.selectedCatalogFormulationName.set(activeBatches[0].name);
      this.activeBatchIndex.set(0);
      this.isBatchSelectorOpen.set(true);
      // Auto-focus first batch row button after modal renders
      setTimeout(() => {
        const btn = document.getElementById('batch-select-btn-0');
        if (btn) btn.focus();
      }, 80);
    }
  }

  selectBatch(batch: Medicine) {
    const index = this.activeBatchSelectionRowIndex();
    if (index !== null) {
      this.populateRowWithBatch(index, batch);
    }
    this.isBatchSelectorOpen.set(false);
    this.activeBatchSelectionRowIndex.set(null);
  }

  closeBatchSelector() {
    this.isBatchSelectorOpen.set(false);
    this.activeBatchSelectionRowIndex.set(null);
    this.activeBatchIndex.set(0);
  }

  onBatchKeyDown(event: KeyboardEvent, batchIndex: number) {
    const batches = this.batchSelectorOptions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(batchIndex + 1, batches.length - 1);
      this.activeBatchIndex.set(next);
      setTimeout(() => document.getElementById(`batch-select-btn-${next}`)?.focus(), 20);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = Math.max(batchIndex - 1, 0);
      this.activeBatchIndex.set(prev);
      setTimeout(() => document.getElementById(`batch-select-btn-${prev}`)?.focus(), 20);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectBatch(batches[batchIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeBatchSelector();
    }
  }

  populateRowWithBatch(index: number, batch: Medicine) {
    const isTabOrCap = this.isTabletOrCapsule(batch);
    const packSize = this.getPackSize(batch);

    this.cart.update(prev => {
      const copy = [...prev];
      copy[index] = {
        medicineId: batch.id,
        productName: batch.name,
        sku: batch.sku,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        sellingPrice: batch.sellingPrice,
        gstRate: batch.gstRate,
        hsnCode: batch.hsnCode,
        stockLevel: batch.stockLevel,
        packSize: packSize,
        isTabletOrCapsule: isTabOrCap,
        
        strips: isTabOrCap ? 1 : undefined,
        loose: isTabOrCap ? 0 : undefined,
        quantity: isTabOrCap ? undefined : 1,
        
        totalQuantity: isTabOrCap ? packSize : 1,
        rowTotal: batch.sellingPrice,
        discountPercentage: this.discountPercentage()
      };
      return copy;
    });

    // Clear search queries, dropdown & exit search mode
    this.rowSearchQueries.update(prev => {
      const copy = [...prev];
      copy[index] = '';
      return copy;
    });
    this.rowDropdownOpen.update(prev => {
      const copy = [...prev];
      copy[index] = false;
      return copy;
    });
    this.rowSearchMode.update(prev => {
      const copy = [...prev];
      copy[index] = false;
      return copy;
    });

    // Autofocus dynamic strips or pack quantity input
    setTimeout(() => {
      if (isTabOrCap) {
        this.focusPOSField(`pos-field-strips-${index}`);
      } else {
        this.focusPOSField(`pos-field-qty-${index}`);
      }
    }, 100);
  }

  onRowQtyChange(index: number, field: 'strips' | 'loose' | 'qty', value: string) {
    const num = +value || 0;
    this.cart.update(prev => {
      const copy = [...prev];
      const row = { ...copy[index] };
      
      if (row.isTabletOrCapsule) {
        if (field === 'strips') row.strips = num;
        if (field === 'loose') row.loose = num;
        
        const packSize = row.packSize || 10;
        row.totalQuantity = ((row.strips || 0) * packSize) + (row.loose || 0);
        row.rowTotal = (row.totalQuantity || 0) * (row.sellingPrice! / packSize);
      } else {
        if (field === 'qty') row.quantity = num;
        row.totalQuantity = row.quantity || 0;
        row.rowTotal = (row.totalQuantity || 0) * row.sellingPrice!;
      }
      
      // Stock Level Limit Enforcement
      if ((row.totalQuantity || 0) > row.stockLevel!) {
        this.snackBar.open(`Only ${row.stockLevel} units of ${row.productName} are currently available in stock (Selected batch: ${row.batchNumber}).`, 'Close', { duration: 4000 });
        
        if (row.isTabletOrCapsule) {
          const packSize = row.packSize || 10;
          row.strips = Math.floor(row.stockLevel! / packSize);
          row.loose = row.stockLevel! % packSize;
          row.totalQuantity = row.stockLevel;
          row.rowTotal = (row.totalQuantity || 0) * (row.sellingPrice! / packSize);
        } else {
          row.quantity = row.stockLevel;
          row.totalQuantity = row.stockLevel;
          row.rowTotal = (row.totalQuantity || 0) * row.sellingPrice!;
        }
      }

      copy[index] = row;
      return copy;
    });
  }

  addNewRow() {
    this.cart.update(prev => [...prev, {}]);
    this.rowSearchQueries.update(prev => [...prev, '']);
    this.rowDropdownOpen.update(prev => [...prev, false]);
    this.rowSearchMode.update(prev => [...prev, false]);

    const nextIndex = this.cart().length - 1;
    setTimeout(() => {
      this.focusPOSField(`search-input-${nextIndex}`);
    }, 100);
  }

  removeRow(index: number) {
    if (this.cart().length === 1) {
      this.cart.set([{}]);
      this.rowSearchQueries.set(['']);
      this.rowDropdownOpen.set([false]);
      this.rowSearchMode.set([false]);
      return;
    }

    this.cart.update(prev => prev.filter((_, idx) => idx !== index));
    this.rowSearchQueries.update(prev => prev.filter((_, idx) => idx !== index));
    this.rowDropdownOpen.update(prev => prev.filter((_, idx) => idx !== index));
    this.rowSearchMode.update(prev => prev.filter((_, idx) => idx !== index));
  }

  // Enters search mode for a row — shows search input without clearing the selected medicine
  clearRowMedicine(index: number) {
    const row = this.cart()[index];
    // Pre-fill search with current medicine name so user sees what was selected
    this.rowSearchQueries.update(prev => {
      const copy = [...prev];
      copy[index] = row.productName || '';
      return copy;
    });
    this.rowDropdownOpen.update(prev => {
      const copy = [...prev];
      copy[index] = false;
      return copy;
    });
    // Enter search mode — shows search input in DOM while keeping medicine data intact
    this.rowSearchMode.update(prev => {
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });
    setTimeout(() => this.focusPOSField(`search-input-${index}`), 50);
  }

  clearCart() {
    this.cart.set([{}]);
    this.rowSearchQueries.set(['']);
    this.rowDropdownOpen.set([false]);
    this.rowSearchMode.set([false]);
    this.selectedPrescriptionId.set(null);
    this.customerName.set('');
    this.patientPhone.set('');
    this.doctorName.set('');
    this.patientAddress.set('');
    this.discountPercentage.set(0);
  }

  onPhoneInput(value: string) {
    this.patientPhone.set(value);
    const cleaned = value.trim();
    if (!cleaned) return;
    
    // Look up customer by phone from the Customer Register service
    this.customerService.getByPhone(cleaned).subscribe({
      next: (cust) => {
        if (cust) {
          if (cust.name) {
            this.customerName.set(cust.name);
          }
          if (cust.address) {
            this.patientAddress.set(cust.address);
          }
        }
      },
      error: () => {
        // Fallback: search sales history if customer is not found in the Register
        const matchedSale = [...this.salesHistory()]
          .reverse()
          .find(sale => sale.patientPhone && sale.patientPhone.trim() === cleaned);
          
        if (matchedSale) {
          if (matchedSale.customerName) {
            this.customerName.set(matchedSale.customerName);
          }
          if (matchedSale.patientAddress) {
            this.patientAddress.set(matchedSale.patientAddress);
          }
        }
      }
    });
  }

  updateHeaderDiscount(pct: number) {
    this.discountPercentage.set(pct);
    // Update all existing items in the cart to this discount percentage
    this.cart.update(prev => {
      return prev.map(row => {
        if (row.medicineId) {
          return { ...row, discountPercentage: pct };
        }
        return row;
      });
    });
  }

  onRowDiscountChange(index: number, value: string) {
    const num = +value || 0;
    this.cart.update(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], discountPercentage: num };
      return copy;
    });
  }

  // Prescription Link Actions
  togglePrescriptionLink(checked: boolean) {
    this.linkPrescription.set(checked);
    if (checked) {
      this.loadPendingPrescriptions();
    } else {
      this.selectedPrescriptionId.set(null);
    }
  }

  onPrescriptionSelect(idStr: string) {
    if (!idStr) {
      this.selectedPrescriptionId.set(null);
      return;
    }

    const prescId = +idStr;
    this.selectedPrescriptionId.set(prescId);

    const presc = this.pendingPrescriptions().find(p => p.id === prescId);
    if (!presc) return;

    this.customerName.set(presc.patientName);
    this.doctorName.set(presc.doctorName);

    let missingMeds: string[] = [];
    const availableCatalog = this.catalog();

    this.cart.set([]);
    this.rowSearchQueries.set([]);
    this.rowDropdownOpen.set([]);

    presc.items.forEach(pi => {
      const match = availableCatalog.find(m => 
        m.name.toLowerCase().includes(pi.medicineName.toLowerCase()) ||
        pi.medicineName.toLowerCase().includes(m.name.toLowerCase())
      );

      if (match) {
        const activeBatches = availableCatalog.filter(m => m.sku === match.sku && m.stockLevel > 0 && (m.active === undefined || m.active));
        if (activeBatches.length > 0) {
          activeBatches.sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            const timeA = new Date(a.expiryDate).getTime();
            const timeB = new Date(b.expiryDate).getTime();
            if (isNaN(timeA)) return 1;
            if (isNaN(timeB)) return -1;
            return timeA - timeB;
          });
          const oldestBatch = activeBatches[0];
          
          const orderQty = Math.min(pi.quantity, oldestBatch.stockLevel);
          const isTabOrCap = this.isTabletOrCapsule(oldestBatch);
          const packSize = this.getPackSize(oldestBatch);
          
          const strips = isTabOrCap ? Math.floor(orderQty / packSize) : undefined;
          const loose = isTabOrCap ? orderQty % packSize : undefined;
          const quantity = isTabOrCap ? undefined : orderQty;

          const row: POSRowItem = {
            medicineId: oldestBatch.id,
            productName: oldestBatch.name,
            sku: oldestBatch.sku,
            batchNumber: oldestBatch.batchNumber,
            expiryDate: oldestBatch.expiryDate,
            sellingPrice: oldestBatch.sellingPrice,
            gstRate: oldestBatch.gstRate,
            hsnCode: oldestBatch.hsnCode,
            stockLevel: oldestBatch.stockLevel,
            packSize: packSize,
            isTabletOrCapsule: isTabOrCap,
            strips,
            loose,
            quantity,
            totalQuantity: orderQty,
            rowTotal: isTabOrCap ? orderQty * (oldestBatch.sellingPrice / packSize) : orderQty * oldestBatch.sellingPrice,
            discountPercentage: this.discountPercentage()
          };

          this.cart.update(prev => [...prev, row]);
          this.rowSearchQueries.update(prev => [...prev, '']);
          this.rowDropdownOpen.update(prev => [...prev, false]);
          
          if (orderQty < pi.quantity) {
            missingMeds.push(`${pi.medicineName} (Short Stocked: Prescribed ${pi.quantity}, Added ${orderQty})`);
          }
        } else {
          missingMeds.push(pi.medicineName + " (Formulation is sold out)");
        }
      } else {
        missingMeds.push(pi.medicineName + " (Formulation not found in catalog)");
      }
    });

    if (this.cart().length === 0) {
      this.cart.set([{}]);
      this.rowSearchQueries.set(['']);
      this.rowDropdownOpen.set([false]);
    } else {
      this.cart.update(prev => [...prev, {}]);
      this.rowSearchQueries.update(prev => [...prev, '']);
      this.rowDropdownOpen.update(prev => [...prev, false]);
    }

    if (missingMeds.length > 0) {
      this.snackBar.open(`Prescription linked successfully! Mappings adjusted for ${missingMeds.length} items.`, 'Close', { duration: 5000 });
    }
  }

  // Checkout Actions
  onCheckout() {
    const validItems = this.cart().filter(row => row.medicineId !== undefined);
    if (validItems.length === 0 || this.checkingOut()) return;

    this.checkingOut.set(true);

    const checkoutItems: CheckoutItem[] = validItems.map(c => ({
      medicineId: c.medicineId!,
      quantity: c.totalQuantity!,
      discountPercentage: c.discountPercentage || 0
    }));

    const req: CheckoutRequest = {
      customerName: this.customerName() || 'Walk-in Customer',
      patientPhone: this.patientPhone(),
      doctorName: this.doctorName(),
      patientAddress: this.patientAddress(),
      discountAmount: this.discountAmount(),
      taxAmount: this.taxAmount(),
      paymentMethod: this.paymentMethod(),
      cashierName: this.auth.userFullName() || 'Pharmacist',
      prescriptionId: this.linkPrescription() ? this.selectedPrescriptionId() || undefined : undefined,
      items: checkoutItems
    };

    this.salesService.checkout(req).subscribe({
      next: (invoice) => {
        this.activeInvoice.set(invoice);

        if (req.prescriptionId) {
          const presc = this.pendingPrescriptions().find(p => p.id === req.prescriptionId);
          if (presc) {
            this.linkedPrescriptionDetail.set(presc);
          }
        }

        // Reset inputs and fields
        this.cart.set([{}]);
        this.rowSearchQueries.set(['']);
        this.rowDropdownOpen.set([false]);
        this.customerName.set('');
        this.patientPhone.set('');
        this.doctorName.set('');
        this.patientAddress.set('');
        this.discountPercentage.set(0);
        this.linkPrescription.set(false);
        this.selectedPrescriptionId.set(null);
        
        this.loadCatalog();
        this.loadPendingPrescriptions();
        this.loadSalesHistory();
        
        this.checkingOut.set(false);

        // Focus the Print Invoice button in the receipt modal
        setTimeout(() => {
          const printBtn = document.getElementById('pos-btn-print-receipt');
          if (printBtn) {
            printBtn.focus();
          }
        }, 200);
      },
      error: (err) => {
        this.snackBar.open(err.error || 'POS checkout failed. Please verify stock quantities.', 'Close', { duration: 5000 });
        this.checkingOut.set(false);
      }
    });
  }

  onPrintReceipt() {
    window.print();
  }

  getRoundOff(invoice: any): number {
    if (!invoice) return 0;
    const rawNet = (invoice.totalAmount || 0) - (invoice.discountAmount || 0);
    return (invoice.finalAmount || 0) - rawNet;
  }

  closeInvoiceModal() {
    this.activeInvoice.set(null);
    this.linkedPrescriptionDetail.set(null);
  }

  // Strips & Loose calculation helpers
  parsePackSize(productQuantity: string): number {
    if (!productQuantity) return 10;
    const match = productQuantity.match(/(\d+)/);
    return match ? +match[1] : 10;
  }

  getPackSize(medicine: Medicine | GroupedCatalogItem | POSRowItem): number {
    if (!this.isTabletOrCapsule(medicine)) return 1;
    const master = this.mastersCatalog().find(m => m.productCode === medicine.sku);
    if (!master) return 10;
    return this.parsePackSize(master.productQuantity);
  }

  getStripsValue(medicine: Medicine, qty: number): number {
    const packSize = this.getPackSize(medicine);
    return Math.floor(qty / packSize);
  }

  getLooseValue(medicine: Medicine, qty: number): number {
    const packSize = this.getPackSize(medicine);
    return qty % packSize;
  }

  isTabletOrCapsule(medicine: Medicine | GroupedCatalogItem | POSRowItem): boolean {
    if (!medicine.sku) return true;
    const master = this.mastersCatalog().find(m => m.productCode === medicine.sku);
    if (!master) return true;
    const type = master.productType?.toLowerCase() || '';
    return type.includes('tablet') || type.includes('capsule');
  }

  getStockQtyString(medicine: Medicine | GroupedCatalogItem): string {
    const stockVal = 'totalStockLevel' in medicine ? medicine.totalStockLevel : medicine.stockLevel;
    if (this.isTabletOrCapsule(medicine)) {
      const packSize = this.getPackSize(medicine);
      const strips = Math.floor(stockVal / packSize);
      const loose = stockVal % packSize;
      if (strips > 0 && loose > 0) {
        return `${strips} Strip${strips > 1 ? 's' : ''}, ${loose} Loose (${stockVal} tabs)`;
      } else if (strips > 0) {
        return `${strips} Strip${strips > 1 ? 's' : ''} (${stockVal} tabs)`;
      } else {
        return `${loose} Loose tablet${loose > 1 ? 's' : ''}`;
      }
    } else {
      return `${stockVal} Pack${stockVal > 1 ? 's' : ''}`;
    }
  }

  isExpired(dateStr: string): boolean {
    return new Date(dateStr) <= new Date();
  }

  isExpiringSoon(dateStr: string): boolean {
    const today = new Date();
    const exp = new Date(dateStr);
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return exp > today && exp <= limit;
  }

  getExpiryStatusBadgeClass(dateStr: string): string {
    if (this.isExpired(dateStr)) {
      return 'badge badge-danger';
    } else if (this.isExpiringSoon(dateStr)) {
      return 'badge badge-warning';
    } else {
      return 'badge badge-success';
    }
  }

  getExpiryStatusLabel(dateStr: string): string {
    if (this.isExpired(dateStr)) {
      return 'Expired';
    } else if (this.isExpiringSoon(dateStr)) {
      return 'Expiring Soon';
    } else {
      return 'Stable';
    }
  }

  getReceiptQtyString(medicineName: string, totalQty: number): string {
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === medicineName.toLowerCase());
    if (!master) return `${totalQty} units`;
    const productType = master.productType?.toLowerCase() || '';
    if (!(productType.includes('tablet') || productType.includes('capsule'))) {
      return `${totalQty} Pack${totalQty > 1 ? 's' : ''}`;
    }
    const packSize = this.parsePackSize(master.productQuantity);
    const strips = Math.floor(totalQty / packSize);
    const loose = totalQty % packSize;
    if (strips > 0 && loose > 0) {
      return `${strips} Strip${strips > 1 ? 's' : ''}, ${loose} Loose (${totalQty} tabs)`;
    } else if (strips > 0) {
      return `${strips} Strip${strips > 1 ? 's' : ''} (${totalQty} tabs)`;
    } else {
      return `${loose} Loose tablet${loose > 1 ? 's' : ''}`;
    }
  }

  getReceiptStrips(medicineName: string, totalQty: number): number | string {
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === medicineName.toLowerCase());
    if (!master) return totalQty;
    const productType = master.productType?.toLowerCase() || '';
    if (!(productType.includes('tablet') || productType.includes('capsule'))) {
      return totalQty; // display alternative items quantity directly
    }
    const packSize = this.parsePackSize(master.productQuantity);
    return Math.floor(totalQty / packSize);
  }

  getReceiptLoose(medicineName: string, totalQty: number): number | string {
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === medicineName.toLowerCase());
    if (!master) return '—';
    const productType = master.productType?.toLowerCase() || '';
    if (!(productType.includes('tablet') || productType.includes('capsule'))) {
      return '—'; // no loose tabs for non-tablets
    }
    const packSize = this.parsePackSize(master.productQuantity);
    return totalQty % packSize;
  }

  getReceiptPackSize(medicineName: string): number {
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === medicineName.toLowerCase());
    if (!master) return 10;
    return this.parsePackSize(master.productQuantity);
  }

  getReceiptMrp(sItem: any): number {
    const packSize = this.getReceiptPackSize(sItem.medicineName);
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === sItem.medicineName.toLowerCase());
    if (!master) return sItem.unitPrice;
    const productType = master.productType?.toLowerCase() || '';
    if (!(productType.includes('tablet') || productType.includes('capsule'))) {
      return sItem.unitPrice;
    }
    return sItem.unitPrice * packSize;
  }

  getReceiptSku(medicineId: number, medicineName: string): string {
    const med = this.catalog().find(m => m.id === medicineId);
    if (med) return med.sku;
    
    // Fallback to masters catalog by name
    const master = this.mastersCatalog().find(m => m.productName.toLowerCase() === medicineName.toLowerCase());
    return master ? master.productCode : 'N/A';
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
        // Dropdown closed + Enter → navigate forward to Strips/Qty
        this.onPOSRowEnter(event, rowIndex, 'search');
      } else if (key === 'escape') {
        // Dropdown closed + Escape → navigate backward to Payment Method (row 0) or prev row discount
        this.onPOSRowEscape(event, rowIndex, 'search');
      }
      return;
    }

    const filteredList = this.getFilteredCatalogForRow(this.rowSearchQueries()[rowIndex]);
    if (filteredList.length === 0) return;

    if (key === 'down') {
      event.preventDefault();
      const current = this.activeListItemIndex();
      const nextIndex = (current + 1) % filteredList.length;
      this.activeListItemIndex.set(nextIndex);
      this.scrollActiveListItemIntoView();
    } else if (key === 'up') {
      event.preventDefault();
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
      // Dropdown is open here — just close it. ESC when closed is handled above.
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

  // Keyboard Navigation Helpers
  focusPOSField(id: string) {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onPOSRowEnter(event: Event, index: number, field: 'search' | 'strips' | 'loose' | 'qty' | 'discount') {
    event.preventDefault();
    const rows = this.cart();
    const row = rows[index];
    
    if (field === 'search') {
      if (row.medicineId) {
        // Exit search mode so the pill reappears, then move to Strips
        this.rowSearchMode.update(prev => {
          const copy = [...prev];
          copy[index] = false;
          return copy;
        });
        setTimeout(() => {
          if (row.isTabletOrCapsule) {
            this.focusPOSField(`pos-field-strips-${index}`);
          } else {
            this.focusPOSField(`pos-field-qty-${index}`);
          }
        }, 60);
      }
    } else if (field === 'strips') {
      this.focusPOSField(`pos-field-loose-${index}`);
    } else if (field === 'loose' || field === 'qty') {
      this.focusPOSField(`pos-field-row-discount-${index}`);
    } else if (field === 'discount') {
      if (index < rows.length - 1) {
        this.focusPOSField(`search-input-${index + 1}`);
      } else {
        if (row.medicineId) {
          this.addNewRow();
        } else {
          this.focusPOSField('pos-field-patientPhone');
        }
      }
    }
  }

  onPOSRowEscape(event: Event, index: number, field: 'search' | 'strips' | 'loose' | 'qty' | 'discount') {
    event.preventDefault();
    if (field === 'discount') {
      if (this.cart()[index].isTabletOrCapsule) {
        this.focusPOSField(`pos-field-loose-${index}`);
      } else {
        this.focusPOSField(`pos-field-qty-${index}`);
      }
    } else if (field === 'loose') {
      this.focusPOSField(`pos-field-strips-${index}`);
    } else if (field === 'strips' || field === 'qty') {
      // Clear medicine selection so the search input re-appears in DOM, then focus it
      this.clearRowMedicine(index);
    } else if (field === 'search') {
      if (index > 0) {
        this.focusPOSField(`pos-field-row-discount-${index - 1}`);
      } else {
        // First row search → go back to Payment Method
        this.focusPOSField('pos-field-paymentMethod');
      }
    }
  }

  onPOSHeaderEnter(event: Event, field: 'customerName' | 'patientPhone' | 'doctorName' | 'patientAddress' | 'discountPercentage' | 'paymentMethod') {
    event.preventDefault();
    if (field === 'patientPhone') {
      const raw = this.patientPhone().trim();
      const digits = raw.replace(/\D/g, '');

      // Only validate if user has entered at least one digit
      if (digits.length > 0 && digits.length !== 10) {
        this.snackBar.open(
          `⚠️ Invalid phone number! Please enter a valid 10-digit mobile number. (Entered: ${raw})`,
          'Close',
          {
            duration: 4000,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
        // Refocus back to the phone field
        setTimeout(() => {
          const el = document.getElementById('pos-field-patientPhone');
          if (el) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
        }, 50);
        return;
      }

      this.focusPOSField('pos-field-customerName');
    } else if (field === 'customerName') {
      this.focusPOSField('pos-field-patientAddress');
    } else if (field === 'patientAddress') {
      this.focusPOSField('pos-field-doctorName');
    } else if (field === 'doctorName') {
      this.focusPOSField('pos-field-discountPercent');
    } else if (field === 'discountPercentage') {
      this.focusPOSField('pos-field-paymentMethod');
    } else if (field === 'paymentMethod') {
      this.focusPOSField('search-input-0');
    }
  }

  onPOSHeaderEscape(event: Event, field: 'customerName' | 'patientPhone' | 'doctorName' | 'patientAddress' | 'discountPercentage' | 'paymentMethod') {
    event.preventDefault();
    if (field === 'patientPhone') {
      const rows = this.cart();
      if (rows.length > 0) {
        const lastIndex = rows.length - 1;
        const last = rows[lastIndex];
        if (last.medicineId) {
          this.focusPOSField(`pos-field-row-discount-${lastIndex}`);
        } else {
          this.focusPOSField(`search-input-${lastIndex}`);
        }
      }
    } else if (field === 'customerName') {
      this.focusPOSField('pos-field-patientPhone');
    } else if (field === 'patientAddress') {
      this.focusPOSField('pos-field-customerName');
    } else if (field === 'doctorName') {
      this.focusPOSField('pos-field-patientAddress');
    } else if (field === 'discountPercentage') {
      this.focusPOSField('pos-field-doctorName');
    } else if (field === 'paymentMethod') {
      this.focusPOSField('pos-field-discountPercent');
    }
  }
}
