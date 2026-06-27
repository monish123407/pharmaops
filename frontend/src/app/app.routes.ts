import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

// routes definition
export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./views/login/login').then(m => m.LoginComponent) 
  },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./views/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'inventory', 
    loadComponent: () => import('./views/inventory/inventory').then(m => m.InventoryComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'sales-billing', 
    loadComponent: () => import('./views/sales-billing/sales-billing').then(m => m.SalesBillingComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'prescriptions', 
    loadComponent: () => import('./views/prescriptions/prescriptions').then(m => m.PrescriptionsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'suppliers', 
    loadComponent: () => import('./views/suppliers/suppliers').then(m => m.SuppliersComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'customers', 
    loadComponent: () => import('./views/customers/customers').then(m => m.CustomersComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'medicines', 
    loadComponent: () => import('./views/medicine-master/medicine-master').then(m => m.MedicineMasterComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'expiry-disposal', 
    loadComponent: () => import('./views/expired-disposal/expired-disposal').then(m => m.ExpiredDisposalComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'expired-stockout', 
    loadComponent: () => import('./views/expired-stockout/expired-stockout').then(m => m.ExpiredStockoutComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'gst-filing', 
    loadComponent: () => import('./views/gst-filing/gst-filing').then(m => m.GstFilingComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase/entry', 
    loadComponent: () => import('./views/purchase-bills/purchase-bills').then(m => m.PurchaseBillsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase/draft', 
    loadComponent: () => import('./views/purchase-bills/purchase-bills').then(m => m.PurchaseBillsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase/saved', 
    loadComponent: () => import('./views/purchase-bills/purchase-bills').then(m => m.PurchaseBillsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase/order', 
    loadComponent: () => import('./views/order-purchase/order-purchase').then(m => m.OrderPurchaseComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase/order-history', 
    loadComponent: () => import('./views/purchase-order-history/purchase-order-history').then(m => m.PurchaseOrderHistoryComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'sales-analysis', 
    loadComponent: () => import('./views/sales-analysis/sales-analysis').then(m => m.SalesAnalysisComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'purchase-analysis', 
    loadComponent: () => import('./views/purchase-analysis/purchase-analysis').then(m => m.PurchaseAnalysisComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'customer-analytics', 
    loadComponent: () => import('./views/customer-analytics/customer-analytics').then(m => m.CustomerAnalyticsComponent),
    canActivate: [authGuard] 
  },
  { path: 'purchase-bills', redirectTo: 'purchase/entry', pathMatch: 'full' },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];
