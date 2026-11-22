import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { AuthService } from '../../services/auth.service';
import { Expense, ExpenseSummary } from '../../models/types';

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Water & Utilities',
  'Staff Salary',
  'Staff Bonus',
  'Medicine Purchase',
  'Equipment & Furniture',
  'Maintenance & Repairs',
  'Cleaning & Housekeeping',
  'Telephone & Internet',
  'Transport & Delivery',
  'Packaging & Stationery',
  'Advertising & Marketing',
  'Professional Fees',
  'Bank Charges',
  'Government Fees & Taxes',
  'Insurance',
  'Miscellaneous',
];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit Card', 'Debit Card'];

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [FormsModule, MatSnackBarModule],
  templateUrl: './expenses.html',
  styleUrl: './expenses.css'
})
export class ExpensesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly categories = EXPENSE_CATEGORIES;
  readonly paymentMethods = PAYMENT_METHODS;

  // ── State ─────────────────────────────────────────────────────────────────
  expenses    = signal<Expense[]>([]);
  summary     = signal<ExpenseSummary | null>(null);
  loading     = signal(true);
  isModalOpen = signal(false);
  editingId   = signal<number | null>(null);
  activeTab   = signal<'list' | 'summary'>('list');
  showDeleteConfirm = signal<number | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  filterCategory = signal('ALL');
  filterStart    = signal(this.firstOfMonth());
  filterEnd      = signal(this.today());
  searchQuery    = signal('');

  // ── Form ──────────────────────────────────────────────────────────────────
  formDate          = signal(this.today());
  formCategory      = signal('Rent');
  formDescription   = signal('');
  formAmount        = signal('');
  formPaymentMethod = signal('Cash');
  formPaidTo        = signal('');
  formRefNumber     = signal('');
  formReceiptNumber = signal('');
  formNotes         = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────
  filteredExpenses = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.expenses();
    return this.expenses().filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.paidTo || '').toLowerCase().includes(q) ||
      (e.referenceNumber || '').toLowerCase().includes(q)
    );
  });

  totalFiltered = computed(() =>
    this.filteredExpenses().reduce((sum, e) => sum + e.amount, 0)
  );

  ngOnInit() {
    this.loadData();
  }

  // ── Data Loading ──────────────────────────────────────────────────────────
  loadData() {
    this.loading.set(true);
    const cat   = this.filterCategory() === 'ALL' ? undefined : this.filterCategory();
    const start = this.filterStart();
    const end   = this.filterEnd();

    this.expenseService.getAll(cat, start, end).subscribe({
      next: (data) => { this.expenses.set(data); this.loading.set(false); },
      error: ()    => this.loading.set(false)
    });

    this.expenseService.getSummary(start, end).subscribe({
      next: (s) => this.summary.set(s),
      error: ()  => {}
    });
  }

  applyFilters() { this.loadData(); }

  resetFilters() {
    this.filterCategory.set('ALL');
    this.filterStart.set(this.firstOfMonth());
    this.filterEnd.set(this.today());
    this.searchQuery.set('');
    this.loadData();
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  openAdd() {
    this.editingId.set(null);
    this.formDate.set(this.today());
    this.formCategory.set('Rent');
    this.formDescription.set('');
    this.formAmount.set('');
    this.formPaymentMethod.set('Cash');
    this.formPaidTo.set('');
    this.formRefNumber.set('');
    this.formReceiptNumber.set('');
    this.formNotes.set('');
    this.isModalOpen.set(true);
    setTimeout(() => document.getElementById('exp-date')?.focus(), 60);
  }

  openEdit(e: Expense) {
    this.editingId.set(e.id || null);
    this.formDate.set(e.expenseDate);
    this.formCategory.set(e.category);
    this.formDescription.set(e.description);
    this.formAmount.set(String(e.amount));
    this.formPaymentMethod.set(e.paymentMethod);
    this.formPaidTo.set(e.paidTo || '');
    this.formRefNumber.set(e.referenceNumber || '');
    this.formReceiptNumber.set(e.receiptNumber || '');
    this.formNotes.set(e.notes || '');
    this.isModalOpen.set(true);
    setTimeout(() => document.getElementById('exp-date')?.focus(), 60);
  }

  closeModal() { this.isModalOpen.set(false); this.editingId.set(null); }

  onSave(event: Event) {
    event.preventDefault();
    if (!this.formDescription().trim() || !this.formAmount() || !this.formDate()) {
      this.snack('⚠️ Date, Description and Amount are required.', 'warn'); return;
    }
    const amt = parseFloat(this.formAmount());
    if (isNaN(amt) || amt <= 0) {
      this.snack('⚠️ Please enter a valid amount.', 'warn'); return;
    }

    const payload: Expense = {
      expenseDate:     this.formDate(),
      category:        this.formCategory(),
      description:     this.formDescription().trim(),
      amount:          amt,
      paymentMethod:   this.formPaymentMethod(),
      paidTo:          this.formPaidTo().trim() || undefined,
      referenceNumber: this.formRefNumber().trim() || undefined,
      receiptNumber:   this.formReceiptNumber().trim() || undefined,
      notes:           this.formNotes().trim() || undefined,
    };

    const editId = this.editingId();
    if (editId) {
      this.expenseService.update(editId, payload).subscribe({
        next: () => { this.closeModal(); this.loadData(); this.snack(`✏️ Expense updated!`, 'info'); },
        error: () => this.snack('🛑 Failed to update expense.', 'error')
      });
    } else {
      this.expenseService.create(payload).subscribe({
        next: () => { this.closeModal(); this.loadData(); this.snack(`✅ Expense recorded!`, 'info'); },
        error: () => this.snack('🛑 Failed to record expense.', 'error')
      });
    }
  }

  confirmDelete(id: number) { this.showDeleteConfirm.set(id); }
  cancelDelete()            { this.showDeleteConfirm.set(null); }

  doDelete(id: number) {
    this.expenseService.delete(id).subscribe({
      next: () => {
        this.showDeleteConfirm.set(null);
        this.loadData();
        this.snack('🗑️ Expense deleted.', 'info');
      },
      error: () => this.snack('🛑 Failed to delete.', 'error')
    });
  }

  // ── Keyboard nav in modal ─────────────────────────────────────────────────
  focusNext(currentId: string, nextId: string) {
    setTimeout(() => document.getElementById(nextId)?.focus(), 30);
  }

  onFieldEnter(event: Event, currentId: string, nextId: string) {
    event.preventDefault();
    if (nextId === '__save__') { this.onSave(event); return; }
    this.focusNext(currentId, nextId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  firstOfMonth(): string {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatCurrency(n: number): string {
    return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  categoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      'Rent': '🏠', 'Electricity': '⚡', 'Water & Utilities': '💧',
      'Staff Salary': '👥', 'Staff Bonus': '🎁', 'Medicine Purchase': '💊',
      'Equipment & Furniture': '🛋️', 'Maintenance & Repairs': '🔧',
      'Cleaning & Housekeeping': '🧹', 'Telephone & Internet': '📡',
      'Transport & Delivery': '🚚', 'Packaging & Stationery': '📦',
      'Advertising & Marketing': '📢', 'Professional Fees': '👔',
      'Bank Charges': '🏦', 'Government Fees & Taxes': '🏛️',
      'Insurance': '🛡️', 'Miscellaneous': '📋',
    };
    return icons[cat] || '💰';
  }

  paymentIcon(method: string): string {
    const icons: Record<string, string> = {
      'Cash': '💵', 'UPI': '📱', 'Bank Transfer': '🏦',
      'Cheque': '📄', 'Credit Card': '💳', 'Debit Card': '💳',
    };
    return icons[method] || '💰';
  }

  getCategoryPercentage(total: number): number {
    const rangeTotal = this.summary()?.totalForRange || 0;
    return rangeTotal > 0 ? (total / rangeTotal) * 100 : 0;
  }

  private snack(msg: string, type: 'info' | 'warn' | 'error') {
    const cls = type === 'error' ? ['snackbar-danger'] :
                type === 'warn'  ? ['snackbar-warn']   : ['snackbar-info'];
    this.snackBar.open(msg, 'Close', {
      duration: 4000, panelClass: cls,
      horizontalPosition: 'center', verticalPosition: 'top'
    });
  }
}
