import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// 大容量ファイルのストリーム処理用ハンドラー
export const setupFileHandler = () => {
  // 大容量ファイルの音声転写処理
  ipcMain.handle('transcribe-large-audio', async (event, filePath: string, options: any) => {
    try {
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error('ファイルが見つかりません');
      }

      // ファイルサイズチェック
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      const maxSize = 3 * 1024 * 1024 * 1024; // 3GB制限

      if (fileSizeInBytes > maxSize) {
        throw new Error('ファイルサイズが制限を超えています（3GB以下）');
      }

      // OpenAI APIにストリーム送信
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      
      // ストリームをBlobに変換
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      const blob = new Blob([fileBuffer]);
      
      formData.append('file', blob, path.basename(filePath));
      formData.append('model', options.model || 'gpt-4o-transcribe');
      formData.append('language', options.language || 'ja');
      
      if (options.responseFormat) {
        formData.append('response_format', options.responseFormat);
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 300000, // 5分タイムアウト
        }
      );

      return response.data;
    } catch (error) {
      console.error('大容量ファイル処理エラー:', error);
      throw error;
    }
  });

  // ファイル情報取得
  ipcMain.handle('get-file-info', async (event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('ファイルが見つかりません');
      }

      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error('ファイル情報取得エラー:', error);
      throw error;
    }
  });

  // 一時ファイルの削除
  ipcMain.handle('cleanup-temp-file', async (event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('一時ファイル削除エラー:', error);
      return false;
    }
  });
}; 