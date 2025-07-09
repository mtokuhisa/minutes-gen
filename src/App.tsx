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
import { OutputFormat, MinutesData } from './types';
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

    let blob: Blob;
    let filename: string;
    
    switch (format) {
      case 'word':
        // RTF形式（Word互換）
        const wordContent = generateWordContent(results);
        blob = new Blob([wordContent], { 
          type: 'application/rtf' 
        });
        filename = `${results.title}.rtf`;
        break;
        
      case 'html':
        // HTML形式（議事録タブの表示内容）
        const htmlContent = generateHTMLContent(results);
        blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        filename = `${results.title}.html`;
        break;
        
      default:
        // Markdown形式
        blob = new Blob([output.content], { type: 'text/plain;charset=utf-8' });
        filename = `${results.title}.${format}`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Word文書コンテンツ生成
  const generateWordContent = (minutesData: MinutesData): string => {
    const markdownOutput = minutesData.outputs.find(output => output.format === 'markdown');
    const content = markdownOutput?.content || minutesData.summary;
    
    // 日本語文字をUnicodeエスケープする関数（正しい形式）
    const escapeJapanese = (text: string): string => {
      return text.replace(/[\u0080-\uFFFF]/g, (match) => {
        const code = match.charCodeAt(0);
        return `\\u${code}?`;
      });
    };

    // RTF用エスケープ処理
    const escapeRTF = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\n/g, '\\par ')
        .replace(/\*\*(.*?)\*\*/g, '{\\b $1}')
        .replace(/\*(.*?)\*/g, '{\\i $1}');
    };

    // 日本語文字列を正しくエスケープ
    const escapeJapaneseText = (text: string): string => {
      return escapeJapanese(escapeRTF(text));
    };

    // 日本語対応RTF（正しい文字セット設定）
    const rtfContent = `{\\rtf1\\ansi\\ansicpg932\\deff0\\deflang1041
{\\fonttbl{\\f0\\fnil\\fcharset128 MS Gothic;}{\\f1\\fnil\\fcharset128 MS Mincho;}}
{\\colortbl;\\red0\\green0\\blue0;\\red51\\green102\\blue153;}
\\viewkind4\\uc1\\pard\\cf1\\lang1041\\f0\\fs24

{\\b\\fs32\\cf2 ${escapeJapaneseText(minutesData.title)}}\\par 
\\par 
{\\b ${escapeJapanese('開催日時')}: }${escapeJapaneseText(minutesData.date.toLocaleDateString('ja-JP'))}\\par 
{\\b ${escapeJapanese('参加者')}: }${escapeJapaneseText(minutesData.participants.map(p => p.name).join(', '))}\\par 
{\\b ${escapeJapanese('所要時間')}: }${Math.floor(minutesData.duration / 60)}:${(minutesData.duration % 60).toString().padStart(2, '0')}\\par 
\\par 
{\\b\\fs28\\cf2 ${escapeJapanese('詳細内容')}}\\par 
\\par 
${escapeJapaneseText(content)}\\par 
\\par 
{\\b\\fs28\\cf2 ${escapeJapanese('重要なポイント')}}\\par 
\\par 
${minutesData.keyPoints.map(kp => `\\u8226? ${escapeJapaneseText(kp.content)} (${escapeJapanese('重要度')}: ${kp.importance})\\par `).join('')}\\par 
{\\b\\fs28\\cf2 ${escapeJapanese('アクション項目')}}\\par 
\\par 
${minutesData.actionItems.map(ai => `\\u8226? ${escapeJapaneseText(ai.task)} (${escapeJapanese('担当')}: ${ai.assignee || escapeJapanese('未定')}, ${escapeJapanese('優先度')}: ${ai.priority})\\par `).join('')}
}`;
    
    return rtfContent;
  };

  // HTML文書コンテンツ生成（議事録タブの内容）
  const generateHTMLContent = (minutesData: MinutesData): string => {
    const markdownOutput = minutesData.outputs.find(output => output.format === 'markdown');
    const markdownContent = markdownOutput?.content || minutesData.summary;
    
    // MarkdownをHTMLに変換
    const convertMarkdownToHTML = (markdown: string): string => {
      return markdown
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/<\/li>\s*<li>/g, '</li><li>')
        .replace(/^(.+)$/gm, '<p>$1</p>')
        .replace(/<p><h([1-6])>/g, '<h$1>')
        .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
        .replace(/<p><ul>/g, '<ul>')
        .replace(/<\/ul><\/p>/g, '</ul>')
        .replace(/<p><\/p>/g, '')
        .replace(/\n/g, '');
    };

    const htmlContent = convertMarkdownToHTML(markdownContent);
    
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${minutesData.title}</title>
    <style>
        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f9f9f9;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            color: #7f8c8d;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        ul {
            margin: 15px 0;
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
        strong {
            color: #2c3e50;
        }
        code {
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .meta {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="meta">
            <strong>開催日時:</strong> ${minutesData.date.toLocaleDateString('ja-JP')}<br>
            <strong>参加者:</strong> ${minutesData.participants.map(p => p.name).join(', ')}<br>
            <strong>所要時間:</strong> ${Math.floor(minutesData.duration / 60)}:${(minutesData.duration % 60).toString().padStart(2, '0')}
        </div>
        ${htmlContent}
    </div>
</body>
</html>`;
  };

  // 新しい議事録生成を開始
  const handleRestart = () => {
    resetState();
  };

  // 設定に戻る（文字起こし結果を保持したまま）
  const handleBackToSettings = () => {
    // 処理結果は保持したまま、オプション設定画面に戻る
    // ファイル選択状態も保持される
    setCurrentStep(1); // オプション設定画面に戻る
  };

  // 内容を消去してトップに戻る
  const handleClearAndRestart = () => {
    resetState(); // 完全にリセット
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
            onBackToSettings={handleBackToSettings}
            onClearAndRestart={handleClearAndRestart}
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
        <AppHeader onRestart={handleRestart} />

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