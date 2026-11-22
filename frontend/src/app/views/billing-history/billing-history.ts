import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { SalesService } from '../../services/sales.service';
import { Sale } from '../../models/types';

@Component({
  selector: 'app-billing-history',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, MatSnackBarModule],
  templateUrl: './billing-history.html',
  styleUrl: './billing-history.css'
})
export class BillingHistoryComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly Math = Math;

  // Filter States
  startDate = signal<string>('');
  endDate = signal<string>('');
  searchQuery = signal<string>('');
  paymentMethod = signal<string>('ALL');

  // Data States
  sales = signal<Sale[]>([]);
  totalRevenue = signal<number>(0);
  totalDiscount = signal<number>(0);
  totalTax = signal<number>(0);
  invoiceCount = signal<number>(0);
  paymentBreakdown = signal<Record<string, number>>({});
  loading = signal<boolean>(false);

  // Preview Modal States
  selectedSale = signal<Sale | null>(null);
  isPreviewOpen = signal<boolean>(false);

  // Sorting
  sortColumn = signal<string>('saleDate');
  sortDirection = signal<string>('desc');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  ngOnInit() {
    this.resetFilters();
    this.loadHistory();
  }

  loadHistory() {
    this.loading.set(true);
    this.salesService.getHistory(
      this.startDate(),
      this.endDate(),
      this.searchQuery(),
      this.paymentMethod()
    ).subscribe({
      next: (res) => {
        this.sales.set(res.sales || []);
        this.totalRevenue.set(res.totalRevenue || 0);
        this.totalDiscount.set(res.totalDiscount || 0);
        this.totalTax.set(res.totalTax || 0);
        this.invoiceCount.set(res.invoiceCount || 0);
        this.paymentBreakdown.set(res.paymentBreakdown || {});
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Failed to load billing history.', 'Dismiss', {
          duration: 4000,
          panelClass: ['snackbar-danger']
        });
        console.error(err);
      }
    });
  }

  applyFilters() {
    this.currentPage.set(1);
    this.loadHistory();
  }

  resetFilters() {
    const today = new Date();
    // Default to first day of current month to today
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.startDate.set(this.formatDate(firstDay));
    this.endDate.set(this.formatDate(today));
    this.searchQuery.set('');
    this.paymentMethod.set('ALL');
    this.currentPage.set(1);
  }

  // Sorted and Paginated Sales List
  processedSales = computed(() => {
    let list = [...this.sales()];

    // Sorting
    const col = this.sortColumn();
    const dir = this.sortDirection();
    list.sort((a: any, b: any) => {
      let aVal = a[col];
      let bVal = b[col];

      if (col === 'saleDate') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  });

  paginatedSales = computed(() => {
    const list = this.processedSales();
    const startIdx = (this.currentPage() - 1) * this.pageSize();
    return list.slice(startIdx, startIdx + this.pageSize());
  });

  totalPages = computed(() => {
    return Math.ceil(this.processedSales().length / this.pageSize()) || 1;
  });

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  toggleSort(column: string) {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
    this.currentPage.set(1);
  }

  // Preview / Receipt actions
  openPreview(sale: Sale) {
    this.selectedSale.set(sale);
    this.isPreviewOpen.set(true);
  }

  closePreview() {
    this.isPreviewOpen.set(false);
    this.selectedSale.set(null);
  }

  printInvoice() {
    const printContent = document.getElementById('printable-invoice');
    if (!printContent) return;

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${this.selectedSale()?.invoiceNumber}</title>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
              .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
              .invoice-title { font-size: 24px; font-weight: bold; }
              .invoice-meta { text-align: right; }
              .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; border-bottom: 1px solid #ddd; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .text-right { text-align: right; }
              .totals-table { width: 40%; margin-left: auto; margin-top: 20px; }
              .totals-table td { border: none; padding: 4px; }
              .grand-total { font-weight: bold; font-size: 16px; border-top: 2px double #333 !important; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #777; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper for converting LocalDateTime string to printable format
  formatDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateTimeStr;
    }
  }

  getPaymentKeys(): string[] {
    return Object.keys(this.paymentBreakdown());
  }
}
