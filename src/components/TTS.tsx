// ===========================================
// MinutesGen v1.0 - TTS（音声合成）コンポーネント
// ===========================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
  Collapse,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Download,
  VolumeUp,
  Mic,
  AutoAwesome,
  Refresh,
  Schedule,
  Whatshot,
  Article,
} from '@mui/icons-material';
import { MinutesData } from '../types';
import { useTheme } from '../theme';
import { AuthService } from '../services/authService';

interface TTSProps {
  results: MinutesData;
}

interface TTSState {
  isGenerating: boolean;
  isPlaying: boolean;
  audioBlob: Blob | null;
  podcastText: string;
  error: string | null;
  progress: number;
}

// ポッドキャスト設定オプション
interface PodcastSettings {
  duration: 'short' | 'medium' | 'long';
  tension: 'normal' | 'high';
}

// 設定用のヘルパー関数
const getDurationSettings = (duration: 'short' | 'medium' | 'long') => {
  const settings = {
    short: {
      title: 'Short (約3分)',
      description: '重要ポイントのみ簡潔に',
      icon: '⚡',
    },
    medium: {
      title: 'Medium (約7分)',
      description: '標準的な詳しさで',
      icon: '⭐',
    },
    long: {
      title: 'Long (約12分)',
      description: '詳細な内容まで含めて',
      icon: '🎯',
    },
  };
  return settings[duration];
};

const getTensionSettings = (tension: 'normal' | 'high') => {
  const settings = {
    normal: {
      title: 'Normal (標準)',
      description: '落ち着いた自然な会話',
      icon: '😊',
    },
    high: {
      title: 'High-tension (ハイテンション)',
      description: 'エネルギッシュで重複する会話',
      icon: '🔥',
    },
  };
  return settings[tension];
};

export const TTS: React.FC<TTSProps> = ({ results }) => {
  const { themeMode } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [authService] = useState(() => AuthService.getInstance());
  
  const [state, setState] = useState<TTSState>({
    isGenerating: false,
    isPlaying: false,
    audioBlob: null,
    podcastText: '',
    error: null,
    progress: 0,
  });

  const [podcastSettings, setPodcastSettings] = useState<PodcastSettings>({
    duration: 'medium',
    tension: 'normal',
  });

  const updateState = useCallback((updates: Partial<TTSState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 時間オプションの設定
  const getDurationSettingsDetailed = (duration: 'short' | 'medium' | 'long') => {
    switch (duration) {
      case 'short':
        return {
          targetMinutes: 3,
          maxTokens: 1000,
          description: '約3分',
          instruction: '約3分程度の短時間で聞ける内容に調整',
        };
      case 'medium':
        return {
          targetMinutes: 7,
          maxTokens: 2500,
          description: '約7分',
          instruction: '約7分程度の中程度の長さに調整',
        };
      case 'long':
        return {
          targetMinutes: 12,
          maxTokens: 4000,
          description: '約12分',
          instruction: '約12分程度の詳細な内容に調整',
        };
    }
  };

  // テンション設定
  const getTensionSettingsDetailed = (tension: 'normal' | 'high') => {
    switch (tension) {
      case 'normal':
        return {
          description: '標準',
          instruction: '落ち着いたトーンで自然な会話',
          conversationStyle: '相手の話を聞いてから返答する自然な会話',
        };
      case 'high':
        return {
          description: 'ハイテンション',
          instruction: 'エネルギッシュで活発な会話、時々重複して話す',
          conversationStyle: '興奮気味で食い気味に反応し、時々重複して話すエネルギッシュな会話',
        };
    }
  };

  // ポッドキャスト風テキスト生成
  const generatePodcastText = async (): Promise<string> => {
    // 認証確認
    if (!authService.isAuthenticated()) {
      throw new Error('認証が必要です。初回セットアップを完了してください。');
    }

    const apiKey = await authService.getApiKey();
    if (!apiKey) {
      throw new Error('API KEYが取得できませんでした。認証を確認してください。');
    }

    const durationSettings = getDurationSettingsDetailed(podcastSettings.duration);
    const tensionSettings = getTensionSettingsDetailed(podcastSettings.tension);

    // ハイテンション時のより強化された設定
    const tensionDescription = podcastSettings.tension === 'high' 
      ? 'とてもエネルギッシュで興奮気味、重複した会話や感嘆詞を多用、スピード感のある展開'
      : '適度にエネルギッシュで親しみやすい';

    const prompt = `以下の議事録を基に、${durationSettings.description}のポッドキャスト風対話を作成してください。

【話者設定】
- ねほりーの: 女性、${tensionDescription}、質問好き、聞き役
- はほりーの: 男性、落ち着いた声（ボリューム控えめ）、説明役、分析好き

【対話スタイル】
${tensionSettings.description}
${podcastSettings.tension === 'high' ? `
- より多くの感嘆詞（「えー！」「すごい！」「マジで？」）
- 重複会話（「そうそう！」「わかる！」の同時発言）
- 興奮した口調とテンポの良い掛け合い
- 「うわー」「やばい」などのリアクション多用
` : ''}

【音声調整指示】
- ねほりーの: 通常ボリューム、エネルギッシュな発話
- はほりーの: ボリューム0.1下げ、落ち着いた発話

【出力形式】
[ねほりーの] セリフ
[はほりーの] セリフ

【議事録内容】
${results.summary}

主要ポイント:
${results.keyPoints.map(kp => `• ${kp.content}`).join('\n')}

アクション項目:
${results.actionItems.map(ai => `• ${ai.task} (担当: ${ai.assignee})`).join('\n')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'あなたは日本の人気ポッドキャスト番組の台本作家です。自然で魅力的な対話を作成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: podcastSettings.tension === 'high' ? 0.9 : 0.7,
        max_tokens: durationSettings.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // 認証エラーの場合は特別な処理
      if (response.status === 401) {
        authService.clearApiKeyFromMemory();
        throw new Error('認証に失敗しました。再度ログインしてください。');
      }
      
      throw new Error(`ポッドキャストテキスト生成エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'ポッドキャストテキストの生成に失敗しました。';
  };

  // 音声合成（単一音声）
  const generateSingleAudio = async (text: string, voice: string, speed: number): Promise<Blob> => {
    // 認証確認
    if (!authService.isAuthenticated()) {
      throw new Error('認証が必要です。初回セットアップを完了してください。');
    }

    const apiKey = await authService.getApiKey();
    if (!apiKey) {
      throw new Error('API KEYが取得できませんでした。認証を確認してください。');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: speed,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // 認証エラーの場合は特別な処理
      if (response.status === 401) {
        authService.clearApiKeyFromMemory();
        throw new Error('認証に失敗しました。再度ログインしてください。');
      }
      
      throw new Error(`音声合成エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    return response.blob();
  };

  // 2人のホスト音声を結合
  const generateDualHostAudio = async (podcastText: string): Promise<Blob> => {
    // テキストを話者別に分割
    const segments = podcastText.split(/\[(ねほりーの|はほりーの)\]/);
    const audioSegments: Blob[] = [];
    
    for (let i = 1; i < segments.length; i += 2) {
      const speaker = segments[i];
      const text = segments[i + 1]?.trim();
      
      if (!text) continue;
      
      // 話者に応じた音声設定（promptStore.tsの設定に戻す）
      let voice: string, speed: number;
      if (speaker === 'ねほりーの') {
        // ねほりーの：sage（promptStore.tsの設定）、落ち着いた
        voice = 'sage';
        speed = podcastSettings.tension === 'high' ? 1.6 : 1.3;
      } else { // はほりーの
        // はほりーの：nova（promptStore.tsの設定）、明るい
        voice = 'nova';
        speed = podcastSettings.tension === 'high' ? 1.4 : 1.3;
      }
      
      // 音声生成
      const audioBlob = await generateSingleAudio(text, voice, speed);
      audioSegments.push(audioBlob);
    }
    
    // 音声セグメントを結合
    return await combineAudioBlobs(audioSegments);
  };

  // 音声Blobを結合する関数
  const combineAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
    if (blobs.length === 0) {
      throw new Error('結合する音声がありません');
    }
    
    if (blobs.length === 1) {
      return blobs[0];
    }
    
    // 簡単な結合（実際のプロダクションでは適切な音声結合ライブラリを使用）
    const audioBuffers = await Promise.all(
      blobs.map(blob => blob.arrayBuffer())
    );
    
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const buffer of audioBuffers) {
      combined.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    
    return new Blob([combined], { type: 'audio/mpeg' });
  };

  // ポッドキャスト風音声生成
  const handleGeneratePodcast = async () => {
    try {
      updateState({ isGenerating: true, error: null, progress: 0 });

      // 認証方法を表示
      const authMethod = authService.getAuthMethod();
      const authMethodText = authMethod === 'corporate' ? '企業アカウント' : '個人アカウント';
      console.log(`TTS生成開始 (${authMethodText})`);

      // ステップ1: ポッドキャストテキスト生成
      updateState({ progress: 20 });
      const podcastText = await generatePodcastText();
      updateState({ podcastText, progress: 50 });

      // ステップ2: 2人のホスト音声合成
      updateState({ progress: 70 });
      const audioBlob = await generateDualHostAudio(podcastText);
      updateState({ audioBlob, progress: 100 });

      // 完了
      setTimeout(() => {
        updateState({ isGenerating: false, progress: 0 });
      }, 500);

    } catch (error) {
      console.error('ポッドキャスト生成エラー:', error);
      updateState({ 
        isGenerating: false, 
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました',
        progress: 0
      });
    }
  };

  // 再生
  const handlePlay = () => {
    if (state.audioBlob && !state.isPlaying) {
      const audioUrl = URL.createObjectURL(state.audioBlob);
      audioRef.current = new Audio(audioUrl);
      
      audioRef.current.onended = () => {
        updateState({ isPlaying: false });
        URL.revokeObjectURL(audioUrl);
      };
      
      audioRef.current.play();
      updateState({ isPlaying: true });
    }
  };

  // 一時停止
  const handlePause = () => {
    if (audioRef.current && state.isPlaying) {
      audioRef.current.pause();
      updateState({ isPlaying: false });
    }
  };

  // 停止
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      updateState({ isPlaying: false });
    }
  };

  // ダウンロード
  const handleDownload = () => {
    if (state.audioBlob) {
      const url = URL.createObjectURL(state.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${results.title}_podcast.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const durationSettings = getDurationSettings(podcastSettings.duration);
  const tensionSettings = getTensionSettings(podcastSettings.tension);

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Mic color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          ポッドキャスト風音声生成
        </Typography>
      </Box>

      {/* 設定パネル */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule color="primary" />
            時間設定
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(['short', 'medium', 'long'] as const).map((duration) => {
              const settings = getDurationSettings(duration);
              return (
                <Grid item xs={12} sm={4} key={duration}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: podcastSettings.duration === duration ? '2px solid' : '1px solid',
                      borderColor: podcastSettings.duration === duration ? 'primary.main' : 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                      minHeight: '100px', // 縦幅を半分に調整
                    }}
                    onClick={() => setPodcastSettings(prev => ({ ...prev, duration }))}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Box sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                        {settings.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                        {settings.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        {settings.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Whatshot color="primary" />
            テンション設定
          </Typography>
          
          <Grid container spacing={2}>
            {(['normal', 'high'] as const).map((tension) => {
              const settings = getTensionSettings(tension);
              return (
                <Grid item xs={12} sm={6} key={tension}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: podcastSettings.tension === tension ? '2px solid' : '1px solid',
                      borderColor: podcastSettings.tension === tension ? 'primary.main' : 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                      minHeight: '100px', // 縦幅を半分に調整
                    }}
                    onClick={() => setPodcastSettings(prev => ({ ...prev, tension }))}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Box sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                        {settings.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                        {settings.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        {settings.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* 生成ボタンと進行状況 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={state.isGenerating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
              onClick={handleGeneratePodcast}
              disabled={state.isGenerating}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {state.isGenerating ? '生成中...' : 
               state.audioBlob ? 'ポッドキャスト風音声再生成' : 'ポッドキャスト風音声生成'}
            </Button>

            {/* 進行状況表示 */}
            {state.isGenerating && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {state.progress < 30 ? '２人が台本を考えています' : 
                     state.progress < 70 ? '2人がリハーサルしてます' : 
                     'ちょっと休憩中'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(state.progress)}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={state.progress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 音声コントロール（生成後のみ表示） */}
      {state.audioBlob && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <VolumeUp color="primary" />
              音声コントロール
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant={state.isPlaying ? 'outlined' : 'contained'}
                startIcon={<PlayArrow />}
                onClick={handlePlay}
                disabled={state.isPlaying}
              >
                再生
              </Button>
              <Button
                variant="outlined"
                startIcon={<Pause />}
                onClick={handlePause}
                disabled={!state.isPlaying}
              >
                一時停止
              </Button>
              <Button
                variant="outlined"
                startIcon={<Stop />}
                onClick={handleStop}
              >
                停止
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownload}
              >
                ダウンロード
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {state.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {state.error}
        </Alert>
      )}

      {/* 生成されたテキスト表示 */}
      {state.podcastText && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Article color="primary" />
              生成された台本
            </Typography>
            <Paper
              sx={{
                p: 2,
                backgroundColor: 'grey.50',
                maxHeight: 300,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {state.podcastText}
              </pre>
            </Paper>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}; 