import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class GstReportService {
  private gstUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.gstUrl = this.apiConfig.apiUrl('/api/gst');
  }

  getGstSummary(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.gstUrl}/summary`, {
      params: { startDate, endDate }
    });
  }
}
