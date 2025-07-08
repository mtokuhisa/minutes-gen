import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  CssBaseline,
  Button,
  Fab,
  Zoom,
  Snackbar,
  Alert,
} from '@mui/material';
import { PlayArrow, Refresh } from '@mui/icons-material';
import { ThemeProvider, useTheme } from './theme';
import { useAppState } from './hooks/useAppState';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { StepIndicator } from './components/StepIndicator';
import { FileUpload } from './components/FileUpload';
import { ProcessingOptions } from './components/ProcessingOptions';
import { ProcessingProgress } from './components/ProcessingProgress';
import { Results } from './components/Results';
import { APIKeySetup } from './components/APIKeySetup';
import { OutputFormat } from './types';
import { getAPIConfig, validateAPIConfig } from './config/api';

// ===========================================
// MinutesGen v1.0 - メインアプリケーション
// ===========================================

const AppContent: React.FC = () => {
  const { themeMode } = useTheme();
  const [showAPISetup, setShowAPISetup] = useState(false);
  
  const {
    // 状態
    currentStep,
    selectedFile,
    processingOptions,
    progress,
    results,
    error,
    isProcessing,
    
    // アクション
    setCurrentStep,
    setSelectedFile,
    setProcessingOptions,
    startProcessing,
    resetState,
    clearError,
    
    // ユーティリティ
    canProceedToNextStep,
    getTotalSteps,
    getStepName,
  } = useAppState();

  // 初期化時にAPIキー設定をチェック
  useEffect(() => {
    const config = getAPIConfig();
    const validation = validateAPIConfig(config);
    
    if (!validation.isValid) {
      setShowAPISetup(true);
    }
  }, []);

  // 次のステップに進む
  const handleNextStep = () => {
    if (canProceedToNextStep()) {
      if (currentStep === 1) {
        // オプション設定から処理開始
        startProcessing();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  // 前のステップに戻る
  const handlePrevStep = () => {
    if (currentStep > 0 && !isProcessing) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ファイルダウンロード
  const handleDownload = (format: OutputFormat) => {
    if (!results) return;
    
    const output = results.outputs.find(o => o.format === format);
    if (!output) return;

    // 実際の実装では、ここでファイルダウンロードを行う
    const blob = new Blob([output.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${results.title}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 新しい議事録生成を開始
  const handleRestart = () => {
    resetState();
  };

  // ステップに応じたコンテンツを表示
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // ファイルアップロード
        return (
          <FileUpload
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
        );
      
      case 1: // オプション設定
        return (
          <ProcessingOptions
            options={processingOptions}
            onOptionsChange={setProcessingOptions}
          />
        );
      
      case 2: // AI処理
        return progress ? (
          <ProcessingProgress
            progress={progress}
            showLogs={true}
          />
        ) : null;
      
      case 3: // 結果確認
        return results ? (
          <Results
            results={results}
            onDownload={handleDownload}
            onRestart={handleRestart}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  // ナビゲーションボタンの表示制御
  const shouldShowNavigation = currentStep !== 2 && currentStep !== 3;
  const canGoNext = canProceedToNextStep();
  const canGoPrev = currentStep > 0 && !isProcessing;

  return (
    <>
      <CssBaseline />
      
      {/* メインレイアウト */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: themeMode === 'color'
            ? 'linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%)'
            : themeMode === 'light'
            ? 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)'
            : 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        }}
      >
        {/* ヘッダー */}
        <AppHeader />

        {/* メインコンテンツ */}
        <Container
          maxWidth="lg"
          sx={{
            flex: 1,
            py: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ステップインジケーター */}
          <StepIndicator
            activeStep={currentStep}
            isProcessing={isProcessing}
          />

          {/* ステップコンテンツ */}
          <Box sx={{ flex: 1, mb: 4 }}>
            {renderStepContent()}
          </Box>

          {/* ナビゲーションボタン */}
          {shouldShowNavigation && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 4,
                p: 3,
                backgroundColor: 'background.paper',
                borderRadius: 3,
                boxShadow: themeMode === 'dark'
                  ? '0 2px 10px rgba(0, 0, 0, 0.3)'
                  : '0 2px 10px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Button
                variant="outlined"
                onClick={handlePrevStep}
                disabled={!canGoPrev}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  visibility: canGoPrev ? 'visible' : 'hidden',
                }}
              >
                戻る
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1 }}>
                  ステップ {currentStep + 1} / {getTotalSteps()}
                </Box>
                <Box sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {getStepName(currentStep)}
                </Box>
              </Box>

              <Button
                variant="contained"
                onClick={handleNextStep}
                disabled={!canGoNext}
                startIcon={currentStep === 1 ? <PlayArrow /> : undefined}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  background: canGoNext 
                    ? themeMode === 'color'
                      ? 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
                      : themeMode === 'light'
                      ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                      : 'linear-gradient(135deg, #90caf9 0%, #42a5f5 100%)'
                    : undefined,
                  '&:hover': canGoNext ? {
                    background: themeMode === 'color'
                      ? 'linear-gradient(135deg, #5cb85c 0%, #46a049 100%)'
                      : themeMode === 'light'
                      ? 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)'
                      : 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
                  } : undefined,
                  '&:disabled': {
                    backgroundColor: 'grey.300',
                    color: 'grey.500',
                  },
                }}
              >
                {currentStep === 1 ? 'AI処理開始' : currentStep === getTotalSteps() - 1 ? '完了' : '次へ'}
              </Button>
            </Box>
          )}

          {/* 結果画面での再実行ボタン */}
          {currentStep === 3 && (
            <Zoom in={true}>
              <Fab
                color="primary"
                onClick={handleRestart}
                sx={{
                  position: 'fixed',
                  bottom: 32,
                  right: 32,
                  background: themeMode === 'color'
                    ? 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
                    : themeMode === 'light'
                    ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                    : 'linear-gradient(135deg, #90caf9 0%, #42a5f5 100%)',
                  '&:hover': {
                    background: themeMode === 'color'
                      ? 'linear-gradient(135deg, #5cb85c 0%, #46a049 100%)'
                      : themeMode === 'light'
                      ? 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)'
                      : 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
                  },
                  boxShadow: themeMode === 'color'
                    ? '0 4px 20px rgba(76, 175, 80, 0.4)'
                    : themeMode === 'light'
                    ? '0 4px 20px rgba(25, 118, 210, 0.4)'
                    : '0 4px 20px rgba(144, 202, 249, 0.4)',
                }}
              >
                <Refresh />
              </Fab>
            </Zoom>
          )}
        </Container>

        {/* フッター */}
        <AppFooter />

        {/* APIキー設定ダイアログ */}
        <APIKeySetup
          open={showAPISetup}
          onClose={() => setShowAPISetup(false)}
          onComplete={() => setShowAPISetup(false)}
        />

        {/* エラー通知 */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={clearError}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={clearError}
            severity="error"
            sx={{ width: '100%' }}
          >
            {error?.message}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App; 