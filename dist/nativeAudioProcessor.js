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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
class NativeAudioProcessor {
    constructor() {
        this.isInitialized = false;
        this.MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MB
        this.OVERLAP_SECONDS = 5; // 5秒のオーバーラップ
        this.tempDir = path.join(os.tmpdir(), 'minutes-gen-' + Date.now());
        // FFmpegパスを設定
        if (ffmpeg_static_1.default) {
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
        }
    }
    /**
     * ネイティブFFmpegを初期化
     */
    async initialize(onProgress) {
        if (this.isInitialized) {
            return;
        }
        onProgress?.({
            stage: 'transcribing',
            percentage: 5,
            currentTask: '�� 音声処理システムを準備中...',
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
            await fs.promises.mkdir(this.tempDir, { recursive: true });
            // FFmpegの動作確認
            await this.testFFmpeg();
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
            const errorMessage = `ネイティブ音声処理システムの初期化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
            onProgress?.({
                stage: 'error',
                percentage: 100,
                currentTask: '❌ 音声処理システムの初期化エラー',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'error',
                        message: errorMessage
                    }],
                startedAt: new Date(),
            });
            throw new Error(errorMessage);
        }
    }
    /**
     * FFmpegの動作確認
     */
    async testFFmpeg() {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input('color=black:size=1x1:duration=0.1')
                .inputFormat('lavfi')
                .output(path.join(this.tempDir, 'test.mp3'))
                .audioCodec('mp3')
                .on('end', () => {
                fs.promises.unlink(path.join(this.tempDir, 'test.mp3')).catch(() => { });
                resolve();
            })
                .on('error', (error) => {
                reject(new Error(`FFmpeg動作確認失敗: ${error.message}`));
            })
                .run();
        });
    }
    /**
     * 大容量音声ファイルを適切なセグメントに分割
     */
    async processLargeAudioFile(inputPath, segmentDurationSeconds = 600, onProgress) {
        await this.initialize(onProgress);
        try {
            onProgress?.({
                stage: 'transcribing',
                percentage: 20,
                currentTask: '📊 音声ファイルを分析中...',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'info',
                        message: '音声ファイルを解析しています...'
                    }],
                startedAt: new Date(),
            });
            // 音声の長さを取得
            const duration = await this.getAudioDuration(inputPath);
            // ファイルサイズをチェック
            const fileSizeBytes = (await fs.promises.stat(inputPath)).size;
            // 圧縮が必要かチェック
            let workingFile = inputPath;
            if (fileSizeBytes > this.MAX_SEGMENT_SIZE) {
                workingFile = await this.compressAudio(inputPath, onProgress);
            }
            // セグメント境界を計算
            const segments = this.calculateSegments(duration, segmentDurationSeconds);
            onProgress?.({
                stage: 'transcribing',
                percentage: 50,
                currentTask: `📏 ${Math.floor(duration / 60)}分の音声を${segments.length}個に分割準備中...`,
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'info',
                        message: `音声を${segments.length}個のセグメントに分割します。`
                    }],
                startedAt: new Date(),
            });
            const audioSegments = [];
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                onProgress?.({
                    stage: 'transcribing',
                    percentage: 50 + Math.round((i / segments.length) * 40),
                    currentTask: `✂️ 音声を${segments.length}個に分割中 (${i + 1}/${segments.length})`,
                    estimatedTimeRemaining: 0,
                    logs: [{
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'info',
                            message: `セグメント ${i + 1}: ${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s`
                        }],
                    startedAt: new Date(),
                });
                const segmentPath = path.join(this.tempDir, `segment_${i.toString().padStart(3, '0')}.wav`);
                await this.extractSegment(workingFile, segmentPath, segment, onProgress, i + 1, segments.length);
                // セグメントファイルをBlobとして読み込み
                const segmentData = await fs.promises.readFile(segmentPath);
                const blob = new Blob([segmentData], { type: 'audio/wav' });
                const segmentDuration = await this.getAudioDuration(segmentPath);
                audioSegments.push({
                    blob,
                    name: `segment_${i.toString().padStart(3, '0')}.wav`,
                    duration: segmentDuration,
                    startTime: segment.start,
                    endTime: segment.end,
                });
                // 一時ファイルを削除
                await fs.promises.unlink(segmentPath);
            }
            // 圧縮ファイルが作成されていた場合は削除
            if (workingFile !== inputPath) {
                await fs.promises.unlink(workingFile);
            }
            onProgress?.({
                stage: 'transcribing',
                percentage: 95,
                currentTask: '✅ 音声分割の準備完了',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'success',
                        message: `合計 ${audioSegments.length} 個の音声セグメントの準備が完了しました。`
                    }],
                startedAt: new Date(),
            });
            return audioSegments;
        }
        catch (error) {
            const errorMessage = `音声ファイルの分割処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
            onProgress?.({
                stage: 'error',
                percentage: 100,
                currentTask: '音声ファイル処理エラー',
                estimatedTimeRemaining: 0,
                logs: [{
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        level: 'error',
                        message: errorMessage
                    }],
                startedAt: new Date(),
            });
            throw new Error(errorMessage);
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
                .audioCodec('mp3')
                .audioBitrate('128k')
                .audioFrequency(44100)
                .audioChannels(1)
                .format('mp3')
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
        }
        catch (error) {
            console.warn('ネイティブ音声処理システムクリーンアップエラー:', error);
        }
    }
}
exports.NativeAudioProcessor = NativeAudioProcessor;
