// ===========================================
// MinutesGen v0.7.5 - Audio Processor Service (FFmpeg.wasm)
// 注意: この実装は段階的移行のため保持されています
// 新しいプロジェクトではNativeAudioProcessorServiceを使用してください
// ===========================================

// FFmpegWasmが削除されたため、代替実装を提供
import { AudioFile, ProcessingProgress, AudioProcessorInterface, AudioSegment } from '../types';

/**
 * FFmpegWasmの代替実装
 * WebCodecsProcessorを使用した簡易的な音声処理
 */
export class AudioProcessorService implements AudioProcessorInterface {
  private isInitialized: boolean = false;

  constructor() {
    console.warn('⚠️ レガシーAudioProcessorServiceが使用されています。');
    console.warn('パフォーマンスを向上させるため、Electron環境ではNativeAudioProcessorServiceの使用を推奨します。');
  }

  /**
   * 音声処理システムを初期化
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    onProgress?.({
      stage: 'transcribing',
      percentage: 5,
      currentTask: 'レガシー音声処理システムを初期化中...',
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'warning', 
        message: 'レガシー音声処理システムを使用しています。性能向上のため、Electron環境での使用を推奨します。' 
      }],
      startedAt: new Date(),
    });

    // 簡易的な初期化処理
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.isInitialized = true;

    onProgress?.({
      stage: 'transcribing',
      percentage: 15,
      currentTask: 'レガシー音声処理システムの初期化完了',
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'info', 
        message: 'レガシー音声処理システムの初期化が完了しました。' 
      }],
      startedAt: new Date(),
    });
  }

  /**
   * 大容量音声ファイルを適切なセグメントに分割
   */
  async processLargeAudioFile(
    file: AudioFile,
    segmentDurationSeconds: number = 600,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]> {
    await this.initialize(onProgress);

    if (!file.rawFile) {
      throw new Error('音声ファイルが見つかりません');
    }

    // 大容量ファイルの処理制限を緩和 - 100MBまで対応
    const maxSize = 100 * 1024 * 1024; // 100MB制限
    if (file.rawFile.size > maxSize) {
      const errorMessage = `
大容量音声ファイル（${Math.round(file.rawFile.size / 1024 / 1024)}MB）の処理には、
ネイティブFFmpegの使用を強く推奨します。

現在の制限:
- レガシー処理: 最大100MB
- ネイティブFFmpeg: 制限なし（数GB対応）

解決方法:
1. Electron環境でアプリを実行
2. 環境変数 REACT_APP_USE_NATIVE_FFMPEG=true を設定
3. より小さなファイルサイズで再試行
      `.trim();
      
      throw new Error(errorMessage);
    }

    // メモリ効率を向上させるため、大きなファイルは警告を表示
    if (file.rawFile.size > 50 * 1024 * 1024) { // 50MB以上で警告
      console.warn('⚠️ 大容量ファイル処理中:', {
        fileSize: Math.round(file.rawFile.size / 1024 / 1024) + 'MB',
        recommendation: 'ネイティブFFmpegの使用を推奨'
      });
      
      // ガベージコレクションを強制実行（可能な場合）
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
    }

    onProgress?.({
      stage: 'transcribing',
      percentage: 30,
      currentTask: `音声ファイル（${Math.round(file.rawFile.size / 1024 / 1024)}MB）を処理中...`,
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'info', 
        message: 'レガシー処理でファイルを単一セグメントとして処理します。' 
      }],
      startedAt: new Date(),
    });

    // 簡易的な処理: ファイル全体を1つのセグメントとして扱う
    const duration = await this.getAudioDurationFromBlob(file.rawFile);
    
    const audioSegments: AudioSegment[] = [{
      blob: file.rawFile,
      name: 'segment_000.wav',
      duration: duration,
      startTime: 0,
      endTime: duration,
    }];

    onProgress?.({
      stage: 'transcribing',
      percentage: 50,
      currentTask: '音声ファイルの処理完了',
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'info', 
        message: `音声セグメント準備完了 (${Math.round(file.rawFile.size / 1024 / 1024)}MB)` 
      }],
      startedAt: new Date(),
    });

    return audioSegments;
  }

  /**
   * 音声長さを取得
   */
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || 0);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('音声ファイルの長さを取得できませんでした'));
      };
      
      audio.src = url;
    });
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    console.log('レガシーAudioProcessorServiceのクリーンアップが完了しました。');
  }
}

// 後方互換性のためのエクスポート
export const audioProcessor = new AudioProcessorService(); 