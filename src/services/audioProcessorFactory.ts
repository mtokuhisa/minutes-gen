import { AudioProcessorInterface } from '../types';
import { NativeAudioProcessorService } from './nativeAudioProcessor';

// 環境変数でFFmpegの種類を制御
const USE_NATIVE_FFMPEG = process.env.REACT_APP_USE_NATIVE_FFMPEG !== 'false';

// Electron環境の判定
const isElectronEnvironment = (): boolean => {
  return typeof window !== 'undefined' && 
         window.electronAPI?.audioProcessor !== undefined;
};

/**
 * AudioProcessorServiceのファクトリー
 * 環境に応じて適切なAudioProcessorインスタンスを作成
 */
export class AudioProcessorFactory {
  /**
   * 環境に応じたAudioProcessorインスタンスを作成
   */
  static createAudioProcessor(): AudioProcessorInterface {
    // Electron環境でネイティブFFmpegを使用する場合
    if (isElectronEnvironment() && USE_NATIVE_FFMPEG) {
      return new NativeAudioProcessorService();
    }
    
    // フォールバック: 旧来のFFmpegWasmを使用
    // 段階的移行のため、現在は動的インポートでFFmpegWasmを読み込む
    return createLegacyAudioProcessor();
  }
  
  /**
   * 現在使用中のAudioProcessorの種類を取得
   */
  static getCurrentProcessorType(): 'native' | 'wasm' {
    if (isElectronEnvironment() && USE_NATIVE_FFMPEG) {
      return 'native';
    }
    return 'wasm';
  }
}

/**
 * 旧来のFFmpegWasmを使用するAudioProcessorを作成
 * 段階的移行のため、既存のコードを保持
 */
function createLegacyAudioProcessor(): AudioProcessorInterface {
  // 既存のAudioProcessorServiceを動的にインポート
  // この実装は移行期間中の互換性維持のため
  
  const { AudioProcessorService } = require('./audioProcessor');
  return new AudioProcessorService();
}

// シングルトンインスタンス
let audioProcessorInstance: AudioProcessorInterface | null = null;

/**
 * AudioProcessorのシングルトンインスタンスを取得
 */
export function getAudioProcessor(): AudioProcessorInterface {
  if (!audioProcessorInstance) {
    audioProcessorInstance = AudioProcessorFactory.createAudioProcessor();
  }
  return audioProcessorInstance;
}

/**
 * AudioProcessorインスタンスをリセット
 * テスト時やプロセッサー切り替え時に使用
 */
export function resetAudioProcessor(): void {
  if (audioProcessorInstance) {
    audioProcessorInstance.cleanup().catch(console.error);
    audioProcessorInstance = null;
  }
}

/**
 * AudioProcessorのクリーンアップ
 * アプリケーション終了時に呼び出す
 */
export async function cleanupAudioProcessor(): Promise<void> {
  if (audioProcessorInstance) {
    await audioProcessorInstance.cleanup();
    audioProcessorInstance = null;
  }
} 