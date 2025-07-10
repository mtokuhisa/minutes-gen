// ===========================================
// MinutesGen v1.0 - ファイル処理サービス（認証統合）
// ===========================================

import { FileProcessingResult } from '../types/infographic';
import { AuthService } from './authService';

export class FileProcessor {
  private authService: AuthService;

  constructor() {
    this.authService = AuthService.getInstance();
  }

  /**
   * 認証状態を確認
   */
  private async ensureAuthenticated(): Promise<string> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('認証が必要です。初回セットアップを完了してください。');
    }

    const apiKey = await this.authService.getApiKey();
    if (!apiKey) {
      throw new Error('API KEYが取得できませんでした。認証を確認してください。');
    }

    return apiKey;
  }

  /**
   * 認証エラーを処理
   */
  private handleAuthError(response: Response): void {
    if (response.status === 401) {
      this.authService.clearApiKeyFromMemory();
      throw new Error('認証に失敗しました。再度ログインしてください。');
    }
  }

  /**
   * PDFファイルの処理
   */
  async processPDF(file: File): Promise<FileProcessingResult> {
    try {
      const apiKey = await this.ensureAuthenticated();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'gpt-4o');
      formData.append('purpose', 'document-extraction');

      // PDFからテキスト抽出（OpenAI APIを使用）
      const response = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        this.handleAuthError(response);
        throw new Error(`PDF処理エラー: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        content: result.content || 'PDFの内容を抽出できませんでした。',
        type: 'pdf',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('PDF処理エラー:', error);
      return {
        content: `PDFファイル「${file.name}」の処理中にエラーが発生しました。`,
        type: 'pdf',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    }
  }

  /**
   * Office系ファイルの処理（Word、Excel、PowerPoint）
   */
  async processOfficeFile(file: File): Promise<FileProcessingResult> {
    try {
      const apiKey = await this.ensureAuthenticated();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'gpt-4o');

      // Office文書からテキスト抽出
      const response = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        this.handleAuthError(response);
        throw new Error(`Office文書処理エラー: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        content: result.content || 'Office文書の内容を抽出できませんでした。',
        type: 'office',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Office文書処理エラー:', error);
      return {
        content: `Office文書「${file.name}」の処理中にエラーが発生しました。`,
        type: 'office',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    }
  }

  /**
   * 画像ファイルの処理（OCR）
   */
  async processImage(file: File): Promise<FileProcessingResult> {
    try {
      const apiKey = await this.ensureAuthenticated();
      
      // 画像をBase64に変換
      const base64Image = await this.fileToBase64(file);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '画像内のテキストを正確に読み取り、構造化して出力してください。表やリストがある場合は、その構造も保持してください。',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        this.handleAuthError(response);
        throw new Error(`画像処理エラー: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        content: result.choices[0]?.message?.content || '画像からテキストを抽出できませんでした。',
        type: 'image',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('画像処理エラー:', error);
      return {
        content: `画像ファイル「${file.name}」の処理中にエラーが発生しました。`,
        type: 'image',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    }
  }

  /**
   * テキストファイルの処理
   */
  async processTextFile(file: File): Promise<FileProcessingResult> {
    try {
      const text = await file.text();
      
      return {
        content: text,
        type: 'text',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('テキストファイル処理エラー:', error);
      return {
        content: `テキストファイル「${file.name}」の処理中にエラーが発生しました。`,
        type: 'text',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date(),
        },
      };
    }
  }

  /**
   * 複数ファイルの統合処理
   */
  async processAttachments(files: File[]): Promise<string> {
    if (!files || files.length === 0) {
      return '';
    }

    const results: FileProcessingResult[] = [];
    
    for (const file of files) {
      const fileType = this.getFileType(file);
      let result: FileProcessingResult;

      switch (fileType) {
        case 'pdf':
          result = await this.processPDF(file);
          break;
        case 'office':
          result = await this.processOfficeFile(file);
          break;
        case 'image':
          result = await this.processImage(file);
          break;
        case 'text':
          result = await this.processTextFile(file);
          break;
        default:
          result = {
            content: `サポートされていないファイル形式: ${file.name}`,
            type: 'text',
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              processedAt: new Date(),
            },
          };
      }

      results.push(result);
    }

    // 結果を統合
    return results
      .map(result => `## ${result.metadata.fileName}\n\n${result.content}`)
      .join('\n\n---\n\n');
  }

  /**
   * ファイルタイプの判定
   */
  private getFileType(file: File): 'pdf' | 'office' | 'image' | 'text' | 'unknown' {
    const extension = file.name.toLowerCase().split('.').pop() || '';
    
    if (extension === 'pdf') {
      return 'pdf';
    }
    
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      return 'office';
    }
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
      return 'image';
    }
    
    if (['txt', 'text'].includes(extension)) {
      return 'text';
    }
    
    return 'unknown';
  }

  /**
   * ファイルをBase64に変換
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// シングルトンインスタンス
export const fileProcessor = new FileProcessor(); 