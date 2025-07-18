// ===========================================
// MinutesGen v0.7.5 - メモリ推定サービス
// ===========================================

export interface MemoryEstimation {
  estimatedMemoryMB: number;
  requiredMemoryMB: number;
  canProcessWithCurrent: boolean;
  currentLimitMB: number;
  processingMode: 'light' | 'medium' | 'heavy';
  fileType: 'transcript' | 'audio' | 'video' | 'unknown';
}

export class MemoryEstimationService {
  private static instance: MemoryEstimationService;
  private readonly DEFAULT_MEMORY_LIMIT_MB = 1024; // 1GB

  private constructor() {}

  static getInstance(): MemoryEstimationService {
    if (!MemoryEstimationService.instance) {
      MemoryEstimationService.instance = new MemoryEstimationService();
    }
    return MemoryEstimationService.instance;
  }

  /**
   * ファイルサイズから必要なメモリ量を推定
   */
  estimateMemoryUsage(
    fileSize: number,
    fileName: string,
    currentMemoryLimitMB: number = this.DEFAULT_MEMORY_LIMIT_MB
  ): MemoryEstimation {
    const fileType = this.determineFileType(fileName);
    const fileSizeMB = fileSize / (1024 * 1024);

    let estimatedMemoryMB: number;
    let processingMode: 'light' | 'medium' | 'heavy';

    switch (fileType) {
      case 'transcript':
        // 文字起こし済み文書は軽量処理
        estimatedMemoryMB = Math.max(50, fileSizeMB * 10); // 最低50MB
        processingMode = 'light';
        break;

      case 'audio':
        // 音声ファイルの処理
        estimatedMemoryMB = this.estimateAudioMemory(fileSizeMB);
        processingMode = this.determineProcessingMode(estimatedMemoryMB);
        break;

      case 'video':
        // 動画ファイルの処理（音声抽出）
        estimatedMemoryMB = this.estimateVideoMemory(fileSizeMB);
        processingMode = this.determineProcessingMode(estimatedMemoryMB);
        break;

      default:
        // 不明なファイルタイプは保守的に推定
        estimatedMemoryMB = Math.max(100, fileSizeMB * 5);
        processingMode = 'medium';
        break;
    }

    // 安全係数を適用（1.5倍）
    const requiredMemoryMB = Math.ceil(estimatedMemoryMB * 1.5);

    // 現在のメモリ制限で処理可能かチェック
    const canProcessWithCurrent = requiredMemoryMB <= currentMemoryLimitMB;

    return {
      estimatedMemoryMB,
      requiredMemoryMB,
      canProcessWithCurrent,
      currentLimitMB: currentMemoryLimitMB,
      processingMode,
      fileType,
    };
  }

  /**
   * ファイル名からファイルタイプを判定
   */
  private determineFileType(fileName: string): 'transcript' | 'audio' | 'video' | 'unknown' {
    const extension = fileName.toLowerCase().split('.').pop() || '';

    // 文字起こし済み文書
    if (['txt', 'md', 'json', 'csv'].includes(extension)) {
      return 'transcript';
    }

    // 音声ファイル
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(extension)) {
      return 'audio';
    }

    // 動画ファイル
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(extension)) {
      return 'video';
    }

    return 'unknown';
  }

  /**
   * 音声ファイルのメモリ使用量を推定
   */
  private estimateAudioMemory(fileSizeMB: number): number {
    // 音声処理の段階別メモリ使用量
    // 1. 元ファイル読み込み: fileSizeMB
    // 2. FFmpeg変換: fileSizeMB × 2-4（圧縮解除）
    // 3. チャンク分割: fileSizeMB × 1.5
    // 4. API送信バッファ: 最大100MB程度

    if (fileSizeMB <= 10) {
      // 小容量: 基本的な処理
      return fileSizeMB * 6 + 100;
    } else if (fileSizeMB <= 100) {
      // 中容量: 標準的な処理
      return fileSizeMB * 5 + 200;
    } else if (fileSizeMB <= 500) {
      // 大容量: 効率的な処理
      return fileSizeMB * 4 + 300;
    } else {
      // 超大容量: 高度な最適化
      return fileSizeMB * 3 + 500;
    }
  }

  /**
   * 動画ファイルのメモリ使用量を推定
   */
  private estimateVideoMemory(fileSizeMB: number): number {
    // 動画は音声抽出がメイン
    // 音声処理の1.2倍程度のメモリを使用
    return this.estimateAudioMemory(fileSizeMB) * 1.2;
  }

  /**
   * 処理モードを決定
   */
  private determineProcessingMode(estimatedMemoryMB: number): 'light' | 'medium' | 'heavy' {
    if (estimatedMemoryMB <= 512) {
      return 'light';
    } else if (estimatedMemoryMB <= 2048) {
      return 'medium';
    } else {
      return 'heavy';
    }
  }

  /**
   * 推奨メモリ制限を計算
   */
  getRecommendedMemoryLimit(requiredMemoryMB: number): number {
    // 段階的なメモリ制限
    const memoryLevels = [1024, 2048, 4096, 6144, 8192]; // 1GB, 2GB, 4GB, 6GB, 8GB

    for (const level of memoryLevels) {
      if (requiredMemoryMB <= level) {
        return level;
      }
    }

    // 最大制限を超える場合は最大値を返す
    return memoryLevels[memoryLevels.length - 1];
  }

  /**
   * 現在のメモリ制限を取得
   */
  getCurrentMemoryLimit(): number {
    // Node.jsのメモリ制限を取得
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      // V8のヒープサイズ制限を取得（概算）
      return Math.floor(usage.heapTotal / (1024 * 1024) * 4); // 概算
    }
    return this.DEFAULT_MEMORY_LIMIT_MB;
  }

  /**
   * メモリ使用量の詳細情報を取得
   */
  getMemoryUsageInfo(): {
    current: number;
    peak: number;
    limit: number;
    available: number;
  } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const currentMB = Math.floor(usage.heapUsed / (1024 * 1024));
      const peakMB = Math.floor(usage.heapTotal / (1024 * 1024));
      const limitMB = this.getCurrentMemoryLimit();
      const availableMB = limitMB - currentMB;

      return {
        current: currentMB,
        peak: peakMB,
        limit: limitMB,
        available: availableMB,
      };
    }

    return {
      current: 0,
      peak: 0,
      limit: this.DEFAULT_MEMORY_LIMIT_MB,
      available: this.DEFAULT_MEMORY_LIMIT_MB,
    };
  }
}

// シングルトンインスタンス
export const memoryEstimationService = MemoryEstimationService.getInstance(); 