// ===========================================
// MinutesGen v0.7.5 - トークン制限管理ユーティリティ
// ===========================================

/**
 * モデル別トークン制限値
 */
export const MODEL_LIMITS = {
  'gpt-4.1': {
    contextWindow: 1047576,
    maxOutputTokens: 32768, // Tier 3
    maxInputTokens: 1014788, // contextWindow - maxOutputTokens
    safeInputTokens: 1000000, // 安全マージンを考慮
    tpm: 800000, // Tier 3
    isReasoningModel: false,
  },
  'o3': {
    contextWindow: 200000, // Tier 3
    maxOutputTokens: 100000, // Tier 3
    maxInputTokens: 100000, // contextWindow - maxOutputTokens
    safeInputTokens: 95000, // 安全マージンを考慮
    tpm: 800000, // Tier 3
    isReasoningModel: true,
  },
  'gpt-4o': {
    contextWindow: 128000,
    maxOutputTokens: 30000,
    maxInputTokens: 98000, // contextWindow - maxOutputTokens
    safeInputTokens: 95000, // 安全マージンを考慮
    isReasoningModel: false,
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    maxOutputTokens: 16000,
    maxInputTokens: 112000, // contextWindow - maxOutputTokens
    safeInputTokens: 110000, // 安全マージンを考慮
    tpm: 200000, // Tier 1 (仮)
    isReasoningModel: false,
  }
} as const;

export type ModelName = keyof typeof MODEL_LIMITS;

/**
 * テキストからトークン数を推定
 * @param text 対象テキスト
 * @param language 言語（日本語=ja, 英語=en）
 * @returns 推定トークン数
 */
export function estimateTokenCount(text: string, language: 'ja' | 'en' = 'ja'): number {
  if (!text || text.length === 0) return 0;
  
  // 日本語の場合: 1文字 ≈ 1.5トークン（安全側）
  // 英語の場合: 1文字 ≈ 0.25トークン（安全側）
  const multiplier = language === 'ja' ? 1.5 : 0.25;
  
  return Math.ceil(text.length * multiplier);
}

/**
 * コンテンツが分割必要かどうかを判定（TPM制限を考慮）
 * @param content 対象コンテンツ
 * @param model 使用モデル
 * @returns 分割情報
 */
export function shouldSplitContent(content: string, model: ModelName): {
  needsSplit: boolean;
  estimatedTokens: number;
  maxAllowedTokens: number;
  safeTokens: number;
  exceedsBy: number;
} {
  const limits = MODEL_LIMITS[model];
  if (!limits) {
    throw new Error(`未対応のモデル: ${model}`);
  }
  
  const estimatedTokens = estimateTokenCount(content);
  
  // TPM制限を考慮した実際の制限値
  const tpmLimit = model === 'gpt-4.1' ? 30000 : model === 'o3' ? 30000 : 30000;
  const safeTpmLimit = Math.floor(tpmLimit * 0.8); // 80%を安全マージンとする
  
  const exceedsBy = Math.max(0, estimatedTokens - safeTpmLimit);
  
  return {
    needsSplit: estimatedTokens > safeTpmLimit,
    estimatedTokens,
    maxAllowedTokens: tpmLimit,
    safeTokens: safeTpmLimit,
    exceedsBy
  };
}

/**
 * モデルの制限情報を取得
 * @param model モデル名
 * @returns 制限情報
 */
export function getModelLimits(model: ModelName) {
  const limits = MODEL_LIMITS[model];
  if (!limits) {
    throw new Error(`未対応のモデル: ${model}`);
  }
  return limits;
}

/**
 * コンテンツを指定サイズに分割
 * @param content 分割対象コンテンツ
 * @param maxTokens 1チャンクの最大トークン数
 * @returns 分割されたチャンク配列
 */
export function splitContentByTokens(content: string, maxTokens: number): string[] {
  if (!content || content.length === 0) return [];
  
  const estimatedTokens = estimateTokenCount(content);
  if (estimatedTokens <= maxTokens) {
    return [content];
  }
  
  // 段落単位で分割を試行
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  
  // 段落が1つしかない場合（改行がない長文）は直接分割
  if (paragraphs.length === 1) {
    const singleParagraph = paragraphs[0];
    const paragraphTokens = estimateTokenCount(singleParagraph);
    
    if (paragraphTokens <= maxTokens) {
      return [singleParagraph];
    }
    
    // 文単位で分割
    const sentences = singleParagraph.split(/[。！？]/).filter(s => s.trim());
    if (sentences.length > 1) {
      const chunks: string[] = [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        const sentenceWithPeriod = sentence + '。';
        const sentenceTokens = estimateTokenCount(sentenceWithPeriod);
        const currentTokens = estimateTokenCount(currentChunk);
        
        if (currentTokens + sentenceTokens > maxTokens && currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPeriod;
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.filter(chunk => chunk.trim());
    }
    
    // 文の区切りもない場合は、文字数で強制分割
    const targetLength = Math.floor(maxTokens / 1.5); // トークン数から文字数を逆算
    const chunks: string[] = [];
    
    for (let i = 0; i < singleParagraph.length; i += targetLength) {
      const chunk = singleParagraph.substring(i, i + targetLength);
      chunks.push(chunk);
    }
    
    return chunks.filter(chunk => chunk.trim());
  }
  
  // 複数段落の場合の処理
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokenCount(paragraph);
    const currentTokens = estimateTokenCount(currentChunk);
    
    // 段落が単体で制限を超える場合は文単位で分割
    if (paragraphTokens > maxTokens) {
      // 現在のチャンクがあれば追加
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // 文単位で分割
      const sentences = paragraph.split(/[。！？]/).filter(s => s.trim());
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        const sentenceWithPeriod = sentence + '。';
        const sentenceTokens = estimateTokenCount(sentenceWithPeriod);
        const sentenceChunkTokens = estimateTokenCount(sentenceChunk);
        
        if (sentenceChunkTokens + sentenceTokens > maxTokens) {
          if (sentenceChunk.trim()) {
            chunks.push(sentenceChunk.trim());
            sentenceChunk = '';
          }
        }
        
        sentenceChunk += (sentenceChunk ? ' ' : '') + sentenceWithPeriod;
      }
      
      if (sentenceChunk.trim()) {
        chunks.push(sentenceChunk.trim());
      }
    } else {
      // 現在のチャンクに追加できるかチェック
      if (currentTokens + paragraphTokens > maxTokens && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    const currentChunkTokens = estimateTokenCount(currentChunk);
    if (currentChunkTokens > maxTokens) {
      // チャンク自体が大きすぎる場合、文字数で強制分割
      const targetLength = Math.floor(maxTokens / 1.5);
      for (let i = 0; i < currentChunk.length; i += targetLength) {
        const subChunk = currentChunk.substring(i, i + targetLength);
        chunks.push(subChunk.trim());
      }
    } else {
      chunks.push(currentChunk.trim());
    }
  }
  
  // 最終検証: すべてのチャンクが上限以内に収まるか
  return chunks.filter(chunk => chunk.trim()).flatMap(chunk => {
    const tokens = estimateTokenCount(chunk);
    if (tokens <= maxTokens) return [chunk];

    // 万が一超えていた場合は文字数で強制分割
    const targetLength = Math.floor(maxTokens / 1.5);
    const forced: string[] = [];
    for (let i = 0; i < chunk.length; i += targetLength) {
      forced.push(chunk.substring(i, i + targetLength));
    }
    return forced;
  });
}

/**
 * o3モデル用の自動分割処理
 * @param content 分割対象コンテンツ
 * @returns 分割されたチャンク配列
 */
export function splitContentForO3(content: string): string[] {
  const o3Limits = MODEL_LIMITS['o3'];
  return splitContentByTokens(content, o3Limits.safeInputTokens);
}

/**
 * 制限超過時の警告メッセージを生成
 * @param splitInfo 分割情報
 * @param model モデル名
 * @returns 警告メッセージ
 */
export function generateTokenLimitWarning(splitInfo: ReturnType<typeof shouldSplitContent>, model: ModelName): string {
  const limits = MODEL_LIMITS[model];
  
  if (!splitInfo.needsSplit) {
    return '';
  }
  
  const exceedsPercentage = Math.round((splitInfo.exceedsBy / splitInfo.safeTokens) * 100);
  
  if (model === 'o3') {
    return `コンテンツが大きすぎます（推定${splitInfo.estimatedTokens.toLocaleString()}トークン）。o3モデルの制限（${limits.safeInputTokens.toLocaleString()}トークン）を${exceedsPercentage}%超過しているため、自動分割処理を実行します。`;
  } else {
    return `コンテンツが大きすぎます（推定${splitInfo.estimatedTokens.toLocaleString()}トークン）。${model}モデルの制限（${limits.safeInputTokens.toLocaleString()}トークン）を${exceedsPercentage}%超過しています。`;
  }
} 