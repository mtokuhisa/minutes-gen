"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// レンダラープロセスに安全にAPIを公開
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // 企業設定ファイルを読み込む関数（IPCを使用）
    getCorporateConfig: () => electron_1.ipcRenderer.invoke('get-corporate-config'),
    // 将来的に必要になる可能性のあるAPI
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
    isElectron: () => true,
    // ネイティブFFmpeg関連のAPI
    audioProcessor: {
        // 音声処理システムの初期化
        initialize: () => electron_1.ipcRenderer.invoke('audio-processor-initialize'),
        // 大容量音声ファイルの処理
        processFile: (filePath, segmentDuration) => electron_1.ipcRenderer.invoke('audio-processor-process-file', filePath, segmentDuration),
        // 音声の長さを取得
        getDuration: (blobData, blobType) => electron_1.ipcRenderer.invoke('audio-processor-get-duration', blobData, blobType),
        // クリーンアップ
        cleanup: () => electron_1.ipcRenderer.invoke('audio-processor-cleanup'),
        // 進捗通知の受信
        onProgress: (callback) => {
            electron_1.ipcRenderer.on('audio-processor-progress', (event, progress) => callback(progress));
        },
        // 進捗通知の解除
        offProgress: (callback) => {
            electron_1.ipcRenderer.off('audio-processor-progress', callback);
        },
    },
});
