/**
 * 安全な軽量版監視サービス
 * 段階的な有効化のためのミニマル実装
 */

export interface SafeErrorInfo {
  id: string;
  type: 'javascript' | 'network' | 'api' | 'user';
  message: string;
  timestamp: Date;
  url: string;
  sessionId: string;
  context?: Record<string, unknown>;
}

export interface SafeConfig {
  enabled: boolean;
  maxErrors: number;
  maxActions: number;
  enableConsoleOutput: boolean;
  enableErrorTracking: boolean;
  enableBasicMetrics: boolean;
}

export class SafeMonitoringService {
  private static instance: SafeMonitoringService;
  private sessionId: string;
  private errors: SafeErrorInfo[] = [];
  private actions: Array<{ type: string; timestamp: Date; metadata?: any }> = [];
  private isInitialized: boolean = false;
  private config: SafeConfig;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      enabled: true,
      maxErrors: 50, // 制限を設けてメモリリークを防ぐ
      maxActions: 100,
      enableConsoleOutput: true,
      enableErrorTracking: true,
      enableBasicMetrics: false, // 初期は無効
    };
  }

  public static getInstance(): SafeMonitoringService {
    if (!SafeMonitoringService.instance) {
      SafeMonitoringService.instance = new SafeMonitoringService();
    }
    return SafeMonitoringService.instance;
  }

  /**
   * 安全な初期化（最小限の機能のみ）
   */
  public initialize(): void {
    if (this.isInitialized || !this.config.enabled) return;

    try {
      // 基本的なエラー追跡のみ設定
      if (this.config.enableErrorTracking) {
        this.setupBasicErrorTracking();
      }

      this.isInitialized = true;
      
      if (this.config.enableConsoleOutput) {
        console.log('🛡️ 安全な監視サービスが初期化されました');
      }
    } catch (error) {
      console.error('監視サービス初期化エラー:', error);
      // 初期化に失敗してもアプリケーションを停止させない
    }
  }

  /**
   * 基本的なエラー追跡（安全版）
   */
  private setupBasicErrorTracking(): void {
    // JavaScript エラーの追跡（try-catchで保護）
    window.addEventListener('error', (event) => {
      try {
        this.trackError({
          id: this.generateId(),
          type: 'javascript',
          message: event.message || 'Unknown error',
          timestamp: new Date(),
          url: event.filename || window.location.href,
          sessionId: this.sessionId,
          context: {
            line: event.lineno,
            column: event.colno,
          },
        });
      } catch (trackingError) {
        // エラー追跡でエラーが発生しても無視
        console.warn('エラー追跡に失敗:', trackingError);
      }
    });

    // Promise rejection エラーの追跡（安全版）
    window.addEventListener('unhandledrejection', (event) => {
      try {
        this.trackError({
          id: this.generateId(),
          type: 'javascript',
          message: event.reason?.message || 'Unhandled Promise Rejection',
          timestamp: new Date(),
          url: window.location.href,
          sessionId: this.sessionId,
          context: {
            reason: typeof event.reason === 'string' ? event.reason : 'Unknown',
          },
        });
      } catch (trackingError) {
        console.warn('Promise rejection追跡に失敗:', trackingError);
      }
    });
  }

  /**
   * エラーの追跡（安全版）
   */
  public trackError(error: SafeErrorInfo): void {
    if (!this.config.enabled || !this.config.enableErrorTracking) return;

    try {
      // 配列サイズを制限してメモリリークを防ぐ
      if (this.errors.length >= this.config.maxErrors) {
        this.errors = this.errors.slice(-Math.floor(this.config.maxErrors / 2));
      }

      this.errors.push(error);

      if (this.config.enableConsoleOutput) {
        console.warn('🚨 エラー追跡:', {
          type: error.type,
          message: error.message,
          timestamp: error.timestamp,
        });
      }
    } catch (trackingError) {
      console.warn('エラー追跡処理に失敗:', trackingError);
    }
  }

  /**
   * アクションの追跡（軽量版）
   */
  public trackAction(type: string, metadata?: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    try {
      // 配列サイズを制限
      if (this.actions.length >= this.config.maxActions) {
        this.actions = this.actions.slice(-Math.floor(this.config.maxActions / 2));
      }

      this.actions.push({
        type,
        timestamp: new Date(),
        metadata,
      });
    } catch (error) {
      console.warn('アクション追跡に失敗:', error);
    }
  }

  /**
   * パフォーマンス計測（軽量版）
   */
  public startPerformanceMeasure(name: string): void {
    if (!this.config.enabled || !this.config.enableBasicMetrics) return;

    try {
      performance.mark(`${name}-start`);
    } catch (error) {
      console.warn('パフォーマンス計測開始に失敗:', error);
    }
  }

  public endPerformanceMeasure(name: string): number {
    if (!this.config.enabled || !this.config.enableBasicMetrics) return 0;

    try {
      const endMark = `${name}-end`;
      const measureName = `${name}-measure`;
      
      performance.mark(endMark);
      performance.measure(measureName, `${name}-start`, endMark);
      
      const measure = performance.getEntriesByName(measureName)[0];
      return measure ? measure.duration : 0;
    } catch (error) {
      console.warn('パフォーマンス計測終了に失敗:', error);
      return 0;
    }
  }

  /**
   * 機能使用の追跡（軽量版）
   */
  public trackFeatureUsage(featureName: string): void {
    this.trackAction('feature-used', { feature: featureName });
  }

  /**
   * ファイル処理の追跡（軽量版）
   */
  public trackFileProcessing(fileSize: number, processingTime: number): void {
    this.trackAction('file-processed', { fileSize, processingTime });
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<SafeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableConsoleOutput) {
      console.log('🛡️ 監視サービス設定更新:', this.config);
    }
  }

  /**
   * データの取得（安全版）
   */
  public getErrors(): SafeErrorInfo[] {
    return [...this.errors];
  }

  public getActions(): Array<{ type: string; timestamp: Date; metadata?: any }> {
    return [...this.actions];
  }

  public getUsageData(): {
    sessionId: string;
    errorCount: number;
    actionCount: number;
    sessionDuration: number;
  } {
    return {
      sessionId: this.sessionId,
      errorCount: this.errors.length,
      actionCount: this.actions.length,
      sessionDuration: Date.now() - new Date(this.sessionId.split('_')[1]).getTime(),
    };
  }

  /**
   * データのクリア
   */
  public clearData(): void {
    this.errors = [];
    this.actions = [];
    
    if (this.config.enableConsoleOutput) {
      console.log('🛡️ 監視データをクリアしました');
    }
  }

  /**
   * サービスの停止
   */
  public shutdown(): void {
    this.isInitialized = false;
    this.clearData();
    
    if (this.config.enableConsoleOutput) {
      console.log('🛡️ 監視サービスを停止しました');
    }
  }

  /**
   * ユーティリティ関数
   */
  private generateSessionId(): string {
    return `safe_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// シングルトンインスタンスをエクスポート
export const safeMonitoringService = SafeMonitoringService.getInstance(); 