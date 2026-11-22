import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Expense, ExpenseSummary } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/expenses');
  }

  getAll(category?: string, startDate?: string, endDate?: string): Observable<Expense[]> {
    let params = new HttpParams();
    if (category && category !== 'ALL') params = params.set('category', category);
    if (startDate) params = params.set('startDate', startDate);
    if (endDate)   params = params.set('endDate',   endDate);
    return this.http.get<Expense[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Expense> {
    return this.http.get<Expense>(`${this.apiUrl}/${id}`);
  }

  create(expense: Expense): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, expense);
  }

  update(id: number, expense: Expense): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/${id}`, expense);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getSummary(startDate?: string, endDate?: string): Observable<ExpenseSummary> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate)   params = params.set('endDate',   endDate);
    return this.http.get<ExpenseSummary>(`${this.apiUrl}/summary`, { params });
  }
}
