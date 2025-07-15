/**
 * 文字化け検出ユーティリティ
 * 文レベルでの判定により誤検出を避ける
 */

export interface CorruptionDetectionResult {
  isCorrupted: boolean;
  confidence: number; // 0-1の信頼度
  corruptedSamples: string[];
  reason: string;
}

/**
 * 文字化けの可能性を検出
 */
export function detectTextCorruption(text: string): CorruptionDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      isCorrupted: false,
      confidence: 0,
      corruptedSamples: [],
      reason: 'テキストが空です'
    };
  }

  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const corruptedSamples: string[] = [];
  let corruptionScore = 0;
  let totalLines = lines.length;

  // 文字化けパターンをチェック
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length < 10) continue; // 短すぎる行はスキップ

    // 文字化けパターン1: 連続する文字化け記号
    if (hasConsecutiveCorruptionSymbols(trimmedLine)) {
      corruptedSamples.push(trimmedLine.substring(0, 50));
      corruptionScore += 3;
    }

    // 文字化けパターン2: 記号混在の意味不明な文字列
    if (hasSymbolMixedCorruption(trimmedLine)) {
      corruptedSamples.push(trimmedLine.substring(0, 50));
      corruptionScore += 2;
    }

    // 文字化けパターン3: 不自然な文字コード表現
    if (hasUnnaturalCharacterCodes(trimmedLine)) {
      corruptedSamples.push(trimmedLine.substring(0, 50));
      corruptionScore += 2;
    }

    // 文字化けパターン4: アセンブリ言語的な文字列
    if (hasAssemblyLikePattern(trimmedLine)) {
      corruptedSamples.push(trimmedLine.substring(0, 50));
      corruptionScore += 1;
    }
  }

  // 信頼度計算
  const confidence = Math.min(corruptionScore / Math.max(totalLines, 1), 1);
  const isCorrupted = confidence > 0.3; // 30%以上の確信度で文字化けと判定

  let reason = '';
  if (isCorrupted) {
    reason = `文字化けパターンを検出しました（信頼度: ${Math.round(confidence * 100)}%）`;
  } else {
    reason = '文字化けは検出されませんでした';
  }

  return {
    isCorrupted,
    confidence,
    corruptedSamples: corruptedSamples.slice(0, 5), // 最大5つのサンプル
    reason
  };
}

/**
 * 連続する文字化け記号をチェック
 */
function hasConsecutiveCorruptionSymbols(text: string): boolean {
  // 文字化け記号が3つ以上連続している場合
  const corruptionPattern = /[�?□]{3,}/g;
  return corruptionPattern.test(text);
}

/**
 * 記号混在の意味不明な文字列をチェック
 */
function hasSymbolMixedCorruption(text: string): boolean {
  // 記号と文字が不自然に混在している場合
  const patterns = [
    /[ƒ]{2,}[A-Za-z]{2,}/g, // ƒAƒvƒŠのような記号混在
    /[¤]{2,}[ì¹Ï³ó¤Á¤Ï]/g, // ¤¹¤ì¤Ïのような記号連続
    /[䛣䛾䝥䝻䝆䜵䜽䝖]/g, // 特殊な文字化け文字
  ];

  return patterns.some(pattern => pattern.test(text));
}

/**
 * 不自然な文字コード表現をチェック
 */
function hasUnnaturalCharacterCodes(text: string): boolean {
  // 文字コードが直接表示されているような場合
  const codePatterns = [
    /\\u[0-9a-fA-F]{4}/g, // Unicode エスケープ
    /&#[0-9]+;/g, // HTML エンティティ
    /\\x[0-9a-fA-F]{2}/g, // 16進エスケープ
  ];

  // 文字コードが3つ以上連続している場合のみ文字化けと判定
  return codePatterns.some(pattern => {
    const matches = text.match(pattern);
    return matches && matches.length >= 3;
  });
}

/**
 * アセンブリ言語的なパターンをチェック
 */
function hasAssemblyLikePattern(text: string): boolean {
  // アセンブリ言語のような機械的な文字列
  const assemblyPatterns = [
    /^[A-Z0-9]{8,}\s+[A-Z0-9]{8,}/g, // 16進数の連続
    /^[0-9A-F]{16,}/g, // 長い16進数
    /\b[A-Z]{3,}\s+[A-Z]{3,}\s+[A-Z]{3,}/g, // 大文字の略語連続
  ];

  return assemblyPatterns.some(pattern => pattern.test(text));
}

/**
 * 文字化けの可能性がある文字列かどうかを簡易チェック
 */
export function isLikelyCorrupted(text: string): boolean {
  const result = detectTextCorruption(text);
  return result.isCorrupted;
}

/**
 * 文字化け警告メッセージを生成
 */
export function generateCorruptionWarning(result: CorruptionDetectionResult): string {
  if (!result.isCorrupted) {
    return '';
  }

  let warning = `⚠️ 文字化けの可能性があります（信頼度: ${Math.round(result.confidence * 100)}%）\n\n`;
  warning += `${result.reason}\n\n`;
  
  if (result.corruptedSamples.length > 0) {
    warning += `検出された文字化け箇所の例：\n`;
    result.corruptedSamples.forEach((sample, index) => {
      warning += `${index + 1}. ${sample}...\n`;
    });
    warning += `\n`;
  }

  warning += `対処方法：\n`;
  warning += `1. 元のファイルの文字エンコーディングを確認してください\n`;
  warning += `2. UTF-8形式で保存し直してください\n`;
  warning += `3. 再度アップロードしてください`;

  return warning;
} 