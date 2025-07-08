// ===========================================
// MinutesGen v1.0 - OpenAI API サービス
// ===========================================

import axios, { AxiosInstance } from 'axios';
import { getValidatedAPIConfig } from '../config/api';
import { AudioFile, ProcessingOptions, MinutesData, ProcessingProgress } from '../types';
import { audioProcessor } from './audioProcessor';
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
        currentTask: '音声ファイルを文字起こし中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: '音声ファイルをOpenAI Transcribe APIに送信中...',
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
        currentTask: '文字起こし完了',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_1',
          timestamp: new Date(),
          level: 'success',
          message: '文字起こしが完了しました',
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
      
      let transcript = '';
      
      // 各セグメントを順次文字起こし
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // 進捗更新 (セグメント文字起こし開始)
        onProgress?.({
          stage: 'transcribing',
          percentage: 70 + Math.round((i / segments.length) * 25),
          currentTask: `セグメント ${i + 1}/${segments.length} を文字起こし中...`,
          estimatedTimeRemaining: 0,
          logs: [{
            id: Date.now().toString() + '_seg_' + i,
            timestamp: new Date(),
            level: 'info',
            message: `セグメント ${i + 1}/${segments.length} (${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s) を文字起こし中`,
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

        transcript += (response.data.text as string) + '\n';
      }

      // 進捗更新 (完了)
      onProgress?.({
        stage: 'transcribing',
        percentage: 95,
        currentTask: 'セグメントの文字起こしが完了',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_segment_done',
          timestamp: new Date(),
          level: 'success',
          message: '全セグメントの文字起こしが完了しました',
        }],
        startedAt: new Date(),
      });

      return transcript.trim();

    } catch (error) {
      console.error('ffmpeg.wasm音声文字起こしエラー:', error);
      throw new Error('音声の文字起こしに失敗しました');
    }
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
        currentTask: '議事録を生成中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_2',
          timestamp: new Date(),
          level: 'info',
          message: 'AI議事録生成を開始しました',
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
        currentTask: '議事録を整形中...',
        estimatedTimeRemaining: 0,
        logs: [{
          id: Date.now().toString() + '_3',
          timestamp: new Date(),
          level: 'success',
          message: 'AI議事録生成が完了しました',
        }],
        startedAt: new Date(),
      });

      // 結果を解析して構造化
      const generatedContent = response.data.choices[0].message.content;
      return this.parseGeneratedMinutes(generatedContent, options);

    } catch (error) {
      console.error('議事録生成エラー:', error);
      throw new Error('議事録の生成に失敗しました');
    }
  }

  /**
   * 議事録生成プロンプトを構築
   */
  private buildMinutesPrompt(transcription: string, options: ProcessingOptions): string {
    const basePrompt = `
以下の会議の文字起こしテキストから、構造化された議事録を作成してください。

【文字起こしテキスト】
${transcription}

【要求事項】
- 日本語で出力してください
- 以下の形式で出力してください：

## 会議概要
- 日時: [推定される日時]
- 議題: [主要な議題]
- 参加者: [発言者を推定]

## 重要なポイント
1. [重要な内容1]
2. [重要な内容2]
3. [重要な内容3]

## 決定事項
- [決定された内容]

## アクション項目
- [担当者]: [タスク内容] ([期限])

## 次回までのTO DO
- [項目1]
- [項目2]

## 補足・その他
- [その他の重要な情報]
`;

    // カスタムプロンプトがある場合は追加
    if (options.customPrompt) {
      return `${basePrompt}\n\n【追加要求】\n${options.customPrompt}`;
    }

    return basePrompt;
  }

  /**
   * 生成された議事録を解析して構造化データに変換
   */
  private parseGeneratedMinutes(content: string, options: ProcessingOptions): MinutesData {
    // 現在時刻を取得
    const now = new Date();

    // 基本的な議事録データを作成
    const minutesData: MinutesData = {
      id: Date.now().toString(),
      title: '生成された議事録',
      date: now,
      duration: 0,
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
      transcription: [
        {
          id: '1',
          startTime: 0,
          endTime: 0,
          speakerId: '1',
          text: '生成された文字起こし',
          confidence: 0.95,
        },
      ],
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