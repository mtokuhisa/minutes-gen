// ===========================================
// クロスプラットフォーム対応 SafeLogger
// Windows 11 x64 + macOS ARM 両対応
// ===========================================

/**
 * Electronでのwrite EIOエラーを防ぐ安全なログシステム
 * 企業環境での1クリック利用に対応
 */
export class SafeLogger {
  private static instance: SafeLogger;
  private logBuffer: string[] = [];
  private maxBufferSize = 100;
  private isProduction = process.env.NODE_ENV === 'production';
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private constructor() {}
  
  public static getInstance(): SafeLogger {
    if (!SafeLogger.instance) {
      SafeLogger.instance = new SafeLogger();
    }
    return SafeLogger.instance;
  }
  
  /**
   * 安全なログ出力（write EIOエラー回避）
   */
  public log(message: string, ...args: any[]): void {
    this.safeOutput('log', message, ...args);
  }
  
  /**
   * 安全なエラー出力（write EIOエラー回避）
   */
  public error(message: string, ...args: any[]): void {
    this.safeOutput('error', message, ...args);
  }
  
  /**
   * 安全なWarning出力（write EIOエラー回避）
   */
  public warn(message: string, ...args: any[]): void {
    this.safeOutput('warn', message, ...args);
  }
  
  /**
   * 開発環境専用ログ（本番環境では出力しない）
   */
  public debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      this.safeOutput('log', `[DEBUG] ${message}`, ...args);
    }
  }
  
  /**
   * 重要な情報のみ（本番環境でも出力）
   */
  public info(message: string, ...args: any[]): void {
    this.safeOutput('log', `[INFO] ${message}`, ...args);
  }
  
  /**
   * write EIOエラーを防ぐ安全な出力実装
   */
  private safeOutput(level: 'log' | 'error' | 'warn', message: string, ...args: any[]): void {
    try {
      // 本番環境では重要なログのみ
      if (this.isProduction && !this.isImportantLog(message)) {
        return;
      }
      
      const logEntry = this.formatLog(level, message, ...args);
      
      // バッファサイズ制限
      this.manageBuffer(logEntry);
      
      // Electronの出力ストリームを直接使用
      this.writeToStream(level, logEntry);
      
    } catch (error) {
      // ログ出力エラーでアプリケーションを停止させない
      this.fallbackLog('SafeLogger出力エラー:', error);
    }
  }
  
  /**
   * 重要なログかどうかを判定
   */
  private isImportantLog(message: string): boolean {
    const importantKeywords = [
      '❌', '✅', 'エラー', 'Error', '完了', '失敗', 
      '初期化', 'initialize', '処理開始', '処理完了'
    ];
    return importantKeywords.some(keyword => message.includes(keyword));
  }
  
  /**
   * ログメッセージの書式設定
   */
  private formatLog(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
  }
  
  /**
   * バッファ管理（メモリリーク防止）
   */
  private manageBuffer(logEntry: string): void {
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // 古いログを削除
    }
  }
  
  /**
   * 安全なストリーム書き込み
   */
  private writeToStream(level: string, logEntry: string): void {
    try {
      // Node.jsのprocess.stderr/stdoutを直接使用
      const stream = level === 'error' ? process.stderr : process.stdout;
      
      if (stream && stream.writable && !stream.destroyed) {
        stream.write(logEntry + '\n');
      }
    } catch (error) {
      // ストリーム書き込みエラーでも継続
      this.fallbackLog('Stream write error:', error);
    }
  }
  
  /**
   * 最終フォールバック（すべて失敗した場合）
   */
  private fallbackLog(message: string, error?: any): void {
    try {
      // 最小限の出力試行
      if (typeof console !== 'undefined' && console.log) {
        console.log(`[SafeLogger] ${message}`, error);
      }
    } catch {
      // 完全に失敗した場合は無視（アプリケーション継続優先）
    }
  }
  
  /**
   * バッファされたログの取得（デバッグ用）
   */
  public getLogBuffer(): string[] {
    return [...this.logBuffer];
  }
  
  /**
   * バッファのクリア
   */
  public clearBuffer(): void {
    this.logBuffer = [];
  }
}

// シングルトンインスタンス
export const safeLogger = SafeLogger.getInstance();

// 便利な関数エクスポート
export const safeLog = (message: string, ...args: any[]) => safeLogger.log(message, ...args);
export const safeError = (message: string, ...args: any[]) => safeLogger.error(message, ...args);
export const safeWarn = (message: string, ...args: any[]) => safeLogger.warn(message, ...args);
export const safeDebug = (message: string, ...args: any[]) => safeLogger.debug(message, ...args);
export const safeInfo = (message: string, ...args: any[]) => safeLogger.info(message, ...args); 