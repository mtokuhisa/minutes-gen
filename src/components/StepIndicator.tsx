import React from 'react';
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CloudUpload,
  Tune,
  AutoAwesome,
  Assessment,
} from '@mui/icons-material';

// ===========================================
// MinutesGen v0.7.5 - ステップインジケーター（カードスタイル）
// ===========================================

interface StepIndicatorProps {
  activeStep: number;
  isProcessing?: boolean;
}

// ステップデータ
const steps = [
  {
    label: 'ファイル\nアップロード',
    icon: CloudUpload,
  },
  {
    label: 'オプション\n設定',
    icon: Tune,
  },
  {
    label: 'AI\n処理',
    icon: AutoAwesome,
  },
  {
    label: '結果\n確認',
    icon: Assessment,
  },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  activeStep,
  isProcessing = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        width: '100%',
        background: 'white',
        borderRadius: 4,
        p: 3,
        mb: 4,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            fontSize: '1.125rem',
          }}
        >
          議事録生成プロセス
        </Typography>
      </Box>

      {/* カードレイアウト */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: 2,
          mt: 2.5,
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = index < activeStep;
          const isActive = index === activeStep;
          const isPending = index > activeStep;
          const IconComponent = step.icon;

          return (
            <Box
              key={index}
              sx={{
                background: isCompleted 
                  ? '#e8f5e8' 
                  : isActive 
                  ? '#e3f2fd' 
                  : '#f5f5f5',
                borderRadius: 3,
                p: 2.5,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                border: `2px solid ${
                  isCompleted 
                    ? '#4caf50' 
                    : isActive 
                    ? '#2196f3' 
                    : '#e0e0e0'
                }`,
                position: 'relative',
                transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isCompleted 
                  ? '0 4px 12px rgba(76, 175, 80, 0.2)' 
                  : isActive 
                  ? '0 4px 12px rgba(33, 150, 243, 0.2)' 
                  : 'none',
                '&:hover': {
                  transform: isActive ? 'translateY(-2px)' : 'translateY(-1px)',
                },
              }}
            >
              {/* ステータスインジケーター */}
              {isCompleted && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 20,
                    height: 20,
                    background: '#4caf50',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </Box>
              )}
              
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 20,
                    height: 20,
                    background: '#2196f3',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { 
                        boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.4)' 
                      },
                      '50%': { 
                        boxShadow: '0 0 0 8px rgba(33, 150, 243, 0.1)' 
                      },
                      '100%': { 
                        boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.4)' 
                      },
                    },
                  }}
                >
                  ●
                </Box>
              )}

              {/* アイコン */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: isCompleted 
                    ? '#4caf50' 
                    : isActive 
                    ? '#2196f3' 
                    : '#bbb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  ...(isActive && {
                    animation: 'iconPulse 2s infinite',
                    '@keyframes iconPulse': {
                      '0%': { 
                        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.2)' 
                      },
                      '50%': { 
                        boxShadow: '0 6px 20px rgba(33, 150, 243, 0.4)' 
                      },
                      '100%': { 
                        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.2)' 
                      },
                    },
                  }),
                }}
              >
                <IconComponent sx={{ fontSize: 20 }} />
              </Box>

              {/* ラベル */}
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: isCompleted || isActive ? 600 : 500,
                  color: isCompleted 
                    ? '#2e7d32' 
                    : isActive 
                    ? '#1976d2' 
                    : '#666',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-line',
                }}
              >
                {step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}; 