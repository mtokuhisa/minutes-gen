/**
 * 包括的ログサービス
 * 開発・本番環境対応、レベル別出力、ローテーション機能付き
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
  context?: {
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: any;
  };
  performance?: {
    duration?: number;
    memory?: number;
    timestamp?: number;
  };
}

export interface LogConfig {
  level: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number; // ms
}

const defaultConfig: LogConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  maxEntries: 1000,
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  batchSize: 10,
  flushInterval: 5000,
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class LogService {
  private config: LogConfig;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;
  private pendingBatch: LogEntry[] = [];

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
    this.setupFlushTimer();
    this.loadStoredLogs();
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ログレベルが有効かチェック
   */
  private isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * ユニークIDを生成
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ログエントリを作成
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    context?: LogEntry['context']
  ): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context: {
        ...context,
        sessionId: this.sessionId,
      },
    };

    // エラーの場合はスタックトレースを追加
    if (level === 'error' || level === 'fatal') {
      if (data instanceof Error) {
        entry.stack = data.stack;
      } else if (typeof data === 'object' && data?.stack) {
        entry.stack = data.stack;
      }
    }

    // パフォーマンス情報を追加
    if (typeof performance !== 'undefined') {
      entry.performance = {
        timestamp: performance.now(),
        memory: (performance as any).memory?.usedJSHeapSize,
      };
    }

    return entry;
  }

  /**
   * ログを記録
   */
  private addLog(entry: LogEntry): void {
    if (!this.isLevelEnabled(entry.level)) return;

    // ローカルストレージに追加
    this.logs.push(entry);

    // 最大エントリ数を超えた場合は古いものを削除
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    // コンソール出力
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // ストレージに保存
    if (this.config.enableStorage) {
      this.saveToStorage();
    }

    // リモート送信用のバッチに追加
    if (this.config.enableRemote) {
      this.pendingBatch.push(entry);
      if (this.pendingBatch.length >= this.config.batchSize) {
        this.flushToRemote();
      }
    }
  }

  /**
   * コンソールに出力
   */
  private outputToConsole(entry: LogEntry): void {
    const { level, message, data, context } = entry;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const logData = [];
    if (context?.component) logData.push(`[${context.component}]`);
    if (context?.action) logData.push(`[${context.action}]`);
    
    const fullMessage = `${prefix} ${logData.join(' ')} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(fullMessage, data);
        break;
      case 'info':
        console.info(fullMessage, data);
        break;
      case 'warn':
        console.warn(fullMessage, data);
        break;
      case 'error':
      case 'fatal':
        console.error(fullMessage, data);
        if (entry.stack) {
          console.error('Stack trace:', entry.stack);
        }
        break;
    }
  }

  /**
   * ローカルストレージに保存
   */
  private saveToStorage(): void {
    try {
      const recentLogs = this.logs.slice(-100); // 最新100件のみ保存
      localStorage.setItem('app_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }

  /**
   * ローカルストレージから読み込み
   */
  private loadStoredLogs(): void {
    try {
      const stored = localStorage.getItem('app_logs');
      if (stored) {
        const logs = JSON.parse(stored) as LogEntry[];
        this.logs = logs.filter(log => 
          Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000 // 24時間以内
        );
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
  }

  /**
   * フラッシュタイマーを設定
   */
  private setupFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.config.enableRemote && this.pendingBatch.length > 0) {
        this.flushToRemote();
      }
    }, this.config.flushInterval);
  }

  /**
   * リモートサーバーに送信
   */
  private async flushToRemote(): Promise<void> {
    if (!this.config.remoteEndpoint || this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          logs: batch,
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to send logs to remote:', error);
      // 送信失敗時は再度バッチに戻す
      this.pendingBatch.unshift(...batch);
    }
  }

  /**
   * パブリックAPIメソッド
   */
  debug(message: string, data?: any, context?: LogEntry['context']): void {
    this.addLog(this.createLogEntry('debug', message, data, context));
  }

  info(message: string, data?: any, context?: LogEntry['context']): void {
    this.addLog(this.createLogEntry('info', message, data, context));
  }

  warn(message: string, data?: any, context?: LogEntry['context']): void {
    this.addLog(this.createLogEntry('warn', message, data, context));
  }

  error(message: string, data?: any, context?: LogEntry['context']): void {
    this.addLog(this.createLogEntry('error', message, data, context));
  }

  fatal(message: string, data?: any, context?: LogEntry['context']): void {
    this.addLog(this.createLogEntry('fatal', message, data, context));
  }

  /**
   * パフォーマンス測定
   */
  startPerformance(label: string, context?: LogEntry['context']): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.info(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` }, {
        ...context,
        component: 'Performance',
        action: 'measure',
      });
    };
  }

  /**
   * ログを取得
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logs = [];
    this.saveToStorage();
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupFlushTimer();
  }

  /**
   * ログをエクスポート
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    if (this.config.enableRemote && this.pendingBatch.length > 0) {
      this.flushToRemote();
    }
  }
}

// シングルトンインスタンス
export const logService = new LogService();

// 便利な関数をエクスポート
export const log = {
  debug: (message: string, data?: any, context?: LogEntry['context']) => 
    logService.debug(message, data, context),
  info: (message: string, data?: any, context?: LogEntry['context']) => 
    logService.info(message, data, context),
  warn: (message: string, data?: any, context?: LogEntry['context']) => 
    logService.warn(message, data, context),
  error: (message: string, data?: any, context?: LogEntry['context']) => 
    logService.error(message, data, context),
  fatal: (message: string, data?: any, context?: LogEntry['context']) => 
    logService.fatal(message, data, context),
  performance: (label: string, context?: LogEntry['context']) => 
    logService.startPerformance(label, context),
};

// 開発環境でのみグローバルに公開
if (process.env.NODE_ENV === 'development') {
  (window as any).logService = logService;
} 