// ===========================================
// MinutesGen v1.0 - 動的メモリ管理サービス
// ===========================================

import { memoryEstimationService, MemoryEstimation } from './memoryEstimationService';
import { WorkerManager, WorkerTask } from './workerManager';
import { NativeAudioProcessorService } from './nativeAudioProcessor';
import { AudioProcessorService } from './audioProcessor';
import { ProcessingProgress, AudioProcessorInterface } from '../types';

export interface FileProcessingRequest {
  file: File;
  processingType: 'transcription' | 'audio-processing' | 'file-processing';
  options?: {
    segmentDurationSeconds?: number;
    originalFile?: any;
    baseProcessor?: AudioProcessorInterface;
    [key: string]: any;
  };
  onProgress?: (progress: ProcessingProgress) => void;
}

export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  memoryUsed?: number;
  processingTime?: number;
  processingMode?: 'light' | 'medium' | 'heavy';
}

export class DynamicMemoryService {
  private static instance: DynamicMemoryService;
  private workerManager: WorkerManager;
  private processingRequests: Map<string, FileProcessingRequest> = new Map();

  private constructor() {
    this.workerManager = new WorkerManager();
  }

  static getInstance(): DynamicMemoryService {
    if (!DynamicMemoryService.instance) {
      DynamicMemoryService.instance = new DynamicMemoryService();
    }
    return DynamicMemoryService.instance;
  }

  /**
   * ファイル処理のメインエントリーポイント
   */
  async processFile(request: FileProcessingRequest): Promise<ProcessingResult> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.processingRequests.set(requestId, request);

    try {
      // 1. メモリ使用量を推定
      const memoryEstimation = memoryEstimationService.estimateMemoryUsage(
        request.file.size,
        request.file.name
      );

      // 2. 処理開始の通知
      this.notifyProcessingStart(request, memoryEstimation);

      // 3. 処理モードに応じて適切な処理を実行
      const result = await this.executeProcessing(request, memoryEstimation, requestId);

      // 4. 処理完了の通知
      this.notifyProcessingComplete(request, result);

      return result;
    } catch (error) {
      console.error('ファイル処理エラー:', error);
      const errorResult: ProcessingResult = {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー',
        processingMode: 'light',
      };
      
      this.notifyProcessingComplete(request, errorResult);
      return errorResult;
    } finally {
      this.processingRequests.delete(requestId);
    }
  }

  /**
   * 処理を実行
   */
  private async executeProcessing(
    request: FileProcessingRequest,
    memoryEstimation: MemoryEstimation,
    requestId: string
  ): Promise<ProcessingResult> {
    switch (memoryEstimation.processingMode) {
      case 'light':
        return this.executeLightProcessing(request, memoryEstimation);
      
      case 'medium':
      case 'heavy':
        return this.executeHeavyProcessing(request);
      
      default:
        throw new Error(`未知の処理モード: ${memoryEstimation.processingMode}`);
    }
  }

  /**
   * 軽量処理（現在のプロセスで実行）
   */
  private async executeLightProcessing(
    request: FileProcessingRequest,
    memoryEstimation: MemoryEstimation
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 軽量処理開始: ${request.file.name} (${memoryEstimation.estimatedMemoryMB}MB)`);
      
      // 軽量処理の実装
      const result = await this.performLightProcessing(request);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        processingTime,
        processingMode: 'light',
        memoryUsed: memoryEstimation.estimatedMemoryMB,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '軽量処理エラー',
        processingMode: 'light',
      };
    }
  }

  /**
   * 重量処理を実行
   */
  private async executeHeavyProcessing(request: FileProcessingRequest): Promise<ProcessingResult> {
    const requestId = Date.now().toString();
    const memoryEstimation = memoryEstimationService.estimateMemoryUsage(
      request.file.size,
      request.file.name
    );

    try {
      console.log(`⚡ 重量処理開始: ${request.file.name} (${memoryEstimation.requiredMemoryMB}MB)`);
      
      // メモリ不足の場合は警告を表示
      if (!memoryEstimation.canProcessWithCurrent) {
        this.notifyMemoryUpgrade(request, memoryEstimation);
      }

      // Electron環境では直接NativeAudioProcessorServiceを使用
      if (this.isElectronEnvironment()) {
        console.log('🚀 Electron環境: NativeAudioProcessorServiceを直接使用');
        
        try {
          const nativeProcessor = new NativeAudioProcessorService();
          
          const audioFile = {
            name: request.file.name,
            rawFile: request.file,
            blob: request.file,
            duration: 0,
          };
          
          const directResult = await nativeProcessor.processLargeAudioFile(
            audioFile,
            request.options?.segmentDurationSeconds || 600,
            request.onProgress
          );
          
          return {
            success: true,
            data: directResult,
            processingMode: memoryEstimation.processingMode,
          };
        } catch (nativeError) {
          console.error('❌ NativeAudioProcessorServiceでの処理失敗:', nativeError);
          // フォールバック処理を続行
        }
      }

      // Worker管理システムを試行（非推奨）
      console.log('⚠️ Worker管理システムを試行中（非推奨）');
      
      // Workerタスクを作成
      const task: WorkerTask = {
        id: `task-${requestId}`,
        type: request.processingType,
        data: {
          file: await this.fileToBase64(request.file),
          fileName: request.file.name,
          fileSize: request.file.size,
          options: request.options,
        },
        estimatedMemoryMB: memoryEstimation.estimatedMemoryMB,
        priority: memoryEstimation.processingMode === 'heavy' ? 'high' : 'medium',
      };

      // Workerで実行
      const result = await this.workerManager.executeTask(
        task,
        request.file.size,
        request.file.name
      );

      // Worker管理システムが利用できない場合のフォールバック
      if (!result.success && (
        result.error === 'Worker管理システムはElectron環境でのみ動作します' ||
        result.error === 'Worker管理システムはNode.js APIが必要です'
      )) {
        console.log('⚠️ Worker管理システムが利用できません。baseProcessorを直接使用してフォールバック処理を実行します。');
        console.log('🔍 エラー詳細:', result.error);
        
        // baseProcessorを直接使用して処理を実行
        try {
          const baseProcessor = request.options?.baseProcessor;
          if (baseProcessor) {
            console.log('🔄 baseProcessorを直接使用して処理を実行');
            
            const audioFile = {
              name: request.file.name,
              rawFile: request.file,
              blob: request.file,
              duration: 0,
            };
            
            const directResult = await baseProcessor.processLargeAudioFile(
              audioFile,
              request.options?.segmentDurationSeconds || 600,
              request.onProgress
            );
            
            return {
              success: true,
              data: directResult,
              processingMode: memoryEstimation.processingMode,
            };
          }
        } catch (directError) {
          console.error('❌ baseProcessorでの直接処理も失敗:', directError);
          
          // 最終的なフォールバック: レガシーAudioProcessorServiceを使用
          try {
            console.log('🔄 レガシーAudioProcessorServiceで最終フォールバック処理を実行');
            
            // レガシーAudioProcessorServiceを動的インポート
            const { AudioProcessorService } = await import('./audioProcessor');
            const legacyProcessor = new AudioProcessorService();
            
            const audioFile = {
              name: request.file.name,
              rawFile: request.file,
              blob: request.file,
              duration: 0,
            };
            
            const legacyResult = await legacyProcessor.processLargeAudioFile(
              audioFile,
              request.options?.segmentDurationSeconds || 600,
              request.onProgress
            );
            
            return {
              success: true,
              data: legacyResult,
              processingMode: memoryEstimation.processingMode,
            };
          } catch (legacyError) {
            console.error('❌ レガシーAudioProcessorServiceでも失敗:', legacyError);
          }
        }
        
        // 最終的なフォールバック
        return {
          success: false,
          error: 'すべてのフォールバック処理が失敗しました。',
          processingMode: memoryEstimation.processingMode,
        };
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        memoryUsed: result.memoryUsed,
        processingTime: result.processingTime,
        processingMode: memoryEstimation.processingMode,
      };
    } catch (error) {
      console.error('重量処理実行エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー',
        processingMode: memoryEstimation.processingMode,
      };
    }
  }

  /**
   * 軽量処理の実装
   */
  private async performLightProcessing(request: FileProcessingRequest): Promise<any> {
    // 文字起こし済み文書の場合
    if (request.processingType === 'file-processing') {
      const text = await request.file.text();
      
      // 簡単な形式変換やデータ処理
      return {
        originalText: text,
        processedAt: new Date(),
        fileSize: request.file.size,
        fileType: request.file.type,
      };
    }
    
    // その他の軽量処理
    return {
      message: '軽量処理が完了しました',
      file: request.file.name,
      size: request.file.size,
    };
  }

  /**
   * ファイルをBase64に変換
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // データURL形式からBase64部分を取得
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 処理開始の通知
   */
  private notifyProcessingStart(
    request: FileProcessingRequest,
    memoryEstimation: MemoryEstimation
  ): void {
    const message = this.getProcessingMessage(memoryEstimation);
    
    request.onProgress?.({
      stage: 'analyzing',
      percentage: 5,
      currentTask: message,
      estimatedTimeRemaining: 0,
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `${message} (${memoryEstimation.fileType}ファイル)`,
      }],
      startedAt: new Date(),
    });
  }

  /**
   * メモリアップグレード通知
   */
  private notifyMemoryUpgrade(
    request: FileProcessingRequest,
    memoryEstimation: MemoryEstimation
  ): void {
    const recommendedMB = memoryEstimationService.getRecommendedMemoryLimit(
      memoryEstimation.requiredMemoryMB
    );
    
    request.onProgress?.({
      stage: 'preparing',
      percentage: 10,
      currentTask: `最適な処理環境を準備中... (${recommendedMB}MB)`,
      estimatedTimeRemaining: 0,
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `大容量ファイルのため、処理環境を最適化しています（${memoryEstimation.currentLimitMB}MB → ${recommendedMB}MB）`,
      }],
      startedAt: new Date(),
    });
  }

  /**
   * 処理完了の通知
   */
  private notifyProcessingComplete(
    request: FileProcessingRequest,
    result: ProcessingResult
  ): void {
    const message = result.success ? '処理が完了しました' : `処理中にエラーが発生しました: ${result.error}`;
    
    request.onProgress?.({
      stage: result.success ? 'completed' : 'error',
      percentage: 100,
      currentTask: message,
      estimatedTimeRemaining: 0,
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date(),
        level: result.success ? 'success' : 'error',
        message: `${message} (処理時間: ${result.processingTime || 0}ms, メモリ使用量: ${result.memoryUsed || 0}MB)`,
      }],
      startedAt: new Date(),
    });
  }

  /**
   * 処理メッセージを取得
   */
  private getProcessingMessage(memoryEstimation: MemoryEstimation): string {
    switch (memoryEstimation.processingMode) {
      case 'light':
        return '軽量処理で実行中...';
      case 'medium':
        return '標準処理で実行中...';
      case 'heavy':
        return '高性能処理で実行中...';
      default:
        return '処理中...';
    }
  }

  /**
   * 現在の処理状況を取得
   */
  getProcessingStatus(): {
    activeRequests: number;
    workerStatus: ReturnType<typeof this.workerManager.getWorkerStatus>;
    memoryUsage: ReturnType<typeof memoryEstimationService.getMemoryUsageInfo>;
  } {
    return {
      activeRequests: this.processingRequests.size,
      workerStatus: this.workerManager.getWorkerStatus(),
      memoryUsage: memoryEstimationService.getMemoryUsageInfo(),
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.processingRequests.clear();
    this.workerManager.cleanup();
  }

  /**
   * Electron環境かどうかを判定
   */
  private isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && 
           window.electronAPI && 
           typeof window.electronAPI.audioProcessor === 'object';
  }
}

// シングルトンインスタンス
export const dynamicMemoryService = DynamicMemoryService.getInstance(); 