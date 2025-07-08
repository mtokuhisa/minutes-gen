import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
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