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

export const AppHeader: React.FC = () => {
  const { themeMode, toggleTheme, theme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <AppBar
      position="static"
      sx={{
        background: themeMode === 'light' 
          ? 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
          : 'linear-gradient(135deg, #2e7d32 0%, #388e3c 100%)',
        boxShadow: themeMode === 'light'
          ? '0 4px 20px rgba(76, 175, 80, 0.3)'
          : '0 4px 20px rgba(46, 125, 50, 0.4)',
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
          {/* ロゴ・タイトルセクション */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'rotate(360deg)',
                },
              }}
            >
              <AutoAwesome 
                sx={{ 
                  fontSize: 32, 
                  color: 'white',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                }} 
              />
            </Box>
            
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  letterSpacing: 1,
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  mb: 0,
                }}
              >
                MinutesGen v1.0
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              >
                AI-Powered Minutes Generator
              </Typography>
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

            <Tooltip title={themeMode === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}>
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
                {themeMode === 'light' ? <DarkMode /> : <LightMode />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
      
      {/* API設定画面 */}
      <APISettings
        open={settingsOpen}
        onClose={handleSettingsClose}
        onSave={handleSettingsSave}
      />
    </AppBar>
  );
}; 