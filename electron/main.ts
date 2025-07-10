import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupFileHandler } from './fileHandler';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // 開発モードは Vite Dev サーバーに接続
    win.loadURL('http://localhost:3000/');
  } else {
    // プロダクションビルドは dist/index.html を読み込む
    win.loadFile(path.join(__dirname, 'index.html'));
  }

  // 外部リンクはデフォルトブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPCハンドラーを設定
ipcMain.handle('get-corporate-config', () => {
  try {
    const configPath = path.join(process.cwd(), 'corporate-config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    return null;
  } catch (error) {
    console.warn('企業設定ファイルの読み込みに失敗:', error);
    return null;
  }
});

ipcMain.handle('get-app-path', () => {
  return process.cwd();
});

app.whenReady().then(() => {
  // ファイルハンドラーを初期化
  setupFileHandler();
  
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