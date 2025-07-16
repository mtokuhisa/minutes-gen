import { AudioFile, AudioSegment, AudioSegmentWithPath, AudioProcessorInterface, ProcessingProgress } from '../types';

// Electron環境でのみ利用可能なAPIの型定義
declare global {
  interface Window {
    electronAPI?: {
      audioProcessor: {
        initialize: () => Promise<{ success: boolean; error?: string }>;
        processFile: (filePath: string, segmentDuration?: number) => Promise<{ success: boolean; segments?: any[]; error?: string }>;
        getAudioDuration: (blobData: string, blobType: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
        readSegmentFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        cleanup: () => Promise<{ success: boolean; error?: string }>;
        onProgress: (callback: (progress: ProcessingProgress) => void) => void;
        offProgress: (callback: (progress: ProcessingProgress) => void) => void;
        saveToTempFile: (fileName: string, arrayBuffer: ArrayBuffer) => Promise<{ success: boolean; tempPath: string; error?: string }>;
      };
      isElectron: boolean;
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
    console.log('🔧 NativeAudioProcessorService constructor開始');
    
    try {
      if (this.isElectronEnvironment()) {
        console.log('✅ Electron環境を確認 - 進捗通知を設定');
        // 進捗通知の設定
        window.electronAPI!.audioProcessor.onProgress((progress) => {
          console.log('📊 進捗通知受信:', progress.currentTask);
          this.progressCallbacks.forEach(callback => {
            try {
              callback(progress);
            } catch (error) {
              console.error('進捗コールバックエラー:', error);
            }
          });
        });
      } else {
        console.warn('⚠️ 非Electron環境でNativeAudioProcessorServiceが作成されました');
      }
    } catch (error) {
      console.error('❌ NativeAudioProcessorService constructor エラー:', error);
      throw error;
    }
    
    console.log('✅ NativeAudioProcessorService constructor完了');
  }

  /**
   * Electron環境かどうかを判定
   */
  private isElectronEnvironment(): boolean {
    console.log('🔍 NativeAudioProcessor: Electron環境判定を開始');
    
    const hasWindow = typeof window !== 'undefined';
    const hasElectronAPI = hasWindow && window.electronAPI !== undefined;
    const hasAudioProcessor = hasElectronAPI && window.electronAPI.audioProcessor !== undefined;
    const hasIsElectron = hasElectronAPI && window.electronAPI.isElectron === true;
    const hasElectronUserAgent = hasWindow && typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
    
    console.log('🔍 NativeAudioProcessor Electron環境判定結果:', {
      hasWindow,
      hasElectronAPI,
      hasAudioProcessor,
      hasIsElectron,
      hasElectronUserAgent,
      userAgent: hasWindow ? navigator.userAgent : 'no window'
    });
    
    // isElectronフラグまたはUserAgentで判定
    const isElectron = hasAudioProcessor && (hasIsElectron || hasElectronUserAgent);
    console.log('🔍 NativeAudioProcessor 最終判定:', {
      isElectron,
      reason: !hasElectronAPI ? 'electronAPI不在' : 
              !hasAudioProcessor ? 'audioProcessor不在' : 
              !(hasIsElectron || hasElectronUserAgent) ? 'isElectronフラグもUserAgentもfalse' : 'すべて存在'
    });
    
    return isElectron;
  }

  /**
   * ネイティブFFmpegを初期化
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    console.log('🚀 NativeAudioProcessorService.initialize() 開始');
    
    if (this.isInitialized) {
      console.log('✅ 既に初期化済み');
      return;
    }

    if (!this.isElectronEnvironment()) {
      const error = new Error('ネイティブFFmpegはElectron環境でのみ利用可能です');
      console.error('❌', error.message);
      throw error;
    }

    if (onProgress) {
      console.log('📊 進捗コールバックを追加');
      this.progressCallbacks.add(onProgress);
    }

    try {
      console.log('🔄 ElectronAPI audioProcessor.initialize() 呼び出し');
      const result = await window.electronAPI!.audioProcessor.initialize();
      
      console.log('📋 初期化結果:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'ネイティブFFmpegの初期化に失敗しました');
      }
      
      this.isInitialized = true;
      console.log('✅ NativeAudioProcessorService初期化完了');
      
    } catch (error) {
      console.error('❌ NativeAudioProcessorService初期化エラー:', error);
      
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
  ): Promise<AudioSegmentWithPath[]> {
    console.log('🎵 processLargeAudioFile開始:', {
      fileName: file.name,
      fileSize: file.rawFile?.size,
      segmentDuration: segmentDurationSeconds
    });
    
    if (!this.isElectronEnvironment()) {
      const error = new Error('ネイティブFFmpegはElectron環境でのみ利用可能です');
      console.error('❌', error.message);
      throw error;
    }

    if (!file.rawFile) {
      const error = new Error('音声ファイルが見つかりません');
      console.error('❌', error.message);
      throw error;
    }

    try {
      await this.initialize(onProgress);

      if (onProgress) {
        this.progressCallbacks.add(onProgress);
      }

      // ファイルを一時的にファイルシステムに保存
      console.log('💾 一時ファイルを作成中...');
      const tempFilePath = await this.saveToTempFile(file.rawFile);
      console.log('✅ 一時ファイル作成完了:', tempFilePath);

      // Main processでファイルを処理
      console.log('🔄 ElectronAPI audioProcessor.processFile() 呼び出し');
      const result = await window.electronAPI!.audioProcessor.processFile(
        tempFilePath,
        segmentDurationSeconds
      );

      console.log('📋 ファイル処理結果:', result);

      if (!result.success) {
        throw new Error(result.error || '音声ファイルの処理に失敗しました');
      }

      // メモリ効率化のためファイルパス情報を含むセグメントを作成
      const audioSegments: AudioSegmentWithPath[] = result.segments!.map((segment: any, index: number) => {
        console.log(`📂 セグメント${index + 1}を作成:`, segment);
        
        // セグメントファイルパスを_filePathプロパティに保存
        const segmentWithPath: AudioSegmentWithPath = {
          blob: new Blob([], { type: 'audio/wav' }), // 空のBlobを作成
          name: segment.name,
          duration: segment.duration,
          startTime: segment.startTime,
          endTime: segment.endTime,
          _filePath: segment.filePath, // 内部的にファイルパスを保持
        };
        
        return segmentWithPath;
      });

      console.log('✅ processLargeAudioFile完了:', audioSegments.length, '個のセグメント');
      return audioSegments;
      
    } catch (error) {
      console.error('❌ processLargeAudioFileエラー:', error);
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
    console.log('💾 saveToTempFile開始:', file.name);
    
    try {
      // Electron環境を確認
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.audioProcessor?.saveToTempFile) {
        throw new Error('ElectronのIPCが利用できません');
      }

      // ファイルをArrayBufferに変換
      const arrayBuffer = await file.arrayBuffer();
      
      console.log('📏 ArrayBufferサイズ:', arrayBuffer.byteLength);
      
      // ElectronのIPCを使用してファイルを保存
      const result = await electronAPI.audioProcessor.saveToTempFile(file.name, arrayBuffer);
      
      if (!result.success) {
        throw new Error(result.error || '一時ファイル保存に失敗しました');
      }
      
      console.log('✅ 一時ファイル保存成功:', result.tempPath);
      return result.tempPath;
      
    } catch (error) {
      console.error('❌ saveToTempFileエラー:', error);
      throw new Error(`一時ファイルの保存に失敗しました: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * 音声の長さを取得
   */
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    console.log('⏱️ getAudioDurationFromBlob開始');
    
    if (!this.isElectronEnvironment()) {
      const error = new Error('音声長さの取得はElectron環境でのみ利用可能です');
      console.error('❌', error.message);
      throw error;
    }

    try {
      // BlobをBase64に変換
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      
      const result = await window.electronAPI!.audioProcessor.getAudioDuration(base64Data, blob.type);
      
      if (!result.success) {
        throw new Error(result.error || '音声長さの取得に失敗しました');
      }
      
      console.log('✅ 音声長さ取得完了:', result.duration);
      return result.duration || 0;
      
    } catch (error) {
      console.error('❌ getAudioDurationFromBlobエラー:', error);
      throw error;
    }
  }

  /**
   * セグメントファイルを読み込む（メモリ効率化）
   */
  private async readSegmentFile(filePath: string): Promise<Buffer> {
    console.log('📖 readSegmentFile開始:', filePath);
    
    if (!this.isElectronEnvironment()) {
      const error = new Error('ファイル読み込みはElectron環境でのみ利用可能です');
      console.error('❌', error.message);
      throw error;
    }

    try {
      const result = await window.electronAPI!.audioProcessor.readSegmentFile(filePath);
      
      if (!result.success) {
        throw new Error(result.error || 'セグメントファイルの読み込みに失敗しました');
      }
      
      console.log('✅ セグメントファイル読み込み完了');
      return Buffer.from(result.data!, 'base64');
      
    } catch (error) {
      console.error('❌ readSegmentFileエラー:', error);
      throw error;
    }
  }

  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 NativeAudioProcessorService cleanup開始');
    
    try {
      if (this.isElectronEnvironment()) {
        const result = await window.electronAPI!.audioProcessor.cleanup();
        if (!result.success) {
          console.warn('⚠️ クリーンアップ警告:', result.error);
        }
      }
      
      this.progressCallbacks.clear();
      this.isInitialized = false;
      
      console.log('✅ NativeAudioProcessorService cleanup完了');
      
    } catch (error) {
      console.error('❌ NativeAudioProcessorService cleanupエラー:', error);
      throw error;
    }
  }
} 