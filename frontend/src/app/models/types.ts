export type UserRole = 'ADMIN' | 'PHARMACIST' | 'CASHIER' | 'INVENTORY_MANAGER';

export interface User {
  id?: number;
  username: string;
  fullName: string;
  role: UserRole;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
  fullName: string;
  role: UserRole;
  token: string;
}

export interface Medicine {
  id?: number;
  name: string;
  genericName: string;
  sku: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  stockLevel: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
  manufacturer: string;
  rackLocation: string;
  hsnCode?: string;
  gstRate?: number;
  active?: boolean;
}

export interface Supplier {
  id?: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  suppliedCompanies?: string;
  gstn?: string;
  dlNo?: string;
  pan?: string;
  active?: boolean;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  active?: boolean;
}

export interface PrescriptionItem {
  id?: number;
  medicineName: string;
  dosage: string;
  quantity: number;
  instructions: string;
}

export interface Prescription {
  id?: number;
  patientName: string;
  patientAge: number;
  doctorName: string;
  doctorLicense: string;
  issueDate?: string; // YYYY-MM-DD
  status: 'PENDING' | 'DISPENSED';
  notes?: string;
  items: PrescriptionItem[];
}

export interface SaleItem {
  id?: number;
  medicineId: number;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  hsnCode?: string;
  gstRate?: number;
  batchNumber?: string;
  expiryDate?: string;
  discountPercentage?: number;
}

export interface Sale {
  id?: number;
  invoiceNumber: string;
  saleDate: string; // LocalDateTime string
  customerName: string;
  patientPhone?: string;
  doctorName?: string;
  patientAddress?: string;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  paymentMethod: string;
  cashierName: string;
  prescriptionId?: number;
  items: SaleItem[];
}

export interface CheckoutItem {
  medicineId: number;
  quantity: number;
  discountPercentage?: number;
}

export interface CheckoutRequest {
  customerName: string;
  patientPhone?: string;
  doctorName?: string;
  patientAddress?: string;
  discountAmount: number;
  taxAmount: number;
  paymentMethod: string;
  cashierName: string;
  prescriptionId?: number;
  items: CheckoutItem[];
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface DashboardStats {
  totalRevenueToday: number;
  lowStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  totalMedicines: number;
  recentSales: Sale[];
  revenueChartData: ChartPoint[];
}

export interface MedicineMaster {
  id?: number;
  productName: string;
  composition: string;
  productCode: string;
  companyName: string;
  category: 'food' | 'cosmetics' | 'medicine' | 'others';
  productType: string;
  productQuantity: string;
  hsnCode: string;
  cgst: number;
  sgst: number;
  active?: boolean;
  rackLocation?: string;
  reorderLevel?: number;
}

export interface PurchaseBillItem {
  id?: number;
  productName: string;
  productCode: string;
  quantity: number;
  loose: number;
  batchNumber: string;
  hsnCode: string;
  expiryDate: string;
  mrp: number;
  rate: number;
  total: number;
  discountPercentage: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  reorderLevel?: number;
  rackLocation?: string;
}

export interface PurchaseBill {
  id?: number;
  billNumber?: string;
  tokenNumber?: number;
  invoiceNumber: string;
  invoiceDate?: string;
  supplierName: string;
  netAmount: number;
  grossAmount: number;
  discountAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  purchaseDate?: string;
  items: PurchaseBillItem[];
}
