"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupFileHandler = void 0;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const safeLogger_1 = require("./safeLogger");
// 大容量ファイルのストリーム処理用ハンドラー
const setupFileHandler = () => {
    // 大容量ファイルの音声転写処理
    electron_1.ipcMain.handle('transcribe-large-audio', async (event, filePath, options) => {
        try {
            // ファイルの存在確認
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error('ファイルが見つかりません');
            }
            // ファイルサイズチェック
            const stats = fs_1.default.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const maxSize = 3 * 1024 * 1024 * 1024; // 3GB制限
            if (fileSizeInBytes > maxSize) {
                throw new Error('ファイルサイズが制限を超えています（3GB以下）');
            }
            // OpenAI APIにストリーム送信
            const formData = new FormData();
            const fileStream = fs_1.default.createReadStream(filePath);
            // ストリームをBlobに変換
            const chunks = [];
            for await (const chunk of fileStream) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);
            const blob = new Blob([fileBuffer]);
            formData.append('file', blob, path_1.default.basename(filePath));
            formData.append('model', options.model || 'gpt-4o-transcribe');
            formData.append('language', options.language || 'ja');
            if (options.responseFormat) {
                formData.append('response_format', options.responseFormat);
            }
            const response = await axios_1.default.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    'Authorization': `Bearer ${options.apiKey}`,
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 300000, // 5分タイムアウト
            });
            return response.data;
        }
        catch (error) {
            (0, safeLogger_1.safeError)('大容量ファイル処理エラー:', error);
            throw error;
        }
    });
    // ファイル情報取得
    electron_1.ipcMain.handle('get-file-info', async (event, filePath) => {
        try {
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error('ファイルが見つかりません');
            }
            const stats = fs_1.default.statSync(filePath);
            return {
                size: stats.size,
                name: path_1.default.basename(filePath),
                extension: path_1.default.extname(filePath),
                lastModified: stats.mtime,
            };
        }
        catch (error) {
            (0, safeLogger_1.safeError)('ファイル情報取得エラー:', error);
            throw error;
        }
    });
    // 一時ファイルの削除
    electron_1.ipcMain.handle('cleanup-temp-file', async (event, filePath) => {
        try {
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
                return true;
            }
            return false;
        }
        catch (error) {
            (0, safeLogger_1.safeError)('一時ファイル削除エラー:', error);
            return false;
        }
    });
};
exports.setupFileHandler = setupFileHandler;
