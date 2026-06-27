import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Medicine } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class MedicineService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/medicines');
  }

  getAll(search?: string): Observable<Medicine[]> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<Medicine[]>(this.apiUrl, { params });
  }

  getLowStock(): Observable<Medicine[]> {
    return this.http.get<Medicine[]>(`${this.apiUrl}/low-stock`);
  }

  getExpired(): Observable<Medicine[]> {
    return this.http.get<Medicine[]>(`${this.apiUrl}/expired`);
  }

  getExpiringSoon(): Observable<Medicine[]> {
    return this.http.get<Medicine[]>(`${this.apiUrl}/expiring-soon`);
  }

  getById(id: number): Observable<Medicine> {
    return this.http.get<Medicine>(`${this.apiUrl}/${id}`);
  }

  create(medicine: Medicine): Observable<Medicine> {
    return this.http.post<Medicine>(this.apiUrl, medicine);
  }

  createBatch(medicines: Medicine[]): Observable<Medicine[]> {
    return this.http.post<Medicine[]>(`${this.apiUrl}/batch`, medicines);
  }

  update(id: number, medicine: Medicine): Observable<Medicine> {
    return this.http.put<Medicine>(`${this.apiUrl}/${id}`, medicine);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
