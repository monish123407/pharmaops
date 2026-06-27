import { Injectable } from '@angular/core';

/**
 * Centralized API configuration service.
 *
 * In Electron desktop mode, the backend port is dynamically assigned
 * and passed to the Angular app via a URL query parameter (?port=XXXXX).
 * In browser dev mode, falls back to the default port 8080.
 */
@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private _baseUrl: string;

  constructor() {
    // Read port from URL query parameter (set by Electron's loadFile/loadURL)
    const urlParams = new URLSearchParams(window.location.search);
    const port = urlParams.get('port') || '8080';
    this._baseUrl = `http://localhost:${port}`;
  }

  /** Returns e.g. 'http://localhost:8080' or 'http://localhost:49152' */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /** Returns e.g. 'http://localhost:8080/api/medicines' */
  apiUrl(path: string): string {
    return `${this._baseUrl}${path}`;
  }
}
