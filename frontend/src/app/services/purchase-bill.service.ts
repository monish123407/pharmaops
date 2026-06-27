import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PurchaseBill } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class PurchaseBillService {
  private apiUrl: string;
  
  // Cross-route active edit state storage
  activeEditBill: PurchaseBill | null = null;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/purchase-bills');
  }

  getAll(): Observable<PurchaseBill[]> {
    return this.http.get<PurchaseBill[]>(this.apiUrl);
  }

  getById(id: number): Observable<PurchaseBill> {
    return this.http.get<PurchaseBill>(`${this.apiUrl}/${id}`);
  }

  create(bill: PurchaseBill): Observable<PurchaseBill> {
    return this.http.post<PurchaseBill>(this.apiUrl, bill);
  }

  update(id: number, bill: PurchaseBill): Observable<PurchaseBill> {
    return this.http.put<PurchaseBill>(`${this.apiUrl}/${id}`, bill);
  }
}
