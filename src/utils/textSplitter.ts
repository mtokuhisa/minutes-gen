import { getModelLimits, estimateTokenCount, ModelName } from './tokenLimits';

/**
 * テキストを指定されたトークン数に基づいて、文の区切りを維持しながら分割します。
 * 
 * @param text 分割対象のテキスト
 * @param model 使用するモデル名
 * @param maxTokensPerChunk 1チャンクあたりの最大トークン数
 * @returns 分割されたテキストのチャンクの配列
 */
export const splitTextIntoChunks = (
  text: string,
  model: ModelName,
  maxTokensPerChunk?: number
): string[] => {
  const modelLimits = getModelLimits(model);
  // TPM制限を考慮したチャンクサイズ（デフォルト24,000トークン = 30,000 TPMの80%）
  const effectiveMaxTokens = maxTokensPerChunk || 24000;
  
  console.log(`[DEBUG] splitTextIntoChunks: effectiveMaxTokens=${effectiveMaxTokens}, textLength=${text.length}, estimatedTokens=${estimateTokenCount(text)}`);

  if (estimateTokenCount(text) <= effectiveMaxTokens) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const currentTokens = estimateTokenCount(currentChunk);
    const sentenceTokens = estimateTokenCount(sentence);

    if (currentTokens + sentenceTokens > effectiveMaxTokens) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      // 新しいチャンクを開始する文自体が制限を超えている場合の処理
      if (sentenceTokens > effectiveMaxTokens) {
        // 文を単語レベルで分割
        const words = sentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if (estimateTokenCount(tempChunk + ' ' + word) > effectiveMaxTokens) {
            if (tempChunk.trim().length > 0) {
              chunks.push(tempChunk.trim());
            }
            tempChunk = word;
          } else {
            tempChunk += (tempChunk ? ' ' : '') + word;
          }
        }
        currentChunk = tempChunk;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // 1つの文が長すぎて分割できない場合のフォールバック
  if (chunks.length === 0 && sentences.length > 0) {
    const firstSentence = sentences[0];
    const firstSentenceTokens = estimateTokenCount(firstSentence);
    
    if (firstSentenceTokens > effectiveMaxTokens) {
        // トークン数に基づいて強制的に分割
        const words = firstSentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
            if (estimateTokenCount(tempChunk + word) > effectiveMaxTokens) {
                chunks.push(tempChunk);
                tempChunk = word + ' ';
            } else {
                tempChunk += word + ' ';
            }
        }
        if (tempChunk) {
            chunks.push(tempChunk);
        }
        return chunks;
    } else {
        return [firstSentence];
    }
  }

  // 最終チェック：各チャンクのトークン数をログ出力
  console.log(`[DEBUG] Final chunks:`, chunks.map((chunk, i) => `Chunk ${i + 1}: ${estimateTokenCount(chunk)} tokens (length: ${chunk.length})`));

  return chunks;
}; 