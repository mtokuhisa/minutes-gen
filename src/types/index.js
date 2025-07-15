"use strict";
// ===========================================
// MinutesGen v1.0 - TypeScript型定義システム
// ===========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_APP_CONFIG = exports.DEFAULT_PROCESSING_OPTIONS = void 0;
// デフォルト値のエクスポート
exports.DEFAULT_PROCESSING_OPTIONS = {
    language: 'ja',
    punctuation: true,
    timestamps: false,
    minutesModel: 'gpt-4.1',
    selectedPrompt: null,
    promptType: 'preset',
};
exports.DEFAULT_APP_CONFIG = {
    maxFileSize: 3 * 1024 * 1024 * 1024, // 3GB
    supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'mp4', 'mov', 'avi', 'docx', 'txt', 'md', 'pdf'],
    apiEndpoint: '/api/v1',
    retryAttempts: 3,
    timeoutDuration: 300000, // 5分
};
