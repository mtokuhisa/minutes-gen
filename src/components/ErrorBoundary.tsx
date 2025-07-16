import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, AlertTitle, Paper, Divider, Collapse, IconButton } from '@mui/material';
import { ErrorOutline, Refresh, ExpandMore, ExpandLess, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('🚨 ErrorBoundary: エラーを検出:', error);
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary: エラー詳細:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // エラー報告（将来的にログサービスに送信）
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    console.log('📊 エラーレポート生成中...');
    
    // 本番環境では外部ログサービスに送信
    const errorReport = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
      isElectron: typeof window !== 'undefined' && window.electronAPI !== undefined,
    };

    console.log('📊 エラーレポート:', errorReport);

    // 本番環境では外部ログサービスに送信
    if (process.env.NODE_ENV === 'production') {
      // TODO: 外部ログサービスに送信
      console.log('📤 本番環境でのエラー送信（未実装）');
    }
  };

  private handleRetry = () => {
    console.log('🔄 エラーリトライ開始 (', this.state.retryCount + 1, '/', this.maxRetries, ')');
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleReload = () => {
    console.log('🔄 ページリロード実行');
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'ネットワークエラー';
    }
    if (message.includes('permission') || message.includes('denied')) {
      return '権限エラー';
    }
    if (message.includes('memory') || message.includes('oom')) {
      return 'メモリエラー';
    }
    if (stack.includes('audioprocessor') || message.includes('ffmpeg')) {
      return '音声処理エラー';
    }
    if (stack.includes('openai') || message.includes('api')) {
      return 'API通信エラー';
    }
    if (stack.includes('electron') || message.includes('electron')) {
      return 'Electronエラー';
    }
    
    return 'アプリケーションエラー';
  };

  private getSuggestedAction = (error: Error): string => {
    const message = error.message.toLowerCase();
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'ネットワークエラー':
        return 'インターネット接続を確認してください。';
      case '権限エラー':
        return 'ファイルへのアクセス権限を確認してください。';
      case 'メモリエラー':
        return 'アプリを再起動してメモリを解放してください。';
      case '音声処理エラー':
        return '音声ファイルの形式を確認し、アプリを再起動してください。';
      case 'API通信エラー':
        return 'API設定を確認し、しばらく待ってから再試行してください。';
      case 'Electronエラー':
        return 'アプリを完全に終了し、再起動してください。';
      default:
        return 'アプリを再起動してください。問題が続く場合は、開発者にお問い合わせください。';
    }
  };

  render() {
    if (this.state.hasError) {
      const errorCategory = this.getErrorCategory(this.state.error!);
      const suggestedAction = this.getSuggestedAction(this.state.error!);
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            padding: 2,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 600,
              width: '100%',
              padding: 3,
              textAlign: 'center',
            }}
          >
            <ErrorOutline
              sx={{
                fontSize: 60,
                color: 'error.main',
                marginBottom: 2,
              }}
            />
            
            <Typography variant="h4" component="h1" gutterBottom color="error">
              アプリケーションエラー
            </Typography>
            
            <Alert severity="error" sx={{ marginBottom: 2, textAlign: 'left' }}>
              <AlertTitle>{errorCategory}</AlertTitle>
              <Typography variant="body2" sx={{ marginBottom: 1 }}>
                {this.state.error?.message || '不明なエラーが発生しました'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {suggestedAction}
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 2 }}>
              {canRetry && (
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleRetry}
                  color="primary"
                >
                  再試行 ({this.state.retryCount}/{this.maxRetries})
                </Button>
              )}
              
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={this.handleReload}
                color="secondary"
              >
                ページリロード
              </Button>
            </Box>

            <Divider sx={{ marginY: 2 }} />

            <Box sx={{ textAlign: 'left' }}>
              <Button
                variant="text"
                startIcon={this.state.showDetails ? <ExpandLess /> : <ExpandMore />}
                onClick={this.toggleDetails}
                size="small"
              >
                技術的な詳細を表示
              </Button>
              
              <Collapse in={this.state.showDetails}>
                <Box sx={{ marginTop: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    <BugReport sx={{ marginRight: 1, verticalAlign: 'middle' }} />
                    エラー詳細
                  </Typography>
                  
                  <Paper
                    variant="outlined"
                    sx={{
                      padding: 2,
                      backgroundColor: '#f8f8f8',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    <Typography variant="body2" component="pre">
                      {this.state.error?.stack || 'スタックトレースが利用できません'}
                    </Typography>
                  </Paper>
                  
                  {this.state.errorInfo && (
                    <Paper
                      variant="outlined"
                      sx={{
                        padding: 2,
                        backgroundColor: '#f8f8f8',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        maxHeight: 200,
                        overflow: 'auto',
                        marginTop: 1,
                      }}
                    >
                      <Typography variant="body2" component="pre">
                        {this.state.errorInfo.componentStack}
                      </Typography>
                    </Paper>
                  )}
                  
                  <Typography variant="caption" color="text.secondary" sx={{ marginTop: 1, display: 'block' }}>
                    エラー発生時刻: {new Date().toLocaleString()}
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
} 