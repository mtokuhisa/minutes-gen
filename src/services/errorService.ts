/**
 * 統一エラーハンドリングサービス
 * アプリケーション全体のエラー処理を統一管理
 */

export interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent?: string;
  url?: string;
  userId?: string;
}

export interface ErrorHandler {
  (error: Error, context?: Record<string, any>): void;
}

class ErrorService {
  private handlers: ErrorHandler[] = [];
  private reports: ErrorReport[] = [];

  /**
   * エラーハンドラーを登録
   */
  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  /**
   * エラーハンドラーを削除
   */
  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * エラーを処理
   */
  handleError(error: Error, context?: Record<string, any>): void {
    const report = this.createErrorReport(error, 'error', context);
    this.reports.push(report);

    // 登録されたハンドラーを実行
    this.handlers.forEach(handler => {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });

    // 開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error: ${error.message}`);
      console.error('Error:', error);
      console.error('Context:', context);
      console.error('Report:', report);
      console.groupEnd();
    }
  }

  /**
   * 警告を処理
   */
  handleWarning(message: string, context?: Record<string, any>): void {
    const warning = new Error(message);
    const report = this.createErrorReport(warning, 'warning', context);
    this.reports.push(report);

    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Warning:', message, context);
    }
  }

  /**
   * 情報を記録
   */
  handleInfo(message: string, context?: Record<string, any>): void {
    const info = new Error(message);
    const report = this.createErrorReport(info, 'info', context);
    this.reports.push(report);

    if (process.env.NODE_ENV === 'development') {
      console.info('ℹ️ Info:', message, context);
    }
  }

  /**
   * エラーレポートを作成
   */
  private createErrorReport(
    error: Error, 
    level: 'error' | 'warning' | 'info', 
    context?: Record<string, any>
  ): ErrorReport {
    return {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      message: error.message,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      // userId: getCurrentUserId(), // 将来的に実装
    };
  }

  /**
   * ユニークIDを生成
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * エラーレポートを取得
   */
  getReports(): ErrorReport[] {
    return [...this.reports];
  }

  /**
   * エラーレポートをクリア
   */
  clearReports(): void {
    this.reports = [];
  }

  /**
   * 特定レベルのレポートを取得
   */
  getReportsByLevel(level: 'error' | 'warning' | 'info'): ErrorReport[] {
    return this.reports.filter(report => report.level === level);
  }

  /**
   * エラーレポートを外部サービスに送信
   */
  async sendReports(): Promise<void> {
    if (this.reports.length === 0) return;

    try {
      // TODO: 外部ログサービスに送信
      // await fetch('/api/error-reports', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(this.reports),
      // });

      console.log('📤 Error reports would be sent:', this.reports);
      
      // 送信成功後はレポートをクリア
      this.clearReports();
    } catch (error) {
      console.error('Failed to send error reports:', error);
    }
  }
}

// シングルトンインスタンス
export const errorService = new ErrorService();

// 便利な関数をエクスポート
export const handleError = (error: Error, context?: Record<string, any>) => {
  errorService.handleError(error, context);
};

export const handleWarning = (message: string, context?: Record<string, any>) => {
  errorService.handleWarning(message, context);
};

export const handleInfo = (message: string, context?: Record<string, any>) => {
  errorService.handleInfo(message, context);
};

// 一般的なエラータイプの処理関数
export const handleApiError = (error: Error, endpoint?: string) => {
  handleError(error, { 
    type: 'api_error', 
    endpoint,
    timestamp: new Date().toISOString() 
  });
};

export const handleFileError = (error: Error, fileName?: string, fileSize?: number) => {
  handleError(error, { 
    type: 'file_error', 
    fileName, 
    fileSize,
    timestamp: new Date().toISOString() 
  });
};

export const handleValidationError = (message: string, field?: string, value?: any) => {
  handleWarning(message, { 
    type: 'validation_error', 
    field, 
    value,
    timestamp: new Date().toISOString() 
  });
};

// グローバルエラーハンドラーの設定
if (typeof window !== 'undefined') {
  // 未処理のエラーをキャッチ
  window.addEventListener('error', (event) => {
    handleError(event.error || new Error(event.message), {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // 未処理のPromise拒否をキャッチ
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    handleError(error, {
      type: 'unhandled_promise_rejection',
    });
  });
} 