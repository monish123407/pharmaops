import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sale, CheckoutRequest, DashboardStats } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private salesUrl: string;
  private dashUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.salesUrl = this.apiConfig.apiUrl('/api/sales');
    this.dashUrl = this.apiConfig.apiUrl('/api/dashboard');
  }

  getAllSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.salesUrl);
  }

  getSaleById(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.salesUrl}/${id}`);
  }

  checkout(request: CheckoutRequest): Observable<Sale> {
    return this.http.post<Sale>(this.salesUrl, request);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.dashUrl}/stats`);
  }

  getHistory(startDate?: string, endDate?: string, search?: string, paymentMethod?: string): Observable<any> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (search && search.trim()) params = params.set('search', search.trim());
    if (paymentMethod && paymentMethod !== 'ALL') params = params.set('paymentMethod', paymentMethod);
    return this.http.get<any>(`${this.salesUrl}/history`, { params });
  }
}
