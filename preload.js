// ================================================================
// Arpita Medical — Electron Preload Script
// Securely exposes backend port to the Angular renderer process
// via contextBridge (contextIsolation: true).
// ================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Get the dynamically assigned backend port.
   * Angular's ApiConfigService reads this to construct API URLs.
   */
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),

  /**
   * Get the application version string.
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Get the log directory path.
   */
  getLogDir: () => ipcRenderer.invoke('get-log-dir'),

  /**
   * Flag indicating we are running inside Electron.
   */
  isElectron: true
});
