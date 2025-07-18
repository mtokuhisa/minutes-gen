import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { useTheme } from './theme';
import { useAppState } from './hooks/useAppState';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { StepIndicator } from './components/StepIndicator';
import { AuthSetup } from './components/AuthSetup';
import { FileUpload } from './components/FileUpload';
import { ProcessingOptions } from './components/ProcessingOptions';
import { ProcessingProgress } from './components/ProcessingProgress';
import { Results } from './components/Results';
import { ErrorBoundary } from './components/ErrorBoundary';

// 新しいサービスのインポート
import { securityService } from './services/securityService';
import { accessibilityService } from './services/accessibilityService';
import { monitoringService } from './services/monitoringService';
import { safeMonitoringService } from './services/monitoringServiceSafe';
import { logService } from './services/logService';
import { OutputFormat, AudioFile } from './types';

function App() {
  const { theme } = useTheme();
  const {
    currentStep,
    selectedFile,
    processingOptions,
    results,
    progress,
    error,
    isProcessing,
    setCurrentStep,
    setSelectedFile,
    setProcessingOptions,
    processAudio,
    clearError,
    resetApp,
    setError,
  } = useAppState();

  // サービスの初期化
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // セキュリティサービスの初期化
        securityService.initialize();
        securityService.setSecurityHeaders();
        
        // アクセシビリティサービスの初期化
        accessibilityService.initialize();
        
        // 安全な監視サービスを段階的に有効化
        safeMonitoringService.initialize();
        
        // Phase 2: 基本的なパフォーマンス監視を有効化
        safeMonitoringService.updateConfig({
          enableBasicMetrics: true,
        });
        
        // 既存の監視サービスは引き続き無効化
        // monitoringService.initialize();
        
        // ログサービスは既にコンストラクタで初期化済み
        
        // 機能使用の追跡（安全版）
        safeMonitoringService.trackFeatureUsage('app-initialization');
        
        // アクセシビリティアナウンス
        accessibilityService.announce('MinutesGenが読み込まれました');
        
        console.log('🚀 全サービスが初期化されました');
        
      } catch (error) {
        console.error('サービス初期化エラー:', error);
        logService.error('サービス初期化に失敗しました', error);
      }
    };

    initializeServices();
  }, []);

  // エラー処理の改善
  useEffect(() => {
    if (error) {
      // 安全な監視サービスにエラーを報告
      safeMonitoringService.trackError({
        id: error.id,
        type: 'user',
        message: error.message,
        timestamp: error.timestamp,
        url: window.location.href,
        sessionId: safeMonitoringService.getUsageData().sessionId,
        context: {
          step: currentStep,
          recoverable: error.recoverable,
        },
      });
      
      // アクセシビリティアナウンス
      accessibilityService.announce(`エラーが発生しました: ${error.message}`, 'assertive');
      
      // ログ記録
      logService.error('アプリケーションエラー', error);
    }
  }, [error, currentStep]);

  // ステップ変更の追跡
  useEffect(() => {
    safeMonitoringService.trackAction('step-change', {
      from: currentStep > 0 ? currentStep - 1 : 0,
      to: currentStep,
      timestamp: new Date(),
    });
    
    // アクセシビリティ: ステップ変更のアナウンス
    const stepNames = ['認証設定', 'ファイル選択', '処理オプション', '処理中', '結果表示'];
    if (stepNames[currentStep]) {
      accessibilityService.announce(`ステップ ${currentStep + 1}: ${stepNames[currentStep]}`);
    }
  }, [currentStep]);

  // ファイル選択の追跡
  useEffect(() => {
    if (selectedFile) {
      // 大容量ファイル（100MB以上）に対するセキュリティ検証は制限を緩和
      if (selectedFile.rawFile) {
        const isLargeFile = selectedFile.size > 100 * 1024 * 1024; // 100MB
        
        if (!isLargeFile) {
          // 通常ファイルのセキュリティ検証
          const fileValidation = securityService.validateFile(selectedFile.rawFile);
          if (!fileValidation.isValid) {
            console.warn('ファイルセキュリティ検証警告:', fileValidation.errors);
            logService.warn('ファイルセキュリティ検証に失敗', { 
              fileName: selectedFile.name,
              errors: fileValidation.errors,
              fileSize: selectedFile.size
            });
          }
        } else {
          // 大容量ファイルは基本的なチェックのみ
          const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
          const fileName = selectedFile.name.toLowerCase();
          if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
            console.error('危険なファイル形式が検出されました:', fileName);
            logService.error('危険なファイル形式', { fileName: selectedFile.name });
          } else {
            logService.info('大容量ファイルのセキュリティ検証完了', { 
              fileName: selectedFile.name,
              fileSize: selectedFile.size
            });
          }
        }
      }
      
      // 使用状況の追跡
      safeMonitoringService.trackAction('file-selected', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.rawFile?.type || selectedFile.format,
        duration: selectedFile.duration,
      });
      
      // アクセシビリティアナウンス
      accessibilityService.announce(`ファイルが選択されました: ${selectedFile.name}`);
    }
  }, [selectedFile]);

  // 処理開始の追跡
  useEffect(() => {
    if (isProcessing) {
      safeMonitoringService.startPerformanceMeasure('audio-processing');
      safeMonitoringService.trackFeatureUsage('audio-processing');
      
      // アクセシビリティアナウンス
      accessibilityService.announce('音声処理を開始しました');
    }
  }, [isProcessing]);

  // 処理完了の追跡
  useEffect(() => {
    if (results && !isProcessing) {
      const processingTime = safeMonitoringService.endPerformanceMeasure('audio-processing');
      
      if (selectedFile) {
        safeMonitoringService.trackFileProcessing(selectedFile.size, processingTime);
      }
      
      // アクセシビリティアナウンス
      accessibilityService.announce('音声処理が完了しました');
    }
  }, [results, isProcessing, selectedFile]);

  const handleStepChange = (step: number) => {
    console.log('🔄 ステップ変更リクエスト:', { from: currentStep, to: step });
    setCurrentStep(step);
    console.log('✅ setCurrentStep実行完了:', step);
    
    // フォーカス管理
    setTimeout(() => {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        accessibilityService.setFocus(mainContent as HTMLElement);
      }
    }, 100);
  };

  const handleFileSelect = (audioFile: AudioFile | null) => {
    if (!audioFile) {
      setSelectedFile(null);
      return;
    }

    try {
      // 大容量ファイル（100MB以上）に対するセキュリティ検証は制限を緩和
      if (audioFile.rawFile) {
        const isLargeFile = audioFile.size > 100 * 1024 * 1024; // 100MB
        
        if (!isLargeFile) {
          // 通常ファイルのセキュリティ検証
          const validation = securityService.validateFile(audioFile.rawFile);
          if (!validation.isValid) {
            console.warn('ファイルセキュリティ検証警告:', validation.errors);
            logService.warn('ファイルセキュリティ検証に失敗', { 
              fileName: audioFile.name,
              errors: validation.errors,
              fileSize: audioFile.size
            });
          }
        } else {
          // 大容量ファイルは基本的なチェックのみ
          const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
          const fileName = audioFile.name.toLowerCase();
          if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
            console.error('危険なファイル形式が検出されました:', fileName);
            logService.error('危険なファイル形式', { fileName: audioFile.name });
            return; // 危険なファイルは処理を中止
          }
        }
      }
      
      setSelectedFile(audioFile);
      
      // ファイル選択の追跡
      monitoringService.trackFileProcessing(audioFile.size, 0);
      
    } catch (error) {
      console.error('ファイル選択エラー:', error);
      logService.error('ファイル選択に失敗しました', error);
    }
  };

  const handleProcessingOptionsChange = (options: typeof processingOptions) => {
    // 入力のサニタイゼーション
    if (options.customPrompt) {
      const sanitized = securityService.validateAndSanitizeText(options.customPrompt);
      if (!sanitized.isValid) {
        console.warn('カスタムプロンプトのサニタイゼーション:', sanitized.errors);
      }
      options.customPrompt = sanitized.sanitized;
    }
    
    setProcessingOptions(options);
  };

  const handleProcessStart = async () => {
    try {
      // パフォーマンス計測開始
      monitoringService.startPerformanceMeasure('transcription');
      
      await processAudio();
      
      // 処理完了の計測
      monitoringService.endPerformanceMeasure('transcription');
      
    } catch (error) {
      console.error('処理エラー:', error);
      logService.error('音声処理に失敗しました', error);
    }
  };

  const handleDownload = (format: OutputFormat) => {
    if (!results) return;
    
                const output = results.outputs.find(o => o.format === format);
                if (!output) return;

                const filenameBase = results.title.replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ヴー\s_-]/g, '').replace(/\s+/g, '_');
                const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'docx';
                
                let blob: Blob;
                
                if (format === 'word') {
      // DOCX形式の場合、Base64からバイナリに変換
      console.log('DOCXダウンロード処理開始:', {
        contentLength: output.content.length,
        contentType: 'base64'
      });
      
      try {
        // Base64デコードしてバイナリデータを取得
        const binaryString = atob(output.content);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
        
        // DOCX形式のMIMEタイプを指定
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        blob = new Blob([bytes], { type: mimeType });
        
        console.log('DOCX Blob作成完了:', {
          blobSize: blob.size,
          mimeType: blob.type
        });
                  } catch (error) {
        console.error('DOCX Base64デコードエラー:', error);
        // フォールバック: テキストとして処理
        blob = new Blob([output.content], { type: 'application/octet-stream' });
                  }
                } else {
      // HTML、Markdownの場合は通常のテキスト処理
      const mimeType = format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8';
                  blob = new Blob([output.content], { type: mimeType });
                }
    
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filenameBase}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
    
    // ダウンロード追跡
    safeMonitoringService.trackAction('download', {
      format,
      fileName: a.download,
      fileSize: output.size,
    });
    
    console.log('ダウンロード完了:', {
      format,
      fileName: a.download,
      fileSize: blob.size
    });
  };

  const renderCurrentStep = () => {
    console.log('🎯 renderCurrentStep実行:', { currentStep, isProcessing });
    switch (currentStep) {
      case 0:
        return (
          <AuthSetup
            open={true}
            onAuthSuccess={(result) => {
              handleStepChange(1);
              safeMonitoringService.trackFeatureUsage('auth-setup');
            }}
          />
        );
      case 1:
        return (
          <FileUpload
            onFileSelect={handleFileSelect}
            onNext={() => {
              console.log('FileUpload onNext called');
              handleStepChange(2);
              safeMonitoringService.trackFeatureUsage('file-upload');
            }}
            selectedFile={selectedFile}
            onError={setError}
          />
        );
      case 2:
        return (
          <ProcessingOptions
            options={processingOptions}
            onOptionsChange={handleProcessingOptionsChange}
            onNext={() => {
              console.log('ProcessingOptions onNext called');
              handleStepChange(3);
              handleProcessStart();
              safeMonitoringService.trackFeatureUsage('processing-options');
            }}
            disabled={isProcessing}
          />
        );
      case 3:
        return (
          <Box>
            {progress && (
              <ProcessingProgress
                progress={progress}
                selectedFile={selectedFile}
                onCancel={resetApp}
              />
            )}
          </Box>
        );
      case 4:
        return (
          results && (
            <Results
              results={results}
              onDownload={handleDownload}
              onBackToSettings={() => {
                handleStepChange(2);
                safeMonitoringService.trackAction('results-back');
              }}
              onClearAndRestart={() => {
                resetApp();
                safeMonitoringService.trackAction('results-reset');
              }}
            />
          )
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
              sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: 'background.default',
          }}
        >
          <AppHeader 
            onRestart={() => {
              resetApp();
              clearError();
              safeMonitoringService.trackAction('header-restart');
            }}
          />
          
          <Box
            component="main"
            id="main-content"
            role="main"
            aria-label="メインコンテンツ"
              sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              px: 2,
              py: 3,
            }}
          >
            <StepIndicator activeStep={currentStep - 1} isProcessing={isProcessing} />
            

            
            {renderCurrentStep()}
      </Box>

      <AppFooter />
        </Box>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App; 