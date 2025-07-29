"use strict";
// ===========================================
// クロスプラットフォーム対応 SafeLogger
// Windows 11 x64 + macOS ARM 両対応
// ===========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeInfo = exports.safeDebug = exports.safeWarn = exports.safeError = exports.safeLog = exports.safeLogger = exports.SafeLogger = void 0;
/**
 * Electronでのwrite EIOエラーを防ぐ安全なログシステム
 * 企業環境での1クリック利用に対応
 */
class SafeLogger {
    constructor() {
        this.logBuffer = [];
        this.maxBufferSize = 100;
        this.isProduction = process.env.NODE_ENV === 'production';
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }
    static getInstance() {
        if (!SafeLogger.instance) {
            SafeLogger.instance = new SafeLogger();
        }
        return SafeLogger.instance;
    }
    /**
     * 安全なログ出力（write EIOエラー回避）
     */
    log(message, ...args) {
        this.safeOutput('log', message, ...args);
    }
    /**
     * 安全なエラー出力（write EIOエラー回避）
     */
    error(message, ...args) {
        this.safeOutput('error', message, ...args);
    }
    /**
     * 安全なWarning出力（write EIOエラー回避）
     */
    warn(message, ...args) {
        this.safeOutput('warn', message, ...args);
    }
    /**
     * 開発環境専用ログ（本番環境では出力しない）
     */
    debug(message, ...args) {
        if (this.isDevelopment) {
            this.safeOutput('log', `[DEBUG] ${message}`, ...args);
        }
    }
    /**
     * 重要な情報のみ（本番環境でも出力）
     */
    info(message, ...args) {
        this.safeOutput('log', `[INFO] ${message}`, ...args);
    }
    /**
     * write EIOエラーを防ぐ安全な出力実装
     */
    safeOutput(level, message, ...args) {
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
        }
        catch (error) {
            // ログ出力エラーでアプリケーションを停止させない
            this.fallbackLog('SafeLogger出力エラー:', error);
        }
    }
    /**
     * 重要なログかどうかを判定
     */
    isImportantLog(message) {
        const importantKeywords = [
            '❌', '✅', 'エラー', 'Error', '完了', '失敗',
            '初期化', 'initialize', '処理開始', '処理完了'
        ];
        return importantKeywords.some(keyword => message.includes(keyword));
    }
    /**
     * ログメッセージの書式設定
     */
    formatLog(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
    }
    /**
     * バッファ管理（メモリリーク防止）
     */
    manageBuffer(logEntry) {
        this.logBuffer.push(logEntry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift(); // 古いログを削除
        }
    }
    /**
     * 安全なストリーム書き込み
     */
    writeToStream(level, logEntry) {
        try {
            // Node.jsのprocess.stderr/stdoutを直接使用
            const stream = level === 'error' ? process.stderr : process.stdout;
            if (stream && stream.writable && !stream.destroyed) {
                stream.write(logEntry + '\n');
            }
        }
        catch (error) {
            // ストリーム書き込みエラーでも継続
            this.fallbackLog('Stream write error:', error);
        }
    }
    /**
     * 最終フォールバック（すべて失敗した場合）
     */
    fallbackLog(message, error) {
        try {
            // 最小限の出力試行
            if (typeof console !== 'undefined' && console.log) {
                console.log(`[SafeLogger] ${message}`, error);
            }
        }
        catch {
            // 完全に失敗した場合は無視（アプリケーション継続優先）
        }
    }
    /**
     * バッファされたログの取得（デバッグ用）
     */
    getLogBuffer() {
        return [...this.logBuffer];
    }
    /**
     * バッファのクリア
     */
    clearBuffer() {
        this.logBuffer = [];
    }
}
exports.SafeLogger = SafeLogger;
// シングルトンインスタンス
exports.safeLogger = SafeLogger.getInstance();
// 便利な関数エクスポート
const safeLog = (message, ...args) => exports.safeLogger.log(message, ...args);
exports.safeLog = safeLog;
const safeError = (message, ...args) => exports.safeLogger.error(message, ...args);
exports.safeError = safeError;
const safeWarn = (message, ...args) => exports.safeLogger.warn(message, ...args);
exports.safeWarn = safeWarn;
const safeDebug = (message, ...args) => exports.safeLogger.debug(message, ...args);
exports.safeDebug = safeDebug;
const safeInfo = (message, ...args) => exports.safeLogger.info(message, ...args);
exports.safeInfo = safeInfo;
