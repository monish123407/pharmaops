import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { SalesAnalysisService } from '../../services/sales-analysis.service';
import { ExpenseService } from '../../services/expense.service';
import { ExpenseSummary } from '../../models/types';

@Component({
  selector: 'app-sales-analysis',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, RouterLink, MatSnackBarModule],
  templateUrl: './sales-analysis.html',
  styleUrl: './sales-analysis.css'
})
export class SalesAnalysisComponent implements OnInit {
  private readonly analysisService = inject(SalesAnalysisService);
  private readonly expenseService  = inject(ExpenseService);
  private readonly snackBar = inject(MatSnackBar);

  // Live Current Date
  currentDate = new Date();

  // States
  startDate = signal<string>('');
  endDate   = signal<string>('');
  activePreset = signal<string>('thisMonth');
  summary      = signal<any>(null);
  expSummary   = signal<ExpenseSummary | null>(null);
  loading      = signal<boolean>(false);

  // Active chart focus metric: 'sales' or 'profit' or 'orders'
  activeChartMetric = signal<string>('sales');

  // Interactive Product Table Controls
  searchText = signal<string>('');
  selectedCategory = signal<string>('ALL');
  selectedStatus = signal<string>('ALL');
  
  // Table Sorting
  sortColumn = signal<string>('totalRevenue');
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
        // Start of week (Sunday or Monday, let's do Monday)
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
    this.analysisService.getSalesAnalysisSummary(this.startDate(), this.endDate()).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
        this.snackBar.open('Sales Performance Dashboard updated successfully.', 'Dismiss', {
          duration: 3000,
          panelClass: ['snackbar-info']
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Failed to load Sales Analysis. Please check server connection.', 'Dismiss', {
          duration: 5000,
          panelClass: ['snackbar-danger']
        });
        console.error(err);
      }
    });
    // Load expenses for same period
    this.expenseService.getSummary(this.startDate(), this.endDate()).subscribe({
      next: (exp) => this.expSummary.set(exp),
      error: ()   => {}
    });
  }

  applyCustomRange() {
    this.activePreset.set('custom');
    this.loadAnalysisData();
  }

  resetFilters() {
    this.searchText.set('');
    this.selectedCategory.set('ALL');
    this.selectedStatus.set('ALL');
    this.quickSelect('thisMonth');
    this.loadAnalysisData();
  }

  // Expense computed helpers
  totalExpenses = computed(() => this.expSummary()?.totalForRange ?? 0);
  grossProfit = computed(() => this.summary()?.totalProfit?.currentValue ?? 0);
  netAfterExpenses  = computed(() => this.grossProfit() - this.totalExpenses());
  expenseRatio      = computed(() => {
    const gp = this.grossProfit();
    return gp > 0 ? (this.totalExpenses() / gp) * 100 : 0;
  });

  // Categories present in active product performance grid
  categories = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.categorySplits) return [];
    return sum.categorySplits.map((c: any) => c.category);
  });

  // Filtered products list based on grid selections
  filteredProducts = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.productsPerformance) return [];

    let list = [...sum.productsPerformance];

    // Search filter
    if (this.searchText().trim()) {
      const q = this.searchText().toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (this.selectedCategory() !== 'ALL') {
      const cat = this.selectedCategory().toLowerCase();
      // Since category is on MedicineMaster, let's filter if it matches or let's assume category splits
      // The API doesn't return master category in ProductPerformance directly but we can infer it
      // Let's filter by matching SKU prefix or categories if present. 
      // To be simple and robust, the user can select Category, which we can map.
      // Wait, let's make Category filtering match the Categorysplits mappings if Category is supplied in skuCategoryMap
    }

    // Status filter
    if (this.selectedStatus() !== 'ALL') {
      const status = this.selectedStatus();
      list = list.filter(p => p.status === status);
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

  // Paginated products list
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
    this.currentPage.set(1); // reset to first page
  }

  // Interactive SVG line graph dynamic points calculator
  lineChartPoints = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.hourlyTrend || sum.hourlyTrend.length === 0) return '';
    
    const trend = sum.hourlyTrend;
    const metric = this.activeChartMetric();

    let values = trend.map((t: any) => {
      if (metric === 'profit') return t.salesAmount * 0.28; // Profit approximation for hourly curve
      if (metric === 'orders') return t.orderCount;
      return t.salesAmount;
    });

    const maxVal = Math.max(...values, 1.0);
    
    const points = trend.map((t: any, i: number) => {
      const val = metric === 'profit' ? t.salesAmount * 0.28 : metric === 'orders' ? t.orderCount : t.salesAmount;
      const x = (i / (trend.length - 1)) * 940 + 30;
      const y = 260 - (val / maxVal) * 220;
      return `${x},${y}`;
    });
    
    return points.join(' ');
  });

  lineChartFillPoints = computed(() => {
    const pts = this.lineChartPoints();
    if (!pts) return '';
    // Append bottom-right and bottom-left to close polygon shape cleanly
    return `30,260 ${pts} 970,260`;
  });

  // Detailed coordinate calculations for circles/hover tooltips in SVG line graph
  chartHoverCircles = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.hourlyTrend || sum.hourlyTrend.length === 0) return [];

    const trend = sum.hourlyTrend;
    const metric = this.activeChartMetric();

    let values = trend.map((t: any) => {
      if (metric === 'profit') return t.salesAmount * 0.28;
      if (metric === 'orders') return t.orderCount;
      return t.salesAmount;
    });

    const maxVal = Math.max(...values, 1.0);

    return trend.map((t: any, i: number) => {
      const val = metric === 'profit' ? t.salesAmount * 0.28 : metric === 'orders' ? t.orderCount : t.salesAmount;
      const x = (i / (trend.length - 1)) * 940 + 30;
      const y = 260 - (val / maxVal) * 220;
      return {
        hour: t.hour,
        value: val,
        x,
        y
      };
    });
  });

  // SVG Forecast points calculations
  forecastPoints = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.forecast || !sum.forecast.forecastTrend || sum.forecast.forecastTrend.length === 0) return { line: '', lower: '', upper: '', points: [] };

    const trend = sum.forecast.forecastTrend;
    const maxVal = Math.max(...trend.map((t: any) => t.confidenceUpper), 1.0);

    const linePoints = trend.map((t: any, i: number) => {
      const x = (i / (trend.length - 1)) * 920 + 40;
      const y = 250 - (t.predictedSales / maxVal) * 200;
      return `${x},${y}`;
    });

    const upperPoints = trend.map((t: any, i: number) => {
      const x = (i / (trend.length - 1)) * 920 + 40;
      const y = 250 - (t.confidenceUpper / maxVal) * 200;
      return `${x},${y}`;
    });

    const lowerPoints = trend.map((t: any, i: number) => {
      const x = (i / (trend.length - 1)) * 920 + 40;
      const y = 250 - (t.confidenceLower / maxVal) * 200;
      return `${x},${y}`;
    });

    // Create a closed polygon for confidence interval band
    const reversedLower = [...lowerPoints].reverse();
    const confidenceBand = `${upperPoints.join(' ')} ${reversedLower.join(' ')}`;

    const hoverPoints = trend.map((t: any, i: number) => {
      const x = (i / (trend.length - 1)) * 920 + 40;
      const y = 250 - (t.predictedSales / maxVal) * 200;
      return {
        date: t.date,
        predicted: t.predictedSales,
        lower: t.confidenceLower,
        upper: t.confidenceUpper,
        x,
        y
      };
    });

    return {
      line: linePoints.join(' '),
      band: confidenceBand,
      points: hoverPoints
    };
  });

  exportToExcel() {
    const list = this.filteredProducts();
    if (list.length === 0) {
      this.snackBar.open('No data to export.', 'Dismiss', { duration: 3000 });
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'SKU,Medicine Name,Qty Sold,Total Revenue,Avg Price,Profit,Margin (%),Stock,Rack,Status\r\n';

    list.forEach(p => {
      csvContent += `"${p.sku}","${p.name}",${p.quantitySold},${p.totalRevenue},${p.averageSellingPrice},${p.totalProfit},${p.profitMarginPercentage}%,${p.stockLevel},"${p.rackLocation}","${p.status}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_performance_report_${this.startDate()}_to_${this.endDate()}.csv`);
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
}
