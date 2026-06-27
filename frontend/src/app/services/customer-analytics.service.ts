import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerAnalyticsService {
  private analysisUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.analysisUrl = this.apiConfig.apiUrl('/api/customer-analysis');
  }

  getCustomerAnalysisSummary(startDate?: string, endDate?: string): Observable<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.http.get<any>(`${this.analysisUrl}/summary`, { params });
  }
}
