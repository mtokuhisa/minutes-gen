// ===========================================
// MinutesGen v1.0 - API設定管理
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
}

// 環境変数から設定を取得
export const getAPIConfig = (): APIConfig => {
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

  return {
    baseUrl: (localConfig as any)?.baseUrl || 'https://api.openai.com/v1',
    openaiApiKey: (localConfig as any)?.openaiApiKey || '',
    transcribeModel: 'gpt-4o-transcribe',
    minutesModel: (localConfig as any)?.minutesModel || 'gpt-4.1',
    ttsModel: 'gpt-4o-mini-tts',
    maxFileSize: (localConfig as any)?.maxFileSize || 25 * 1024 * 1024, // 25MB
    timeoutDuration: (localConfig as any)?.timeoutDuration || 300000, // 5分
    retryAttempts: (localConfig as any)?.retryAttempts || 3,
    devMode: (localConfig as any)?.devMode || false,
    debugLogs: (localConfig as any)?.debugLogs || false,
  };
};

// API設定の保存
export const saveAPIConfig = (config: APIConfig): void => {
  try {
    localStorage.setItem('minutesgen_api_config', JSON.stringify(config));
  } catch (error) {
    console.error('API設定の保存に失敗しました:', error);
  }
};

// API設定のバリデーション
export const validateAPIConfig = (config: APIConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.openaiApiKey || config.openaiApiKey.trim() === '') {
    errors.push('OpenAI APIキーが設定されていません');
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
};

// 設定の取得とバリデーション
export const getValidatedAPIConfig = (): APIConfig => {
  const config = getAPIConfig();
  const validation = validateAPIConfig(config);
  
  if (!validation.isValid) {
    if (config.devMode) {
      console.warn('API設定に問題があります:', validation.errors);
      // 開発モードでは警告のみ表示してデフォルト値を使用
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
  
  return config;
}; 