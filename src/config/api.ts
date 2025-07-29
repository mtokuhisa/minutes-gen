// ===========================================
// MinutesGen v0.7.5 - API設定管理（ブラウザ対応）
// ===========================================

export interface APIConfig {
  baseUrl: string;
  openaiApiKey: string;
  /** 利用モデルは公式により固定。絶対に変更禁止 */
  transcribeModel: 'gpt-4o-transcribe';
  minutesModel: 'gpt-4.1' | 'o3';
  /** 利用モデルは公式により固定。絶対に変更禁止 */
  ttsModel: 'gpt-4o-mini-tts';
  maxFileSize: number;
  timeoutDuration: number;
  retryAttempts: number;
  devMode: boolean;
  debugLogs: boolean;
  // ハイブリッド版追加設定
  useCorporateKey: boolean;
  corporateKeySource: 'file' | 'env' | 'server';
  proxyUrl?: string;
  proxyAuth?: string;
  fallbackToPersonal: boolean;
  chunkSizeBytes?: number; // 音声ファイルのチャンクサイズ（デフォルト: 80MB）
}

// 企業設定ファイルの型定義
interface CorporateConfig {
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  proxyAuth?: string;
  maxUsers?: number;
  usageLimit?: number;
  allowPersonalKeys?: boolean;
}

// 安全な環境変数アクセス
const getEnvVar = (key: string): string | undefined => {
  // Node.js環境の場合
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  
  // ブラウザ環境では環境変数にアクセスできない
  return undefined;
};

// 企業設定キャッシュ（無限ループ防止）
let corporateConfigCache: CorporateConfig | null | undefined = undefined;
let corporateConfigCacheTime = 0;
const CACHE_DURATION = 10000; // 10秒間キャッシュ

// 企業設定ファイルを読み込み
const loadCorporateConfig = (): CorporateConfig | null => {
  // キャッシュチェック（無限ループ防止）
  const now = Date.now();
  if (corporateConfigCache !== undefined && (now - corporateConfigCacheTime) < CACHE_DURATION) {
    return corporateConfigCache;
  }

  try {
    // 方法1: 環境変数から読み込み（推奨）
    const envConfig = getEnvVar('CORPORATE_CONFIG');
    if (envConfig) {
      const config = JSON.parse(envConfig);
      corporateConfigCache = config;
      corporateConfigCacheTime = now;
      return config;
    }
    
    // 方法2: Electronの場合はipcRendererを使用（remote削除対応）
    if (typeof window !== 'undefined' && window.electronAPI) {
      // preloadスクリプト経由でcorporate-configを取得
      try {
        // 企業設定が存在する場合は使用し、存在しない場合は個人設定にフォールバック
        const config = window.electronAPI.getCorporateConfig();
        if (config && typeof config.then === 'function') {
          // 非同期の場合は警告を出すが、処理は続行
          console.log('Electron環境: 企業設定の非同期読み込みをスキップします。');
          // 認証サービスが利用可能な場合は、そちらに委ねる
          corporateConfigCache = null;
          corporateConfigCacheTime = now;
          return null;
        }
        corporateConfigCache = config;
        corporateConfigCacheTime = now;
        return config;
      } catch (error) {
        console.warn('Electron API経由での企業設定読み込みに失敗:', error);
        // エラーが発生しても処理を続行し、認証サービスに委ねる
        corporateConfigCache = null;
        corporateConfigCacheTime = now;
      }
    }
    
    // 方法3: 従来のrequire方式（開発環境のみ）
    if (typeof window !== 'undefined' && window.require && process.env.NODE_ENV === 'development') {
      const fs = window.require('fs');
      const path = window.require('path');
      
      // process.cwdを安全に使用
      const getCwd = () => {
        if (typeof process !== 'undefined' && process.cwd) {
          return process.cwd();
        }
        return './';
      };
      
      const appPath = getCwd();
      const fullPath = path.join(appPath, 'corporate-config.json');
      
      if (fs.existsSync(fullPath)) {
        const configData = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(configData);
      }
    }
    
    corporateConfigCache = null;
    corporateConfigCacheTime = now;
    return null;
  } catch (error) {
    console.warn('企業設定ファイルの読み込みに失敗:', error);
    corporateConfigCache = null;
    corporateConfigCacheTime = now;
    return null;
  }
};

// 環境変数から設定を取得
export const getAPIConfig = (): APIConfig => {
  // 企業設定を読み込み
  const corporateConfig = loadCorporateConfig();
  
  // ローカルストレージから設定を読み込み
  const savedConfig = localStorage.getItem('minutesgen_api_config');
  let localConfig = {};
  if (savedConfig) {
    try {
      localConfig = JSON.parse(savedConfig);
    } catch (error) {
      console.warn('ローカルストレージの設定が無効です:', error);
    }
  }

  // 企業KEYの優先使用を判定
  const useCorporateKey = corporateConfig?.apiKey && 
    (corporateConfig.allowPersonalKeys !== false || !(localConfig as any)?.openaiApiKey);

  return {
    baseUrl: corporateConfig?.baseUrl || (localConfig as any)?.baseUrl || 'https://api.openai.com/v1',
    openaiApiKey: useCorporateKey ? corporateConfig!.apiKey : (localConfig as any)?.openaiApiKey || '',
    transcribeModel: 'gpt-4o-transcribe',
    minutesModel: (localConfig as any)?.minutesModel || 'gpt-4.1',
    ttsModel: 'gpt-4o-mini-tts',
    maxFileSize: (localConfig as any)?.maxFileSize || 25 * 1024 * 1024, // 25MB
    timeoutDuration: (localConfig as any)?.timeoutDuration || 300000, // 5分
    retryAttempts: (localConfig as any)?.retryAttempts || 3,
    devMode: (localConfig as any)?.devMode || false,
    debugLogs: (localConfig as any)?.debugLogs || false,
    // ハイブリッド版設定
    useCorporateKey,
    corporateKeySource: corporateConfig ? 'file' : 'env',
    proxyUrl: corporateConfig?.proxyUrl || getEnvVar('HTTPS_PROXY') || getEnvVar('HTTP_PROXY'),
    proxyAuth: corporateConfig?.proxyAuth || getEnvVar('PROXY_AUTH'),
    fallbackToPersonal: Boolean(corporateConfig?.allowPersonalKeys ?? true),
    chunkSizeBytes: (localConfig as any)?.chunkSizeBytes || 80 * 1024 * 1024, // デフォルト80MB
  };
};

// API設定の保存
export const saveAPIConfig = (config: APIConfig): void => {
  try {
    // 企業設定は保存しない（読み取り専用）
    const { useCorporateKey, corporateKeySource, proxyUrl, proxyAuth, ...saveableConfig } = config;
    localStorage.setItem('minutesgen_api_config', JSON.stringify(saveableConfig));
  } catch (error) {
    console.error('API設定の保存に失敗しました:', error);
  }
};

// API設定のバリデーション
export const validateAPIConfig = (config: APIConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.openaiApiKey || config.openaiApiKey.trim() === '') {
    if (config.useCorporateKey) {
      errors.push('企業のOpenAI APIキーが設定されていません');
    } else {
      errors.push('OpenAI APIキーが設定されていません');
    }
  }

  if (!config.baseUrl || config.baseUrl.trim() === '') {
    errors.push('API Base URLが設定されていません');
  }

  if (config.maxFileSize <= 0) {
    errors.push('最大ファイルサイズが不正です');
  }

  if (config.timeoutDuration <= 0) {
    errors.push('タイムアウト時間が不正です');
  }

  if (config.retryAttempts < 0) {
    errors.push('再試行回数が不正です');
  }

  if (config.chunkSizeBytes !== undefined) {
    if (config.chunkSizeBytes < 10 * 1024 * 1024) { // 10MB未満
      errors.push('チャンクサイズが小さすぎます。最小値10MBを適用します。');
    }
    if (config.chunkSizeBytes > 100 * 1024 * 1024) { // 100MB超過
      errors.push('チャンクサイズが大きすぎます。最大値100MBを適用します。');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// デフォルト設定
export const DEFAULT_API_CONFIG: APIConfig = {
  baseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  transcribeModel: 'gpt-4o-transcribe',
  minutesModel: 'gpt-4.1',
  ttsModel: 'gpt-4o-mini-tts',
  maxFileSize: 25 * 1024 * 1024,
  timeoutDuration: 300000,
  retryAttempts: 3,
  devMode: false,
  debugLogs: false,
  useCorporateKey: false,
  corporateKeySource: 'file',
  fallbackToPersonal: true,
  chunkSizeBytes: 80 * 1024 * 1024, // デフォルト80MB
};

// 企業設定の状態を取得
export const getCorporateStatus = (): {
  available: boolean;
  hasCorporateKey: boolean;
  allowPersonalKeys: boolean;
  keySource: string;
  proxyConfigured: boolean;
} => {
  const corporateConfig = loadCorporateConfig();
  const config = getAPIConfig();
  
  return {
    available: !!corporateConfig?.apiKey,
    hasCorporateKey: !!corporateConfig?.apiKey,
    allowPersonalKeys: corporateConfig?.allowPersonalKeys !== false,
    keySource: config.useCorporateKey ? '企業アカウント' : '個人アカウント',
    proxyConfigured: !!config.proxyUrl,
  };
};

// 設定の取得とバリデーション
export const getValidatedAPIConfig = (): APIConfig => {
  const config = getAPIConfig();
  
  // Electron環境では認証サービスからAPIキーを取得するため、
  // 初期化時のAPIキー検証を緩和
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (isElectron && !config.openaiApiKey) {
    console.log('Electron環境: APIキーが未設定のため、認証サービスからの取得を待機します。');
    return {
      ...config,
      devMode: true,
      debugLogs: true,
    };
  }
  
  const validation = validateAPIConfig(config);
  
  if (!validation.isValid) {
    if (config.devMode) {
      console.warn('API設定に問題があります:', validation.errors);
      // 警告のみ表示してデフォルト値を使用
      return {
        ...DEFAULT_API_CONFIG,
        openaiApiKey: config.openaiApiKey, // APIキーは保持
        devMode: true,
        debugLogs: true,
      };
    } else {
      throw new Error(`API設定エラー: ${validation.errors.join(', ')}`);
    }
  }
  
  // チャンクサイズのバリデーション
  if (config.chunkSizeBytes !== undefined) {
    if (config.chunkSizeBytes < 10 * 1024 * 1024) { // 10MB未満
      console.warn('チャンクサイズが小さすぎます。最小値10MBを適用します。');
      config.chunkSizeBytes = 10 * 1024 * 1024;
    }
    if (config.chunkSizeBytes > 100 * 1024 * 1024) { // 100MB超過
      console.warn('チャンクサイズが大きすぎます。最大値100MBを適用します。');
      config.chunkSizeBytes = 100 * 1024 * 1024;
    }
  }
  
  return {
    ...config,
    chunkSizeBytes: config.chunkSizeBytes || 80 * 1024 * 1024, // デフォルト80MB
  };
}; 