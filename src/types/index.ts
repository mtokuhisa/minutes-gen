// ===========================================
// MinutesGen v1.0 - TypeScript型定義システム
// ===========================================

// 音声ファイル関連の型定義
export interface AudioFile {
  id: string;
  name: string;
  size: number;
  duration: number; // 秒
  format: string; // mp3, wav, m4a等
  path: string; // ファイルパスまたはURL
  /**
   * オリジナルの File オブジェクト。
   *   - 大容量ファイルを OpenAI に送信する際に fetch(blob://...) が失敗するのを防ぐために保持する
   *   - UI コンポーネント側では直接参照しないこと
   */
  rawFile?: File;
  uploadedAt: Date;
  metadata: AudioMetadata;
}

export interface AudioMetadata {
  bitrate: number; // kbps
  sampleRate: number; // Hz
  channels: number; // チャンネル数
  codec: string; // コーデック名
}

// 処理オプション関連の型定義
export interface ProcessingOptions {
  speed: ProcessingSpeed;
  quality: ProcessingQuality;
  outputFormats: OutputFormat[];
  language: SupportedLanguage;
  speakerDetection: boolean;
  punctuation: boolean;
  timestamps: boolean;
  customPrompt?: string;
  model: 'gpt-4.1' | 'o3';
  selectedPrompt: string | null;
  promptType: 'preset' | 'custom';
}

export type ProcessingSpeed = 'fast' | 'normal' | 'high-quality';
export type ProcessingQuality = 'draft' | 'standard' | 'premium';
export type OutputFormat = 'markdown' | 'word' | 'html';
export type SupportedLanguage = 'ja' | 'en' | 'auto';

// 処理進捗関連の型定義
export interface ProcessingProgress {
  stage: ProcessingStage;
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number; // 秒
  logs: ProcessingLog[];
  startedAt: Date;
}

export type ProcessingStage = 
  | 'uploading'
  | 'analyzing'
  | 'transcribing'
  | 'generating'
  | 'formatting'
  | 'completed'
  | 'error';

export interface ProcessingLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

// 結果・出力関連の型定義
export interface MinutesData {
  id: string;
  title: string;
  date: Date;
  duration: number;
  participants: Participant[];
  summary: string;
  keyPoints: KeyPoint[];
  actionItems: ActionItem[];
  transcription: TranscriptionSegment[];
  outputs: GeneratedOutput[];
  metadata: MinutesMetadata;
}

export interface Participant {
  id: string;
  name: string;
  role?: string;
  speakingTime: number; // 秒
  avatar?: string;
}

export interface KeyPoint {
  id: string;
  content: string;
  timestamp: number; // 秒
  importance: 'high' | 'medium' | 'low';
  category?: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: number; // 秒
}

export interface TranscriptionSegment {
  id: string;
  startTime: number; // 秒
  endTime: number; // 秒
  speakerId?: string;
  text: string;
  confidence: number; // 0-1
}

export interface GeneratedOutput {
  format: OutputFormat;
  content: string;
  filePath?: string;
  downloadUrl?: string;
  generatedAt: Date;
  size: number; // bytes
}

export interface MinutesMetadata {
  version: string;
  generatedAt: Date;
  processingTime: number; // 秒
  tokensUsed: number;
  model: string;
  quality: ProcessingQuality;
}

// UI状態管理の型定義
export interface AppState {
  currentStep: number; // 0: upload, 1: options, 2: processing, 3: results
  selectedFile: AudioFile | null;
  processingOptions: ProcessingOptions;
  progress: ProcessingProgress | null;
  results: MinutesData | null;
  error: AppError | null;
  isProcessing: boolean;
}

export interface AppError {
  id: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

// API関連の型定義
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

// ファイル処理関連の型定義
export interface FileValidation {
  isValid: boolean;
  errors: FileValidationError[];
  warnings: FileValidationWarning[];
}

export interface FileValidationError {
  code: string;
  message: string;
  field: string;
}

export interface FileValidationWarning {
  code: string;
  message: string;
  suggestion: string;
}

// 設定・環境関連の型定義
export interface AppConfig {
  maxFileSize: number; // bytes
  supportedFormats: string[];
  apiEndpoint: string;
  retryAttempts: number;
  timeoutDuration: number; // ミリ秒
}

// デフォルト値のエクスポート
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  speed: 'normal',
  quality: 'standard',
  outputFormats: ['markdown', 'word'],
  language: 'ja',
  speakerDetection: true,
  punctuation: true,
  timestamps: true,
  model: 'gpt-4.1',
  selectedPrompt: null,
  promptType: 'preset',
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  maxFileSize: 3 * 1024 * 1024 * 1024, // 3GB
  supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi'],
  apiEndpoint: '/api/v1',
  retryAttempts: 3,
  timeoutDuration: 300000, // 5分
}; 