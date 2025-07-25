// ===========================================
// MinutesGen v0.7.5 - TypeScript型定義システム
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
  fileType?: 'audio' | 'video' | 'document'; // ファイルタイプ
  documentText?: string; // 文書ファイルの場合のテキスト内容
}

// 音声処理セグメント関連の型定義
export interface AudioSegment {
  blob: Blob;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

// ファイルパスベースの音声セグメント（メモリ効率化）
export interface AudioSegmentPath {
  filePath: string;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

// ファイルパス情報を持つ音声セグメント（内部使用）
export interface AudioSegmentWithPath extends AudioSegment {
  _filePath?: string;
}

export interface SegmentBoundary {
  start: number;
  end: number;
  overlapStart?: number;
  overlapEnd?: number;
}

// 音声処理インターフェース
export interface AudioProcessorInterface {
  /**
   * 音声処理システムを初期化
   */
  initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void>;
  
  /**
   * 大容量音声ファイルを適切なセグメントに分割
   */
  processLargeAudioFile(
    file: AudioFile,
    segmentDurationSeconds?: number,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]>;
  
  /**
   * リソースのクリーンアップ
   */
  cleanup(): Promise<void>;
  
  /**
   * 音声長さを取得
   */
  getAudioDurationFromBlob(blob: Blob): Promise<number>;
}

// 処理オプション関連の型定義
export interface ProcessingOptions {
  language: SupportedLanguage;
  punctuation: boolean;
  timestamps: boolean;
  customPrompt?: string;
  minutesModel: 'gpt-4.1' | 'o3';
  selectedPrompt: string | null;
  promptType: 'preset' | 'custom';
}

export type SupportedLanguage = 'ja' | 'en' | 'auto';

// 処理進捗関連の型定義
export interface ProcessingProgress {
  stage: ProcessingStage;
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number; // 秒
  logs: ProcessingLog[];
  startedAt: Date;
  processingDetails?: {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
  };
}

export type ProcessingStage = 
  | 'uploading'
  | 'analyzing'
  | 'transcribing'
  | 'generating'
  | 'formatting'
  | 'completed'
  | 'error'
  | 'preprocessing'
  | 'preparing';

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
  speakingTime?: number; // 秒（オプション）
  avatar?: string;
}

export interface KeyPoint {
  id: string;
  content: string;
  timestamp?: number; // 秒（オプション）
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
  timestamp?: number; // 秒（オプション）
}

export interface TranscriptionSegment {
  id: string;
  startTime?: number; // 秒（オプション）
  endTime?: number; // 秒（オプション）
  speakerId?: string;
  text: string;
  confidence?: number; // 0-1（オプション）
}

export type OutputFormat = 'markdown' | 'html' | 'word';

export type ProcessingQuality = 'standard' | 'high' | 'premium';

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
  infographic?: {
    config: any; // InfographicConfig
    output: any; // InfographicOutput
    isGenerating: boolean;
    progress: any; // InfographicGenerationProgress
    error: string | null;
  };
}

export interface AppError {
  id: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface InfographicConfig {
  layout: 'standard' | 'compact' | 'detailed';
  colorPalette: 'default' | 'vibrant' | 'corporate';
  font: 'sans-serif' | 'serif';
  informationLevel: 'summary' | 'standard' | 'full';
  branding: {
    logoUrl?: string;
    companyName?: string;
  };
}

export interface InfographicOutput {
  htmlContent: string;
  assets?: {
    [key: string]: string; // asset key to data URL
  };
}

export interface InfographicGenerationProgress {
  stage: 'analyzing' | 'designing' | 'rendering' | 'completed' | 'error';
  percentage: number;
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

// Electron API の型定義
export interface ElectronAPI {
  getCorporateConfig: () => Promise<any>;
  getAppPath: () => Promise<string>;
  isElectron: () => boolean;
}

// グローバル Window オブジェクトの拡張
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// デフォルト値のエクスポート
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  language: 'ja',
  punctuation: true,
  timestamps: false,
  minutesModel: 'gpt-4.1',
  selectedPrompt: null,
  promptType: 'preset',
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  maxFileSize: 3 * 1024 * 1024 * 1024, // 3GB
  supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi', 'docx', 'txt', 'md', 'pdf'],
  apiEndpoint: '/api/v1',
  retryAttempts: 3,
  timeoutDuration: 300000, // 5分
}; 