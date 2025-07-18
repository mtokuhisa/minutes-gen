// ===========================================
// MinutesGen v0.7.5 - Worker管理システム
// ===========================================

// Node.js固有のモジュールはElectron環境でのみ使用
let spawn: any;
let ChildProcess: any;
let EventEmitter: any;

// Electron環境の判定を改善
const isElectronEnvironment = (): boolean => {
  console.log('🔍 WorkerManager: Electron環境判定を開始');
  
  const hasWindow = typeof window !== 'undefined';
  const hasElectronAPI = hasWindow && window.electronAPI !== undefined;
  const hasAudioProcessor = hasElectronAPI && window.electronAPI.audioProcessor !== undefined;
  const hasElectronUserAgent = hasWindow && typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  
  console.log('🔍 WorkerManager Electron環境判定結果:', {
    hasWindow,
    hasElectronAPI,
    hasAudioProcessor,
    hasElectronUserAgent,
    userAgent: hasWindow ? navigator.userAgent : 'no window'
  });
  
  // requireは不要 - electronAPIとaudioProcessorの存在で判定
  const isElectron = hasElectronAPI && hasAudioProcessor && hasElectronUserAgent;
  
  console.log('🔍 WorkerManager 最終判定:', {
    isElectron,
    reason: !hasElectronAPI ? 'electronAPI不在' : 
            !hasAudioProcessor ? 'audioProcessor不在' : 
            !hasElectronUserAgent ? 'ElectronUserAgent不在' : 'すべて存在'
  });
  
  return isElectron;
};

// Electron環境でのみNode.jsモジュールを動的インポート
if (isElectronEnvironment()) {
  const safeRequire = (mod: string) => {
    try {
      if (typeof (window as any).require === 'function') {
        return (window as any).require(mod);
      }
      // preload から expose されている場合
      if ((window as any).electronAPI?.nodeRequire) {
        return (window as any).electronAPI.nodeRequire(mod);
      }
    } catch (err) {
      console.warn(`safeRequire(${mod}) 失敗:`, err);
    }
    return undefined;
  };

  const childProcess = safeRequire('child_process');
  const events = safeRequire('events');

  if (childProcess) {
    spawn = childProcess.spawn;
    ChildProcess = childProcess.ChildProcess;
  }
  if (events) {
    EventEmitter = events.EventEmitter;
  }
}

import { MemoryEstimation, memoryEstimationService } from './memoryEstimationService';

export interface WorkerConfig {
  memoryLimitMB: number;
  maxRetries: number;
  timeoutMs: number;
  workerType: 'audio' | 'transcription' | 'general';
}

export interface WorkerTask {
  id: string;
  type: 'audio-processing' | 'transcription' | 'file-processing';
  data: any;
  estimatedMemoryMB: number;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}

export interface WorkerResult {
  success: boolean;
  data?: any;
  error?: string;
  memoryUsed?: number;
  processingTime?: number;
}

export class WorkerManager {
  private static instance: WorkerManager;
  private workers: Map<string, any> = new Map();
  private workerConfigs: Map<string, WorkerConfig> = new Map();
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private eventEmitter: any;

  private constructor() {
    // EventEmitterを初期化
    if (EventEmitter) {
      this.eventEmitter = new EventEmitter();
    } else {
      // ブラウザ環境用のシンプルなEventEmitterモック
      this.eventEmitter = {
        on: () => {},
        emit: () => {},
        removeListener: () => {},
      };
    }
    this.setupWorkerTypes();
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Worker種類の初期設定
   */
  private setupWorkerTypes(): void {
    // 音声処理Worker
    this.workerConfigs.set('audio', {
      memoryLimitMB: 1024,
      maxRetries: 3,
      timeoutMs: 300000, // 5分
      workerType: 'audio',
    });

    // 文字起こしWorker
    this.workerConfigs.set('transcription', {
      memoryLimitMB: 1024,
      maxRetries: 3,
      timeoutMs: 600000, // 10分
      workerType: 'transcription',
    });

    // 汎用Worker
    this.workerConfigs.set('general', {
      memoryLimitMB: 1024,
      maxRetries: 2,
      timeoutMs: 120000, // 2分
      workerType: 'general',
    });
  }

  /**
   * タスクを実行
   */
  async executeTask(
    task: WorkerTask,
    fileSize?: number,
    fileName?: string
  ): Promise<WorkerResult> {
    // Electron環境でない場合は、エラーを返す
    if (!isElectronEnvironment()) {
      console.warn('⚠️ Worker管理システムはElectron環境でのみ動作します');
      return {
        success: false,
        error: 'Worker管理システムはElectron環境でのみ動作します',
      };
    }

    // Node.js APIが利用できない場合もエラーを返す
    if (!spawn || !EventEmitter) {
      console.warn('⚠️ Node.js APIが利用できません。Worker管理システムを無効化します。');
      return {
        success: false,
        error: 'Worker管理システムはNode.js APIが必要です',
      };
    }

    try {
      // メモリ推定
      let memoryEstimation: MemoryEstimation | null = null;
      if (fileSize && fileName) {
        memoryEstimation = memoryEstimationService.estimateMemoryUsage(
          fileSize,
          fileName,
          1024 // 現在の基本制限
        );
      }

      // 適切なWorkerを選択・起動
      const workerType = this.determineWorkerType(task.type);
      const workerId = await this.ensureWorker(workerType, memoryEstimation);

      // タスクを実行
      const result = await this.runTask(workerId, task);

      return result;
    } catch (error) {
      console.error('タスク実行エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー',
      };
    }
  }

  /**
   * 適切なWorkerを確保
   */
  private async ensureWorker(
    workerType: string,
    memoryEstimation?: MemoryEstimation | null
  ): Promise<string> {
    const workerId = `${workerType}-${Date.now()}`;
    
    // メモリ制限を決定
    let memoryLimitMB = this.workerConfigs.get(workerType)?.memoryLimitMB || 1024;
    
    if (memoryEstimation && !memoryEstimation.canProcessWithCurrent) {
      // メモリ不足の場合は推奨制限を使用
      memoryLimitMB = memoryEstimationService.getRecommendedMemoryLimit(
        memoryEstimation.requiredMemoryMB
      );
      
      console.log(`🔄 メモリ不足のため、Worker を ${memoryLimitMB}MB で起動します`);
      
      // 進捗通知
      if (this.eventEmitter.emit) {
        this.eventEmitter.emit('worker-restart', {
          workerId,
          reason: 'memory-insufficient',
          newMemoryLimit: memoryLimitMB,
          estimatedMemory: memoryEstimation.requiredMemoryMB,
        });
      }
    }

    // Workerを起動
    await this.startWorker(workerId, workerType, memoryLimitMB);
    
    return workerId;
  }

  /**
   * Workerを起動
   */
  private async startWorker(
    workerId: string,
    workerType: string,
    memoryLimitMB: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const config = this.workerConfigs.get(workerType);
      if (!config) {
        reject(new Error(`未知のWorkerタイプ: ${workerType}`));
        return;
      }

      // Electronプロセスを起動
      const worker = spawn('node', [
        `--max-old-space-size=${memoryLimitMB}`,
        './node_modules/.bin/electron',
        `--max-old-space-size=${memoryLimitMB}`,
        '--expose-gc',
        '.',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          WORKER_TYPE: workerType,
          WORKER_ID: workerId,
          MEMORY_LIMIT: memoryLimitMB.toString(),
        },
      });

      // エラーハンドリング
      worker.on('error', (error: Error) => {
        console.error(`Worker ${workerId} エラー:`, error);
        this.cleanupWorker(workerId);
        reject(error);
      });

      worker.on('exit', (code: number, signal: string) => {
        console.log(`Worker ${workerId} 終了: code=${code}, signal=${signal}`);
        this.cleanupWorker(workerId);
      });

      // 標準出力の監視
      worker.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('WORKER_READY')) {
          console.log(`✅ Worker ${workerId} 準備完了 (${memoryLimitMB}MB)`);
          resolve();
        }
      });

      // 標準エラーの監視
      worker.stderr?.on('data', (data: Buffer) => {
        console.error(`Worker ${workerId} エラー出力:`, data.toString());
      });

      // Workerを登録
      this.workers.set(workerId, worker);
      
      // 更新された設定を保存
      this.workerConfigs.set(workerId, {
        ...config,
        memoryLimitMB,
      });

      // タイムアウト設定
      setTimeout(() => {
        if (this.workers.has(workerId)) {
          reject(new Error(`Worker ${workerId} の起動がタイムアウトしました`));
          this.cleanupWorker(workerId);
        }
      }, 30000); // 30秒タイムアウト
    });
  }

  /**
   * タスクを実行
   */
  private async runTask(workerId: string, task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const worker = this.workers.get(workerId);
      if (!worker) {
        reject(new Error(`Worker ${workerId} が見つかりません`));
        return;
      }

      const config = this.workerConfigs.get(workerId);
      const timeoutMs = task.timeout || config?.timeoutMs || 300000;

      const startTime = Date.now();
      let resolved = false;

      // タイムアウト処理
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`タスク ${task.id} がタイムアウトしました`));
          this.cleanupWorker(workerId);
        }
      }, timeoutMs);

      // レスポンス監視
      const onData = (data: Buffer) => {
        if (resolved) return;
        
        try {
          const response = JSON.parse(data.toString());
          if (response.taskId === task.id) {
            resolved = true;
            clearTimeout(timeout);
            
            const processingTime = Date.now() - startTime;
            
            resolve({
              success: response.success,
              data: response.data,
              error: response.error,
              memoryUsed: response.memoryUsed,
              processingTime,
            });
          }
        } catch (error) {
          console.error('Worker レスポンス解析エラー:', error);
        }
      };

      worker.stdout?.on('data', onData);

      // タスクを送信
      const taskMessage = JSON.stringify({
        taskId: task.id,
        type: task.type,
        data: task.data,
        priority: task.priority,
      });

      worker.stdin?.write(taskMessage + '\n');
      this.activeTasks.set(task.id, task);
    });
  }

  /**
   * Workerタイプを決定
   */
  private determineWorkerType(taskType: string): string {
    switch (taskType) {
      case 'audio-processing':
        return 'audio';
      case 'transcription':
        return 'transcription';
      default:
        return 'general';
    }
  }

  /**
   * Workerをクリーンアップ
   */
  private cleanupWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.kill();
      this.workers.delete(workerId);
    }
    this.workerConfigs.delete(workerId);
  }

  /**
   * 全Workerをクリーンアップ
   */
  cleanup(): void {
    for (const [workerId] of this.workers) {
      this.cleanupWorker(workerId);
    }
    this.taskQueue = [];
    this.activeTasks.clear();
  }

  /**
   * Worker状態を取得
   */
  getWorkerStatus(): {
    active: number;
    total: number;
    tasks: number;
    memory: { workerId: string; limitMB: number }[];
  } {
    const memoryInfo = Array.from(this.workerConfigs.entries()).map(([workerId, config]) => ({
      workerId,
      limitMB: config.memoryLimitMB,
    }));

    return {
      active: this.workers.size,
      total: this.workerConfigs.size,
      tasks: this.activeTasks.size,
      memory: memoryInfo,
    };
  }

  /**
   * イベントリスナーを追加
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (this.eventEmitter.on) {
      this.eventEmitter.on(event, listener);
    }
  }

  /**
   * イベントを発行
   */
  emit(event: string, ...args: any[]): void {
    if (this.eventEmitter.emit) {
      this.eventEmitter.emit(event, ...args);
    }
  }
}

// シングルトンインスタンス
export const workerManager = WorkerManager.getInstance(); 