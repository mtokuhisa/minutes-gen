import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 型定義
interface AudioSegment {
  blob: Blob;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

interface SegmentBoundary {
  start: number;
  end: number;
  overlapStart?: number;
  overlapEnd?: number;
}

interface ProcessingProgress {
  stage: 'transcribing' | 'error';
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number;
  logs: LogEntry[];
  startedAt: Date;
  processingDetails?: {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export class NativeAudioProcessor {
  private tempDir: string;
  private isInitialized: boolean = false;
  private readonly MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MB
  private readonly OVERLAP_SECONDS = 5; // 5秒のオーバーラップ

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'minutes-gen-' + Date.now());
    
    // FFmpegパスを設定
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  /**
   * ネイティブFFmpegを初期化
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
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
    } catch (error) {
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
  private async testFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=black:size=1x1:duration=0.1')
        .inputFormat('lavfi')
        .output(path.join(this.tempDir, 'test.mp3'))
        .audioCodec('mp3')
        .on('end', () => {
          fs.promises.unlink(path.join(this.tempDir, 'test.mp3')).catch(() => {});
          resolve();
        })
        .on('error', (error: Error) => {
          reject(new Error(`FFmpeg動作確認失敗: ${error.message}`));
        })
        .run();
    });
  }

  /**
   * 大容量音声ファイルを適切なセグメントに分割
   */
  async processLargeAudioFile(
    inputPath: string,
    segmentDurationSeconds: number = 600,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]> {
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

      const audioSegments: AudioSegment[] = [];
      
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
    } catch (error) {
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
  private async compressAudio(inputPath: string, onProgress?: (progress: ProcessingProgress) => void): Promise<string> {
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
      ffmpeg(inputPath)
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
        .on('error', (error: Error) => {
          reject(new Error(`音声圧縮エラー: ${error.message}`));
        })
        .run();
    });
  }

  /**
   * 音声の長さを取得
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`音声長さ取得エラー: ${err.message}`));
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  /**
   * セグメント境界を計算
   */
  private calculateSegments(totalDuration: number, segmentDuration: number): SegmentBoundary[] {
    const segments: SegmentBoundary[] = [];
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
  private async extractSegment(inputPath: string, outputPath: string, segment: SegmentBoundary, onProgress?: (progress: ProcessingProgress) => void, currentSegmentIndex: number = 0, totalSegments: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(segment.start)
        .duration(segment.end - segment.start)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (error: Error) => reject(new Error(`セグメント抽出エラー: ${error.message}`)))
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
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    // Main processでは直接的なBlob処理は困難なため、
    // 一時ファイルを通して処理する
    const tempPath = path.join(this.tempDir, 'temp_audio_' + Date.now());
    const buffer = Buffer.from(await blob.arrayBuffer());
    await fs.promises.writeFile(tempPath, buffer);
    
    try {
      const duration = await this.getAudioDuration(tempPath);
      await fs.promises.unlink(tempPath);
      return duration;
    } catch (error) {
      await fs.promises.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        await fs.promises.rmdir(this.tempDir, { recursive: true });
      }
      this.isInitialized = false;
    } catch (error) {
      console.warn('ネイティブ音声処理システムクリーンアップエラー:', error);
    }
  }
} 