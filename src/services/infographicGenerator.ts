// ===========================================
// MinutesGen v0.7.5 - インフォグラフィック生成サービス（認証統合）
// ===========================================

import { MinutesData } from '../types';
import { InfographicConfig, ToneAnalysis, FileProcessingResult } from '../types/infographic';
import { AuthService } from './authService';

export class InfographicGenerator {
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
   * 議事録データからインフォグラフィックを生成
   */
  async generateInfographic(
    minutesContent: string,
    config: InfographicConfig,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const apiKey = await this.ensureAuthenticated();

    try {
      onProgress?.(10);

      // Step 1: トーン分析
      const toneAnalysis = await this.analyzeTone(config, apiKey);
      onProgress?.(30);

      // Step 2: 情報量調整
      const adjustedContent = await this.adjustInformationLevel(
        minutesContent,
        config.informationLevel,
        apiKey
      );
      onProgress?.(60);

      // Step 3: HTML生成
      const html = await this.generateHTML(adjustedContent, toneAnalysis, config, apiKey);
      onProgress?.(100);

      return html;
    } catch (error) {
      console.error('インフォグラフィック生成エラー:', error);
      throw error;
    }
  }

  /**
   * トーン分析を実行
   */
  private async analyzeTone(config: InfographicConfig, apiKey: string): Promise<ToneAnalysis> {
    if (config.tone.type === 'url') {
      return await this.analyzeToneFromURL(config.tone.source!, apiKey);
    } else if (config.tone.type === 'image') {
      return await this.analyzeToneFromImage(config.tone.imageFile!, apiKey);
    } else {
      return this.getDefaultToneAnalysis(config.tone.type);
    }
  }

  /**
   * URLからトーン分析
   */
  private async analyzeToneFromURL(url: string, apiKey: string): Promise<ToneAnalysis> {
    try {
      // OpenAI APIはURLの直接分析をサポートしていないため、
      // URLパターンに基づいたヒューリスティック分析を行う
      console.log('URL分析を実行:', url);
      
      // URLパターンから推測されるトーンを分析
      const urlLower = url.toLowerCase();
      let inferredTone = 'professional'; // デフォルト
      
      // ドメインやパスからトーンを推測
      if (urlLower.includes('corporate') || urlLower.includes('business') || urlLower.includes('company')) {
        inferredTone = 'professional';
      } else if (urlLower.includes('blog') || urlLower.includes('casual') || urlLower.includes('lifestyle')) {
        inferredTone = 'casual';
      } else if (urlLower.includes('tech') || urlLower.includes('modern') || urlLower.includes('startup')) {
        inferredTone = 'modern';
      } else if (urlLower.includes('traditional') || urlLower.includes('classic') || urlLower.includes('heritage')) {
        inferredTone = 'traditional';
      }
      
      console.log(`URL "${url}" から推測されたトーン: ${inferredTone}`);
      
      // 推測されたトーンに基づいてデフォルト分析を返す
      const baseAnalysis = this.getDefaultToneAnalysis(inferredTone);
      
      // URLドメインに基づいて色を微調整
      let primaryColor = baseAnalysis.primaryColor;
      let secondaryColor = baseAnalysis.secondaryColor;
      let accentColor = baseAnalysis.accentColor;
      
      // 特定のドメインに対する色の調整
      if (urlLower.includes('google')) {
        primaryColor = '#4285f4';
        secondaryColor = '#34a853';
        accentColor = '#ea4335';
      } else if (urlLower.includes('microsoft')) {
        primaryColor = '#0078d4';
        secondaryColor = '#106ebe';
        accentColor = '#d83b01';
      } else if (urlLower.includes('apple')) {
        primaryColor = '#007aff';
        secondaryColor = '#5ac8fa';
        accentColor = '#ff9500';
      }
      
      return {
        ...baseAnalysis,
        primaryColor,
        secondaryColor,
        accentColor,
      };
    } catch (error) {
      console.error('URL分析エラー:', error);
      return this.getDefaultToneAnalysis('professional');
    }
  }

  /**
   * 画像からトーン分析
   */
  private async analyzeToneFromImage(imageFile: File, apiKey: string): Promise<ToneAnalysis> {
    try {
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
                  text: `この画像のデザインとトーンを分析してください。以下の形式でJSONで回答してください:
                  {
                    "primaryColor": "#色コード",
                    "secondaryColor": "#色コード",
                    "tone": "professional|casual|modern|traditional",
                    "style": "minimalist|detailed|colorful|monochrome"
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
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        this.handleAuthError(response);
        throw new Error(`画像分析エラー: ${response.statusText}`);
      }

      const data = await response.json();
      
      // JSON形式の応答を解析（エラーハンドリング強化）
      let analysis: any = {};
      try {
        const content = data.choices[0].message.content;
        console.log('画像分析API応答:', content);
        
        // JSONブロックを抽出する正規表現
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          analysis = JSON.parse(jsonStr);
        } else {
          throw new Error('JSON形式が見つかりません');
        }
      } catch (parseError) {
        console.warn('JSON解析失敗、テキスト分析にフォールバック:', parseError);
        // JSONでない場合はテキストから推測
        const content = data.choices[0].message.content;
        analysis = {
          tone: content.includes('professional') ? 'professional' : 
                content.includes('modern') ? 'modern' : 
                content.includes('casual') ? 'casual' : 
                content.includes('traditional') ? 'traditional' : 'professional',
          primaryColor: this.extractColorFromText(content) || '#1976d2',
          secondaryColor: this.extractColorFromText(content, 'secondary') || '#42a5f5',
          accentColor: this.extractColorFromText(content, 'accent') || '#ff9800',
        };
      }
      
      const baseAnalysis = this.getDefaultToneAnalysis(analysis.tone || 'professional');
      
      return {
        ...baseAnalysis,
        primaryColor: analysis.primaryColor || baseAnalysis.primaryColor,
        secondaryColor: analysis.secondaryColor || baseAnalysis.secondaryColor,
        accentColor: analysis.accentColor || baseAnalysis.accentColor,
      };
    } catch (error) {
      console.error('画像分析エラー:', error);
      return this.getDefaultToneAnalysis('professional');
    }
  }

  /**
   * デフォルトトーン分析
   */
  private getDefaultToneAnalysis(tone: string): ToneAnalysis {
    const toneMap: Record<string, ToneAnalysis> = {
      professional: {
        primaryColor: '#1976d2',
        secondaryColor: '#42a5f5',
        accentColor: '#ff9800',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "Meiryo", sans-serif',
        fontSize: {
          heading: '2.5rem',
          body: '1.1rem',
          caption: '0.9rem'
        },
        spacing: {
          section: '3rem',
          element: '1.5rem'
        },
        borderRadius: '8px',
        shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        layout: 'minimal'
      },
      casual: {
        primaryColor: '#4caf50',
        secondaryColor: '#81c784',
        accentColor: '#ff5722',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "Meiryo", sans-serif',
        fontSize: {
          heading: '2.2rem',
          body: '1.0rem',
          caption: '0.85rem'
        },
        spacing: {
          section: '2.5rem',
          element: '1.2rem'
        },
        borderRadius: '12px',
        shadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        layout: 'rich'
      },
      modern: {
        primaryColor: '#9c27b0',
        secondaryColor: '#ba68c8',
        accentColor: '#00bcd4',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "Meiryo", sans-serif',
        fontSize: {
          heading: '2.8rem',
          body: '1.05rem',
          caption: '0.88rem'
        },
        spacing: {
          section: '4rem',
          element: '1.8rem'
        },
        borderRadius: '16px',
        shadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        layout: 'rich'
      },
      traditional: {
        primaryColor: '#795548',
        secondaryColor: '#a1887f',
        accentColor: '#d32f2f',
        fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif',
        fontSize: {
          heading: '2.4rem',
          body: '1.1rem',
          caption: '0.9rem'
        },
        spacing: {
          section: '3.5rem',
          element: '1.6rem'
        },
        borderRadius: '4px',
        shadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
        layout: 'classic'
      },
    };

    return toneMap[tone] || toneMap.professional;
  }

  /**
   * 情報量を調整
   */
  async adjustInformationLevel(content: string, level: 'large' | 'medium' | 'small', apiKey: string): Promise<string> {
    const adjustmentPrompts = {
      large: `以下の議事録内容を、**詳細情報を完全に保持**しながら、インフォグラフィック用に整理してください。

【要求事項】
- **全ての詳細情報、数値、日付、人名を保持**
- 発言者の具体的なコメントや意見も含める
- 技術的な詳細や仕様も省略せずに記載
- 議論の経緯や背景情報も含める
- 決定に至った理由や根拠も詳しく記載
- 参加者全員の発言や貢献を記録
- 具体的なアクション項目と責任者、期限を明記

【出力形式】
- 元の情報量を80-100%保持
- 視覚的に整理された構造化テキスト
- セクション分けで読みやすく整理`,

      medium: `以下の議事録内容を、**重要なポイントを中心**に、インフォグラフィック用に整理してください。

【要求事項】
- 主要な決定事項と背景を保持
- 重要な数値、日付、人名を含める
- 主要な議論ポイントを要約
- 具体的なアクション項目を明記
- 重要な技術的詳細は保持
- 次回会議への引き継ぎ事項を含める

【出力形式】
- 元の情報量を60-80%保持
- 要点を整理した構造化テキスト
- 重要度に応じた情報の階層化`,

      small: `以下の議事録内容を、**最重要ポイントのみ**に絞って、インフォグラフィック用に要約してください。

【要求事項】
- 最終決定事項のみ抽出
- 必須のアクション項目と期限
- 重要な数値や日付のみ
- 次回までの必須タスク
- 緊急性の高い課題のみ

【出力形式】
- 元の情報量を30-50%に凝縮
- 箇条書き中心の簡潔な構造
- 一目で理解できる要約形式`
    };

    const selectedPrompt = adjustmentPrompts[level];
    const maxTokens = level === 'large' ? 4000 : level === 'medium' ? 3000 : 1500;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1', // より高性能なモデルを使用
          messages: [
            {
              role: 'system',
              content: 'あなたは議事録の情報整理の専門家です。指定された情報量レベルに応じて、適切に内容を調整してください。'
            },
            {
              role: 'user',
              content: `${selectedPrompt}\n\n【議事録内容】\n${content}`,
            },
          ],
          temperature: 0.2,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        this.handleAuthError(response);
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
   * HTML生成
   */
  private async generateHTML(
    content: string,
    toneAnalysis: ToneAnalysis,
    config: InfographicConfig,
    apiKey: string
  ): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
              content: `以下の議事録内容から、${config.structure}構造の美しいインフォグラフィックHTMLを作成してください。

【デザイン要件】
- 構造: ${config.structure}
- 情報量レベル: ${config.informationLevel}
- プライマリカラー: ${toneAnalysis.primaryColor}
- セカンダリカラー: ${toneAnalysis.secondaryColor}
- アクセントカラー: ${toneAnalysis.accentColor}
- フォント: ${toneAnalysis.fontFamily}
- フォントサイズ: 見出し ${toneAnalysis.fontSize.heading}, 本文 ${toneAnalysis.fontSize.body}, キャプション ${toneAnalysis.fontSize.caption}
- スペーシング: セクション間 ${toneAnalysis.spacing.section}, 要素間 ${toneAnalysis.spacing.element}
- 角丸: ${toneAnalysis.borderRadius}
- シャドウ: ${toneAnalysis.shadow}
- レイアウト: ${toneAnalysis.layout}

【情報量レベル別要求事項】
${config.informationLevel === 'large' ? 
`**詳細レベル (Large)**:
- 全ての詳細情報を視覚的に表現
- 複数のセクションで情報を階層化
- 詳細なタイムライン、数値、参加者情報を含める
- 議論の流れや背景情報も視覚化
- 豊富なアイコン、チャート、図表を使用
- スクロール可能な詳細ビューを作成` :
config.informationLevel === 'medium' ?
`**標準レベル (Medium)**:
- 重要なポイントを中心とした構成
- 主要セクションでの情報整理
- 重要な数値や決定事項を強調表示
- 適度なビジュアル要素で読みやすく
- バランスの取れた情報密度` :
`**簡潔レベル (Small)**:
- 最重要ポイントのみを大きく表示
- シンプルで一目で理解できるデザイン
- 重要な決定事項と次のアクションに焦点
- ミニマルなデザインで視認性を重視
- 短時間で全体を把握できる構成`}

【制約事項】
- 完全なHTML文書として出力（<!DOCTYPE html>から</html>まで）
- 日本語に最適化されたフォント使用（Noto Sans JP, ヒラギノ角ゴ等）
- レスポンシブデザイン対応
- 印刷に適したレイアウト
- 視覚的に美しく、読みやすいデザイン
- 情報量レベルに応じた適切な情報密度
- CSS Grid/Flexboxを活用した現代的なレイアウト
- アイコンや視覚的要素で理解しやすく

【出力形式の重要な注意事項】
- HTMLコードのみを出力してください
- コードブロックマーカー（\`\`\`html、\`\`\`）は絶対に使用しないでください
- 技術的な説明文は一切追加しないでください
- 「このHTML文書は〜」のような説明は不要です
- 純粋なHTMLコードのみを返してください

【議事録内容】
${content}

上記の内容と情報量レベル要求事項を基に、プロフェッショナルで見やすく、洗練されて目を引くインフォグラフィックHTMLを生成してください。`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        this.handleAuthError(response);
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

      let generatedContent = data.choices[0].message.content;

      // 余分なインフォグラフィック説明文を除去（"インフォグラフィック" と "説明" を含む段落）
      generatedContent = generatedContent.replace(/<p[^>]*>[^<]*インフォグラフィック[^<]*説明[^<]*<\/p>/gi, '')
                                         .replace(/インフォグラフィックの説明[^<]*$/gi, '')
                                         // コードブロックマーカーの削除
                                         .replace(/^```html\s*/gi, '')
                                         .replace(/^```\s*/gi, '')
                                         .replace(/```$/gi, '')
                                         .replace(/```html$/gi, '')
                                         // 技術説明文の削除
                                         .replace(/このHTML文書は[^<]*?印刷にも適しています。?/gi, '')
                                         .replace(/このHTML文書は[^<]*?設計されています。?/gi, '')
                                         .replace(/このHTML文書は[^<]*?対応しています。?/gi, '')
                                         .replace(/このインフォグラフィックは[^<]*?作成されました。?/gi, '')
                                         // ヘッダー・フッター関連の文字を削除
                                         .replace(/<p[^>]*>[^<]*Generated by[^<]*<\/p>/gi, '')
                                         .replace(/<p[^>]*>[^<]*MinutesGen[^<]*<\/p>/gi, '')
                                         .replace(/Generated by MinutesGen[^<]*$/gi, '')
                                         .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                                         .replace(/<div[^>]*class="footer"[^>]*>[\s\S]*?<\/div>/gi, '')
                                         .replace(/<div[^>]*class="page-number"[^>]*>[\s\S]*?<\/div>/gi, '')
                                         .replace(/ページ \d+/gi, '')
                                         // 生成日時関連の削除
                                         .replace(/<p[^>]*>[^<]*生成日時[^<]*<\/p>/gi, '')
                                         .replace(/生成日時[^<]*$/gi, '')
                                         // 空の段落やdivを削除
                                         .replace(/<p>\s*<\/p>/gi, '')
                                         .replace(/<div>\s*<\/div>/gi, '');

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

  /**
   * テキストから色を抽出するヘルパー関数
   */
  private extractColorFromText(text: string, type: 'primary' | 'secondary' | 'accent' = 'primary'): string | null {
    const colorRegex = /#[0-9a-fA-F]{6}/g;
    const colors = text.match(colorRegex);
    
    if (colors && colors.length > 0) {
      switch (type) {
        case 'primary':
          return colors[0];
        case 'secondary':
          return colors[1] || colors[0];
        case 'accent':
          return colors[2] || colors[1] || colors[0];
        default:
          return colors[0];
      }
    }
    
    return null;
  }
}

// シングルトンインスタンス
export const infographicGenerator = new InfographicGenerator(); 