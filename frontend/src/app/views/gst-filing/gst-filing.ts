import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { GstReportService } from '../../services/gst-report.service';

@Component({
  selector: 'app-gst-filing',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule, MatSnackBarModule],
  templateUrl: './gst-filing.html',
  styleUrl: './gst-filing.css'
})
export class GstFilingComponent implements OnInit {
  private readonly gstService = inject(GstReportService);
  private readonly snackBar = inject(MatSnackBar);

  // Current timestamp for print layout
  currentTime = new Date();

  // States
  startDate = signal<string>('');
  endDate = signal<string>('');
  summary = signal<any>(null);
  activeTab = signal<string>('slabs'); // slabs, hsns, sales, purchases
  searchText = signal<string>('');
  selectedGstRate = signal<string>('ALL');
  loading = signal<boolean>(false);

  ngOnInit() {
    this.quickSelect('thisMonth');
    this.loadGstReport();
  }

  quickSelect(period: string) {
    const today = new Date();
    let start: Date;
    let end: Date;

    if (period === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (period === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (period === 'currentQuarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), quarter * 3, 1);
      end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
    } else {
      return;
    }

    // Format dates to YYYY-MM-DD
    this.startDate.set(this.formatDate(start));
    this.endDate.set(this.formatDate(end));
    
    // Auto-reload report if it's not the initial boot
    if (this.summary()) {
      this.loadGstReport();
    }
  }

  loadGstReport() {
    this.loading.set(true);
    this.gstService.getGstSummary(this.startDate(), this.endDate()).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
        this.snackBar.open('GST Report loaded successfully.', 'Dismiss', {
          duration: 3000,
          panelClass: ['snackbar-info']
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Failed to load GST data. Please check connection.', 'Dismiss', {
          duration: 5000,
          panelClass: ['snackbar-danger']
        });
        console.error(err);
      }
    });
  }

  printReport() {
    window.print();
  }

  // Filtered Ledgers
  filteredSales = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.salesTransactions) return [];
    
    return sum.salesTransactions.filter((tx: any) => {
      const matchesSearch = !this.searchText() || 
        tx.transactionNumber.toLowerCase().includes(this.searchText().toLowerCase()) ||
        tx.partyName.toLowerCase().includes(this.searchText().toLowerCase());
        
      return matchesSearch;
    });
  });

  filteredPurchases = computed(() => {
    const sum = this.summary();
    if (!sum || !sum.purchaseTransactions) return [];

    return sum.purchaseTransactions.filter((tx: any) => {
      const matchesSearch = !this.searchText() || 
        tx.transactionNumber.toLowerCase().includes(this.searchText().toLowerCase()) ||
        tx.referenceNumber.toLowerCase().includes(this.searchText().toLowerCase()) ||
        tx.partyName.toLowerCase().includes(this.searchText().toLowerCase());
        
      return matchesSearch;
    });
  });

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
