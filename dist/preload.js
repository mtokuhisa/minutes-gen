"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// preload環境用の安全なログ関数（最小限）
const preloadLog = (message, ...args) => {
    try {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Preload] ${message}`, ...args);
        }
    }
    catch (error) {
        // preload環境でログエラーが発生しても処理を続行
    }
};
preloadLog('🔧 preload.ts が実行されました');
// レンダラープロセスに安全にAPIを公開
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // 企業設定ファイルを読み込む関数（IPCを使用）
    getCorporateConfig: () => electron_1.ipcRenderer.invoke('get-corporate-config'),
    // 将来的に必要になる可能性のあるAPI
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
    isElectron: true, // 関数ではなくboolean値として設定
    // ネイティブFFmpeg関連のAPI
    audioProcessor: {
        // 音声処理システムの初期化
        initialize: () => electron_1.ipcRenderer.invoke('audio-processor-initialize'),
        // 大容量音声ファイルの処理
        processFile: (filePath, segmentDuration = 600) => electron_1.ipcRenderer.invoke('audio-processor-process-file', filePath, segmentDuration),
        // 音声の長さを取得
        getAudioDuration: (blobData, blobType) => electron_1.ipcRenderer.invoke('audio-processor-get-duration', blobData, blobType),
        // セグメントファイルを読み込む（メモリ効率化）
        readSegmentFile: (filePath) => electron_1.ipcRenderer.invoke('audio-processor-read-segment-file', filePath),
        // クリーンアップ
        cleanup: () => electron_1.ipcRenderer.invoke('audio-processor-cleanup'),
        // **戦略C: ファイルを安全な一時ファイルとして保存**
        saveFileToTemp: (fileName, arrayBufferData) => electron_1.ipcRenderer.invoke('audio-processor-save-file-to-temp', fileName, arrayBufferData),
        // **戦略C: ファイルパスを使用した処理**
        processFileByPath: (filePath, segmentDuration = 600) => electron_1.ipcRenderer.invoke('audio-processor-process-file-by-path', filePath, segmentDuration),
        // **戦略C: チャンク転送API（大容量ファイル対応）**
        startChunkedUpload: (fileName, fileSize) => electron_1.ipcRenderer.invoke('audio-processor-start-chunked-upload', fileName, fileSize),
        uploadChunk: (sessionId, chunkIndex, chunkBuffer) => electron_1.ipcRenderer.invoke('audio-processor-upload-chunk', sessionId, chunkIndex, chunkBuffer),
        finalizeChunkedUpload: (sessionId) => electron_1.ipcRenderer.invoke('audio-processor-finalize-chunked-upload', sessionId),
        cleanupChunkedUpload: (sessionId) => electron_1.ipcRenderer.invoke('audio-processor-cleanup-chunked-upload', sessionId),
        // 進捗通知の受信
        onProgress: (callback) => {
            electron_1.ipcRenderer.on('audio-processor-progress', (event, progress) => callback(progress));
        },
        // 進捗通知の解除
        offProgress: (callback) => {
            electron_1.ipcRenderer.off('audio-processor-progress', (event, progress) => callback(progress));
        },
    },
});
preloadLog('🔧 contextBridge.exposeInMainWorld が完了しました');
