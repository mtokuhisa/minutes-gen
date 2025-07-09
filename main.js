"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// デバッグ情報を有効化
process.env.ELECTRON_ENABLE_LOGGING = '1';
function createWindow() {
    console.log('Creating window...');
    console.log('__dirname:', __dirname);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // 準備完了まで非表示
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
    });
    // ウィンドウの準備完了時に表示
    win.once('ready-to-show', () => {
        console.log('Window ready to show');
        win.show();
    });
    // エラーハンドリング
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });
    win.webContents.on('crashed', (event, killed) => {
        console.error('Renderer process crashed:', killed);
    });
    if (process.env.NODE_ENV === 'development') {
        // 開発モードは Vite Dev サーバーに接続
        console.log('Loading development URL...');
        win.loadURL('http://localhost:3000/');
    }
    else {
        // プロダクションビルドは dist/index.html を読み込む
        const indexPath = path_1.default.join(__dirname, '..', 'dist', 'index.html');
        console.log('Loading production file:', indexPath);
        // ファイルの存在確認
        const fs = require('fs');
        if (fs.existsSync(indexPath)) {
            console.log('Index file exists, loading...');
            win.loadFile(indexPath);
        }
        else {
            console.error('Index file not found:', indexPath);
            // フォールバック: 相対パスで試行
            const fallbackPath = path_1.default.join(__dirname, 'index.html');
            console.log('Trying fallback path:', fallbackPath);
            win.loadFile(fallbackPath);
        }
    }
    // 外部リンクはデフォルトブラウザで開く
    win.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    // デバッグ用：開発者ツールを開く（プロダクションでも一時的に）
    if (process.env.NODE_ENV !== 'production') {
        win.webContents.openDevTools();
    }
}
electron_1.app.whenReady().then(() => {
    console.log('App ready, creating window...');
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// 未処理エラーのキャッチ
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
