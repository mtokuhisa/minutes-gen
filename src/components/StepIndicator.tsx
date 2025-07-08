import React from 'react';
import {
  Box,
  Step,
  StepLabel,
  Stepper,
  StepConnector,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  CloudUpload,
  Tune,
  AutoAwesome,
  Assessment,
  CheckCircle,
} from '@mui/icons-material';

// ===========================================
// MinutesGen v1.0 - ステップインジケーター
// ===========================================

interface StepIndicatorProps {
  activeStep: number;
  isProcessing?: boolean;
}

// カスタムステップアイコン
const StepIcon = styled('div')<{ ownerState: { active: boolean; completed: boolean } }>(
  ({ theme, ownerState }) => ({
    backgroundColor: ownerState.completed
      ? theme.palette.success.main
      : ownerState.active
      ? theme.palette.primary.main
      : theme.palette.grey[300],
    zIndex: 1,
    color: '#fff',
    width: 50,
    height: 50,
    display: 'flex',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: ownerState.active || ownerState.completed
      ? `0 4px 10px rgba(76, 175, 80, 0.4)`
      : 'none',
    transition: 'all 0.3s ease',
    transform: ownerState.active ? 'scale(1.1)' : 'scale(1)',
    ...(ownerState.active && {
      backgroundImage: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
      animation: 'pulse 2s infinite',
    }),
    ...(ownerState.completed && {
      backgroundImage: 'linear-gradient(135deg, #2e7d32 0%, #388e3c 100%)',
    }),
    '&:hover': {
      transform: 'scale(1.05)',
    },
    '@keyframes pulse': {
      '0%': {
        boxShadow: '0 4px 10px rgba(76, 175, 80, 0.4)',
      },
      '50%': {
        boxShadow: '0 6px 20px rgba(76, 175, 80, 0.6)',
      },
      '100%': {
        boxShadow: '0 4px 10px rgba(76, 175, 80, 0.4)',
      },
    },
  })
);

// カスタムコネクタ
const StepConnectorStyled = styled(StepConnector)(({ theme }) => ({
  '& .MuiStepConnector-line': {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.grey[200],
    borderRadius: 1,
    transition: 'all 0.3s ease',
    marginTop: 0,
    marginBottom: 0,
  },
  '&.Mui-active .MuiStepConnector-line': {
    backgroundImage: 'linear-gradient(95deg, #66bb6a 0%, #4caf50 100%)',
    animation: 'flow 2s infinite',
  },
  '&.Mui-completed .MuiStepConnector-line': {
    backgroundImage: 'linear-gradient(95deg, #2e7d32 0%, #388e3c 100%)',
  },
  // 水平レイアウト時の縦位置中央合わせ
  '&.MuiStepConnector-horizontal': {
    top: '50%',
    left: 'calc(-50% + 20px)',
    right: 'calc(50% + 20px)',
    transform: 'translateY(-50%)',
  },
  // 垂直レイアウト時の調整
  '&.MuiStepConnector-vertical': {
    marginLeft: 24,
    minHeight: 40,
    '& .MuiStepConnector-line': {
      width: 3,
      height: '100%',
      minHeight: 40,
    },
  },
  '@keyframes flow': {
    '0%': {
      backgroundPosition: '0% 0%',
    },
    '100%': {
      backgroundPosition: '100% 0%',
    },
  },
}));

// ステップデータ
const steps = [
  {
    label: 'ファイルアップロード',
    description: '音声・動画ファイルを選択',
    icon: CloudUpload,
  },
  {
    label: 'オプション設定',
    description: '処理方法を選択',
    icon: Tune,
  },
  {
    label: 'AI処理',
    description: '音声を議事録に変換',
    icon: AutoAwesome,
  },
  {
    label: '結果確認',
    description: '生成された議事録を確認',
    icon: Assessment,
  },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  activeStep,
  isProcessing = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const ColorlibStepIconRoot = (props: any) => {
    const { active, completed, className, icon } = props;
    const IconComponent = steps[icon - 1]?.icon || CheckCircle;

    return (
      <StepIcon
        ownerState={{ active, completed }}
        className={className}
      >
        <IconComponent sx={{ fontSize: 24 }} />
      </StepIcon>
    );
  };

  return (
    <Box
      sx={{
        width: '100%',
        py: 4,
        px: 2,
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #424242 0%, #303030 100%)'
          : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
        borderRadius: 3,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        mb: 4,
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'primary.dark',
            mb: 1,
          }}
        >
          議事録生成プロセス
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {isProcessing
            ? 'AI処理中です。しばらくお待ちください...'
            : `ステップ ${activeStep + 1} / ${steps.length}: ${steps[activeStep]?.label || '完了'}`}
        </Typography>
      </Box>

      {/* ステッパー */}
      <Stepper
        alternativeLabel={!isMobile}
        activeStep={activeStep}
        connector={<StepConnectorStyled />}
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{
          '& .MuiStepLabel-root': {
            cursor: 'default',
          },
          '& .MuiStepLabel-label': {
            fontWeight: 500,
            fontSize: '0.9rem',
            '&.Mui-active': {
              color: 'primary.main',
              fontWeight: 600,
            },
            '&.Mui-completed': {
              color: 'success.main',
              fontWeight: 600,
            },
          },
          '& .MuiStepLabel-alternativeLabel': {
            marginTop: 2,
          },
        }}
      >
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              StepIconComponent={ColorlibStepIconRoot}
              sx={{
                '& .MuiStepLabel-iconContainer': {
                  paddingRight: isMobile ? 2 : 0,
                },
              }}
            >
              <Box sx={{ textAlign: isMobile ? 'left' : 'center' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: activeStep >= index ? 600 : 400,
                    color: activeStep >= index ? 'primary.main' : 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  {step.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    display: isMobile ? 'block' : 'none',
                  }}
                >
                  {step.description}
                </Typography>
              </Box>
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* 進捗インジケーター */}
      {isProcessing && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: '100%',
              height: 6,
              backgroundColor: 'grey.200',
              borderRadius: 3,
              overflow: 'hidden',
              mb: 2,
            }}
          >
            <Box
              sx={{
                height: '100%',
                background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
                borderRadius: 3,
                width: `${((activeStep + 1) / steps.length) * 100}%`,
                transition: 'width 0.5s ease',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                  animation: 'shimmer 2s infinite',
                },
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
            }}
          >
            {Math.round(((activeStep + 1) / steps.length) * 100)}% 完了
          </Typography>
        </Box>
      )}
    </Box>
  );
}; 