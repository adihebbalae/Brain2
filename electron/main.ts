import { app, BrowserWindow, Tray, Menu, shell, nativeImage, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import * as net from 'net';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;
let ollamaProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production';
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;
const viteReactRefreshPreamble = `import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`;
const viteReactRefreshPreambleHash = `'sha256-${createHash('sha256')
  .update(viteReactRefreshPreamble)
  .digest('base64')}'`;

function waitForServer(port: number, maxRetries = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const tryConnect = () => {
      const client = net.connect({ port, host: 'localhost' }, () => {
        client.end();
        resolve();
      });
      
      client.on('error', () => {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error(`Server on port ${port} did not start after ${maxRetries} retries`));
        } else {
          setTimeout(tryConnect, 1000);
        }
      });
    };
    
    tryConnect();
  });
}

function startOllama(): Promise<void> {
  return new Promise((resolve) => {
    const client = net.connect({ port: 11434, host: 'localhost' }, () => {
      console.log('[ollama] Already running on port 11434');
      client.end();
      resolve();
    });
    
    client.on('error', () => {
      console.log('[ollama] Starting Ollama...');
      ollamaProcess = spawn('ollama', ['serve'], { 
        stdio: 'ignore',
        shell: true,
        detached: true
      });
      
      ollamaProcess.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          console.log('[ollama] Ollama not found - install from https://ollama.ai');
        } else {
          console.error('[ollama] Error starting Ollama:', err);
        }
        resolve();
      });
      
      // Give Ollama time to start, then resolve
      setTimeout(resolve, 2000);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(fs.existsSync(path.join(__dirname, '../build/icon.png')) ? { icon: path.join(__dirname, '../build/icon.png') } : {})
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Cortex', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Cortex Dashboard');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

async function startBackendInProduction() {
  console.log('[backend] Starting backend server...');
  
  const serverScript = path.join(__dirname, '../dist-server/index.js');
  
  backendProcess = spawn('node', [serverScript], {
    stdio: 'inherit',
    env: { ...process.env, SERVE_STATIC: 'true' }
  });
  
  backendProcess.on('error', (err) => {
    console.error('[backend] Failed to start:', err);
  });
  
  // Wait for backend to be ready
  await waitForServer(BACKEND_PORT);
  console.log('[backend] Server ready');
}

app.on('ready', async () => {
  // Set Content Security Policy
  // In dev, Vite injects a small inline React refresh preamble into index.html.
  // Allow only that exact script by hash so Electron doesn't block it.
  const csp = isDev
    ? [
        "default-src 'self'",
        `script-src 'self' ${viteReactRefreshPreambleHash}`,
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' http://localhost:3001 http://localhost:5173 ws://localhost:5173 http://localhost:11434`,
        "img-src 'self' data: https:",
        "font-src 'self' data:",
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' http://localhost:3001 http://localhost:11434`,
        "img-src 'self' data: https:",
        "font-src 'self' data:",
      ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  try {
    // Start Ollama first
    await startOllama();
    
    // In production, start backend; in dev, assume it's already running
    if (!isDev) {
      await startBackendInProduction();
    } else {
      // In dev, wait for both frontend and backend
      await Promise.all([
        waitForServer(FRONTEND_PORT),
        waitForServer(BACKEND_PORT)
      ]);
    }
    
    createWindow();
    createTray();
  } catch (error) {
    console.error('Failed to start app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray when all windows closed
  if (process.platform !== 'darwin') {
    // On Windows/Linux, we keep the app running too (tray behavior)
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  // Kill child processes
  if (backendProcess) {
    backendProcess.kill();
  }
  if (ollamaProcess) {
    ollamaProcess.kill();
  }
});

// Declare isQuitting property on app
declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}
