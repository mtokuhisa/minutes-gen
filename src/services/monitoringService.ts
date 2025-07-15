/**
 * 監視・分析サービス
 * パフォーマンス計測、使用状況分析、エラー追跡
 */

// パフォーマンスメトリクス
export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
  
  // カスタムメトリクス
  appLoadTime: number;
  audioProcessingTime: number;
  transcriptionTime: number;
  minutesGenerationTime: number;
  
  // リソース使用量
  memoryUsage: number;
  cpuUsage: number;
  
  // ネットワーク
  networkLatency: number;
  bandwidthUsage: number;
}

// 使用状況データ
export interface UsageData {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  
  // ユーザー行動
  actions: UserAction[];
  pageViews: PageView[];
  
  // ファイル処理
  filesProcessed: number;
  totalProcessingTime: number;
  averageFileSize: number;
  
  // 機能使用状況
  featuresUsed: string[];
  errorCount: number;
  
  // セッション情報
  sessionDuration: number;
  deviceInfo: DeviceInfo;
  browserInfo: BrowserInfo;
}

// ユーザーアクション
export interface UserAction {
  type: string;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ページビュー
export interface PageView {
  path: string;
  timestamp: Date;
  duration: number;
  referrer?: string;
}

// デバイス情報
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
}

// ブラウザ情報
export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
  features: string[];
}

// エラー情報
export interface ErrorInfo {
  id: string;
  type: 'javascript' | 'network' | 'api' | 'user';
  message: string;
  stack?: string;
  timestamp: Date;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  context?: Record<string, unknown>;
}

// アラート設定
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  notifications: {
    email?: string;
    webhook?: string;
  };
}

// アラート
export interface Alert {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class MonitoringService {
  private sessionId: string;
  private userId?: string;
  private metrics: Partial<PerformanceMetrics> = {};
  private usageData: UsageData;
  private errors: ErrorInfo[] = [];
  private actions: UserAction[] = [];
  private pageViews: PageView[] = [];
  private isInitialized: boolean = false;
  private observer?: PerformanceObserver;
  private config: { alerting: AlertConfig };

  constructor() {
    this.sessionId = this.generateSessionId();
    this.usageData = this.initializeUsageData();
    this.config = {
      alerting: {
        enabled: true,
        thresholds: {
          errorRate: 0.05, // 5%
          responseTime: 3000, // 3秒
          memoryUsage: 0.95, // 95%（閾値を上げて頻繁なアラートを抑制）
          cpuUsage: 0.8, // 80%
        },
        notifications: {},
      }
    };
  }

  /**
   * 監視サービスの初期化
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.setupPerformanceMonitoring();
    this.setupErrorTracking();
    this.setupUsageTracking();
    this.setupNetworkMonitoring();
    this.isInitialized = true;

    console.log('📊 監視サービスが初期化されました');
  }

  /**
   * パフォーマンス監視の設定
   */
  private setupPerformanceMonitoring(): void {
    // Core Web Vitals の監視
    this.observeWebVitals();
    
    // カスタムメトリクスの監視
    this.startCustomMetrics();
    
    // リソース使用量の監視
    this.monitorResourceUsage();
  }

  /**
   * Core Web Vitals の監視
   */
  private observeWebVitals(): void {
    // LCP (Largest Contentful Paint)
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;
    });
    this.observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID (First Input Delay)
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.metrics.fid = entry.processingStart - entry.startTime;
      });
    });
    this.observer.observe({ entryTypes: ['first-input'] });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.metrics.cls = clsValue;
    });
    this.observer.observe({ entryTypes: ['layout-shift'] });

    // FCP (First Contentful Paint)
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime;
        }
      });
    });
    this.observer.observe({ entryTypes: ['paint'] });
  }

  /**
   * カスタムメトリクスの開始
   */
  private startCustomMetrics(): void {
    // アプリ読み込み時間
    const appLoadStart = performance.now();
    window.addEventListener('load', () => {
      this.metrics.appLoadTime = performance.now() - appLoadStart;
    });

    // メモリ使用量（対応ブラウザのみ）
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.metrics.memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
    }
  }

  /**
   * リソース使用量の監視
   */
  private monitorResourceUsage(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        this.metrics.memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
        
        // メモリ使用量のアラート（configが初期化されている場合のみ）
        if (this.config && this.config.alerting && this.config.alerting.enabled && this.metrics.memoryUsage > this.config.alerting.thresholds.memoryUsage) {
          this.sendAlert({
            type: 'performance',
            message: `メモリ使用量が閾値を超えました: ${this.metrics.memoryUsage}%`,
            severity: 'warning',
            timestamp: new Date(),
            metadata: {
              current: this.metrics.memoryUsage,
              threshold: this.config.alerting.thresholds.memoryUsage,
            },
          });
        }
      }
    }, 60000); // 60秒間隔（監視頻度を下げてパフォーマンス改善）
  }

  /**
   * エラー追跡の設定
   */
  private setupErrorTracking(): void {
    // JavaScript エラー
    window.addEventListener('error', (event) => {
      this.trackError({
        id: this.generateId(),
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date(),
        url: event.filename || window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
        userId: this.userId,
        context: {
          line: event.lineno,
          column: event.colno,
        },
      });
    });

    // Promise rejection エラー
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        id: this.generateId(),
        type: 'javascript',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
        userId: this.userId,
        context: {
          reason: event.reason,
        },
      });
    });
  }

  /**
   * 使用状況追跡の設定
   */
  private setupUsageTracking(): void {
    // ページビューの追跡
    this.trackPageView(window.location.pathname);

    // ユーザー操作の追跡
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.trackAction('click', {
        element: target.tagName,
        className: target.className,
        id: target.id,
        text: target.textContent?.substring(0, 50),
      });
    });

    // フォーム送信の追跡
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.trackAction('form-submit', {
        formId: form.id,
        formClass: form.className,
        action: form.action,
      });
    });
  }

  /**
   * ネットワーク監視の設定
   */
  private setupNetworkMonitoring(): void {
    // ネットワーク情報（対応ブラウザのみ）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.metrics.bandwidthUsage = connection.downlink || 0;
      this.metrics.networkLatency = connection.rtt || 0;
    }

    // API リクエストの監視
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(input, init);
        const endTime = performance.now();
        
        this.trackAction('api-request', {
          url: typeof input === 'string' ? input : input.url,
          method: init?.method || 'GET',
          status: response.status,
          duration: endTime - startTime,
        });

        return response;
      } catch (error) {
        const endTime = performance.now();
        
        this.trackError({
          id: this.generateId(),
          type: 'network',
          message: error instanceof Error ? error.message : 'Network error',
          timestamp: new Date(),
          url: typeof input === 'string' ? input : input.url,
          userAgent: navigator.userAgent,
          sessionId: this.sessionId,
          userId: this.userId,
          context: {
            method: init?.method || 'GET',
            duration: endTime - startTime,
          },
        });

        throw error;
      }
    };
  }

  /**
   * パフォーマンス計測の開始
   */
  public startPerformanceMeasure(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * パフォーマンス計測の終了
   */
  public endPerformanceMeasure(name: string): number {
    const endMark = `${name}-end`;
    const measureName = `${name}-measure`;
    
    performance.mark(endMark);
    performance.measure(measureName, `${name}-start`, endMark);
    
    const measure = performance.getEntriesByName(measureName)[0];
    const duration = measure.duration;

    // カスタムメトリクスに保存
    if (name === 'audio-processing') {
      this.metrics.audioProcessingTime = duration;
    } else if (name === 'transcription') {
      this.metrics.transcriptionTime = duration;
    } else if (name === 'minutes-generation') {
      this.metrics.minutesGenerationTime = duration;
    }

    return duration;
  }

  /**
   * ユーザーアクションの追跡
   */
  public trackAction(type: string, metadata?: Record<string, unknown>): void {
    const action: UserAction = {
      type,
      timestamp: new Date(),
      metadata,
    };

    this.actions.push(action);
    this.usageData.actions.push(action);
  }

  /**
   * ページビューの追跡
   */
  public trackPageView(path: string, referrer?: string): void {
    const pageView: PageView = {
      path,
      timestamp: new Date(),
      duration: 0,
      referrer,
    };

    this.pageViews.push(pageView);
    this.usageData.pageViews.push(pageView);
  }

  /**
   * エラーの追跡
   */
  public trackError(error: ErrorInfo): void {
    this.errors.push(error);
    this.usageData.errorCount++;

    // エラー率のチェック（configが初期化されている場合のみ）
    if (this.config && this.config.alerting) {
      const errorRate = this.calculateErrorRate();
      if (this.config.alerting.enabled && errorRate > this.config.alerting.thresholds.errorRate) {
        this.sendAlert({
          type: 'error',
          message: `エラー率が閾値を超えました: ${errorRate}%`,
          severity: 'critical',
          timestamp: new Date(),
          metadata: {
            current: errorRate,
            threshold: this.config.alerting.thresholds.errorRate,
            recentErrors: this.errors.slice(-5),
          },
        });
      }
    }
  }

  /**
   * カスタムメトリクスの記録
   */
  public recordMetric(name: string, value: number, unit?: string): void {
    const metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
    };

    // メトリクスストレージに保存
    this.trackAction('metric-recorded', metric);
  }

  /**
   * ファイル処理の追跡
   */
  public trackFileProcessing(fileSize: number, processingTime: number): void {
    this.usageData.filesProcessed++;
    this.usageData.totalProcessingTime += processingTime;
    this.usageData.averageFileSize = (this.usageData.averageFileSize * (this.usageData.filesProcessed - 1) + fileSize) / this.usageData.filesProcessed;

    this.trackAction('file-processed', {
      fileSize,
      processingTime,
      averageFileSize: this.usageData.averageFileSize,
    });
  }

  /**
   * 機能使用の追跡
   */
  public trackFeatureUsage(featureName: string): void {
    if (!this.usageData.featuresUsed.includes(featureName)) {
      this.usageData.featuresUsed.push(featureName);
    }

    this.trackAction('feature-used', { feature: featureName });
  }

  /**
   * エラー率の計算
   */
  private calculateErrorRate(): number {
    const totalActions = this.actions.length;
    const errorCount = this.errors.length;
    return totalActions > 0 ? errorCount / totalActions : 0;
  }

  /**
   * アラートを送信
   */
  private sendAlert(alert: Alert): void {
    if (this.config && this.config.alerting && this.config.alerting.enabled) {
      // コンソールに出力（開発用）
      console.log('🚨 アラート:', {
        type: alert.type,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp,
        metadata: alert.metadata
      });

      // 実際のアラートシステムへの送信は実装に応じて追加
      // 例: Slack、Discord、メール、Webhook等
    }
  }

  /**
   * 使用状況データの初期化
   */
  private initializeUsageData(): UsageData {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date(),
      actions: [],
      pageViews: [],
      filesProcessed: 0,
      totalProcessingTime: 0,
      averageFileSize: 0,
      featuresUsed: [],
      errorCount: 0,
      sessionDuration: 0,
      deviceInfo: this.getDeviceInfo(),
      browserInfo: this.getBrowserInfo(),
    };
  }

  /**
   * デバイス情報の取得
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  }

  /**
   * ブラウザ情報の取得
   */
  private getBrowserInfo(): BrowserInfo {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';
    let engine = 'Unknown';

    // ブラウザ検出
    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Blink';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Gecko';
    } else if (userAgent.includes('Safari')) {
      name = 'Safari';
      version = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
      engine = 'WebKit';
    }

    // 機能検出
    const features: string[] = [];
    if ('serviceWorker' in navigator) features.push('ServiceWorker');
    if ('webkitSpeechRecognition' in window) features.push('SpeechRecognition');
    if ('MediaRecorder' in window) features.push('MediaRecorder');
    if ('indexedDB' in window) features.push('IndexedDB');

    return { name, version, engine, features };
  }

  /**
   * セッションIDの生成
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * IDの生成
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ユーザーIDの設定
   */
  public setUserId(userId: string): void {
    this.userId = userId;
    this.usageData.userId = userId;
  }

  /**
   * 現在のメトリクスを取得
   */
  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * 使用状況データを取得
   */
  public getUsageData(): UsageData {
    // セッション継続時間を更新
    this.usageData.sessionDuration = Date.now() - this.usageData.timestamp.getTime();
    return { ...this.usageData };
  }

  /**
   * エラー情報を取得
   */
  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  /**
   * レポートの生成
   */
  public generateReport(): {
    metrics: Partial<PerformanceMetrics>;
    usage: UsageData;
    errors: ErrorInfo[];
    summary: {
      totalActions: number;
      errorRate: number;
      averageResponseTime: number;
      topFeatures: string[];
    };
  } {
    const metrics = this.getMetrics();
    const usage = this.getUsageData();
    const errors = this.getErrors();

    // サマリー計算
    const totalActions = this.actions.length;
    const errorRate = this.calculateErrorRate();
    const averageResponseTime = this.calculateAverageResponseTime();
    const topFeatures = this.getTopFeatures();

    return {
      metrics,
      usage,
      errors,
      summary: {
        totalActions,
        errorRate,
        averageResponseTime,
        topFeatures,
      },
    };
  }

  /**
   * 平均応答時間の計算
   */
  private calculateAverageResponseTime(): number {
    const apiActions = this.actions.filter(action => action.type === 'api-request');
    if (apiActions.length === 0) return 0;

    const totalTime = apiActions.reduce((sum, action) => {
      return sum + (action.metadata?.duration as number || 0);
    }, 0);

    return totalTime / apiActions.length;
  }

  /**
   * 上位機能の取得
   */
  private getTopFeatures(): string[] {
    const featureCount = new Map<string, number>();
    
    this.actions.forEach(action => {
      if (action.type === 'feature-used') {
        const feature = action.metadata?.feature as string;
        if (feature) {
          featureCount.set(feature, (featureCount.get(feature) || 0) + 1);
        }
      }
    });

    return Array.from(featureCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([feature]) => feature);
  }

  /**
   * 設定の更新
   */
  public updateConfig(config: Partial<AlertConfig>): void {
    if (this.config && this.config.alerting) {
      this.config.alerting = { ...this.config.alerting, ...config };
      console.log('📊 監視設定が更新されました');
    }
  }

  /**
   * データのクリア
   */
  public clearData(): void {
    this.actions = [];
    this.pageViews = [];
    this.errors = [];
    this.usageData = this.initializeUsageData();
    console.log('📊 監視データがクリアされました');
  }
}

// シングルトンインスタンス
let monitoringServiceInstance: MonitoringService | null = null;

export const monitoringService = (() => {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new MonitoringService();
  }
  return monitoringServiceInstance;
})();

// HMR対応: 開発環境でのみインスタンスをリセット
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    monitoringServiceInstance = null;
  });
} 