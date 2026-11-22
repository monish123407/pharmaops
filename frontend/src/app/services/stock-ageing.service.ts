import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class StockAgeingService {
  private apiUrl: string;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/stock-ageing');
  }

  getAgeingReport(freshLimit = 30, moderateLimit = 90, slowMovingLimit = 180): Observable<any> {
    const params = new HttpParams()
      .set('freshLimit', freshLimit)
      .set('moderateLimit', moderateLimit)
      .set('slowMovingLimit', slowMovingLimit);
    return this.http.get<any>(`${this.apiUrl}/report`, { params });
  }
}
