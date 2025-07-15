"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fileHandler_1 = require("./fileHandler");
const nativeAudioProcessor_1 = require("./nativeAudioProcessor");
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    if (process.env.NODE_ENV === 'development') {
        // 開発モードは Vite Dev サーバーに接続
        win.loadURL('http://localhost:3000/');
    }
    else {
        // プロダクションビルドは index.html を読み込む
        const indexPath = path_1.default.join(__dirname, 'index.html');
        win.loadFile(indexPath);
    }
    // 外部リンクはデフォルトブラウザで開く
    win.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
}
// IPCハンドラーを設定
electron_1.ipcMain.handle('get-corporate-config', () => {
    try {
        const configPath = path_1.default.join(process.cwd(), 'corporate-config.json');
        if (fs_1.default.existsSync(configPath)) {
            const configData = fs_1.default.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        }
        return null;
    }
    catch (error) {
        console.warn('企業設定ファイルの読み込みに失敗:', error);
        return null;
    }
});
electron_1.ipcMain.handle('get-app-path', () => {
    return process.cwd();
});
// 日本語メニューテンプレート
const createMenuTemplate = () => {
    const template = [
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
                        electron_1.app.quit();
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
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            focusedWindow.reload();
                        }
                    }
                },
                {
                    label: '強制再読み込み',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            focusedWindow.webContents.reloadIgnoringCache();
                        }
                    }
                },
                {
                    label: '開発者ツール',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    click: (item, focusedWindow) => {
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
                        electron_1.shell.openExternal('https://github.com/your-repo/minutesgen');
                    }
                },
                {
                    label: 'ドキュメント',
                    click: () => {
                        electron_1.shell.openExternal('https://github.com/your-repo/minutesgen/docs');
                    }
                },
                { type: 'separator' },
                {
                    label: 'バージョン情報',
                    click: (item, focusedWindow) => {
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
                        electron_1.shell.openExternal('https://github.com/your-repo/minutesgen');
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
                        electron_1.app.quit();
                    }
                }
            ]
        });
    }
    return template;
};
electron_1.app.whenReady().then(() => {
    // ファイルハンドラーを初期化
    (0, fileHandler_1.setupFileHandler)();
    // 日本語メニューを設定
    const menu = electron_1.Menu.buildFromTemplate(createMenuTemplate());
    electron_1.Menu.setApplicationMenu(menu);
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
// ネイティブFFmpegのIPC通信ハンドラー
let nativeAudioProcessor = null;
// 音声処理の初期化
electron_1.ipcMain.handle('audio-processor-initialize', async (event, progressCallback) => {
    if (!nativeAudioProcessor) {
        nativeAudioProcessor = new nativeAudioProcessor_1.NativeAudioProcessor();
    }
    try {
        await nativeAudioProcessor.initialize((progress) => {
            event.sender.send('audio-processor-progress', progress);
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '初期化エラー' };
    }
});
// 大容量音声ファイルの処理
electron_1.ipcMain.handle('audio-processor-process-file', async (event, filePath, segmentDuration = 600) => {
    if (!nativeAudioProcessor) {
        return { success: false, error: '音声処理システムが初期化されていません' };
    }
    try {
        const segments = await nativeAudioProcessor.processLargeAudioFile(filePath, segmentDuration, (progress) => {
            event.sender.send('audio-processor-progress', progress);
        });
        // Blobデータを転送可能な形式に変換
        const serializedSegments = await Promise.all(segments.map(async (segment) => ({
            name: segment.name,
            duration: segment.duration,
            startTime: segment.startTime,
            endTime: segment.endTime,
            data: Buffer.from(await segment.blob.arrayBuffer()).toString('base64'),
            type: segment.blob.type,
        })));
        return { success: true, segments: serializedSegments };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '処理エラー' };
    }
});
// 音声の長さを取得
electron_1.ipcMain.handle('audio-processor-get-duration', async (event, blobData, blobType) => {
    if (!nativeAudioProcessor) {
        return { success: false, error: '音声処理システムが初期化されていません' };
    }
    try {
        const blob = new Blob([Buffer.from(blobData, 'base64')], { type: blobType });
        const duration = await nativeAudioProcessor.getAudioDurationFromBlob(blob);
        return { success: true, duration };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '長さ取得エラー' };
    }
});
// クリーンアップ
electron_1.ipcMain.handle('audio-processor-cleanup', async () => {
    if (nativeAudioProcessor) {
        try {
            await nativeAudioProcessor.cleanup();
            nativeAudioProcessor = null;
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'クリーンアップエラー' };
        }
    }
    return { success: true };
});
// アプリ終了時のクリーンアップ
electron_1.app.on('before-quit', async () => {
    if (nativeAudioProcessor) {
        await nativeAudioProcessor.cleanup();
    }
});
