import { contextBridge, ipcRenderer } from 'electron';

// preload環境用の安全なログ関数（最小限）
const preloadLog = (message: string, ...args: any[]) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Preload] ${message}`, ...args);
    }
  } catch (error) {
    // preload環境でログエラーが発生しても処理を続行
  }
};

preloadLog('🔧 preload.ts が実行されました');

// レンダラープロセスに安全にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 企業設定ファイルを読み込む関数（IPCを使用）
  getCorporateConfig: () => ipcRenderer.invoke('get-corporate-config'),
  // 将来的に必要になる可能性のあるAPI
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  isElectron: true, // 関数ではなくboolean値として設定
  
  // ネイティブFFmpeg関連のAPI
  audioProcessor: {
    // 音声処理システムの初期化
    initialize: () => ipcRenderer.invoke('audio-processor-initialize'),
    
    // 大容量音声ファイルの処理
    processFile: (filePath: string, segmentDuration: number = 600) => 
      ipcRenderer.invoke('audio-processor-process-file', filePath, segmentDuration),
    
    // 音声の長さを取得
    getAudioDuration: (blobData: string, blobType: string) => 
      ipcRenderer.invoke('audio-processor-get-duration', blobData, blobType),
    
    // セグメントファイルを読み込む（メモリ効率化）
    readSegmentFile: (filePath: string) => 
      ipcRenderer.invoke('audio-processor-read-segment-file', filePath),
    
    // クリーンアップ
    cleanup: () => ipcRenderer.invoke('audio-processor-cleanup'),
    
    // **戦略C: ファイルを安全な一時ファイルとして保存**
    saveFileToTemp: (fileName: string, arrayBufferData: ArrayBuffer) =>
      ipcRenderer.invoke('audio-processor-save-file-to-temp', fileName, arrayBufferData),
    
    // **戦略C: ファイルパスを使用した処理**
    processFileByPath: (filePath: string, segmentDuration: number = 600) =>
      ipcRenderer.invoke('audio-processor-process-file-by-path', filePath, segmentDuration),
    
    // **戦略C: チャンク転送API（大容量ファイル対応）**
    startChunkedUpload: (fileName: string, fileSize: number) =>
      ipcRenderer.invoke('audio-processor-start-chunked-upload', fileName, fileSize),
    
    uploadChunk: (sessionId: string, chunkIndex: number, chunkBuffer: ArrayBuffer) =>
      ipcRenderer.invoke('audio-processor-upload-chunk', sessionId, chunkIndex, chunkBuffer),
    
    finalizeChunkedUpload: (sessionId: string) =>
      ipcRenderer.invoke('audio-processor-finalize-chunked-upload', sessionId),
    
    cleanupChunkedUpload: (sessionId: string) =>
      ipcRenderer.invoke('audio-processor-cleanup-chunked-upload', sessionId),
    
    // 進捗通知の受信
    onProgress: (callback: (progress: string) => void) => {
      ipcRenderer.on('audio-processor-progress', (event, progress) => callback(progress));
    },
    
    // 進捗通知の解除
    offProgress: (callback: (progress: string) => void) => {
      ipcRenderer.off('audio-processor-progress', (event, progress) => callback(progress));
    },
  },
}); 

preloadLog('🔧 contextBridge.exposeInMainWorld が完了しました'); 