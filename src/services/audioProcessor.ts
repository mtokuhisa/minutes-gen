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

export class AudioProcessorService {
  private ffmpeg: FFmpeg;
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private preloadAttempted: boolean = false;

  constructor() {
    // Self-hosted コアファイルを優先的に読み込む（public/ffmpeg-core/dist/umd 下に配置）
    this.ffmpeg = new FFmpeg({
      log: false,
      // ffmpeg-core.js へのフルパスを指定 (マルチスレッド版)
      corePath: '/ffmpeg-core/dist/umd/ffmpeg-core.js',
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
        currentTask: `ffmpeg.wasm を ${sourceName} から読込中...`,
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `${sourceName} からの ffmpeg.wasm の初期化を開始します。` }],
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
          currentTask: 'ffmpeg.wasm ライブラリの初期化完了',
          estimatedTimeRemaining: 0,
          logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: `${sourceName} からの ffmpeg.wasm の初期化が完了しました。` }],
          startedAt: new Date(),
        });
        return true;
      } catch (error) {
        console.warn(`${sourceName}からの読み込みに失敗しました。`, error);
        onProgress?.({
            stage: 'transcribing',
            percentage: 10,
            currentTask: `ffmpeg.wasm (${sourceName}) の読込失敗`,
            estimatedTimeRemaining: 0,
            logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'warning', message: `${sourceName} からの読み込みに失敗しました。次のソースを試行します。` }],
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
    const finalError = new Error('ローカルおよび全てのCDNからのffmpeg.wasmのダウンロードに失敗しました。ネットワーク接続を確認後、再度お試しください。');
    onProgress?.({
        stage: 'error',
        percentage: 100,
        currentTask: '初期化エラー',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'error', message: finalError.message }],
        startedAt: new Date(),
    });
    throw finalError;
  }

  /**
   * 大容量音声ファイルを適切なセグメントに分割
   *
   * @param file - 処理対象の音声ファイル
   * @param segmentDurationSeconds - 各セグメントの目標時間（秒）
   * @param onProgress - 進捗更新コールバック
   * @returns 分割された音声セグメントの配列
   *
   * @description
   * この関数は ffmpeg.wasm を使用して、大容量の音声/動画ファイルを処理可能なチャンクに分割します。
   * 処理は以下の2ステップで行われます:
   * 1. 【正規化】入力ファイルを、コーデックやコンテナ形式に依存しない標準的な音声形式 (16-bit PCM WAV) に変換します。
   *    これにより、後続の処理の安定性が劇的に向上します。
   * 2. 【セグメント化】ffmpeg の強力な `segment` ミキサーを使用し、一度のコマンドで正規化済みWAVファイルを
   *    指定された長さのセグメントに高速かつ正確に分割します。`-c copy` を使用しないことで、
   *    キーフレームの問題を回避し、あらゆるファイル形式で安定した分割を実現します。
   */
  async processLargeAudioFile(
    file: AudioFile,
    segmentDurationSeconds: number = 600, // 10分セグメント
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegment[]> {
    if (!file.rawFile) {
      throw new Error('音声ファイルが見つかりません');
    }

    await this.initialize(onProgress);

    try {
      const inputFileName = 'input.' + this.getFileExtension(file.name);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 20,
        currentTask: '音声ファイルをffmpegにロード中...',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: '入力ファイルを ffmpeg.wasm の仮想ファイルシステムに書き込んでいます...' }],
        startedAt: new Date(),
      });
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file.rawFile));
      
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
      const totalSegments = Math.ceil(duration / segmentDurationSeconds);

      // ==============================================================
      // ステップ2: 正規化とセグメント化を同時に実行
      // ==============================================================
      onProgress?.({
        stage: 'transcribing',
        percentage: 30,
        currentTask: `ファイルを${totalSegments}個のセグメントに分割中...`,
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `音声時間: ${Math.round(duration)}秒、セグメント数: ${totalSegments}。ffmpegで分割と形式変換を同時に開始します。` }],
        startedAt: new Date(),
      });

      const outputPattern = `segment_%03d.wav`;
      
      // -i: 入力, -f segment: セグメント化, -segment_time: 分割時間, -vn: ビデオなし, -acodec...: 音声正規化
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-f', 'segment',
        '-segment_time', segmentDurationSeconds.toString(),
        '-vn', // ビデオストリームを無視
        '-acodec', 'pcm_s16le', // 16bitリトルエンディアンPCM (最も標準的なWAV)
        '-ar', '44100', // サンプルレートを44.1kHzに統一
        '-ac', '1', // チャンネルをモノラルに統一
        '-c:a', 'pcm_s16le', // オーディオコーデックを明示的に指定
        outputPattern
      ]);

      const segments: AudioSegment[] = [];
      const fileList = await this.ffmpeg.listDir('.');
      
      const segmentFiles = fileList
        .filter(f => f.name.startsWith('segment_') && f.name.endsWith('.wav'))
        .sort((a, b) => a.name.localeCompare(b.name));

      if(segmentFiles.length === 0){
        // セグメントが一つも生成されなかった場合、ファイル全体を単一セグメントとして扱う
         onProgress?.({
            stage: 'transcribing',
            percentage: 45,
            currentTask: `ファイルを単一セグメントとして処理中...`,
            estimatedTimeRemaining: 0,
            logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `分割されなかったため、単一ファイルとして変換します。` }],
            startedAt: new Date(),
        });
        const singleOutputName = "segment_000.wav";
        await this.ffmpeg.exec([
          '-i', inputFileName,
          '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1',
          singleOutputName
        ]);
        segmentFiles.push({ name: singleOutputName, is_dir: false, size: 0 }); // sizeは不明
      }
      
      let cumulativeTime = 0;
      for (let i = 0; i < segmentFiles.length; i++) {
        const segmentFile = segmentFiles[i];
        
        onProgress?.({
          stage: 'transcribing',
          percentage: 50 + Math.round((i / segmentFiles.length) * 45),
          currentTask: `セグメント ${i + 1}/${segmentFiles.length} を処理中...`,
          estimatedTimeRemaining: 0,
          logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'info', message: `${segmentFile.name} を読み込んでいます。` }],
          startedAt: new Date(),
        });

        const data = await this.ffmpeg.readFile(segmentFile.name);
        const blob = new Blob([data], { type: 'audio/wav' });
        
        await this.ffmpeg.deleteFile(segmentFile.name);
        
        const segmentDuration = await this.getAudioDurationFromBlob(blob);

        segments.push({
          blob,
          name: segmentFile.name,
          duration: segmentDuration,
          startTime: cumulativeTime,
          endTime: cumulativeTime + segmentDuration,
        });
        cumulativeTime += segmentDuration;
      }
      
      // 元ファイルを削除してメモリ解放
      await this.ffmpeg.deleteFile(inputFileName);

      onProgress?.({
        stage: 'transcribing',
        percentage: 95,
        currentTask: 'セグメント化完了',
        estimatedTimeRemaining: 0,
        logs: [{ id: Date.now().toString(), timestamp: new Date(), level: 'success', message: `合計 ${segments.length} 個のセグメントの準備が完了しました。` }],
        startedAt: new Date(),
      });
      
      return segments;

    } catch (error) {
      console.error('ffmpeg 処理エラー:', error);
      let errorMessage = '音声ファイルの分割処理中にエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = `音声ファイルの分割処理中にエラーが発生しました: ${error.message}`;
      }
      
      onProgress?.({
        stage: 'error',
        percentage: 100,
        currentTask: '処理エラー',
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