import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
}
