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
import { AuthSetup } from './components/AuthSetup';
import { AuthService, AuthResult } from './services/authService';
import { OutputFormat, MinutesData } from './types';
import { getAPIConfig, validateAPIConfig } from './config/api';

// ===========================================
// MinutesGen v1.0 - メインアプリケーション（認証統合）
// ===========================================

const AppContent: React.FC = () => {
  const { themeMode } = useTheme();
  const [showAPISetup, setShowAPISetup] = useState(false);
  const [showAuthSetup, setShowAuthSetup] = useState(false);
  const [authService] = useState(() => AuthService.getInstance());
  
  // アプリケーション状態管理
  const {
    // 状態
    currentStep,
    selectedFile,
    processingOptions,
    results,
    error,
    isProcessing,
    progress,
    isApiConfigured,
    detailedProgress,
    
    // アクション
    setCurrentStep,
    setSelectedFile,
    setProcessingOptions,
    processAudio,
    resetApp,
    clearError,
    
    // ユーティリティ
    canProceedToNextStep,
  } = useAppState();

  // 初期化時に認証状態をチェック
  useEffect(() => {
    const checkAuthState = () => {
      const needsAuth = authService.needsAuthentication();
      setShowAuthSetup(needsAuth);
      
      if (needsAuth) {
        // 認証が必要な場合は認証画面を表示
        setCurrentStep(0);
      }
    };

    checkAuthState();
  }, [authService]);

  // 認証成功時の処理
  const handleAuthSuccess = (authResult: AuthResult) => {
    setShowAuthSetup(false);
    
    // 認証成功メッセージを表示（任意）
    console.log('認証成功:', authResult.message);
  };

  // 認証リセット（設定画面から呼び出し）
  const handleAuthReset = () => {
    authService.resetAuth();
    setShowAuthSetup(true);
    resetApp();
  };

  // 次のステップに進む
  const handleNextStep = () => {
    if (canProceedToNextStep()) {
      if (currentStep === 1) {
        // オプション設定から処理開始
        processAudio();
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

  // 最初からやり直し
  const handleRestart = () => {
    resetApp();
    setCurrentStep(0);
  };

  // ステップ名を取得
  const getStepName = (step: number) => {
    const stepNames = ['ファイル選択', 'オプション設定', 'AI処理中', '結果表示'];
    return stepNames[step] || '不明';
  };

  // 総ステップ数を取得
  const getTotalSteps = () => {
    return 4; // 0: ファイル選択, 1: オプション設定, 2: AI処理中, 3: 結果表示
  };

  // ステップ名を取得
  const getStepTitle = () => {
    return getStepName(currentStep);
  };

  // 進行状況を計算
  const getProgressPercentage = () => {
    if (isProcessing && progress) {
      return progress.percentage;
    }
    return Math.round((currentStep / getTotalSteps()) * 100);
  };

  return (
    <Container maxWidth="lg" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <AppHeader 
        onRestart={handleRestart}
        onAuthReset={handleAuthReset}
        authMethod={authService.getAuthMethod()}
      />

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, py: 4 }}>
        {/* ステップインジケーター */}
        <StepIndicator
          activeStep={currentStep}
          isProcessing={isProcessing}
        />

        {/* ステップ別コンテンツ */}
        <Box sx={{ mt: 4 }}>
          {/* ステップ0: ファイルアップロード */}
          {currentStep === 0 && (
            <FileUpload
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
            />
          )}

          {/* ステップ1: オプション設定 */}
          {currentStep === 1 && (
            <ProcessingOptions
              options={processingOptions}
              onOptionsChange={setProcessingOptions}
            />
          )}

          {/* ステップ2: AI処理中 */}
          {currentStep === 2 && progress && (
            <ProcessingProgress
              progress={progress}
              showLogs={true}
              detailedProgress={detailedProgress}
              selectedFile={selectedFile}
            />
          )}

          {/* ステップ3: 結果表示 */}
          {currentStep === 3 && results && (
            <Results
              results={results}
              onDownload={(format) => {
                if (!results) return;
                const output = results.outputs.find(o => o.format === format);
                if (!output) return;

                const filenameBase = results.title.replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ヴー\s_-]/g, '').replace(/\s+/g, '_');
                const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'docx';
                
                let blob: Blob;
                
                if (format === 'word') {
                  // Word文書（docx）の場合、Base64デコードしてバイナリデータとして処理
                  try {
                    // Base64エンコードされた文字列をバイナリに変換（安全な方法）
                    const base64String = output.content;
                    
                    // Base64文字列の妥当性チェック
                    if (base64String && base64String.length > 0 && base64String !== 'Word文書の生成に失敗しました') {
                      // Base64文字列をUint8Arrayに変換
                      const binaryString = atob(base64String);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      blob = new Blob([bytes], { 
                        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                      });
                    } else {
                      // Word文書の生成に失敗した場合、フォールバック: テキストとしてダウンロード
                      blob = new Blob([output.content], { type: 'text/plain;charset=utf-8' });
                    }
                  } catch (error) {
                    console.error('Word文書のダウンロード準備に失敗しました:', error);
                    // フォールバック: テキストとしてダウンロード
                    blob = new Blob([output.content], { type: 'text/plain;charset=utf-8' });
                  }
                } else {
                  const mimeType = format === 'markdown'
                    ? 'text/markdown;charset=utf-8'
                    : 'text/html;charset=utf-8';
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
              }}
              onRestart={handleRestart}
              onBackToSettings={handlePrevStep}
              onClearAndRestart={handleRestart}
            />
          )}
        </Box>

        {/* 次へボタン（ステップ0, 1のみ） */}
        {(currentStep === 0 || currentStep === 1) && !isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleNextStep}
              disabled={!canProceedToNextStep()}
              startIcon={currentStep === 1 ? <PlayArrow /> : undefined}
              sx={{
                minWidth: 200,
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
              }}
            >
              {currentStep === 0 ? '次へ' : 'AI処理開始'}
            </Button>
          </Box>
        )}

        {/* やり直しボタン（結果画面） */}
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
      </Box>

      {/* フッター */}
      <AppFooter />

      {/* 初回セットアップ画面 */}
      <AuthSetup
        open={showAuthSetup}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* 既存のAPIキー設定ダイアログ（後方互換性のため残す） */}
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
          variant="filled"
          sx={{ width: '100%' }}
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  );
};

export default App; 