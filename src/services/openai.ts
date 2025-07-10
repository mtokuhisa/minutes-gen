// ===========================================
// MinutesGen v1.0 - OpenAI API サービス（認証システム統合）
// ===========================================

import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { getValidatedAPIConfig, getCorporateStatus, DEFAULT_API_CONFIG } from '../config/api';
import { AuthService } from './authService';
import { AudioFile, ProcessingOptions, MinutesData, ProcessingProgress, GeneratedOutput, OutputFormat } from '../types';
import { audioProcessor } from './audioProcessor';
import { initializePromptStore, getActivePrompt, getAllPrompts } from './promptStore';
import { ErrorHandler, APIError } from './errorHandler';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
// WebCodecsProcessor はメモリ消費の問題があるため使用を停止
// import { WebCodecsProcessor } from './webCodecsProcessor';

export class OpenAIService {
  private api!: AxiosInstance;
  private fallbackApi?: AxiosInstance;
  private config;
  private corporateStatus;
  private authService: AuthService;
  /**
   * 設定可能なチャンクサイズ。大容量音声ファイルはチャンク分割して順次アップロードする。
   * Whisper(GPT-4 Transcribe) エンドポイントの 100MB 制限を安全側に回避。
   */
  private get CHUNK_SIZE_BYTES(): number {
    return 15 * 1024 * 1024; // 15MB基準（方式b）
  }

  constructor() {
    try {
      this.config = getValidatedAPIConfig();
    } catch (error) {
      console.warn('API設定の初期化に失敗しました。デフォルト設定を使用します:', error);
      this.config = DEFAULT_API_CONFIG;
    }
    this.corporateStatus = getCorporateStatus();
    this.authService = AuthService.getInstance();
    
    // 認証サービスからAPI KEYを取得して初期化
    this.initializeAPIClient();
  }

  private async initializeAPIClient() {
    const apiKey = await this.authService.getApiKey();
    if (!apiKey) {
      // 初回起動時や認証前は正常な状態なので警告を出さない
      return;
    }

    // メインAPIクライアントの設定
    this.api = this.createAPIClient(apiKey);
  }

  private createAPIClient(apiKey: string): AxiosInstance {
    const axiosConfig: any = {
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutDuration,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    // プロキシ設定（ブラウザ環境では無効）
    if (this.config.proxyUrl && typeof window === 'undefined') {
      try {
        const proxyUrl = new URL(this.config.proxyUrl);
        const proxy: AxiosProxyConfig = {
          host: proxyUrl.hostname,
          port: parseInt(proxyUrl.port) || (proxyUrl.protocol === 'https:' ? 443 : 80),
          protocol: proxyUrl.protocol.replace(':', ''),
        };

        // プロキシ認証
        if (this.config.proxyAuth) {
          const [username, password] = this.config.proxyAuth.split(':');
          proxy.auth = { username, password };
        }

        axiosConfig.proxy = proxy;
      } catch (error) {
        console.warn('プロキシ設定の解析に失敗:', error);
      }
    }

    // 企業環境でよくある証明書問題への対応（Node.js環境のみ）
    const nodeEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development';
    
    if (nodeEnv === 'production' && this.config.useCorporateKey && typeof window === 'undefined') {
      try {
        const https = require('https');
        axiosConfig.httpsAgent = new https.Agent({
          rejectUnauthorized: false, // 自己署名証明書を許可
        });
      } catch (error) {
        console.warn('HTTPS Agent設定に失敗:', error);
      }
    }

    const api = axios.create(axiosConfig);

    // リクエストインターセプター
    api.interceptors.request.use(
      (config) => {
        if (this.config.debugLogs) {
          const authMethod = this.authService.getAuthMethod();
          console.log(`OpenAI API リクエスト (${authMethod}):`, config);
        }
        return config;
      },
      (error) => {
        console.error('OpenAI API リクエストエラー:', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    api.interceptors.response.use(
      (response) => {
        if (this.config.debugLogs) {
          const authMethod = this.authService.getAuthMethod();
          console.log(`OpenAI API レスポンス (${authMethod}):`, response);
        }
        return response;
      },
      (error) => {
        console.error('OpenAI API レスポンスエラー:', error);
        
        // 400エラーなど、詳細情報を表示
        if (error.response) {
          const authMethod = this.authService.getAuthMethod();
          console.error('エラーレスポンス詳細:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers,
            authMethod: authMethod,
          });
        }
        
        return Promise.reject(error);
      }
    );

    return api;
  }

  /**
   * API KEYを最新の状態に更新
   */
  private async refreshAPIClient(): Promise<void> {
    const apiKey = await this.authService.getApiKey();
    if (apiKey) {
      this.api = this.createAPIClient(apiKey);
    }
  }

  /**
   * 認証状態を確認してAPIクライアントを準備
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('認証が必要です。初回セットアップを完了してください。');
    }

    if (!this.api) {
      await this.refreshAPIClient();
    }
  }

  /**
   * 音声ファイルを文字起こしする
   */
  async transcribeAudio(
    file: AudioFile,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<string> {
    await this.ensureAuthenticated();

    // ----- 大容量ファイルはffmpeg.wasmで適切なセグメントに分割 -----
    if (file.rawFile && file.rawFile.size > this.CHUNK_SIZE_BYTES) {
      try {
        // 全ての分割処理を信頼性の高いffmpegに一本化
        return await this.transcribeAudioWithFFmpeg(file, options, onProgress);
      } catch (ffError) {
        const errorMessage = `
大容量音声ファイルの処理中にエラーが発生しました。

❌ 失敗原因:
- ffmpeg.wasm での処理失敗: ${ffError instanceof Error ? ffError.message : '不明なエラー'}
        `.trim();
        throw new Error(errorMessage);
      }
    }

    const authMethod = this.authService.getAuthMethod();
    const authMethodText = authMethod === 'corporate' ? '企業アカウント' : '個人アカウント';
    
    return await ErrorHandler.executeWithRetry(
      async () => {
        // 進捗更新
        onProgress?.({
          stage: 'transcribing',
          percentage: 10,
          currentTask: `AIが音声を文字に変換中... (${authMethodText})`,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString(),
            timestamp: new Date(),
            level: 'info',
            message: `音声ファイルをAI文字起こしサービスに送信中... (${authMethodText})`,
          }],
          startedAt: new Date(),
        });

                 // FormDataを作成
         const formData = new FormData();

         // ブラウザ内 fetch(blob://...) は大容量ファイルでタイムアウトすることがあるため、
         // FileUpload 時に保持している rawFile があればそれを直接使用する。
         if (file.rawFile) {
           formData.append('file', file.rawFile, file.name);
         } else {
           // 従来方式（後方互換）
           const audioBlob = await fetch(file.path, { cache: 'no-store' }).then(r => r.blob());
           formData.append('file', audioBlob, file.name);
         }
         formData.append('model', this.config.transcribeModel);
         formData.append('language', options.language === 'auto' ? '' : options.language);

         const fmt = this.determineResponseFormat(this.config.transcribeModel, options.timestamps);
         if (fmt) {
           formData.append('response_format', fmt);
         }

        // API呼び出し
        // Content-Type ヘッダーは自動付与させる（boundary を正しく設定）
        const response = await this.api.post('/audio/transcriptions', formData);

        // 進捗更新
        onProgress?.({
          stage: 'transcribing',
          percentage: 100,
          currentTask: '文字起こしが完了しました',
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_complete',
            timestamp: new Date(),
            level: 'success',
            message: `文字起こしが完了しました (${authMethodText})`,
          }],
          startedAt: new Date(),
        });

        return response.data.text || response.data;
      },
      (message, attempt, maxRetries) => {
        // エラーハンドリング中の進捗更新
        onProgress?.({
          stage: 'transcribing',
          percentage: 10,
          currentTask: message,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_retry',
            timestamp: new Date(),
            level: 'warning',
            message: `${message} (${attempt}/${maxRetries}回目)`,
          }],
          startedAt: new Date(),
        });
      },
      {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 2,
      }
    );
  }

  /**
   * 音声ファイルの長さを取得
   */
  private getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      let blobUrl: string | null = null;
      
      const cleanup = () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('error', onError);
        audio.src = '';
      };

      const onLoadedMetadata = () => {
        const duration = audio.duration;
        cleanup();
        resolve(duration && isFinite(duration) ? duration : 0);
      };

      const onError = () => {
        cleanup();
        resolve(0);
      };
      
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('error', onError);
      
      // 30秒タイムアウト
      setTimeout(() => {
        cleanup();
        resolve(0);
      }, 30000);
      
      try {
        blobUrl = URL.createObjectURL(file);
        audio.src = blobUrl;
      } catch (error) {
        cleanup();
        resolve(0);
      }
    });
  }

  /**
   * 大容量ファイルをffmpeg.wasmで適切なセグメントに分割して文字起こしを実行する
   */
  private async transcribeAudioWithFFmpeg(
    file: AudioFile,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<string> {
    if (!file.rawFile) {
      // rawFile が無い場合は通常処理へフォールバック
      return this.transcribeAudio(file, options, onProgress);
    }

    try {
      // ffmpeg.wasmで音声ファイルを適切なセグメントに分割（1倍速固定）
      const segments = await audioProcessor.processLargeAudioFile(file, 600, onProgress);
      
      const transcriptSegments: string[] = [];
      
      // 各セグメントを順次文字起こし
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // 進捗更新 (セグメント文字起こし開始)
        onProgress?.({
          stage: 'transcribing',
          percentage: 70 + Math.round((i / segments.length) * 25),
          currentTask: `音声セグメント ${i + 1}/${segments.length} をAIが文字に変換中...`,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_seg_' + i,
            timestamp: new Date(),
            level: 'info',
            message: `音声セグメント ${i + 1}/${segments.length} (${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s) をAIが処理中`,
          }],
          startedAt: new Date(),
        });

        // セグメントファイルを作成
        const segmentFile = new File([segment.blob], segment.name, { type: file.rawFile.type });
        
        const formData = new FormData();
        formData.append('file', segmentFile, segmentFile.name);
        formData.append('model', this.config.transcribeModel);
        formData.append('language', options.language === 'auto' ? '' : options.language);
        const segmentFmt = this.determineResponseFormat(this.config.transcribeModel, options.timestamps);
        if (segmentFmt) {
          formData.append('response_format', segmentFmt);
        }

        // Content-Type ヘッダーはブラウザに任せる（boundary を正しく付与させる）
        const response = await this.api.post('/audio/transcriptions', formData);

        const segmentText = (response.data.text as string).trim();
        if (segmentText) {
          transcriptSegments.push(segmentText);
        }
      }

      // 文字起こし結果を適切にマージ
      const mergedTranscript = this.mergeTranscriptSegments(transcriptSegments);

      // 進捗更新 (完了)
      onProgress?.({
        stage: 'transcribing',
        percentage: 95,
        currentTask: 'AI文字起こし完了',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_segment_done',
          timestamp: new Date(),
          level: 'success',
          message: `全ての音声セグメント(${segments.length}個)のAI文字起こしが完了しました。最終的な文字数: ${mergedTranscript.length}文字`,
        }],
        startedAt: new Date(),
      });

      return mergedTranscript;

    } catch (error) {
      console.error('ffmpeg.wasm音声文字起こしエラー:', error);
      throw new Error('音声の文字起こしに失敗しました');
    }
  }

  /**
   * 分割された文字起こしセグメントを単純にマージする
   * OpenAI APIの高精度な結果をそのまま活用
   */
  private mergeTranscriptSegments(segments: string[]): string {
    if (segments.length === 0) return '';
    
    // 空のセグメントを除去し、改行で結合
    const cleanSegments = segments
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
    
    return cleanSegments.join('\n\n');
  }

  /**
   * 議事録生成プロンプトを構築（マルチフォーマット対応）
   */
  private buildMultiFormatPrompt(transcription: string, options: ProcessingOptions): string {
    // プロンプトストアから選択されたプロンプトを取得
    const promptStore = initializePromptStore();
    let selectedPrompt = null;
    
    // 選択されたプロンプトを取得
    if (options.selectedPrompt) {
      const allPrompts = getAllPrompts(promptStore);
      selectedPrompt = allPrompts.find(p => p.id === options.selectedPrompt);
    }
    
    // 選択されたプロンプトがない場合はアクティブプロンプトを取得
    if (!selectedPrompt) {
      selectedPrompt = getActivePrompt(promptStore);
    }
    
    // プロンプトが見つからない場合はデフォルトプロンプトを使用
    const basePromptContent = selectedPrompt?.content || `
以下の会議の文字起こしテキストから、構造化された議事録を作成してください。

次の[#制約条件]に従って、以下の[#形式]で要約してください。
#形式​
・会議のタイトル 
​・会議参加者
・要約
・詳細（文意を変えずに読みやすく、詳細に記載する）
・決定事項​ 
・ToDo​ 
#制約条件 ​
・**必ず全ての内容を参照してから、議事録を作成してください。**
・複数人で同じマイクを利用している場合があるので、発言数が多い参加者は" 他"を末尾につける。
・決定事項、Todoは重要なキーワードを取りこぼさない。 ​
・期日が明確に設定されている場合は、省略せず文章中に記載すること。
 ​・文章の意味を変更しない。名詞は言い換え・変換しない。 ​
・架空の参加者、表現や言葉を使用しない。​ 
・前後の文章から言葉を推測して保管した場合は、その旨を記載する。
・ToDoは以下のフォーマットに合わせること。​ [Todo内容] ([Todoの担当者名])​ 
・見やすさを心がけ、マークダウン形式で表示してください。`;

    // マルチフォーマット出力指示を追加
    const multiFormatInstruction = `

###出力形式　以下3種の異なる[## 整形条件]で、洗練され、美しく、読みやすい3種の[## 出力形式]に整形してください

## 整形要件

1. HTML形式:
   - 適切なHTML5タグを使用し、セマンティックな構造を作成
   - レスポンシブデザインを考慮したCSSスタイルを適用
   - 読みやすいフォント、適切な行間、余白を設定
   - 必要に応じて見出しの階層構造を整理
   - 色彩やコントラストを考慮し、視認性を向上

2. Word対応RTF形式:
   - 一貫したフォントとサイズを使用
   - 段落スタイルを適切に設定し、文書構造を明確化
   - ヘッダー、フッター、ページ番号を追加
   - 必要に応じて目次を自動生成
   - 余白、行間、段落間隔を適切に調整

3. GitHub対応Markdown形式:
   - 適切な見出しレベル(#, ##, ###)を使用
   - リスト、引用、コードブロックを効果的に活用
   - 強調やリンクを適切に配置
   - 表組みが必要な場合は整形して追加
   - 必要に応じて水平線で文書構造を明確化

各形式で共通の注意点:
- 文章の論理的構造を維持・強化
- 重要な情報を視覚的に強調
- 一貫性のあるスタイルを適用
- 長文の場合は適切に分割し、読みやすさを向上

##出力形式
各形式で整形された文書の例を以下のように出力してください：

\`\`\`html
<!-- HTMLの例 -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>整形されたHTML文書</title>
    <style>
        /* ここにCSSスタイルを記述 */
    </style>
</head>
<body>
    <!-- ここに整形されたHTML本文を記述 -->
</body>
</html>
\`\`\`

\`\`\`rtf
{\\\\rtf1\\\\ansi\\\\deff0
{\\\\fonttbl{\\\\f0\\\\fnil\\\\fcharset128 MS Gothic;}{\\\\f1\\\\fnil\\\\fcharset0 Arial;}}
{\\\\colortbl ;\\\\red0\\\\green0\\\\blue0;}
\\\\viewkind4\\\\uc1\\\\pard\\\\cf1\\\\f0\\\\fs24
// ここに日本語対応RTFフォーマットの文書を記述
// 日本語文字は\\\\f0（MS Gothic）を使用
// 英数字は\\\\f1（Arial）を使用
}
\`\`\`

\`\`\`markdown
# 整形されたMarkdown文書

## 見出し2

### 見出し3

- リストアイテム1
- リストアイテム2

> 引用文

**強調テキスト**

[リンク](https://example.com)

---

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |
\`\`\``;

    // AI幻覚防止の厳格な指示を追加
    const antiHallucinationInstruction = `

【⚠️ 重要：AI幻覚防止ルール】
以下のルールを厳格に遵守してください：

1. **文章補完の絶対禁止**
   - 文字起こしテキストに含まれていない情報を勝手に追加しない
   - 推測や憶測による内容の補完を一切行わない
   - 不明瞭な部分は「[不明瞭]」として明記する

2. **事実の忠実な再現**
   - 文字起こしテキストの内容のみを基に議事録を作成
   - 文脈から推測される内容も追加しない
   - 専門用語や固有名詞は元のテキスト通りに記載

3. **不完全な情報の扱い**
   - 音声が聞き取れない部分は「[音声不明瞭]」と記載
   - 文章が途中で切れている場合は「[発言途中]」と記載
   - 確実でない情報は記載しない

4. **業務文書としての信頼性**
   - このアプリは業務で使用されるため、正確性を最優先
   - 勝手な文章生成や事実と異なる内容は厳禁
   - 元のテキストに忠実であることを最重要視

これらのルールに違反した場合、業務に重大な影響を与える可能性があります。`;

    // 最終プロンプト構築
    const finalPrompt = `${basePromptContent}${multiFormatInstruction}${antiHallucinationInstruction}

【文字起こしテキスト】
${transcription}`;

    // カスタムプロンプトがある場合は追加
    if (options.customPrompt) {
      return `${finalPrompt}\n\n【追加要求】\n${options.customPrompt}`;
    }

    return finalPrompt;
  }

  /**
   * マルチフォーマット応答をパースして各フォーマットを抽出
   */
  private parseMultiFormatResponse(content: string): {
    markdown: string;
    html: string;
    rtf: string;
  } {
    // コードブロック形式での抽出を試行
    const htmlMatch = content.match(/```html\s*([\s\S]*?)```/i);
    const rtfMatch = content.match(/```rtf\s*([\s\S]*?)```/i);
    const markdownMatch = content.match(/```markdown\s*([\s\S]*?)```/i);
    
    // フォールバック: 旧形式での抽出も試行
    const htmlFallback = content.match(/\[HTML_START\]([\s\S]*?)\[HTML_END\]/);
    const rtfFallback = content.match(/\[RTF_START\]([\s\S]*?)\[RTF_END\]/);
    const markdownFallback = content.match(/\[MARKDOWN_START\]([\s\S]*?)\[MARKDOWN_END\]/);
    
    // 抽出結果を取得
    const extractedHtml = (htmlMatch?.[1] || htmlFallback?.[1] || '').trim();
    const extractedRtf = (rtfMatch?.[1] || rtfFallback?.[1] || '').trim();
    const extractedMarkdown = (markdownMatch?.[1] || markdownFallback?.[1] || '').trim();
    
    // デバッグログ
    console.log('マルチフォーマット抽出結果:', {
      html: extractedHtml.length > 0 ? `${extractedHtml.substring(0, 100)}...` : '空',
      rtf: extractedRtf.length > 0 ? `${extractedRtf.substring(0, 100)}...` : '空',
      markdown: extractedMarkdown.length > 0 ? `${extractedMarkdown.substring(0, 100)}...` : '空',
    });
    
    return {
      html: extractedHtml,
      rtf: extractedRtf,
      markdown: extractedMarkdown,
    };
  }

  /**
   * HTMLからMarkdownへの簡易変換（フォールバック用）
   */
  private convertHTMLToMarkdown(html: string): string {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * 自然言語からMinutesDataを構築（構造化データ抽出）
   */
  private extractStructuredDataFromText(content: string): {
    title: string;
    participants: string[];
    summary: string;
    keyPoints: string[];
    actionItems: any[];
  } {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let title = '生成された議事録';
    let participants: string[] = [];
    let summary = '';
    let keyPoints: string[] = [];
    let actionItems: any[] = [];
    
    let currentSection = '';
    let summaryLines: string[] = [];
    
    for (const line of lines) {
      // タイトル抽出
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim();
        continue;
      }
      
      // セクション判定
      if (line.includes('要約') || line.includes('サマリー')) {
        currentSection = 'summary';
        continue;
      } else if (line.includes('主要') || line.includes('ポイント') || line.includes('重要')) {
        currentSection = 'keyPoints';
        continue;
      } else if (line.includes('アクション') || line.includes('TODO') || line.includes('ToDo')) {
        currentSection = 'actionItems';
        continue;
      } else if (line.includes('参加者')) {
        currentSection = 'participants';
        continue;
      }
      
      // 参加者抽出
      if (currentSection === 'participants' && (line.includes(':') || line.includes('、') || line.includes(','))) {
        const participantText = line.replace(/^[*\-\s]*/, '').replace(/.*?:/, '');
        const names = participantText.split(/[、,]/).map(name => name.trim()).filter(name => name);
        participants.push(...names);
      }
      
      // 要約抽出
      if (currentSection === 'summary' && !line.startsWith('#') && !line.startsWith('##')) {
        summaryLines.push(line.replace(/^[*\-\s]*/, ''));
      }
      
      // キーポイント抽出
      if (currentSection === 'keyPoints' && (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('・'))) {
        keyPoints.push(line.replace(/^[*\-・\s]*/, '').replace(/\*\*(.*?)\*\*/, '$1'));
      }
      
      // アクション項目抽出
      if (currentSection === 'actionItems' && (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('・'))) {
        const taskText = line.replace(/^[*\-・\s]*/, '').replace(/\*\*(.*?)\*\*/, '$1');
        const assigneeMatch = taskText.match(/担当[者人]?[：:]\s*([^,、\s]+)/);
        const dueDateMatch = taskText.match(/期限[：:]\s*([^,、\s]+)/);
        
        actionItems.push({
          task: taskText.split('(')[0].trim(),
          assignee: assigneeMatch?.[1] || '未定',
          dueDate: dueDateMatch?.[1] || null,
        });
      }
    }
    
    // サマリーを50文字に短縮
    const fullSummary = summaryLines.join(' ').trim() || content.substring(0, 200) + '...';
    summary = this.shortenSummary(fullSummary, 50);
    
    // 参加者が抽出できない場合のフォールバック
    if (participants.length === 0) {
      participants = ['参加者A'];
    }
    
    return { title, participants, summary, keyPoints, actionItems };
  }

  /**
   * サマリーを指定文字数に短縮
   */
  private shortenSummary(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    
    // 文の境界で切断を試行
    const sentences = text.split(/[。！？]/);
    let result = '';
    
    for (const sentence of sentences) {
      const nextResult = result + sentence + (sentence.trim() ? '。' : '');
      if (nextResult.length <= maxLength) {
        result = nextResult;
      } else {
        break;
      }
    }
    
    // 文の境界で切断できない場合は文字数で切断
    if (result.length === 0 || result.length < maxLength * 0.7) {
      result = text.substring(0, maxLength - 3) + '...';
    }
    
    return result.trim();
  }

  /**
   * AI APIで概要を生成（改行等読みやすさを担保）
   */
  private async generateOverviewSummary(content: string): Promise<string> {
    try {
      const systemPrompt = `あなたは議事録の概要作成専門家です。
以下の要件に従って、読みやすい概要を作成してください：

【要件】
- 50文字以内で簡潔にまとめる
- 改行を適切に使用し、読みやすくする
- 最も重要なポイントを1-2つに絞る
- 専門用語は避け、分かりやすい表現を使用
- 決して勝手に文章を補完しない
- 与えられた内容に忠実に要約する

【出力形式】
- 単一の段落として出力
- 必要に応じて改行を含める
- 句読点を適切に配置`;

      const response = await this.api.post('/chat/completions', {
        model: 'gpt-4o-mini', // 軽量モデルで十分
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下の議事録内容から概要を作成してください：\n\n${content.substring(0, 2000)}` }
        ],
        temperature: 0.2,
        max_tokens: 100,
      });

      const generatedSummary = response.data.choices[0].message.content;
      
      // 50文字制限を確実に適用
      return this.shortenSummary(generatedSummary, 50);
    } catch (error) {
      console.error('概要生成エラー:', error);
      // エラー時は従来の方法でフォールバック
      return this.shortenSummary(content.substring(0, 200), 50);
    }
  }

  /**
   * Markdown形式の議事録をWord文書（docx）に変換
   */
  private async generateWordDocument(markdownContent: string): Promise<string> {
    try {
      // Markdownを解析してWord文書を作成
      const doc = new Document({
        sections: [
          {
            children: this.parseMarkdownToDocx(markdownContent),
          },
        ],
      });

      // docxファイルを生成（ブラウザ環境でBase64として出力）
      const buffer = await Packer.toBase64String(doc);
      return buffer;
    } catch (error) {
      console.error('Word文書の生成に失敗しました:', error);
      throw new Error('Word文書の生成に失敗しました');
    }
  }

  /**
   * Markdownテキストを解析してdocxのParagraphに変換
   */
  private parseMarkdownToDocx(markdown: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = markdown.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        // 空行はスペースとして追加
        paragraphs.push(new Paragraph({
          children: [new TextRun(' ')],
        }));
        continue;
      }
      
      // 見出し（# ## ###）
      if (line.startsWith('# ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({
            text: line.substring(2),
            bold: true,
          })],
        }));
      } else if (line.startsWith('## ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({
            text: line.substring(3),
            bold: true,
          })],
        }));
      } else if (line.startsWith('### ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({
            text: line.substring(4),
            bold: true,
          })],
        }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // リスト項目
        paragraphs.push(new Paragraph({
          children: [new TextRun({
            text: `• ${line.substring(2)}`,
          })],
          indent: {
            left: 400,
          },
        }));
      } else if (line.match(/^\d+\. /)) {
        // 番号付きリスト
        paragraphs.push(new Paragraph({
          children: [new TextRun({
            text: line,
          })],
          indent: {
            left: 400,
          },
        }));
      } else {
        // 通常のテキスト
        const textRuns = this.parseInlineMarkdown(line);
        paragraphs.push(new Paragraph({
          children: textRuns,
        }));
      }
    }
    
    return paragraphs;
  }



  /**
   * インラインMarkdown（太字、斜体）を解析
   */
  private parseInlineMarkdown(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let currentText = text;
    
    // 太字 **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = currentText.split(boldRegex);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i % 2 === 1) {
        // 太字部分
        runs.push(new TextRun({
          text: part,
          bold: true,
        }));
      } else if (part) {
        // 通常テキスト
        runs.push(new TextRun({
          text: part,
        }));
      }
    }
    
    return runs.length > 0 ? runs : [new TextRun(text)];
  }

  async generateMinutes(
    transcription: string,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<MinutesData> {
    await this.ensureAuthenticated();

    const authMethod = this.authService.getAuthMethod();
    const authMethodText = authMethod === 'corporate' ? '企業アカウント' : '個人アカウント';

    return await ErrorHandler.executeWithRetry(
      async () => {
        // 進捗更新
        onProgress?.({
          stage: 'generating',
          percentage: 20,
          currentTask: `AIが議事録を生成中... (${authMethodText})`,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_2',
            timestamp: new Date(),
            level: 'info',
            message: `AIによる議事録生成を開始しました (${authMethodText})`,
          }],
          startedAt: new Date(),
        });

        // マルチフォーマットプロンプトの構築
        const prompt = this.buildMultiFormatPrompt(transcription, options);

        // GPT APIに送信
        const systemPrompt = `あなたは議事録作成のプロフェッショナルです。指定された形式で高品質な議事録を作成してください。必ず全ての形式（MARKDOWN、HTML、RTF）で出力してください。`;

        const isReasoningModel = options.minutesModel === 'o3';

        const baseParams: any = {
          model: options.minutesModel,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ],
        };

        const apiParams: any = isReasoningModel
          ? {
              ...baseParams,
              max_completion_tokens: 30000, // 30,000トークンに設定
            }
          : {
              ...baseParams,
              temperature: 0.3,
              max_tokens: 30000, // 30,000トークンに設定
            };

        try {
          if (onProgress) onProgress({
            stage: 'generating',
            percentage: 80,
            currentTask: 'AIリクエストを送信中...',
            estimatedTimeRemaining: 0,
            logs: [{
              id: Date.now().toString() + '_api',
              timestamp: new Date(),
              level: 'info',
              message: `OpenAI API にリクエスト送信 (${authMethodText})`,
            }],
            startedAt: new Date(),
          });

          console.log('OpenAI API リクエスト:', {
            ...apiParams,
            messages: `[${apiParams.messages.length} messages]`,
          });

          const response = await this.api.post('/chat/completions', apiParams);

          if (onProgress) onProgress({
            stage: 'generating',
            percentage: 90,
            currentTask: 'AIレスポンスを受信しました。解析中...',
            estimatedTimeRemaining: 0,
            logs: [{
              id: Date.now().toString() + '_resp',
              timestamp: new Date(),
              level: 'info',
              message: `OpenAI API レスポンス受信 (${authMethodText})`,
            }],
            startedAt: new Date(),
          });

          // 進捗更新
          onProgress?.({
            stage: 'generating',
            percentage: 95,
            currentTask: '議事録を美しく整形中...',
            estimatedTimeRemaining: 0,
            logs: [{
              id: Date.now().toString() + '_3',
              timestamp: new Date(),
              level: 'success',
              message: `AIによる議事録生成が完了しました (${authMethodText})`,
            }],
            startedAt: new Date(),
          });

          // 結果を解析して構造化
          const generatedContent = response.data.choices[0].message.content;
          return await this.parseMultiFormatMinutes(generatedContent, options, transcription);
        } catch (error) {
          console.error('OpenAI API レスポンスエラー:', error);
          throw new Error('議事録の生成に失敗しました');
        }
      },
      (message, attempt, maxRetries) => {
        // エラーハンドリング中の進捗更新
        onProgress?.({
          stage: 'generating',
          percentage: 20,
          currentTask: message,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_retry',
            timestamp: new Date(),
            level: 'warning',
            message: `${message} (${attempt}/${maxRetries}回目)`,
          }],
          startedAt: new Date(),
        });
      },
      {
        maxRetries: 5,
        baseDelay: 3000,
        maxDelay: 120000,
        backoffMultiplier: 2,
      }
    );
  }

  /**
   * マルチフォーマット議事録を解析して構造化データに変換
   */
  private async parseMultiFormatMinutes(content: string, options: ProcessingOptions, transcription?: string): Promise<MinutesData> {
    const now = new Date();

    // 文字起こしデータを適切に構造化（時間情報なし）
    let transcriptionSegments: any[] = [];
    if (transcription) {
      const sentences = this.splitTranscriptionIntoSentences(transcription);
      transcriptionSegments = sentences.map((sentence, index) => ({
        id: (index + 1).toString(),
        speakerId: null,
        text: sentence.trim(),
      }));
    }

    // マルチフォーマット応答をパース
    const formats = this.parseMultiFormatResponse(content);
    
    // フォールバック処理
    if (!formats.markdown && formats.html) {
      formats.markdown = this.convertHTMLToMarkdown(formats.html);
    }
    if (!formats.html && formats.markdown) {
      formats.html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>議事録</title></head><body><pre>${formats.markdown}</pre></body></html>`;
    }
    
    // RTF生成の問題を特定するためのログ
    if (!formats.rtf) {
      console.warn('RTF抽出に失敗しました。API応答を確認してください:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 500),
        hasRtfKeyword: content.includes('rtf'),
        hasRtfCodeBlock: content.includes('```rtf'),
      });
    }
    
    // 全て空の場合は元のcontentを使用
    if (!formats.markdown && !formats.html && !formats.rtf) {
      console.warn('全フォーマットの抽出に失敗、元コンテンツを使用');
      formats.markdown = content;
      formats.html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>議事録</title></head><body><pre>${content}</pre></body></html>`;
      // RTFは空のままにして、API側の問題を明確にする
    }

    // 構造化データを抽出（Markdownから）
    const structuredData = this.extractStructuredDataFromText(formats.markdown || content);

    // AI APIで概要を生成（改行等読みやすさを担保）
    let aiGeneratedSummary: string;
    try {
      aiGeneratedSummary = await this.generateOverviewSummary(formats.markdown || content);
    } catch (error) {
      console.warn('概要生成に失敗しました:', error);
      aiGeneratedSummary = structuredData.summary;
    }

    // Word文書（docx）を生成
    let wordDocumentBase64: string | null = null;
    try {
      if (formats.markdown) {
        wordDocumentBase64 = await this.generateWordDocument(formats.markdown);
      }
    } catch (error) {
      console.warn('Word文書の生成に失敗しました:', error);
    }

    // 参加者データを構築（発言時間なし）
    const participantsArr = structuredData.participants.map((name: string, index: number) => ({
      id: (index + 1).toString(),
      name: name,
      role: index === 0 ? '司会' : '参加者',
    }));

    // キーポイントデータを構築（タイムスタンプなし）
    const keyPointsArr = structuredData.keyPoints.map((point: string, index: number) => ({
      id: (index + 1).toString(),
      content: point,
      importance: 'medium' as const,
    }));

    // アクション項目データを構築（タイムスタンプなし）
    const actionItemsArr = structuredData.actionItems.map((item: any, index: number) => ({
      id: (index + 1).toString(),
      task: item.task,
      assignee: item.assignee || '未定',
      priority: 'medium' as const,
      status: 'pending' as const,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    }));

    const durationSec = 0; // 時間情報は削除

    // 出力データを構築（3形式同時生成）
    const outputsArr: GeneratedOutput[] = [
      {
        format: 'markdown' as OutputFormat,
        content: formats.markdown || '議事録の生成に失敗しました。',
        generatedAt: now,
        size: (formats.markdown || '').length,
      },
      {
        format: 'html' as OutputFormat,
        content: formats.html || '<!DOCTYPE html><html><body>議事録の生成に失敗しました。</body></html>',
        generatedAt: now,
        size: (formats.html || '').length,
      },
      {
        format: 'word' as OutputFormat,
        content: wordDocumentBase64 || 'Word文書の生成に失敗しました',
        generatedAt: now,
        size: wordDocumentBase64 ? wordDocumentBase64.length : 0,
      }
    ];

    const minutesData: MinutesData = {
      id: Date.now().toString(),
      title: structuredData.title,
      date: now,
      duration: durationSec,
      participants: participantsArr,
      summary: aiGeneratedSummary,
      keyPoints: keyPointsArr,
      actionItems: actionItemsArr,
      transcription: transcriptionSegments,
      outputs: outputsArr,
      metadata: {
        version: '1.0.0',
        generatedAt: now,
        processingTime: 0,
        tokensUsed: 0,
        model: options.minutesModel,
        quality: 'standard', // 固定値
      },
    };

    return minutesData;
  }

  /**
   * 文字起こしテキストを文章単位で分割
   */
  private splitTranscriptionIntoSentences(transcription: string): string[] {
    if (!transcription || typeof transcription !== 'string') {
      return [];
    }

    // 改行や句読点で文章を分割
    const sentences = transcription
      // 1. 文末（。！？）の後で分割
      .split(/([。！？])\s*/)
      .reduce((acc: string[], current: string, index: number, array: string[]) => {
        if (index % 2 === 0) {
          // 偶数インデックス：文章部分
          const sentence = current.trim();
          if (sentence) {
            // 次の要素が句読点の場合は結合
            const punctuation = array[index + 1];
            acc.push(sentence + (punctuation || ''));
          }
        }
        return acc;
      }, [])
      // 2. 長い文章をさらに分割（読点で分割）
      .flatMap(sentence => {
        if (sentence.length > 100) {
          return sentence.split(/([、])\s*/).reduce((acc: string[], current: string, index: number, array: string[]) => {
            if (index % 2 === 0) {
              const part = current.trim();
              if (part) {
                const comma = array[index + 1];
                acc.push(part + (comma || ''));
              }
            }
            return acc;
          }, []);
        }
        return [sentence];
      })
      // 3. 空文字列を除去
      .filter(sentence => sentence.trim().length > 0)
      // 4. 最低限の長さを確保
      .filter(sentence => sentence.trim().length > 5);

    return sentences.length > 0 ? sentences : [transcription];
  }

  /**
   * モデルとオプションに応じて response_format を決定する
   * - gpt-4o-transcribe は verbose_json 非対応 → timestamps ありでも "json" を使用
   * - その他 (例: whisper-1) は timestamps ありなら "verbose_json" を使用
   * - timestamps が false の場合はフォーマット指定しない (API デフォルト: text)
   */
  private determineResponseFormat(model: string, timestamps: boolean): string | null {
    if (!timestamps) return null;
    // 現状、仕様書で許可されている音声モデルは gpt-4o-transcribe のみ
    // 将来モデルが増えた場合の拡張を考慮して switch
    switch (model) {
      case 'gpt-4o-transcribe':
        return 'json'; // verbose_json 未対応
      default:
        return 'verbose_json';
    }
  }
}

// シングルトンインスタンス
export const openaiService = new OpenAIService(); 