import { app, BrowserWindow, shell, ipcMain, Menu, MenuItem, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupFileHandler } from './fileHandler';
import { NativeAudioProcessor } from './nativeAudioProcessor';
import os from 'os';
import { safeLog, safeError, safeWarn, safeDebug, safeInfo } from './safeLogger';

// **FFmpegバイナリ固定配置システム**
class FFmpegBinaryManager {
  private static instance: FFmpegBinaryManager;
  private fixedBinPath: string;
  private isInitialized: boolean = false;

  private constructor() {
    // 固定配置ディレクトリを決定
    this.fixedBinPath = path.join(os.homedir(), '.minutesgen', 'bin');
  }

  static getInstance(): FFmpegBinaryManager {
    if (!FFmpegBinaryManager.instance) {
      FFmpegBinaryManager.instance = new FFmpegBinaryManager();
    }
    return FFmpegBinaryManager.instance;
  }

  /**
   * FFmpegバイナリの固定配置パスを取得
   */
  getFixedFFmpegPath(): string {
    return path.join(this.fixedBinPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  }

  getFixedFFprobePath(): string {
    return path.join(this.fixedBinPath, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  }

  /**
   * FFmpegバイナリの初期化（固定場所への配置）
   */
  async initializeFFmpegBinaries(): Promise<void> {
    if (this.isInitialized) {
      safeDebug('✅ FFmpeg固定配置: すでに初期化済み');
      return;
    }

    try {
      safeDebug('🚀 FFmpeg固定配置システム初期化開始');

      // 固定配置ディレクトリを作成
      await this.ensureFixedBinDirectory();

      // FFmpegバイナリを固定場所にコピー
      await this.copyFFmpegToFixedLocation();
      
      // FFprobeバイナリを固定場所にコピー
      await this.copyFFprobeToFixedLocation();

      // 実行権限を設定
      await this.setExecutePermissions();

      // 動作確認
      await this.verifyFFmpegExecution();

      this.isInitialized = true;
      safeDebug('✅ FFmpeg固定配置システム初期化完了');

    } catch (error) {
      safeError('❌ FFmpeg固定配置システム初期化エラー:', error);
      throw new Error(`FFmpeg固定配置に失敗しました: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * 固定配置ディレクトリの作成
   */
  private async ensureFixedBinDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.fixedBinPath, { recursive: true });
      safeDebug('📁 固定配置ディレクトリ作成:', this.fixedBinPath);
    } catch (error) {
      throw new Error(`固定配置ディレクトリ作成に失敗: ${error}`);
    }
  }

  /**
   * FFmpegバイナリを固定場所にコピー
   */
  private async copyFFmpegToFixedLocation(): Promise<void> {
    const sourcePath = this.getSourceFFmpegPath();
    const targetPath = this.getFixedFFmpegPath();

    // すでに存在し、同じサイズなら再コピー不要
    if (await this.isSameBinary(sourcePath, targetPath)) {
      safeDebug('✅ FFmpegバイナリ: すでに最新版が配置済み');
      return;
    }

    try {
      await fs.promises.copyFile(sourcePath, targetPath);
      
      const sourceStats = await fs.promises.stat(sourcePath);
      const targetStats = await fs.promises.stat(targetPath);
      
      safeDebug('📋 FFmpegバイナリコピー完了:', {
        source: sourcePath,
        target: targetPath,
        size: `${(targetStats.size / 1024 / 1024).toFixed(2)}MB`,
        verified: sourceStats.size === targetStats.size
      });

    } catch (error) {
      throw new Error(`FFmpegバイナリコピーに失敗: ${error}`);
    }
  }

  /**
   * FFprobeバイナリを固定場所にコピー
   */
  private async copyFFprobeToFixedLocation(): Promise<void> {
    const sourcePath = this.getSourceFFprobePath();
    const targetPath = this.getFixedFFprobePath();

    if (await this.isSameBinary(sourcePath, targetPath)) {
      safeDebug('✅ FFprobeバイナリ: すでに最新版が配置済み');
      return;
    }

    try {
      await fs.promises.copyFile(sourcePath, targetPath);
      safeDebug('📋 FFprobeバイナリコピー完了:', { source: sourcePath, target: targetPath });
    } catch (error) {
      throw new Error(`FFprobeバイナリコピーに失敗: ${error}`);
    }
  }

  /**
   * 元のFFmpegバイナリパスを取得
   */
  private getSourceFFmpegPath(): string {
    if (app.isPackaged) {
      const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'resources');
      const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
      return path.join(unpackedPath, 'ffmpeg-static', 'ffmpeg');
    } else {
      const nodeModulesPath = path.join(__dirname, '..', '..', 'node_modules');
      const ffmpegPath = path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg.exe');
      if (fs.existsSync(ffmpegPath)) {
        return ffmpegPath;
      }
      return path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg');
    }
  }

  /**
   * 元のFFprobeバイナリパスを取得
   */
  private getSourceFFprobePath(): string {
    if (app.isPackaged) {
      const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'resources');
      const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
      
      if (process.platform === 'win32') {
        return path.join(unpackedPath, 'ffprobe-static', 'bin', 'win32', 'ia32', 'ffprobe.exe');
      } else if (process.platform === 'darwin') {
        let ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
        if (!fs.existsSync(ffprobePath)) {
          ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'darwin', 'x64', 'ffprobe');
        }
        return ffprobePath;
      } else {
        return path.join(unpackedPath, 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
      }
    } else {
      const nodeModulesPath = path.join(__dirname, '..', '..', 'node_modules');
      if (process.platform === 'win32') {
        return path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'win32', 'ia32', 'ffprobe.exe');
      } else if (process.platform === 'darwin') {
        let ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
        if (!fs.existsSync(ffprobePath)) {
          ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'darwin', 'x64', 'ffprobe');
        }
        return ffprobePath;
      } else {
        return path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
      }
    }
  }

  /**
   * バイナリファイルが同じかどうかを確認
   */
  private async isSameBinary(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
        return false;
      }

      const sourceStats = await fs.promises.stat(sourcePath);
      const targetStats = await fs.promises.stat(targetPath);
      
      return sourceStats.size === targetStats.size;
    } catch {
      return false;
    }
  }

  /**
   * 実行権限を設定
   */
  private async setExecutePermissions(): Promise<void> {
    try {
      if (process.platform !== 'win32') {
        await fs.promises.chmod(this.getFixedFFmpegPath(), 0o755);
        await fs.promises.chmod(this.getFixedFFprobePath(), 0o755);
        safeDebug('🔐 実行権限設定完了');
      } else {
        safeDebug('🪟 Windows: 実行権限設定をスキップ');
      }
    } catch (error) {
      safeWarn('⚠️ 実行権限設定警告:', error);
    }
  }

  /**
   * FFmpeg動作確認
   */
  private async verifyFFmpegExecution(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const ffmpegPath = this.getFixedFFmpegPath();

      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        shell: process.platform === 'win32',
        windowsHide: true,
      };

      const ffmpegProcess = spawn(ffmpegPath, ['-version'], spawnOptions);
      
      let outputReceived = false;

      ffmpegProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('ffmpeg version')) {
          outputReceived = true;
          safeDebug('✅ FFmpeg固定配置実行確認成功:', output.split('\n')[0]);
        }
      });

      ffmpegProcess.on('close', (code: number) => {
        if (code === 0 && outputReceived) {
          resolve();
        } else {
          reject(new Error(`FFmpeg動作確認失敗 (exit code: ${code})`));
        }
      });

      ffmpegProcess.on('error', (error: Error) => {
        reject(new Error(`FFmpeg実行エラー: ${error.message}`));
      });

      setTimeout(() => {
        ffmpegProcess.kill();
        reject(new Error('FFmpeg動作確認タイムアウト'));
      }, 10000);
    });
  }
}

// グローバルインスタンス
const ffmpegBinaryManager = FFmpegBinaryManager.getInstance();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
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
      safeWarn('⚠️ メモリ使用量が多くなっています:', {
        heapUsed: heapUsedMB + 'MB',
        heapTotal: heapTotalMB + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
      });
    }
    
    // 極端にメモリ使用量が多い場合は強制ガベージコレクション
    if (heapUsedMB > 1000) { // 1GB以上で強制GC
      if (global.gc) {
        global.gc();
        safeDebug('🗑️ 強制ガベージコレクションを実行しました');
      }
    }
  }, 30000); // 30秒間隔で監視

  // ウィンドウが閉じられる際にメモリ監視を停止
  win.on('closed', () => {
    clearInterval(memoryMonitor);
  });
  */

  // 🔥 防御的プログラミング: 環境判定の強化
  const isDevelopment = process.env.NODE_ENV === 'development';
  safeLog(`🔍 環境判定: NODE_ENV=${process.env.NODE_ENV}, isDevelopment=${isDevelopment}`);
  
  if (isDevelopment) {
    // 開発モードは Vite Dev サーバーに接続
    safeLog('🚀 開発モード: Viteサーバーに接続中...');
    win.loadURL('http://localhost:3000/');
  } else {
    // プロダクションビルドは index.html を読み込む
    const indexPath = path.join(__dirname, 'index.html');
    safeLog(`📦 プロダクションモード: ${indexPath} を読み込み中...`);
    
    // 🔒 ファイル存在確認
    if (!fs.existsSync(indexPath)) {
      safeError(`❌ ERROR: ${indexPath} が存在しません`);
      safeError('💡 解決策: npm run build を実行してビルドファイルを生成してください');
      // フォールバック: 開発サーバーを試行
      safeWarn('🔄 フォールバック: 開発サーバーを試行します');
      win.loadURL('http://localhost:3000/');
      return;
    }
    
    win.loadFile(indexPath);
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
    safeWarn('企業設定ファイルの読み込みに失敗:', error);
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

app.whenReady().then(async () => {
  safeDebug('🚀 Electron app ready - 初期化開始');
  
  try {
    // **FFmpeg固定配置システム初期化**
    safeDebug('🔧 FFmpeg固定配置システム初期化中...');
    await ffmpegBinaryManager.initializeFFmpegBinaries();
    safeDebug('✅ FFmpeg固定配置システム初期化完了');
    
    // メインウィンドウを作成
    createWindow();
    
    // ファイルハンドラーを設定
    setupFileHandler();
    
    // NativeAudioProcessorを初期化（固定パス使用）
    try {
      safeDebug('🎵 NativeAudioProcessor初期化開始（固定パス使用）');
      const { NativeAudioProcessor } = require('./nativeAudioProcessor');
      nativeAudioProcessor = new NativeAudioProcessor(ffmpegBinaryManager);
      safeDebug('✅ NativeAudioProcessor初期化完了');
    } catch (error) {
      safeError('❌ NativeAudioProcessor初期化エラー:', error);
      // 初期化に失敗してもアプリは継続
      nativeAudioProcessor = null;
    }
    
  } catch (error) {
    safeError('❌ アプリ初期化エラー:', error);
    // FFmpeg初期化に失敗してもアプリは起動
    createWindow();
    setupFileHandler();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ネイティブFFmpegのIPC通信ハンドラー
let nativeAudioProcessor: NativeAudioProcessor | null = null;

// 音声処理の初期化
ipcMain.handle('audio-processor-initialize', async (event, progressCallback) => {
  safeInfo('🎵 IPC: audio-processor-initialize');
  
  try {
    if (!nativeAudioProcessor) {
      safeDebug('🔄 新しいNativeAudioProcessorインスタンスを作成');
      nativeAudioProcessor = new NativeAudioProcessor();
    }
    
    await nativeAudioProcessor.initialize((progress) => {
      safeDebug('📊 進捗通知:', progress.currentTask);
      event.sender.send('audio-processor-progress', progress);
    });
    
    safeInfo('✅ IPC: audio-processor-initialize 成功');
    return { success: true };
  } catch (error) {
    safeError('❌ IPC: audio-processor-initialize エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '初期化エラー';
    return { success: false, error: errorMessage };
  }
});

// 大容量音声ファイルの処理
ipcMain.handle('audio-processor-process-file', async (event, filePath, segmentDuration = 600) => {
  safeInfo('🎵 IPC: audio-processor-process-file', { filePath, segmentDuration });
  
  if (!nativeAudioProcessor) {
    safeError('❌ 音声処理システムが初期化されていません');
    return { success: false, error: '音声処理システムが初期化されていません' };
  }
  
  try {
    const segments = await nativeAudioProcessor.processLargeAudioFile(
      filePath,
      segmentDuration,
      (progress) => {
        safeDebug('📊 処理進捗:', progress.currentTask);
        event.sender.send('audio-processor-progress', progress);
      }
    );
    
    safeInfo(`✅ 音声処理完了: ${segments.length}個のセグメント`);
    
    // ファイルパスを直接送信（メモリ効率化）
    const segmentPaths = segments.map(segment => ({
      filePath: segment.filePath,
      name: segment.name,
      duration: segment.duration,
      startTime: segment.startTime,
      endTime: segment.endTime,
    }));
    
    safeInfo('✅ IPC: audio-processor-process-file 成功');
    return { success: true, segments: segmentPaths };
  } catch (error) {
    safeError('❌ IPC: audio-processor-process-file エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '処理エラー';
    return { success: false, error: errorMessage };
  }
});

// 音声の長さを取得
ipcMain.handle('audio-processor-get-duration', async (event, blobData, blobType) => {
  if (!nativeAudioProcessor) {
    return { success: false, error: '音声処理システムが初期化されていません' };
  }
  
  try {
    const blob = new Blob([Buffer.from(blobData, 'base64')], { type: blobType });
    const duration = await nativeAudioProcessor.getAudioDurationFromBlob(blob);
    return { success: true, duration };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '長さ取得エラー' };
  }
});

// セグメントファイルの読み込み（メモリ効率化）
ipcMain.handle('audio-processor-read-segment-file', async (event, filePath) => {
  safeDebug('📁 IPC: audio-processor-read-segment-file', { filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`セグメントファイルが見つかりません: ${filePath}`);
    }

    const fileData = await fs.promises.readFile(filePath);
    const base64Data = fileData.toString('base64');
    
    safeDebug('✅ IPC: audio-processor-read-segment-file 成功');
    return { success: true, data: base64Data };
  } catch (error) {
    safeError('❌ IPC: audio-processor-read-segment-file エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'ファイル読み込みエラー';
    return { success: false, error: errorMessage };
  }
});

// クリーンアップ
ipcMain.handle('audio-processor-cleanup', async () => {
  if (nativeAudioProcessor) {
    try {
      await nativeAudioProcessor.cleanup();
      nativeAudioProcessor = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'クリーンアップエラー' };
    }
  }
  return { success: true };
});

// 一時ファイルの保存
ipcMain.handle('audio-processor-save-temp-file', async (event, fileName, arrayBufferData) => {
  safeDebug('💾 IPC: audio-processor-save-temp-file', { fileName, dataSize: arrayBufferData.byteLength });
  
  try {
    // 一時ディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'minutes-gen-audio');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // 一時ファイルパスを生成
    const tempPath = path.join(tempDir, `${Date.now()}-${fileName}`);
    
    // ArrayBufferをBufferに変換してファイルに保存
    const buffer = Buffer.from(arrayBufferData);
    await fs.promises.writeFile(tempPath, buffer);
    
    safeDebug('✅ IPC: audio-processor-save-temp-file 成功', { tempPath });
    return { success: true, tempPath };
  } catch (error) {
    safeError('❌ IPC: audio-processor-save-temp-file エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '一時ファイル保存エラー';
    return { success: false, error: errorMessage };
  }
});

// **戦略C: ファイル安全保存（ArrayBufferサイズ制限を回避）**
ipcMain.handle('audio-processor-save-file-to-temp', async (event, fileName, arrayBufferData) => {
  safeDebug('💾 戦略C: ファイル安全保存開始', { fileName, dataSize: arrayBufferData.byteLength });
  
  try {
    // 安全な一時ディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'minutes-gen-audio');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // ユニークなファイルパスを生成（重複回避）
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(tempDir, `${timestamp}-${randomId}-${safeFileName}`);
    
    // ArrayBufferをBufferに変換してファイルに保存
    const buffer = Buffer.from(arrayBufferData);
    await fs.promises.writeFile(tempPath, buffer);
    
    // ファイル保存確認
    const stats = await fs.promises.stat(tempPath);
    safeDebug('✅ 戦略C: ファイル保存成功', { 
      tempPath, 
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      originalSize: `${(arrayBufferData.byteLength / 1024 / 1024).toFixed(2)}MB`
    });
    
    return { success: true, tempPath, fileSize: stats.size };
  } catch (error) {
    safeError('❌ 戦略C: ファイル保存エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'ファイル保存に失敗しました';
    return { success: false, error: errorMessage };
  }
});

// **戦略C: ファイルパス指定処理（IPC制限回避）**
ipcMain.handle('audio-processor-process-file-by-path', async (event, filePath, segmentDuration = 600) => {
  safeDebug('🎵 戦略C: ファイルパス指定処理開始', { filePath, segmentDuration });
  
  try {
    // ファイル存在確認（早期エラー検出）
    if (!fs.existsSync(filePath)) {
      const error = `指定されたファイルが見つかりません: ${filePath}`;
      safeError('❌ ファイル存在確認失敗:', error);
      return { success: false, error };
    }
    
    // ファイルアクセス権限確認
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (accessError) {
      const error = `ファイルにアクセスできません: ${filePath}`;
      safeError('❌ ファイルアクセス権限エラー:', accessError);
      return { success: false, error };
    }
    
    // ファイル情報取得
    const stats = await fs.promises.stat(filePath);
    safeDebug('📊 ファイル情報確認', {
      filePath,
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      lastModified: stats.mtime
    });
    
    // NativeAudioProcessorに委譲
    if (!nativeAudioProcessor) {
      const error = '音声処理システムが初期化されていません';
      safeError('❌ NativeAudioProcessor未初期化:', error);
      return { success: false, error };
    }
    
    // ファイルパス指定でAudio処理を実行
    const result = await nativeAudioProcessor.processLargeAudioFile(filePath, segmentDuration);
    
    safeDebug('✅ 戦略C: ファイルパス指定処理成功', {
      filePath,
      segmentCount: result.length,
      processingMode: 'file-path-based'
    });
    
    return { 
      success: true, 
      segments: result,
      processingMode: 'file-path-based',
      fileSize: stats.size
    };
    
  } catch (error) {
    safeError('❌ 戦略C: ファイルパス指定処理エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'ファイル処理に失敗しました';
    return { success: false, error: errorMessage };
  }
});

// アプリ終了時のクリーンアップ
app.on('before-quit', async () => {
  if (nativeAudioProcessor) {
    await nativeAudioProcessor.cleanup();
  }
}); 

// **戦略C: チャンク転送システム（大容量ファイルIPC制限回避）**
const chunkedUploadSessions = new Map<string, {
  sessionId: string;
  fileName: string;
  fileSize: number;
  tempPath: string;
  tempDir: string;
  chunks: Map<number, string>;
  expectedChunks: number;
  startTime: number;
}>();

// チャンク転送セッション開始
ipcMain.handle('audio-processor-start-chunked-upload', async (event, fileName, fileSize) => {
  safeDebug('🚀 戦略C: チャンク転送セッション開始', { fileName, fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB` });
  
  try {
    // セッションIDを生成
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // 一時ディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'minutes-gen-audio', sessionId);
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // 最終ファイルパスを生成
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(tempDir, `final-${safeFileName}`);
    
    // チャンク数を計算（50MBチャンク）
    const chunkSize = 50 * 1024 * 1024;
    const expectedChunks = Math.ceil(fileSize / chunkSize);
    
    // セッション情報を保存
    chunkedUploadSessions.set(sessionId, {
      sessionId,
      fileName,
      fileSize,
      tempPath,
      tempDir,
      chunks: new Map(),
      expectedChunks,
      startTime: Date.now()
    });
    
    safeDebug('✅ 戦略C: チャンク転送セッション作成完了', {
      sessionId,
      tempDir,
      expectedChunks
    });
    
    return { success: true, sessionId };
    
  } catch (error) {
    safeError('❌ 戦略C: チャンク転送セッション開始エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'セッション開始に失敗しました';
    return { success: false, error: errorMessage };
  }
});

// チャンクアップロード
ipcMain.handle('audio-processor-upload-chunk', async (event, sessionId, chunkIndex, chunkBuffer) => {
  safeDebug('📤 戦略C: チャンクアップロード', { 
    sessionId, 
    chunkIndex, 
    chunkSize: `${(chunkBuffer.byteLength / 1024 / 1024).toFixed(2)}MB` 
  });
  
  try {
    // セッション確認
    const session = chunkedUploadSessions.get(sessionId);
    if (!session) {
      throw new Error(`セッションが見つかりません: ${sessionId}`);
    }
    
    // チャンクファイルとして保存
    const chunkPath = path.join(session.tempDir, `chunk-${chunkIndex.toString().padStart(6, '0')}`);
    const buffer = Buffer.from(chunkBuffer);
    await fs.promises.writeFile(chunkPath, buffer);
    
    // チャンク情報を記録
    session.chunks.set(chunkIndex, chunkPath);
    
    safeDebug('✅ 戦略C: チャンク保存完了', {
      sessionId,
      chunkIndex,
      chunkPath,
      receivedChunks: session.chunks.size,
      expectedChunks: session.expectedChunks
    });
    
    return { success: true };
    
  } catch (error) {
    safeError('❌ 戦略C: チャンクアップロードエラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'チャンクアップロードに失敗しました';
    return { success: false, error: errorMessage };
  }
});

// チャンク転送完了・結合
ipcMain.handle('audio-processor-finalize-chunked-upload', async (event, sessionId) => {
  safeDebug('🔧 戦略C: チャンク結合開始', { sessionId });
  
  try {
    // セッション確認
    const session = chunkedUploadSessions.get(sessionId);
    if (!session) {
      throw new Error(`セッションが見つかりません: ${sessionId}`);
    }
    
    // 全チャンクが到着したか確認
    if (session.chunks.size !== session.expectedChunks) {
      throw new Error(`チャンク不足: ${session.chunks.size}/${session.expectedChunks}`);
    }
    
    // チャンクを順番に結合
    const writeStream = fs.createWriteStream(session.tempPath);
    
    for (let i = 0; i < session.expectedChunks; i++) {
      const chunkPath = session.chunks.get(i);
      if (!chunkPath) {
        throw new Error(`チャンク ${i} が見つかりません`);
      }
      
      const chunkData = await fs.promises.readFile(chunkPath);
      writeStream.write(chunkData);
      
      // チャンクファイルを削除（メモリ節約）
      await fs.promises.unlink(chunkPath).catch(() => {});
    }
    
    writeStream.end();
    
    // ファイル結合完了を待機
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
    
    // ファイル確認
    const stats = await fs.promises.stat(session.tempPath);
    const processingTime = Date.now() - session.startTime;
    
    safeDebug('✅ 戦略C: チャンク結合完了', {
      sessionId,
      finalPath: session.tempPath,
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      expectedSize: `${(session.fileSize / 1024 / 1024).toFixed(2)}MB`,
      processingTime: `${processingTime}ms`,
      chunksProcessed: session.expectedChunks
    });
    
    // セッション情報をクリーンアップ（セッションIDは保持）
    chunkedUploadSessions.delete(sessionId);
    
    return { 
      success: true, 
      tempPath: session.tempPath,
      fileSize: stats.size,
      processingTime
    };
    
  } catch (error) {
    safeError('❌ 戦略C: チャンク結合エラー:', error);
    
    // エラー時のクリーンアップ
    const session = chunkedUploadSessions.get(sessionId);
    if (session) {
      await fs.promises.rm(session.tempDir, { recursive: true, force: true }).catch(() => {});
      chunkedUploadSessions.delete(sessionId);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'チャンク結合に失敗しました';
    return { success: false, error: errorMessage };
  }
});

// チャンク転送クリーンアップ
ipcMain.handle('audio-processor-cleanup-chunked-upload', async (event, sessionId) => {
  safeDebug('🧹 戦略C: チャンク転送クリーンアップ', { sessionId });
  
  try {
    const session = chunkedUploadSessions.get(sessionId);
    if (session) {
      // 一時ディレクトリを削除
      await fs.promises.rm(session.tempDir, { recursive: true, force: true });
      
      // セッション情報を削除
      chunkedUploadSessions.delete(sessionId);
      
      safeDebug('✅ 戦略C: クリーンアップ完了', { sessionId });
    }
    
    return { success: true };
    
  } catch (error) {
    safeWarn('⚠️ 戦略C: クリーンアップ警告:', error);
    // クリーンアップはベストエフォートなので、エラーでも成功を返す
    return { success: true };
  }
}); 