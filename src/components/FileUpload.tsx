import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Fade,
  Zoom,
} from '@mui/material';
import {
  CloudUpload,
  AudioFile as AudioFileIcon,
  VideoFile,
  Delete,
  CheckCircle,
  PlayArrow,
  Pause,
  VolumeUp,
} from '@mui/icons-material';
import { AudioFile, FileValidation } from '../types';

// ===========================================
// MinutesGen v1.0 - ファイルアップロード
// ===========================================

interface FileUploadProps {
  selectedFile: AudioFile | null;
  onFileSelect: (file: AudioFile | null) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  selectedFile,
  onFileSelect,
  maxFileSize = 3 * 1024 * 1024 * 1024, // 3GB
  acceptedFormats = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi'],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ファイル検証
  const validateFile = (file: File): FileValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ファイルサイズチェック
    if (file.size > maxFileSize) {
      errors.push(`ファイルサイズが制限を超えています（最大: ${formatFileSize(maxFileSize)}）`);
    }

    // ファイル形式チェック
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !acceptedFormats.includes(extension)) {
      errors.push(`サポートされていないファイル形式です（対応形式: ${acceptedFormats.join(', ')}）`);
    } else {
      // ブラウザ再生可否をチェック（コーデック不一致対策）
      const mime = file.type || `audio/${extension}`;
      const canPlay = document.createElement('audio').canPlayType(mime);
      if (canPlay === '') {
        errors.push('ブラウザがこの音声コーデックをサポートしていません');
      }
    }

    // ファイル名チェック
    if (file.name.length > 255) {
      errors.push('ファイル名が長すぎます（255文字以内）');
    }

    // 警告
    if (file.size > 1024 * 1024 * 1024) { // 1GB
      warnings.push('大きなファイルは処理に時間がかかる場合があります');
    }

    // 大容量ファイル処理の説明
    if (file.size > 20 * 1024 * 1024) { // 20MB
      warnings.push('このアプリが自動的に音声ファイルを適切なセグメントに分割します');
      warnings.push('初回処理時は音声処理ライブラリのダウンロードに時間がかかる場合があります');
      warnings.push('手動分割は不要です - アプリが全て自動処理します');
    }

    // 25MB制限の警告
    if (file.size > 25 * 1024 * 1024) { // 25MB
      warnings.push('OpenAI APIの制限により、25MBを超えるファイルは分割処理が必須です');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.map((error, index) => ({
        code: `ERR_${index}`,
        message: error,
        field: 'file',
      })),
      warnings: warnings.map((warning, index) => ({
        code: `WARN_${index}`,
        message: warning,
        suggestion: '処理時間を短縮するために、ファイルサイズを小さくすることをお勧めします',
      })),
    };
  };

  /**
   * ブラウザの AudioContext で実際に decode できるか確認する。
   *  
   *  - 先頭 1MB だけ読み込み、decodeAudioData に渡す
   *  - 5 秒以内にデコード出来なければ非対応と判定
   */
  const checkAudioDecodable = async (file: File): Promise<boolean> => {
    if (!file.type.startsWith('audio/')) return true; // video などはスキップ

    /*
     * NotReadableError 対策:
     *  - file.slice().arrayBuffer() が稀に権限問題で失敗するケースがある
     *  - try/catch で捕捉し false を返して上位でユーザーに警告を出す
     */
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.slice(0, 1024 * 1024).arrayBuffer();
    } catch (err) {
      console.error('File read error during decodability check:', err);
      return false;
    }

    const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext) as {
      new (): AudioContext;
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const audioCtx = new AudioCtxClass();

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        console.warn('decodeAudioData timeout (5s)');
        resolve(false);
      }, 5000);

      audioCtx.decodeAudioData(
        arrayBuffer.slice(0),
        () => {
          clearTimeout(timer);
          audioCtx.close();
          resolve(true);
        },
        (err) => {
          console.warn('decodeAudioData failed:', err);
          clearTimeout(timer);
          audioCtx.close();
          resolve(false);
        }
      );
    });
  };

  // ファイル処理
  const processFile = useCallback(async (file: File) => {
    const validation = validateFile(file);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors.map(e => e.message));
      return;
    }

    // 追加: 実デコード判定
    const decodable = await checkAudioDecodable(file);
    if (!decodable) {
      setValidationErrors(['ブラウザがこの音声コーデックをデコードできません。別形式（mp3 / wav など）に変換してください']);
      return;
    }

    setValidationErrors([]);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // アップロード進捗のシミュレーション
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      // ファイル情報の取得
      let blobUrl: string | null = null;
      try {
        blobUrl = URL.createObjectURL(file);
      } catch (error) {
        console.error('Failed to create blob URL for file:', error);
        throw new Error('ファイルの読み込みに失敗しました');
      }

      const duration = await getAudioDuration(file);
      
      const audioFile: AudioFile = {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        duration: duration,
        format: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        path: blobUrl,
        rawFile: file,
        uploadedAt: new Date(),
        metadata: {
          bitrate: 0, // Not available directly in JS
          sampleRate: 0, // Not available directly in JS
          channels: 0, // Not available directly in JS
          codec: file.type.split('/')[1] || 'unknown',
        },
      };

      console.log(
        '[DEBUG] FileUpload.tsx: processFile - audioFile object created. rawFile exists:',
        !!audioFile.rawFile
      );
      onFileSelect(audioFile);
      setValidationErrors([]);

    } catch (err) {
      setIsUploading(false);
      const errorMessage = err instanceof Error ? (err as Error).message : 'ファイルの処理中にエラーが発生しました';
      setValidationErrors([errorMessage]);
    }
  }, [onFileSelect, maxFileSize, acceptedFormats]);

  // 音声の長さを取得（最終改善版）
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      // 音声ファイル以外は0を返す
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|flac|aac)$/i)) {
        resolve(0);
        return;
      }

      // 大容量ファイル（500MB以上）は処理をスキップ
      if (file.size > 500 * 1024 * 1024) {
        console.warn('File too large for audio duration detection (>500MB)');
        resolve(0);
        return;
      }

      const audio = new Audio();
      let blobUrl: string | null = null;
      let isResolved = false;
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('canplaythrough', onCanPlayThrough);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('loadstart', onLoadStart);
        audio.removeEventListener('durationchange', onDurationChange);
        audio.src = '';
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const resolveOnce = (duration: number) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(Math.max(0, duration || 0));
        }
      };

      const onLoadedMetadata = () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          resolveOnce(audio.duration);
        }
      };

      const onCanPlayThrough = () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          resolveOnce(audio.duration);
        }
      };

      const onDurationChange = () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          resolveOnce(audio.duration);
        }
      };

      const onLoadStart = () => {
        console.log('Audio metadata loading started');
      };

      const onError = () => {
        const errCode = audio.error?.code ?? 'N/A';
        console.warn(`Audio duration detection failed (code=${errCode})`);
        resolveOnce(0);
      };
      
      // イベントリスナーを設定
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('canplaythrough', onCanPlayThrough);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('error', onError);
      audio.addEventListener('loadstart', onLoadStart);
      
      // タイムアウトを30秒に延長（大容量ファイル対策）
      timeoutId = setTimeout(() => {
        console.warn('Audio duration detection timed out (30s)');
        resolveOnce(0);
      }, 30000);
      
      try {
        blobUrl = URL.createObjectURL(file);
        audio.preload = 'metadata';
        audio.muted = true;
        audio.volume = 0;
        audio.crossOrigin = 'anonymous';
        audio.src = blobUrl;
        
        // 即座に読み込み開始
        audio.load();
        
      } catch (error) {
        console.error('Failed to create blob URL:', error);
        resolveOnce(0);
      }
    });
  };

  // ドラッグ&ドロップハンドラー
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  // ファイル選択ハンドラー
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  // 音声再生制御
  const togglePlayback = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Audio play error:', error);
          setIsPlaying(false);
        });
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // ファイル削除
  const handleFileRemove = useCallback(() => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.path);
      onFileSelect(null);
      setValidationErrors([]);
    }
  }, [selectedFile, onFileSelect]);

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 時間フォーマット
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return <AudioFileIcon />;

    if (['mp3', 'wav', 'm4a', 'flac', 'aac'].includes(extension)) {
      return <AudioFileIcon />;
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(extension)) {
      return <VideoFile />;
    }
    return <AudioFileIcon />;
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* エラー表示 */}
      {validationErrors.length > 0 && (
        <Fade in={true}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              ファイルの検証エラー:
            </Typography>
            {validationErrors.map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        </Fade>
      )}

      {/* ファイル選択済みの表示 */}
      {selectedFile && (
        <Zoom in={true}>
          <Card sx={{ mb: 3, border: '2px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ mr: 2 }}>
                  {selectedFile.format.includes('mp4') || selectedFile.format.includes('mov') || selectedFile.format.includes('avi') ? (
                    <VideoFile sx={{ fontSize: 40, color: 'primary.main' }} />
                  ) : (
                    <AudioFileIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  )}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedFile.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip
                      label={formatFileSize(selectedFile.size)}
                      size="small"
                      sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                    />
                    <Chip
                      label={formatDuration(selectedFile.duration)}
                      size="small"
                      sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                    />
                    <Chip
                      label={selectedFile.format.toUpperCase()}
                      size="small"
                      sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                    />
                    {selectedFile.size > 20 * 1024 * 1024 && (
                      <Chip
                        label="ffmpeg.wasm対応"
                        size="small"
                        sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: 'primary.main' }}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedFile.format.includes('mp3') || selectedFile.format.includes('wav') || selectedFile.format.includes('m4a') ? (
                    <IconButton
                      onClick={togglePlayback}
                      sx={{
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': { backgroundColor: 'primary.dark' },
                      }}
                    >
                      {isPlaying ? <Pause /> : <PlayArrow />}
                    </IconButton>
                  ) : null}
                  <IconButton
                    onClick={handleFileRemove}
                    sx={{
                      backgroundColor: 'error.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'error.dark' },
                    }}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </Box>
              {(selectedFile.format.includes('mp3') || selectedFile.format.includes('wav') || selectedFile.format.includes('m4a')) && selectedFile.path ? (
                <audio
                  ref={audioRef}
                  src={selectedFile.path}
                  onEnded={() => setIsPlaying(false)}
                  onError={(e) => {
                    const error = e.currentTarget.error;
                    const errorMessage = error?.message || 'Unknown audio error';
                    console.error('Audio playback error:', errorMessage);
                    setIsPlaying(false);
                  }}
                  onLoadStart={() => {
                    console.log('Audio loading started');
                  }}
                  onCanPlay={() => {
                    console.log('Audio can start playing');
                  }}
                  style={{ display: 'none' }}
                  preload="metadata"
                />
              ) : null}
            </CardContent>
          </Card>
        </Zoom>
      )}

      {/* アップロード進捗 */}
      {isUploading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VolumeUp sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1">
                ファイルを処理中... {Math.round(uploadProgress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'primary.main',
                  borderRadius: 4,
                },
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ファイル選択エリア */}
      {!selectedFile && !isUploading && (
        <Card
          sx={{
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'grey.300',
            backgroundColor: isDragging ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'rgba(76, 175, 80, 0.05)',
            },
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CloudUpload
              sx={{
                fontSize: 80,
                color: isDragging ? 'primary.main' : 'grey.400',
                mb: 2,
                transition: 'all 0.3s ease',
              }}
            />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              ファイルをドラッグ&ドロップ
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              または
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<CloudUpload />}
              sx={{
                py: 1.5,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5cb85c 0%, #46a049 100%)',
                },
              }}
            >
              ファイルを選択
            </Button>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3 }}>
              対応形式: {acceptedFormats.join(', ').toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              最大ファイルサイズ: {formatFileSize(maxFileSize)}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.map(format => `.${format}`).join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </Box>
  );
}; 