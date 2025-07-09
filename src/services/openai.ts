// ===========================================
// MinutesGen v1.0 - OpenAI API サービス
// ===========================================

import axios, { AxiosInstance } from 'axios';
import { getValidatedAPIConfig } from '../config/api';
import { AudioFile, ProcessingOptions, MinutesData, ProcessingProgress } from '../types';
import { audioProcessor } from './audioProcessor';
import { initializePromptStore, getActivePrompt, getAllPrompts } from './promptStore';
// WebCodecsProcessor はメモリ消費の問題があるため使用を停止
// import { WebCodecsProcessor } from './webCodecsProcessor';

export class OpenAIService {
  private api: AxiosInstance;
  private config;
  /**
   * 80MB を超える音声ファイルはチャンク分割して順次アップロードする。
   * Whisper(GPT-4 Transcribe) エンドポイントの 100MB 制限を安全側に回避。
   */
  private readonly CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB  (Whisper推奨上限25MBの安全マージン)

  constructor() {
    this.config = getValidatedAPIConfig();
    this.api = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutDuration,
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
      },
    });

    // リクエストインターセプター
    this.api.interceptors.request.use(
      (config) => {
        if (this.config.debugLogs) {
          console.log('OpenAI API リクエスト:', config);
        }
        return config;
      },
      (error) => {
        console.error('OpenAI API リクエストエラー:', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.api.interceptors.response.use(
      (response) => {
        if (this.config.debugLogs) {
          console.log('OpenAI API レスポンス:', response);
        }
        return response;
      },
      (error) => {
        console.error('OpenAI API レスポンスエラー:', error);
        
        // 400エラーなど、詳細情報を表示
        if (error.response) {
          console.error('エラーレスポンス詳細:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers
          });
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 音声ファイルを文字起こしする
   */
  async transcribeAudio(
    file: AudioFile,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<string> {
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
    try {
      // 進捗更新
      onProgress?.({
        stage: 'transcribing',
        percentage: 10,
        currentTask: 'AIが音声を文字に変換中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: '音声ファイルをAI文字起こしサービスに送信中...',
        }],
        startedAt: new Date(),
      });

      // ファイルをFormDataに変換
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

      // Content-Type ヘッダーはブラウザに任せる（boundary を正しく付与させる）
      const response = await this.api.post('/audio/transcriptions', formData);

      // 進捗更新
      onProgress?.({
        stage: 'transcribing',
        percentage: 80,
        currentTask: 'AI文字起こし完了',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_1',
          timestamp: new Date(),
          level: 'success',
          message: 'AIによる文字起こしが完了しました',
        }],
        startedAt: new Date(),
      });

      return response.data.text;

    } catch (error) {
      console.error('音声文字起こしエラー:', error);
      throw new Error('音声の文字起こしに失敗しました');
    }
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
      // ffmpeg.wasmで音声ファイルを適切なセグメントに分割
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
   * 分割された文字起こしセグメントを適切にマージする
   */
  private mergeTranscriptSegments(segments: string[]): string {
    if (segments.length === 0) return '';
    if (segments.length === 1) return segments[0];

    const mergedSegments: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      let currentSegment = segments[i];
      
      // 前のセグメントとの連続性をチェック
      if (i > 0) {
        const previousSegment = mergedSegments[mergedSegments.length - 1];
        
        // 前のセグメントが文の途中で終わっているかチェック
        const lastChar = previousSegment.slice(-1);
        const firstChar = currentSegment.charAt(0);
        
        // 文の境界でない場合は適切に連結
        if (lastChar && !['。', '！', '？', '．', '.', '!', '?', '\n'].includes(lastChar)) {
          // 小文字で始まる場合や、明らかに文の続きの場合は空白なしで連結
          if (firstChar === firstChar.toLowerCase() || 
              ['が', 'は', 'を', 'に', 'で', 'から', 'まで', 'と', 'も', 'の', 'や', 'け', 'ど', 'ば', 'て', 'で', 'な', 'ない', 'ます', 'です', 'だ', 'である', 'ですが', 'ので', 'から', 'けれど', 'しかし', 'ただし', 'そして', 'また', 'さらに', 'ただ', 'しかし', 'ところが', 'ところで', 'ちなみに', 'つまり', 'すなわち', 'いわゆる', 'ようは', 'つまり', 'というのは', 'ということは', 'ということで', 'ということから', 'ということに', 'ということも', 'ということが', 'ということを', 'ということは', 'ということで', 'ということから', 'ということに', 'ということも', 'ということが', 'ということを'].some(particle => currentSegment.startsWith(particle))) {
            // 前のセグメントの最後の文字起こしを更新
            mergedSegments[mergedSegments.length - 1] = previousSegment + currentSegment;
            continue;
          } else {
            // 新しい文の開始の場合は適切な区切りを追加
            if (!/\s$/.test(previousSegment)) {
              mergedSegments[mergedSegments.length - 1] = previousSegment + ' ';
            }
          }
        }
      }
      
      mergedSegments.push(currentSegment);
    }
    
    return mergedSegments.join('\n\n');
  }

  /**
   * 文字起こしテキストから議事録を生成する
   */
  async generateMinutes(
    transcription: string,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<MinutesData> {
    try {
      // 進捗更新
      onProgress?.({
        stage: 'generating',
        percentage: 20,
        currentTask: 'AIが議事録を生成中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_2',
          timestamp: new Date(),
          level: 'info',
          message: 'AIによる議事録生成を開始しました',
        }],
        startedAt: new Date(),
      });

      // プロンプトの構築
      const prompt = this.buildMinutesPrompt(transcription, options);

      // GPT APIに送信
      const response = await this.api.post('/chat/completions', {
        model: this.config.minutesModel,
        messages: [
          {
            role: 'system',
            content: 'あなたは議事録作成のプロフェッショナルです。会議の文字起こしから、構造化された議事録を作成してください。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      // 進捗更新
      onProgress?.({
        stage: 'generating',
        percentage: 90,
        currentTask: '議事録を美しく整形中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_3',
          timestamp: new Date(),
          level: 'success',
          message: 'AIによる議事録生成が完了しました',
        }],
        startedAt: new Date(),
      });

      // 結果を解析して構造化
      const generatedContent = response.data.choices[0].message.content;
      return this.parseGeneratedMinutes(generatedContent, options, transcription);

    } catch (error) {
      console.error('議事録生成エラー:', error);
      throw new Error('議事録の生成に失敗しました');
    }
  }

  /**
   * 議事録生成プロンプトを構築
   */
  private buildMinutesPrompt(transcription: string, options: ProcessingOptions): string {
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
    const promptContent = selectedPrompt?.content || `
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

    // プロンプトに文字起こしテキストを挿入
    const finalPrompt = `${promptContent}

【文字起こしテキスト】
${transcription}`;

    // カスタムプロンプトがある場合は追加
    if (options.customPrompt) {
      return `${finalPrompt}\n\n【追加要求】\n${options.customPrompt}`;
    }

    return finalPrompt;
  }

  /**
   * 生成された議事録を解析して構造化データに変換
   */
  private parseGeneratedMinutes(content: string, options: ProcessingOptions, transcription?: string): MinutesData {
    // 現在時刻を取得
    const now = new Date();

    // 文字起こしデータを適切に構造化
    let transcriptionSegments: any[] = [];
    if (transcription) {
      // 文字起こしテキストを適切に分割して構造化
      const sentences = this.splitTranscriptionIntoSentences(transcription);
      transcriptionSegments = sentences.map((sentence, index) => ({
        id: (index + 1).toString(),
        startTime: index * 30, // 30秒間隔で仮の時間設定
        endTime: (index + 1) * 30,
        speakerId: null,
        text: sentence.trim(),
        confidence: 0.95,
      }));
    }

    // 基本的な議事録データを作成
    const minutesData: MinutesData = {
      id: Date.now().toString(),
      title: '生成された議事録',
      date: now,
      duration: transcriptionSegments.length * 30, // 総時間を計算
      participants: [
        {
          id: '1',
          name: '参加者A',
          role: '司会',
          speakingTime: 0,
        },
      ],
      summary: content.substring(0, 200) + '...',
      keyPoints: [
        {
          id: '1',
          content: '重要なポイント1',
          timestamp: 0,
          importance: 'high',
        },
      ],
      actionItems: [
        {
          id: '1',
          task: 'タスク1',
          assignee: '担当者A',
          priority: 'medium',
          status: 'pending',
          timestamp: 0,
        },
      ],
      transcription: transcriptionSegments,
      outputs: options.outputFormats.map(format => ({
        format,
        content: content,
        generatedAt: now,
        size: content.length,
      })),
      metadata: {
        version: '1.0.0',
        generatedAt: now,
        processingTime: 0,
        tokensUsed: 0,
        model: this.config.minutesModel,
        quality: options.quality,
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