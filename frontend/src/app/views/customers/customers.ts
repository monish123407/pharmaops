import { Component, signal, inject, OnInit } from '@angular/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { CustomerService } from '../../services/customer.service';
import { AuthService } from '../../services/auth.service';
import { Customer } from '../../models/types';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [MatSnackBarModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css'
})
export class CustomersComponent implements OnInit {
  private readonly customerService = inject(CustomerService);
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  customers = signal<Customer[]>([]);
  loading = signal<boolean>(true);
  searchQuery = signal<string>('');

  // Modal Control Signals
  isModalOpen = signal<boolean>(false);
  editingCustomerId = signal<number | null>(null);

  // Form Signals
  formName = signal<string>('');
  formPhone = signal<string>('');
  formEmail = signal<string>('');
  formAddress = signal<string>('');

  ngOnInit() {
    this.loadCustomers();
  }

  loadCustomers() {
    this.loading.set(true);
    this.customerService.getAll(this.searchQuery()).subscribe({
      next: (data) => {
        this.customers.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(query: string) {
    this.searchQuery.set(query);
    this.loadCustomers();
  }

  openAddModal() {
    this.editingCustomerId.set(null);
    this.formName.set('');
    this.formPhone.set('');
    this.formEmail.set('');
    this.formAddress.set('');
    
    this.isModalOpen.set(true);
    this.focusCustomerInput('name');
  }

  openEditModal(cust: Customer) {
    this.editingCustomerId.set(cust.id || null);
    this.formName.set(cust.name);
    this.formPhone.set(cust.phone);
    this.formEmail.set(cust.email || '');
    this.formAddress.set(cust.address || '');
    
    this.isModalOpen.set(true);
    this.focusCustomerInput('name');
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingCustomerId.set(null);
  }

  onSave(event: Event) {
    event.preventDefault();
    if (!this.formName().trim() || !this.formPhone().trim()) {
      this.snackBar.open(`⚠️ Name and Phone Number are required.`, 'Close', {
        duration: 3000,
        panelClass: ['snackbar-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const custData: Customer = {
      name: this.formName().trim(),
      phone: this.formPhone().trim(),
      email: this.formEmail().trim() || undefined,
      address: this.formAddress().trim() || undefined,
      active: true
    };

    const editId = this.editingCustomerId();
    if (editId) {
      // Update
      this.customerService.update(editId, custData).subscribe({
        next: (updated) => {
          this.customers.update(prev => prev.map(c => c.id === editId ? updated : c));
          this.closeModal();
          this.snackBar.open(`✏️ Customer "${updated.name}" updated successfully!`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: (err) => {
          const errMsg = err?.error || 'Failed to update customer record.';
          this.snackBar.open(`🛑 ${errMsg}`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    } else {
      // Create
      this.customerService.create(custData).subscribe({
        next: (created) => {
          this.customers.update(prev => [...prev, created]);
          this.closeModal();
          this.snackBar.open(`➕ Customer "${created.name}" registered successfully!`, 'Close', {
            duration: 4000,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: (err) => {
          const errMsg = err?.error || 'Failed to register customer.';
          this.snackBar.open(`🛑 ${errMsg}`, 'Close', {
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
    if (confirm('Are you sure you want to remove this customer from the directory?')) {
      const name = this.customers().find(c => c.id === id)?.name || 'Customer';
      this.customerService.delete(id).subscribe({
        next: () => {
          this.customers.update(prev => prev.filter(c => c.id !== id));
          this.snackBar.open(`🗑️ Customer "${name}" removed from directory successfully!`, 'Close', {
            duration: 4500,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.snackBar.open(`🛑 Failed to remove customer from directory.`, 'Close', {
            duration: 4500,
            panelClass: ['snackbar-danger'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    }
  }

  focusCustomerInput(field: string) {
    setTimeout(() => {
      const element = document.getElementById(`cust-field-${field}`);
      if (element) {
        element.focus();
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      }
    }, 50);
  }

  onCustomerEnter(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'phone', 'email', 'address'];
    const idx = order.indexOf(field);
    if (idx >= 0 && idx < order.length - 1) {
      this.focusCustomerInput(order[idx + 1]);
    } else if (field === 'address') {
      this.onSave(event);
    }
  }

  onCustomerEscape(event: Event, field: string) {
    event.preventDefault();
    const order = ['name', 'phone', 'email', 'address'];
    const idx = order.indexOf(field);
    if (idx > 0) {
      this.focusCustomerInput(order[idx - 1]);
    }
  }
}
