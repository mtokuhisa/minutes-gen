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
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  VpnKey,
  Visibility,
  VisibilityOff,
  Close,
  Save,
} from '@mui/icons-material';
import { saveAPIConfig, getAPIConfig } from '../config/api';

// ===========================================
// MinutesGen v0.7.5 - APIキー設定
// ===========================================

interface APIKeySetupProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const APIKeySetup: React.FC<APIKeySetupProps> = ({ open, onClose, onComplete }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('APIキーを入力してください');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setError('有効なOpenAI APIキーを入力してください（sk-で始まる）');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 現在の設定を取得し、APIキーのみ更新
      const currentConfig = getAPIConfig();
      const updatedConfig = {
        ...currentConfig,
        openaiApiKey: apiKey.trim(),
      };

      saveAPIConfig(updatedConfig);
      onComplete();
      onClose();
    } catch (error) {
      setError('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <VpnKey sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">OpenAI APIキー設定</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
                              MinutesGen v0.7.6を使用するには、OpenAI APIキーが必要です。
              <br />
              APIキーは安全に暗号化されてローカルに保存されます。
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          <TextField
            label="OpenAI APIキー"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type={showApiKey ? 'text' : 'password'}
            fullWidth
            required
            placeholder="sk-..."
            helperText="OpenAIのAPIキーを入力してください"
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
            <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
              <li>OpenAI Platform (platform.openai.com) にアクセス</li>
              <li>アカウントにログイン</li>
              <li>「API Keys」セクションに移動</li>
              <li>「Create new secret key」をクリック</li>
              <li>生成されたキーをコピーして上記に貼り付け</li>
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={isSaving}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={!apiKey.trim() || isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 