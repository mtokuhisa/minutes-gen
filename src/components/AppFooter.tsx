import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import {
  GitHub,
  Twitter,
  LinkedIn,
  Email,
  Favorite,
  Security,
  Speed,
  HighQuality,
} from '@mui/icons-material';

// ===========================================
// MinutesGen v1.0 - アプリケーションフッター  
// ===========================================

export const AppFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        background: 'linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%)',
        borderTop: '1px solid rgba(76, 175, 80, 0.2)',
        py: 6,
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
        <Grid container spacing={4} sx={{ mb: 4 }}>
          {/* ブランドセクション */}
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: 'primary.dark',
                  mb: 1,
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
                  lineHeight: 1.6,
                  mb: 2,
                }}
              >
                AIを活用した次世代の議事録生成ツール。
                音声ファイルを美しい議事録に変換し、
                チームの生産性を向上させます。
              </Typography>
              
              {/* 特徴バッジ */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
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
          </Grid>

          {/* クイックリンクセクション */}
          <Grid item xs={12} md={4}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'primary.dark',
                mb: 2,
              }}
            >
              クイックリンク
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                使い方ガイド
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                プライバシーポリシー
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                利用規約
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                サポート
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                API ドキュメント
              </Link>
            </Box>
          </Grid>

          {/* コンタクトセクション */}
          <Grid item xs={12} md={4}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'primary.dark',
                mb: 2,
              }}
            >
              お問い合わせ
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 2,
              }}
            >
              ご質問やフィードバックがございましたら、
              お気軽にお聞かせください。
            </Typography>
            
            {/* ソーシャルリンク */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                component="a"
                href="https://github.com/minutesgen"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <GitHub />
              </IconButton>
              <IconButton
                component="a"
                href="https://twitter.com/minutesgen"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <Twitter />
              </IconButton>
              <IconButton
                component="a"
                href="mailto:support@minutesgen.com"
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  color: 'primary.dark',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <Email />
              </IconButton>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 3, borderColor: 'rgba(76, 175, 80, 0.2)' }} />

        {/* コピーライトセクション */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            © {currentYear} MinutesGen. Made with{' '}
            <Favorite sx={{ fontSize: 16, color: 'error.main' }} />{' '}
            by AI Assistant
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
          >
            v1.0.0 | Build 2024.01
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}; 