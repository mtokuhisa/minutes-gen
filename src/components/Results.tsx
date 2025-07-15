import React, { useState } from 'react';
import { TTS } from './TTS';
import { InfographicGenerator } from './InfographicGenerator';
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
  Article,
  Description,
  GetApp,
  RecordVoiceOver,
  BarChart,
  Settings,
  Refresh,
} from '@mui/icons-material';
import { MinutesData, OutputFormat, Participant, KeyPoint, ActionItem } from '../types';
import { useTheme } from '../theme';
import { detectTextCorruption, generateCorruptionWarning, CorruptionDetectionResult } from '../utils/textCorruptionDetector';

// ===========================================
// MinutesGen v1.0 - 結果表示
// ===========================================

interface ResultsProps {
  results: MinutesData;
  onDownload: (format: OutputFormat) => void;
  onShare?: (shareData: any) => void;
  onEdit?: (results: MinutesData) => void;
  onRestart?: () => void;
  onBackToSettings?: () => void;
  onClearAndRestart?: () => void;
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
  onBackToSettings,
  onClearAndRestart,
}) => {
  const { themeMode } = useTheme();
  const [currentTab, setCurrentTab] = useState(1); // 議事録タブを初期表示
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('markdown');
  const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });

  // 安全なresults確認
  if (!results) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography variant="h6" color="text.secondary">
          結果データが見つかりません
        </Typography>
      </Box>
    );
  }

  // 文字化けチェック結果を取得
  const getCorruptionCheck = () => {
    try {
      const markdownOutput = results.outputs?.find(output => output.format === 'markdown');
      const minutesText = markdownOutput?.content || results.summary || '';
      
      // AIが文字化けエラーを検出した場合
      if (minutesText.includes('【エラー：文字化けを検出しました】')) {
        return {
          hasError: true,
          errorMessage: minutesText,
          isAIDetected: true
        };
      }

      // フロントエンドでの文字化けチェック
      const corruptionResult = detectTextCorruption(minutesText);
      if (corruptionResult.isCorrupted) {
        const warningMessage = generateCorruptionWarning(corruptionResult);
        return {
          hasError: true,
          errorMessage: warningMessage,
          isAIDetected: false
        };
      }

      return { hasError: false, errorMessage: '', isAIDetected: false };
    } catch (error) {
      console.error('文字化けチェックエラー:', error);
      return { hasError: false, errorMessage: '', isAIDetected: false };
    }
  };

  const corruptionCheck = getCorruptionCheck();

  // 議事録内容の文字化けチェック
  const checkMinutesForCorruption = () => {
    return corruptionCheck;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleDownload = (format: OutputFormat) => {
    onDownload(format);
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handlePreview = (format: OutputFormat) => {
    setSelectedFormat(format);
    setPreviewDialogOpen(true);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 時間と認識率の表記を除去するヘルパー関数
  const cleanTranscriptionText = (text: string): string => {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // 文字化け修正を一時的に無効化（デバッグ用）
    return text
      // [0:00 - 0:30] 95% のような表記を除去
      .replace(/\[\d+:\d+\s*-\s*\d+:\d+\]\s*\d+%\s*/g, '')
      // [00:00:00 - 00:00:30] 95% のような表記を除去
      .replace(/\[\d+:\d+:\d+\s*-\s*\d+:\d+:\d+\]\s*\d+%\s*/g, '')
      // その他の時間表記を除去
      .replace(/\[\d+:\d+\]\s*/g, '')
      .replace(/\[\d+:\d+:\d+\]\s*/g, '')
      // 認識率のみの表記を除去
      .replace(/\s*\d+%\s*/g, ' ')
      // 複数の空白を1つに
      .replace(/\s+/g, ' ')
      .trim();
  };

  // 表示用の改行処理された文字起こしテキスト
  const getTranscriptionDisplayText = (): string => {
    try {
      let rawText = '';
      
      // 配列形式の文字起こしデータから表示用テキストを生成
      if (Array.isArray(results.transcription)) {
        rawText = results.transcription
          .map(segment => cleanTranscriptionText(segment?.text || ''))
          .filter(text => text && text.trim().length > 0)
          .join('\n\n');
      } else {
        // 後方互換性のため、文字列形式もサポート
        rawText = results.transcription as string;
        if (!rawText || typeof rawText !== 'string') {
          return '';
        }
        rawText = cleanTranscriptionText(rawText);
      }
      
      // 表示用の改行処理（読みやすさを重視）
      return rawText
        // 句読点での改行
        .replace(/([。！？])\s*/g, '$1\n\n')
        // 長い文での適切な改行
        .replace(/(.{60,}?)([、])/g, '$1$2\n')
        // 敬語での改行
        .replace(/(です|ます|である|だった|でした|ました|ません|でしょう)([。、]?)\s*/g, '$1$2\n')
        // 接続詞での改行
        .replace(/\s*(そして|また|しかし|ただし|なお|さらに|一方|他方|つまり|すなわち|要するに|このように|このため|したがって|ゆえに)/g, '\n\n$1')
        // 長すぎる行での改行
        .replace(/(.{80,}?)(\s)/g, '$1\n')
        // 過度な改行を整理
        .replace(/\n{4,}/g, '\n\n')
        // 行頭の空白を除去
        .replace(/^\s+/gm, '')
        .trim();
    } catch (error) {
      console.error('文字起こしテキスト処理エラー:', error);
      return '文字起こしデータの処理中にエラーが発生しました。';
    }
  };

  // ダウンロード用のMarkdown形式文字起こし
  const getTranscriptionMarkdown = (): string => {
    try {
      const displayText = getTranscriptionDisplayText();
      
      // 各行を処理して空行をフィルタリング
      const lines = displayText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // Markdown形式でヘッダーを追加
      const markdownContent = `# 文字起こし原稿

**開催日時**: ${results.date ? results.date.toLocaleDateString('ja-JP', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  weekday: 'long'
}) : '不明'}

**文字数**: ${lines.join('').length}文字

---

## 内容

${lines.join('\n\n')}

---

*Generated by MinutesGen v1.0 - ${new Date().toLocaleDateString('ja-JP')}*`;

      return markdownContent;
    } catch (error) {
      console.error('Markdown生成エラー:', error);
      return '# 文字起こし原稿\n\nエラーが発生しました。';
    }
  };

  const handleCopyTranscription = () => {
    const transcriptionMarkdown = getTranscriptionMarkdown();
    navigator.clipboard.writeText(transcriptionMarkdown);
    // TODO: トースト通知を追加
  };

  const handleCopySegment = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: トースト通知を追加
  };

  const handleDownloadTranscription = () => {
    const transcriptionMarkdown = getTranscriptionMarkdown();
    const blob = new Blob([transcriptionMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${results.title}_transcription.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatOutputIcon = (format: OutputFormat) => {
    switch (format) {
      case 'markdown': return '📝';
      case 'word': return '📄';
      case 'html': return '🌐';
      default: return '📁';
    }
  };

  const getOutputFormatInfo = (format: OutputFormat) => {
    switch (format) {
      case 'markdown':
        return {
          name: 'Markdown',
          extension: '.md',
          description: 'GitHub対応の軽量フォーマット',
          features: ['軽量', 'プレーンテキスト', 'バージョン管理対応'],
        };
      case 'word':
        return {
          name: 'Word文書',
          extension: '.rtf',
          description: 'Microsoft Word対応フォーマット',
          features: ['ビジネス向け', '高い互換性', '編集可能'],
        };
      case 'html':
        return {
          name: 'HTML',
          extension: '.html',
          description: 'Web表示対応フォーマット',
          features: ['ブラウザ表示', 'インタラクティブ', '美しい装飾'],
        };
      default:
        return {
          name: 'ファイル',
          extension: '',
          description: '不明なフォーマット',
          features: [],
        };
    }
  };

  const generateEnhancedHTML = (minutesData: MinutesData): string => {
    const transcriptionText = Array.isArray(minutesData.transcription) 
      ? minutesData.transcription.map(segment => cleanTranscriptionText(segment.text)).join('\n')
      : cleanTranscriptionText(minutesData.transcription as string);

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${minutesData.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .header .meta {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .content {
            padding: 40px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            font-size: 1.8rem;
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section h3 {
            font-size: 1.4rem;
            color: #555;
            margin: 20px 0 15px 0;
        }
        .summary {
            background: #f8f9ff;
            padding: 30px;
            border-radius: 12px;
            border-left: 5px solid #667eea;
            font-size: 1.1rem;
        }
        .stats {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 30px;
        }
        .stat-item {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            text-align: center;
            flex: 1;
            min-width: 150px;
        }
        .stat-item .value {
            font-size: 1.5rem;
            font-weight: bold;
            display: block;
        }
        .stat-item .label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        .key-points {
            display: grid;
            gap: 15px;
        }
        .key-point {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
            transition: transform 0.2s ease;
        }
        .key-point:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .key-point .importance {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .key-point .importance.high {
            background: #ff6b6b;
            color: white;
        }
        .key-point .importance.medium {
            background: #ffa726;
            color: white;
        }
        .key-point .importance.low {
            background: #66bb6a;
            color: white;
        }
        .action-items {
            display: grid;
            gap: 15px;
        }
        .action-item {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #4caf50;
        }
        .action-item .priority {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .action-item .priority.urgent {
            background: #f44336;
            color: white;
        }
        .action-item .priority.high {
            background: #ff9800;
            color: white;
        }
        .action-item .priority.medium {
            background: #2196f3;
            color: white;
        }
        .action-item .priority.low {
            background: #4caf50;
            color: white;
        }
        .participants {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .participant {
            background: #f8f9ff;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #e3f2fd;
        }
        .participant .name {
            font-size: 1.2rem;
            font-weight: bold;
            margin-bottom: 5px;
            color: #667eea;
        }
        .participant .role {
            color: #666;
            margin-bottom: 10px;
        }
        .participant .speaking-time {
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        .transcription {
            background: #f5f5f5;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #ddd;
            font-family: 'Courier New', monospace;
            line-height: 1.8;
            max-height: 400px;
            overflow-y: auto;
        }
        .footer {
            background: #f8f9ff;
            padding: 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        @media (max-width: 768px) {
            .content {
                padding: 20px;
            }
            .header {
                padding: 20px;
            }
            .header h1 {
                font-size: 2rem;
            }
            .stats {
                flex-direction: column;
            }
            .participants {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${minutesData.title}</h1>
            <div class="meta">
                ${minutesData.date.toLocaleDateString('ja-JP', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="stats">
                    <div class="stat-item">
                        <span class="value">${minutesData.participants.length}</span>
                        <span class="label">参加者</span>
                    </div>
                    <div class="stat-item">
                        <span class="value">${Math.floor(minutesData.duration / 60)}</span>
                        <span class="label">分</span>
                    </div>
                    <div class="stat-item">
                        <span class="value">${minutesData.keyPoints.length}</span>
                        <span class="label">重要ポイント</span>
                    </div>
                    <div class="stat-item">
                        <span class="value">${minutesData.actionItems.length}</span>
                        <span class="label">アクション</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>📝 議事録サマリー</h2>
                <div class="summary">
                    ${minutesData.summary}
                </div>
            </div>
            
            <div class="section">
                <h2>⭐ 主要なポイント</h2>
                <div class="key-points">
                    ${minutesData.keyPoints.map(kp => `
                        <div class="key-point">
                            <span class="importance ${kp.importance}">${kp.importance}</span>
                            <div>${kp.content}</div>

                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="section">
                <h2>✅ アクション項目</h2>
                <div class="action-items">
                    ${minutesData.actionItems.map(ai => `
                        <div class="action-item">
                            <span class="priority ${ai.priority}">${ai.priority}</span>
                            <div style="font-weight: bold; margin-bottom: 5px;">${ai.task}</div>
                            <div style="color: #666;">
                                担当: ${ai.assignee || '未定'} | 
                                期限: ${ai.dueDate ? ai.dueDate.toLocaleDateString() : '未定'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="section">
                <h2>👥 参加者</h2>
                <div class="participants">
                    ${minutesData.participants.map(p => `
                        <div class="participant">
                            <div class="name">${p.name}</div>
                            <div class="role">${p.role || '参加者'}</div>

                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="section">
                <h2>🎤 文字起こし</h2>
                <div class="transcription">
                    ${transcriptionText.split('\n').map(line => `<p>${line}</p>`).join('')}
                </div>
            </div>
        </div>
        
        <div class="footer">
            Generated by MinutesGen v1.0 - ${new Date().toLocaleDateString('ja-JP')}
        </div>
    </div>
</body>
</html>`;
  };

  const generateFormattedMinutes = (minutesData: MinutesData): string => {
    const transcriptionText = Array.isArray(minutesData.transcription) 
      ? minutesData.transcription.map(segment => cleanTranscriptionText(segment.text)).join('\n')
      : cleanTranscriptionText(minutesData.transcription as string);

    return `
      <h1>${minutesData.title}</h1>
      
      <h2>📋 会議概要</h2>
      <p><strong>開催日時:</strong> ${minutesData.date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      })}</p>

      <p><strong>参加者:</strong> ${minutesData.participants.map(p => p.name).join(', ')}</p>
      
      <h2>📝 議事録サマリー</h2>
      <p>${minutesData.summary}</p>
      
      <h2>⭐ 主要なポイント</h2>
      <ul>
        ${minutesData.keyPoints.map(kp => `
          <li>
            <strong>${kp.content}</strong>
            <br><em>重要度: ${kp.importance}</em>
          </li>
        `).join('')}
      </ul>
      
      <h2>✅ アクション項目</h2>
      <ul>
        ${minutesData.actionItems.map(ai => `
          <li>
            <strong>${ai.task}</strong>
            <br><em>担当者: ${ai.assignee || '未定'} | 優先度: ${ai.priority} | 期限: ${ai.dueDate ? ai.dueDate.toLocaleDateString() : '未定'}</em>
          </li>
        `).join('')}
      </ul>
      
      <h2>👥 参加者詳細</h2>
      <table>
        <thead>
          <tr>
            <th>氏名</th>
            <th>役職</th>
          </tr>
        </thead>
        <tbody>
          ${minutesData.participants.map(p => `
            <tr>
              <td>${p.name}</td>
              <td>${p.role || '参加者'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const getPreviewContent = (format: OutputFormat) => {
    const output = results.outputs.find(o => o.format === format);
    if (!output) return '';
    
    const transcriptionText = Array.isArray(results.transcription) 
      ? results.transcription.map(segment => segment.text).join('\n')
      : results.transcription;
    
    switch (format) {
      case 'markdown':
        // 実際の出力内容を使用
        return output.content || getMarkdownMinutes();
      case 'html':
        return generateEnhancedHTML(results);
      case 'word':
        return `Word文書 (.docx) 形式でのプレビューは利用できません。ダウンロードして確認してください。

内容:
- タイトル: ${results.title}
- 参加者: ${results.participants.length}名
- 主要ポイント: ${results.keyPoints.length}件
- アクション項目: ${results.actionItems.length}件
- 文字数: ${transcriptionText.length}文字

このファイルはMicrosoft Word形式(.docx)で生成され、以下の機能を含みます:
- 美しいフォーマット
- 印刷対応レイアウト
- 編集可能なテキスト
- 目次とページ番号`;

      default:
        return output.content;
    }
  };

  const getHeaderBackground = () => {
    switch (themeMode) {
      case 'color':
        return 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)';
      case 'light':
        return 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)';
      case 'dark':
        return 'linear-gradient(135deg, #424242 0%, #212121 100%)';
      default:
        return 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)';
    }
  };

  const getHeaderShadow = () => {
    switch (themeMode) {
      case 'color':
        return '0 8px 32px rgba(76, 175, 80, 0.3)';
      case 'light':
        return '0 8px 32px rgba(25, 118, 210, 0.3)';
      case 'dark':
        return '0 8px 32px rgba(66, 66, 66, 0.4)';
      default:
        return '0 8px 32px rgba(76, 175, 80, 0.3)';
    }
  };

  // Markdown議事録内容を取得
  const getMarkdownMinutes = (): string => {
    const markdownOutput = results.outputs.find(output => output.format === 'markdown');
    return markdownOutput?.content || results.summary;
  };

  // HTML議事録内容を取得
  const getHTMLMinutes = (): string => {
    const htmlOutput = results.outputs.find(output => output.format === 'html');
    return htmlOutput?.content || generateEnhancedHTML(results);
  };

  // MarkdownをHTMLに変換（簡易版）
  const convertMarkdownToHTML = (markdown: string): string => {
    return markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\/li>\s*<li>/g, '</li><li>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<p><h([1-6])>/g, '<h$1>')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\/ul><\/p>/g, '</ul>')
      .replace(/<p><\/p>/g, '')
      .replace(/\n/g, '');
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* ヘッダー */}
      <Card 
        sx={{ 
          mb: 3,
          background: getHeaderBackground(),
          color: 'white',
          boxShadow: getHeaderShadow(),
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
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {results.title}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {results.summary.length > 50 ? results.summary.substring(0, 50) + '...' : results.summary}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                icon={<Schedule />}
                label={results.date.toLocaleDateString('ja-JP')}
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* タブナビゲーション */}
      <Paper 
        sx={{ 
          mb: 3,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: themeMode === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minHeight: 64,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              color: themeMode === 'dark' ? 'text.secondary' : 'text.primary',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<Article />}
            label="文字起こし原稿"
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<Description />}
            label="議事録"
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<GetApp />}
            label="出力"
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<RecordVoiceOver />}
            label="音声合成"
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<BarChart />}
            label="ビジュアル化"
            iconPosition="start"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Paper>

      {/* タブコンテンツ */}
      <TabPanel value={currentTab} index={0}>
        {/* 文字起こし原稿 */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Article color="primary" />
                文字起こし原稿
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  onClick={handleCopyTranscription}
                  size="small"
                >
                  全文コピー
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleDownloadTranscription}
                  size="small"
                >
                  テキスト保存
                </Button>
              </Box>
            </Box>
            
            {/* 統計情報 */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>

              <Chip
                icon={<Description />}
                label={`文字数: ${getTranscriptionDisplayText().replace(/\n/g, '').length}文字`}
                variant="outlined"
                size="small"
              />
            </Box>

            <Paper
              sx={{
                p: 3,
                backgroundColor: themeMode === 'dark' ? 'grey.900' : 'grey.50',
                border: `1px solid ${themeMode === 'dark' ? 'grey.700' : 'grey.300'}`,
                borderRadius: 2,
                maxHeight: 600,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.3, // 行間を半分に（1.6から1.3に）
              }}
            >
              {Array.isArray(results.transcription) ? (
                <Box>
                  {results.transcription.map((segment, index) => (
                    <Box key={index} sx={{ mb: 2, position: 'relative' }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        mb: 0.5,
                        flexWrap: 'wrap'
                      }}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopySegment(cleanTranscriptionText(segment.text))}
                          sx={{ ml: 'auto', opacity: 0.6, '&:hover': { opacity: 1 } }}
                        >
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                      <Box
                        sx={{ 
                          pl: 2, 
                          borderLeft: '3px solid',
                          borderColor: 'primary.main',
                          backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                          py: 1,
                          borderRadius: '0 4px 4px 0'
                        }}
                      >
                        {cleanTranscriptionText(segment.text).split('\n').map((line: string, lineIndex: number) => (
                          <Box key={lineIndex} sx={{ mb: line.trim() === '' ? 1 : 0.5 }}>
                            {line.trim() === '' ? <br /> : (
                              <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                                {line}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box
                  sx={{ 
                    margin: 0,
                    lineHeight: 1.3, // 行間を半分に（1.8から1.3に）
                    fontFamily: 'inherit',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '0.875rem',
                    color: 'text.primary'
                  }}
                >
                  {getTranscriptionDisplayText().split('\n').map((line: string, index: number) => (
                    <Box key={index} sx={{ mb: line.trim() === '' ? 1 : 0.5 }}>
                      {line.trim() === '' ? <br /> : (
                        <Typography component="span" sx={{ display: 'block' }}>
                          {line}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        {/* 議事録 */}
        <Grid container spacing={3}>
          {/* 文字化けエラー警告 */}
          {corruptionCheck.hasError && (
            <Grid item xs={12}>
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={onRestart}
                      startIcon={<Refresh />}
                    >
                      再処理
                    </Button>
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={onBackToSettings}
                      startIcon={<Settings />}
                    >
                      設定へ戻る
                    </Button>
                  </Box>
                }
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  ⚠️ 文字化けエラーが検出されました
                </Typography>
                {corruptionCheck.isAIDetected ? (
                  <Box component="pre" sx={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '0.875rem',
                    margin: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: 2,
                    borderRadius: 1,
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {corruptionCheck.errorMessage}
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {corruptionCheck.errorMessage}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      対処方法：
                    </Typography>
                    <Typography variant="body2" component="div">
                      <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
                        <li>元のファイルの文字エンコーディングを確認してください</li>
                        <li>UTF-8形式で保存し直してください</li>
                        <li>再度アップロードしてください</li>
                      </ol>
                    </Typography>
                  </Box>
                )}
              </Alert>
            </Grid>
          )}
          
          {/* 議事録全文表示 */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description color="primary" />
                    議事録全文
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => handleCopyToClipboard(getMarkdownMinutes())}
                    size="small"
                  >
                    コピー
                  </Button>
                </Box>
                <Paper
                  sx={{
                    p: 4,
                    backgroundColor: themeMode === 'dark' ? 'grey.900' : '#ffffff',
                    border: `1px solid ${themeMode === 'dark' ? 'grey.700' : 'grey.300'}`,
                    borderRadius: 2,
                    maxHeight: 600,
                    overflow: 'auto',
                    '& h1': {
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'primary.main',
                      marginBottom: 2,
                      borderBottom: '2px solid',
                      borderColor: 'primary.main',
                      paddingBottom: 1,
                    },
                    '& h2': {
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      marginTop: 3,
                      marginBottom: 1.5,
                    },
                    '& h3': {
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      marginTop: 2,
                      marginBottom: 1,
                    },
                    '& p': {
                      lineHeight: 1.7,
                      marginBottom: 1.5,
                      color: 'text.primary',
                    },
                    '& ul, & ol': {
                      paddingLeft: 2,
                      marginBottom: 1.5,
                    },
                    '& li': {
                      marginBottom: 0.5,
                      lineHeight: 1.6,
                      color: 'text.primary',
                    },
                    '& blockquote': {
                      borderLeft: '4px solid',
                      borderColor: 'primary.main',
                      paddingLeft: 2,
                      marginLeft: 0,
                      marginRight: 0,
                      marginBottom: 1.5,
                      fontStyle: 'italic',
                      backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      padding: 1.5,
                      borderRadius: 1,
                    },
                    '& strong': {
                      fontWeight: 600,
                      color: 'primary.main',
                    },
                    '& em': {
                      fontStyle: 'italic',
                      color: 'text.secondary',
                    },
                    '& code': {
                      backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      padding: '2px 4px',
                      borderRadius: 1,
                      fontSize: '0.9em',
                      fontFamily: 'monospace',
                    },
                    '& table': {
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginBottom: 1.5,
                    },
                    '& th, & td': {
                      border: '1px solid',
                      borderColor: 'divider',
                      padding: 1,
                      textAlign: 'left',
                    },
                    '& th': {
                      backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      fontWeight: 600,
                    },
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: getHTMLMinutes()
                    }}
                  />
                </Paper>
              </CardContent>
            </Card>
          </Grid>


        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {/* 出力 */}
        <Grid container spacing={3}>
          {(results.outputs || []).map((outputItem, outputIndex) => {
            try {
              const outputFormatInfo = getOutputFormatInfo(outputItem.format);
              return (
                <Grid item xs={12} sm={6} md={4} key={outputIndex}>
                  <Card 
                    sx={{ 
                      borderRadius: 2,
                      height: '100%',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: themeMode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box sx={{ fontSize: '3rem', mb: 2 }}>
                        {formatOutputIcon(outputItem.format)}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {outputFormatInfo.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {outputFormatInfo.description}
                      </Typography>
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, mb: 2, display: 'block' }}>
                        {outputFormatInfo.extension} • {formatFileSize(outputItem.size || 0)}
                      </Typography>
                      
                      {/* 機能タグ */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mb: 2 }}>
                        {(outputFormatInfo.features || []).map((feature, featureIdx) => (
                          <Chip
                            key={featureIdx}
                            label={feature}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Download />}
                          onClick={() => handleDownload(outputItem.format)}
                          fullWidth
                        >
                          ダウンロード
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handlePreview(outputItem.format)}
                          fullWidth
                        >
                          プレビュー
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            } catch (error) {
              console.error('出力アイテム描画エラー:', error);
              return (
                <Grid item xs={12} sm={6} md={4} key={outputIndex}>
                  <Card sx={{ borderRadius: 2, height: '100%' }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="error">
                        フォーマット表示エラー
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            }
          })}
        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        {/* 音声合成 */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RecordVoiceOver color="primary" />
              音声合成
            </Typography>
            <TTS results={results} />
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={4}>
        {/* ビジュアル化 */}
        <InfographicGenerator 
          minutesContent={generateFormattedMinutes(results)}
          onGenerated={(output) => {
            console.log('インフォグラフィック生成完了:', output);
          }}
        />
      </TabPanel>

      {/* 共有ダイアログ */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>議事録を共有</DialogTitle>
        <DialogContent>
          <TextField
            label="宛先"
            value={emailData.to}
            onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="件名"
            value={emailData.subject}
            onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="メッセージ"
            value={emailData.body}
            onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
            fullWidth
            multiline
            rows={4}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={() => onShare?.(emailData)}>
            送信
          </Button>
        </DialogActions>
      </Dialog>

      {/* プレビューダイアログ */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>プレビュー - {selectedFormat.toUpperCase()}</DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              p: 2,
              backgroundColor: themeMode === 'dark' ? 'grey.900' : 'grey.50',
              maxHeight: 400,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {getPreviewContent(selectedFormat)}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>閉じる</Button>
          <Button variant="contained" onClick={() => handleDownload(selectedFormat)}>
            ダウンロード
          </Button>
        </DialogActions>
      </Dialog>

      {/* ナビゲーションボタン */}
      <Box sx={{ 
        mt: 4, 
        pt: 3, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        display: 'flex', 
        justifyContent: 'center', 
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Button
          variant="outlined"
          size="large"
          startIcon={<Settings />}
          onClick={onBackToSettings}
          sx={{ minWidth: 200 }}
        >
          設定に戻る
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<Refresh />}
          onClick={onClearAndRestart}
          sx={{ minWidth: 200 }}
        >
          内容を消去してトップに戻る
        </Button>
      </Box>
    </Box>
  );
}; 