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
} from '@mui/icons-material';

// ===========================================
// MinutesGen v1.0 - アプリケーションフッター  
// ===========================================

export const AppFooter: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        background: 'linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%)',
        borderTop: '1px solid rgba(76, 175, 80, 0.2)',
        py: 3,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #66bb6a, transparent)',
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
                  color: 'primary.dark',
                  mb: 0.5,
                  background: 'linear-gradient(135deg, #2e7d32 0%, #388e3c 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                MinutesGen v1.0
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  lineHeight: 1.4,
                  maxWidth: '400px',
                }}
              >
                AIを活用した次世代の議事録生成ツール。音声ファイルを美しい議事録に変換し、チームの生産性を向上させます。
              </Typography>
            </Box>
            
            {/* 特徴バッジ */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                icon={<Security />}
                label="セキュア"
                size="small"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                }}
              />
              <Chip
                icon={<Speed />}
                label="高速"
                size="small"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                }}
              />
              <Chip
                icon={<HighQuality />}
                label="高品質"
                size="small"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                }}
              />
            </Box>
          </Box>

          {/* 右側：リンクボタンとバージョン */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
            {/* リンクボタン */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                href="#"
                variant="outlined"
                size="small"
                sx={{
                  color: 'primary.dark',
                  borderColor: 'rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                セキュリティについて
              </Button>
              <Button
                href="#"
                variant="outlined"
                size="small"
                sx={{
                  color: 'primary.dark',
                  borderColor: 'rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                概要と使い方
              </Button>
              <Button
                href="#"
                variant="outlined"
                size="small"
                sx={{
                  color: 'primary.dark',
                  borderColor: 'rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderColor: 'primary.main',
                  },
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
              v0.7.0 | Build 2025.07.09
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}; 