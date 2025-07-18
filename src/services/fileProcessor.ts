// ===========================================
// MinutesGen v0.7.5 - ファイル処理サービス（認証統合）
// ===========================================

import { FileProcessingResult } from '../types/infographic';
import { AuthService } from './authService';
import { 
  shouldSplitContent, 
  generateTokenLimitWarning, 
  estimateTokenCount,
  type ModelName 
} from '../utils/tokenLimits';

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
   * PDFファイルの処理（OpenAI Files APIを使用）
   */
  async processPDF(file: File, onProgress?: (progress: { stage: string; percentage: number; message: string }) => void): Promise<FileProcessingResult> {
    try {
      const apiKey = await this.ensureAuthenticated();
      
      console.log('PDF処理開始:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Step 1: PDFファイルをOpenAI Files APIにアップロード
      onProgress?.({ stage: 'upload', percentage: 10, message: 'PDFファイルをアップロード中...' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'assistants');

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        this.handleAuthError(uploadResponse);
        const errorData = await uploadResponse.json();
        throw new Error(`PDFファイルアップロードエラー: ${errorData.error?.message || uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const fileId = uploadResult.id;
      
      console.log('PDFファイルアップロード成功:', { fileId });
      onProgress?.({ stage: 'upload', percentage: 30, message: 'PDFファイルのアップロード完了' });

      // Step 2: Chat Completions APIを使用してPDFからテキストを抽出
      onProgress?.({ stage: 'extract', percentage: 40, message: 'PDFからテキストを抽出中...' });
      const extractResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  text: 'このPDFファイルの内容を全て読み取り、テキストとして抽出してください。表やリストがある場合は、その構造も保持してください。画像内のテキストも含めて抽出してください。',
                },
                {
                  type: 'file',
                  file: {
                    file_id: fileId,
                  },
                },
              ],
            },
          ],
          max_tokens: 16000,
          temperature: 0.1,
        }),
      });

      if (!extractResponse.ok) {
        this.handleAuthError(extractResponse);
        const errorData = await extractResponse.json();
        throw new Error(`PDFテキスト抽出エラー: ${errorData.error?.message || extractResponse.statusText}`);
      }

      const extractResult = await extractResponse.json();
      const extractedText = extractResult.choices[0]?.message?.content || '';

      console.log('PDFテキスト抽出成功:', {
        fileName: file.name,
        extractedTextLength: extractedText.length,
        textPreview: extractedText.substring(0, 200)
      });

      // 🔥 新規追加: PDFから抽出されたテキストのトークンチェック
      if (extractedText && extractedText.trim().length > 0) {
        const model: ModelName = 'gpt-4o' as ModelName; // PDFは現在gpt-4o使用
        const splitInfo = shouldSplitContent(extractedText, model);
        
        console.log('PDF抽出テキスト - トークンチェック結果:', {
          fileName: file.name,
          model,
          estimatedTokens: splitInfo.estimatedTokens,
          needsSplit: splitInfo.needsSplit,
          exceedsBy: splitInfo.exceedsBy
        });
        
        if (splitInfo.needsSplit) {
          const warning = generateTokenLimitWarning(splitInfo, model);
          console.warn(`⚠️ PDF抽出テキストでトークン制限超過: ${warning}`);
          
          // 後続の議事録生成処理で問題が発生する可能性を警告
          console.warn('⚠️ 後続の議事録生成処理でトークン制限に達する可能性があります');
        }
      }

      onProgress?.({ stage: 'extract', percentage: 80, message: 'テキスト抽出完了' });

      // Step 3: アップロードしたファイルを削除（オプション）
      onProgress?.({ stage: 'cleanup', percentage: 90, message: '一時ファイルを削除中...' });
      try {
        await fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        console.log('一時ファイル削除完了:', fileId);
      } catch (deleteError) {
        console.warn('一時ファイル削除に失敗:', deleteError);
      }

      onProgress?.({ stage: 'complete', percentage: 100, message: 'PDF処理完了' });

      return {
        content: extractedText || 'PDFの内容を抽出できませんでした。',
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
        content: `PDFファイル「${file.name}」の処理中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
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