import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Prescription } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class PrescriptionService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/prescriptions');
  }

  getAll(search?: string): Observable<Prescription[]> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<Prescription[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Prescription> {
    return this.http.get<Prescription>(`${this.apiUrl}/${id}`);
  }

  create(prescription: Prescription): Observable<Prescription> {
    return this.http.post<Prescription>(this.apiUrl, prescription);
  }

  dispense(id: number): Observable<Prescription> {
    return this.http.put<Prescription>(`${this.apiUrl}/${id}/dispense`, {});
  }
}
