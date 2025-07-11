// ===========================================
// MinutesGen v1.0 - アプリケーション状態管理フック（認証統合）
// ===========================================

import { useState, useCallback, useEffect } from 'react';
import { 
  AudioFile, 
  ProcessingOptions, 
  MinutesData, 
  ProcessingProgress, 
  AppError,
  InfographicConfig,
  InfographicOutput,
  InfographicGenerationProgress,
} from '../types';
import { OpenAIService } from '../services/openai';
import { AuthService } from '../services/authService';
import { APIConfig, getAPIConfig, saveAPIConfig } from '../config/api';

// 進捗情報の詳細データ
interface DetailedProgress {
  lastUpdateTime: Date;
}



export interface AppState {
  // 基本状態
  currentStep: number;
  selectedFile: AudioFile | null;
  processingOptions: ProcessingOptions;
  results: MinutesData | null;
  error: AppError | null;
  isProcessing: boolean;
  
  // 進捗状態
  progress: ProcessingProgress | null;
  
  // API設定
  apiConfig: APIConfig;
  isApiConfigured: boolean;
  
  // インフォグラフィック
  infographic: {
    config: InfographicConfig | null;
    output: InfographicOutput | null;
    isGenerating: boolean;
    progress: InfographicGenerationProgress | null;
  };
}

export const useAppState = () => {
  // 認証サービス
  const [authService] = useState(() => AuthService.getInstance());
  
  // 状態管理
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    // speed: 'normal', // 削除（1倍速固定）
    // quality: 'standard', // 削除
    // outputFormats: ['markdown'], // 削除（3形式同時生成）
    language: 'ja',
    // speakerDetection: true, // 削除
    punctuation: true,
    timestamps: false,
    customPrompt: '',
    minutesModel: 'gpt-4.1',
    selectedPrompt: null,
    promptType: 'preset',
  });
  const [results, setResults] = useState<MinutesData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  
  // API設定管理
  const [apiConfig, setApiConfigState] = useState<APIConfig>(getAPIConfig());
  const [isApiConfigured, setIsApiConfigured] = useState(false);
  
  // インフォグラフィック状態
  const [infographic, setInfographic] = useState<AppState['infographic']>({
    config: null,
    output: null,
    isGenerating: false,
    progress: null,
  });

  // 詳細進捗情報の状態管理
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress>({
    lastUpdateTime: new Date(),
  });

  // OpenAI サービス
  const [openAIService] = useState(() => new OpenAIService());

  // 初期化時に認証状態をチェック
  useEffect(() => {
    const checkAuthStatus = async () => {
      const isAuthenticated = authService.isAuthenticated();
      setIsApiConfigured(isAuthenticated);
      
      if (!isAuthenticated) {
        // 初回起動時は認証画面を表示するため、ステップ0に設定
        setCurrentStep(0);
      } else {
        // 認証済みの場合はファイル選択画面に進む
        setCurrentStep(0);
      }
    };
    
    checkAuthStatus();
  }, [authService]);

  // シンプルな進捗更新
  const updateDetailedProgress = useCallback(() => {
    setDetailedProgress(prev => ({
      ...prev,
      lastUpdateTime: new Date(),
    }));
  }, []);

  // API設定の更新
  const updateApiConfig = useCallback((newConfig: Partial<APIConfig>) => {
    const updatedConfig = { ...apiConfig, ...newConfig };
    setApiConfigState(updatedConfig);
    saveAPIConfig(updatedConfig);
  }, [apiConfig]);

  // 認証状態の確認
  const checkAuthentication = useCallback(async (): Promise<boolean> => {
    try {
      const isAuthenticated = authService.isAuthenticated();
      const hasApiKey = await authService.getApiKey();
      
      const isConfigured = isAuthenticated && !!hasApiKey;
      setIsApiConfigured(isConfigured);
      
      return isConfigured;
    } catch (error) {
      console.error('認証確認エラー:', error);
      setIsApiConfigured(false);
      return false;
    }
  }, [authService]);

  // 処理の実行
  const processAudio = useCallback(async () => {
    if (!selectedFile) {
      setError({
        id: Date.now().toString(),
        code: 'NO_FILE',
        message: 'ファイルが選択されていません',
        timestamp: new Date(),
        recoverable: true,
      });
      return;
    }

    // 認証確認
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      setError({
        id: Date.now().toString(),
        code: 'NO_AUTH',
        message: '認証が必要です。初回セットアップを完了してください。',
        timestamp: new Date(),
        recoverable: true,
      });
      setCurrentStep(0); // 認証画面に戻す
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStep(2);

    try {
      let transcription: string;
      
      // ファイルタイプに応じた処理
      if (selectedFile.metadata?.fileType === 'document') {
        // 文書ファイルの場合は文字起こしをスキップして直接議事録生成
        const documentText = selectedFile.metadata.documentText || '';
        if (!documentText.trim()) {
          setError({
            id: Date.now().toString(),
            code: 'EMPTY_DOCUMENT',
            message: '文書ファイルの内容が空です。内容のあるファイルを選択してください。',
            timestamp: new Date(),
            recoverable: true,
          });
          return;
        }
        
        // 文書ファイルの場合は少し待機してからAPI呼び出し（429エラー対策）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        transcription = documentText;
        setProgress({
          stage: '文字起こし完了',
          percentage: 50,
          currentStep: 2,
          totalSteps: 3,
          estimatedTimeRemaining: 60,
          startTime: new Date(),
        });
      } else {
        // 音声・動画ファイルの場合は通常の文字起こし処理
        transcription = await openAIService.transcribeAudio(selectedFile, processingOptions, (progress) => {
          setProgress(progress);
        });
      }

      // 議事録生成
      const minutes = await openAIService.generateMinutes(
        transcription,
        processingOptions,
        setProgress
      );

      setResults(minutes);
      setCurrentStep(3); // 結果画面へ

    } catch (err: any) {
      console.error('処理エラー:', err);
      
      // 認証エラーの場合は特別な処理
      if (err.message?.includes('認証に失敗') || err.message?.includes('再度ログイン')) {
        setError({
          id: Date.now().toString(),
          code: 'AUTH_FAILED',
          message: '認証に失敗しました。再度ログインしてください。',
          timestamp: new Date(),
          recoverable: true,
        });
        setCurrentStep(0); // 認証画面に戻す
        return;
      }
      
      const errorMessage = err.response?.data?.error?.message || err.message || '不明なエラーが発生しました';
      setError({
        id: Date.now().toString(),
        code: err.code || 'PROCESSING_FAILED',
        message: `処理中にエラーが発生しました: ${errorMessage}`,
        details: err,
        timestamp: new Date(),
        recoverable: true,
      });
      setCurrentStep(2); // エラーが発生しても処理ステップに留まる
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, processingOptions, openAIService, checkAuthentication]);

  // インフォグラフィック関連のアクション
  const setInfographicConfig = useCallback((config: InfographicConfig) => {
    setInfographic(prev => ({ ...prev, config }));
  }, []);

  const generateInfographic = useCallback(async () => {
    if (!results || !infographic.config) return;

    setInfographic(prev => ({ ...prev, isGenerating: true }));
    
    try {
      // 認証確認
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        throw new Error('認証が必要です。初回セットアップを完了してください。');
      }

      const { InfographicGenerator } = await import('../services/infographicGenerator');
      const generator = new InfographicGenerator();
      
      const html = await generator.generateInfographic(
        results,
        infographic.config,
        (progress) => {
          setInfographic(prev => ({
            ...prev,
            progress: {
              stage: 'generating',
              percentage: progress,
              currentTask: 'インフォグラフィック生成中...',
              estimatedTimeRemaining: 0,
            }
          }));
        }
      );

      setInfographic(prev => ({
        ...prev,
        output: {
          html,
          metadata: {
            pageCount: 1,
            dimensions: { width: 800, height: 600 },
            generatedAt: new Date(),
            config: infographic.config!,
          },
        },
        isGenerating: false,
        progress: null,
      }));

    } catch (error) {
      console.error('インフォグラフィック生成エラー:', error);
      setError({
        id: Date.now().toString(),
        code: 'INFOGRAPHIC_FAILED',
        message: error instanceof Error ? error.message : 'インフォグラフィックの生成に失敗しました',
        timestamp: new Date(),
        recoverable: true,
      });
      setInfographic(prev => ({ ...prev, isGenerating: false, progress: null }));
    }
  }, [results, infographic.config, checkAuthentication]);

  // リセット機能
  const resetApp = useCallback(() => {
    setSelectedFile(null);
    setResults(null);
    setError(null);
    setProgress(null);
    setInfographic({
      config: null,
      output: null,
      isGenerating: false,
      progress: null,
    });
    setCurrentStep(1);
  }, []);

  // 認証リセット
  const resetAuth = useCallback(() => {
    authService.clearApiKeyFromMemory();
    setIsApiConfigured(false);
    setCurrentStep(0);
  }, [authService]);

  // 次のステップに進めるかチェック
  const canProceedToNextStep = useCallback(() => {
    if (currentStep === 0) {
      return selectedFile !== null;
    }
    if (currentStep === 1) {
      // 企業設定の非同期読み込みをスキップする場合でも、
      // 認証サービスから直接APIキーを取得できるかチェック
      try {
        const hasApiKey = authService.isAuthenticated();
        if (hasApiKey) {
          return true;
        }
        // フォールバック: isApiConfiguredもチェック
        return isApiConfigured;
      } catch (error) {
        console.warn('認証状態チェック中にエラー:', error);
        return isApiConfigured;
      }
    }
    return false;
  }, [currentStep, selectedFile, isApiConfigured, authService]);

  // エラーをクリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 状態
    currentStep,
    selectedFile,
    processingOptions,
    results,
    error,
    isProcessing,
    progress,
    apiConfig,
    isApiConfigured,
    infographic,
    detailedProgress,
    
    // アクション
    setCurrentStep,
    setSelectedFile,
    setProcessingOptions,
    setResults,
    setError,
    clearError,
    updateApiConfig,
    processAudio,
    resetApp,
    resetAuth,
    checkAuthentication,
    canProceedToNextStep,
    
    // インフォグラフィック
    setInfographicConfig,
    generateInfographic,
    updateDetailedProgress,
  };
}; 