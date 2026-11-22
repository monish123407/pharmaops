import { Component, signal, inject, OnDestroy, OnInit, HostListener, ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  // Live System Clock
  currentTime = signal<string>('');
  private clockId?: any;

  // Theme Switcher State Signal
  isLightTheme = signal<boolean>(false);

  ngOnInit() {
    this.updateClock();
    this.clockId = setInterval(() => this.updateClock(), 1000);

    // Read and apply saved theme preference on boot
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.isLightTheme.set(true);
      this.applyTheme();
    }
  }

  ngOnDestroy() {
    if (this.clockId) {
      clearInterval(this.clockId);
    }
  }

  toggleTheme() {
    this.isLightTheme.update(val => !val);
    this.applyTheme();
  }

  private applyTheme() {
    if (this.isLightTheme()) {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }

  private updateClock() {
    const now = new Date();
    this.currentTime.set(
      now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + 
      ' | ' + 
      now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getRoleClass(role: string | null): string {
    if (!role) return 'badge-info';
    switch (role) {
      case 'ADMIN': return 'badge-danger';
      case 'PHARMACIST': return 'badge-success';
      case 'CASHIER': return 'badge-info';
      case 'INVENTORY_MANAGER': return 'badge-warning';
      default: return 'badge-info';
    }
  }

  isStockDropdownOpen = signal<boolean>(false);

  toggleStockDropdown(event: Event) {
    event.stopPropagation();
    this.isBillingDropdownOpen.set(false);
    this.isPurchaseDropdownOpen.set(false);
    this.isRegisterDropdownOpen.set(false);
    this.isAnalyticsDropdownOpen.set(false);
    this.isStockDropdownOpen.update(val => !val);
  }

  closeStockDropdown() {
    this.isStockDropdownOpen.set(false);
  }

  isBillingDropdownOpen = signal<boolean>(false);

  toggleBillingDropdown(event: Event) {
    event.stopPropagation();
    this.isStockDropdownOpen.set(false);
    this.isPurchaseDropdownOpen.set(false);
    this.isRegisterDropdownOpen.set(false);
    this.isAnalyticsDropdownOpen.set(false);
    this.isBillingDropdownOpen.update(val => !val);
  }

  closeBillingDropdown() {
    this.isBillingDropdownOpen.set(false);
  }

  isPurchaseDropdownOpen = signal<boolean>(false);

  togglePurchaseDropdown(event: Event) {
    event.stopPropagation();
    this.isStockDropdownOpen.set(false);
    this.isBillingDropdownOpen.set(false);
    this.isRegisterDropdownOpen.set(false);
    this.isAnalyticsDropdownOpen.set(false);
    this.isPurchaseDropdownOpen.update(val => !val);
  }

  closePurchaseDropdown() {
    this.isPurchaseDropdownOpen.set(false);
  }

  isRegisterDropdownOpen = signal<boolean>(false);

  toggleRegisterDropdown(event: Event) {
    event.stopPropagation();
    this.isStockDropdownOpen.set(false);
    this.isBillingDropdownOpen.set(false);
    this.isPurchaseDropdownOpen.set(false);
    this.isAnalyticsDropdownOpen.set(false);
    this.isRegisterDropdownOpen.update(val => !val);
  }

  closeRegisterDropdown() {
    this.isRegisterDropdownOpen.set(false);
  }

  isAnalyticsDropdownOpen = signal<boolean>(false);

  toggleAnalyticsDropdown(event: Event) {
    event.stopPropagation();
    this.isStockDropdownOpen.set(false);
    this.isBillingDropdownOpen.set(false);
    this.isPurchaseDropdownOpen.set(false);
    this.isRegisterDropdownOpen.set(false);
    this.isAnalyticsDropdownOpen.update(val => !val);
  }

  closeAnalyticsDropdown() {
    this.isAnalyticsDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const dropdowns = this.elementRef.nativeElement.querySelectorAll('.nav-item-dropdown');
    let clickedInside = false;
    dropdowns.forEach((el: Element) => {
      if (el.contains(event.target as Node)) clickedInside = true;
    });
    if (!clickedInside) {
      this.closeStockDropdown();
      this.closeBillingDropdown();
      this.closePurchaseDropdown();
      this.closeRegisterDropdown();
      this.closeAnalyticsDropdown();
    }
  }

  isBillingActive(): boolean {
    return this.router.url.includes('/sales-billing') || this.router.url.includes('/sales-history');
  }

  isStockActive(): boolean {
    return this.router.url.includes('/inventory') || 
           this.router.url.includes('/expiry-disposal') || 
           this.router.url.includes('/expired-stockout') || 
           this.router.url.includes('/stock-ageing');
  }

  isPurchaseActive(): boolean {
    return this.router.url.includes('/purchase') && !this.router.url.includes('analysis');
  }

  isRegisterActive(): boolean {
    return this.router.url.includes('/medicines') || this.router.url.includes('/suppliers') || this.router.url.includes('/customers') || this.router.url.includes('/hsn-management');
  }

  isAnalyticsActive(): boolean {
    return this.router.url.includes('-analysis') || this.router.url.includes('analytics');
  }

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('dashboard')) return 'Operational Dashboard';
    if (url.includes('inventory')) return 'Inventory & Stock Control';
    if (url.includes('expired-stockout')) return 'Expired Medicine Stockout';
    if (url.includes('sales-billing')) return 'Point of Sale (POS) Terminal';
    if (url.includes('prescriptions')) return 'Prescription Dispensing Hub';
    if (url.includes('suppliers')) return 'Supplier & Wholesaler Ledger';
    if (url.includes('customers')) return 'Customer Register';
    if (url.includes('medicines')) return 'Medicine Master Directory';
    if (url.includes('expiry-disposal')) return 'Expired Stock Disposal Hub';
    if (url.includes('gst-filing')) return 'GST Filing & Returns Ledger';
    if (url.includes('sales-analysis')) return 'Sales Performance & Analytics Dashboard';
    if (url.includes('purchase-analysis')) return 'Purchase Procurement & Analytics Dashboard';
    if (url.includes('customer-analytics')) return 'Customer Purchase & Sales Analytics';
    if (url.includes('purchase/order-history')) return 'Purchase Order History';
    if (url.includes('purchase/order')) return 'Order Purchase (Low Stock)';
    if (url.includes('purchase/entry')) return 'Purchase Invoice Entry';
    if (url.includes('purchase/draft')) return 'Purchase Invoices (Drafts)';
    if (url.includes('purchase/saved')) return 'Purchase Invoices (Saved)';
    if (url.includes('purchase-bills')) return 'Purchase Invoice Entry';
    return 'Pharmacy Operations';
  }
}
