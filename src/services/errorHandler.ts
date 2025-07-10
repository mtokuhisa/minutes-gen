// ===========================================
// MinutesGen v1.0 - エラーハンドリングサービス
// ===========================================

export interface APIError {
  code: string;
  message: string;
  statusCode?: number;
  retryAfter?: number;
  isRetryable: boolean;
  userMessage: string;
  technicalDetails?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 30000, // 30秒
    backoffMultiplier: 2,
  };

  /**
   * OpenAI APIエラーを解析してユーザーフレンドリーなエラー情報を生成
   */
  static handleOpenAIError(error: any): APIError {
    const statusCode = error.response?.status || error.status;
    const errorData = error.response?.data || error.data || {};
    const errorMessage = errorData.error?.message || error.message || '不明なエラー';
    const errorCode = errorData.error?.code || 'unknown_error';

    switch (statusCode) {
      case 400:
        return {
          code: 'bad_request',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: 'リクエストに問題があります。ファイル形式やサイズを確認してください。',
          technicalDetails: errorMessage,
        };

      case 401:
        return {
          code: 'unauthorized',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: 'API認証に失敗しました。APIキーを確認してください。',
          technicalDetails: errorMessage,
        };

      case 403:
        return {
          code: 'forbidden',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: 'このAPIキーには権限がありません。プランやクレジットを確認してください。',
          technicalDetails: errorMessage,
        };

      case 404:
        return {
          code: 'not_found',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: 'APIエンドポイントが見つかりません。アプリケーションを最新版に更新してください。',
          technicalDetails: errorMessage,
        };

      case 413:
        return {
          code: 'payload_too_large',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: 'ファイルサイズが大きすぎます。ファイルを分割するか、より小さなファイルをお試しください。',
          technicalDetails: errorMessage,
        };

      case 429:
        const retryAfter = this.parseRetryAfter(error.response?.headers?.['retry-after']);
        return {
          code: 'rate_limit_exceeded',
          message: errorMessage,
          statusCode,
          retryAfter,
          isRetryable: true,
          userMessage: `利用制限に達しました。${retryAfter ? `${retryAfter}秒後` : '少し時間をおいて'}に自動で再試行します。`,
          technicalDetails: errorMessage,
        };

      case 500:
        return {
          code: 'internal_server_error',
          message: errorMessage,
          statusCode,
          isRetryable: true,
          userMessage: 'OpenAIサーバーで一時的な問題が発生しています。自動で再試行します。',
          technicalDetails: errorMessage,
        };

      case 502:
      case 503:
      case 504:
        return {
          code: 'service_unavailable',
          message: errorMessage,
          statusCode,
          isRetryable: true,
          userMessage: 'OpenAIサービスが一時的に利用できません。自動で再試行します。',
          technicalDetails: errorMessage,
        };

      default:
        // ネットワークエラーやタイムアウト
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          return {
            code: 'timeout',
            message: 'リクエストがタイムアウトしました',
            isRetryable: true,
            userMessage: 'ネットワークの応答が遅いため、自動で再試行します。',
            technicalDetails: error.message,
          };
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return {
            code: 'network_error',
            message: 'ネットワーク接続エラー',
            isRetryable: true,
            userMessage: 'インターネット接続を確認してください。自動で再試行します。',
            technicalDetails: error.message,
          };
        }

        return {
          code: 'unknown_error',
          message: errorMessage,
          statusCode,
          isRetryable: false,
          userMessage: '予期しないエラーが発生しました。しばらく時間をおいてから再度お試しください。',
          technicalDetails: error.message || JSON.stringify(error),
        };
    }
  }

  /**
   * 自動リトライ機能付きのAPI実行
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    onProgress?: (message: string, attempt: number, maxRetries: number) => void,
    retryConfig: RetryConfig = ErrorHandler.DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    let lastError: APIError | null = null;

    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const apiError = this.handleOpenAIError(error);
        lastError = apiError;

        // 最後の試行の場合はエラーを投げる
        if (attempt > retryConfig.maxRetries) {
          throw apiError;
        }

        // リトライ不可能なエラーの場合は即座にエラーを投げる
        if (!apiError.isRetryable) {
          throw apiError;
        }

        // リトライ待機時間を計算
        const delay = apiError.retryAfter 
          ? apiError.retryAfter * 1000 
          : Math.min(
              retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
              retryConfig.maxDelay
            );

        // 進捗通知
        onProgress?.(
          `${apiError.userMessage} (${attempt}/${retryConfig.maxRetries}回目の試行)`,
          attempt,
          retryConfig.maxRetries
        );

        // 待機
        await this.delay(delay);
      }
    }

    // 理論上ここには到達しないが、型安全性のため
    throw lastError || new Error('不明なエラー');
  }

  /**
   * Retry-Afterヘッダーを解析
   */
  private static parseRetryAfter(retryAfter?: string): number | undefined {
    if (!retryAfter) return undefined;

    const seconds = parseInt(retryAfter, 10);
    if (isNaN(seconds)) return undefined;

    return Math.min(seconds, 300); // 最大5分に制限
  }

  /**
   * 指定された時間だけ待機
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * エラーメッセージを日本語化
   */
  static getJapaneseErrorMessage(error: APIError): string {
    const baseMessage = error.userMessage;
    
    if (error.code === 'rate_limit_exceeded' && error.retryAfter) {
      const minutes = Math.ceil(error.retryAfter / 60);
      return `${baseMessage} 約${minutes}分後に自動で再開されます。`;
    }

    return baseMessage;
  }

  /**
   * 技術者向けの詳細エラー情報を生成
   */
  static getTechnicalErrorInfo(error: APIError): string {
    const parts: string[] = [
      `エラーコード: ${error.code}`,
    ];

    if (error.statusCode) {
      parts.push(`HTTPステータス: ${error.statusCode}`);
    }

    if (error.technicalDetails) {
      parts.push(`詳細: ${error.technicalDetails}`);
    }

    return parts.join(' | ');
  }
} 