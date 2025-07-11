import { app, BrowserWindow, shell, ipcMain, Menu, MenuItem, MenuItemConstructorOptions } from 'electron';
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

// 日本語メニューテンプレート
const createMenuTemplate = (): MenuItemConstructorOptions[] => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '新規作成',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          }
        },
        {
          label: '開く',
          accelerator: 'CmdOrCtrl+O',
          // ファイル選択ダイアログを開く処理は将来実装
        },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '編集',
      submenu: [
        {
          label: '元に戻す',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: 'やり直し',
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: '切り取り',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'コピー',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: '貼り付け',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: 'すべて選択',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll'
        }
      ]
    },
    {
      label: '表示',
      submenu: [
        {
          label: '再読み込み',
          accelerator: 'CmdOrCtrl+R',
          click: (item: MenuItem, focusedWindow: BrowserWindow | undefined) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: '強制再読み込み',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (item: MenuItem, focusedWindow: BrowserWindow | undefined) => {
            if (focusedWindow) {
              focusedWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        {
          label: '開発者ツール',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item: MenuItem, focusedWindow: BrowserWindow | undefined) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: '実際のサイズ',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom'
        },
        {
          label: '拡大',
          accelerator: 'CmdOrCtrl+Plus',
          role: 'zoomIn'
        },
        {
          label: '縮小',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut'
        },
        { type: 'separator' },
        {
          label: '全画面表示',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          role: 'togglefullscreen'
        }
      ]
    },
    {
      label: 'ウィンドウ',
      submenu: [
        {
          label: '最小化',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: '閉じる',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'MinutesGenについて',
          click: () => {
            shell.openExternal('https://github.com/your-repo/minutesgen');
          }
        },
        {
          label: 'ドキュメント',
          click: () => {
            shell.openExternal('https://github.com/your-repo/minutesgen/docs');
          }
        },
        { type: 'separator' },
        {
          label: 'バージョン情報',
          click: (item: MenuItem, focusedWindow: BrowserWindow | undefined) => {
            if (focusedWindow) {
              focusedWindow.webContents.executeJavaScript(`
                alert('MinutesGen v0.7.3\\n議事録自動生成アプリケーション');
              `);
            }
          }
        }
      ]
    }
  ];

  // macOSの場合、アプリケーションメニューを追加
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'MinutesGen',
      submenu: [
        {
          label: 'MinutesGenについて',
          click: () => {
            shell.openExternal('https://github.com/your-repo/minutesgen');
          }
        },
        { type: 'separator' },
        {
          label: 'サービス',
          role: 'services'
        },
        { type: 'separator' },
        {
          label: 'MinutesGenを隠す',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'ほかを隠す',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'すべて表示',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'MinutesGenを終了',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    });
  }

  return template;
};

app.whenReady().then(() => {
  // ファイルハンドラーを初期化
  setupFileHandler();
  
  // 日本語メニューを設定
  const menu = Menu.buildFromTemplate(createMenuTemplate());
  Menu.setApplicationMenu(menu);
  
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