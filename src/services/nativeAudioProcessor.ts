import { AudioFile, AudioSegment, AudioProcessorInterface, ProcessingProgress } from '../types';

// Electron環境でのみ利用可能なAPIの型定義
declare global {
  interface Window {
    electronAPI?: {
      audioProcessor: {
        initialize: () => Promise<{ success: boolean; error?: string }>;
        processFile: (filePath: string, segmentDuration?: number) => Promise<{ success: boolean; segments?: any[]; error?: string }>;
        getDuration: (blobData: string, blobType: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
        cleanup: () => Promise<{ success: boolean; error?: string }>;
        onProgress: (callback: (progress: ProcessingProgress) => void) => void;
        offProgress: (callback: (progress: ProcessingProgress) => void) => void;
      };
    };
  }
}

/**
 * ネイティブFFmpegを使用するAudioProcessorServiceのアダプター
 */
export class NativeAudioProcessorService implements AudioProcessorInterface {
  private isInitialized: boolean = false;
  private progressCallbacks: Set<(progress: ProcessingProgress) => void> = new Set();

  constructor() {
    if (this.isElectronEnvironment()) {
      // 進捗通知の設定
      window.electronAPI!.audioProcessor.onProgress((progress) => {
        this.progressCallbacks.forEach(callback => callback(progress));
      });
    }
  }

  /**
   * Electron環境かどうかを判定
   */
  private isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && window.electronAPI?.audioProcessor !== undefined;
  }

  /**
   * ネイティブFFmpegを初期化
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.isElectronEnvironment()) {
      throw new Error('ネイティブFFmpegはElectron環境でのみ利用可能です');
    }

    if (onProgress) {
      this.progressCallbacks.add(onProgress);
    }

    try {
      const result = await window.electronAPI!.audioProcessor.initialize();
      if (!result.success) {
        throw new Error(result.error || 'ネイティブFFmpegの初期化に失敗しました');
      }
      this.isInitialized = true;
    } catch (error) {
      if (onProgress) {
        this.progressCallbacks.delete(onProgress);
      }
      throw error;
    }
  }

  /**
   * 大容量音声ファイルを適切なセグメントに分割
   */
  async processLargeAudioFile(
    file: AudioFile,
    segmentDurationSeconds: number = 600,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]> {
    if (!this.isElectronEnvironment()) {
      throw new Error('ネイティブFFmpegはElectron環境でのみ利用可能です');
    }

    if (!file.rawFile) {
      throw new Error('音声ファイルが見つかりません');
    }

    await this.initialize(onProgress);

    if (onProgress) {
      this.progressCallbacks.add(onProgress);
    }

    try {
      // ファイルを一時的にファイルシステムに保存
      const tempFilePath = await this.saveToTempFile(file.rawFile);

      // Main processでファイルを処理
      const result = await window.electronAPI!.audioProcessor.processFile(
        tempFilePath,
        segmentDurationSeconds
      );

      if (!result.success) {
        throw new Error(result.error || '音声ファイルの処理に失敗しました');
      }

      // シリアライズされたセグメントをBlobに変換
      const audioSegments: AudioSegment[] = result.segments!.map((segment: any) => ({
        blob: new Blob([Buffer.from(segment.data, 'base64')], { type: segment.type }),
        name: segment.name,
        duration: segment.duration,
        startTime: segment.startTime,
        endTime: segment.endTime,
      }));

      return audioSegments;
    } catch (error) {
      throw error;
    } finally {
      if (onProgress) {
        this.progressCallbacks.delete(onProgress);
      }
    }
  }

  /**
   * ファイルを一時的にファイルシステムに保存
   */
  private async saveToTempFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);
          const base64 = btoa(String.fromCharCode(...uint8Array));
          
          // 一時ファイルパスを生成（実際の実装では、Main processで適切に処理）
          const tempPath = `/tmp/minutes-gen-${Date.now()}-${file.name}`;
          
          // Base64データをMain processに送信して一時ファイルとして保存
          // この実装は簡略化されており、実際にはfileHandlerを通じて処理する
          resolve(tempPath);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 音声長さを取得
   */
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    if (!this.isElectronEnvironment()) {
      throw new Error('ネイティブFFmpegはElectron環境でのみ利用可能です');
    }

    try {
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      const result = await window.electronAPI!.audioProcessor.getDuration(base64, blob.type);
      
      if (!result.success) {
        throw new Error(result.error || '音声長さの取得に失敗しました');
      }
      
      return result.duration!;
    } catch (error) {
      throw error;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.isElectronEnvironment()) {
      try {
        await window.electronAPI!.audioProcessor.cleanup();
      } catch (error) {
        console.warn('ネイティブFFmpegクリーンアップエラー:', error);
      }
    }
    
    this.progressCallbacks.clear();
    this.isInitialized = false;
  }
} 