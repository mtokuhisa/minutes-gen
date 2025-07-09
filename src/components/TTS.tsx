// ===========================================
// MinutesGen v1.0 - 音声合成（TTS）コンポーネント
// ===========================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Collapse,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Download,
  Mic,
  Warning,
} from '@mui/icons-material';
import { useTheme } from '../theme';
import { MinutesData } from '../types';
import { getValidatedAPIConfig } from '../config/api';

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

export const TTS: React.FC<TTSProps> = ({ results }) => {
  const { themeMode } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [state, setState] = useState<TTSState>({
    isGenerating: false,
    isPlaying: false,
    audioBlob: null,
    podcastText: '',
    error: null,
    progress: 0,
  });

  const updateState = useCallback((updates: Partial<TTSState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // ポッドキャスト風テキスト生成
  const generatePodcastText = async (): Promise<string> => {
    const config = getValidatedAPIConfig();
    if (!config.openaiApiKey || config.openaiApiKey.trim() === '') {
      throw new Error('APIキーが設定されていません。設定画面でOpenAI APIキーを設定してください。');
    }

    const prompt = `以下の議事録を、10分で聞ける2人のホストによる自然なポッドキャスト風の掛け合い形式に変換してください。

【音声設定指示】
- ホストA: 好奇心旺盛で共感性が高い、温かみのある中性的な声（voice: sage, speed: 1.3）
- ホストB: さわやかで明るい中性的な響き、キラッとした輝き（voice: sage, speed: 1.3）

【変換ルール】
1. 自然な会話形式に
2. 重要ポイントは強調
3. 専門用語は分かりやすく説明
4. 相槌や質問を効果的に使用
5. 聞き手が理解しやすい構成
6. 約10分程度の長さに調整

【出力形式】
自然な会話形式で、ホストA・ホストBなどのラベルは使用せず、直接的な会話内容のみを出力してください。

議事録内容：
${results.summary}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'あなたは音声コンテンツ作成の専門家です。自然で聞きやすいポッドキャスト形式の台本を作成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`ポッドキャストテキスト生成エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'ポッドキャストテキストの生成に失敗しました。';
  };

  // 音声合成
  const generateAudio = async (text: string): Promise<Blob> => {
    const config = getValidatedAPIConfig();
    if (!config.openaiApiKey || config.openaiApiKey.trim() === '') {
      throw new Error('APIキーが設定されていません。設定画面でOpenAI APIキーを設定してください。');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: 'sage',
        response_format: 'mp3',
        speed: 1.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`音声合成エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    return response.blob();
  };

  // ポッドキャスト風音声生成
  const handleGeneratePodcast = async () => {
    try {
      updateState({ isGenerating: true, error: null, progress: 0 });

      // ステップ1: ポッドキャストテキスト生成
      updateState({ progress: 20 });
      const podcastText = await generatePodcastText();
      updateState({ podcastText, progress: 50 });

      // ステップ2: 音声合成
      updateState({ progress: 70 });
      const audioBlob = await generateAudio(podcastText);
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

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Mic color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          ポッドキャスト風音声生成
        </Typography>
      </Box>

      {/* メイン生成ボタン */}
      <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
          議事録をポッドキャスト形式の音声に変換します
        </Typography>
        
        <Button
          variant="contained"
          size="large"
          onClick={handleGeneratePodcast}
          disabled={state.isGenerating}
          startIcon={state.isGenerating ? <CircularProgress size={20} /> : <Mic />}
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 600,
            borderRadius: 2,
            background: themeMode === 'color'
              ? 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
              : themeMode === 'light'
              ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
              : 'linear-gradient(135deg, #90caf9 0%, #42a5f5 100%)',
          }}
        >
          {state.isGenerating ? 'ポッドキャスト生成中...' : 'ポッドキャスト風音声生成'}
        </Button>

        {/* 進捗バー */}
        {state.isGenerating && (
          <Box sx={{ mt: 2, width: '100%' }}>
            <LinearProgress 
              variant="determinate" 
              value={state.progress} 
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {state.progress < 30 && 'ポッドキャストテキストを生成しています...'}
              {state.progress >= 30 && state.progress < 70 && 'テキスト生成完了、音声合成中...'}
              {state.progress >= 70 && '音声合成中...'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* エラー表示 */}
      <Collapse in={!!state.error}>
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => updateState({ error: null })}>
          {state.error}
        </Alert>
      </Collapse>

      {/* ポッドキャストテキスト表示 */}
      {state.podcastText && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            📝 ポッドキャスト台本
          </Typography>
          <Paper
            sx={{
              p: 2,
              backgroundColor: themeMode === 'dark' ? 'grey.900' : 'grey.50',
              border: `1px solid ${themeMode === 'dark' ? 'grey.700' : 'grey.300'}`,
              borderRadius: 1,
              maxHeight: 400,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {state.podcastText}
          </Paper>
        </Paper>
      )}

      {/* 音声コントロール */}
      {state.audioBlob && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            🎵 音声コントロール
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* 再生/一時停止ボタン */}
            {!state.isPlaying ? (
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={handlePlay}
                color="success"
              >
                再生
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Pause />}
                onClick={handlePause}
                color="warning"
              >
                一時停止
              </Button>
            )}

            {/* 停止ボタン */}
            <Button
              variant="outlined"
              startIcon={<Stop />}
              onClick={handleStop}
              disabled={!state.isPlaying}
            >
              停止
            </Button>

            {/* ダウンロードボタン */}
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleDownload}
              color="primary"
            >
              ダウンロード
            </Button>

            {/* ステータス表示 */}
            <Chip
              label={state.isPlaying ? '再生中' : '停止中'}
              color={state.isPlaying ? 'success' : 'default'}
              variant="outlined"
              size="small"
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}; 