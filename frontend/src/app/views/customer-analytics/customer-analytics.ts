import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { CustomerAnalyticsService } from '../../services/customer-analytics.service';
import { SalesService } from '../../services/sales.service';
import { Sale } from '../../models/types';

@Component({
  selector: 'app-customer-analytics',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, MatSnackBarModule],
  templateUrl: './customer-analytics.html',
  styleUrl: './customer-analytics.css'
})
export class CustomerAnalyticsComponent implements OnInit {
  private readonly analysisService = inject(CustomerAnalyticsService);
  private readonly salesService = inject(SalesService);
  private readonly snackBar = inject(MatSnackBar);

  // States
  startDate = signal<string>('');
  endDate = signal<string>('');
  activePreset = signal<string>('thisMonth');
  summary = signal<any>(null);
  allSales = signal<Sale[]>([]);
  loading = signal<boolean>(false);

  // Tab Control: 'leaderboard' or 'drilldown'
  activeTab = signal<string>('leaderboard');

  // Selected Customer Phone for Drilldown Profile
  selectedCustomerPhone = signal<string>('');
  drilldownSearchText = signal<string>('');

  // Computed: Filtered list of registered customers for drill-down select dropdown
  registeredCustomersList = computed(() => {
    const data = this.summary();
    if (!data || !data.leaderboard) return [];
    return data.leaderboard;
  });

  // Computed: Selected customer profile details
  selectedCustomer = computed(() => {
    const phone = this.selectedCustomerPhone();
    const list = this.registeredCustomersList();
    if (!phone) return null;
    return list.find((c: any) => c.phone === phone) || null;
  });

  // Computed: Selected customer purchase transactions
  selectedCustomerPurchases = computed(() => {
    const phone = this.selectedCustomerPhone();
    if (!phone) return [];
    // Sort transactions newest first
    return this.allSales()
      .filter((s: Sale) => s.patientPhone && s.patientPhone.trim() === phone.trim())
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  });

  // Computed: Selected customer top purchased medicines
  selectedCustomerTopMeds = computed(() => {
    const phone = this.selectedCustomerPhone();
    const data = this.summary();
    if (!phone || !data || !data.topMedicinesByCustomer) return [];
    return data.topMedicinesByCustomer[phone] || [];
  });

  // Computed: Total spend ratio (Registered vs Walk-in)
  registeredSpendPercentage = computed(() => {
    const data = this.summary();
    if (!data) return 0;
    const total = data.totalRegisteredSpend + data.totalWalkInSpend;
    return total > 0 ? (data.totalRegisteredSpend / total) * 100 : 0;
  });

  walkInSpendPercentage = computed(() => {
    return this.summary() ? 100 - this.registeredSpendPercentage() : 0;
  });

  // Computed: Segment distribution percentages
  highSpendersPercentage = computed(() => {
    const data = this.summary();
    if (!data || data.totalRegisteredCustomers === 0) return 0;
    return (data.highSpendersCount / data.totalRegisteredCustomers) * 100;
  });

  regularSpendersPercentage = computed(() => {
    const data = this.summary();
    if (!data || data.totalRegisteredCustomers === 0) return 0;
    return (data.regularSpendersCount / data.totalRegisteredCustomers) * 100;
  });

  casualSpendersPercentage = computed(() => {
    const data = this.summary();
    if (!data || data.totalRegisteredCustomers === 0) return 0;
    return (data.casualSpendersCount / data.totalRegisteredCustomers) * 100;
  });

  ngOnInit() {
    this.quickSelect('thisMonth');
    this.loadData();
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
      this.loadData();
    }
  }

  loadData() {
    this.loading.set(true);
    this.analysisService.getCustomerAnalysisSummary(this.startDate(), this.endDate()).subscribe({
      next: (res) => {
        this.summary.set(res);
        // Default drilldown selection to the top spender if not set
        if (!this.selectedCustomerPhone() && res.leaderboard && res.leaderboard.length > 0) {
          this.selectedCustomerPhone.set(res.leaderboard[0].phone);
        }
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('❌ Failed to load customer metrics.', 'Close', { duration: 4000 });
        this.loading.set(false);
      }
    });

    this.salesService.getAllSales().subscribe({
      next: (sales) => this.allSales.set(sales),
      error: () => console.error('Failed to load transaction history.')
    });
  }

  selectCustomerForDrilldown(phone: string) {
    this.selectedCustomerPhone.set(phone);
    this.activeTab.set('drilldown');
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
