import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { SalesService } from '../../services/sales.service';
import { DashboardStats } from '../../models/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private readonly salesService = inject(SalesService);

  stats = signal<DashboardStats | null>(null);
  loading = signal<boolean>(true);

  ngOnInit() {
    this.fetchStats();
  }

  fetchStats() {
    this.loading.set(true);
    this.salesService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getBarHeight(value: number): string {
    const data = this.stats()?.revenueChartData;
    if (!data || data.length === 0) return '0%';
    
    const maxVal = Math.max(...data.map(p => p.value));
    if (maxVal === 0) return '4%'; // Minimal baseline indicator
    
    const percentage = (value / maxVal) * 100;
    // Scale between 4% and 95% for gorgeous visual balance
    const scaledHeight = value > 0 ? Math.max(8, percentage * 0.95) : 4;
    return `${scaledHeight}%`;
  }
}
