import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/types';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl: string;
  
  // Current user signal
  currentUser = signal<LoginResponse | null>(null);
  
  // Computed helpers for quick role checking
  isAuthenticated = computed(() => this.currentUser() !== null);
  userRole = computed(() => this.currentUser()?.role || null);
  userFullName = computed(() => this.currentUser()?.fullName || '');

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.apiUrl = this.apiConfig.apiUrl('/api/auth');

    // Restore session on bootstrap
    const savedUser = localStorage.getItem('pharmacy_session');
    if (savedUser) {
      try {
        this.currentUser.set(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('pharmacy_session');
      }
    }
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        localStorage.setItem('pharmacy_session', JSON.stringify(response));
        this.currentUser.set(response);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('pharmacy_session');
    this.currentUser.set(null);
  }

  hasRole(roles: string[]): boolean {
    const role = this.userRole();
    return role ? roles.includes(role) : false;
  }
}
