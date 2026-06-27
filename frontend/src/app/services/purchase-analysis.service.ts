import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class PurchaseAnalysisService {
  private analysisUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.analysisUrl = this.apiConfig.apiUrl('/api/purchase/analysis');
  }

  getPurchaseAnalysisSummary(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.analysisUrl}/summary`, {
      params: { startDate, endDate }
    });
  }
}
