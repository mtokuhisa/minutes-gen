// ===========================================
// MinutesGen v1.0 - OpenAI API サービス（認証システム統合）
// ===========================================

import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { getValidatedAPIConfig, getCorporateStatus, DEFAULT_API_CONFIG } from '../config/api';
import { AuthService } from './authService';
import { AudioFile, ProcessingOptions, MinutesData, ProcessingProgress, GeneratedOutput, OutputFormat } from '../types';
import { getAudioProcessor } from './audioProcessorFactory';
import { initializePromptStore, getActivePrompt, getAllPrompts } from './promptStore';
import { ErrorHandler, APIError } from './errorHandler';
import { md2docxService } from './md2docxService';
import Encoding from 'encoding-japanese';
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

        // 文字起こし結果を取得
        const rawTranscriptionText = response.data.text || response.data;
        
        // 文字エンコーディングを適切に処理
        const transcriptionText = this.processTextEncoding(rawTranscriptionText);
        
        return transcriptionText;
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
      // 適切な音声プロセッサーで音声ファイルを分割（1倍速固定）
      const audioProcessor = getAudioProcessor();
      const segments = await audioProcessor.processLargeAudioFile(file, 600, onProgress);
      
      const transcriptSegments: string[] = [];
      
      // 各セグメントを順次文字起こし
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // 進捗更新 (セグメント文字起こし開始)
        onProgress?.({
          stage: 'transcribing',
          percentage: 70 + Math.round((i / segments.length) * 25),
          currentTask: `🤖 AI が音声を文字にしています...${i + 1}/${segments.length}`,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_seg_' + i,
            timestamp: new Date(),
            level: 'info',
            message: `音声セグメント ${i + 1}/${segments.length} (${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s) をAIが処理中`,
          }],
          startedAt: new Date(),
        });

        // セグメントファイルを作成（メモリ効率化）
        let segmentBlob = segment.blob;
        
        // ファイルパスベースの場合は、処理時に読み込む（メモリ効率化）
        if ((segment as any)._filePath && typeof window !== 'undefined' && window.electronAPI) {
          try {
            const result = await window.electronAPI.audioProcessor.readSegmentFile((segment as any)._filePath);
            if (result.success && result.data) {
              // base64データをUint8Arrayに変換（レンダラープロセスでBufferは使用できない）
              const binaryString = atob(result.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              segmentBlob = new Blob([bytes], { type: 'audio/wav' });
            } else {
              throw new Error(result.error || 'ファイル読み込みエラー');
            }
          } catch (error) {
            console.error('セグメントファイル読み込みエラー:', error);
            throw new Error(`セグメント${i + 1}の読み込みに失敗しました`);
          }
        }
        
        const segmentFile = new File([segmentBlob], segment.name, { type: file.rawFile.type });
        
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

        const rawSegmentText = (response.data.text as string).trim();
        
        // 文字エンコーディングを適切に処理
        const segmentText = this.processTextEncoding(rawSegmentText);
        
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

2. Word対応Markdown形式:
   - 適切な見出しレベル(#, ##, ###)を使用
   - リスト、引用、コードブロックを効果的に活用
   - 強調やリンクを適切に配置
   - 表組みが必要な場合は整形して追加
   - 日本語文書に適したMarkdown記法を使用
   - 段落スタイルを適切に設定し、文書構造を明確化

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

\`\`\`markdown
# 議事録

## 会議のタイトル
YYYY年MM月DD日 会議議事録

## 会議参加者
- 参加者A
- 参加者B
- 参加者C

## 要約
会議の要約内容をここに記述

## 詳細
### 議題1
詳細な内容を記述

### 議題2
詳細な内容を記述

## 決定事項
- 決定事項1
- 決定事項2

## ToDo
- [ ] タスク1（担当者A）
- [ ] タスク2（担当者B）
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

1. **文字化けチェック（最重要）**
   - 文字起こしテキストが人が話す言語として有り得ない文章の場合は、議事録生成を中止
   - 以下のような文字化けパターンを検出した場合は、議事録生成を中止：
     * 「�g�����X�N���v�g」のような文字化け文字列
     * 「ƒAƒvƒŠƒP[ƒVƒ‡ƒ"」のような記号混在文
     * 「¤¹¤ì¤Ï¤³¤ó¤Ë¤Á¤Ï」のような記号連続文
     * 「䛣䛾䝥䝻䝆䜵䜽䝖」のような意味不明な文字列
     * アセンブリ言語のような機械的文字列
   - 文字化けを検出した場合は、以下の形式で明確にエラーを出力：
     \`\`\`
     【エラー：文字化けを検出しました】
     原因：入力されたテキストに文字化けが含まれており、正確な議事録を生成できません。
     対処方法：
     1. 元のファイルの文字エンコーディングを確認してください
     2. UTF-8形式で保存し直してください
     3. 再度アップロードしてください
     文字化け箇所：[具体的な文字化け部分を示す]
     \`\`\`
   - 文字化けが疑われる場合は、推測や補完を行わず、必ずエラーを出力

2. **文章補完の絶対禁止**
   - 文字起こしテキストに含まれていない情報を勝手に追加しない
   - 推測や憶測による内容の補完を一切行わない
   - 不明瞭な部分は「[不明瞭]」として明記する

3. **事実の忠実な再現**
   - 文字起こしテキストの内容のみを基に議事録を作成
   - 文脈から推測される内容も追加しない
   - 専門用語や固有名詞は元のテキスト通りに記載

4. **不完全な情報の扱い**
   - 音声が聞き取れない部分は「[音声不明瞭]」と記載
   - 文章が途中で切れている場合は「[発言途中]」と記載
   - 確実でない情報は記載しない

5. **業務文書としての信頼性**
   - このアプリは業務で使用されるため、正確性を最優先
   - 勝手な文章生成や事実と異なる内容は厳禁
   - 元のテキストに忠実であることを最重要視

6. **タイトル生成の重要ルール**
   - 会議のタイトルは「YYYY年MM月DD日 会議議事録」の形式で生成
   - 技術的な説明（「Microsoft Word対応」「Markdown文書」等）は絶対に使用しない
   - 文字起こしテキストから会議の内容を判断し、適切な会議名を生成

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
    wordMarkdown: string;
  } {
    // コードブロック形式での抽出を試行
    const htmlMatch = content.match(/```html\s*([\s\S]*?)```/i);
    const wordMarkdownMatch = content.match(/```markdown\s*([\s\S]*?)```/i);
    const generalMarkdownMatch = content.match(/```markdown\s*([\s\S]*?)```/i);
    
    // フォールバック: 旧形式での抽出も試行
    const htmlFallback = content.match(/\[HTML_START\]([\s\S]*?)\[HTML_END\]/);
    const markdownFallback = content.match(/\[MARKDOWN_START\]([\s\S]*?)\[MARKDOWN_END\]/);
    
    // 抽出結果を取得
    const extractedHtml = (htmlMatch?.[1] || htmlFallback?.[1] || '').trim();
    const extractedWordMarkdown = (wordMarkdownMatch?.[1] || '').trim();
    const extractedMarkdown = (generalMarkdownMatch?.[1] || markdownFallback?.[1] || '').trim();
    
    // デバッグログ
    console.log('マルチフォーマット抽出結果:', {
      html: extractedHtml.length > 0 ? `${extractedHtml.substring(0, 100)}...` : '空',
      wordMarkdown: extractedWordMarkdown.length > 0 ? `${extractedWordMarkdown.substring(0, 100)}...` : '空',
      markdown: extractedMarkdown.length > 0 ? `${extractedMarkdown.substring(0, 100)}...` : '空',
    });
    
    console.log('元のレスポンス内容（先頭500文字）:', content.substring(0, 500));
    console.log('抽出パターンのマッチ状況:', {
      htmlMatch: !!htmlMatch,
      wordMarkdownMatch: !!wordMarkdownMatch,
      generalMarkdownMatch: !!generalMarkdownMatch,
      htmlFallback: !!htmlFallback,
      markdownFallback: !!markdownFallback
    });
    
    return {
      html: extractedHtml,
      wordMarkdown: extractedWordMarkdown,
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
      // タイトル抽出（技術説明を除外）
      if (line.startsWith('# ')) {
        const extractedTitle = line.replace('# ', '').trim();
        // 技術説明タイトルを除外し、会議名を自動生成
        if (extractedTitle && 
            !extractedTitle.includes('Microsoft Word') &&
            !extractedTitle.includes('Markdown文書') &&
            !extractedTitle.includes('Markdown') &&
            !extractedTitle.includes('Word対応') &&
            !extractedTitle.includes('整形された') &&
            !extractedTitle.includes('HTML文書') &&
            !extractedTitle.includes('文書') &&
            !extractedTitle.includes('対応') &&
            extractedTitle !== '議事録' &&
            extractedTitle.length > 3) {
          title = extractedTitle;
        } else {
          // 会議名を自動生成
          const today = new Date();
          const dateStr = today.toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          title = `${dateStr} 会議議事録`;
        }
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
   * 議事録内容から50文字以内の要約を生成
   */
  private async generateOverviewSummary(content: string): Promise<string> {
    try {
      const systemPrompt = `あなたは議事録の要約作成専門家です。
以下の要件に従って、簡潔な要約を作成してください：

【要件】
- 50文字以内で簡潔にまとめる
- 会議の最も重要なポイントを1-2つに絞る
- 専門用語は避け、分かりやすい表現を使用
- 決して勝手に文章を補完しない
- 与えられた内容に忠実に要約する

【出力形式】
- 単一の段落として出力
- 句読点を適切に配置`;

      const response = await this.api.post('/chat/completions', {
        model: 'gpt-4o-mini', // 軽量モデルで十分
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下の議事録内容から50文字以内の要約を作成してください：\n\n${content.substring(0, 2000)}` }
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
   * MarkdownからDOCXバイナリデータを生成
   */
  private async generateDOCXFromMarkdown(markdownContent: string): Promise<Uint8Array> {
    try {
      console.log('DOCX生成開始:', {
        contentLength: markdownContent.length,
        contentPreview: markdownContent.substring(0, 300)
      });
      
      // MD2DOCXサービスを使用してDOCXを生成
      const docxBuffer = await md2docxService.generateHighQualityDOCX(markdownContent);
      
      console.log('DOCX生成完了:', {
        docxLength: docxBuffer.length,
        docxType: typeof docxBuffer
      });
      
      return docxBuffer;
    } catch (error) {
      console.error('DOCX生成に失敗しました:', error);
      throw new Error(`DOCX生成エラー: ${error.message}`);
    }
  }

  /**
   * 文字エンコーディングを適切に処理する
   */
  private processTextEncoding(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    try {
      // デバッグ情報: 元のテキストの最初の200文字を表示
      console.log('文字エンコーディング処理開始:', {
        textLength: text.length,
        textPreview: text.substring(0, 200),
        textType: typeof text,
      });

      // 文字化け検出パターン
      const corruptionPatterns = [
        /[\u0080-\u00BF]/g,  // 不正なUTF-8バイト
                 /[\uFFFD]/g,         // 置換文字
         /�/g,                // 文字化け記号
      ];

      // 文字化けが検出された場合の処理
      let hasCorruption = false;
      const detectedPatterns: string[] = [];
      
      for (let i = 0; i < corruptionPatterns.length; i++) {
        const pattern = corruptionPatterns[i];
        const matches = text.match(pattern);
        if (matches) {
          hasCorruption = true;
          detectedPatterns.push(`パターン${i + 1}: ${matches.length}個の文字化け文字`);
        }
      }

      if (hasCorruption) {
        console.warn('文字化けを検出しました:', {
          detectedPatterns,
          textLength: text.length,
          textPreview: text.substring(0, 200),
        });
        
        // encoding-japaneseを使用して文字エンコーディングを修復
        try {
          // 文字列をUint8Arrayに変換
          const textBytes = new TextEncoder().encode(text);
          
          // 日本語エンコーディングを自動判定
          const detected = Encoding.detect(textBytes);
          console.log('エンコーディング自動判定結果:', {
            detected,
            bytesLength: textBytes.length,
            originalLength: text.length,
          });
          
          // 適切なエンコーディングで文字列を変換
          if (detected && detected !== 'UTF8') {
            const convertedBytes = Encoding.convert(textBytes, {
              to: 'UTF8',
              from: detected,
            });
            const fixedText = new TextDecoder('utf-8').decode(new Uint8Array(convertedBytes));
            console.log('エンコーディング修復完了:', {
              originalLength: text.length,
              fixedLength: fixedText.length,
              fixedPreview: fixedText.substring(0, 200),
            });
            return fixedText;
          }
        } catch (encodingError) {
          console.warn('encoding-japaneseによる修復に失敗:', encodingError);
        }

        // フォールバック: 文字化け文字を除去
        let cleanedText = text;
        let removedCount = 0;
        
        for (const pattern of corruptionPatterns) {
          const beforeLength = cleanedText.length;
          cleanedText = cleanedText.replace(pattern, '');
          removedCount += beforeLength - cleanedText.length;
        }
        
        // 連続する空白を正規化
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        
        console.log('文字化け除去処理完了:', {
          originalLength: text.length,
          cleanedLength: cleanedText.length,
          removedCount,
          cleanedPreview: cleanedText.substring(0, 200),
        });
        
        return cleanedText;
      }

      // 文字化けが検出されなかった場合
      console.log('文字化けは検出されませんでした。テキストは正常です。');
      return text;
    } catch (error) {
      console.error('文字エンコーディング処理エラー:', error);
      return text; // エラーが発生した場合は元のテキストを返す
    }
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
    
    // Word用Markdown生成の問題を特定するためのログ
    if (!formats.wordMarkdown) {
      console.warn('Word用Markdown抽出に失敗しました。API応答を確認してください:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 500),
        hasMarkdownKeyword: content.includes('markdown'),
        hasMarkdownCodeBlock: content.includes('```markdown'),
      });
    }
    
    // 全て空の場合は元のcontentを使用
    if (!formats.markdown && !formats.html && !formats.wordMarkdown) {
      console.warn('全フォーマットの抽出に失敗、元コンテンツを使用');
      formats.markdown = content;
      formats.html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>議事録</title></head><body><pre>${content}</pre></body></html>`;
      formats.wordMarkdown = content;
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

    // DOCX文書を生成（Word対応）
    let docxBuffer: Uint8Array;
    try {
      console.log('DOCX生成開始:', {
        hasWordMarkdown: !!formats.wordMarkdown,
        wordMarkdownLength: formats.wordMarkdown?.length || 0,
        wordMarkdownPreview: formats.wordMarkdown?.substring(0, 200) || 'なし'
      });
      
      let markdownForDOCX: string;
      
      if (formats.wordMarkdown && formats.wordMarkdown.trim()) {
        console.log('Word用Markdown形式が抽出されました');
        markdownForDOCX = formats.wordMarkdown;
        console.log('抽出されたWord用Markdownの最初の500文字:', formats.wordMarkdown.substring(0, 500));
      } else {
        console.warn('Word用Markdown形式が見つからないため、フォールバック処理を実行');
        // フォールバック: 通常のMarkdownまたはHTMLから変換
        markdownForDOCX = formats.markdown || this.convertHTMLToMarkdown(content);
        console.log('フォールバックMarkdown生成完了:', {
          markdownLength: markdownForDOCX.length,
          markdownPreview: markdownForDOCX.substring(0, 200)
        });
      }
      
      // MarkdownからDOCXを生成
      docxBuffer = await this.generateDOCXFromMarkdown(markdownForDOCX);
      console.log('DOCX生成完了:', {
        docxSize: docxBuffer.length
      });
      
    } catch (error) {
      console.error('DOCX文書の生成に失敗しました:', error);
      // 最低限のDOCXファイルを生成（フォールバック）
      try {
        const fallbackMarkdown = content.substring(0, 1000);
        docxBuffer = await this.generateDOCXFromMarkdown(fallbackMarkdown);
      } catch (fallbackError) {
        console.error('フォールバックDOCX生成も失敗:', fallbackError);
        // 空のUint8Arrayを作成（エラー処理）
        const errorText = 'DOCX生成に失敗しました';
        const encoder = new TextEncoder();
        docxBuffer = encoder.encode(errorText);
      }
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
        content: btoa(String.fromCharCode(...docxBuffer)),
        generatedAt: now,
        size: docxBuffer.length,
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