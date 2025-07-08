import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Settings,
  Save,
  Refresh,
  Info,
  VpnKey,
  Close,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { APIConfig, getAPIConfig, validateAPIConfig } from '../config/api';

// ===========================================
// MinutesGen v1.0 - API設定画面
// ===========================================

interface APISettingsProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: APIConfig) => void;
}

export const APISettings: React.FC<APISettingsProps> = ({ open, onClose, onSave }) => {
  const [config, setConfig] = useState<APIConfig>(getAPIConfig());
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[] }>({
    isValid: true,
    errors: [],
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 設定の初期化
  useEffect(() => {
    if (open) {
      setConfig(getAPIConfig());
      setValidation({ isValid: true, errors: [] });
      setTestResult(null);
    }
  }, [open]);

  // 設定値の更新
  const handleConfigChange = (field: keyof APIConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    
    // バリデーション
    const validation = validateAPIConfig(newConfig);
    setValidation(validation);
  };

  // API接続テスト
  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // OpenAI APIのテスト
      const response = await fetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTestResult({
          success: true,
          message: 'API接続テストに成功しました！',
        });
      } else {
        setTestResult({
          success: false,
          message: `API接続エラー: ${response.status} ${response.statusText}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `接続エラー: ${error instanceof Error ? (error as Error).message : 'Unknown error'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 設定の保存
  const handleSave = () => {
    if (validation.isValid) {
      onSave(config);
      onClose();
    }
  };

  // デフォルト値にリセット
  const handleReset = () => {
    setConfig(getAPIConfig());
    setValidation({ isValid: true, errors: [] });
    setTestResult(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Settings sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">API設定</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* バリデーションエラー表示 */}
          {!validation.isValid && (
            <Alert severity="error">
              <Typography variant="body2" component="div">
                設定に問題があります:
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Typography>
            </Alert>
          )}

          {/* 基本設定 */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <VpnKey sx={{ mr: 1 }} />
              基本設定
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="OpenAI APIキー"
                value={config.openaiApiKey}
                onChange={(e) => handleConfigChange('openaiApiKey', e.target.value)}
                type="password"
                fullWidth
                required
                helperText="OpenAI APIキーを入力してください"
                error={!config.openaiApiKey && !validation.isValid}
              />

              <TextField
                label="API Base URL"
                value={config.baseUrl}
                onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                fullWidth
                required
                helperText="通常は変更不要です"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>音声認識モデル</InputLabel>
                  <Select
                    value={config.transcribeModel}
                    label="音声認識モデル"
                    onChange={(e) => handleConfigChange('transcribeModel', e.target.value)}
                  >
                    <MenuItem value="gpt-4o-transcribe">GPT-4o Transcribe</MenuItem>
                    <MenuItem value="gpt-4o-mini-transcribe">GPT-4o Mini Transcribe</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>議事録生成モデル</InputLabel>
                  <Select
                    value={config.minutesModel}
                    label="議事録生成モデル"
                    onChange={(e) => handleConfigChange('minutesModel', e.target.value)}
                  >
                    <MenuItem value="o3-mini">o3-mini</MenuItem>
                    <MenuItem value="o4-mini">o4-mini</MenuItem>
                    <MenuItem value="gpt-4.1">GPT-4.1</MenuItem>
                    <MenuItem value="gpt-4o">GPT-4o</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>音声合成モデル</InputLabel>
                  <Select
                    value={config.ttsModel}
                    label="音声合成モデル"
                    onChange={(e) => handleConfigChange('ttsModel', e.target.value)}
                  >
                    <MenuItem value="gpt-4o-mini-audio-preview">GPT-4o Mini Audio</MenuItem>
                    <MenuItem value="gpt-4o-mini-realtime-preview">GPT-4o Mini Realtime</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* 詳細設定 */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              詳細設定
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="最大ファイルサイズ (MB)"
                value={Math.round(config.maxFileSize / (1024 * 1024))}
                onChange={(e) => handleConfigChange('maxFileSize', parseInt(e.target.value) * 1024 * 1024)}
                type="number"
                fullWidth
                helperText="アップロード可能な最大ファイルサイズ"
              />

              <TextField
                label="タイムアウト時間 (秒)"
                value={config.timeoutDuration / 1000}
                onChange={(e) => handleConfigChange('timeoutDuration', parseInt(e.target.value) * 1000)}
                type="number"
                fullWidth
                helperText="API リクエストのタイムアウト時間"
              />

              <TextField
                label="再試行回数"
                value={config.retryAttempts}
                onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
                type="number"
                fullWidth
                helperText="API リクエスト失敗時の再試行回数"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.devMode}
                      onChange={(e) => handleConfigChange('devMode', e.target.checked)}
                    />
                  }
                  label="開発モード"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.debugLogs}
                      onChange={(e) => handleConfigChange('debugLogs', e.target.checked)}
                    />
                  }
                  label="デバッグログ"
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* 接続テスト */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              接続テスト
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={testConnection}
                disabled={isTesting || !config.openaiApiKey}
                startIcon={isTesting ? <Refresh className="animate-spin" /> : <CheckCircle />}
              >
                {isTesting ? 'テスト中...' : 'API接続テスト'}
              </Button>

              <Tooltip title="OpenAI APIとの接続を確認します">
                <Info sx={{ color: 'text.secondary' }} />
              </Tooltip>
            </Box>

            {testResult && (
              <Alert severity={testResult.success ? 'success' : 'error'}>
                {testResult.message}
              </Alert>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleReset}
          startIcon={<Refresh />}
          disabled={isTesting}
        >
          リセット
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        <Button onClick={onClose} disabled={isTesting}>
          キャンセル
        </Button>

        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={!validation.isValid || isTesting}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 