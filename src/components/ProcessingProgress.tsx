import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  Alert,
  Divider,
  CircularProgress,
  Paper,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  CloudUpload,
  Audiotrack,
  AutoAwesome,
  Assignment,
  CheckCircle,
  Error,
  Warning,
  Info,
  PlayArrow,
  Pause,
  ExpandMore,
  ExpandLess,
  Speed,
  Schedule,
  Memory,
  Analytics,
} from '@mui/icons-material';
import { ProcessingProgress as ProcessingProgressType, ProcessingStage } from '../types';

// ===========================================
// MinutesGen v1.0 - 処理進捗表示
// ===========================================

interface ProcessingProgressProps {
  progress: ProcessingProgressType;
  onCancel?: () => void;
  showLogs?: boolean;
}

const stageConfig = {
  uploading: {
    icon: <CloudUpload />,
    label: 'アップロード',
    description: 'ファイルをサーバーに送信中...',
    color: '#ff9800',
  },
  analyzing: {
    icon: <Analytics />,
    label: '解析',
    description: '音声ファイルを解析中...',
    color: '#2196f3',
  },
  transcribing: {
    icon: <Audiotrack />,
    label: '文字起こし',
    description: '音声を文字に変換中...',
    color: '#4caf50',
  },
  generating: {
    icon: <AutoAwesome />,
    label: '議事録生成',
    description: 'AI議事録を生成中...',
    color: '#9c27b0',
  },
  formatting: {
    icon: <Assignment />,
    label: '整形',
    description: '出力形式を整形中...',
    color: '#f44336',
  },
  completed: {
    icon: <CheckCircle />,
    label: '完了',
    description: '処理が完了しました！',
    color: '#4caf50',
  },
  error: {
    icon: <Error />,
    label: 'エラー',
    description: '処理中にエラーが発生しました',
    color: '#f44336',
  },
};

const getLogIcon = (level: 'info' | 'warning' | 'error' | 'success') => {
  switch (level) {
    case 'info':
      return <Info sx={{ fontSize: 16, color: 'info.main' }} />;
    case 'warning':
      return <Warning sx={{ fontSize: 16, color: 'warning.main' }} />;
    case 'error':
      return <Error sx={{ fontSize: 16, color: 'error.main' }} />;
    case 'success':
      return <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />;
    default:
      return <Info sx={{ fontSize: 16, color: 'info.main' }} />;
  }
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}時間${minutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
};

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  progress,
  onCancel,
  showLogs = true,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const currentStage = stageConfig[progress.stage];
  const isCompleted = progress.stage === 'completed';
  const hasError = progress.stage === 'error';

  // 経過時間の計算
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - progress.startedAt.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [progress.startedAt]);

  // ステージの順序定義
  const stages = ['uploading', 'analyzing', 'transcribing', 'generating', 'formatting', 'completed'];
  const currentStageIndex = stages.indexOf(progress.stage);

  return (
    <Box sx={{ width: '100%' }}>
      {/* メイン進捗表示 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* ヘッダー */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ color: currentStage.color, mr: 2 }}>
                {currentStage.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {currentStage.label}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {progress.currentTask}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: currentStage.color }}>
                {progress.percentage}%
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {isCompleted ? '完了' : hasError ? 'エラー' : '処理中'}
              </Typography>
            </Box>
          </Box>

          {/* 進捗バー */}
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={progress.percentage}
              sx={{
                height: 12,
                borderRadius: 6,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: currentStage.color,
                  borderRadius: 6,
                  transition: 'width 0.5s ease',
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                開始時刻: {progress.startedAt.toLocaleTimeString()}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {progress.stage === 'transcribing' && progress.currentTask.includes('ffmpeg.wasm')
          ? '音声ファイルを自動分割処理中...' 
                  : `予想残り時間: ${formatTime(progress.estimatedTimeRemaining)}`}
              </Typography>
            </Box>
          </Box>

          {/* 統計情報 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Schedule sx={{ fontSize: 20, color: 'primary.main', mr: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    経過時間
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatTime(elapsedTime)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Speed sx={{ fontSize: 20, color: 'primary.main', mr: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    処理速度
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {progress.percentage > 0 ? Math.round(progress.percentage / elapsedTime * 100) / 100 : 0}%/s
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Memory sx={{ fontSize: 20, color: 'primary.main', mr: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    処理段階
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {currentStageIndex + 1} / {stages.length}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Analytics sx={{ fontSize: 20, color: 'primary.main', mr: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    完了率
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {Math.round((currentStageIndex / (stages.length - 1)) * 100)}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* ステージ進捗 */}
          <Stepper activeStep={currentStageIndex} orientation="horizontal" sx={{ mb: 3 }}>
            {stages.slice(0, -1).map((stage, index) => {
              const config = stageConfig[stage as ProcessingStage];
              const isActive = index === currentStageIndex;
              const isCompleted = index < currentStageIndex;
              
              return (
                <Step key={stage}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? config.color : isActive ? config.color : 'grey.300',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {config.icon}
                      </Box>
                    )}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: isCompleted || isActive ? config.color : 'text.secondary',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {config.label}
                    </Typography>
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {/* アクションボタン */}
          {onCancel && !isCompleted && !hasError && (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <IconButton
                onClick={onCancel}
                sx={{
                  backgroundColor: 'error.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'error.dark' },
                }}
              >
                <Pause />
              </IconButton>
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                処理を中断
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 結果表示 */}
      {isCompleted && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            🎉 処理が完了しました！
          </Typography>
          <Typography variant="body2">
            議事録の生成に成功しました。結果を確認してください。
          </Typography>
        </Alert>
      )}

      {/* エラー表示 */}
      {hasError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            ❌ エラーが発生しました
          </Typography>
          <Typography variant="body2">
            {progress.currentTask}
          </Typography>
        </Alert>
      )}

      {/* ログ表示 */}
      {showLogs && progress.logs.length > 0 && (
        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setLogsExpanded(!logsExpanded)}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                処理ログ ({progress.logs.length})
              </Typography>
              <IconButton size="small">
                {logsExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            
            <Collapse in={logsExpanded}>
              <Divider sx={{ my: 2 }} />
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {progress.logs.map((log, index) => (
                  <ListItem key={log.id} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {getLogIcon(log.level)}
                    </ListItemIcon>
                    <ListItemText
                      primary={log.message}
                      secondary={log.timestamp.toLocaleTimeString()}
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: { fontWeight: 500 },
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        sx: { color: 'text.secondary' },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}; 