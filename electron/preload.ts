import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスに安全にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 企業設定ファイルを読み込む関数（IPCを使用）
  getCorporateConfig: () => ipcRenderer.invoke('get-corporate-config'),
  // 将来的に必要になる可能性のあるAPI
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  isElectron: () => true,
  
  // ネイティブFFmpeg関連のAPI
  audioProcessor: {
    // 音声処理システムの初期化
    initialize: () => ipcRenderer.invoke('audio-processor-initialize'),
    
    // 大容量音声ファイルの処理
    processFile: (filePath: string, segmentDuration?: number) => 
      ipcRenderer.invoke('audio-processor-process-file', filePath, segmentDuration),
    
    // 音声の長さを取得
    getDuration: (blobData: string, blobType: string) => 
      ipcRenderer.invoke('audio-processor-get-duration', blobData, blobType),
    
    // クリーンアップ
    cleanup: () => ipcRenderer.invoke('audio-processor-cleanup'),
    
    // 進捗通知の受信
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('audio-processor-progress', (event, progress) => callback(progress));
    },
    
    // 進捗通知の解除
    offProgress: (callback: (progress: any) => void) => {
      ipcRenderer.off('audio-processor-progress', callback);
    },
  },
}); 