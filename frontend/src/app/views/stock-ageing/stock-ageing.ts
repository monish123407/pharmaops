import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StockAgeingService } from '../../services/stock-ageing.service';

@Component({
  selector: 'app-stock-ageing',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, RouterLink, MatSnackBarModule],
  templateUrl: './stock-ageing.html',
  styleUrl: './stock-ageing.css'
})
export class StockAgeingComponent implements OnInit {
  private readonly ageingService = inject(StockAgeingService);
  private readonly snackBar = inject(MatSnackBar);

  // States
  report = signal<any>(null);
  loading = signal<boolean>(false);

  // ── Configurable Ageing Bracket Limits ───────────────────────
  freshLimit = signal<number>(30);
  moderateLimit = signal<number>(90);
  slowMovingLimit = signal<number>(180);

  // Draft values bound to inputs (applied on button click)
  draftFreshLimit = signal<number>(30);
  draftModerateLimit = signal<number>(90);
  draftSlowMovingLimit = signal<number>(180);

  // Config panel toggle
  showConfig = signal<boolean>(false);

  // Filters
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');
  selectedAgeBracket = signal<string>('ALL');
  selectedExpiryBracket = signal<string>('ALL');

  // Sorting
  sortColumn = signal<string>('shelfAgeDays');
  sortDirection = signal<string>('desc');

  // Layout tabs
  activeTab = signal<string>('summary'); // 'summary' | 'batches' | 'alerts'

  sumValue = (acc: number, item: any) => acc + (item.valueAtCost || 0);

  isCriticalOrExpired = (item: any) => {
    return item.expiryRiskBracket === 'Expired' || item.expiryRiskBracket === 'Critical';
  };

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    this.ageingService.getAgeingReport(
      this.freshLimit(),
      this.moderateLimit(),
      this.slowMovingLimit()
    ).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.snackBar.open('❌ Failed to load Stock Ageing Report data.', 'Close', {
          duration: 5000,
          panelClass: ['snackbar-danger']
        });
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  /** Apply the draft limits and re-fetch the report */
  applyConfig() {
    const fresh = Number(this.draftFreshLimit());
    const mod = Number(this.draftModerateLimit());
    const slow = Number(this.draftSlowMovingLimit());

    // Basic validation
    if (fresh < 1 || mod <= fresh || slow <= mod) {
      this.snackBar.open('⚠️ Invalid limits: Fresh < Moderate < Slow-Moving must hold.', 'Close', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.freshLimit.set(fresh);
    this.moderateLimit.set(mod);
    this.slowMovingLimit.set(slow);
    this.showConfig.set(false);
    this.loadReport();

    this.snackBar.open(`✅ Brackets updated: Fresh ≤${fresh}d | Moderate ≤${mod}d | Slow-Moving ≤${slow}d`, 'OK', {
      duration: 3500,
    });
  }

  resetConfig() {
    this.draftFreshLimit.set(30);
    this.draftModerateLimit.set(90);
    this.draftSlowMovingLimit.set(180);
    this.freshLimit.set(30);
    this.moderateLimit.set(90);
    this.slowMovingLimit.set(180);
    this.loadReport();
    this.snackBar.open('🔄 Brackets reset to defaults (30 / 90 / 180 days).', 'OK', { duration: 3000 });
  }

  // Computed categories derived from active batch items
  categories = computed(() => {
    const r = this.report();
    if (!r || !r.allBatches) return [];
    const set = new Set<string>();
    r.allBatches.forEach((b: any) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  });

  // Filtered & Sorted Batches list
  filteredBatches = computed(() => {
    const r = this.report();
    if (!r || !r.allBatches) return [];

    let list = [...r.allBatches];

    // 1. Search Query Filter
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(b => 
        b.name.toLowerCase().includes(query) || 
        b.sku.toLowerCase().includes(query) || 
        b.batchNumber.toLowerCase().includes(query) ||
        (b.rackLocation && b.rackLocation.toLowerCase().includes(query))
      );
    }

    // 2. Category Filter
    const cat = this.selectedCategory();
    if (cat !== 'ALL') {
      list = list.filter(b => b.category === cat);
    }

    // 3. Age Bracket Filter
    const ageB = this.selectedAgeBracket();
    if (ageB !== 'ALL') {
      list = list.filter(b => b.shelfAgeBracket === ageB);
    }

    // 4. Expiry Risk Filter
    const expB = this.selectedExpiryBracket();
    if (expB !== 'ALL') {
      list = list.filter(b => b.expiryRiskBracket === expB);
    }

    // 5. Apply Sorting
    const col = this.sortColumn();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      // String sorting
      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * dir;
      }
      
      // Date sorting
      if (col === 'expiryDate' || col === 'purchaseDate') {
        const dateA = new Date(valA).getTime();
        const dateB = new Date(valB).getTime();
        return (dateA - dateB) * dir;
      }

      // Numeric sorting
      return ((valA ?? 0) - (valB ?? 0)) * dir;
    });

    return list;
  });

  toggleSort(column: string) {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedCategory.set('ALL');
    this.selectedAgeBracket.set('ALL');
    this.selectedExpiryBracket.set('ALL');
    this.sortColumn.set('shelfAgeDays');
    this.sortDirection.set('desc');
  }
}
