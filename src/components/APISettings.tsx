// ===========================================
// MinutesGen v1.0 - API設定コンポーネント（認証統合）
// ===========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Chip,
  CircularProgress,
  Switch,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  TabPanel,
} from '@mui/material';
import {
  Settings,
  Close,
  Science,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  Refresh,
  Business,
  Person,
  VpnKey,
  Security,
} from '@mui/icons-material';
import { AuthService } from '../services/authService';
import { APIConfig, getAPIConfig, validateAPIConfig, getCorporateStatus } from '../config/api';

interface APISettingsProps {
  open: boolean;
  onClose: () => void;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export const APISettings: React.FC<APISettingsProps> = ({ open, onClose }) => {
  const [authService] = useState(() => AuthService.getInstance());
  const [config, setConfig] = useState<APIConfig>(getAPIConfig());
  const [personalApiKey, setPersonalApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 企業設定の状態
  const corporateStatus = getCorporateStatus();

  // 初期化
  useEffect(() => {
    if (open) {
      const newConfig = getAPIConfig();
      setConfig(newConfig);
      
      // 個人API KEYの現在値を取得
      if (!newConfig.useCorporateKey) {
        const savedPersonalKey = localStorage.getItem('minutesgen_personal_api_key');
        if (savedPersonalKey) {
          try {
            const decrypted = authService.decryptApiKey(savedPersonalKey);
            setPersonalApiKey(decrypted);
          } catch (error) {
            console.warn('個人API KEYの復号に失敗:', error);
          }
        }
      }
    }
  }, [open, authService]);

  // API接続テスト
  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // 認証確認
      if (!authService.isAuthenticated()) {
        throw new Error('認証が必要です。初回セットアップを完了してください。');
      }

      const apiKey = await authService.getApiKey();
      if (!apiKey) {
        throw new Error('API KEYが取得できませんでした。');
      }

      // 簡単なAPI呼び出しでテスト
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API接続エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const authMethod = authService.getAuthMethod();
      const authMethodText = authMethod === 'corporate' ? '企業アカウント' : '個人アカウント';
      
      setTestResult({
        success: true,
        message: `API接続テストが成功しました！(${authMethodText})`,
        details: {
          modelsCount: data.data?.length || 0,
          authMethod: authMethodText,
        },
      });

    } catch (error) {
      console.error('API接続テストエラー:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'API接続テストに失敗しました',
      });
    } finally {
      setIsTesting(false);
    }
  }, [authService]);

  // 個人API KEYの保存
  const savePersonalApiKey = useCallback(async () => {
    if (!personalApiKey.trim()) {
      setTestResult({
        success: false,
        message: 'API KEYを入力してください',
      });
      return;
    }

    try {
      // 個人API KEYで認証
      await authService.authenticateWithPersonalKey(personalApiKey.trim());
      
      setTestResult({
        success: true,
        message: '個人API KEYが正常に保存されました',
      });

      // 設定を更新
      const newConfig = getAPIConfig();
      setConfig(newConfig);

    } catch (error) {
      console.error('個人API KEY保存エラー:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '個人API KEYの保存に失敗しました',
      });
    }
  }, [personalApiKey, authService]);

  // 企業認証に戻る
  const switchToCorporateAuth = useCallback(async () => {
    try {
      // 企業パスワードで認証（すでに認証済みの場合）
      if (corporateStatus.available) {
        await authService.authenticateWithCorporatePassword('Negsetunum');
        
        setTestResult({
          success: true,
          message: '企業アカウントに切り替えました',
        });

        // 設定を更新
        const newConfig = getAPIConfig();
        setConfig(newConfig);
      }
    } catch (error) {
      console.error('企業認証切り替えエラー:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '企業認証への切り替えに失敗しました',
      });
    }
  }, [authService, corporateStatus]);

  // 認証リセット
  const resetAuth = useCallback(() => {
    authService.clearApiKeyFromMemory();
    setPersonalApiKey('');
    setTestResult({
      success: true,
      message: '認証がリセットされました。初回セットアップ画面に戻ります。',
    });
    
    // 少し待ってから閉じる
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1500);
  }, [authService, onClose]);

  // タブ変更
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Settings color="primary" />
            <Typography variant="h6">API設定</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab 
              label="認証状態" 
              icon={<Security />} 
              iconPosition="start"
            />
            <Tab 
              label="API設定" 
              icon={<VpnKey />} 
              iconPosition="start"
            />
            <Tab 
              label="詳細設定" 
              icon={<Settings />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* 認証状態タブ */}
        {currentTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              現在の認証状態
            </Typography>
            
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  {config.useCorporateKey ? (
                    <>
                      <Business color="primary" />
                      <Typography variant="h6">企業アカウント</Typography>
                      <Chip label="アクティブ" color="success" size="small" />
                    </>
                  ) : (
                    <>
                      <Person color="primary" />
                      <Typography variant="h6">個人アカウント</Typography>
                      <Chip label="アクティブ" color="success" size="small" />
                    </>
                  )}
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {config.useCorporateKey 
                    ? '企業提供のAPI KEYを使用しています'
                    : '個人のAPI KEYを使用しています'
                  }
                </Typography>

                <Box mt={2}>
                  <Button
                    variant="outlined"
                    onClick={testConnection}
                    disabled={isTesting}
                    startIcon={isTesting ? <CircularProgress size={16} /> : <Science />}
                    sx={{ mr: 1 }}
                  >
                    {isTesting ? 'テスト中...' : 'API接続テスト'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={resetAuth}
                    startIcon={<Refresh />}
                  >
                    認証リセット
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {testResult && (
              <Alert 
                severity={testResult.success ? 'success' : 'error'} 
                sx={{ mb: 2 }}
                icon={testResult.success ? <CheckCircle /> : <Error />}
              >
                {testResult.message}
                {testResult.details && (
                  <Box mt={1}>
                    <Typography variant="caption" display="block">
                      利用可能モデル数: {testResult.details.modelsCount}
                    </Typography>
                    <Typography variant="caption" display="block">
                      認証方法: {testResult.details.authMethod}
                    </Typography>
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        )}

        {/* API設定タブ */}
        {currentTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              API設定の切り替え
            </Typography>

            {corporateStatus.available && (
              <Card sx={{ mb: 2 }}>
                <CardHeader
                  avatar={<Business />}
                  title="企業アカウント"
                  subheader="企業提供のAPI KEYを使用"
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    企業が提供するAPI KEYを使用します。追加の設定は不要です。
                  </Typography>
                  
                  <Button
                    variant={config.useCorporateKey ? "contained" : "outlined"}
                    onClick={switchToCorporateAuth}
                    disabled={config.useCorporateKey}
                    startIcon={<Business />}
                  >
                    {config.useCorporateKey ? '使用中' : '企業アカウントに切り替え'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader
                avatar={<Person />}
                title="個人アカウント"
                subheader="個人のAPI KEYを使用"
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  個人で取得したOpenAI API KEYを使用します。
                </Typography>
                
                <TextField
                  fullWidth
                  label="OpenAI API KEY"
                  type="password"
                  value={personalApiKey}
                  onChange={(e) => setPersonalApiKey(e.target.value)}
                  placeholder="sk-..."
                  sx={{ mb: 2 }}
                  helperText="個人のOpenAI API KEYを入力してください"
                />
                
                <Button
                  variant="contained"
                  onClick={savePersonalApiKey}
                  disabled={!personalApiKey.trim()}
                  startIcon={<VpnKey />}
                >
                  個人API KEYを保存
                </Button>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* 詳細設定タブ */}
        {currentTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              詳細設定
            </Typography>

            <Accordion expanded={showAdvanced} onChange={(e, expanded) => setShowAdvanced(expanded)}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>システム情報</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  <ListItem>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText 
                      primary="Base URL" 
                      secondary={config.baseUrl}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText 
                      primary="音声認識モデル" 
                      secondary={config.transcribeModel}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText 
                      primary="議事録生成モデル" 
                      secondary={config.minutesModel}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText 
                      primary="音声合成モデル" 
                      secondary={config.ttsModel}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText 
                      primary="企業KEY利用" 
                      secondary={config.useCorporateKey ? 'はい' : 'いいえ'}
                    />
                  </ListItem>
                </List>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 