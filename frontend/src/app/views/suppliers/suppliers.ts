import { Component, signal, inject, OnInit } from '@angular/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { SupplierService } from '../../services/supplier.service';
import { AuthService } from '../../services/auth.service';
import { Supplier } from '../../models/types';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [MatSnackBarModule],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.css'
})
export class SuppliersComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  suppliers = signal<Supplier[]>([]);
  loading = signal<boolean>(true);

  // Modal Control Signals
  isModalOpen = signal<boolean>(false);
  editingSupplierId = signal<number | null>(null);

  // Form Signals
  formName = signal<string>('');
  formContactName = signal<string>('');
  formPhone = signal<string>('');
  formEmail = signal<string>('');
  formAddress = signal<string>('');
  formGstn = signal<string>('');
  formDlNo = signal<string>('');
  formPan = signal<string>('');
  formSuppliedCompanies = signal<string>('');

  ngOnInit() {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.loading.set(true);
    this.supplierService.getAll().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openAddModal() {
    this.editingSupplierId.set(null);
    this.formName.set('');
    this.formContactName.set('');
    this.formPhone.set('');
    this.formEmail.set('');
    this.formAddress.set('');
    this.formGstn.set('');
    this.formDlNo.set('');
    this.formPan.set('');
    this.formSuppliedCompanies.set('');
    
    this.isModalOpen.set(true);
    this.focusSupplierInput('name');
  }

  openEditModal(sup: Supplier) {
    this.editingSupplierId.set(sup.id || null);
    this.formName.set(sup.name);
    this.formContactName.set(sup.contactName || '');
    this.formPhone.set(sup.phone || '');
    this.formEmail.set(sup.email || '');
    this.formAddress.set(sup.address || '');
    this.formGstn.set(sup.gstn || '');
    this.formDlNo.set(sup.dlNo || '');
    this.formPan.set(sup.pan || '');
    this.formSuppliedCompanies.set(sup.suppliedCompanies || '');
    
    this.isModalOpen.set(true);
    this.focusSupplierInput('name');
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingSupplierId.set(null);
  }

  onSave(event: Event) {
    event.preventDefault();
    const supData: Supplier = {
      name: this.formName(),
      contactName: this.formContactName(),
      phone: this.formPhone(),
      email: this.formEmail(),
      address: this.formAddress(),
      suppliedCompanies: this.formSuppliedCompanies(),
      gstn: this.formGstn(),
      dlNo: this.formDlNo(),
      pan: this.formPan(),
      active: true
    };

    const editId = this.editingSupplierId();
    if (editId) {
      // Update
      this.supplierService.update(editId, supData).subscribe({
        next: (updated) => {
          this.suppliers.update(prev => prev.map(s => s.id === editId ? updated : s));
          this.closeModal();
          this.snackBar.open(`✏️ Wholesaler "${updated.name}" updated successfully!`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.snackBar.open(`🛑 Failed to update wholesaler record.`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    } else {
      // Create
      this.supplierService.create(supData).subscribe({
        next: (created) => {
          this.suppliers.update(prev => [...prev, created]);
          this.closeModal();
          this.snackBar.open(`➕ Wholesaler "${created.name}" registered successfully!`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.snackBar.open(`🛑 Failed to register wholesaler.`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    }
  }

  onDelete(id: number) {
    if (confirm('Are you sure you want to remove this supplier from the directory?')) {
      const name = this.suppliers().find(s => s.id === id)?.name || 'Wholesaler';
      this.supplierService.delete(id).subscribe({
        next: () => {
          this.suppliers.update(prev => prev.filter(s => s.id !== id));
          this.snackBar.open(`🗑️ Wholesaler "${name}" removed from directory successfully!`, 'Close', {
            duration: 4500,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.snackBar.open(`🛑 Failed to remove wholesaler from directory.`, 'Close', {
            duration: 4500,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    }
  }

  focusSupplierInput(field: string) {
    setTimeout(() => {
      const element = document.getElementById(`sup-field-${field}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onSupplierEnter(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'address', 'rep', 'gstn', 'phone', 'dl', 'email', 'pan', 'brands'];
    const idx = order.indexOf(field);
    if (idx >= 0 && idx < order.length - 1) {
      this.focusSupplierInput(order[idx + 1]);
    } else if (field === 'brands') {
      this.onSave(event);
    }
  }

  onSupplierEscape(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'address', 'rep', 'gstn', 'phone', 'dl', 'email', 'pan', 'brands'];
    const idx = order.indexOf(field);
    if (idx > 0) {
      this.focusSupplierInput(order[idx - 1]);
    }
  }
}
