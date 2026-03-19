const { app, BrowserWindow } = require('electron');
const path = require('path');

// GPU ENABLED VERSION - Use only if your GPU drivers are up to date
// This version tries to use hardware acceleration
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('use-angle', 'default');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let gpuCrashed = false;

// Handle GPU process crashes gracefully
app.on('gpu-process-crashed', (event, killed) => {
  console.log('GPU process crashed:', killed);
  gpuCrashed = true;
  
  // Disable GPU for subsequent windows
  if (!app.commandLine.hasSwitch('disable-gpu')) {
    app.commandLine.appendSwitch('disable-gpu');
    console.log('GPU disabled due to crash. Restart the application for changes to take effect.');
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webgl: true,
      experimentalFeatures: true
    },
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'default',
    frame: true
  });
  
  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.log('Renderer process crashed:', details);
    if (details.reason === 'crashed' || details.reason === 'killed') {
      console.log('Attempting to reload window...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 1000);
    }
  });
  
  // Handle GPU crashes in the renderer
  mainWindow.webContents.on('gpu-process-crashed', (event, killed) => {
    console.log('GPU process crashed in renderer:', killed);
    gpuCrashed = true;
  });
  
  // Handle console messages for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message.includes('vector') || message.includes('assertion') || message.includes('bounds')) {
      console.log(`Console [${level}]: ${message}`);
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


