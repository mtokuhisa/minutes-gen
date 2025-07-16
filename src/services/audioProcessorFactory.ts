import { AudioProcessorInterface } from '../types';
import { NativeAudioProcessorService } from './nativeAudioProcessor';
import { dynamicMemoryService, FileProcessingRequest } from './dynamicMemoryService';
import { memoryEstimationService } from './memoryEstimationService';
import { workerManager } from './workerManager';

// 環境変数でFFmpegの種類を制御
const USE_NATIVE_FFMPEG = process.env.REACT_APP_USE_NATIVE_FFMPEG !== 'false';

// Electron環境の判定 - より厳密な判定に変更
const isElectronEnvironment = (): boolean => {
  console.log('🔍 AudioProcessorFactory: Electron環境判定を開始');
  
  const hasWindow = typeof window !== 'undefined';
  const hasElectronAPI = hasWindow && window.electronAPI !== undefined;
  const hasAudioProcessor = hasElectronAPI && window.electronAPI.audioProcessor !== undefined;
  const hasElectronFlag = hasElectronAPI && window.electronAPI.isElectron === true;
  const hasElectronUserAgent = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  
  // 詳細なデバッグログ
  console.log('🔍 Electron環境判定（詳細）:', {
    hasWindow,
    hasElectronAPI,
    hasAudioProcessor,
    hasElectronFlag,
    hasElectronUserAgent,
    USE_NATIVE_FFMPEG,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    electronAPI: hasElectronAPI ? 'available' : 'unavailable'
  });
  
  // より厳密な判定
  const isElectron = hasAudioProcessor && hasElectronFlag;
  
  console.log('🔍 最終判定:', {
    isElectron,
    reason: hasAudioProcessor && hasElectronFlag ? 'audioProcessor & isElectron flag both true' : 
            hasAudioProcessor ? 'audioProcessor available but isElectron flag false' : 
            hasElectronFlag ? 'isElectron flag true but audioProcessor unavailable' : 
            hasElectronUserAgent ? 'Electron user agent only' : 'none'
  });
  
  return isElectron;
};

/**
 * 動的メモリ管理対応のAudioProcessorラッパー
 */
class DynamicMemoryAudioProcessor implements AudioProcessorInterface {
  private baseProcessor: AudioProcessorInterface;
  
  constructor(baseProcessor: AudioProcessorInterface) {
    this.baseProcessor = baseProcessor;
  }
  
  async initialize(): Promise<void> {
    return this.baseProcessor.initialize();
  }
  
  async processLargeAudioFile(
    file: any,
    segmentDurationSeconds: number,
    onProgress?: (progress: any) => void
  ): Promise<any> {
    // ファイルサイズを取得
    const fileSize = file.rawFile?.size || file.size || 0;
    const fileName = file.name || 'unknown.wav';
    
    // メモリ使用量を推定
    const memoryEstimation = memoryEstimationService.estimateMemoryUsage(fileSize, fileName);
    
    console.log(`🧠 メモリ推定結果:`, {
      fileName,
      fileSizeMB: Math.round(fileSize / (1024 * 1024)),
      estimatedMemoryMB: memoryEstimation.estimatedMemoryMB,
      requiredMemoryMB: memoryEstimation.requiredMemoryMB,
      processingMode: memoryEstimation.processingMode,
      canProcessWithCurrent: memoryEstimation.canProcessWithCurrent
    });
    
    // 処理モードに応じて適切な処理を選択
    if (memoryEstimation.processingMode === 'light') {
      console.log('📄 軽量処理モードで実行');
      return this.baseProcessor.processLargeAudioFile(file, segmentDurationSeconds, onProgress);
    } else {
      console.log('⚡ 動的メモリ管理モードで実行');
      return this.processWithDynamicMemory(file, segmentDurationSeconds, onProgress);
    }
  }
  
  /**
   * 動的メモリ管理を使用した処理
   */
  private async processWithDynamicMemory(
    file: any,
    segmentDurationSeconds: number,
    onProgress?: (progress: any) => void
  ): Promise<any> {
    // Electron環境では直接NativeAudioProcessorServiceを使用
    if (this.isElectronEnvironment()) {
      console.log('🚀 Electron環境: NativeAudioProcessorServiceを直接使用');
      
      try {
        const nativeProcessor = new NativeAudioProcessorService();
        
        const audioFile = {
          name: file.name,
          rawFile: file.rawFile || file,
          blob: file.rawFile || file,
          duration: 0,
        };
        
        const result = await nativeProcessor.processLargeAudioFile(
          audioFile,
          segmentDurationSeconds,
          onProgress
        );
        
        return result;
      } catch (nativeError) {
        console.error('❌ NativeAudioProcessorServiceでの処理失敗:', nativeError);
        // フォールバック処理を続行
      }
    }

    // フォールバック: DynamicMemoryService を使用
    console.log('⚠️ DynamicMemoryService を使用してフォールバック処理を実行');
    
    const request: FileProcessingRequest = {
      file: file.rawFile || file,
      processingType: 'audio',
      options: {
        segmentDurationSeconds,
        baseProcessor: this.baseProcessor,
      },
      onProgress,
    };
    
    const result = await dynamicMemoryService.processFile(request);
    
    if (!result.success) {
      throw new Error(result.error || 'すべてのフォールバック処理が失敗しました。');
    }
    
    return result.data;
  }

  /**
   * Electron環境かどうかを判定
   */
  private isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && 
           window.electronAPI && 
           typeof window.electronAPI.audioProcessor === 'object';
  }
  
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    return this.baseProcessor.getAudioDurationFromBlob(blob);
  }
  
  async cleanup(): Promise<void> {
    return this.baseProcessor.cleanup();
  }
}

/**
 * AudioProcessorServiceのファクトリー
 * 環境に応じて適切なAudioProcessorインスタンスを作成
 */
export class AudioProcessorFactory {
  /**
   * 環境に応じたAudioProcessorインスタンスを作成
   */
  static createAudioProcessor(): AudioProcessorInterface {
    console.log('🎵 AudioProcessor作成開始（動的メモリ管理対応）');
    
    try {
      const isElectron = isElectronEnvironment();
      
      console.log('🎵 AudioProcessor作成:', {
        isElectron,
        USE_NATIVE_FFMPEG,
        selectedType: isElectron && USE_NATIVE_FFMPEG ? 'native' : 'wasm'
      });
      
      let baseProcessor: AudioProcessorInterface;
      
      // Electron環境でネイティブFFmpegを使用する場合
      if (isElectron && USE_NATIVE_FFMPEG) {
        try {
          console.log('✅ NativeAudioProcessorServiceを作成中...');
          baseProcessor = new NativeAudioProcessorService();
          console.log('✅ NativeAudioProcessorServiceの作成に成功');
        } catch (error) {
          console.error('❌ NativeAudioProcessorServiceの作成に失敗:', error);
          console.log('⚠️ レガシーAudioProcessorServiceにフォールバック');
          baseProcessor = createLegacyAudioProcessor();
        }
      } else {
        // フォールバック: 旧来のFFmpegWasmを使用
        console.log('⚠️ レガシーAudioProcessorServiceを使用');
        baseProcessor = createLegacyAudioProcessor();
      }
      
      // 動的メモリ管理ラッパーで包む
      const dynamicProcessor = new DynamicMemoryAudioProcessor(baseProcessor);
      console.log('🧠 動的メモリ管理対応AudioProcessorの作成完了');
      
      return dynamicProcessor;
      
    } catch (error) {
      console.error('❌ AudioProcessorFactory.createAudioProcessor 全般エラー:', error);
      
      // 最終的なフォールバック
      console.log('🚨 最終フォールバック: レガシーAudioProcessorServiceを強制使用');
      const baseProcessor = createLegacyAudioProcessor();
      return new DynamicMemoryAudioProcessor(baseProcessor);
    }
  }
  
  /**
   * 現在使用中のAudioProcessorの種類を取得
   */
  static getCurrentProcessorType(): 'native' | 'wasm' {
    try {
      const isElectron = isElectronEnvironment();
      if (isElectron && USE_NATIVE_FFMPEG) {
        return 'native';
      }
      return 'wasm';
    } catch (error) {
      console.error('❌ getCurrentProcessorType エラー:', error);
      return 'wasm';
    }
  }
  
  /**
   * 動的メモリ管理の状態を取得
   */
  static getMemoryStatus(): {
    memoryUsage: ReturnType<typeof memoryEstimationService.getMemoryUsageInfo>;
    workerStatus: ReturnType<typeof workerManager.getWorkerStatus>;
    processingStatus: ReturnType<typeof dynamicMemoryService.getProcessingStatus>;
  } {
    return {
      memoryUsage: memoryEstimationService.getMemoryUsageInfo(),
      workerStatus: workerManager.getWorkerStatus(),
      processingStatus: dynamicMemoryService.getProcessingStatus(),
    };
  }
}

/**
 * 旧来のFFmpegWasmを使用するAudioProcessorを作成
 * 段階的移行のため、既存のコードを保持
 */
function createLegacyAudioProcessor(): AudioProcessorInterface {
  console.log('📦 レガシーAudioProcessorServiceを動的インポート中...');
  
  try {
    // 既存のAudioProcessorServiceを動的にインポート
    // この実装は移行期間中の互換性維持のため
    const { AudioProcessorService } = require('./audioProcessor');
    const legacyProcessor = new AudioProcessorService();
    
    console.log('📦 レガシーAudioProcessorServiceのインポート完了');
    return legacyProcessor;
    
  } catch (error) {
    console.error('❌ レガシーAudioProcessorServiceのインポートに失敗:', error);
    
    // 最終的なエラーハンドリング - 最小限のダミー実装
    console.log('🚨 ダミーAudioProcessorを作成（エラー回避）');
    return createDummyAudioProcessor();
  }
}

/**
 * エラー回避のための最小限のダミー実装
 */
function createDummyAudioProcessor(): AudioProcessorInterface {
  console.warn('⚠️ ダミーAudioProcessorを使用しています');
  
  return {
    async initialize() {
      console.warn('⚠️ ダミーAudioProcessor: initialize() 呼び出し');
    },
    
    async processLargeAudioFile(file, segmentDurationSeconds, onProgress) {
      console.warn('⚠️ ダミーAudioProcessor: processLargeAudioFile() 呼び出し');
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 0,
        currentTask: 'エラー: 音声処理システムが利用できません',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'error',
          message: '音声処理システムが初期化できませんでした。アプリを再起動してください。'
        }],
        startedAt: new Date(),
      });
      
      throw new Error('音声処理システムが利用できません。アプリを再起動してください。');
    },
    
    async getAudioDurationFromBlob() {
      console.warn('⚠️ ダミーAudioProcessor: getAudioDurationFromBlob() 呼び出し');
      return 0;
    },
    
    async cleanup() {
      console.warn('⚠️ ダミーAudioProcessor: cleanup() 呼び出し');
    }
  };
}

// シングルトンインスタンス
let audioProcessorInstance: AudioProcessorInterface | null = null;

/**
 * AudioProcessorのシングルトンインスタンスを取得
 */
export function getAudioProcessor(): AudioProcessorInterface {
  try {
    if (!audioProcessorInstance) {
      console.log('🔄 新しいAudioProcessorインスタンスを作成');
      audioProcessorInstance = AudioProcessorFactory.createAudioProcessor();
    } else {
      console.log('♻️ 既存のAudioProcessorインスタンスを使用');
    }
    return audioProcessorInstance;
  } catch (error) {
    console.error('❌ getAudioProcessor エラー:', error);
    
    // エラーが発生した場合、インスタンスをリセットして再試行
    audioProcessorInstance = null;
    console.log('🔄 エラー後の再試行: AudioProcessorインスタンスを再作成');
    audioProcessorInstance = AudioProcessorFactory.createAudioProcessor();
    return audioProcessorInstance;
  }
}

/**
 * AudioProcessorインスタンスをリセット
 * テスト時やプロセッサー切り替え時に使用
 */
export function resetAudioProcessor(): void {
  console.log('🔄 AudioProcessorインスタンスをリセット');
  
  try {
    if (audioProcessorInstance) {
      audioProcessorInstance.cleanup().catch(error => {
        console.error('❌ クリーンアップエラー:', error);
      });
      audioProcessorInstance = null;
    }
  } catch (error) {
    console.error('❌ resetAudioProcessor エラー:', error);
    audioProcessorInstance = null;
  }
}

/**
 * AudioProcessorのクリーンアップ
 * アプリケーション終了時に呼び出す
 */
export async function cleanupAudioProcessor(): Promise<void> {
  console.log('🧹 AudioProcessorのクリーンアップ開始');
  
  try {
    if (audioProcessorInstance) {
      await audioProcessorInstance.cleanup();
      audioProcessorInstance = null;
    }
    console.log('🧹 AudioProcessorのクリーンアップ完了');
  } catch (error) {
    console.error('❌ cleanupAudioProcessor エラー:', error);
    audioProcessorInstance = null;
  }
} 