import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { MedicineService } from '../../services/medicine.service';
import { AuthService } from '../../services/auth.service';
import { Medicine, MedicineMaster } from '../../models/types';
import { MedicineMasterService } from '../../services/medicine-master.service';

export interface GroupedMedicine {
  name: string;
  genericName: string;
  sku: string;
  totalStockLevel: number;
  reorderLevel: number;
  manufacturer: string;
  hsnCode: string;
  gstRate: number;
  rackLocation: string;
  batches: Medicine[];
  minSellingPrice: number;
  maxSellingPrice: number;
  hasExpired: boolean;
  hasExpiringSoon: boolean;
  hasLowStock: boolean;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [DecimalPipe, DatePipe, MatSnackBarModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class InventoryComponent implements OnInit {
  protected readonly medicineService = inject(MedicineService);
  protected readonly auth = inject(AuthService);
  private readonly masterService = inject(MedicineMasterService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  // Grouped Medicine Batches Modal
  isBatchesModalOpen = signal<boolean>(false);
  selectedGroupedMed = signal<GroupedMedicine | null>(null);

  openBatchesModal(grouped: GroupedMedicine) {
    this.selectedGroupedMed.set(grouped);
    this.isBatchesModalOpen.set(true);
  }

  closeBatchesModal() {
    this.isBatchesModalOpen.set(false);
    this.selectedGroupedMed.set(null);
  }

  // Lists & State Signals
  medicines = signal<Medicine[]>([]);
  loading = signal<boolean>(true);
  
  activeFilter = signal<'ALL' | 'LOW_STOCK' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  searchTerm = signal<string>('');

  // Modal Control Signals
  isModalOpen = signal<boolean>(false);
  editingMedicineId = signal<number | null>(null);

  // Form Signals
  formName = signal<string>('');
  formGenericName = signal<string>('');
  formSku = signal<string>('');
  formBatchNumber = signal<string>('');
  formExpiryDate = signal<string>('');
  formStockLevel = signal<number>(0);
  formStrips = signal<number>(0);
  formLoose = signal<number>(0);
  formReorderLevel = signal<number>(0);
  formCostPrice = signal<number>(0);
  formSellingPrice = signal<number>(0);
  formManufacturer = signal<string>('');
  formRackLocation = signal<string>('');
  formHsnCode = signal<string>('3004');
  formGstRate = signal<number>(12);

  // Master Catalog Autocomplete Signals
  mastersCatalog = signal<MedicineMaster[]>([]);
  masterSearchQuery = signal<string>('');
  isMasterDropdownOpen = signal<boolean>(false);


  // Computed signal for filtered catalog search! Groups raw active medicine stocks by SKU and aggregates statistics with try-catch safety.
  filteredMedicines = computed(() => {
    try {
      const rawMeds = this.medicines();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date();
      limit.setMonth(limit.getMonth() + 3); // Expiring within 3 months
      limit.setHours(23, 59, 59, 999);

      // Group by SKU
      const skuMap = new Map<string, Medicine[]>();
      rawMeds.forEach(m => {
        if (m && m.sku) {
          if (!skuMap.has(m.sku)) {
            skuMap.set(m.sku, []);
          }
          skuMap.get(m.sku)!.push(m);
        }
      });

      // Map each group to a GroupedMedicine
      let groupedList: GroupedMedicine[] = [];
      skuMap.forEach((batches, sku) => {
        if (batches && batches.length > 0) {
          // Sort batches by expiry date (oldest first)
          try {
            batches.sort((a, b) => {
              const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
              const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
              return dateA - dateB;
            });
          } catch (err) {
            console.error('Failed to sort batches by expiryDate:', err);
          }

          const first = batches[0];
          const totalStockLevel = batches.reduce((sum, b) => sum + (b.stockLevel || 0), 0);
          
          // Get the highest reorder level
          const reorderLevel = Math.max(...batches.map(b => b.reorderLevel || 0), 10);
          
          const sellingPrices = batches.map(b => b.sellingPrice || 0);
          const minSellingPrice = sellingPrices.length > 0 ? Math.min(...sellingPrices) : 0;
          const maxSellingPrice = sellingPrices.length > 0 ? Math.max(...sellingPrices) : 0;

          // Expiry statuses
          const hasExpired = batches.some(b => b.expiryDate && new Date(b.expiryDate) < today);
          const hasExpiringSoon = batches.some(b => {
            if (!b.expiryDate) return false;
            const exp = new Date(b.expiryDate);
            return exp >= today && exp <= limit; // not expired, but within 3 months
          });
          const hasLowStock = totalStockLevel <= reorderLevel;

          // Unique rack locations
          const rackLocations = Array.from(new Set(batches.map(b => b.rackLocation).filter(r => !!r)));
          const rackLocationStr = rackLocations.join(', ') || 'Unassigned';

          groupedList.push({
            name: first.name || 'Unnamed',
            genericName: first.genericName || 'Unnamed Generic',
            sku: sku,
            totalStockLevel,
            reorderLevel,
            manufacturer: first.manufacturer || 'Unknown',
            hsnCode: first.hsnCode || '3004',
            gstRate: first.gstRate !== undefined ? first.gstRate : 12.0,
            rackLocation: rackLocationStr,
            batches: batches,
            minSellingPrice,
            maxSellingPrice,
            hasExpired,
            hasExpiringSoon,
            hasLowStock
          });
        }
      });

      // 1. Text Search Filter
      const search = this.searchTerm().trim().toLowerCase();
      if (search) {
        groupedList = groupedList.filter(m => 
          (m.name && m.name.toLowerCase().includes(search)) || 
          (m.genericName && m.genericName.toLowerCase().includes(search)) || 
          (m.sku && m.sku.toLowerCase().includes(search))
        );
      }

      // 2. Tab Warnings Filters
      const filter = this.activeFilter();
      if (filter === 'LOW_STOCK') {
        groupedList = groupedList.filter(m => m.hasLowStock);
      } else if (filter === 'EXPIRED') {
        groupedList = groupedList.filter(m => m.hasExpired);
      } else if (filter === 'EXPIRING_SOON') {
        groupedList = groupedList.filter(m => m.hasExpiringSoon);
      }

      return groupedList;
    } catch (e) {
      console.error('Fatal error inside filteredMedicines computed signal:', e);
      return [];
    }
  });

  // Computed signal for master product lookup matching input query
  filteredMastersCatalog = computed(() => {
    const query = this.masterSearchQuery().trim().toLowerCase();
    if (!query) return [];
    return this.mastersCatalog().filter(m =>
      m.productName.toLowerCase().includes(query) ||
      m.productCode.toLowerCase().includes(query)
    );
  });

  ngOnInit() {
    this.loadMedicines();
    this.loadMastersCatalog();

    // Check query params to pre-select filtering mode
    this.route.queryParams.subscribe(params => {
      const filterParam = params['filter'];
      if (filterParam === 'low-stock') {
        this.activeFilter.set('LOW_STOCK');
      } else if (filterParam === 'expired') {
        this.activeFilter.set('EXPIRED');
      }
    });
  }

  loadMedicines() {
    this.loading.set(true);
    this.medicineService.getAll().subscribe({
      next: (data) => {
        this.medicines.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadMastersCatalog() {
    this.masterService.getAll().subscribe({
      next: (data) => this.mastersCatalog.set(data)
    });
  }

  onSelectMaster(master: MedicineMaster) {
    this.formName.set(master.productName);
    this.formGenericName.set(master.composition);
    this.formSku.set(master.productCode);
    this.formManufacturer.set(master.companyName);
    this.formHsnCode.set(master.hsnCode);
    this.formGstRate.set(master.cgst + master.sgst);
    
    // Default mock rack location if empty
    if (!this.formRackLocation()) {
      if (master.category === 'cosmetics') {
        this.formRackLocation.set('Rack-B');
      } else {
        this.formRackLocation.set('Rack-A');
      }
    }

    // Set Strips & Loose automatically based on new master pack size!
    const type = master.productType?.toLowerCase() || '';
    const isTabOrCap = type.includes('tablet') || type.includes('capsule');
    if (isTabOrCap) {
      const packSize = this.parsePackSize(master.productQuantity);
      const currentStock = this.formStockLevel();
      this.formStrips.set(Math.floor(currentStock / packSize));
      this.formLoose.set(currentStock % packSize);
    } else {
      this.formStrips.set(this.formStockLevel());
      this.formLoose.set(0);
    }

    // Reset autocomplete dropdown
    this.masterSearchQuery.set('');
    this.isMasterDropdownOpen.set(false);
    this.focusInventoryInput('batch');
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  setFilter(filter: 'ALL' | 'LOW_STOCK' | 'EXPIRED' | 'EXPIRING_SOON') {
    this.activeFilter.set(filter);
  }

  // Date Parsing Warning Helpers
  isExpired(dateStr: string): boolean {
    return new Date(dateStr) <= new Date();
  }

  isExpiringSoon(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(dateStr);
    const limit = new Date();
    limit.setMonth(limit.getMonth() + 3); // 3 months threshold
    limit.setHours(23, 59, 59, 999);
    return exp >= today && exp <= limit;
  }

  // Modal Actions
  openAddModal() {
    this.editingMedicineId.set(null);
    this.formName.set('');
    this.formGenericName.set('');
    this.formSku.set('');
    this.formBatchNumber.set('');
    
    // Set default expiry date to 1 year from now
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    this.formExpiryDate.set(nextYear.toISOString().split('T')[0]);
    
    this.formStockLevel.set(50);
    this.formStrips.set(5);
    this.formLoose.set(0);
    this.formReorderLevel.set(10);
    this.formCostPrice.set(1.0);
    this.formSellingPrice.set(2.5);
    this.formManufacturer.set('');
    this.formRackLocation.set('');
    this.formHsnCode.set('3004');
    this.formGstRate.set(12);
    
    this.isModalOpen.set(true);

    setTimeout(() => {
      const searchEl = document.getElementById('inv-master-search');
      if (searchEl) {
        searchEl.focus();
      } else {
        this.focusInventoryInput('name');
      }
    }, 100);
  }

  openEditModal(med: Medicine) {
    this.editingMedicineId.set(med.id || null);
    this.formName.set(med.name);
    this.formGenericName.set(med.genericName);
    this.formSku.set(med.sku);
    this.formBatchNumber.set(med.batchNumber);
    this.formExpiryDate.set(med.expiryDate);
    this.formStockLevel.set(med.stockLevel);
    
    if (this.isTabletOrCapsule(med)) {
      const packSize = this.getMedicinePackSize(med);
      this.formStrips.set(Math.floor(med.stockLevel / packSize));
      this.formLoose.set(med.stockLevel % packSize);
    } else {
      this.formStrips.set(med.stockLevel);
      this.formLoose.set(0);
    }
    
    // Convert stored tablet-unit reorder level → strips for display
    if (this.isTabletOrCapsule(med)) {
      const packSize = this.getMedicinePackSize(med);
      this.formReorderLevel.set(Math.ceil(med.reorderLevel / packSize));
    } else {
      this.formReorderLevel.set(med.reorderLevel); // packs — stored as-is
    }
    this.formCostPrice.set(med.costPrice);
    this.formSellingPrice.set(med.sellingPrice);
    this.formManufacturer.set(med.manufacturer || '');
    this.formRackLocation.set(med.rackLocation || '');
    this.formHsnCode.set(med.hsnCode || '3004');
    this.formGstRate.set(med.gstRate !== undefined ? med.gstRate : 12);
    
    this.isModalOpen.set(true);

    this.focusInventoryInput('name');
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingMedicineId.set(null);
  }

  onSave(event: Event) {
    event.preventDefault();

    const expiryVal = this.formExpiryDate();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!expiryVal || !dateRegex.test(expiryVal)) {
      const drugName = this.formName() ? `"${this.formName()}"` : 'This medicine';
      this.snackBar.open(`🛑 Error: Expiry Date for ${drugName} must be a valid date in MM/YYYY format (e.g. 12/2026)!`, 'Close', {
        duration: 5000,
        panelClass: ['snackbar-danger']
      });
      return;
    }

    if (expiryVal) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(expiryVal);

      if (expDate < today) {
        const drugName = this.formName() ? `"${this.formName()}"` : 'This medicine';
        this.snackBar.open(`🛑 Error: Expiry date for ${drugName} is in the past! Expiry: ${this.formatDateToMMYYYY(expiryVal)}`, 'Close', {
          duration: 5000,
          panelClass: ['snackbar-danger']
        });
        return;
      }
    }

    const medData: Medicine = {
      name: this.formName(),
      genericName: this.formGenericName(),
      sku: this.formSku(),
      batchNumber: this.formBatchNumber(),
      expiryDate: this.formExpiryDate(),
      stockLevel: this.formStockLevel(),
      // Convert strips → tablets for DB storage (packs are stored directly)
      reorderLevel: this.isFormTabletOrCapsule()
        ? this.formReorderLevel() * this.getFormPackSize()
        : this.formReorderLevel(),
      costPrice: this.formCostPrice(),
      sellingPrice: this.formSellingPrice(),
      manufacturer: this.formManufacturer(),
      rackLocation: this.formRackLocation(),
      hsnCode: this.formHsnCode(),
      gstRate: this.formGstRate(),
      active: true
    };

    const editId = this.editingMedicineId();
    if (editId) {
      // Update Mode
      this.medicineService.update(editId, medData).subscribe({
        next: (updated) => {
          this.medicines.update(prev => prev.map(m => m.id === editId ? updated : m));
          this.closeModal();
        }
      });
    } else {
      // Create Mode
      this.medicineService.create(medData).subscribe({
        next: (created) => {
          this.medicines.update(prev => [...prev, created]);
          this.closeModal();
        }
      });
    }
  }

  checkExpiryDateAlert(value: string) {
    if (!value) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(value);
    const drugName = this.formName() ? `"${this.formName()}"` : 'This medicine';

    if (expDate < today) {
      this.snackBar.open(`🛑 Error: Expiry date for ${drugName} is in the past! Expiry: ${this.formatDateToMMYYYY(value)}`, 'Close', {
        duration: 5000,
        panelClass: ['snackbar-danger']
      });
    } else {
      const threeMonthsLimit = new Date();
      threeMonthsLimit.setMonth(threeMonthsLimit.getMonth() + 3);
      threeMonthsLimit.setHours(0, 0, 0, 0);
      if (expDate <= threeMonthsLimit) {
        this.snackBar.open(`⚠️ Warning: ${drugName} will expire soon (within 3 months)! Expiry: ${this.formatDateToMMYYYY(value)}`, 'Close', {
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }
    }
  }

  formatDateToMMYYYY(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{2}\/\d{4}$/.test(dateStr) || /^\d{2}\/?\d{0,4}$/.test(dateStr)) return dateStr;
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      return `${month}/${year}`;
    }
    return dateStr;
  }

  onExpiryInput(event: any) {
    const value = event.target.value;
    let clean = value.trim();
    const isDelete = event && (event.inputType?.startsWith('delete') || event.inputType === 'deleteContentBackward');
    const digits = clean.replace(/\D/g, '');
    
    let formatted = '';
    if (digits.length >= 2) {
      if (isDelete && digits.length === 2 && clean.length === 2) {
        formatted = digits;
      } else {
        formatted = digits.substring(0, 2) + '/' + digits.substring(2, 6);
      }
    } else {
      formatted = digits;
    }

    this.formExpiryDate.set(formatted);

    const match = formatted.match(/^(\d{1,2})\/(\d{4})$/);
    if (match) {
      const month = parseInt(match[1], 10);
      const year = parseInt(match[2], 10);
      if (month >= 1 && month <= 12) {
        const lastDay = new Date(year, month, 0).getDate();
        const paddedMonth = String(month).padStart(2, '0');
        const isoDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
        this.formExpiryDate.set(isoDate);
        this.checkExpiryDateAlert(isoDate);
      }
    }
  }

  onDelete(id: number) {
    if (confirm('Are you sure you want to remove this medicine formulation from active catalog?')) {
      this.medicineService.delete(id).subscribe({
        next: () => {
          this.medicines.update(prev => prev.filter(m => m.id !== id));
        }
      });
    }
  }

  // Excel Batch Loading Features
  triggerExcelFileSelect() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx, .xls';
    fileInput.onchange = (e: any) => this.onExcelFileSelected(e);
    fileInput.click();
  }

  onExcelFileSelected(event: any) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    const reader = new FileReader();

    this.loading.set(true);

    reader.onload = (e: any) => {
      try {
        const binaryStr = e.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const excelData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!excelData || excelData.length === 0) {
          this.snackBar.open('Excel file is empty or formatted incorrectly.', 'Close', { duration: 4000 });
          this.loading.set(false);
          return;
        }

        // Map excel columns to Medicine models
        const medicinesToUpload: Medicine[] = excelData.map((row: any) => {
          let expDate = '2027-01-01'; // Default fallback
          if (row.expiryDate) {
            try {
              if (row.expiryDate instanceof Date) {
                expDate = row.expiryDate.toISOString().split('T')[0];
              } else {
                expDate = new Date(row.expiryDate).toISOString().split('T')[0];
              }
            } catch (err) {
              expDate = '2027-01-01';
            }
          }

          return {
            name: row.name || 'Unnamed Medicine',
            genericName: row.genericName || 'Unnamed Generic',
            sku: row.sku || 'SKU-' + Math.random().toString(36).substring(2, 11).toUpperCase(),
            batchNumber: row.batchNumber || 'B-BATCH',
            expiryDate: expDate,
            stockLevel: row.stockLevel !== undefined ? +row.stockLevel : 10,
            reorderLevel: row.reorderLevel !== undefined ? +row.reorderLevel : 5,
            costPrice: row.costPrice !== undefined ? +row.costPrice : 1.0,
            sellingPrice: row.sellingPrice !== undefined ? +row.sellingPrice : 2.5,
            manufacturer: row.manufacturer || 'Unknown',
            rackLocation: row.rackLocation || 'Unassigned',
            hsnCode: row.hsnCode ? row.hsnCode.toString() : '3004',
            gstRate: row.gstRate !== undefined ? +row.gstRate : 12.0,
            active: true
          };
        });

        // Batch upload HTTP POST
        this.medicineService.createBatch(medicinesToUpload).subscribe({
          next: (createdList) => {
            this.medicines.update(prev => [...prev, ...createdList]);
            this.loading.set(false);
            this.snackBar.open(`Successfully imported ${createdList.length} medicine formulations from Excel!`, 'Close', { duration: 5000 });
          },
          error: (err) => {
            this.loading.set(false);
            this.snackBar.open(err.error || 'Failed to import medicines. Verify columns and SKU uniqueness.', 'Close', { duration: 5000 });
          }
        });
      } catch (err) {
        this.loading.set(false);
        this.snackBar.open('Error parsing Excel sheet. Please ensure it is a valid .xlsx or .xls file.', 'Close', { duration: 5000 });
      }
    };

    reader.readAsBinaryString(file);
  }

  downloadSampleExcel() {
    const sampleData = [
      {
        name: 'Paracetamol 650mg',
        genericName: 'Acetaminophen',
        sku: 'MED-PARA-650',
        batchNumber: 'B202610',
        expiryDate: '2027-06-30',
        stockLevel: 100,
        reorderLevel: 20,
        costPrice: 1.50,
        sellingPrice: 3.50,
        manufacturer: 'Cipla Ltd',
        rackLocation: 'A-14',
        hsnCode: '3004',
        gstRate: 12
      },
      {
        name: 'Azithromycin 500mg',
        genericName: 'Azithromycin Dihydrate',
        sku: 'MED-AZIT-500',
        batchNumber: 'B202611',
        expiryDate: '2027-03-31',
        stockLevel: 50,
        reorderLevel: 10,
        costPrice: 12.00,
        sellingPrice: 24.50,
        manufacturer: 'Alkem Laboratories',
        rackLocation: 'B-02',
        hsnCode: '3004',
        gstRate: 12
      },
      {
        name: 'Pantoprazole 40mg',
        genericName: 'Pantoprazole Sodium',
        sku: 'MED-PANT-40',
        batchNumber: 'B202612',
        expiryDate: '2027-09-30',
        stockLevel: 180,
        reorderLevel: 30,
        costPrice: 4.50,
        sellingPrice: 9.00,
        manufacturer: 'Sun Pharma',
        rackLocation: 'C-05',
        hsnCode: '3004',
        gstRate: 12
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Inventory');
    
    // Auto-prompt file download in browser
    XLSX.writeFile(workbook, 'sample_inventory.xlsx');
  }

  // Strips & Loose tablet calculation and formatting helpers
  parsePackSize(productQuantity: string): number {
    if (!productQuantity) return 10;
    const match = productQuantity.match(/(\d+)/);
    return match ? +match[1] : 10;
  }

  getMedicinePackSize(med: Medicine | GroupedMedicine): number {
    if (!med || !med.sku) return 10;
    if (!this.isTabletOrCapsule(med)) return 1;
    const master = this.mastersCatalog().find(m => m.productCode === med.sku);
    if (!master) return 10;
    return this.parsePackSize(master.productQuantity);
  }

  getFormPackSize(): number {
    if (!this.isFormTabletOrCapsule()) return 1;
    const sku = this.formSku();
    const master = this.mastersCatalog().find(m => m.productCode === sku);
    if (!master) return 10;
    return this.parsePackSize(master.productQuantity);
  }

  onFormStripsChange(stripsVal: string) {
    const strips = +stripsVal || 0;
    this.formStrips.set(strips);
    if (this.isFormTabletOrCapsule()) {
      const packSize = this.getFormPackSize();
      const total = (strips * packSize) + this.formLoose();
      this.formStockLevel.set(total);
    } else {
      this.formStockLevel.set(strips);
    }
  }

  onFormLooseChange(looseVal: string) {
    const loose = +looseVal || 0;
    this.formLoose.set(loose);
    if (this.isFormTabletOrCapsule()) {
      const packSize = this.getFormPackSize();
      const total = (this.formStrips() * packSize) + loose;
      this.formStockLevel.set(total);
    } else {
      this.formStockLevel.set(this.formStrips());
    }
  }

  getStockQtyString(med: Medicine | GroupedMedicine): string {
    if (!med) return '0';
    const stockVal = 'totalStockLevel' in med ? (med.totalStockLevel || 0) : (med.stockLevel || 0);
    if (this.isTabletOrCapsule(med)) {
      const packSize = this.getMedicinePackSize(med);
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

  isTabletOrCapsule(med: Medicine | GroupedMedicine): boolean {
    if (!med || !med.sku) return true;
    const master = this.mastersCatalog().find(m => m.productCode === med.sku);
    if (!master) return true; // default fallback
    const type = master.productType?.toLowerCase() || '';
    return type.includes('tablet') || type.includes('capsule');
  }

  isFormTabletOrCapsule(): boolean {
    const sku = this.formSku();
    if (!sku) return true;
    const master = this.mastersCatalog().find(m => m.productCode === sku);
    if (!master) return true; // default fallback
    const type = master.productType?.toLowerCase() || '';
    return type.includes('tablet') || type.includes('capsule');
  }

  focusInventoryInput(field: string) {
    setTimeout(() => {
      const element = document.getElementById(`inv-field-${field}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onInventoryEnter(event: Event, field: string) {
    event.preventDefault();
    const order = [
      'name', 'batch',
      'genericName', 'expiry',
      'sku', 'strips'
    ];
    if (this.isFormTabletOrCapsule()) {
      order.push('loose');
    }
    order.push(
      'manufacturer', 'reorder',
      'rackLocation', 'cost',
      'hsnCode', 'selling',
      'gstRate'
    );

    const idx = order.indexOf(field);
    if (idx >= 0 && idx < order.length - 1) {
      this.focusInventoryInput(order[idx + 1]);
    } else if (idx === order.length - 1) {
      this.onSave(event);
    }
  }

  onInventoryEscape(event: Event, field: string) {
    event.preventDefault();
    const order = [
      'name', 'batch',
      'genericName', 'expiry',
      'sku', 'strips'
    ];
    if (this.isFormTabletOrCapsule()) {
      order.push('loose');
    }
    order.push(
      'manufacturer', 'reorder',
      'rackLocation', 'cost',
      'hsnCode', 'selling',
      'gstRate'
    );

    const idx = order.indexOf(field);
    if (idx > 0) {
      this.focusInventoryInput(order[idx - 1]);
    }
  }
}
