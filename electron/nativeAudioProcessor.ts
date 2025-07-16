import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
const ffprobeStatic = require('ffprobe-static');
const ffprobePath = ffprobeStatic.path;
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';

// 型定義
interface AudioSegment {
  blob: Blob;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

interface AudioSegmentPath {
  filePath: string;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

interface SegmentBoundary {
  start: number;
  end: number;
  overlapStart?: number;
  overlapEnd?: number;
}

interface ProcessingProgress {
  stage: 'transcribing' | 'error';
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number;
  logs: LogEntry[];
  startedAt: Date;
  processingDetails?: {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export class NativeAudioProcessor {
  private tempDir: string;
  private isInitialized: boolean = false;
  private readonly MAX_SEGMENT_SIZE = 15 * 1024 * 1024; // 15MBに戻す
  private readonly OVERLAP_SECONDS = 5; // 5秒のオーバーラップ

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'minutes-gen-audio');
    console.log('🎵 NativeAudioProcessor constructor', { tempDir: this.tempDir });
  }

  /**
   * ネイティブFFmpegを初期化
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    console.log('🚀 NativeAudioProcessor.initialize() 開始');
    
    if (this.isInitialized) {
      console.log('✅ 既に初期化済み');
      return;
    }

    onProgress?.({
      stage: 'transcribing',
      percentage: 5,
      currentTask: '🎵 音声処理システムを準備中...',
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'info', 
        message: 'ネイティブ音声処理システムの初期化を開始します。' 
      }],
      startedAt: new Date(),
    });

    try {
      // 一時ディレクトリの作成
      console.log('📁 一時ディレクトリ作成:', this.tempDir);
      await fs.promises.mkdir(this.tempDir, { recursive: true });
      
      // FFmpegパスの設定（パッケージ化対応）
      let resolvedFFmpegPath = ffmpegPath;
      let resolvedFFprobePath = ffprobePath;
      
      if (ffmpegPath) {
        console.log('🔧 初期FFmpegパス:', ffmpegPath);
        console.log('🔧 初期FFprobeパス:', ffprobePath);
        
        // パッケージ化されたアプリケーションでのパス解決
        if (app.isPackaged) {
          // app.asar.unpacked内のパスを確認
          const unpackedFFmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
          const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
          
          console.log('📦 パッケージ化されたアプリ - unpackedFFmpegパス確認:', unpackedFFmpegPath);
          console.log('📦 パッケージ化されたアプリ - unpackedFFprobeパス確認:', unpackedFFprobePath);
          
          try {
            await fs.promises.access(unpackedFFmpegPath, fs.constants.F_OK);
            resolvedFFmpegPath = unpackedFFmpegPath;
            console.log('✅ unpackedパスでFFmpegバイナリを発見');
          } catch (error) {
            console.log('❌ unpackedパスでFFmpegバイナリが見つかりません:', error);
            
            // 代替パスを試行
            const appPath = app.getAppPath();
            const alternativeFFmpegPath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', process.platform === 'darwin' ? 'ffmpeg' : 'ffmpeg.exe');
            console.log('🔄 代替FFmpegパスを試行:', alternativeFFmpegPath);
            
            try {
              await fs.promises.access(alternativeFFmpegPath, fs.constants.F_OK);
              resolvedFFmpegPath = alternativeFFmpegPath;
              console.log('✅ 代替パスでFFmpegバイナリを発見');
            } catch (altError) {
              console.error('❌ 代替パスでもFFmpegバイナリが見つかりません:', altError);
              throw new Error(`FFmpegバイナリが見つかりません。パス: ${ffmpegPath}, unpacked: ${unpackedFFmpegPath}, alternative: ${alternativeFFmpegPath}`);
            }
          }
          
          try {
            await fs.promises.access(unpackedFFprobePath, fs.constants.F_OK);
            resolvedFFprobePath = unpackedFFprobePath;
            console.log('✅ unpackedパスでFFprobeバイナリを発見');
          } catch (error) {
            console.log('❌ unpackedパスでFFprobeバイナリが見つかりません:', error);
            
            // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
            const appPath = app.getAppPath();
            const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
            
            let alternativeFFprobePaths: string[] = [];
            if (process.platform === 'darwin') {
              alternativeFFprobePaths = [
                path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
                path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
                path.join(ffprobeBasePath, 'ffprobe'),
              ];
            } else if (process.platform === 'win32') {
              alternativeFFprobePaths = [
                path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
                path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
                path.join(ffprobeBasePath, 'ffprobe.exe'),
              ];
            }
            
            let ffprobeFound = false;
            for (const altPath of alternativeFFprobePaths) {
              console.log('🔄 代替FFprobeパスを試行:', altPath);
              try {
                await fs.promises.access(altPath, fs.constants.F_OK);
                resolvedFFprobePath = altPath;
                console.log('✅ 代替パスでFFprobeバイナリを発見');
                ffprobeFound = true;
                break;
              } catch (altError) {
                console.log('❌ 代替パスでFFprobeバイナリが見つかりません:', altPath);
              }
            }
            
            if (!ffprobeFound) {
              console.error('❌ 全ての代替パスでFFprobeバイナリが見つかりません');
              throw new Error(`FFprobeバイナリが見つかりません。パス: ${ffprobePath}, unpacked: ${unpackedFFprobePath}, alternatives: ${alternativeFFprobePaths.join(', ')}`);
            }
          }
        } else {
          // 開発環境での確認
          try {
            await fs.promises.access(ffmpegPath, fs.constants.F_OK);
            await fs.promises.access(ffprobePath, fs.constants.F_OK);
            console.log('✅ 開発環境でFFmpeg/FFprobeバイナリを確認');
          } catch (error) {
            console.error('❌ 開発環境でFFmpeg/FFprobeバイナリが見つかりません:', error);
            throw new Error(`FFmpeg/FFprobeバイナリが見つかりません: ffmpeg=${ffmpegPath}, ffprobe=${ffprobePath}`);
          }
        }
        
        console.log('🔧 最終的なFFmpegパス:', resolvedFFmpegPath);
        console.log('🔧 最終的なFFprobeパス:', resolvedFFprobePath);
        
        if (resolvedFFmpegPath) {
          ffmpeg.setFfmpegPath(resolvedFFmpegPath);
        } else {
          throw new Error('FFmpegパスが解決できませんでした');
        }
        
        if (resolvedFFprobePath) {
          ffmpeg.setFfprobePath(resolvedFFprobePath);
        } else {
          throw new Error('FFprobeパスが解決できませんでした');
        }
      } else {
        throw new Error('FFmpegの実行ファイルが見つかりません');
      }
      
      // FFmpegの動作確認（簡素化版）
      console.log('🔍 FFmpeg動作確認開始');
      await this.testFFmpeg();
      console.log('✅ FFmpeg動作確認完了');
      
      this.isInitialized = true;
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 15,
        currentTask: '✅ 音声処理システムの準備完了',
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'success', 
          message: 'ネイティブ音声処理システムの初期化が完了しました。' 
        }],
        startedAt: new Date(),
      });
      
    } catch (error) {
      console.error('❌ NativeAudioProcessor初期化エラー:', error);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 0,
        currentTask: '❌ 音声処理システムの初期化に失敗',
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'error', 
          message: `音声処理システムの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}` 
        }],
        startedAt: new Date(),
      });
      
      throw error;
    }
  }

  /**
   * FFmpegの動作確認（簡素化版）
   */
  private async testFFmpeg(): Promise<void> {
    console.log('🔍 FFmpeg動作確認を開始');
    
    // FFmpegPathの存在確認
    if (!ffmpegPath) {
      throw new Error('FFmpegの実行ファイルが見つかりません');
    }
    
    console.log('✅ FFmpegパス確認完了:', ffmpegPath);
    
    // パッケージ化されたアプリケーションでのパス解決
    let testPath = ffmpegPath;
    if (app.isPackaged) {
      const unpackedPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpackedPath)) {
        testPath = unpackedPath;
      }
    }
    
    // ファイルの存在と実行権限を確認
    try {
      await fs.promises.access(testPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log('✅ FFmpegバイナリアクセス確認完了:', testPath);
    } catch (error) {
      console.error('❌ FFmpegバイナリアクセスエラー:', error);
      throw new Error(`FFmpegバイナリにアクセスできません: ${testPath}`);
    }
    
    // 簡単なバージョンチェック
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      const ffmpegProcess = spawn(testPath, ['-version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      ffmpegProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      ffmpegProcess.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('✅ FFmpegバージョン確認成功');
          console.log('📋 FFmpeg情報:', stdout.split('\n')[0]);
          resolve();
        } else {
          console.error('❌ FFmpegバージョン確認失敗:', stderr);
          reject(new Error(`FFmpegバージョン確認失敗: ${stderr}`));
        }
      });
      
      ffmpegProcess.on('error', (error: Error) => {
        console.error('❌ FFmpegプロセス起動エラー:', error);
        reject(error);
      });
      
      // タイムアウトを設定（10秒）
      const timeout = setTimeout(() => {
        ffmpegProcess.kill('SIGTERM');
        console.log('⏰ FFmpegテストタイムアウト');
        reject(new Error('FFmpegテストがタイムアウトしました'));
      }, 10000);
      
      ffmpegProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * 大容量音声ファイルを適切なセグメントに分割
   */
  async processLargeAudioFile(
    inputPath: string,
    segmentDurationSeconds: number = 600,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AudioSegmentPath[]> {
    await this.initialize(onProgress);

    try {
      // fluent-ffmpegライブラリに確実にFFmpegパスを設定
      let resolvedFFmpegPath = ffmpegPath;
      if (app.isPackaged && ffmpegPath) {
        const unpackedPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpackedPath)) {
          resolvedFFmpegPath = unpackedPath;
        }
      }
      
      if (resolvedFFmpegPath) {
        console.log('🔧 processLargeAudioFileでFFmpegパスを設定:', resolvedFFmpegPath);
        ffmpeg.setFfmpegPath(resolvedFFmpegPath);
      }
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 20,
        currentTask: '📊 音声ファイルを分析中...',
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'info', 
          message: '音声ファイルを分析中...' 
        }],
        startedAt: new Date(),
      });

      console.log('🎵 音声ファイル分析開始:', inputPath);
      
      // 音声ファイルのメタデータを取得
      const audioInfo = await this.getAudioInfo(inputPath);
      console.log('📋 音声ファイル情報:', audioInfo);
      
      const totalDuration = audioInfo.duration;
      const segmentCount = Math.ceil(totalDuration / segmentDurationSeconds);
      
      console.log(`🔢 総再生時間: ${totalDuration}秒, セグメント数: ${segmentCount}`);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 30,
        currentTask: `📊 ${segmentCount}個のセグメントに分割中...`,
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'info', 
          message: `音声ファイルを${segmentCount}個のセグメントに分割します。` 
        }],
        startedAt: new Date(),
      });

      // セグメント生成
      const audioSegments: AudioSegmentPath[] = [];
      
      for (let i = 0; i < segmentCount; i++) {
        const startTime = i * segmentDurationSeconds;
        const endTime = Math.min((i + 1) * segmentDurationSeconds, totalDuration);
        const actualDuration = endTime - startTime;
        
        if (actualDuration <= 0) {
          console.warn(`⚠️ セグメント ${i + 1} の再生時間が0以下です。スキップします。`);
          continue;
        }
        
        const segmentFileName = `segment_${i + 1}_${Date.now()}.wav`;
        const segmentPath = path.join(this.tempDir, segmentFileName);
        
        console.log(`🎵 セグメント ${i + 1}/${segmentCount} 生成中: ${startTime}s - ${endTime}s`);
        
        // 進捗更新
        const segmentProgress = 30 + (i / segmentCount) * 40;
        onProgress?.({
          stage: 'transcribing',
          percentage: segmentProgress,
          currentTask: `🎵 大きいファイルを分割中...${i + 1}/${segmentCount}`,
          estimatedTimeRemaining: ((segmentCount - i) * 2),
          logs: [{ 
            id: Date.now().toString(), 
            timestamp: new Date(), 
            level: 'info', 
            message: `セグメント ${i + 1}/${segmentCount} を生成しています...` 
          }],
          startedAt: new Date(),
        });
        
        // セグメントの生成
        await this.extractAudioSegment(inputPath, segmentPath, startTime, actualDuration);
        
        audioSegments.push({
          filePath: segmentPath,
          name: segmentFileName,
          duration: actualDuration,
          startTime: startTime,
          endTime: endTime
        });
        
        console.log(`✅ セグメント ${i + 1} 完了: ${segmentPath}`);
      }
      
      console.log(`🎉 音声分割完了: ${audioSegments.length}個のセグメント`);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 70,
        currentTask: '✅ 音声分割完了',
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'success', 
          message: `音声ファイルを${audioSegments.length}個のセグメントに分割しました。` 
        }],
        startedAt: new Date(),
      });
      
      return audioSegments;
      
    } catch (error) {
      console.error('❌ 大容量音声ファイル処理エラー:', error);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 0,
        currentTask: '❌ 音声処理エラー',
        estimatedTimeRemaining: 0,
        logs: [{ 
          id: Date.now().toString(), 
          timestamp: new Date(), 
          level: 'error', 
          message: `音声処理でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` 
        }],
        startedAt: new Date(),
      });
      
      throw error;
    }
  }

  /**
   * 音声を圧縮
   */
  private async compressAudio(inputPath: string, onProgress?: (progress: ProcessingProgress) => void): Promise<string> {
    const outputPath = path.join(this.tempDir, 'compressed_audio.mp3');
    
    onProgress?.({
      stage: 'transcribing',
      percentage: 30,
      currentTask: '🗜️ 音声を圧縮中...',
      estimatedTimeRemaining: 0,
      logs: [{ 
        id: Date.now().toString(), 
        timestamp: new Date(), 
        level: 'info', 
        message: '音声圧縮を開始します...' 
      }],
      startedAt: new Date(),
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')  // 正しいMP3エンコーダー指定
        .audioBitrate('128k')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('mp3')      // MP3ファイルとして出力
        .output(outputPath)
        .on('progress', (progressData) => {
          // FFmpegの詳細な進捗情報を取得
          const currentPercent = Math.min(35, 30 + Math.round((progressData.percent || 0) * 0.1));
          
          onProgress?.({
            stage: 'transcribing',
            percentage: currentPercent,
            currentTask: '🗜️ 音声を圧縮中...',
            estimatedTimeRemaining: 0,
            logs: [{ 
              id: Date.now().toString(), 
              timestamp: new Date(), 
              level: 'info', 
              message: `音声圧縮: ${progressData.timemark || '不明'} 処理済み (${progressData.currentFps?.toFixed(1) || '不明'}fps, ${progressData.currentKbps?.toFixed(0) || '不明'}kbps)` 
            }],
            startedAt: new Date(),
            processingDetails: {
              frames: progressData.frames || 0,
              currentFps: progressData.currentFps || 0,
              currentKbps: progressData.currentKbps || 0,
              targetSize: progressData.targetSize || 0,
              timemark: progressData.timemark || '0:00:00.00'
            }
          });
        })
        .on('end', () => {
          onProgress?.({
            stage: 'transcribing',
            percentage: 40,
            currentTask: '🗜️ 音声圧縮完了',
            estimatedTimeRemaining: 0,
            logs: [{ 
              id: Date.now().toString(), 
              timestamp: new Date(), 
              level: 'success', 
              message: '音声圧縮が完了しました。' 
            }],
            startedAt: new Date(),
          });
          resolve(outputPath);
        })
        .on('error', (error: Error) => {
          reject(new Error(`音声圧縮エラー: ${error.message}`));
        })
        .run();
    });
  }

  /**
   * 音声ファイルの情報を取得
   */
  private async getAudioInfo(filePath: string): Promise<{duration: number, format: any}> {
    // FFmpeg/FFprobeパスを確実に設定
    let resolvedFFmpegPath = ffmpegPath;
    let resolvedFFprobePath = ffprobePath;
    
    if (app.isPackaged && ffmpegPath && ffprobePath) {
      const unpackedFFmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
      const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
      
      if (fs.existsSync(unpackedFFmpegPath)) {
        resolvedFFmpegPath = unpackedFFmpegPath;
      }
      
      if (fs.existsSync(unpackedFFprobePath)) {
        resolvedFFprobePath = unpackedFFprobePath;
      } else {
        // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
        const appPath = app.getAppPath();
        const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
        
        let alternativeFFprobePaths: string[] = [];
        if (process.platform === 'darwin') {
          alternativeFFprobePaths = [
            path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
            path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
            path.join(ffprobeBasePath, 'ffprobe'),
          ];
        } else if (process.platform === 'win32') {
          alternativeFFprobePaths = [
            path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
            path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
            path.join(ffprobeBasePath, 'ffprobe.exe'),
          ];
        }
        
        for (const altPath of alternativeFFprobePaths) {
          if (fs.existsSync(altPath)) {
            resolvedFFprobePath = altPath;
            break;
          }
        }
      }
    }
    
    if (resolvedFFmpegPath) {
      ffmpeg.setFfmpegPath(resolvedFFmpegPath);
    }
    if (resolvedFFprobePath) {
      ffmpeg.setFfprobePath(resolvedFFprobePath);
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`音声情報取得エラー: ${err.message}`));
        } else {
          resolve({
            duration: metadata.format.duration || 0,
            format: metadata.format
          });
        }
      });
    });
  }

  /**
   * 音声セグメントを抽出
   */
  private async extractAudioSegment(inputPath: string, outputPath: string, startTime: number, duration: number): Promise<void> {
    // FFmpeg/FFprobeパスを確実に設定
    let resolvedFFmpegPath = ffmpegPath;
    let resolvedFFprobePath = ffprobePath;
    
    if (app.isPackaged && ffmpegPath && ffprobePath) {
      const unpackedFFmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
      const unpackedFFprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
      
      if (fs.existsSync(unpackedFFmpegPath)) {
        resolvedFFmpegPath = unpackedFFmpegPath;
      }
      
      if (fs.existsSync(unpackedFFprobePath)) {
        resolvedFFprobePath = unpackedFFprobePath;
      } else {
        // 代替パスを試行（ffprobe-staticの実際の構造に基づく）
        const appPath = app.getAppPath();
        const ffprobeBasePath = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
        
        let alternativeFFprobePaths: string[] = [];
        if (process.platform === 'darwin') {
          alternativeFFprobePaths = [
            path.join(ffprobeBasePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
            path.join(ffprobeBasePath, 'bin', 'darwin', 'x64', 'ffprobe'),
            path.join(ffprobeBasePath, 'ffprobe'),
          ];
        } else if (process.platform === 'win32') {
          alternativeFFprobePaths = [
            path.join(ffprobeBasePath, 'bin', 'win32', 'x64', 'ffprobe.exe'),
            path.join(ffprobeBasePath, 'bin', 'win32', 'ia32', 'ffprobe.exe'),
            path.join(ffprobeBasePath, 'ffprobe.exe'),
          ];
        }
        
        for (const altPath of alternativeFFprobePaths) {
          if (fs.existsSync(altPath)) {
            resolvedFFprobePath = altPath;
            break;
          }
        }
      }
    }
    
    if (resolvedFFmpegPath) {
      ffmpeg.setFfmpegPath(resolvedFFmpegPath);
    }
    if (resolvedFFprobePath) {
      ffmpeg.setFfprobePath(resolvedFFprobePath);
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ セグメント抽出完了: ${outputPath}`);
          resolve();
        })
        .on('error', (error: Error) => {
          console.error(`❌ セグメント抽出エラー: ${error.message}`);
          reject(new Error(`セグメント抽出エラー: ${error.message}`));
        })
        .run();
    });
  }

  /**
   * 音声の長さを取得
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`音声長さ取得エラー: ${err.message}`));
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  /**
   * セグメント境界を計算
   */
  private calculateSegments(totalDuration: number, segmentDuration: number): SegmentBoundary[] {
    const segments: SegmentBoundary[] = [];
    let currentStart = 0;

    while (currentStart < totalDuration) {
      const currentEnd = Math.min(currentStart + segmentDuration, totalDuration);
      
      segments.push({
        start: currentStart,
        end: currentEnd,
        overlapStart: currentStart > 0 ? currentStart - this.OVERLAP_SECONDS : currentStart,
        overlapEnd: currentEnd < totalDuration ? currentEnd + this.OVERLAP_SECONDS : currentEnd,
      });

      currentStart = currentEnd;
    }

    return segments;
  }

  /**
   * セグメントを抽出
   */
  private async extractSegment(inputPath: string, outputPath: string, segment: SegmentBoundary, onProgress?: (progress: ProcessingProgress) => void, currentSegmentIndex: number = 0, totalSegments: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(segment.start)
        .duration(segment.end - segment.start)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (error: Error) => reject(new Error(`セグメント抽出エラー: ${error.message}`)))
        .on('progress', (progressData) => {
          // FFmpegの詳細な進捗情報を取得
          const currentPercent = Math.min(35, 30 + Math.round((progressData.percent || 0) * 0.1));
          
          onProgress?.({
            stage: 'transcribing',
            percentage: currentPercent,
            currentTask: `✂️ 音声を${totalSegments}個に分割中 (${currentSegmentIndex}/${totalSegments})`,
            estimatedTimeRemaining: 0,
            logs: [{ 
              id: Date.now().toString(), 
              timestamp: new Date(), 
              level: 'info', 
              message: `セグメント ${currentSegmentIndex}: ${progressData.timemark || '不明'} 処理済み (${progressData.currentFps?.toFixed(1) || '不明'}fps, ${progressData.currentKbps?.toFixed(0) || '不明'}kbps)` 
            }],
            startedAt: new Date(),
            processingDetails: {
              frames: progressData.frames || 0,
              currentFps: progressData.currentFps || 0,
              currentKbps: progressData.currentKbps || 0,
              targetSize: progressData.targetSize || 0,
              timemark: progressData.timemark || '0:00:00.00'
            }
          });
        })
        .run();
    });
  }

  /**
   * BlobからAudioを作成して長さを取得
   */
  async getAudioDurationFromBlob(blob: Blob): Promise<number> {
    // Main processでは直接的なBlob処理は困難なため、
    // 一時ファイルを通して処理する
    const tempPath = path.join(this.tempDir, 'temp_audio_' + Date.now());
    const buffer = Buffer.from(await blob.arrayBuffer());
    await fs.promises.writeFile(tempPath, buffer);
    
    try {
      const duration = await this.getAudioDuration(tempPath);
      await fs.promises.unlink(tempPath);
      return duration;
    } catch (error) {
      await fs.promises.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        await fs.promises.rmdir(this.tempDir, { recursive: true });
      }
      this.isInitialized = false;
      
      // 強制的にガベージコレクションを実行
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('ネイティブ音声処理システムクリーンアップエラー:', error);
    }
  }
} 