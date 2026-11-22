import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface HsnCodeConfig {
  id?: number;
  code: string;
  cgst: number;
  sgst: number;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HsnManagementService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/hsn-codes');
  }

  /** Fetch all registered HSN Code configurations */
  getAll(): Observable<HsnCodeConfig[]> {
    return this.http.get<HsnCodeConfig[]>(this.apiUrl);
  }

  /** Fetch a single configuration by ID */
  getById(id: number): Observable<HsnCodeConfig> {
    return this.http.get<HsnCodeConfig>(`${this.apiUrl}/${id}`);
  }

  /** Register a new HSN Code configuration */
  create(hsnConfig: HsnCodeConfig): Observable<HsnCodeConfig> {
    return this.http.post<HsnCodeConfig>(this.apiUrl, hsnConfig);
  }

  /** Update an existing HSN Code configuration (will cascade to medicine masters and active batches) */
  update(id: number, hsnConfig: HsnCodeConfig): Observable<HsnCodeConfig> {
    return this.http.put<HsnCodeConfig>(`${this.apiUrl}/${id}`, hsnConfig);
  }

  /** Delete an HSN Code configuration */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
