import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MedicineMaster } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class MedicineMasterService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/medicine-masters');
  }

  getAll(search?: string): Observable<MedicineMaster[]> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<MedicineMaster[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<MedicineMaster> {
    return this.http.get<MedicineMaster>(`${this.apiUrl}/${id}`);
  }

  create(master: MedicineMaster): Observable<MedicineMaster> {
    return this.http.post<MedicineMaster>(this.apiUrl, master);
  }

  update(id: number, master: MedicineMaster): Observable<MedicineMaster> {
    return this.http.put<MedicineMaster>(`${this.apiUrl}/${id}`, master);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
