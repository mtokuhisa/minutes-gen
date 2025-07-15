import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Container,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  AutoAwesome,
  Settings,
  Palette,
  LightMode,
  DarkMode,
  Help,
  GitHub,
} from '@mui/icons-material';
import { APISettings } from './APISettings';
import { APIConfig, saveAPIConfig } from '../config/api';
import { useTheme } from '../theme';

// ===========================================
// MinutesGen v1.0 - アプリケーションヘッダー
// ===========================================

interface AppHeaderProps {
  onRestart?: () => void;
  onAuthReset?: () => void;
  authMethod?: 'corporate' | 'personal' | null;
}

export const AppHeader: React.FC<AppHeaderProps> = React.memo(({ onRestart, onAuthReset, authMethod }) => {
  const { themeMode, toggleTheme, theme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleSettingsSave = (config: APIConfig) => {
    try {
      saveAPIConfig(config);
      console.log('API設定を保存しました:', config);
    } catch (error) {
      console.error('API設定の保存に失敗しました:', error);
    }
  };

  const handleLogoClick = () => {
    setRestartDialogOpen(true);
  };

  const handleRestartConfirm = () => {
    setRestartDialogOpen(false);
    if (onRestart) {
      onRestart();
    }
  };

  const handleRestartCancel = () => {
    setRestartDialogOpen(false);
  };

  return (
    <AppBar
      position="static"
      sx={{
        background: themeMode === 'color' 
          ? 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
          : themeMode === 'light'
          ? 'linear-gradient(135deg, #f5f5f5 0%, #e8f0fe 100%)'
          : 'linear-gradient(135deg, #424242 0%, #212121 100%)',
        boxShadow: themeMode === 'color'
          ? '0 4px 20px rgba(76, 175, 80, 0.3)'
          : themeMode === 'light'
          ? '0 4px 20px rgba(25, 118, 210, 0.2)'
          : '0 4px 20px rgba(66, 66, 66, 0.4)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          animation: 'shimmer 3s infinite',
        },
        '@keyframes shimmer': {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ py: 2, minHeight: '80px !important' }}>
          {/* ロゴセクション */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.3s ease',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
              onClick={handleLogoClick}
            >
              <img
                src="mgen_logo.svg"
                alt="MinutesGen Logo"
                style={{
                  height: '60px',
                  width: 'auto',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                }}
                onError={(e) => {
                  console.error('ロゴ画像の読み込みに失敗しました');
                  // フォールバック: テキストロゴを表示
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parentNode = (e.target as HTMLImageElement).parentNode as HTMLElement;
                  if (parentNode && !parentNode.querySelector('.text-logo')) {
                    const textLogo = document.createElement('div');
                    textLogo.className = 'text-logo';
                    textLogo.textContent = 'MinutesGen';
                    textLogo.style.fontSize = '24px';
                    textLogo.style.fontWeight = 'bold';
                    textLogo.style.color = 'white';
                    parentNode.appendChild(textLogo);
                  }
                }}
              />
            </Box>
          </Box>

          {/* ナビゲーション・アクションセクション */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="API設定">
              <IconButton
                onClick={handleSettingsOpen}
                sx={{
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                  borderRadius: 2,
                }}
              >
                <Settings />
              </IconButton>
            </Tooltip>

            <Tooltip title={`テーマ切り替え (現在: ${themeMode === 'color' ? 'カラー' : themeMode === 'light' ? 'ライト' : 'ダーク'})`}>
              <IconButton
                onClick={toggleTheme}
                sx={{
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                  borderRadius: 2,
                }}
              >
                {themeMode === 'color' ? <Palette /> : themeMode === 'light' ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>

            {/* 認証リセットボタン */}
            {onAuthReset && (
              <Tooltip title={`認証リセット (現在: ${authMethod === 'corporate' ? '企業アカウント' : authMethod === 'personal' ? '個人アカウント' : '未認証'})`}>
                <Button
                  onClick={onAuthReset}
                  size="small"
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                    borderRadius: 2,
                    ml: 1,
                  }}
                >
                  認証リセット
                </Button>
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </Container>
      
      {/* API設定画面 */}
      <APISettings
        open={settingsOpen}
        onClose={handleSettingsClose}
        onSave={handleSettingsSave}
      />
      
      {/* リスタート確認ダイアログ */}
      <Dialog
        open={restartDialogOpen}
        onClose={handleRestartCancel}
        aria-labelledby="restart-dialog-title"
        aria-describedby="restart-dialog-description"
      >
        <DialogTitle id="restart-dialog-title">
          TOPに戻りますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="restart-dialog-description">
            議事録データは削除されます。よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRestartCancel} color="primary">
            キャンセル
          </Button>
          <Button onClick={handleRestartConfirm} color="primary" variant="contained">
            TOPに戻る
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}); 