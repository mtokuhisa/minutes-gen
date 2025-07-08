import React, { useState, useCallback } from 'react';
import { TTS } from './TTS';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Download,
  Share,
  Edit,
  Preview,
  People,
  Assignment,
  Schedule,
  Star,
  StarBorder,
  ContentCopy,
  Email,
  Print,
  Visibility,
  ExpandMore,
  Person,
  AccessTime,
  CheckCircle,
  PlayArrow,
  VolumeUp,
  FilePresent,
  Analytics,
  Summarize,
  ListAlt,
  TaskAlt,
} from '@mui/icons-material';
import { MinutesData, OutputFormat, Participant, KeyPoint, ActionItem } from '../types';

// ===========================================
// MinutesGen v1.0 - 結果表示
// ===========================================

interface ResultsProps {
  results: MinutesData;
  onDownload: (format: OutputFormat) => void;
  onShare?: (shareData: any) => void;
  onEdit?: (results: MinutesData) => void;
  onRestart?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ width: '100%' }}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
  switch (importance) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
};

const getPriorityColor = (priority: 'urgent' | 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'urgent': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'success';
    default: return 'default';
  }
};

export const Results: React.FC<ResultsProps> = ({
  results,
  onDownload,
  onShare,
  onEdit,
  onRestart,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('markdown');
  const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  }, []);

  const handleDownload = useCallback((format: OutputFormat) => {
    onDownload(format);
  }, [onDownload]);

  const handleShare = useCallback(() => {
    setShareDialogOpen(true);
  }, []);

  const handlePreview = useCallback((format: OutputFormat) => {
    setSelectedFormat(format);
    setPreviewDialogOpen(true);
  }, []);

  const handleCopyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const formatOutputIcon = (format: OutputFormat) => {
    switch (format) {
      case 'markdown': return '📝';
      case 'word': return '📄';
      case 'html': return '🌐';
      case 'pdf': return '📋';
      default: return '📁';
    }
  };

  const getPreviewContent = (format: OutputFormat) => {
    const output = results.outputs.find(o => o.format === format);
    if (!output) return '';
    
    switch (format) {
      case 'markdown':
        return `# ${results.title}\n\n## 概要\n${results.summary}\n\n## 主要なポイント\n${results.keyPoints.map(kp => `- ${kp.content}`).join('\n')}\n\n## アクション項目\n${results.actionItems.map(ai => `- [ ] ${ai.task} (担当: ${ai.assignee || '未定'})`).join('\n')}`;
      case 'html':
        return `<html><body><h1>${results.title}</h1><h2>概要</h2><p>${results.summary}</p><h2>主要なポイント</h2><ul>${results.keyPoints.map(kp => `<li>${kp.content}</li>`).join('')}</ul></body></html>`;
      default:
        return output.content;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* ヘッダー */}
      <Card 
        sx={{ 
          mb: 3,
          background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)',
          borderRadius: 3,
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
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {results.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip
                  icon={<Schedule />}
                  label={results.date.toLocaleDateString()}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                />
                <Chip
                  icon={<AccessTime />}
                  label={formatDuration(results.duration)}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                />
                <Chip
                  icon={<People />}
                  label={`${results.participants.length}人`}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Share />}
                onClick={handleShare}
                sx={{ 
                  borderRadius: 2,
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'white',
                  },
                }}
              >
                共有
              </Button>
              {onEdit && (
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => onEdit(results)}
                  sx={{ 
                    borderRadius: 2,
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'white',
                    },
                  }}
                >
                  編集
                </Button>
              )}
              {onRestart && (
                <Button
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={onRestart}
                  sx={{ 
                    borderRadius: 2,
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'white',
                    },
                  }}
                >
                  再実行
                </Button>
              )}
            </Box>
          </Box>

          {/* サマリー */}
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              '& .MuiAlert-icon': {
                color: 'white',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {results.summary}
            </Typography>
          </Alert>

          {/* 統計情報 */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Paper 
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'primary.main',
                    mb: 1,
                  }}
                >
                  {results.keyPoints.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  重要なポイント
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper 
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'primary.main',
                    mb: 1,
                  }}
                >
                  {results.actionItems.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  アクション項目
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper 
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'primary.main',
                    mb: 1,
                  }}
                >
                  {results.transcription.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  発言セグメント
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Paper 
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'primary.main',
                    mb: 1,
                  }}
                >
                  {results.outputs.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  出力形式
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* タブナビゲーション */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 0 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange} 
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 72,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 700,
                },
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab icon={<Summarize />} label="概要" />
            <Tab icon={<People />} label="参加者" />
            <Tab icon={<ListAlt />} label="重要ポイント" />
            <Tab icon={<TaskAlt />} label="アクション項目" />
            <Tab icon={<VolumeUp />} label="文字起こし" />
            <Tab icon={<FilePresent />} label="出力ファイル" />
          </Tabs>

          {/* 概要タブ */}
          <TabPanel value={currentTab} index={0}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              会議の概要
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.6, mb: 3 }}>
              {results.summary}
            </Typography>
            
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              処理情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemIcon><Analytics /></ListItemIcon>
                    <ListItemText primary="処理時間" secondary={`${results.metadata.processingTime}秒`} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><VolumeUp /></ListItemIcon>
                    <ListItemText primary="使用モデル" secondary={results.metadata.model} />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemIcon><Assignment /></ListItemIcon>
                    <ListItemText primary="品質" secondary={results.metadata.quality} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Schedule /></ListItemIcon>
                    <ListItemText primary="生成日時" secondary={results.metadata.generatedAt.toLocaleString()} />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 参加者タブ */}
          <TabPanel value={currentTab} index={1}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              参加者一覧
            </Typography>
            <Grid container spacing={2}>
              {results.participants.map((participant) => (
                <Grid item xs={12} md={6} key={participant.id}>
                  <Card sx={{ border: '1px solid', borderColor: 'grey.200' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Person sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {participant.name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {participant.role || '参加者'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                          label={`発言時間: ${formatDuration(participant.speakingTime)}`}
                          size="small"
                          sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          {/* 重要ポイントタブ */}
          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              重要なポイント
            </Typography>
            <List>
              {results.keyPoints.map((keyPoint, index) => (
                <ListItem key={keyPoint.id} sx={{ border: '1px solid', borderColor: 'grey.200', mb: 1, borderRadius: 1 }}>
                  <ListItemText
                    primary={keyPoint.content}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip
                          label={keyPoint.importance}
                          size="small"
                          color={getImportanceColor(keyPoint.importance)}
                        />
                        <Chip
                          label={formatDuration(keyPoint.timestamp)}
                          size="small"
                          sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                        />
                        {keyPoint.category && (
                          <Chip
                            label={keyPoint.category}
                            size="small"
                            sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* アクション項目タブ */}
          <TabPanel value={currentTab} index={3}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              アクション項目
            </Typography>
            <List>
              {results.actionItems.map((actionItem) => (
                <ListItem key={actionItem.id} sx={{ border: '1px solid', borderColor: 'grey.200', mb: 1, borderRadius: 1 }}>
                  <ListItemIcon>
                    <CheckCircle sx={{ color: actionItem.status === 'completed' ? 'success.main' : 'grey.400' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={actionItem.task}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          icon={<Person />}
                          label={actionItem.assignee || '未定'}
                          size="small"
                        />
                        <Chip
                          icon={<AccessTime />}
                          label={actionItem.dueDate ? new Date(actionItem.dueDate).toLocaleDateString() : '期限なし'}
                          size="small"
                        />
                        <Chip
                          label={actionItem.priority}
                          size="small"
                          color={getPriorityColor(actionItem.priority)}
                        />
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="完了としてマーク">
                      <IconButton size="small">
                        {/* IconButton content */}
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* 文字起こしタブ */}
          <TabPanel value={currentTab} index={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              文字起こし
            </Typography>
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {results.transcription.map((segment) => (
                <ListItem key={segment.id} sx={{ alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDuration(segment.startTime)} - {formatDuration(segment.endTime)}
                      </Typography>
                      {segment.speakerId && (
                        <Chip
                          label={results.participants.find(p => p.id === segment.speakerId)?.name || '不明'}
                          size="small"
                          sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                        />
                      )}
                      <Chip
                        label={`信頼度: ${Math.round(segment.confidence * 100)}%`}
                        size="small"
                        sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {segment.text}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* 出力ファイルタブ */}
          <TabPanel value={currentTab} index={5}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              出力ファイル
            </Typography>
            <Grid container spacing={2}>
              {results.outputs.map((output) => (
                <Grid item xs={12} md={6} key={output.format}>
                  <Card sx={{ border: '1px solid', borderColor: 'grey.200' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography sx={{ fontSize: '2rem', mr: 2 }}>
                          {formatOutputIcon(output.format)}
                        </Typography>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {output.format.toUpperCase()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {formatFileSize(output.size)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Download />}
                          onClick={() => handleDownload(output.format)}
                          sx={{ flex: 1 }}
                        >
                          ダウンロード
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handlePreview(output.format)}
                        >
                          プレビュー
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </CardContent>
      </Card>

      {/* 音声合成（TTS）セクション */}
      <TTS text={results.summary} />

      {/* 共有ダイアログ */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>結果を共有</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => handleCopyToClipboard(results.summary)}
              sx={{ flex: 1 }}
            >
              サマリーをコピー
            </Button>
            <Button
              variant="outlined"
              startIcon={<Email />}
              sx={{ flex: 1 }}
            >
              メールで送信
            </Button>
          </Box>
          <TextField
            fullWidth
            label="共有メモ"
            multiline
            rows={3}
            variant="outlined"
            placeholder="共有する際のメモを入力してください..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={() => setShareDialogOpen(false)}>
            共有
          </Button>
        </DialogActions>
      </Dialog>

      {/* プレビューダイアログ */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedFormat.toUpperCase()} プレビュー
        </DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {getPreviewContent(selectedFormat)}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>閉じる</Button>
          <Button variant="contained" startIcon={<Download />} onClick={() => handleDownload(selectedFormat)}>
            ダウンロード
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 