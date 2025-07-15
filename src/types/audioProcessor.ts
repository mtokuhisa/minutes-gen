export interface AudioSegment {
  blob: Blob;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface SegmentBoundary {
  start: number;
  end: number;
  overlapStart?: number;
  overlapEnd?: number;
}

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

// ProcessingProgress、LogEntry、AudioFileは既存のtypes/index.tsを使用
import { ProcessingProgress, LogEntry, AudioFile } from './index'; 