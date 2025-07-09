import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  AppState,
  AudioFile,
  ProcessingOptions,
  ProcessingProgress,
  MinutesData,
  AppError,
  ProcessingStage,
  DEFAULT_PROCESSING_OPTIONS,
} from '../types';
import { 
  InfographicConfig, 
  InfographicOutput, 
  InfographicGenerationProgress 
} from '../types/infographic';
import { OpenAIService } from '../services/openai';
import { APIConfig, getAPIConfig, saveAPIConfig } from '../config/api';

// ===========================================
// MinutesGen v1.0 - アプリケーション状態管理フック
// ===========================================

interface UseAppStateReturn extends AppState {
  apiConfig: APIConfig;
  // アクション関数
  setCurrentStep: (step: number) => void;
  setSelectedFile: (file: AudioFile | null) => void;
  setProcessingOptions: React.Dispatch<React.SetStateAction<ProcessingOptions>>;
  setApiConfig: (config: Partial<APIConfig>) => void;
  startProcessing: () => Promise<void>;
  resetState: () => void;
  clearError: () => void;
  
  // インフォグラフィック関連
  setInfographicConfig: (config: InfographicConfig) => void;
  setInfographicOutput: (output: InfographicOutput | null) => void;
  setInfographicGenerating: (isGenerating: boolean) => void;
  setInfographicProgress: (progress: InfographicGenerationProgress | null) => void;
  setInfographicError: (error: string | null) => void;
  
  // ユーティリティ関数
  canProceedToNextStep: () => boolean;
  getTotalSteps: () => number;
  getStepName: (step: number) => string;
}

export const useAppState = (): UseAppStateReturn => {
  // 基本状態 - 順序を固定化
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>(
    DEFAULT_PROCESSING_OPTIONS
  );
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [results, setResults] = useState<MinutesData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [apiConfig, setApiConfigState] = useState<APIConfig>(getAPIConfig());
  
  // インフォグラフィック関連の状態 - 順序を固定化
  const [infographic, setInfographic] = useState<{
    config: InfographicConfig | null;
    output: InfographicOutput | null;
    isGenerating: boolean;
    progress: InfographicGenerationProgress | null;
    error: string | null;
  }>({
    config: null,
    output: null,
    isGenerating: false,
    progress: null,
    error: null,
  });

  // useMemoを最初に配置して順序を固定化
  const openAIService = useMemo(() => new OpenAIService(), []);
  const stepNames = useMemo(() => ['アップロード', 'オプション設定', 'AI処理', '結果確認'], []);

  // 設定更新関数
  const setApiConfig = useCallback((newConfig: Partial<APIConfig>) => {
    setApiConfigState(prevConfig => {
      const updatedConfig = { ...prevConfig, ...newConfig };
      saveAPIConfig(updatedConfig);
      return updatedConfig;
    });
  }, []);

  // エラークリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 次のステップに進めるかどうかの判定
  const canProceedToNextStep = useCallback(() => {
    switch (currentStep) {
      case 0: // アップロード
        return selectedFile !== null;
      case 1: // オプション設定
        // 出力形式が選択されていて、かつAPIキーが設定されている
        return processingOptions.outputFormats.length > 0 && 
               !!apiConfig.openaiApiKey && 
               apiConfig.openaiApiKey.trim() !== '';
      case 2: // 処理中
        return false; // 処理中は進めない
      case 3: // 結果
        return false; // 最終ステップ
      default:
        return false;
    }
  }, [currentStep, selectedFile, processingOptions, apiConfig]);

  // 処理開始
  const startProcessing = useCallback(async () => {
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

    if (!apiConfig.openaiApiKey) {
      setError({
        id: Date.now().toString(),
        code: 'NO_API_KEY',
        message: 'OpenAI APIキーが設定されていません。設定画面からキーを登録してください。',
        timestamp: new Date(),
        recoverable: true,
      });
      setCurrentStep(1); // 設定画面に戻す
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStep(2);

    try {
      // 実際のAPI処理を使用
      // 音声文字起こし
      const transcription = await openAIService.transcribeAudio(
        selectedFile,
        processingOptions,
        setProgress
      );

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
  }, [selectedFile, processingOptions, apiConfig, openAIService]);

  // インフォグラフィック関連のアクション
  const setInfographicConfig = useCallback((config: InfographicConfig) => {
    setInfographic(prev => ({ ...prev, config }));
  }, []);

  const setInfographicOutput = useCallback((output: InfographicOutput | null) => {
    setInfographic(prev => ({ ...prev, output }));
  }, []);

  const setInfographicGenerating = useCallback((isGenerating: boolean) => {
    setInfographic(prev => ({ ...prev, isGenerating }));
  }, []);

  const setInfographicProgress = useCallback((progress: InfographicGenerationProgress | null) => {
    setInfographic(prev => ({ ...prev, progress }));
  }, []);

  const setInfographicError = useCallback((error: string | null) => {
    setInfographic(prev => ({ ...prev, error }));
  }, []);

  // 状態リセット
  const resetState = useCallback(() => {
    setCurrentStep(0);
    setSelectedFile(null);
    setProcessingOptions(DEFAULT_PROCESSING_OPTIONS);
    setProgress(null);
    setResults(null);
    setError(null);
    setIsProcessing(false);
    setInfographic({
      config: null,
      output: null,
      isGenerating: false,
      progress: null,
      error: null,
    });
  }, []);

  // ユーティリティ関数
  const getTotalSteps = useCallback(() => stepNames.length, [stepNames]);
  const getStepName = useCallback((step: number) => stepNames[step] || '', [stepNames]);

  // エラーの自動クリア（10秒後）
  useEffect(() => {
    if (error && error.recoverable) {
      const timer = setTimeout(() => {
        clearError();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // 状態の返却
  return {
    // 状態
    currentStep,
    selectedFile,
    processingOptions,
    progress,
    results,
    error,
    isProcessing,
    apiConfig,
    infographic,

    // アクション
    setCurrentStep,
    setSelectedFile,
    setProcessingOptions,
    setApiConfig,
    startProcessing,
    resetState,
    clearError,

    // インフォグラフィック関連
    setInfographicConfig,
    setInfographicOutput,
    setInfographicGenerating,
    setInfographicProgress,
    setInfographicError,

    // ユーティリティ
    canProceedToNextStep,
    getTotalSteps,
    getStepName,
  };
};

// ===========================================
// 処理シミュレーション関数
// ===========================================

const simulateProcessing = async (
  setProgress: React.Dispatch<React.SetStateAction<ProcessingProgress | null>>
): Promise<void> => {
  const stages: { stage: ProcessingStage; task: string; duration: number }[] = [
    { stage: 'uploading', task: 'ファイルをアップロード中...', duration: 2000 },
    { stage: 'analyzing', task: '音声を解析中...', duration: 3000 },
    { stage: 'transcribing', task: '音声を文字起こし中...', duration: 8000 },
    { stage: 'generating', task: '議事録を生成中...', duration: 5000 },
    { stage: 'formatting', task: '出力を整形中...', duration: 2000 },
    { stage: 'completed', task: '処理完了！', duration: 0 },
  ];

  const totalDuration = stages.reduce((sum, stage) => sum + stage.duration, 0);
  let elapsedTime = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const startTime = Date.now();

    // ステージ開始
    setProgress(prev => prev ? {
      ...prev,
      stage: stage.stage,
      currentTask: stage.task,
      percentage: Math.round((elapsedTime / totalDuration) * 100),
      estimatedTimeRemaining: Math.round((totalDuration - elapsedTime) / 1000),
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: stage.task,
        },
      ],
    } : null);

    // プログレス更新
    if (stage.duration > 0) {
      const steps = 10;
      const stepDuration = stage.duration / steps;

      for (let step = 0; step < steps; step++) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
        elapsedTime += stepDuration;

        setProgress(prev => prev ? {
          ...prev,
          percentage: Math.min(Math.round((elapsedTime / totalDuration) * 100), 100),
          estimatedTimeRemaining: Math.max(Math.round((totalDuration - elapsedTime) / 1000), 0),
        } : null);
      }
    }
  }
}; 