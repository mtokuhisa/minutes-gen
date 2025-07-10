import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスに安全にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 企業設定ファイルを読み込む関数（IPCを使用）
  getCorporateConfig: () => ipcRenderer.invoke('get-corporate-config'),
  // 将来的に必要になる可能性のあるAPI
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  isElectron: () => true,
}); 