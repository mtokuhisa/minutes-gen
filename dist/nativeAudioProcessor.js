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
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const ffprobeStatic = require('ffprobe-static');
const ffprobePath = ffprobeStatic.path;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const electron_1 = require("electron");
// Windows版FFmpegパス修正のためのヘルパー
function getCorrectFFmpegPath() {
    if (!ffmpeg_static_1.default) {
        throw new Error('FFmpegパスが設定されていません');
    }
    // Windows版で拡張子を確認
    if (process.platform === 'win32') {
        // .exeが付いていない場合は追加
        if (!ffmpeg_static_1.default.endsWith('.exe')) {
            const exePath = ffmpeg_static_1.default + '.exe';
            // 開発環境では実際のファイルの存在を確認
            if (!electron_1.app.isPackaged) {
                try {
                    fs.accessSync(exePath, fs.constants.F_OK);
                    console.log('✅ Windows開発環境でFFmpeg.exeバイナリを確認:', exePath);
                    return exePath;
                }
                catch (error) {
                    console.log('⚠️ Windows開発環境でFFmpeg.exeが見つからない、元のパスを使用:', ffmpeg_static_1.default);
                    return ffmpeg_static_1.default;
                }
            }
            return exePath;
        }
    }
    return ffmpeg_static_1.default;
}
class NativeAudioProcessor {
    constructor() {
        this.isInitialized = false;
        this.MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MBに戻す
        this.OVERLAP_SECONDS = 5; // 5秒のオーバーラップ
        this.tempDir = path.join(os.tmpdir(), 'minutes-gen-audio');
        console.log('🎵 NativeAudioProcessor constructor', { tempDir: this.tempDir });
    }
    /**
     * ネイティブFFmpegを初期化
     */
    async initialize(onProgress) {
        console.log('🚀 NativeAudioProcessor.initialize() 開始');
        if (this.isInitialized) {
            console.log('✅ 既に初期化済み');
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
            console.log('📁 一時ディレクトリ作成:', this.tempDir);
            await fs.promises.mkdir(this.tempDir, { recursive: true });
            // FFmpegパスの設定（パッケージ化対応）
            const correctedFFmpegPath = getCorrectFFmpegPath();
            let resolvedFFmpegPath = correctedFFmpegPath;
            let resolvedFFprobePath = ffprobePath;
            if (correctedFFmpegPath) {
                console.log('🔧 初期FFmpegパス:', correctedFFmpegPath);
                console.log('🔧 初期FFprobeパス:', ffprobePath);
                // パッケージ化されたアプリケーションでのパス解決
                if (electron_1.app.isPackaged) {
                    // app.asar.unpacked内のパスを確認
                    const unpackedFFmpegPath = correctedFFmpegPath.replace('app.asar', 'app.asar.unpacked');
                    const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
                    console.log('📦 パッケージ化されたアプリ - unpackedFFmpegパス確認:', unpackedFFmpegPath);
                    console.log('📦 パッケージ化されたアプリ - unpackedFFprobeパス確認:', unpackedFFprobePath);
                    try {
                        await fs.promises.access(unpackedFFmpegPath, fs.constants.F_OK);
                        resolvedFFmpegPath = unpackedFFmpegPath;
                        console.log('✅ unpackedパスでFFmpegバイナリを発見');
                    }
                    catch (error) {
                        console.log('❌ unpackedパスでFFmpegバイナリが見つかりません:', error);
                        // 代替パスを試行
                        const appPath = electron_1.app.getAppPath();
                        let alternativeFFmpegPaths = [];
                        if (process.platform === 'win32') {
                            // Windows版の代替パスをより包括的に検索
                            const basePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');
                            alternativeFFmpegPaths = [
                                path.join(basePath, 'ffmpeg'),
                                path.join(basePath, 'ffmpeg.exe'),
                                path.join(basePath, 'win32', 'ffmpeg'),
                                path.join(basePath, 'win32', 'ffmpeg.exe'),
                                path.join(basePath, 'bin', 'win32', 'ffmpeg'),
                                path.join(basePath, 'bin', 'win32', 'ffmpeg.exe'),
                                path.join(basePath, 'bin', 'win32', 'x64', 'ffmpeg.exe'),
                                path.join(basePath, 'bin', 'win32', 'ia32', 'ffmpeg.exe'),
                                path.join(basePath, 'win32-x64', 'ffmpeg.exe'),
                                path.join(basePath, 'win32-ia32', 'ffmpeg.exe'),
                                // resources フォルダからも探す
                                path.join(electron_1.app.getAppPath(), '..', 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
                                path.join(electron_1.app.getAppPath(), '..', 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
                            ];
                        }
                        else {
                            alternativeFFmpegPaths = [
                                path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
                                path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'darwin', 'ffmpeg'),
                                path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'bin', 'darwin', 'ffmpeg'),
                            ];
                        }
                        let ffmpegFound = false;
                        for (const altPath of alternativeFFmpegPaths) {
                            console.log('🔄 代替FFmpegパスを試行:', altPath);
                            try {
                                await fs.promises.access(altPath, fs.constants.F_OK);
                                resolvedFFmpegPath = altPath;
                                console.log('✅ 代替パスでFFmpegバイナリを発見');
                                ffmpegFound = true;
                                break;
                            }
                            catch (altError) {
                                console.log('❌ 代替パスでFFmpegバイナリが見つかりません:', altPath);
                            }
                        }
                        if (!ffmpegFound) {
                            console.error('❌ 全ての代替パスでFFmpegバイナリが見つかりません');
                            throw new Error(`FFmpegバイナリが見つかりません。パス: ${correctedFFmpegPath}, unpacked: ${unpackedFFmpegPath}, alternatives: ${alternativeFFmpegPaths.join(', ')}`);
                        }
                    }
                    try {
                        await fs.promises.access(unpackedFFprobePath, fs.constants.F_OK);
                        resolvedFFprobePath = unpackedFFprobePath;
                        console.log('✅ unpackedパスでFFprobeバイナリを発見');
                    }
                    catch (error) {
                        console.log('❌ unpackedパスでFFprobeバイナリが見つかりません:', error);
                        // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
                        const appPath = electron_1.app.getAppPath();
                        const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
                        let alternativeFFprobePaths = [];
                        if (process.platform === 'darwin') {
                            alternativeFFprobePaths = [
                                path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
                                path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
                                path.join(ffprobeBasePath, 'ffprobe'),
                            ];
                        }
                        else if (process.platform === 'win32') {
                            alternativeFFprobePaths = [
                                path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
                                path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
                                path.join(ffprobeBasePath, 'ffprobe.exe'),
                            ];
                        }
                        let ffprobeFound = false;
                        for (const altPath of alternativeFFprobePaths) {
                            console.log('🔄 代替FFprobeパスを試行:', altPath);
                            try {
                                await fs.promises.access(altPath, fs.constants.F_OK);
                                resolvedFFprobePath = altPath;
                                console.log('✅ 代替パスでFFprobeバイナリを発見');
                                ffprobeFound = true;
                                break;
                            }
                            catch (altError) {
                                console.log('❌ 代替パスでFFprobeバイナリが見つかりません:', altPath);
                            }
                        }
                        if (!ffprobeFound) {
                            console.error('❌ 全ての代替パスでFFprobeバイナリが見つかりません');
                            throw new Error(`FFprobeバイナリが見つかりません。パス: ${ffprobePath}, unpacked: ${unpackedFFprobePath}, alternatives: ${alternativeFFprobePaths.join(', ')}`);
                        }
                    }
                }
                else {
                    // 開発環境での確認
                    try {
                        await fs.promises.access(correctedFFmpegPath, fs.constants.F_OK);
                        await fs.promises.access(ffprobePath, fs.constants.F_OK);
                        console.log('✅ 開発環境でFFmpeg/FFprobeバイナリを確認');
                    }
                    catch (error) {
                        console.error('❌ 開発環境でFFmpeg/FFprobeバイナリが見つかりません:', error);
                        throw new Error(`FFmpeg/FFprobeバイナリが見つかりません: ffmpeg=${correctedFFmpegPath}, ffprobe=${ffprobePath}`);
                    }
                }
                console.log('🔧 最終的なFFmpegパス:', resolvedFFmpegPath);
                console.log('🔧 最終的なFFprobeパス:', resolvedFFprobePath);
                if (resolvedFFmpegPath) {
                    fluent_ffmpeg_1.default.setFfmpegPath(resolvedFFmpegPath);
                }
                else {
                    throw new Error('FFmpegパスが解決できませんでした');
                }
                if (resolvedFFprobePath) {
                    fluent_ffmpeg_1.default.setFfprobePath(resolvedFFprobePath);
                }
                else {
                    throw new Error('FFprobeパスが解決できませんでした');
                }
            }
            else {
                throw new Error('FFmpegの実行ファイルが見つかりません');
            }
            // FFmpegの動作確認（簡素化版）
            console.log('🔍 FFmpeg動作確認開始');
            await this.testFFmpeg();
            console.log('✅ FFmpeg動作確認完了');
            this.isInitialized = true;
            onProgress?.({
                stage: 'transcribing',
                percentage: 15,
                currentTask: '✅ 音声処理システムの準備完了',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'success',
                        message: 'ネイティブ音声処理システムの初期化が完了しました。'
                    }],
                startedAt: new Date(),
            });
        }
        catch (error) {
            console.error('❌ NativeAudioProcessor初期化エラー:', error);
            onProgress?.({
                stage: 'transcribing',
                percentage: 0,
                currentTask: '❌ 音声処理システムの初期化に失敗',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'error',
                        message: `音声処理システムの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`
                    }],
                startedAt: new Date(),
            });
            throw error;
        }
    }
    /**
     * FFmpegの動作確認（簡素化版）
     */
    async testFFmpeg() {
        console.log('🔍 FFmpeg動作確認を開始');
        // FFmpegPathの存在確認
        if (!ffmpeg_static_1.default) {
            throw new Error('FFmpegの実行ファイルが見つかりません');
        }
        console.log('✅ FFmpegパス確認完了:', ffmpeg_static_1.default);
        // パッケージ化されたアプリケーションでのパス解決
        let testPath = ffmpeg_static_1.default;
        if (electron_1.app.isPackaged) {
            const unpackedPath = ffmpeg_static_1.default.replace('app.asar', 'app.asar.unpacked');
            if (fs.existsSync(unpackedPath)) {
                testPath = unpackedPath;
            }
        }
        // ファイルの存在と実行権限を確認
        try {
            await fs.promises.access(testPath, fs.constants.F_OK | fs.constants.X_OK);
            console.log('✅ FFmpegバイナリアクセス確認完了:', testPath);
        }
        catch (error) {
            console.error('❌ FFmpegバイナリアクセスエラー:', error);
            throw new Error(`FFmpegバイナリにアクセスできません: ${testPath}`);
        }
        // 簡単なバージョンチェック
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const ffmpegProcess = spawn(testPath, ['-version'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            ffmpegProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            ffmpegProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ FFmpegバージョン確認成功');
                    console.log('📋 FFmpeg情報:', stdout.split('\n')[0]);
                    resolve();
                }
                else {
                    console.error('❌ FFmpegバージョン確認失敗:', stderr);
                    reject(new Error(`FFmpegバージョン確認失敗: ${stderr}`));
                }
            });
            ffmpegProcess.on('error', (error) => {
                console.error('❌ FFmpegプロセス起動エラー:', error);
                reject(error);
            });
            // タイムアウトを設定（10秒）
            const timeout = setTimeout(() => {
                ffmpegProcess.kill('SIGTERM');
                console.log('⏰ FFmpegテストタイムアウト');
                reject(new Error('FFmpegテストがタイムアウトしました'));
            }, 10000);
            ffmpegProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }
    /**
     * 大容量音声ファイルを適切なセグメントに分割
     */
    async processLargeAudioFile(inputPath, segmentDurationSeconds = 600, onProgress) {
        await this.initialize(onProgress);
        try {
            // fluent-ffmpegライブラリに確実にFFmpegパスを設定
            let resolvedFFmpegPath = ffmpeg_static_1.default;
            if (electron_1.app.isPackaged && ffmpeg_static_1.default) {
                const unpackedPath = ffmpeg_static_1.default.replace('app.asar', 'app.asar.unpacked');
                if (fs.existsSync(unpackedPath)) {
                    resolvedFFmpegPath = unpackedPath;
                }
            }
            if (resolvedFFmpegPath) {
                console.log('🔧 processLargeAudioFileでFFmpegパスを設定:', resolvedFFmpegPath);
                fluent_ffmpeg_1.default.setFfmpegPath(resolvedFFmpegPath);
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
            console.log('🎵 音声ファイル分析開始:', inputPath);
            // 音声ファイルのメタデータを取得
            const audioInfo = await this.getAudioInfo(inputPath);
            console.log('📋 音声ファイル情報:', audioInfo);
            const totalDuration = audioInfo.duration;
            const segmentCount = Math.ceil(totalDuration / segmentDurationSeconds);
            console.log(`🔢 総再生時間: ${totalDuration}秒, セグメント数: ${segmentCount}`);
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
                    console.warn(`⚠️ セグメント ${i + 1} の再生時間が0以下です。スキップします。`);
                    continue;
                }
                const segmentFileName = `segment_${i + 1}_${Date.now()}.wav`;
                const segmentPath = path.join(this.tempDir, segmentFileName);
                console.log(`🎵 セグメント ${i + 1}/${segmentCount} 生成中: ${startTime}s - ${endTime}s`);
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
                console.log(`✅ セグメント ${i + 1} 完了: ${segmentPath}`);
            }
            console.log(`🎉 音声分割完了: ${audioSegments.length}個のセグメント`);
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
            console.error('❌ 大容量音声ファイル処理エラー:', error);
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
        let resolvedFFmpegPath = ffmpeg_static_1.default;
        let resolvedFFprobePath = ffprobePath;
        if (electron_1.app.isPackaged && ffmpeg_static_1.default && ffprobePath) {
            const unpackedFFmpegPath = ffmpeg_static_1.default.replace('app.asar', 'app.asar.unpacked');
            const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
            if (fs.existsSync(unpackedFFmpegPath)) {
                resolvedFFmpegPath = unpackedFFmpegPath;
            }
            if (fs.existsSync(unpackedFFprobePath)) {
                resolvedFFprobePath = unpackedFFprobePath;
            }
            else {
                // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
                const appPath = electron_1.app.getAppPath();
                const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
                let alternativeFFprobePaths = [];
                if (process.platform === 'darwin') {
                    alternativeFFprobePaths = [
                        path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
                        path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
                        path.join(ffprobeBasePath, 'ffprobe'),
                    ];
                }
                else if (process.platform === 'win32') {
                    alternativeFFprobePaths = [
                        path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
                        path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
                        path.join(ffprobeBasePath, 'ffprobe.exe'),
                    ];
                }
                for (const altPath of alternativeFFprobePaths) {
                    if (fs.existsSync(altPath)) {
                        resolvedFFprobePath = altPath;
                        break;
                    }
                }
            }
        }
        if (resolvedFFmpegPath) {
            fluent_ffmpeg_1.default.setFfmpegPath(resolvedFFmpegPath);
        }
        if (resolvedFFprobePath) {
            fluent_ffmpeg_1.default.setFfprobePath(resolvedFFprobePath);
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
        let resolvedFFmpegPath = ffmpeg_static_1.default;
        let resolvedFFprobePath = ffprobePath;
        if (electron_1.app.isPackaged && ffmpeg_static_1.default && ffprobePath) {
            const unpackedFFmpegPath = ffmpeg_static_1.default.replace('app.asar', 'app.asar.unpacked');
            const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
            if (fs.existsSync(unpackedFFmpegPath)) {
                resolvedFFmpegPath = unpackedFFmpegPath;
            }
            if (fs.existsSync(unpackedFFprobePath)) {
                resolvedFFprobePath = unpackedFFprobePath;
            }
            else {
                // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
                const appPath = electron_1.app.getAppPath();
                const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
                let alternativeFFprobePaths = [];
                if (process.platform === 'darwin') {
                    alternativeFFprobePaths = [
                        path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
                        path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
                        path.join(ffprobeBasePath, 'ffprobe'),
                    ];
                }
                else if (process.platform === 'win32') {
                    alternativeFFprobePaths = [
                        path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
                        path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
                        path.join(ffprobeBasePath, 'ffprobe.exe'),
                    ];
                }
                for (const altPath of alternativeFFprobePaths) {
                    if (fs.existsSync(altPath)) {
                        resolvedFFprobePath = altPath;
                        break;
                    }
                }
            }
        }
        if (resolvedFFmpegPath) {
            fluent_ffmpeg_1.default.setFfmpegPath(resolvedFFmpegPath);
        }
        if (resolvedFFprobePath) {
            fluent_ffmpeg_1.default.setFfprobePath(resolvedFFprobePath);
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
                console.log(`✅ セグメント抽出完了: ${outputPath}`);
                resolve();
            })
                .on('error', (error) => {
                console.error(`❌ セグメント抽出エラー: ${error.message}`);
                reject(new Error(`セグメント抽出エラー: ${error.message}`));
            })
                .run();
        });
    }
    /**
     * 音声の長さを取得
     */
    async getAudioDuration(filePath) {
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
            console.warn('ネイティブ音声処理システムクリーンアップエラー:', error);
        }
    }
}
exports.NativeAudioProcessor = NativeAudioProcessor;
