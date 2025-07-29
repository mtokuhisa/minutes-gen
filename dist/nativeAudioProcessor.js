"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeAudioProcessor = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const electron_1 = require("electron");
const safeLogger_1 = require("./safeLogger");
// **固定配置システム対応のFFmpeg/FFprobeパス取得関数**
function getFFmpegPaths(ffmpegBinaryManager) {
    let ffmpegPath;
    let ffprobePath;
    // 固定配置システムが利用可能な場合は固定パスを使用
    if (ffmpegBinaryManager) {
        ffmpegPath = ffmpegBinaryManager.getFixedFFmpegPath();
        ffprobePath = ffmpegBinaryManager.getFixedFFprobePath();
        (0, safeLogger_1.safeDebug)('🔗 FFmpeg固定配置パス使用:', { ffmpegPath, ffprobePath });
        return { ffmpegPath, ffprobePath };
    }
    // フォールバック: 従来の動的パス解決
    (0, safeLogger_1.safeWarn)('⚠️ FFmpeg固定配置システム未利用 - フォールバックモード');
    if (electron_1.app.isPackaged) {
        // パッケージ化されたアプリの場合は app.asar.unpacked を使用
        const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'resources');
        const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
        if (process.platform === 'win32') {
            // Windows用パス - 実際は拡張子なしで配置される
            ffmpegPath = path.join(unpackedPath, 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'win32', 'ia32', 'ffprobe.exe');
        }
        else if (process.platform === 'darwin') {
            // macOS用パス
            ffmpegPath = path.join(unpackedPath, 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
            // x64の代替パス
            if (!fs.existsSync(ffprobePath)) {
                ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'darwin', 'x64', 'ffprobe');
            }
        }
        else {
            // Linux用パス
            ffmpegPath = path.join(unpackedPath, 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(unpackedPath, 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
        }
    }
    else {
        // 開発環境の場合は直接node_modulesを参照
        const nodeModulesPath = path.join(__dirname, '..', '..', 'node_modules');
        if (process.platform === 'win32') {
            // Windows開発環境 - 開発時は.exe拡張子が存在する可能性
            ffmpegPath = path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg.exe');
            if (!fs.existsSync(ffmpegPath)) {
                ffmpegPath = path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg');
            }
            ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'win32', 'ia32', 'ffprobe.exe');
        }
        else if (process.platform === 'darwin') {
            ffmpegPath = path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
            if (!fs.existsSync(ffprobePath)) {
                ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'darwin', 'x64', 'ffprobe');
            }
        }
        else {
            ffmpegPath = path.join(nodeModulesPath, 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(nodeModulesPath, 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
        }
    }
    (0, safeLogger_1.safeDebug)('🔧 FFmpegフォールバックパス:', { ffmpegPath, ffprobePath });
    return { ffmpegPath, ffprobePath };
}
class NativeAudioProcessor {
    constructor(ffmpegBinaryManager) {
        this.isInitialized = false;
        this.MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MBに戻す
        this.OVERLAP_SECONDS = 5; // 5秒のオーバーラップ
        this.tempDir = path.join(os.tmpdir(), 'minutes-gen-audio');
        this.ffmpegBinaryManager = ffmpegBinaryManager;
        (0, safeLogger_1.safeDebug)('🎵 NativeAudioProcessor constructor', {
            tempDir: this.tempDir,
            hasFixedBinaryManager: !!ffmpegBinaryManager
        });
    }
    /**
     * ネイティブFFmpegを初期化
     */
    async initialize(onProgress) {
        (0, safeLogger_1.safeInfo)('🚀 NativeAudioProcessor.initialize() 開始');
        if (this.isInitialized) {
            (0, safeLogger_1.safeDebug)('✅ 既に初期化済み');
            return;
        }
        onProgress?.({
            stage: 'transcribing',
            percentage: 5,
            currentTask: '🎵 音声処理システムを準備中...',
            estimatedTimeRemaining: 0,
            logs: [{
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    level: 'info',
                    message: 'ネイティブ音声処理システムの初期化を開始します。'
                }],
            startedAt: new Date(),
        });
        try {
            // 一時ディレクトリの作成
            (0, safeLogger_1.safeDebug)('📁 一時ディレクトリ作成:', this.tempDir);
            await fs.promises.mkdir(this.tempDir, { recursive: true });
            // **固定配置システム対応のFFmpegパス設定**
            const { ffmpegPath, ffprobePath } = getFFmpegPaths(this.ffmpegBinaryManager);
            (0, safeLogger_1.safeDebug)('🔧 FFmpegパス設定:', { ffmpegPath, ffprobePath });
            // fluent-ffmpegにパスを設定
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
            fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
            // FFmpegの動作確認
            await this.testFFmpeg();
            this.isInitialized = true;
            onProgress?.({
                stage: 'transcribing',
                percentage: 10,
                currentTask: '✅ 音声処理システムの準備完了',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'success',
                        message: '音声処理システムが正常に初期化されました。'
                    }],
                startedAt: new Date(),
            });
            (0, safeLogger_1.safeInfo)('✅ NativeAudioProcessor初期化完了');
        }
        catch (error) {
            (0, safeLogger_1.safeError)('❌ NativeAudioProcessor初期化エラー:', error);
            onProgress?.({
                stage: 'error',
                percentage: 0,
                currentTask: '❌ 音声処理システムの初期化に失敗',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'error',
                        message: `音声処理システムの初期化に失敗しました: ${error instanceof Error ? error.message : 'unknown error'}`
                    }],
                startedAt: new Date(),
            });
            throw new Error(`ネイティブ音声処理システムの初期化に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    /**
     * FFmpeg動作確認（固定配置システム対応版）
     */
    async testFFmpeg() {
        (0, safeLogger_1.safeDebug)('🔍 FFmpeg動作確認を開始（固定配置システム対応）');
        // **固定配置システム対応のFFmpegPath取得**
        const { ffmpegPath } = getFFmpegPaths(this.ffmpegBinaryManager);
        if (!ffmpegPath) {
            throw new Error('FFmpegの実行ファイルが見つかりません');
        }
        (0, safeLogger_1.safeDebug)('✅ FFmpegパス確認完了:', ffmpegPath);
        // 固定配置システム使用時は直接実行テスト
        if (this.ffmpegBinaryManager) {
            (0, safeLogger_1.safeDebug)('🔗 固定配置システム使用: 直接実行テスト');
            return this.testFFmpegDirect(ffmpegPath);
        }
        // フォールバック: 従来の複数戦略テスト
        (0, safeLogger_1.safeWarn)('⚠️ フォールバックモード: 複数戦略テスト実行');
        // Windows環境では存在確認をスキップし、直接spawn実行でテスト
        if (process.platform !== 'win32') {
            // macOS/Linux環境のみファイル存在確認を実行
            try {
                await fs.promises.access(ffmpegPath, fs.constants.F_OK | fs.constants.X_OK);
                (0, safeLogger_1.safeDebug)('✅ FFmpegバイナリアクセス確認完了:', ffmpegPath);
            }
            catch (error) {
                (0, safeLogger_1.safeError)('❌ FFmpegバイナリアクセスエラー:', error);
                throw new Error(`FFmpegバイナリにアクセスできません: ${ffmpegPath}`);
            }
        }
        else {
            (0, safeLogger_1.safeDebug)('🪟 Windows環境: 戦略B第2段階を実行');
            // Windows固有の詳細権限診断
            try {
                const stats = await fs.promises.stat(ffmpegPath);
                (0, safeLogger_1.safeDebug)('📊 FFmpegファイル詳細:', {
                    サイズ: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
                    作成日時: stats.birthtime,
                    変更日時: stats.mtime,
                    権限: stats.mode.toString(8),
                    実行可能: !!(stats.mode & fs.constants.S_IXUSR)
                });
            }
            catch (error) {
                (0, safeLogger_1.safeWarn)('⚠️ ファイル詳細取得に失敗:', error);
            }
        }
        // 戦略B第2段階: 複数の実行方法を試行
        return this.tryMultipleExecutionStrategies(ffmpegPath);
    }
    /**
     * 固定配置システム用の直接実行テスト
     */
    async testFFmpegDirect(ffmpegPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const spawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32',
                windowsHide: true,
            };
            (0, safeLogger_1.safeDebug)('🚀 FFmpeg固定配置実行テスト:', { ffmpegPath, spawnOptions });
            const ffmpegProcess = spawn(ffmpegPath, ['-version'], spawnOptions);
            let outputReceived = false;
            ffmpegProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('ffmpeg version')) {
                    outputReceived = true;
                    (0, safeLogger_1.safeDebug)('✅ FFmpeg固定配置実行確認成功:', output.split('\n')[0]);
                }
            });
            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('ffmpeg version')) {
                    outputReceived = true;
                    (0, safeLogger_1.safeDebug)('✅ FFmpeg固定配置実行確認成功 (stderr):', output.split('\n')[0]);
                }
            });
            ffmpegProcess.on('close', (code) => {
                if (code === 0 && outputReceived) {
                    (0, safeLogger_1.safeDebug)('✅ FFmpeg固定配置動作確認完了');
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg動作確認失敗 (exit code: ${code})`));
                }
            });
            ffmpegProcess.on('error', (error) => {
                (0, safeLogger_1.safeError)('❌ FFmpeg固定配置実行エラー:', error);
                reject(new Error(`FFmpeg実行エラー: ${error.message}`));
            });
            setTimeout(() => {
                ffmpegProcess.kill();
                reject(new Error('FFmpeg動作確認タイムアウト'));
            }, 10000);
        });
    }
    /**
     * 複数の実行戦略を試行（戦略B第2段階）
     */
    async tryMultipleExecutionStrategies(ffmpegPath) {
        const strategies = [
            {
                name: '戦略B-1: 引用符付きshell実行',
                execute: () => this.testFFmpegWithQuotedPath(ffmpegPath)
            },
            {
                name: '戦略B-2: 安全ディレクトリコピー実行',
                execute: () => this.testFFmpegWithSafeCopy(ffmpegPath)
            },
            {
                name: '戦略B-3: PowerShell実行',
                execute: () => this.testFFmpegWithPowerShell(ffmpegPath)
            }
        ];
        let lastError = null;
        for (const strategy of strategies) {
            try {
                (0, safeLogger_1.safeDebug)(`🚀 ${strategy.name}を試行中...`);
                await strategy.execute();
                (0, safeLogger_1.safeDebug)(`✅ ${strategy.name}が成功しました`);
                return; // 成功したら終了
            }
            catch (error) {
                (0, safeLogger_1.safeWarn)(`❌ ${strategy.name}が失敗:`, error);
                lastError = error;
                continue; // 次の戦略を試行
            }
        }
        // すべての戦略が失敗した場合
        throw new Error(`全ての実行戦略が失敗しました。最後のエラー: ${lastError?.message}`);
    }
    /**
     * 戦略B-1: 引用符付きパスでのshell実行
     */
    async testFFmpegWithQuotedPath(ffmpegPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const spawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true, // 常にshell実行
                windowsHide: true,
            };
            // 引用符でパスを囲む
            const quotedPath = `"${ffmpegPath}"`;
            (0, safeLogger_1.safeDebug)('🔧 引用符付きパス実行:', quotedPath);
            const ffmpegProcess = spawn(quotedPath, ['-version'], spawnOptions);
            let stdout = '';
            let stderr = '';
            ffmpegProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            ffmpegProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    (0, safeLogger_1.safeDebug)('✅ 戦略B-1: 引用符付き実行成功');
                    resolve();
                }
                else {
                    reject(new Error(`引用符付き実行失敗 (code: ${code}): ${stderr}`));
                }
            });
            ffmpegProcess.on('error', (error) => {
                reject(new Error(`引用符付き実行エラー: ${error.message}`));
            });
            setTimeout(() => {
                ffmpegProcess.kill('SIGTERM');
                reject(new Error('引用符付き実行タイムアウト'));
            }, 10000);
        });
    }
    /**
     * 戦略B-2: 安全なディレクトリにコピーして実行
     */
    async testFFmpegWithSafeCopy(ffmpegPath) {
        const os = require('os');
        const path = require('path');
        // ユーザーディレクトリの安全な場所を使用
        const safeDir = path.join(os.homedir(), '.minutes-gen-temp');
        const safePath = path.join(safeDir, 'ffmpeg.exe');
        try {
            // 安全ディレクトリを作成
            if (!fs.existsSync(safeDir)) {
                await fs.promises.mkdir(safeDir, { recursive: true });
                (0, safeLogger_1.safeDebug)('📁 安全ディレクトリを作成:', safeDir);
            }
            // FFmpegバイナリをコピー
            await fs.promises.copyFile(ffmpegPath, safePath);
            (0, safeLogger_1.safeDebug)('📋 FFmpegバイナリをコピー完了:', safePath);
            // コピーしたバイナリで実行テスト
            return new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                const spawnOptions = {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: true,
                    windowsHide: true,
                };
                const ffmpegProcess = spawn(`"${safePath}"`, ['-version'], spawnOptions);
                let stdout = '';
                let stderr = '';
                ffmpegProcess.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });
                ffmpegProcess.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
                ffmpegProcess.on('close', (code) => {
                    // クリーンアップ
                    fs.promises.unlink(safePath).catch(() => { });
                    if (code === 0) {
                        (0, safeLogger_1.safeDebug)('✅ 戦略B-2: 安全ディレクトリ実行成功');
                        resolve();
                    }
                    else {
                        reject(new Error(`安全ディレクトリ実行失敗 (code: ${code}): ${stderr}`));
                    }
                });
                ffmpegProcess.on('error', (error) => {
                    // クリーンアップ
                    fs.promises.unlink(safePath).catch(() => { });
                    reject(new Error(`安全ディレクトリ実行エラー: ${error.message}`));
                });
                setTimeout(() => {
                    ffmpegProcess.kill('SIGTERM');
                    fs.promises.unlink(safePath).catch(() => { });
                    reject(new Error('安全ディレクトリ実行タイムアウト'));
                }, 10000);
            });
        }
        catch (error) {
            // クリーンアップ
            if (fs.existsSync(safePath)) {
                await fs.promises.unlink(safePath).catch(() => { });
            }
            throw new Error(`安全ディレクトリ準備エラー: ${error.message}`);
        }
    }
    /**
     * 戦略B-3: PowerShell経由での実行
     */
    async testFFmpegWithPowerShell(ffmpegPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            // PowerShellコマンドを構築
            const psCommand = `& "${ffmpegPath}" -version`;
            const spawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
            };
            (0, safeLogger_1.safeDebug)('🔧 PowerShell実行:', psCommand);
            const psProcess = spawn('powershell.exe', ['-Command', psCommand], spawnOptions);
            let stdout = '';
            let stderr = '';
            psProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            psProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            psProcess.on('close', (code) => {
                if (code === 0) {
                    (0, safeLogger_1.safeDebug)('✅ 戦略B-3: PowerShell実行成功');
                    resolve();
                }
                else {
                    reject(new Error(`PowerShell実行失敗 (code: ${code}): ${stderr}`));
                }
            });
            psProcess.on('error', (error) => {
                reject(new Error(`PowerShell実行エラー: ${error.message}`));
            });
            setTimeout(() => {
                psProcess.kill('SIGTERM');
                reject(new Error('PowerShell実行タイムアウト'));
            }, 10000);
        });
    }
    /**
     * 大容量音声ファイルを適切なセグメントに分割
     */
    async processLargeAudioFile(inputPath, segmentDurationSeconds = 600, onProgress) {
        await this.initialize(onProgress);
        try {
            // fluent-ffmpegライブラリに確実にFFmpegパスを設定
            const { ffmpegPath } = getFFmpegPaths(this.ffmpegBinaryManager);
            if (ffmpegPath) {
                (0, safeLogger_1.safeDebug)('🔧 processLargeAudioFileでFFmpegパスを設定:', ffmpegPath);
                fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
            }
            onProgress?.({
                stage: 'transcribing',
                percentage: 20,
                currentTask: '📊 音声ファイルを分析中...',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'info',
                        message: '音声ファイルを分析中...'
                    }],
                startedAt: new Date(),
            });
            (0, safeLogger_1.safeInfo)('🎵 音声ファイル分析開始:', inputPath);
            // 音声ファイルのメタデータを取得
            const audioInfo = await this.getAudioInfo(inputPath);
            (0, safeLogger_1.safeDebug)('📋 音声ファイル情報:', audioInfo);
            const totalDuration = audioInfo.duration;
            const segmentCount = Math.ceil(totalDuration / segmentDurationSeconds);
            (0, safeLogger_1.safeInfo)(`🔢 総再生時間: ${totalDuration}秒, セグメント数: ${segmentCount}`);
            onProgress?.({
                stage: 'transcribing',
                percentage: 30,
                currentTask: `📊 ${segmentCount}個のセグメントに分割中...`,
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'info',
                        message: `音声ファイルを${segmentCount}個のセグメントに分割します。`
                    }],
                startedAt: new Date(),
            });
            // セグメント生成
            const audioSegments = [];
            for (let i = 0; i < segmentCount; i++) {
                const startTime = i * segmentDurationSeconds;
                const endTime = Math.min((i + 1) * segmentDurationSeconds, totalDuration);
                const actualDuration = endTime - startTime;
                if (actualDuration <= 0) {
                    (0, safeLogger_1.safeWarn)(`⚠️ セグメント ${i + 1} の再生時間が0以下です。スキップします。`);
                    continue;
                }
                const segmentFileName = `segment_${i + 1}_${Date.now()}.wav`;
                const segmentPath = path.join(this.tempDir, segmentFileName);
                (0, safeLogger_1.safeDebug)(`🎵 セグメント ${i + 1}/${segmentCount} 生成中: ${startTime}s - ${endTime}s`);
                // 進捗更新
                const segmentProgress = 30 + (i / segmentCount) * 40;
                onProgress?.({
                    stage: 'transcribing',
                    percentage: segmentProgress,
                    currentTask: `🎵 大きいファイルを分割中...${i + 1}/${segmentCount}`,
                    estimatedTimeRemaining: ((segmentCount - i) * 2),
                    logs: [{
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'info',
                            message: `セグメント ${i + 1}/${segmentCount} を生成しています...`
                        }],
                    startedAt: new Date(),
                });
                // セグメントの生成
                await this.extractAudioSegment(inputPath, segmentPath, startTime, actualDuration);
                audioSegments.push({
                    filePath: segmentPath,
                    name: segmentFileName,
                    duration: actualDuration,
                    startTime: startTime,
                    endTime: endTime
                });
                (0, safeLogger_1.safeDebug)(`✅ セグメント ${i + 1} 完了: ${segmentPath}`);
            }
            (0, safeLogger_1.safeInfo)(`🎉 音声分割完了: ${audioSegments.length}個のセグメント`);
            onProgress?.({
                stage: 'transcribing',
                percentage: 70,
                currentTask: '✅ 音声分割完了',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'success',
                        message: `音声ファイルを${audioSegments.length}個のセグメントに分割しました。`
                    }],
                startedAt: new Date(),
            });
            return audioSegments;
        }
        catch (error) {
            (0, safeLogger_1.safeError)('❌ 大容量音声ファイル処理エラー:', error);
            onProgress?.({
                stage: 'transcribing',
                percentage: 0,
                currentTask: '❌ 音声処理エラー',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'error',
                        message: `音声処理でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
                    }],
                startedAt: new Date(),
            });
            throw error;
        }
    }
    /**
     * 音声を圧縮
     */
    async compressAudio(inputPath, onProgress) {
        const outputPath = path.join(this.tempDir, 'compressed_audio.mp3');
        onProgress?.({
            stage: 'transcribing',
            percentage: 30,
            currentTask: '🗜️ 音声を圧縮中...',
            estimatedTimeRemaining: 0,
            logs: [{
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    level: 'info',
                    message: '音声圧縮を開始します...'
                }],
            startedAt: new Date(),
        });
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .audioCodec('libmp3lame') // 正しいMP3エンコーダー指定
                .audioBitrate('128k')
                .audioFrequency(44100)
                .audioChannels(1)
                .format('mp3') // MP3ファイルとして出力
                .output(outputPath)
                .on('progress', (progressData) => {
                // FFmpegの詳細な進捗情報を取得
                const currentPercent = Math.min(35, 30 + Math.round((progressData.percent || 0) * 0.1));
                onProgress?.({
                    stage: 'transcribing',
                    percentage: currentPercent,
                    currentTask: '🗜️ 音声を圧縮中...',
                    estimatedTimeRemaining: 0,
                    logs: [{
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'info',
                            message: `音声圧縮: ${progressData.timemark || '不明'} 処理済み (${progressData.currentFps?.toFixed(1) || '不明'}fps, ${progressData.currentKbps?.toFixed(0) || '不明'}kbps)`
                        }],
                    startedAt: new Date(),
                    processingDetails: {
                        frames: progressData.frames || 0,
                        currentFps: progressData.currentFps || 0,
                        currentKbps: progressData.currentKbps || 0,
                        targetSize: progressData.targetSize || 0,
                        timemark: progressData.timemark || '0:00:00.00'
                    }
                });
            })
                .on('end', () => {
                onProgress?.({
                    stage: 'transcribing',
                    percentage: 40,
                    currentTask: '🗜️ 音声圧縮完了',
                    estimatedTimeRemaining: 0,
                    logs: [{
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'success',
                            message: '音声圧縮が完了しました。'
                        }],
                    startedAt: new Date(),
                });
                resolve(outputPath);
            })
                .on('error', (error) => {
                reject(new Error(`音声圧縮エラー: ${error.message}`));
            })
                .run();
        });
    }
    /**
     * 音声ファイルの情報を取得
     */
    async getAudioInfo(filePath) {
        // FFmpeg/FFprobeパスを確実に設定
        const { ffmpegPath, ffprobePath } = getFFmpegPaths(this.ffmpegBinaryManager);
        if (ffmpegPath) {
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
        }
        if (ffprobePath) {
            fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
        }
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(new Error(`音声情報取得エラー: ${err.message}`));
                }
                else {
                    resolve({
                        duration: metadata.format.duration || 0,
                        format: metadata.format
                    });
                }
            });
        });
    }
    /**
     * 音声セグメントを抽出
     */
    async extractAudioSegment(inputPath, outputPath, startTime, duration) {
        // FFmpeg/FFprobeパスを確実に設定
        const { ffmpegPath, ffprobePath } = getFFmpegPaths(this.ffmpegBinaryManager);
        if (ffmpegPath) {
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
        }
        if (ffprobePath) {
            fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
        }
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .seekInput(startTime)
                .duration(duration)
                .audioCodec('pcm_s16le')
                .audioFrequency(44100)
                .audioChannels(1)
                .format('wav')
                .output(outputPath)
                .on('end', () => {
                (0, safeLogger_1.safeDebug)(`✅ セグメント抽出完了: ${outputPath}`);
                resolve();
            })
                .on('error', (error) => {
                (0, safeLogger_1.safeError)(`❌ セグメント抽出エラー: ${error.message}`);
                reject(new Error(`セグメント抽出エラー: ${error.message}`));
            })
                .run();
        });
    }
    /**
     * 音声の長さを取得
     */
    async getAudioDuration(filePath) {
        const { ffmpegPath } = getFFmpegPaths(this.ffmpegBinaryManager);
        if (!ffmpegPath) {
            throw new Error('FFmpegパスが設定されていません');
        }
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(new Error(`音声長さ取得エラー: ${err.message}`));
                }
                else {
                    resolve(metadata.format.duration || 0);
                }
            });
        });
    }
    /**
     * セグメント境界を計算
     */
    calculateSegments(totalDuration, segmentDuration) {
        const segments = [];
        let currentStart = 0;
        while (currentStart < totalDuration) {
            const currentEnd = Math.min(currentStart + segmentDuration, totalDuration);
            segments.push({
                start: currentStart,
                end: currentEnd,
                overlapStart: currentStart > 0 ? currentStart - this.OVERLAP_SECONDS : currentStart,
                overlapEnd: currentEnd < totalDuration ? currentEnd + this.OVERLAP_SECONDS : currentEnd,
            });
            currentStart = currentEnd;
        }
        return segments;
    }
    /**
     * セグメントを抽出
     */
    async extractSegment(inputPath, outputPath, segment, onProgress, currentSegmentIndex = 0, totalSegments = 0) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .seekInput(segment.start)
                .duration(segment.end - segment.start)
                .audioCodec('pcm_s16le')
                .audioFrequency(44100)
                .audioChannels(1)
                .format('wav')
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (error) => reject(new Error(`セグメント抽出エラー: ${error.message}`)))
                .on('progress', (progressData) => {
                // FFmpegの詳細な進捗情報を取得
                const currentPercent = Math.min(35, 30 + Math.round((progressData.percent || 0) * 0.1));
                onProgress?.({
                    stage: 'transcribing',
                    percentage: currentPercent,
                    currentTask: `✂️ 音声を${totalSegments}個に分割中 (${currentSegmentIndex}/${totalSegments})`,
                    estimatedTimeRemaining: 0,
                    logs: [{
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'info',
                            message: `セグメント ${currentSegmentIndex}: ${progressData.timemark || '不明'} 処理済み (${progressData.currentFps?.toFixed(1) || '不明'}fps, ${progressData.currentKbps?.toFixed(0) || '不明'}kbps)`
                        }],
                    startedAt: new Date(),
                    processingDetails: {
                        frames: progressData.frames || 0,
                        currentFps: progressData.currentFps || 0,
                        currentKbps: progressData.currentKbps || 0,
                        targetSize: progressData.targetSize || 0,
                        timemark: progressData.timemark || '0:00:00.00'
                    }
                });
            })
                .run();
        });
    }
    /**
     * BlobからAudioを作成して長さを取得
     */
    async getAudioDurationFromBlob(blob) {
        // Main processでは直接的なBlob処理は困難なため、
        // 一時ファイルを通して処理する
        const tempPath = path.join(this.tempDir, 'temp_audio_' + Date.now());
        const buffer = Buffer.from(await blob.arrayBuffer());
        await fs.promises.writeFile(tempPath, buffer);
        try {
            const duration = await this.getAudioDuration(tempPath);
            await fs.promises.unlink(tempPath);
            return duration;
        }
        catch (error) {
            await fs.promises.unlink(tempPath).catch(() => { });
            throw error;
        }
    }
    /**
     * リソースのクリーンアップ
     */
    async cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                await fs.promises.rmdir(this.tempDir, { recursive: true });
            }
            this.isInitialized = false;
            // 強制的にガベージコレクションを実行
            if (global.gc) {
                global.gc();
            }
        }
        catch (error) {
            (0, safeLogger_1.safeWarn)('ネイティブ音声処理システムクリーンアップエラー:', error);
        }
    }
}
exports.NativeAudioProcessor = NativeAudioProcessor;
