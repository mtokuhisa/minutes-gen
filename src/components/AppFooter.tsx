import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import {
  Security,
  Speed,
  HighQuality,
  Help,
} from '@mui/icons-material';
import { useTheme } from '../theme';

// ===========================================
// MinutesGen v0.7.5 - アプリケーションフッター  
// ===========================================

export const AppFooter: React.FC = () => {
  const { themeMode } = useTheme();

  const getFooterBackground = () => {
    switch (themeMode) {
      case 'color':
        return 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)';
      case 'light':
        return 'linear-gradient(135deg, #f5f5f5 0%, #e8f0fe 100%)';
      case 'dark':
        return 'linear-gradient(135deg, #424242 0%, #212121 100%)';
      default:
        return 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)';
    }
  };

  const getBorderColor = () => {
    switch (themeMode) {
      case 'color':
        return 'rgba(76, 175, 80, 0.2)';
      case 'light':
        return 'rgba(51, 51, 51, 0.1)';
      case 'dark':
        return 'rgba(66, 66, 66, 0.2)';
      default:
        return 'rgba(76, 175, 80, 0.2)';
    }
  };

  const getGradientColor = () => {
    switch (themeMode) {
      case 'color':
        return '#66bb6a';
      case 'light':
        return '#e8f0fe';
      case 'dark':
        return '#424242';
      default:
        return '#66bb6a';
    }
  };

  const getTitleColor = () => {
    switch (themeMode) {
      case 'color':
        return 'white';
      case 'light':
        return '#333333';
      case 'dark':
        return 'white';
      default:
        return 'white';
    }
  };

  const getDescriptionColor = () => {
    switch (themeMode) {
      case 'color':
        return 'rgba(255, 255, 255, 0.9)';
      case 'light':
        return 'rgba(51, 51, 51, 0.8)';
      case 'dark':
        return 'rgba(255, 255, 255, 0.9)';
      default:
        return 'rgba(255, 255, 255, 0.9)';
    }
  };

  const getChipColors = () => {
    switch (themeMode) {
      case 'color':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        };
      case 'light':
        return {
          backgroundColor: 'rgba(51, 51, 51, 0.1)',
          color: '#333333',
          border: '1px solid rgba(51, 51, 51, 0.2)',
        };
      case 'dark':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        };
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        };
    }
  };

  const getButtonColors = () => {
    switch (themeMode) {
      case 'color':
        return {
          color: 'white',
          borderColor: 'rgba(255, 255, 255, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'white',
          },
        };
      case 'light':
        return {
          color: '#333333',
          borderColor: 'rgba(51, 51, 51, 0.3)',
          '&:hover': {
            backgroundColor: 'rgba(51, 51, 51, 0.1)',
            borderColor: '#333333',
          },
        };
      case 'dark':
        return {
          color: 'white',
          borderColor: 'rgba(255, 255, 255, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'white',
          },
        };
      default:
        return {
          color: 'white',
          borderColor: 'rgba(255, 255, 255, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'white',
          },
        };
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        background: getFooterBackground(),
        borderTop: `1px solid ${getBorderColor()}`,
        py: 3,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'transparent',
        },
      }}
    >
      <Container maxWidth="lg">
        {/* メイン情報セクション */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
          {/* 左側：ブランドと説明 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: getTitleColor(),
                  mb: 0.5,
                }}
              >
                MinutesGen
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: getDescriptionColor(),
                  lineHeight: 1.4,
                  maxWidth: '400px',
                }}
              >
                dJ基準で全情報入力可能な議事録生成ツール<br />
                巨大なデータも読み込め、出力形式も多様
              </Typography>
            </Box>
            
            {/* 特徴バッジ */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                icon={<Security />}
                label="セキュア"
                size="small"
                sx={getChipColors()}
              />
              <Chip
                icon={<Speed />}
                label="高速"
                size="small"
                sx={getChipColors()}
              />
              <Chip
                icon={<HighQuality />}
                label="高品質"
                size="small"
                sx={getChipColors()}
              />
            </Box>
          </Box>

          {/* 右側：リンクボタンとバージョン */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
            {/* リンクボタン */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Help />}
                sx={getButtonColors()}
                onClick={() => {
                  try {
                    // Electron環境での適切なパス処理
                    const overviewPath = '../overview.html';
                    window.open(overviewPath, '_blank');
                  } catch (error) {
                    console.error('概要ページの表示に失敗しました:', error);
                  }
                }}
              >
                概要と使い方
              </Button>
              <Button
                variant="outlined"
                size="small"
                sx={getButtonColors()}
                onClick={() => {
                  try {
                    // Electron環境での適切なパス処理  
                    const technicalPath = '../technical.html';
                    window.open(technicalPath, '_blank');
                  } catch (error) {
                    console.error('技術仕様ページの表示に失敗しました:', error);
                  }
                }}
              >
                技術仕様/更新履歴
              </Button>
            </Box>
            
            {/* バージョン情報 */}
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
                                v0.7.5 | Build 2025.07.16
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}; 