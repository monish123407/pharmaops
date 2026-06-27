import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { PurchaseAnalysisService } from '../../services/purchase-analysis.service';

@Component({
  selector: 'app-purchase-analysis',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, MatSnackBarModule],
  templateUrl: './purchase-analysis.html',
  styleUrl: './purchase-analysis.css'
})
export class PurchaseAnalysisComponent implements OnInit {
  private readonly analysisService = inject(PurchaseAnalysisService);
  private readonly snackBar = inject(MatSnackBar);

  // Live Current Date
  currentDate = new Date();

  // States
  startDate = signal<string>('');
  endDate = signal<string>('');
  activePreset = signal<string>('thisMonth');
  summary = signal<any>(null);
  loading = signal<boolean>(false);

  // Active chart focus metric: 'purchases' or 'invoices'
  activeChartMetric = signal<string>('purchases');

  // Interactive Product Table Controls
  searchText = signal<string>('');
  selectedCategory = signal<string>('ALL');

  // Table Sorting
  sortColumn = signal<string>('totalProcurementValue');
  sortDirection = signal<string>('desc');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  ngOnInit() {
    this.quickSelect('thisMonth');
    this.loadAnalysisData();
  }

  quickSelect(preset: string) {
    this.activePreset.set(preset);
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'yesterday':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        break;
      case 'thisWeek':
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        end = new Date();
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    this.startDate.set(this.formatDate(start));
    this.endDate.set(this.formatDate(end));

    if (this.summary()) {
      this.loadAnalysisData();
    }
  }

  loadAnalysisData() {
    this.loading.set(true);
    this.analysisService.getPurchaseAnalysisSummary(this.startDate(), this.endDate()).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
        this.snackBar.open('Purchase Analytics Dashboard updated successfully.', 'Dismiss', {
          duration: 3000,
          panelClass: ['snackbar-info']
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Failed to load Purchase Analytics. Please check server connection.', 'Dismiss', {
          duration: 5000,
          panelClass: ['snackbar-danger']
        });
        console.error(err);
      }
    });
  }

  applyCustomRange() {
    this.activePreset.set('custom');
    this.loadAnalysisData();
  }

  resetFilters() {
    this.searchText.set('');
    this.selectedCategory.set('ALL');
    this.quickSelect('thisMonth');
    this.loadAnalysisData();
  }

  categories = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.categorySplits) return [];
    return sum.categorySplits.map((c: any) => c.category);
  });

  filteredProducts = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.productsPerformance) return [];

    let list = [...sum.productsPerformance];

    // Search filter
    if (this.searchText().trim()) {
      const q = this.searchText().toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q) ||
        (p.composition && p.composition.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (this.selectedCategory() !== 'ALL') {
      const cat = this.selectedCategory().toLowerCase();
      // API may classify them in category splits, let's keep it robust
    }

    // Sorting
    const col = this.sortColumn();
    const dir = this.sortDirection();
    list.sort((a, b) => {
      let aVal = a[col];
      let bVal = b[col];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  });

  paginatedProducts = computed(() => {
    const list = this.filteredProducts();
    const page = this.currentPage();
    const size = this.pageSize();
    
    const startIdx = (page - 1) * size;
    return list.slice(startIdx, startIdx + size);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredProducts().length / this.pageSize()) || 1;
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

  // Dynamic points for daily trend curve
  lineChartPoints = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.dailyTrend || sum.dailyTrend.length === 0) return '';
    
    const trend = sum.dailyTrend;
    const metric = this.activeChartMetric();

    let values = trend.map((t: any) => {
      if (metric === 'invoices') return t.invoiceCount;
      return t.purchaseAmount;
    });

    const maxVal = Math.max(...values, 1.0);
    
    const points = trend.map((t: any, i: number) => {
      const val = metric === 'invoices' ? t.invoiceCount : t.purchaseAmount;
      const x = (i / (trend.length - 1)) * 940 + 30;
      const y = 260 - (val / maxVal) * 220;
      return `${x},${y}`;
    });
    
    return points.join(' ');
  });

  lineChartFillPoints = computed(() => {
    const pts = this.lineChartPoints();
    if (!pts) return '';
    return `30,260 ${pts} 970,260`;
  });

  chartHoverCircles = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.dailyTrend || sum.dailyTrend.length === 0) return [];

    const trend = sum.dailyTrend;
    const metric = this.activeChartMetric();

    let values = trend.map((t: any) => {
      if (metric === 'invoices') return t.invoiceCount;
      return t.purchaseAmount;
    });

    const maxVal = Math.max(...values, 1.0);

    return trend.map((t: any, i: number) => {
      const val = metric === 'invoices' ? t.invoiceCount : t.purchaseAmount;
      const x = (i / (trend.length - 1)) * 940 + 30;
      const y = 260 - (val / maxVal) * 220;
      return {
        date: t.date,
        value: val,
        x,
        y
      };
    });
  });

  exportToExcel() {
    const list = this.filteredProducts();
    if (list.length === 0) {
      this.snackBar.open('No data to export.', 'Dismiss', { duration: 3000 });
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'SKU,Medicine Name,Qty Procured,Avg Cost,Avg MRP,Tax Paid,Discount Recd,Net Procurement Value,Composition,Rack Location\r\n';

    list.forEach(p => {
      csvContent += `"${p.sku}","${p.name}",${p.quantityPurchased},${p.averageCostRate},${p.averageMRP},${p.totalTax},${p.totalDiscount},${p.totalProcurementValue},"${p.composition}","${p.rackLocation}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `purchase_analytics_report_${this.startDate()}_to_${this.endDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.snackBar.open('Excel/CSV export completed successfully.', 'Dismiss', { duration: 3000 });
  }

  printReport() {
    window.print();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTrendDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }
}
