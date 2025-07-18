import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Tab,
  Tabs,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import {
  VpnKey,
  Visibility,
  VisibilityOff,
  Business,
  Person,
  Lock,
  Key,
} from '@mui/icons-material';
import { AuthService, AuthResult } from '../services/authService';

// ===========================================
// MinutesGen v0.7.5 - 初回セットアップ画面
// ===========================================

interface AuthSetupProps {
  open: boolean;
  onAuthSuccess: (authResult: AuthResult) => void;
}

export const AuthSetup: React.FC<AuthSetupProps> = ({ open, onAuthSuccess }) => {
  const [tabValue, setTabValue] = useState(0);
  const [password, setPassword] = useState('');
  const [personalApiKey, setPersonalApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authService = AuthService.getInstance();

  // タブ切り替え
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
    setPassword('');
    setPersonalApiKey('');
  };

  // 企業パスワード認証
  const handlePasswordAuth = async () => {
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const result = authService.authenticateWithPassword(password);
      
      if (result.success) {
        onAuthSuccess(result);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('認証中にエラーが発生しました');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 個人API KEY認証
  const handlePersonalKeyAuth = async () => {
    if (!personalApiKey.trim()) {
      setError('OpenAI APIキーを入力してください');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const result = authService.authenticateWithPersonalKey(personalApiKey);
      
      if (result.success) {
        onAuthSuccess(result);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('認証中にエラーが発生しました');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Enterキーでの認証
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (tabValue === 0) {
        handlePasswordAuth();
      } else {
        handlePersonalKeyAuth();
      }
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '500px',
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <VpnKey sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h5" component="h1">
            MinutesGen 初回セットアップ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            認証方法を選択してください
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ width: '100%' }}>
          {/* タブ */}
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ mb: 3 }}
          >
            <Tab
              icon={<Business />}
              label="企業アカウント"
              iconPosition="start"
            />
            <Tab
              icon={<Person />}
              label="個人アカウント"
              iconPosition="start"
            />
          </Tabs>

          {/* エラー表示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 企業パスワード認証タブ */}
          {tabValue === 0 && (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lock sx={{ color: 'primary.main' }} />
                    <Typography variant="h6">企業パスワード認証</Typography>
                  </Box>

                  <Alert severity="info">
                    <Typography variant="body2">
                      管理者から別途お伝えしたパスワードを入力してください。
                      <br />
                      企業のOpenAI APIアカウントを使用します。
                    </Typography>
                  </Alert>

                  <TextField
                    label="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    required
                    placeholder="パスワードを入力"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      📋 企業アカウントの特徴:
                    </Typography>
                    <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
                      <li>企業のOpenAI APIアカウントを使用</li>
                      <li>利用料金は会社負担</li>
                      <li>パスワード1回入力で以降は自動ログイン</li>
                      <li>管理者による一元管理</li>
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 個人API KEY認証タブ */}
          {tabValue === 1 && (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Key sx={{ color: 'primary.main' }} />
                    <Typography variant="h6">個人API KEY認証</Typography>
                  </Box>

                  <Alert severity="warning">
                    <Typography variant="body2">
                      個人のOpenAI APIキーを使用します。
                      <br />
                      利用料金は個人負担となります。
                    </Typography>
                  </Alert>

                  <TextField
                    label="OpenAI APIキー"
                    value={personalApiKey}
                    onChange={(e) => setPersonalApiKey(e.target.value)}
                    onKeyPress={handleKeyPress}
                    type={showApiKey ? 'text' : 'password'}
                    fullWidth
                    required
                    placeholder="sk-..."
                    helperText="OpenAI Platform (platform.openai.com) で取得したAPIキーを入力"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowApiKey(!showApiKey)}
                            edge="end"
                          >
                            {showApiKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      📋 APIキーの取得方法:
                    </Typography>
                    <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
                      <li>OpenAI Platform (platform.openai.com) にアクセス</li>
                      <li>アカウントにログイン</li>
                      <li>「API Keys」セクションに移動</li>
                      <li>「Create new secret key」をクリック</li>
                      <li>生成されたキーをコピーして上記に貼り付け</li>
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={tabValue === 0 ? handlePasswordAuth : handlePersonalKeyAuth}
            variant="contained"
            size="large"
            disabled={
              isAuthenticating || 
              (tabValue === 0 && !password.trim()) || 
              (tabValue === 1 && !personalApiKey.trim())
            }
            startIcon={tabValue === 0 ? <Lock /> : <Key />}
            sx={{ minWidth: 200 }}
          >
            {isAuthenticating ? '認証中...' : '認証'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}; 