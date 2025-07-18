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
const os_1 = __importDefault(require("os"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path_1.default.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        show: false, // 初期化完了後に表示
    });
    // アプリケーションが準備完了したら表示
    win.once('ready-to-show', () => {
        win.show();
    });
    // メモリ使用量の監視とガベージコレクション（一時的に無効化）
    /*
    const memoryMonitor = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      // メモリ使用量が多い場合はログ出力
      if (heapUsedMB > 500) { // 500MB以上で警告
        console.warn('⚠️ メモリ使用量が多くなっています:', {
          heapUsed: heapUsedMB + 'MB',
          heapTotal: heapTotalMB + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
        });
      }
      
      // 極端にメモリ使用量が多い場合は強制ガベージコレクション
      if (heapUsedMB > 1000) { // 1GB以上で強制GC
        if (global.gc) {
          global.gc();
          console.log('🗑️ 強制ガベージコレクションを実行しました');
        }
      }
    }, 30000); // 30秒間隔で監視
  
    // ウィンドウが閉じられる際にメモリ監視を停止
    win.on('closed', () => {
      clearInterval(memoryMonitor);
    });
    */
    if (process.env.NODE_ENV === 'development') {
        // 開発モードは Vite Dev サーバーに接続
        win.loadURL('http://localhost:9000/');
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
                alert('MinutesGen v0.7.5\\n議事録自動生成アプリケーション');
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
    console.log('🎵 IPC: audio-processor-initialize');
    try {
        if (!nativeAudioProcessor) {
            console.log('🔄 新しいNativeAudioProcessorインスタンスを作成');
            nativeAudioProcessor = new nativeAudioProcessor_1.NativeAudioProcessor();
        }
        await nativeAudioProcessor.initialize((progress) => {
            console.log('📊 進捗通知:', progress.currentTask);
            event.sender.send('audio-processor-progress', progress);
        });
        console.log('✅ IPC: audio-processor-initialize 成功');
        return { success: true };
    }
    catch (error) {
        console.error('❌ IPC: audio-processor-initialize エラー:', error);
        const errorMessage = error instanceof Error ? error.message : '初期化エラー';
        return { success: false, error: errorMessage };
    }
});
// 大容量音声ファイルの処理
electron_1.ipcMain.handle('audio-processor-process-file', async (event, filePath, segmentDuration = 600) => {
    console.log('🎵 IPC: audio-processor-process-file', { filePath, segmentDuration });
    if (!nativeAudioProcessor) {
        console.error('❌ 音声処理システムが初期化されていません');
        return { success: false, error: '音声処理システムが初期化されていません' };
    }
    try {
        const segments = await nativeAudioProcessor.processLargeAudioFile(filePath, segmentDuration, (progress) => {
            console.log('📊 処理進捗:', progress.currentTask);
            event.sender.send('audio-processor-progress', progress);
        });
        console.log(`✅ 音声処理完了: ${segments.length}個のセグメント`);
        // ファイルパスを直接送信（メモリ効率化）
        const segmentPaths = segments.map(segment => ({
            filePath: segment.filePath,
            name: segment.name,
            duration: segment.duration,
            startTime: segment.startTime,
            endTime: segment.endTime,
        }));
        console.log('✅ IPC: audio-processor-process-file 成功');
        return { success: true, segments: segmentPaths };
    }
    catch (error) {
        console.error('❌ IPC: audio-processor-process-file エラー:', error);
        const errorMessage = error instanceof Error ? error.message : '処理エラー';
        return { success: false, error: errorMessage };
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
// セグメントファイルの読み込み（メモリ効率化）
electron_1.ipcMain.handle('audio-processor-read-segment-file', async (event, filePath) => {
    console.log('📁 IPC: audio-processor-read-segment-file', { filePath });
    try {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`セグメントファイルが見つかりません: ${filePath}`);
        }
        const fileData = await fs_1.default.promises.readFile(filePath);
        const base64Data = fileData.toString('base64');
        console.log('✅ IPC: audio-processor-read-segment-file 成功');
        return { success: true, data: base64Data };
    }
    catch (error) {
        console.error('❌ IPC: audio-processor-read-segment-file エラー:', error);
        const errorMessage = error instanceof Error ? error.message : 'ファイル読み込みエラー';
        return { success: false, error: errorMessage };
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
// 一時ファイルの保存
electron_1.ipcMain.handle('audio-processor-save-temp-file', async (event, fileName, arrayBufferData) => {
    console.log('💾 IPC: audio-processor-save-temp-file', { fileName, dataSize: arrayBufferData.byteLength });
    try {
        // 一時ディレクトリを作成
        const tempDir = path_1.default.join(os_1.default.tmpdir(), 'minutes-gen-audio');
        await fs_1.default.promises.mkdir(tempDir, { recursive: true });
        // 一時ファイルパスを生成
        const tempPath = path_1.default.join(tempDir, `${Date.now()}-${fileName}`);
        // ArrayBufferをBufferに変換してファイルに保存
        const buffer = Buffer.from(arrayBufferData);
        await fs_1.default.promises.writeFile(tempPath, buffer);
        console.log('✅ IPC: audio-processor-save-temp-file 成功', { tempPath });
        return { success: true, tempPath };
    }
    catch (error) {
        console.error('❌ IPC: audio-processor-save-temp-file エラー:', error);
        const errorMessage = error instanceof Error ? error.message : '一時ファイル保存エラー';
        return { success: false, error: errorMessage };
    }
});
// アプリ終了時のクリーンアップ
electron_1.app.on('before-quit', async () => {
    if (nativeAudioProcessor) {
        await nativeAudioProcessor.cleanup();
    }
});
