import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  AlertTitle,
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
import {
  AudioFile,
  ProcessingOptions,
  AppError,
  FileValidation,
} from '../types';
import mammoth from 'mammoth';
import Encoding from 'encoding-japanese';
import { FileProcessor } from '../services/fileProcessor';
import { 
  shouldSplitContent, 
  generateTokenLimitWarning, 
  estimateTokenCount,
  type ModelName 
} from '../utils/tokenLimits';

// ===========================================
// MinutesGen v0.7.5 - ファイルアップロード
// ===========================================

interface FileUploadProps {
  selectedFile: AudioFile | null;
  onFileSelect: (file: AudioFile | null) => void;
  onNext?: () => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
  onError: (error: AppError) => void;
}

export const FileUpload: React.FC<FileUploadProps> = React.memo(({
  selectedFile,
  onFileSelect,
  onNext,
  onError,
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
  const [audioRetryCount, setAudioRetryCount] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileProcessor = new FileProcessor();
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState<{ stage: string; percentage: number; message: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // クリーンアップ処理: blobURLのメモリリークを防止
  useEffect(() => {
    return () => {
      // コンポーネントのアンマウント時のクリーンアップ
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
        console.log('クリーンアップ: audioRef blobURL解放');
      }
      
      // selectedFileのpathがblobURLの場合もクリーンアップ
      if (selectedFile?.path?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedFile.path);
        console.log('クリーンアップ: selectedFile blobURL解放');
      }
    };
  }, []);

  // selectedFileが変更された時のクリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
        console.log('ファイル変更時: audioRef blobURL解放');
      }
      setIsPlaying(false);
    };
  }, [selectedFile?.id]);

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
   * 抽出されたテキストのトークン制限チェック
   */
  const checkTokenLimits = (text: string, fileName: string): { text: string; warning?: string } => {
    if (!text || text.trim().length === 0) {
      return { text };
    }

    const estimatedTokens = estimateTokenCount(text);
    const hardLimit = 2000000; // 2Mトークンをハードリミットとして設定

    if (estimatedTokens > hardLimit) {
        const warning = `ファイル ${fileName} のトークン数 (${estimatedTokens.toLocaleString()}) がハードリミット (${hardLimit.toLocaleString()}) を超えています。処理を中止します。`;
        console.warn(`⚠️ トークン制限超過: ${fileName}`, warning);
        onError({
            id: Date.now().toString(),
            code: 'TOKEN_LIMIT_EXCEEDED',
            message: warning,
            timestamp: new Date(),
            recoverable: false,
        });
        throw new Error(warning);
    }
    
    const softLimit = 100000; // 100kトークンを超えたら警告
    if (estimatedTokens > softLimit) {
        const warning = `ファイル ${fileName} のトークン数 (${estimatedTokens.toLocaleString()}) が多く、処理に時間がかかるか、失敗する可能性があります。`;
        console.warn(`⚠️ トークン警告: ${fileName}`, warning);
        return { text, warning };
    }
    
    return { text };
  };

  /**
   * 文書ファイルからテキストを抽出
   */
  const extractTextFromDocument = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (extension === 'txt') {
        // テキストファイルの場合、encoding-japaneseで適切な文字エンコーディング処理
        console.log('テキストファイル処理開始:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        try {
          // ArrayBufferとして読み込み
          const buffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          
          // encoding-japaneseで文字エンコーディングを自動判定
          const detectedEncoding = Encoding.detect(uint8Array);
          console.log('文字エンコーディング判定結果:', detectedEncoding);
          
          let text = '';
          
          if (detectedEncoding) {
            // 判定されたエンコーディングでデコード
            const unicodeArray = Encoding.convert(uint8Array, {
              to: 'UNICODE',
              from: detectedEncoding
            });
            text = Encoding.codeToString(unicodeArray);
            console.log('文字エンコーディング変換成功:', {
              fromEncoding: detectedEncoding,
              textLength: text.length,
              textPreview: text.substring(0, 100)
            });
          } else {
            // 判定に失敗した場合は複数のエンコーディングを試行
            const encodings = ['UTF8', 'SJIS', 'EUCJP', 'JIS'];
            
            for (const encoding of encodings) {
              try {
                const unicodeArray = Encoding.convert(uint8Array, {
                  to: 'UNICODE',
                  from: encoding
                });
                const testText = Encoding.codeToString(unicodeArray);
                
                // 文字化けチェック（簡易版）
                if (testText && testText.length > 0 && !testText.includes('�')) {
                  text = testText;
                  console.log('文字エンコーディング試行成功:', {
                    encoding: encoding,
                    textLength: text.length,
                    textPreview: text.substring(0, 100)
                  });
                  break;
                }
              } catch (error) {
                console.warn(`エンコーディング ${encoding} での変換に失敗:`, error);
                continue;
              }
            }
          }
          
          if (!text || text.trim().length === 0) {
            throw new Error('テキストの抽出に失敗しました');
          }
          
          const tokenCheck = checkTokenLimits(text, file.name);
          if (tokenCheck.warning) {
            // 警告をコンソールに出力（UI表示は後続処理で実装）
            console.warn(`📊 ${file.name}: ${tokenCheck.warning}`);
          }
          
          return tokenCheck.text;
          
        } catch (error) {
          console.error('テキストファイル処理エラー:', error);
          // フォールバック: 従来の方法を試行
          try {
            const text = await file.text();
            if (text && text.trim().length > 0) {
              console.log('フォールバック処理成功');
              const tokenCheck = checkTokenLimits(text, file.name);
              if (tokenCheck.warning) {
                console.warn(`📊 ${file.name} (フォールバック): ${tokenCheck.warning}`);
              }
              return tokenCheck.text;
            }
          } catch (fallbackError) {
            console.error('フォールバック処理も失敗:', fallbackError);
          }
          
          return '※テキストファイルの内容を読み取れませんでした。ファイルの文字エンコーディングを確認してください。';
        }
      } else if (extension === 'md') {
        // Markdownファイルの場合
        const text = await file.text();
        if (!text) {
          return '※Markdownファイルの内容を読み取れませんでした。';
        }
        
        const tokenCheck = checkTokenLimits(text, file.name);
        if (tokenCheck.warning) {
          console.warn(`📊 ${file.name} (Markdown): ${tokenCheck.warning}`);
        }
        
        return tokenCheck.text;
      } else if (extension === 'pdf') {
        // PDFファイルの場合（FileProcessorサービスを使用）
        try {
          console.log('FileProcessorを使用したPDF処理開始:', file.name);
          setPdfProcessingProgress({ stage: 'init', percentage: 5, message: 'PDF処理を開始しています...' });
          
          const result = await fileProcessor.processPDF(file, (progress) => {
            setPdfProcessingProgress(progress);
            console.log('PDF処理進捗:', progress);
          });
          
          if (result.content && result.content.trim()) {
            console.log('PDF処理成功:', { fileName: file.name, contentLength: result.content.length });
            setPdfProcessingProgress(null); // 進捗表示をクリア
            return result.content;
          } else {
            console.warn('PDF処理結果が空:', file.name);
            setPdfProcessingProgress(null);
            return '※PDFファイルからテキストを抽出できませんでした。内容があるPDFファイルをご確認ください。';
          }
        } catch (error) {
          console.error('FileProcessorでのPDF処理エラー:', error);
          setPdfProcessingProgress(null); // エラー時は進捗表示をクリア
          
          // フォールバック処理：基本的なテキスト抽出を試行
          try {
            console.log('フォールバック処理: 基本的なテキスト抽出を試行');
            const text = await file.text();
            if (text && text.trim()) {
              console.log('フォールバック処理成功');
              return text;
            } else {
              return '※PDFファイルからのテキスト抽出に失敗しました。画像ベースのPDFの場合は、テキスト形式での再提出をお勧めします。';
            }
          } catch (fallbackError) {
            console.error('フォールバック処理も失敗:', fallbackError);
            return `※PDFファイル「${file.name}」の処理中にエラーが発生しました。ファイルが破損していないか確認してください。`;
          }
        }
      } else if (extension === 'docx' || extension === 'doc') {
        // DOCXファイルの場合
        console.log('DOCX処理開始:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          console.log('ArrayBuffer読み込み成功:', {
            bufferSize: arrayBuffer.byteLength,
            fileName: file.name
          });
          
          const result = await mammoth.extractRawText({ arrayBuffer });
          console.log('Mammoth抽出結果:', {
            textLength: result.value?.length || 0,
            hasMessages: result.messages?.length > 0,
            messages: result.messages,
            textPreview: result.value?.substring(0, 200)
          });
          
          if (!result.value || result.value.trim().length === 0) {
            console.warn('DOCX抽出結果が空:', file.name);
            return `※ファイル「${file.name}」からテキストを抽出できませんでした。ファイルが破損している可能性があります。`;
          }
          
          const tokenCheck = checkTokenLimits(result.value, file.name);
          if (tokenCheck.warning) {
            console.warn(`📊 ${file.name} (DOCX): ${tokenCheck.warning}`);
          }
          
          console.log('DOCX処理完了:', {
            fileName: file.name,
            extractedLength: result.value.length,
            tokenCount: tokenCheck.warning ? '制限超過' : '正常'
          });
          
          // 抽出されたテキストを返す
          return tokenCheck.text;
        } catch (docxError) {
          console.error('DOCX処理でエラー:', docxError);
          
          // フォールバック: FileReaderを使用した読み込み
          try {
            console.log('DOCX フォールバック処理開始');
            const reader = new FileReader();
            
            return new Promise((resolve, reject) => {
              reader.onload = async (e) => {
                try {
                  const arrayBuffer = e.target?.result as ArrayBuffer;
                  if (!arrayBuffer) {
                    throw new Error('FileReader結果が空です');
                  }
                  
                  const result = await mammoth.extractRawText({ arrayBuffer });
                  if (result.value && result.value.trim().length > 0) {
                    console.log('DOCX フォールバック処理成功');
                    const tokenCheck = checkTokenLimits(result.value, file.name);
                    resolve(tokenCheck.text);
                  } else {
                    resolve(`※ファイル「${file.name}」からテキストを抽出できませんでした。`);
                  }
                } catch (fallbackError) {
                  console.error('DOCX フォールバック処理も失敗:', fallbackError);
                  resolve(`※ファイル「${file.name}」の処理中にエラーが発生しました。ファイルが破損していないか確認してください。`);
                }
              };
              
              reader.onerror = () => {
                console.error('FileReader エラー:', reader.error);
                resolve(`※ファイル「${file.name}」の読み込みに失敗しました。`);
              };
              
              reader.readAsArrayBuffer(file);
            });
          } catch (fallbackError) {
            console.error('フォールバック処理の初期化に失敗:', fallbackError);
            return `※ファイル「${file.name}」の処理中にエラーが発生しました。ファイル形式を確認してください。`;
          }
        }
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
            // Electron環境では一意の識別子を生成してpathに設定
            // 実際の再生時は rawFile から blob URL を生成する
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            
            // 日本語ファイル名を安全にエンコード
            const safeFileName = encodeURIComponent(file.name).replace(/[.*+?^${}()|[\]\\]/g, '_');
            const uniqueId = `${safeFileName}-${timestamp}-${randomId}`;
            
            blobUrl = `electron-file://${uniqueId}`;
            console.log('Electron環境: ファイル処理開始', {
              originalFileName: file.name,
              safeFileName: safeFileName,
              fileSize: file.size,
              fileType: file.type,
              uniqueId: uniqueId,
              pathIdentifier: blobUrl
            });
          } else {
            blobUrl = URL.createObjectURL(file);
            console.log('ブラウザ環境: blobURL生成', { 
              fileName: file.name,
              blobUrl: blobUrl 
            });
          }
          duration = await getAudioDuration(file);
        } catch (error) {
          console.error('ファイル処理エラー:', error);
          // エラーが発生してもファイル処理は続行
          if (typeof window !== 'undefined' && (window as any).electronAPI) {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const safeFileName = encodeURIComponent(file.name).replace(/[.*+?^${}()|[\]\\]/g, '_');
            blobUrl = `electron-file://${safeFileName}-${timestamp}-${randomId}`;
            console.log('Electron環境: エラー時のフォールバック識別子生成', {
              originalFileName: file.name,
              safeFileName: safeFileName,
              fallbackPath: blobUrl
            });
          } else {
            blobUrl = '';
          }
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
  const togglePlayback = useCallback(async () => {
    if (!selectedFile || selectedFile.metadata?.fileType !== 'audio') {
      return;
    }

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (!audioRef.current) {
      return;
    }

    try {
      // エラー状態をクリア
      setAudioError(null);
      
      // 既存の再生を完全に停止
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // 既存のソースをクリア
      if (audioRef.current.src) {
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current.src = '';
      }
      
      // Electron環境での音声ソース設定
      if (typeof window !== 'undefined' && (window as any).electronAPI && selectedFile.rawFile) {
        console.log('Electron環境: rawFileからblobURL生成開始', {
          fileName: selectedFile.name,
          fileSize: selectedFile.rawFile.size,
          fileType: selectedFile.rawFile.type,
          pathIdentifier: selectedFile.path,
          retryCount: audioRetryCount
        });
        
        try {
          const blobUrl = URL.createObjectURL(selectedFile.rawFile);
          audioRef.current.src = blobUrl;
          console.log('Electron環境: blobURL設定完了', { blobUrl });
        } catch (blobError) {
          console.error('Electron環境: blobURL生成エラー:', blobError);
          throw new Error('音声ファイルの読み込みに失敗しました');
        }
      } else if (selectedFile.path && selectedFile.path !== '' && !selectedFile.path.startsWith('electron-file://')) {
        // 通常のブラウザ環境（blob:またはhttp:プロトコル）
        console.log('ブラウザ環境: pathからソース設定', { path: selectedFile.path });
        audioRef.current.src = selectedFile.path;
      } else if (selectedFile.path && selectedFile.path.startsWith('electron-file://') && selectedFile.rawFile) {
        // Electron環境でelectron-file://プロトコルの場合
        console.log('Electron環境: electron-file://プロトコル検出、rawFileからblobURL生成', {
          pathIdentifier: selectedFile.path,
          fileName: selectedFile.name,
          retryCount: audioRetryCount
        });
        
        try {
          const blobUrl = URL.createObjectURL(selectedFile.rawFile);
          audioRef.current.src = blobUrl;
          console.log('Electron環境: electron-file://からblobURL設定完了', { blobUrl });
        } catch (blobError) {
          console.error('Electron環境: electron-file://からblobURL生成エラー:', blobError);
          throw new Error('音声ファイルの読み込みに失敗しました');
        }
      } else {
        console.error('音声ソースが設定できません', {
          hasElectronAPI: !!(typeof window !== 'undefined' && (window as any).electronAPI),
          hasRawFile: !!selectedFile.rawFile,
          path: selectedFile.path,
          pathStartsWithElectron: selectedFile.path?.startsWith('electron-file://'),
          retryCount: audioRetryCount
        });
        throw new Error('音声ファイルが見つかりません');
      }
      
      // メタデータがロードされるまで待つ
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('音声ファイルの読み込みがタイムアウトしました'));
        }, 10000); // 10秒に延長
        
        const onLoadedData = () => {
          clearTimeout(timeoutId);
          audioRef.current?.removeEventListener('loadeddata', onLoadedData);
          audioRef.current?.removeEventListener('error', onError);
          audioRef.current?.removeEventListener('canplay', onCanPlay);
          console.log('音声ファイルの読み込み完了');
          resolve();
        };
        
        const onCanPlay = () => {
          clearTimeout(timeoutId);
          audioRef.current?.removeEventListener('loadeddata', onLoadedData);
          audioRef.current?.removeEventListener('error', onError);
          audioRef.current?.removeEventListener('canplay', onCanPlay);
          console.log('音声ファイルの再生準備完了');
          resolve();
        };
        
        const onError = (e: Event) => {
          clearTimeout(timeoutId);
          audioRef.current?.removeEventListener('loadeddata', onLoadedData);
          audioRef.current?.removeEventListener('error', onError);
          audioRef.current?.removeEventListener('canplay', onCanPlay);
          
          const target = e.target as HTMLAudioElement;
          const error = target.error;
          let errorMessage = '音声ファイルの読み込みに失敗しました';
          
          if (error) {
            switch (error.code) {
              case error.MEDIA_ERR_ABORTED:
                errorMessage = '音声ファイルの読み込みが中断されました';
                break;
              case error.MEDIA_ERR_NETWORK:
                errorMessage = 'ネットワークエラーが発生しました';
                break;
              case error.MEDIA_ERR_DECODE:
                errorMessage = '音声ファイルの形式がサポートされていません';
                break;
              case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = '音声ファイルが見つからないか、サポートされていません';
                break;
            }
          }
          
          console.error('音声読み込みエラー:', errorMessage, { 
            errorCode: error?.code,
            src: target.src,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.metadata?.fileType,
            pathType: selectedFile.path?.startsWith('electron-file://') ? 'electron-file' : 
                                selectedFile.path?.startsWith('blob:') ? 'blob' : 'other',
            hasRawFile: !!selectedFile.rawFile
          });
          reject(new Error(errorMessage));
        };
        
        if (audioRef.current) {
          audioRef.current.addEventListener('loadeddata', onLoadedData);
          audioRef.current.addEventListener('canplay', onCanPlay);
          audioRef.current.addEventListener('error', onError);
          audioRef.current.load(); // 明示的にロードを開始
        } else {
          reject(new Error('音声要素が見つかりません'));
        }
      });
      
      await loadPromise;
      
      // 再生開始
      await audioRef.current.play();
      setIsPlaying(true);
      setAudioRetryCount(0); // 成功時は再試行カウントをリセット
      console.log('音声再生開始');
      
    } catch (error) {
      console.error('音声再生エラー:', error);
      setIsPlaying(false);
      
      // エラー時のクリーンアップ
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }
      
      const errorMessage = error instanceof Error ? error.message : '音声の再生に失敗しました';
      setAudioError(errorMessage);
      
      // 再試行ロジック（最大3回まで）
      if (audioRetryCount < 3) {
        console.log(`音声再生再試行 ${audioRetryCount + 1}/3`);
        setAudioRetryCount(prev => prev + 1);
        
        // 短い遅延後に再試行
        setTimeout(() => {
          console.log('音声再生の再試行を実行中...');
          togglePlayback();
        }, 1000 * (audioRetryCount + 1)); // 1秒, 2秒, 3秒の遅延
      } else {
        // 最大再試行回数に達した場合
        console.error('音声再生の最大再試行回数に達しました');
        setAudioRetryCount(0);
        alert(`音声再生エラー: ${errorMessage}\n\n再試行回数が上限に達しました。ファイルを再選択してください。`);
      }
    }
  }, [selectedFile, isPlaying, audioRetryCount]);

  // ファイル削除
  const handleFileRemove = useCallback(() => {
    if (selectedFile) {
      // 音声再生を停止
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      
      // blob URLをクリーンアップ
      if (selectedFile.path) {
        URL.revokeObjectURL(selectedFile.path);
      }
      
      // 音声要素のソースもクリア
      if (audioRef.current) {
        audioRef.current.src = '';
      }
      
      onFileSelect(null);
      setValidationErrors([]);
    }
  }, [selectedFile, onFileSelect, isPlaying]);

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
                    let errorMessage = '音声ファイルの再生に失敗しました';
                    let errorDetails = '';
                    
                    if (error) {
                      switch (error.code) {
                        case error.MEDIA_ERR_ABORTED:
                          errorMessage = '音声ファイルの読み込みが中断されました';
                          errorDetails = 'ファイルの読み込みが中断されました。再度お試しください。';
                          break;
                        case error.MEDIA_ERR_NETWORK:
                          errorMessage = 'ネットワークエラーが発生しました';
                          errorDetails = 'ネットワークに問題があります。インターネット接続を確認してください。';
                          break;
                        case error.MEDIA_ERR_DECODE:
                          errorMessage = '音声ファイルの形式がサポートされていません';
                          errorDetails = 'この音声ファイルの形式はサポートされていません。MP3, WAV, M4A形式を使用してください。';
                          break;
                        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                          errorMessage = '音声ファイルが見つからないか、サポートされていません';
                          errorDetails = 'ファイルが見つからないか、この形式はサポートされていません。';
                          break;
                        default:
                          errorMessage = '不明な音声エラーが発生しました';
                          errorDetails = error.message || '詳細不明';
                      }
                    }
                    
                    console.error('Audio playback error:', {
                      message: errorMessage,
                      details: errorDetails,
                      errorCode: error?.code,
                      src: e.currentTarget.src,
                      fileName: selectedFile.name,
                      fileSize: selectedFile.size,
                      fileType: selectedFile.metadata?.fileType,
                      pathType: selectedFile.path?.startsWith('electron-file://') ? 'electron-file' : 
                                selectedFile.path?.startsWith('blob:') ? 'blob' : 'other',
                      hasRawFile: !!selectedFile.rawFile
                    });
                    
                    setIsPlaying(false);
                    
                    // エラー時にソースをクリア
                    if (e.currentTarget.src?.startsWith('blob:')) {
                      URL.revokeObjectURL(e.currentTarget.src);
                      e.currentTarget.src = '';
                    }
                    
                    // Windows環境でのElectronエラーの場合、特別な処理
                    if (typeof window !== 'undefined' && (window as any).electronAPI) {
                      console.warn('Windows Electronでの音声エラー - 回避策を試行中...');
                      // 短い遅延後に再試行する可能性を示唆
                      setTimeout(() => {
                        console.log('音声エラー回復を試行可能です');
                      }, 1000);
                    }
                  }}
                  onLoadStart={() => {
                    console.log('Audio loading started', {
                      fileName: selectedFile?.name,
                      pathType: selectedFile?.path?.startsWith('electron-file://') ? 'electron-file' : 
                                selectedFile?.path?.startsWith('blob:') ? 'blob' : 'other'
                    });
                  }}
                  onCanPlay={() => {
                    console.log('Audio can start playing', {
                      fileName: selectedFile?.name,
                      duration: audioRef.current?.duration,
                      readyState: audioRef.current?.readyState
                    });
                  }}
                  onAbort={() => {
                    console.log('Audio loading aborted', {
                      fileName: selectedFile?.name,
                      src: audioRef.current?.src
                    });
                    setIsPlaying(false);
                  }}
                  style={{ display: 'none' }}
                  preload="none"
                  controls={false}
                />
              )}
              
              {/* 音声エラー表示 */}
              {audioError && selectedFile.metadata?.fileType === 'audio' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>音声再生エラー</AlertTitle>
                  {audioError}
                  {audioRetryCount > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        再試行中... ({audioRetryCount}/3)
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
              
              {/* 次へボタン */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => {
                    console.log('次へボタンがクリックされました', { selectedFile: !!selectedFile, onNext: !!onNext });
                    if (onNext) {
                      onNext();
                    } else {
                      console.error('onNext関数が定義されていません');
                    }
                  }}
                  disabled={!selectedFile}
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
                    '&:disabled': {
                      background: 'rgba(0, 0, 0, 0.12)',
                      color: 'rgba(0, 0, 0, 0.26)',
                    },
                  }}
                >
                  次へ
                </Button>
              </Box>
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

      {/* PDF処理専用進捗 */}
      {pdfProcessingProgress && (
        <Card sx={{ mb: 3, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PictureAsPdf sx={{ mr: 1, color: 'info.main' }} />
              <Typography variant="subtitle1" color="info.main">
                {pdfProcessingProgress.message}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pdfProcessingProgress.percentage}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'info.100',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'info.main',
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              PDF処理: {pdfProcessingProgress.stage} ({pdfProcessingProgress.percentage}%)
            </Typography>
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
}); 