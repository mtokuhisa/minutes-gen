import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  VolumeUp,
  Stop,
  Download,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import { getValidatedAPIConfig } from '../config/api';

// ===========================================
// MinutesGen v1.0 - 音声合成（TTS）コンポーネント
// ===========================================

interface TTSProps {
  text: string;
  onSpeechGenerated?: (audioBlob: Blob) => void;
}

export const TTS: React.FC<TTSProps> = ({ text, onSpeechGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // 音声を生成
  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('テキストを入力してください');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const config = getValidatedAPIConfig();
      
      const response = await fetch(`${config.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ttsModel,
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        throw new Error(`音声生成エラー: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      setAudioBlob(blob);
      
      // 音声URLを作成
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      // コールバックを呼び出し
      onSpeechGenerated?.(blob);

    } catch (error) {
      console.error('音声生成エラー:', error);
      setError(error instanceof Error ? error.message : '音声生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 音声を再生
  const playAudio = () => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    setAudioElement(audio);
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setAudioElement(null);
    });

    audio.play();
    setIsPlaying(true);
  };

  // 音声を停止
  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
      setAudioElement(null);
    }
  };

  // 音声をダウンロード
  const downloadAudio = () => {
    if (!audioBlob) return;

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated_speech_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <VolumeUp sx={{ mr: 1 }} />
        音声合成（ポッドキャスト用）
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="音声化するテキスト"
          value={text}
          multiline
          rows={4}
          fullWidth
          disabled
          helperText="議事録から音声を生成します"
        />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={generateSpeech}
            disabled={isGenerating || !text.trim()}
            startIcon={<VolumeUp />}
          >
            {isGenerating ? '音声生成中...' : '音声を生成'}
          </Button>

          {audioUrl && (
            <>
              <Tooltip title={isPlaying ? '停止' : '再生'}>
                <IconButton
                  onClick={isPlaying ? stopAudio : playAudio}
                  color="primary"
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
              </Tooltip>

              <Tooltip title="ダウンロード">
                <IconButton onClick={downloadAudio} color="primary">
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {isGenerating && (
          <LinearProgress sx={{ mt: 1 }} />
        )}
      </Box>
    </Paper>
  );
}; 