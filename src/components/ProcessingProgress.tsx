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
  Button,
} from '@mui/material';
import { keyframes } from '@mui/system';
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
  Segment,
} from '@mui/icons-material';
import { ProcessingProgress as ProcessingProgressType, ProcessingStage } from '../types';

// ===========================================
// MinutesGen v1.0 - 処理進捗表示（拡張版）
// ===========================================

interface ProcessingProgressProps {
  progress: ProcessingProgressType;
  onCancel?: () => void;
  showLogs?: boolean;
  detailedProgress?: {
    lastUpdateTime: Date;
  };
  selectedFile?: {
    name: string;
    size: number;
    type: string;
    duration?: number;
    metadata?: any;
  } | null;
}





// 色分けシステム
const statusColors = {
  processing: '#1976d2', // 青色: 処理中
  completed: '#388e3c',  // 緑色: 完了
  waiting: '#f57c00',    // オレンジ色: 待機中
  error: '#d32f2f',      // 赤色: エラー
  warning: '#fbc02d',    // 黄色: 注意
};

// アニメーション定義
const pulseAnimation = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const thinkingAnimation = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
`;

const bubbleAnimation = keyframes`
  0% { transform: translateY(0px); opacity: 0.3; }
  50% { transform: translateY(-10px); opacity: 0.7; }
  100% { transform: translateY(-20px); opacity: 0; }
`;

const stageConfig = {
  uploading: {
    icon: <CloudUpload />,
    label: 'アップロード',
    description: 'ファイルをサーバーに送信中...',
    color: statusColors.processing,
    detailedMessages: [
      'ファイルを読み込み中...',
      'アップロード準備中...',
      'サーバーに送信中...'
    ]
  },
  preprocessing: {
    icon: <Analytics />,
    label: 'ファイル前処理中',
    description: '音声ファイルを解析準備中...',
    color: statusColors.processing,
    detailedMessages: [
      '音声ファイルを解析準備中...',
      'ファイルの解析中（時間がかかります）',
      '音声を圧縮中',
      'セグメントを準備中'
    ]
  },
  transcribing: {
    icon: <Audiotrack />,
    label: '文字起こし',
    description: 'OpenAI Whisperで音声を文字に変換中...',
    color: statusColors.processing,
    detailedMessages: [
      'OpenAI APIに接続中...',
      'Whisperモデルで音声認識中...',
      '音声を文字に変換中...',
      '文字起こし結果を確認中...'
    ]
  },
  generating: {
    icon: <AutoAwesome />,
    label: '議事録生成',
    description: 'AIが議事録を生成中...',
    color: statusColors.processing,
    detailedMessages: [
      'AI議事録生成を開始中...',
      '内容を分析中...',
      '議事録を構成中...',
      '最終確認中...'
    ]
  },
  formatting: {
    icon: <Assignment />,
    label: '整形',
    description: '出力形式を整形中...',
    color: statusColors.processing,
    detailedMessages: [
      '出力形式を整形中...',
      'ファイル生成中...',
      '最終調整中...'
    ]
  },
  completed: {
    icon: <CheckCircle />,
    label: '完了',
    description: '処理が完了しました！',
    color: statusColors.completed,
    detailedMessages: ['処理が完了しました！']
  },
  error: {
    icon: <Error />,
    label: 'エラー',
    description: '処理中にエラーが発生しました',
    color: statusColors.error,
    detailedMessages: ['処理中にエラーが発生しました']
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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle sx={{ color: statusColors.completed, fontSize: 20 }} />;
    case 'processing':
      return <CircularProgress size={16} sx={{ color: statusColors.processing }} />;
    case 'waiting':
      return <Schedule sx={{ color: statusColors.waiting, fontSize: 20 }} />;
    case 'error':
      return <Error sx={{ color: statusColors.error, fontSize: 20 }} />;
    default:
      return <Schedule sx={{ color: statusColors.waiting, fontSize: 20 }} />;
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
  detailedProgress,
  selectedFile,
}) => {
  // Hooksを先に呼び出す（条件付きで呼び出してはいけない）
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [fixedStartTime] = useState(progress?.startedAt || new Date());

  // 経過時間の計算（progressがnullでも呼び出す）
  useEffect(() => {
    if (!progress) return;
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - fixedStartTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [fixedStartTime, progress]);

  // progressがnullの場合のデフォルト値
  if (!progress) {
    return (
      <Box sx={{ width: '100%', textAlign: 'center', py: 4 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          処理を開始しています...
        </Typography>
      </Box>
    );
  }
  
  const currentStage = stageConfig[progress.stage];
  const isCompleted = progress.stage === 'completed';
  const hasError = progress.stage === 'error';



  const stages = ['uploading', 'preprocessing', 'transcribing', 'generating', 'formatting', 'completed'];
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
                開始時刻: {fixedStartTime.toLocaleTimeString()}
              </Typography>
              {progress.stage === 'transcribing' && progress.currentTask.includes('ffmpeg.wasm') && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  音声ファイルを自動分割処理中...
              </Typography>
              )}
            </Box>
          </Box>

          {/* ファイル情報 */}
          {selectedFile && (
            <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                📁 処理中のファイル
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip 
                  label={`ファイル名: ${selectedFile.name}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)' }}
                />
                <Chip 
                  label={`サイズ: ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB`}
                  size="small"
                  sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)' }}
                />
                {selectedFile.duration && (
                  <Chip 
                    label={`長さ: ${Math.floor(selectedFile.duration / 60)}分${Math.floor(selectedFile.duration % 60)}秒`}
                    size="small"
                    sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)' }}
                  />
                )}
                <Chip 
                  label={`形式: ${selectedFile.type?.split('/')[1]?.toUpperCase() || 'Unknown'}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)' }}
                />
              </Box>
            </Box>
          )}



          {/* 統計情報 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
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
        <Card sx={{ mb: 3, borderLeft: `4px solid ${statusColors.completed}`, position: 'relative', overflow: 'hidden' }}>
          <CardContent sx={{ position: 'relative' }}>
            {/* 完了祝いアニメーション */}
            <Box 
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                background: 'linear-gradient(45deg, transparent 30%, rgba(76, 175, 80, 0.1) 50%, transparent 70%)',
                animation: `${pulseAnimation} 3s ease-in-out infinite`
              }}
            />
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative' }}>
              <CheckCircle sx={{ color: statusColors.completed, mr: 2, fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: statusColors.completed }}>
            🎉 処理が完了しました！
          </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            議事録の生成に成功しました。結果を確認してください。
          </Typography>
              </Box>
            </Box>
            
            {/* 完了統計 */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', position: 'relative' }}>
              <Chip 
                label={`処理時間: ${formatTime(elapsedTime)}`}
                size="small"
                sx={{ bgcolor: statusColors.completed, color: 'white' }}
              />
              <Chip 
                label={`完了率: 100%`}
                size="small"
                sx={{ bgcolor: statusColors.completed, color: 'white' }}
              />
              <Chip 
                label={`処理完了`}
                size="small"
                sx={{ bgcolor: statusColors.completed, color: 'white' }}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {hasError && (
        <Card sx={{ mb: 3, borderLeft: `4px solid ${statusColors.error}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Error sx={{ color: statusColors.error, mr: 2, fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: statusColors.error }}>
                エラーが発生しました
          </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
            {progress.currentTask}
          </Typography>
            
            {/* 自動復旧機能 */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Warning sx={{ color: statusColors.warning, mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  自動復旧を試行中...
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                システムが自動的に復旧処理を実行しています。しばらくお待ちください。
              </Typography>
              <LinearProgress sx={{ mt: 1, height: 4 }} />
            </Box>
          </CardContent>
        </Card>
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