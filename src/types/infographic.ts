// ===========================================
// MinutesGen v0.7.5 - インフォグラフィック型定義
// ===========================================

export interface InfographicToneConfig {
  type: 'url' | 'image' | 'theme'; // 'theme'を追加（アプリテーマ使用）
  source?: string; // URL
  imageFile?: File | null; // 画像ファイル（nullを許可）
  themeMode?: 'light' | 'dark' | 'color'; // アプリテーマモード
}

export interface InfographicConfig {
  tone: InfographicToneConfig;
  informationLevel: 'large' | 'medium' | 'small';
  structure: 'scroll' | 'horizontal' | 'vertical';
  additionalFiles?: File[];
  additionalText?: string;
}

export interface ToneAnalysis {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: {
    heading: string;
    body: string;
    caption: string;
  };
  spacing: {
    section: string;
    element: string;
  };
  borderRadius: string;
  shadow: string;
  layout: 'minimal' | 'rich' | 'classic';
}

export interface InfographicOutput {
  html: string;
  images?: string[]; // Base64 encoded PNGs
  metadata: {
    pageCount: number;
    dimensions: { width: number; height: number };
    generatedAt: Date;
    config: InfographicConfig;
  };
}

export interface InfographicGenerationProgress {
  stage: 'analyzing' | 'processing' | 'generating' | 'converting' | 'completed';
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number;
}

export interface FileProcessingResult {
  content: string;
  type: 'pdf' | 'office' | 'image' | 'text' | 'unknown';
  metadata: {
    fileName: string;
    fileSize: number;
    processedAt: Date;
  };
} 