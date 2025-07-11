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
  Divider,
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
  Description,
  PictureAsPdf,
  TextSnippet,
  Warning,
  Error as ErrorIcon,
  InsertDriveFile,
  TextFields,
} from '@mui/icons-material';
import { AudioFile, FileValidation } from '../types';
import mammoth from 'mammoth';

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
  acceptedFormats = [
    // 音声・動画ファイル
    'mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi',
    // 文書ファイル
    'docx', 'doc', 'txt', 'md', 'pdf'
  ],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ファイルタイプの判定
  const getFileType = (fileName: string): 'audio' | 'video' | 'document' => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return 'audio';

    const audioFormats = ['mp3', 'wav', 'm4a', 'flac', 'aac'];
    const videoFormats = ['mp4', 'mov', 'avi', 'mkv'];
    const documentFormats = ['docx', 'doc', 'txt', 'md', 'pdf'];

    if (audioFormats.includes(extension)) return 'audio';
    if (videoFormats.includes(extension)) return 'video';
    if (documentFormats.includes(extension)) return 'document';
    
    return 'audio'; // デフォルト
  };

  // ファイル検証
  const validateFile = (file: File): FileValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fileType = getFileType(file.name);

    // ファイルサイズチェック
    if (file.size > maxFileSize) {
      errors.push(`ファイルサイズが制限を超えています（最大: ${formatFileSize(maxFileSize)}）`);
    }

    // ファイル形式チェック
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !acceptedFormats.includes(extension)) {
      errors.push(`サポートされていないファイル形式です（対応形式: ${acceptedFormats.join(', ')}）`);
    } else if (fileType === 'audio' || fileType === 'video') {
      // 音声・動画ファイルのみブラウザ再生可否をチェック
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

    // 文書ファイルの場合の説明
    if (fileType === 'document') {
      warnings.push('文書ファイルは文字起こしをスキップして直接議事録生成を行います');
    } else {
      // 音声・動画ファイルの場合の説明
      if (file.size > 20 * 1024 * 1024) { // 20MB
        warnings.push('このアプリが自動的に音声ファイルを適切なセグメントに分割します');
        warnings.push('初回処理時は音声処理ライブラリのダウンロードに時間がかかる場合があります');
        warnings.push('手動分割は不要です - アプリが全て自動処理します');
      }

      // 25MB制限の警告
      if (file.size > 25 * 1024 * 1024) { // 25MB
        warnings.push('OpenAI APIの制限により、25MBを超えるファイルは分割処理が必須です');
      }
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
   * ファイルの妥当性を確認する（Electron環境対応）
   * 文書ファイルの場合はスキップ。
   */
  const checkAudioDecodable = async (file: File): Promise<boolean> => {
    const fileType = getFileType(file.name);
    if (fileType === 'document') return true; // 文書ファイルはスキップ
    if (!file.type.startsWith('audio/')) return true; // video などはスキップ

    // Electron環境では AudioContext の使用を避ける
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // Electron環境では基本的な拡張子チェックのみ
      const extension = file.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi'];
      return extension ? supportedFormats.includes(extension) : false;
    }

    // ブラウザ環境でのみ AudioContext を使用
    try {
      const arrayBuffer = await file.slice(0, 1024 * 1024).arrayBuffer();
      
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext) as {
        new (): AudioContext;
      };
      
      if (!AudioCtxClass) {
        console.warn('AudioContext not available');
        return true; // AudioContext が利用できない場合は通す
      }

      const audioCtx = new AudioCtxClass();

      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          console.warn('decodeAudioData timeout (5s)');
          audioCtx.close();
          resolve(true); // タイムアウトの場合は通す
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
            resolve(true); // デコードに失敗しても通す（後続処理で判定）
          }
        );
      });
    } catch (err) {
      console.error('File read error during decodability check:', err);
      return true; // エラーの場合は通す
    }
  };

  /**
   * 文書ファイルからテキストを抽出
   */
  const extractTextFromDocument = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (extension === 'txt') {
        // テキストファイルの場合、UTF-8として読み込み
        let text = '';
        try {
          text = await file.text();
          if (!text || text.trim().length === 0) {
            throw new Error('Empty file');
          }
        } catch (error) {
          // UTF-8で読み込めない場合は、ArrayBufferから手動でデコード
          try {
            const buffer = await file.arrayBuffer();
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(buffer);
          } catch (decodeError) {
            text = '※テキストファイルの内容を読み取れませんでした。UTF-8形式で保存してください。';
          }
        }
        
        return text || '※テキストファイルの内容を読み取れませんでした。';
      } else if (extension === 'md') {
        // Markdownファイルの場合
        const text = await file.text();
        return text || '※Markdownファイルの内容を読み取れませんでした。';
      } else if (extension === 'pdf') {
        // PDFファイルの場合（基本的なテキスト抽出のみ）
        const text = await file.text();
        return text || '※PDFファイルからのテキスト抽出に失敗しました。テキスト形式での再提出をお勧めします。';
      } else if (extension === 'docx' || extension === 'doc') {
        // DOCXファイルの場合
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      } else {
        throw new Error('サポートされていない文書形式です');
      }
    } catch (error) {
      console.error('文書ファイル処理エラー:', error);
      return `※ファイル「${file.name}」の処理中にエラーが発生しました。ファイル形式を確認してください。`;
    }
  };

  // ファイル処理
  const processFile = useCallback(async (file: File) => {
    console.log('processFile開始:', file.name, file.size, file.type);
    
    // 大容量ファイル（500MB以上）の場合は事前警告
    if (file.size > 500 * 1024 * 1024) {
      console.log('🔥 大容量ファイル検出:', {
        fileName: file.name,
        fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
        processingNote: '大容量ファイル用の最適化処理を適用します'
      });
    }
    
    try {
      const validation = validateFile(file);
      const fileType = getFileType(file.name);
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors.map(e => e.message));
        return;
      }

      // 大容量ファイル（500MB以上）の場合はデコード確認をスキップ
      if (fileType !== 'document' && file.size < 500 * 1024 * 1024) {
        try {
          const decodable = await checkAudioDecodable(file);
          if (!decodable) {
            setValidationErrors(['ブラウザがこの音声コーデックをデコードできません。別形式（mp3 / wav など）に変換してください']);
            return;
          }
        } catch (error) {
          console.error('デコード確認エラー:', error);
          // デコード確認でエラーが発生してもファイル処理は続行
        }
      } else if (file.size >= 500 * 1024 * 1024) {
        console.log('🔥 大容量ファイルのためデコード確認をスキップ');
      }
    } catch (error) {
      console.error('ファイル検証エラー:', error);
      setValidationErrors(['ファイルの検証中にエラーが発生しました']);
      return;
    }

    setValidationErrors([]);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileType = getFileType(file.name);
      const isLargeFile = file.size > 300 * 1024 * 1024;
      
      // 大容量ファイルの場合は進捗を遅くして、処理時間を反映
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          // 大容量ファイルの場合は進捗を遅くする
          const increment = isLargeFile ? Math.random() * 3 : Math.random() * 10;
          return Math.min(prev + increment, 95); // 95%で一旦停止（実際の処理完了まで）
        });
      }, isLargeFile ? 1000 : 200); // 大容量ファイルは1秒間隔

      // ファイル情報の取得
      let blobUrl: string | null = null;
      let documentText: string | null = null;
      let duration = 0;

      if (fileType === 'document') {
        // 文書ファイルの場合はテキスト抽出
        documentText = await extractTextFromDocument(file);
        duration = 0; // 文書ファイルは時間情報なし
      } else {
        // 音声・動画ファイルの場合
        try {
          // Electron環境では安全にファイルパスを生成
          if (typeof window !== 'undefined' && (window as any).electronAPI) {
            // Electron環境では rawFile を直接使用し、パスは空文字列にする
            // 実際の再生時は rawFile から blob URL を生成する
            blobUrl = '';
          } else {
            blobUrl = URL.createObjectURL(file);
          }
          duration = await getAudioDuration(file);
        } catch (error) {
          console.error('Failed to process file:', error);
          // エラーが発生してもファイル処理は続行
          blobUrl = '';
          duration = 0;
        }
      }
      
      const audioFile: AudioFile = {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        duration: duration,
        format: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        path: blobUrl || '',
        rawFile: file,
        uploadedAt: new Date(),
        metadata: {
          bitrate: 0, // Not available directly in JS
          sampleRate: 0, // Not available directly in JS
          channels: 0, // Not available directly in JS
          codec: file.type.split('/')[1] || 'unknown',
          fileType: fileType,
          documentText: documentText || undefined,
        },
      };

      console.log(
        '[DEBUG] FileUpload.tsx: processFile - audioFile object created. fileType:',
        fileType,
        'rawFile exists:',
        !!audioFile.rawFile
      );
      
      // 処理完了時に進捗を100%にする
      setUploadProgress(100);
      
      // 大容量ファイルの場合は少し待ってから完了
      if (file.size > 300 * 1024 * 1024) {
        console.log('🔥 大容量ファイル処理完了:', {
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
          processingTime: 'ファイル処理が完了しました'
        });
        
        setTimeout(() => {
          setIsUploading(false);
          onFileSelect(audioFile);
          setValidationErrors([]);
        }, 1000);
      } else {
        setIsUploading(false);
        onFileSelect(audioFile);
        setValidationErrors([]);
      }

    } catch (err) {
      setIsUploading(false);
      const errorMessage = err instanceof Error ? (err as Error).message : 'ファイルの処理中にエラーが発生しました';
      setValidationErrors([errorMessage]);
    }
  }, [onFileSelect, maxFileSize, acceptedFormats]);

  // 音声の長さを取得（大容量ファイル対応版）
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      // 文書ファイルの場合は0を返す
      const fileType = getFileType(file.name);
      if (fileType === 'document') {
        resolve(0);
        return;
      }

      // 音声ファイル以外は0を返す
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|flac|aac|mp4|mov|avi)$/i)) {
        resolve(0);
        return;
      }

      // 大容量ファイル（300MB以上）は処理をスキップ（閾値を下げて安全性向上）
      if (file.size > 300 * 1024 * 1024) {
        console.log('🔥 大容量ファイルのため音声時間取得をスキップ:', {
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
          reason: '300MB以上のファイルは処理時間短縮のため時間取得をスキップ'
        });
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
      
      // ファイルサイズに応じてタイムアウト時間を調整
      const timeoutDuration = file.size > 100 * 1024 * 1024 ? 60000 : 30000; // 100MB以上は60秒、未満は30秒
      timeoutId = setTimeout(() => {
        console.log(`🔥 音声時間取得タイムアウト (${timeoutDuration/1000}s):`, {
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
          note: '大容量ファイルのためタイムアウト、処理を続行します'
        });
        resolveOnce(0);
      }, timeoutDuration);
      
      try {
        // Electron環境では音声時間の取得をスキップ
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          console.log('Electron環境: 音声時間の取得をスキップ');
          resolveOnce(0);
          return;
        }
        
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
    
    try {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        console.log('ファイルドロップ処理開始:', files[0].name);
        
        // Electron環境での追加チェック
        if (window.electronAPI) {
          console.log('Electron環境でのファイルドロップ処理');
          // Electron環境では特別な処理は不要、通常通り処理
        }
        
        processFile(files[0]);
      }
    } catch (error) {
      console.error('ファイルドロップ処理エラー:', error);
      setValidationErrors(['ファイルのドロップ処理中にエラーが発生しました。ファイル選択ボタンをお試しください。']);
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
    if (!selectedFile || selectedFile.metadata?.fileType !== 'audio') {
      return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    // Electron環境では rawFile から blob URL を動的に生成
    if (typeof window !== 'undefined' && (window as any).electronAPI && selectedFile.rawFile) {
      try {
        const blobUrl = URL.createObjectURL(selectedFile.rawFile);
        if (audioRef.current) {
          audioRef.current.src = blobUrl;
          audioRef.current.play().catch((error) => {
            console.error('Audio play error:', error);
            setIsPlaying(false);
            URL.revokeObjectURL(blobUrl);
          });
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Failed to create blob URL for audio playback:', error);
        setIsPlaying(false);
      }
    } else if (audioRef.current && selectedFile.path) {
      // 通常のブラウザ環境
      audioRef.current.play().catch((error) => {
        console.error('Audio play error:', error);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, selectedFile]);

  // ファイル削除
  const handleFileRemove = useCallback(() => {
    if (selectedFile) {
      if (selectedFile.path) {
        URL.revokeObjectURL(selectedFile.path);
      }
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
    if (seconds === 0) return '文書ファイル';
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
    if (['txt', 'md'].includes(extension)) {
      return <TextSnippet />;
    }
    if (['docx', 'doc'].includes(extension)) {
      return <Description />;
    }
    if (extension === 'pdf') {
      return <PictureAsPdf />;
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
                  {getFileIcon(selectedFile.name)}
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
                    {selectedFile.metadata?.fileType === 'document' && (
                      <Chip
                        label="文書ファイル"
                        size="small"
                        sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: 'orange.main' }}
                      />
                    )}
                    {selectedFile.size > 20 * 1024 * 1024 && selectedFile.metadata?.fileType !== 'document' && (
                      <Chip
                        label="ffmpeg.wasm対応"
                        size="small"
                        sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: 'primary.main' }}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedFile.metadata?.fileType === 'audio' && (
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
                  )}
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
              {selectedFile.metadata?.fileType === 'audio' && (
                <audio
                  ref={audioRef}
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
              )}
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
              <strong>音声・動画:</strong> {['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi'].join(', ').toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>文書:</strong> {['docx', 'doc', 'txt', 'md', 'pdf'].join(', ').toUpperCase()}
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