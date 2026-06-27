import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { MedicineMasterService } from '../../services/medicine-master.service';
import { AuthService } from '../../services/auth.service';
import { MedicineMaster } from '../../models/types';

@Component({
  selector: 'app-medicine-master',
  standalone: true,
  imports: [],
  templateUrl: './medicine-master.html',
  styleUrl: './medicine-master.css'
})
export class MedicineMasterComponent implements OnInit {
  private readonly masterService = inject(MedicineMasterService);
  protected readonly auth = inject(AuthService);

  // States Signals
  masters = signal<MedicineMaster[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');
  activeFilter = signal<'ALL' | 'food' | 'cosmetics' | 'medicine' | 'others'>('ALL');

  // Modal Control Signals
  isModalOpen = signal<boolean>(false);
  editingMasterId = signal<number | null>(null);

  // Form Signals
  formProductName = signal<string>('');
  formComposition = signal<string>('');
  formProductCode = signal<string>('');
  formCompanyName = signal<string>('');
  formCategory = signal<'food' | 'cosmetics' | 'medicine' | 'others'>('medicine');
  formProductType = signal<string>('Tablet');
  formProductQuantity = signal<string>('');
  formHsnCode = signal<string>('3004');
  formCgst = signal<number>(6);
  formSgst = signal<number>(6);
  formRackLocation = signal<string>('');
  formReorderLevel = signal<number | null>(null);

  // Computed filtered list
  filteredMasters = computed(() => {
    let list = this.masters();
    const search = this.searchTerm().trim().toLowerCase();
    const filter = this.activeFilter();

    // 1. Text Filter
    if (search) {
      list = list.filter(m =>
        m.productName.toLowerCase().includes(search) ||
        m.productCode.toLowerCase().includes(search) ||
        m.companyName.toLowerCase().includes(search)
      );
    }

    // 2. Category Filter
    if (filter !== 'ALL') {
      list = list.filter(m => m.category === filter);
    }

    return list;
  });

  ngOnInit() {
    this.loadMasters();
  }

  loadMasters() {
    this.loading.set(true);
    this.masterService.getAll().subscribe({
      next: (data) => {
        this.masters.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  setFilter(filter: 'ALL' | 'food' | 'cosmetics' | 'medicine' | 'others') {
    this.activeFilter.set(filter);
  }

  // Automatic HSN tax splits lookup rule based on the latest Indian Govt GST rates
  onHsnChange(hsn: string) {
    this.formHsnCode.set(hsn);
    const clean = hsn.trim();
    if (clean === '3002' || clean === '9021') {
      // 5% GST: Vaccines, Blood fractions, Cardiac Stents, Orthopaedic appliances
      this.formCgst.set(2.5);
      this.formSgst.set(2.5);
    } else if (clean === '3304' || clean === '2106' || clean === '3808' || clean === '4015' || clean === '9025' || clean === '9027') {
      // 18% GST: Cosmetics, Food/Protein Supplements, Hand Sanitizers, Surgical Gloves, BP Monitors/Thermometers
      this.formCgst.set(9.0);
      this.formSgst.set(9.0);
    } else if (clean === '30066030') {
      // 0% GST (Nil Rated): Oral contraceptives
      this.formCgst.set(0.0);
      this.formSgst.set(0.0);
    } else {
      // 12% GST: Standard Formulations (3004), Medicaments mixed (3003), Bandages/Dressings (3005), Sterile sutures (3006), Surgical instruments (9018)
      this.formCgst.set(6.0);
      this.formSgst.set(6.0);
    }
  }

  // Modal Actions
  openAddModal() {
    this.editingMasterId.set(null);
    this.formProductName.set('');
    this.formComposition.set('');
    this.formProductCode.set('');
    this.formCompanyName.set('');
    this.formCategory.set('medicine');
    this.formProductType.set('Tablet');
    this.formProductQuantity.set('10 Tablets/Strip');
    this.formHsnCode.set('3004');
    this.formCgst.set(6.0);
    this.formSgst.set(6.0);
    this.formRackLocation.set('');
    this.formReorderLevel.set(null);

    this.isModalOpen.set(true);
    this.focusMasterInput('name');
  }

  openEditModal(master: MedicineMaster) {
    this.editingMasterId.set(master.id || null);
    this.formProductName.set(master.productName);
    this.formComposition.set(master.composition);
    this.formProductCode.set(master.productCode);
    this.formCompanyName.set(master.companyName);
    this.formCategory.set(master.category);
    this.formProductType.set(master.productType);
    this.formProductQuantity.set(master.productQuantity);
    this.formHsnCode.set(master.hsnCode);
    this.formCgst.set(master.cgst);
    this.formSgst.set(master.sgst);
    this.formRackLocation.set(master.rackLocation || '');
    this.formReorderLevel.set(master.reorderLevel !== undefined && master.reorderLevel !== null ? master.reorderLevel : null);

    this.isModalOpen.set(true);
    this.focusMasterInput('name');
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingMasterId.set(null);
  }

  onSave(event: Event) {
    event.preventDefault();

    const masterData: MedicineMaster = {
      productName: this.formProductName(),
      composition: this.formComposition(),
      productCode: this.formProductCode(),
      companyName: this.formCompanyName(),
      category: this.formCategory(),
      productType: this.formProductType(),
      productQuantity: this.formProductQuantity(),
      hsnCode: this.formHsnCode(),
      cgst: this.formCgst(),
      sgst: this.formSgst(),
      rackLocation: this.formRackLocation() || undefined,
      reorderLevel: this.formReorderLevel() !== null ? this.formReorderLevel()! : undefined,
      active: true
    };

    const editId = this.editingMasterId();
    if (editId) {
      // Update Mode
      this.masterService.update(editId, masterData).subscribe({
        next: (updated) => {
          this.masters.update(prev => prev.map(m => m.id === editId ? updated : m));
          this.closeModal();
        }
      });
    } else {
      // Create Mode
      this.masterService.create(masterData).subscribe({
        next: (created) => {
          this.masters.update(prev => [...prev, created]);
          this.closeModal();
        }
      });
    }
  }

  onDelete(id: number) {
    if (confirm('Are you sure you want to remove this product from the master directory catalog?')) {
      this.masterService.delete(id).subscribe({
        next: () => {
          this.masters.update(prev => prev.filter(m => m.id !== id));
        }
      });
    }
  }

  getCategoryBadgeClass(category: string): string {
    switch (category) {
      case 'medicine': return 'badge-success';
      case 'cosmetics': return 'badge-info';
      case 'food': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  focusMasterInput(field: string) {
    setTimeout(() => {
      const element = document.getElementById(`mas-field-${field}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onMasterEnter(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'generic', 'sku', 'company', 'category', 'packSize', 'hsn', 'type', 'rack', 'reorder', 'cgst', 'sgst'];
    const idx = order.indexOf(field);
    if (idx >= 0 && idx < order.length - 1) {
      this.focusMasterInput(order[idx + 1]);
    } else if (field === 'sgst') {
      this.onSave(event);
    }
  }

  onMasterEscape(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'generic', 'sku', 'company', 'category', 'packSize', 'hsn', 'type', 'rack', 'reorder', 'cgst', 'sgst'];
    const idx = order.indexOf(field);
    if (idx > 0) {
      this.focusMasterInput(order[idx - 1]);
    }
  }
}
