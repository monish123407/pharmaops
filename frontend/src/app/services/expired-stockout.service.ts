import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface ExpiredStockoutItem {
  medicineId: number;
  name: string;
  genericName: string;
  sku: string;
  batchNumber: string;
  expiryDate: string;
  stockLevel: number;
  costPrice: number;
  sellingPrice: number;
  rackLocation: string;
  invoiceNumber: string;
  invoiceDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpiredStockoutService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/expired-stockout');
  }

  getExpiredByWholesaler(wholesalerName: string): Observable<ExpiredStockoutItem[]> {
    return this.http.get<ExpiredStockoutItem[]>(`${this.apiUrl}/expired`, {
      params: { wholesaler: wholesalerName }
    });
  }

  disposeBatch(medicineId: number, quantity: number, reason: string, disposedBy: string): Observable<any> {
    return this.http.post<any>(this.apiConfig.apiUrl('/api/disposed-batches'), {
      medicineId,
      quantityDisposed: quantity,
      reason,
      disposedBy
    });
  }
}
