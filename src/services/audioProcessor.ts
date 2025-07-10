// ===========================================
// MinutesGen v1.0 - Audio Processor Service
// ffmpeg.wasm を使用した音声ファイル処理
// ===========================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { AudioFile, ProcessingProgress } from '../types';

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
  overlapStart?: number; // オーバーラップ開始時刻
  overlapEnd?: number;   // オーバーラップ終了時刻
}

export class AudioProcessorService {
  private ffmpeg: FFmpeg;
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private preloadAttempted: boolean = false;

  // 分割設定
  private readonly MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MB
  private readonly OVERLAP_SIZE = 1.5 * 1024 * 1024; // 1.5MB オーバーラップ

  constructor() {
    // Self-hosted コアファイルを優先的に読み込む（public/ffmpeg-core/dist/umd 下に配置）
    this.ffmpeg = new FFmpeg({
      log: false,
      // 相対パスを使用してElectronパッケージ後も動作するように修正
      corePath: './ffmpeg-core/dist/umd/ffmpeg-core.js',
    });
    // バックグラウンドでプリロードを試行
    this.attemptPreload();
  }

  /**
   * バックグラウンドでffmpeg.wasmのプリロードを試行
   */
  private attemptPreload(): void {
    if (this.preloadAttempted) return;
    this.preloadAttempted = true;

    // 5秒後にバックグラウンドでプリロード開始
    setTimeout(() => {
      this.initialize().catch(() => {
        console.log('ffmpeg.wasm バックグラウンドプリロードに失敗（正常な動作です）');
      });
    }, 5000);
  }

  /**
   * ffmpeg.wasm を初期化（一度だけ実行）
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    // 既に初期化中の場合は同じPromiseを返す
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._initializeFFmpeg(onProgress);
    
    try {
      await this.loadingPromise;
      this.isLoaded = true;
    } catch (error) {
      // 初期化失敗時はPromiseをリセットして再試行可能にする
      this.loadingPromise = null;
      throw error;
    }
  }

  private async _initializeFFmpeg(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    const attemptLoad = async (
      loader: () => Promise<boolean>,
      sourceName: string,
      timeout: number
    ): Promise<boolean> => {
      onProgress?.({
        stage: 'transcribing',
        percentage: 5,
        currentTask: `音声処理ライブラリを${sourceName}から準備中...`,
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `${sourceName} からの音声処理ライブラリの準備を開始します。` }],
        startedAt: new Date(),
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${sourceName}からのffmpeg.wasmの読み込みが${timeout / 1000}秒でタイムアウトしました。`)), timeout)
      );

      try {
        await Promise.race([loader(), timeoutPromise]);
        onProgress?.({
          stage: 'transcribing',
          percentage: 15,
          currentTask: '音声処理ライブラリの準備完了',
          estimatedTimeRemaining: 0,
          logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: `${sourceName} からの音声処理ライブラリの準備が完了しました。` }],
          startedAt: new Date(),
        });
        return true;
      } catch (error) {
        console.warn(`${sourceName}からの読み込みに失敗しました。`, error);
        onProgress?.({
            stage: 'transcribing',
            percentage: 10,
            currentTask: `音声処理ライブラリ(${sourceName})の準備失敗`,
            estimatedTimeRemaining: 0,
            logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'warning', message: `${sourceName} からの準備に失敗しました。次のソースを試行します。` }],
            startedAt: new Date(),
        });
        return false;
      }
    };

    // --- 試行1: ローカル (self-hosted) からの読み込み ---
    const localLoader = () => this.ffmpeg.load();
    if (await attemptLoad(localLoader, 'ローカル', 60000)) {
      return; // 成功
    }

    // --- 試行2: CDN (unpkg) からの読み込み ---
    // ローカル失敗時に備え、ffmpegインスタンスを再生成してクリーンな状態から始める
    this.ffmpeg = new FFmpeg({ log: false }); 
    const cdnLoader = async () => {
        const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
        return this.ffmpeg.load({ coreURL, wasmURL, workerURL });
    };
    if (await attemptLoad(cdnLoader, 'CDN', 60000)) {
      return; // 成功
    }
    
    // --- 全て失敗 ---
    const finalError = new Error('音声処理ライブラリの準備に失敗しました。ネットワーク接続を確認後、再度お試しください。');
    onProgress?.({
        stage: 'error',
        percentage: 100,
        currentTask: '音声処理ライブラリの準備エラー',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'error', message: finalError.message }],
        startedAt: new Date(),
    });
    throw finalError;
  }

  /**
   * 音声圧縮を実行
   */
  private async compressAudio(inputFileName: string, outputFileName: string, onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    const ffmpeg = this.ffmpeg;
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized');
    }

    onProgress?.({
      stage: 'transcribing',
      percentage: 40,
      currentTask: '音声圧縮中...',
      estimatedTimeRemaining: 0,
      logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: '音声圧縮を開始します...' }],
      startedAt: new Date(),
    });

    try {
      await ffmpeg.exec([
        '-y',
        '-i', inputFileName,
        '-vn', // ビデオストリームを無視
        '-acodec', 'libmp3lame', // MP3エンコーダーを使用
        '-b:a', '128k', // ビットレートを128kbpsに設定
        '-ar', '44100', // サンプルレートを44.1kHzに統一
        '-ac', '1', // チャンネルをモノラルに統一
        outputFileName
      ]);
      onProgress?.({
        stage: 'transcribing',
        percentage: 45,
        currentTask: '音声圧縮完了',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: '音声圧縮が完了しました。' }],
        startedAt: new Date(),
      });
    } catch (error) {
      console.error('音声圧縮に失敗しました:', error);
      let errorMessage = '音声圧縮処理中にエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = `音声圧縮処理中にエラーが発生しました: ${error.message}`;
      }
      onProgress?.({
        stage: 'error',
        percentage: 100,
        currentTask: '音声圧縮エラー',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'error', message: errorMessage }],
        startedAt: new Date(),
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * ファイルサイズベースで分割境界を計算
   */
  private calculateSizeBasedSegments(duration: number, estimatedSizeBytes: number): SegmentBoundary[] {
    const segments: SegmentBoundary[] = [];
    
    // 15MB未満の場合は分割しない
    if (estimatedSizeBytes < this.MAX_SEGMENT_SIZE) {
      return [{
        start: 0,
        end: duration,
        overlapStart: 0,
        overlapEnd: 0
      }];
    }

    // 1秒あたりのファイルサイズを推定
    const bytesPerSecond = estimatedSizeBytes / duration;
    
    // 15MBに相当する時間を計算
    const targetSegmentDuration = this.MAX_SEGMENT_SIZE / bytesPerSecond;
    
    // 1.5MBに相当するオーバーラップ時間を計算
    const overlapDuration = this.OVERLAP_SIZE / bytesPerSecond;
    
    let currentStart = 0;
    
    while (currentStart < duration) {
      const segmentEnd = Math.min(currentStart + targetSegmentDuration, duration);
      
      // 最後のセグメントでない場合のみオーバーラップを適用
      const isLastSegment = segmentEnd >= duration;
      const overlapStart = isLastSegment ? 0 : Math.max(0, segmentEnd - overlapDuration);
      const overlapEnd = isLastSegment ? 0 : segmentEnd;
      
      segments.push({
        start: currentStart,
        end: segmentEnd,
        overlapStart,
        overlapEnd
      });
      
      // 最後のセグメントの場合はループを終了
      if (isLastSegment) {
        break;
      }
      
      // 次のセグメントはオーバーラップを考慮せず、現在のセグメントの終了位置から開始
      currentStart = segmentEnd;
    }
    
    return segments;
  }

  /**
   * 音声ファイルを処理してセグメントに分割
   */
  async processLargeAudioFile(
    file: AudioFile,
    segmentDurationSeconds: number = 600, // 使用しない（互換性のため残す）
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]> {
    if (!file.rawFile) {
      throw new Error('音声ファイルが見つかりません');
    }

    await this.initialize(onProgress);

    try {
      const inputFileName = 'input.' + this.getFileExtension(file.name);
      const fileSizeBytes = file.rawFile.size;
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 20,
        currentTask: '音声ファイルを解析準備中...',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: '音声ファイルを処理システムに読み込んでいます...' }],
        startedAt: new Date(),
      });

      // ファイルをffmpeg.wasmに読み込み
      const fileData = await fetchFile(file.rawFile);
      await this.ffmpeg.writeFile(inputFileName, fileData);

      // ==============================================================
      // ステップ1: 音声の長さと情報を取得
      // ==============================================================
      const duration = await this.getAudioDuration(inputFileName);
      if (duration === 0) {
        // もしgetAudioDurationが0を返した場合、ファイルに音声トラックがないか、破損している可能性がある
        // 一度、強制的にWAV変換を試みて、それでもダメならエラーとする
        try {
          await this.ffmpeg.exec(['-y', '-i', inputFileName, '-vn', '-acodec', 'pcm_s16le', '-t', '1', 'test.wav']);
          await this.ffmpeg.deleteFile('test.wav');
        } catch(e) {
            throw new Error('音声ファイルの長さが取得できませんでした。ファイルに音声トラックがないか、破損している可能性があります。');
        }
      }

      // ==============================================================
      // ステップ2: 音声圧縮（必要な場合のみ）
      // ==============================================================
      let workingFileName = inputFileName;
      
      // 15MB以上の場合は圧縮を実行
      if (fileSizeBytes >= this.MAX_SEGMENT_SIZE) {
        const compressedFileName = 'compressed_output.mp3';
        await this.compressAudio(inputFileName, compressedFileName, onProgress);
        workingFileName = compressedFileName;
        
        // 圧縮後のファイルサイズを推定（実際には取得できないため、圧縮比を仮定）
        const estimatedCompressedSize = fileSizeBytes * 0.3; // 30%に圧縮されると仮定
        
        onProgress?.({
          stage: 'transcribing',
          percentage: 50,
          currentTask: `圧縮完了（推定 ${Math.round(estimatedCompressedSize / 1024 / 1024)}MB）`,
          estimatedTimeRemaining: 0,
          logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: `音声圧縮が完了しました。推定サイズ: ${Math.round(estimatedCompressedSize / 1024 / 1024)}MB` }],
          startedAt: new Date(),
        });
      }

      // ==============================================================
      // ステップ3: ファイルサイズベースの分割境界を計算
      // ==============================================================
      const segments = this.calculateSizeBasedSegments(duration, fileSizeBytes);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 55,
        currentTask: `分割計画: ${segments.length}セグメント`,
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `ファイルサイズ ${Math.round(fileSizeBytes / 1024 / 1024)}MB を ${segments.length}個のセグメントに分割します。` }],
        startedAt: new Date(),
      });

      // ==============================================================
      // ステップ4: セグメント化を実行
      // ==============================================================
      const audioSegments: AudioSegment[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentFileName = `segment_${i.toString().padStart(3, '0')}.wav`;
        
        onProgress?.({
          stage: 'transcribing',
          percentage: 60 + Math.round((i / segments.length) * 30),
          currentTask: `セグメント ${i + 1}/${segments.length} を作成中...`,
          estimatedTimeRemaining: 0,
          logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `セグメント ${i + 1}: ${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s` }],
          startedAt: new Date(),
        });

        const segmentArgs = [
          '-y',
          '-i', workingFileName,
          '-ss', segment.start.toString(),
          '-t', (segment.end - segment.start).toString(),
          '-vn', // ビデオストリームを無視
          '-acodec', 'pcm_s16le', // 16bitリトルエンディアンPCM
          '-ar', '44100', // サンプルレートを44.1kHzに統一
          '-ac', '1', // チャンネルをモノラルに統一
          segmentFileName
        ];
        
        await this.ffmpeg.exec(segmentArgs);

        const data = await this.ffmpeg.readFile(segmentFileName);
        const blob = new Blob([data], { type: 'audio/wav' });
        
        await this.ffmpeg.deleteFile(segmentFileName);
        
        const segmentDuration = await this.getAudioDurationFromBlob(blob);

        audioSegments.push({
          blob,
          name: segmentFileName,
          duration: segmentDuration,
          startTime: segment.start,
          endTime: segment.end,
        });
      }
      
      // 作業ファイルを削除してメモリ解放
      await this.ffmpeg.deleteFile(inputFileName);
      if (workingFileName !== inputFileName) {
        await this.ffmpeg.deleteFile(workingFileName);
      }

      onProgress?.({
        stage: 'transcribing',
        percentage: 95,
        currentTask: '音声ファイルの準備完了',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: `合計 ${audioSegments.length} 個の音声セグメントの準備が完了しました。` }],
        startedAt: new Date(),
      });
      
      return audioSegments;

    } catch (error) {
      console.error('ffmpeg 処理エラー:', error);
      let errorMessage = '音声ファイルの分割処理中にエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = `音声ファイルの分割処理中にエラーが発生しました: ${error.message}`;
      }
      
      onProgress?.({
        stage: 'error',
        percentage: 100,
        currentTask: '音声ファイル処理エラー',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'error', message: errorMessage }],
        startedAt: new Date(),
      });
      
      throw new Error(errorMessage);
    }
  }

  /**
   * ffmpeg.wasm 内のファイルから音声の長さを取得
   */
  private async getAudioDuration(fileName: string): Promise<number> {
    let duration = 0;
    let logOutput = '';

    const logListener = ({ message }: { type: string, message: string }) => {
      logOutput += message + '\n';
      const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseInt(durationMatch[3], 10);
        const milliseconds = parseInt(durationMatch[4], 10) * 10;
        duration = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
      }
    };

    this.ffmpeg.on('log', logListener);

    try {
      await this.ffmpeg.exec(['-i', fileName, '-f', 'null', '-']);
    } catch (error) {
      // コマンドはエラーになることがあるが、ログからdurationは取得できているはず
      if (duration === 0) {
        console.error("ffmpeg failed to get duration. Full log:", logOutput);
        // エラーになってもdurationが取れていればOK。取れていない場合は問題。
      }
    } finally {
      this.ffmpeg.off('log', logListener);
    }
    
    return duration;
  }

  /**
   * Blobから音声の長さを取得するヘルパー関数
   */
  private getAudioDurationFromBlob(blob: Blob): Promise<number> {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      const objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        URL.revokeObjectURL(objectUrl);
        resolve(isFinite(duration) ? duration : 0);
      });
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        resolve(0);
      });
    });
  }

  /**
   * ファイル拡張子を取得
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.slice(lastDot + 1) : 'mp3';
  }

  /**
   * ファイル名（拡張子なし）を取得
   */
  private getBaseName(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
  }

  /**
   * メモリ使用量を最適化するためのクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.isLoaded) {
      try {
        // ffmpeg.wasm のメモリをクリーンアップ
        await this.ffmpeg.terminate();
        this.isLoaded = false;
        this.loadingPromise = null;
      } catch (error) {
        console.warn('ffmpeg.wasm クリーンアップエラー:', error);
      }
    }
  }
}

// シングルトンインスタンス
export const audioProcessor = new AudioProcessorService(); 