// ================================================================
// Arpita Medical — Electron Main Process
// Production-ready desktop wrapper for Angular + Spring Boot
// ================================================================

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const http = require('http');

// ── State ──────────────────────────────────────────────────────
let backendProcess = null;
let mainWindow = null;
let backendPort = 0;
let logDir = '';
let electronLogStream = null;

// ── Logging ────────────────────────────────────────────────────

/**
 * Initialise structured file logging.
 * All logs go to %APPDATA%/ArpitaMedical/logs/ (or equivalent on other OS).
 */
function initLogging() {
  logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logPath = path.join(logDir, 'electron.log');
  electronLogStream = fs.createWriteStream(logPath, { flags: 'a' });

  const origLog = console.log;
  const origErr = console.error;

  console.log = (...args) => {
    const msg = `[${new Date().toISOString()}] [INFO] ${args.join(' ')}\n`;
    if (electronLogStream) electronLogStream.write(msg);
    origLog.apply(console, args);
  };

  console.error = (...args) => {
    const msg = `[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`;
    if (electronLogStream) electronLogStream.write(msg);
    origErr.apply(console, args);
  };

  console.log(`Electron logging initialised. Log dir: ${logDir}`);
}

// ── Port Detection ─────────────────────────────────────────────

/**
 * Find a free TCP port between 49152-65000.
 * Returns a Promise<number>.
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// ── JRE Resolution ─────────────────────────────────────────────

/**
 * Resolve the path to the Java executable.
 * Priority:
 *   1. Bundled JRE in resources/jre/bin/java[.exe]
 *   2. System-installed Java on PATH
 */
function resolveJavaPath() {
  if (app.isPackaged) {
    const bundledJava = path.join(
      process.resourcesPath,
      'jre',
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java'
    );
    if (fs.existsSync(bundledJava)) {
      console.log(`Using bundled JRE: ${bundledJava}`);
      return bundledJava;
    }
    console.log('Bundled JRE not found, falling back to system Java.');
  }

  // Development mode or fallback: check system Java
  try {
    execSync('java -version', { stdio: 'ignore' });
    console.log('Using system Java.');
    return 'java';
  } catch (err) {
    return null;
  }
}

// ── Backend Health Check ───────────────────────────────────────

/**
 * HTTP GET /actuator/health on the backend port.
 * Returns true if status 200, false otherwise.
 */
function checkBackendHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/actuator/health`,
      { timeout: 2000 },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Poll backend health until it responds UP, or timeout after maxWaitMs.
 */
function waitForBackendHealth(port, maxWaitMs = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const poll = async () => {
      const healthy = await checkBackendHealth(port);
      if (healthy) {
        return resolve();
      }
      if (Date.now() - startTime > maxWaitMs) {
        return reject(new Error(`Backend did not become healthy within ${maxWaitMs / 1000}s`));
      }
      setTimeout(poll, 800);
    };

    poll();
  });
}

// ── Backend Launcher ───────────────────────────────────────────

async function startBackend() {
  const javaPath = resolveJavaPath();

  if (!javaPath) {
    dialog.showErrorBox(
      'Java Runtime Required',
      'Arpita Medical requires Java Runtime Environment (JRE 17 or higher).\n\n' +
      'No bundled JRE was found and Java is not installed on your system.\n\n' +
      'Please install Java from https://adoptium.net/ and restart the application.'
    );
    app.quit();
    return;
  }

  // Resolve backend JAR
  let jarPath;
  if (app.isPackaged) {
    jarPath = path.join(process.resourcesPath, 'backend.jar');
  } else {
    jarPath = path.join(__dirname, 'backend', 'target', 'backend-0.0.1-SNAPSHOT.jar');
  }

  if (!fs.existsSync(jarPath)) {
    dialog.showErrorBox(
      'Backend Not Found',
      `Could not find the backend JAR at:\n${jarPath}\n\nPlease rebuild the application.`
    );
    app.quit();
    return;
  }

  // Find a free port
  backendPort = await findFreePort();
  console.log(`Allocated backend port: ${backendPort}`);

  // Database path (survives uninstall when deleteAppDataOnUninstall=false)
  const dbDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'pharmacy_db');

  // Backend log file
  const backendLogPath = path.join(logDir, 'backend.log');

  console.log(`Starting backend: ${javaPath} -jar ${jarPath}`);
  console.log(`  Database: ${dbPath}`);
  console.log(`  Port: ${backendPort}`);
  console.log(`  Log: ${backendLogPath}`);

  // Build Java args
  const javaArgs = [
    '-jar',
    jarPath,
    `--server.port=${backendPort}`,
    `--spring.datasource.url=jdbc:h2:file:${dbPath}`,
    `--logging.file.name=${backendLogPath}`
  ];

  backendProcess = spawn(javaPath, javaArgs, {
    cwd: path.dirname(jarPath),
    env: { ...process.env, SERVER_PORT: String(backendPort) }
  });

  // Stream backend stdout/stderr to log file
  const backendLogStream = fs.createWriteStream(backendLogPath, { flags: 'a' });

  backendProcess.stdout.on('data', (data) => {
    backendLogStream.write(data);
  });

  backendProcess.stderr.on('data', (data) => {
    backendLogStream.write(data);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendLogStream.end();
  });

  backendProcess.on('error', (err) => {
    console.error(`Backend process error: ${err.message}`);
  });

  // Wait for health check
  try {
    await waitForBackendHealth(backendPort, 90000);
    console.log('Backend is healthy and ready!');
  } catch (err) {
    console.error(`Backend health check failed: ${err.message}`);
    dialog.showErrorBox(
      'Backend Startup Failed',
      'The backend server did not start within 90 seconds.\n\n' +
      `Check the log file at:\n${backendLogPath}`
    );
    killBackendProcess();
    app.quit();
  }
}

// ── Window Creation ────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: '✚ Arpita Medical - Pharmacy Retail Operations Suite',
    icon: path.join(__dirname, 'frontend', 'dist', 'frontend', 'browser', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Hide menu bar for native desktop look
  mainWindow.setMenuBarVisibility(false);

  // Show splash screen while backend starts
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <title>Loading Arpita Medical</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: linear-gradient(135deg, #020a13 0%, #0a1628 50%, #061220 100%);
            color: #0d9488;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
          }
          .logo-container {
            margin-bottom: 28px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse-glow 3s ease-in-out infinite;
          }
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(13, 148, 136, 0.2)); }
            50% { transform: scale(1.04); filter: drop-shadow(0 0 25px rgba(13, 148, 136, 0.5)); }
          }
          .pulse-line {
            stroke-dasharray: 200;
            stroke-dashoffset: 200;
            animation: draw-pulse 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @keyframes draw-pulse {
            0% { stroke-dashoffset: 200; }
            50% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -200; }
          }
          .logo {
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: 1px;
            color: #ffffff;
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
          }
          .subtitle {
            color: #64748b;
            font-size: 0.85rem;
            margin-bottom: 36px;
            font-weight: 500;
          }
          .spinner {
            width: 36px;
            height: 36px;
            border: 3px solid rgba(13, 148, 136, 0.15);
            border-radius: 50%;
            border-top-color: #0d9488;
            animation: spin 0.8s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .status {
            color: #475569;
            font-size: 0.8rem;
            animation: pulse 1.5s ease-in-out infinite;
            font-weight: 600;
          }
          @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
          .version {
            position: absolute;
            bottom: 16px;
            color: #334155;
            font-size: 0.7rem;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <svg viewBox="0 0 100 100" width="100" height="100" style="display: block;">
            <defs>
              <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#14b8a6" />
                <stop offset="50%" stop-color="#0d9488" />
                <stop offset="100%" stop-color="#0f766e" />
              </linearGradient>
              <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#0d9488" flood-opacity="0.3"/>
              </filter>
            </defs>
            <!-- Glowing background circle -->
            <circle cx="50" cy="50" r="44" fill="rgba(13, 148, 136, 0.04)" stroke="rgba(13, 148, 136, 0.2)" stroke-width="2" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(13, 148, 136, 0.08)" stroke-width="1" stroke-dasharray="4 4" />
            
            <!-- Sleek Modern Cross -->
            <path d="M 40 18 Q 50 18 50 18 Q 50 18 60 18 C 60 18 60 40 60 40 C 60 40 82 40 82 40 C 82 40 82 50 82 50 C 82 50 82 60 82 60 C 82 60 60 60 60 60 C 60 60 60 82 60 82 C 60 82 50 82 50 82 C 50 82 40 82 40 82 C 40 82 40 60 40 60 C 40 60 18 60 18 60 C 18 60 18 50 18 50 C 18 50 18 40 18 40 C 18 40 40 40 40 40 Z" 
                  fill="none" stroke="url(#glowGrad)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadowFilter)" />
            
            <!-- ECG Heartbeat Line running through cross -->
            <path d="M 22 50 L 37 50 L 41 32 L 47 68 L 52 42 L 56 58 L 60 50 L 78 50" 
                  fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="pulse-line" />
          </svg>
        </div>
        <div class="spinner"></div>
        <div class="logo">Arpita Medical</div>
        <div class="subtitle">Pharmacy Retail Operations Suite</div>
        <div class="status" id="status">Starting secure backend services...</div>
        <div class="version">v1.0.0</div>
      </body>
    </html>
  `);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Load the Angular frontend once the backend is ready.
 * Passes the backend port via URL query parameter.
 */
function loadFrontend() {
  if (!mainWindow) return;

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(__dirname, 'frontend', 'dist', 'frontend', 'browser', 'index.html'),
      { query: { port: String(backendPort) } }
    );
  } else {
    // Dev mode: use Angular dev server with port param
    mainWindow.loadURL(`http://localhost:4200?port=${backendPort}`);
  }

  console.log(`Angular frontend loaded with backend port ${backendPort}.`);
}

// ── Backend Process Cleanup ────────────────────────────────────

function killBackendProcess() {
  if (!backendProcess) return;

  console.log('Killing backend process...');

  try {
    if (process.platform === 'win32') {
      // Windows: kill entire process tree
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t']);
    } else {
      backendProcess.kill('SIGTERM');
      // Force kill after 5s if still alive
      setTimeout(() => {
        try { backendProcess.kill('SIGKILL'); } catch (e) { /* already dead */ }
      }, 5000);
    }
  } catch (e) {
    console.error(`Error killing backend: ${e.message}`);
  }

  backendProcess = null;
}

// ── IPC Handlers ───────────────────────────────────────────────

function setupIPC() {
  ipcMain.handle('get-backend-port', () => backendPort);
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-log-dir', () => logDir);
}

// ── Auto-Updater Scaffold ──────────────────────────────────────

function initAutoUpdater() {
  // Auto-updater will be activated once a publish URL is configured
  // in electron-builder. For now, this is a scaffold.
  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.logger = {
      info: (...args) => console.log('[AutoUpdater]', ...args),
      warn: (...args) => console.log('[AutoUpdater WARN]', ...args),
      error: (...args) => console.error('[AutoUpdater ERROR]', ...args)
    };

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log(`Update available: ${info.version}`);
      // Future: show dialog to user
    });

    autoUpdater.on('update-not-available', () => {
      console.log('Application is up to date.');
    });

    autoUpdater.on('error', (err) => {
      console.error(`Auto-updater error: ${err.message}`);
    });

    // Check for updates (will only work when publish config is set)
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {
        console.log('Auto-update check skipped (no publish config).');
      });
    }
  } catch (e) {
    console.log('Auto-updater not available (dev mode or missing dependency).');
  }
}

// ── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(async () => {
  initLogging();
  setupIPC();

  console.log('=== Arpita Medical Desktop Starting ===');
  console.log(`App version: ${app.getVersion()}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Packaged: ${app.isPackaged}`);
  console.log(`User data: ${app.getPath('userData')}`);

  createMainWindow();
  await startBackend();
  loadFrontend();
  initAutoUpdater();
});

// Graceful shutdown
app.on('window-all-closed', () => {
  console.log('All windows closed. Shutting down...');
  killBackendProcess();

  if (electronLogStream) {
    electronLogStream.end();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('App quitting. Ensuring backend cleanup...');
  killBackendProcess();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
