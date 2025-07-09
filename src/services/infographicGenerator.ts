// ===========================================
// MinutesGen v1.0 - インフォグラフィック生成サービス
// ===========================================

import { 
  InfographicConfig, 
  InfographicOutput, 
  ToneAnalysis, 
  InfographicGenerationProgress 
} from '../types/infographic';
import { getValidatedAPIConfig } from '../config/api';
import { fileProcessor } from './fileProcessor';

export class InfographicGenerator {
  private progressCallback?: (progress: InfographicGenerationProgress) => void;

  /**
   * 進捗コールバックを設定
   */
  setProgressCallback(callback: (progress: InfographicGenerationProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * 進捗を更新
   */
  private updateProgress(
    stage: InfographicGenerationProgress['stage'],
    percentage: number,
    currentTask: string,
    estimatedTimeRemaining: number = 0
  ) {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        percentage,
        currentTask,
        estimatedTimeRemaining,
      });
    }
  }

  /**
   * トーン分析（URL、画像、またはアプリテーマから）
   */
  async analyzeTone(config: InfographicConfig): Promise<ToneAnalysis> {
    this.updateProgress('analyzing', 10, 'トーン分析を開始しています...');

    try {
      const apiConfig = getValidatedAPIConfig();

      switch (config.tone.type) {
        case 'url':
          return await this.analyzeToneFromURL(config.tone.source!, apiConfig.openaiApiKey);
        
        case 'image':
          return await this.analyzeToneFromImage(config.tone.imageFile!, apiConfig.openaiApiKey);
        
        case 'theme':
        default:
          return this.analyzeToneFromTheme(config.tone.themeMode || 'light');
      }
    } catch (error) {
      console.error('トーン分析エラー:', error);
      // エラー時はライトテーマをデフォルトとして使用
      return this.analyzeToneFromTheme('light');
    }
  }

  /**
   * URLからトーン分析
   */
  private async analyzeToneFromURL(url: string, apiKey: string): Promise<ToneAnalysis> {
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
            content: `以下のURLのWebサイトのデザインを分析し、インフォグラフィックのトーンを抽出してください。
            
URL: ${url}

以下のJSON形式で回答してください：
{
  "primaryColor": "#色コード",
  "secondaryColor": "#色コード", 
  "accentColor": "#色コード",
  "fontFamily": "フォント名",
  "fontSize": {
    "heading": "サイズ",
    "body": "サイズ",
    "caption": "サイズ"
  },
  "spacing": {
    "section": "サイズ",
    "element": "サイズ"
  },
  "borderRadius": "サイズ",
  "shadow": "CSSシャドウ値",
  "layout": "minimal/rich/classic"
}`,
          },
        ],
        max_tokens: 1000,
      }),
    });

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '{}';
    
    try {
      return JSON.parse(content);
    } catch {
      return this.analyzeToneFromTheme('light');
    }
  }

  /**
   * 画像からトーン分析
   */
  private async analyzeToneFromImage(imageFile: File, apiKey: string): Promise<ToneAnalysis> {
    const base64Image = await this.fileToBase64(imageFile);
    
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
                text: `この画像のデザインを分析し、インフォグラフィックのトーンを抽出してください。

以下のJSON形式で回答してください：
{
  "primaryColor": "#色コード",
  "secondaryColor": "#色コード", 
  "accentColor": "#色コード",
  "fontFamily": "フォント名",
  "fontSize": {
    "heading": "サイズ",
    "body": "サイズ",
    "caption": "サイズ"
  },
  "spacing": {
    "section": "サイズ",
    "element": "サイズ"
  },
  "borderRadius": "サイズ",
  "shadow": "CSSシャドウ値",
  "layout": "minimal/rich/classic"
}`,
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
        max_tokens: 1000,
      }),
    });

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '{}';
    
    try {
      return JSON.parse(content);
    } catch {
      return this.analyzeToneFromTheme('light');
    }
  }

  /**
   * アプリテーマからトーン分析
   */
  private analyzeToneFromTheme(themeMode: 'light' | 'dark' | 'color'): ToneAnalysis {
    const themes = {
      light: {
        primaryColor: '#1976d2',
        secondaryColor: '#f5f5f5',
        accentColor: '#ff9800',
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: {
          heading: '2.5rem',
          body: '1rem',
          caption: '0.875rem',
        },
        spacing: {
          section: '2rem',
          element: '1rem',
        },
        borderRadius: '8px',
        shadow: '0 2px 8px rgba(0,0,0,0.1)',
        layout: 'minimal' as const,
      },
      dark: {
        primaryColor: '#90caf9',
        secondaryColor: '#424242',
        accentColor: '#ffb74d',
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: {
          heading: '2.5rem',
          body: '1rem',
          caption: '0.875rem',
        },
        spacing: {
          section: '2rem',
          element: '1rem',
        },
        borderRadius: '8px',
        shadow: '0 2px 8px rgba(0,0,0,0.3)',
        layout: 'minimal' as const,
      },
      color: {
        primaryColor: '#e91e63',
        secondaryColor: '#fce4ec',
        accentColor: '#4caf50',
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: {
          heading: '2.5rem',
          body: '1rem',
          caption: '0.875rem',
        },
        spacing: {
          section: '2rem',
          element: '1rem',
        },
        borderRadius: '12px',
        shadow: '0 4px 12px rgba(233,30,99,0.2)',
        layout: 'rich' as const,
      },
    };

    return themes[themeMode];
  }

  /**
   * 情報量調整
   */
  async adjustInformationLevel(content: string, level: 'large' | 'medium' | 'small'): Promise<string> {
    this.updateProgress('processing', 30, '情報量を調整しています...');

    // 情報量大の場合は必ず元のコンテンツをそのまま返す
    if (level === 'large') {
      return content;
    }

    const config = getValidatedAPIConfig();
    
    // 情報量中・小の場合の処理を改善
    const adjustmentPrompt = level === 'small' 
      ? `以下の議事録から最も重要な要点のみを抽出し、簡潔にまとめてください。ただし、重要な決定事項、参加者、具体的な数値や日付は必ず保持してください。`
      : `以下の議事録を適度に要約してください。重要な情報、具体的な内容、決定事項は詳細に保持し、冗長な部分のみを簡潔にしてください。`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `${adjustmentPrompt}\n\n${content}`,
            },
          ],
          temperature: 0.3,
          max_tokens: level === 'small' ? 1500 : 3000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      // API応答の検証
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('API応答が不正です: choices[0].message が存在しません');
      }

      return data.choices[0].message.content || content;
    } catch (error) {
      console.error('情報量調整エラー:', error);
      // エラー時は元のコンテンツを返す
      return content;
    }
  }

  /**
   * インフォグラフィック生成
   */
  async generateInfographic(
    content: string,
    config: InfographicConfig
  ): Promise<InfographicOutput> {
    this.updateProgress('generating', 50, 'インフォグラフィックを生成しています...');

    try {
      // 1. トーン分析
      const toneAnalysis = await this.analyzeTone(config);

      // 2. 添付ファイル処理
      let finalContent = content;
      
      if (config.additionalFiles && config.additionalFiles.length > 0) {
        this.updateProgress('processing', 60, '添付ファイルを処理しています...');
        const additionalContent = await fileProcessor.processAttachments(config.additionalFiles);
        
        // 添付ファイルがある場合は、添付ファイル内容のみを使用
        finalContent = additionalContent;
      } else {
        // 3. 情報量調整（ファイル添付なしの場合のみ）
        finalContent = await this.adjustInformationLevel(content, config.informationLevel);
      }
      
      // 4. 追加テキストを結合
      const extraContent = config.additionalText || '';
      if (extraContent) {
        finalContent = [finalContent, extraContent].filter(Boolean).join('\n\n---\n\n');
      }

      // 5. HTML生成
      this.updateProgress('generating', 80, 'HTMLを生成しています...');
      const html = await this.generateHTML(finalContent, toneAnalysis, config);

      this.updateProgress('completed', 100, '生成完了！');

      return {
        html,
        metadata: {
          pageCount: 1,
          dimensions: this.getStructureDimensions(config.structure),
          generatedAt: new Date(),
          config,
        },
      };
    } catch (error) {
      console.error('インフォグラフィック生成エラー:', error);
      throw new Error('インフォグラフィックの生成に失敗しました。');
    }
  }

  /**
   * HTML生成
   */
  private async generateHTML(
    content: string,
    toneAnalysis: ToneAnalysis,
    config: InfographicConfig
  ): Promise<string> {
    try {
      const apiConfig = getValidatedAPIConfig();
      
      // トークン制限対応：コンテンツを適切なサイズに調整
      const optimizedContent = this.optimizeContentForAPI(content);
      
      const prompt = `
あなたは日本のビジネス文書作成のエキスパートです。
以下の議事録内容から、${config.structure}構造の美しいインフォグラフィックHTMLを作成してください。

【デザイン要件】
- 構造: ${config.structure}
- 情報量: ${config.informationLevel}
- プライマリカラー: ${toneAnalysis.primaryColor}
- セカンダリカラー: ${toneAnalysis.secondaryColor}
- アクセントカラー: ${toneAnalysis.accentColor}
- フォント: ${toneAnalysis.fontFamily}
- レイアウト: ${toneAnalysis.layout}

【制約事項】
- 完全なHTML文書として出力（<!DOCTYPE html>から</html>まで）
- 日本語に最適化されたフォント使用
- レスポンシブデザイン対応
- 印刷に適したレイアウト
- 視覚的に美しく、読みやすいデザイン
- 文字数制限内での効果的な情報配置

【議事録内容】
${optimizedContent}

上記の内容を基に、プロフェッショナルなインフォグラフィックHTMLを生成してください。
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // [[memory:2584719]]
          messages: [
            {
              role: 'system',
              content: 'あなたは日本のビジネス文書デザインの専門家です。美しく機能的なインフォグラフィックHTMLを作成してください。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API Error (${response.status}): ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = `API Error (${response.status}): ${errorData.error?.message || response.statusText}`;
        } catch (e) {
          // JSON解析に失敗した場合は元のエラーメッセージを使用
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // API応答の検証
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('API応答が不正です: choices[0].message が存在しません');
      }

      const generatedContent = data.choices[0].message.content;
      
      // 生成されたコンテンツの検証
      if (!generatedContent || generatedContent.trim() === '') {
        throw new Error('生成されたコンテンツが空です');
      }

      // "I'm sorry, but I can't assist with that request." のチェック
      if (generatedContent.includes("I'm sorry, but I can't assist with that request.")) {
        throw new Error('APIがリクエストを拒否しました。議事録の内容を確認してください。');
      }

      return generatedContent;
    } catch (error) {
      console.error('HTML生成エラー:', error);
      throw error;
    }
  }

  /**
   * APIトークン制限に対応してコンテンツを最適化
   */
  private optimizeContentForAPI(content: string): string {
    // 概算トークン数を計算（日本語では1文字≒1.5トークン）
    const estimatedTokens = content.length * 1.5;
    const maxTokens = 500000; // GPT-4.1の入力トークン上限50万トークン
    
    if (estimatedTokens <= maxTokens) {
      return content;
    }
    
    // トークン制限を超える場合は段階的に要約
    const targetLength = Math.floor(maxTokens / 1.5);
    
    // 1. 段落単位で分割
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    // 2. 重要度に基づいて段落を選択
    const importantParagraphs = paragraphs.filter(p => {
      const lowerP = p.toLowerCase();
      return lowerP.includes('決定') || 
             lowerP.includes('結論') || 
             lowerP.includes('合意') || 
             lowerP.includes('todo') || 
             lowerP.includes('アクション') || 
             lowerP.includes('次回') || 
             lowerP.includes('重要') || 
             lowerP.includes('課題') || 
             lowerP.includes('問題');
    });
    
    // 3. 重要な段落を優先して結合
    let optimizedContent = importantParagraphs.join('\n\n');
    
    // 4. まだ長すぎる場合は文単位で切り詰め
    if (optimizedContent.length > targetLength) {
      const sentences = optimizedContent.split(/[。！？]/).filter(s => s.trim());
      optimizedContent = sentences.slice(0, Math.floor(sentences.length * 0.7)).join('。') + '。';
    }
    
    // 5. 最終的な長さ調整
    if (optimizedContent.length > targetLength) {
      optimizedContent = optimizedContent.substring(0, targetLength - 100) + '...\n\n[内容が長いため一部省略されました]';
    }
    
    return optimizedContent;
  }

  /**
   * 構造別プロンプト取得
   */
  private getStructurePrompt(structure: 'scroll' | 'horizontal' | 'vertical'): string {
    switch (structure) {
      case 'scroll':
        return '縦長のスクロール形式で、セクションごとに区切られた読みやすいレイアウト';
      case 'horizontal':
        return '16:9の横長比率で、左右にバランスよく配置されたレイアウト';
      case 'vertical':
        return '2:3の縦長比率で、上下にコンパクトに配置されたレイアウト';
      default:
        return '標準的なレイアウト';
    }
  }

  /**
   * 構造別サイズ取得
   */
  private getStructureDimensions(structure: 'scroll' | 'horizontal' | 'vertical'): { width: number; height: number } {
    switch (structure) {
      case 'scroll':
        return { width: 800, height: 1200 };
      case 'horizontal':
        return { width: 1600, height: 900 };
      case 'vertical':
        return { width: 800, height: 1200 };
      default:
        return { width: 800, height: 1200 };
    }
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
export const infographicGenerator = new InfographicGenerator(); 