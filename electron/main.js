const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true, // Hide menu bar for game feel
    });

    // Check if we are in development mode
    // The 'electron' script in package.json usually sets an env var or we can assume dev if not packaged
    const isDev = !app.isPackaged;

    if (isDev) {
        // Vite default port is 5173
        win.loadURL('http://localhost:5173');
        console.log('Running in dev mode: loading http://localhost:5173');
    } else {
        // In production, load the built index.html
        // relative to this file (electron/main.js) -> ../dist/index.html
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
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
