// ===========================================
// MinutesGen v0.7.5 - トークン制限ユーティリティのテスト
// ===========================================

import {
  MODEL_LIMITS,
  estimateTokenCount,
  shouldSplitContent,
  getModelLimits,
  splitContentByTokens,
  splitContentForO3,
  generateTokenLimitWarning,
  type ModelName
} from '../tokenLimits';

describe('tokenLimitsユーティリティ', () => {
  describe('MODEL_LIMITS', () => {
    it('すべてのモデルに必要なプロパティが存在する', () => {
      const expectedModels: ModelName[] = ['gpt-4.1', 'o3', 'gpt-4o', 'gpt-4o-mini'];
      
      expectedModels.forEach(model => {
        expect(MODEL_LIMITS[model]).toBeDefined();
        expect(MODEL_LIMITS[model].contextWindow).toBeGreaterThan(0);
        expect(MODEL_LIMITS[model].maxOutputTokens).toBeGreaterThan(0);
        expect(MODEL_LIMITS[model].maxInputTokens).toBeGreaterThan(0);
        expect(MODEL_LIMITS[model].safeInputTokens).toBeGreaterThan(0);
        expect(typeof MODEL_LIMITS[model].isReasoningModel).toBe('boolean');
      });
    });

    it('入力制限 + 出力制限 = コンテキストウィンドウサイズ', () => {
      Object.entries(MODEL_LIMITS).forEach(([model, limits]) => {
        expect(limits.maxInputTokens + limits.maxOutputTokens).toBe(limits.contextWindow);
      });
    });

    it('安全入力制限 <= 最大入力制限', () => {
      Object.entries(MODEL_LIMITS).forEach(([model, limits]) => {
        expect(limits.safeInputTokens).toBeLessThanOrEqual(limits.maxInputTokens);
      });
    });

    it('o3モデルがReasoningModelとして正しく識別される', () => {
      expect(MODEL_LIMITS.o3.isReasoningModel).toBe(true);
      expect(MODEL_LIMITS['gpt-4.1'].isReasoningModel).toBe(false);
      expect(MODEL_LIMITS['gpt-4o'].isReasoningModel).toBe(false);
      expect(MODEL_LIMITS['gpt-4o-mini'].isReasoningModel).toBe(false);
    });
  });

  describe('estimateTokenCount', () => {
    it('空文字列の場合は0を返す', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('', 'ja')).toBe(0);
      expect(estimateTokenCount('', 'en')).toBe(0);
    });

    it('日本語テキストの場合は1.5倍の係数を適用', () => {
      const text = 'こんにちは';
      const expected = Math.ceil(text.length * 1.5);
      expect(estimateTokenCount(text, 'ja')).toBe(expected);
      expect(estimateTokenCount(text)).toBe(expected); // デフォルトは'ja'
    });

    it('英語テキストの場合は0.25倍の係数を適用', () => {
      const text = 'Hello world';
      const expected = Math.ceil(text.length * 0.25);
      expect(estimateTokenCount(text, 'en')).toBe(expected);
    });

    it('nullやundefinedの場合は0を返す', () => {
      expect(estimateTokenCount(null as any)).toBe(0);
      expect(estimateTokenCount(undefined as any)).toBe(0);
    });
  });

  describe('shouldSplitContent', () => {
    it('小さなコンテンツでは分割が不要', () => {
      const smallText = 'こんにちは';
      const result = shouldSplitContent(smallText, 'gpt-4.1');
      
      expect(result.needsSplit).toBe(false);
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.exceedsBy).toBe(0);
    });

    it('大きなコンテンツでは分割が必要', () => {
      const largeText = 'あ'.repeat(1000000); // 100万文字
      const result = shouldSplitContent(largeText, 'gpt-4.1');
      
      expect(result.needsSplit).toBe(true);
      expect(result.estimatedTokens).toBeGreaterThan(result.safeTokens);
      expect(result.exceedsBy).toBeGreaterThan(0);
    });

    it('o3モデルでは制限が厳しい', () => {
      const mediumText = 'あ'.repeat(100000); // 10万文字
      const gpt41Result = shouldSplitContent(mediumText, 'gpt-4.1');
      const o3Result = shouldSplitContent(mediumText, 'o3');
      
      expect(o3Result.needsSplit).toBe(true);
      expect(gpt41Result.needsSplit).toBe(false);
    });

    it('未対応のモデルでエラーを投げる', () => {
      expect(() => {
        shouldSplitContent('test', 'unknown-model' as ModelName);
      }).toThrow('未対応のモデル: unknown-model');
    });
  });

  describe('getModelLimits', () => {
    it('正しいモデルの制限値を返す', () => {
      const limits = getModelLimits('gpt-4.1');
      expect(limits).toBe(MODEL_LIMITS['gpt-4.1']);
    });

    it('未対応のモデルでエラーを投げる', () => {
      expect(() => {
        getModelLimits('unknown-model' as ModelName);
      }).toThrow('未対応のモデル: unknown-model');
    });
  });

  describe('splitContentByTokens', () => {
    it('小さなコンテンツはそのまま返す', () => {
      const text = 'こんにちは';
      const result = splitContentByTokens(text, 1000);
      
      expect(result).toEqual([text]);
    });

    it('空文字列は空配列を返す', () => {
      expect(splitContentByTokens('', 1000)).toEqual([]);
    });

    it('大きなコンテンツを適切に分割', () => {
      const paragraph1 = 'あ'.repeat(100) + '\n\n';
      const paragraph2 = 'い'.repeat(100) + '\n\n';
      const paragraph3 = 'う'.repeat(100);
      const text = paragraph1 + paragraph2 + paragraph3;
      
      const result = splitContentByTokens(text, 200); // 200トークン制限
      
      expect(result.length).toBeGreaterThan(1);
      expect(result.every(chunk => chunk.trim().length > 0)).toBe(true);
    });

    it('段落単位で分割される', () => {
      const text = 'パラグラフ1の内容です。'.repeat(10) + '\n\n' + 
                   'パラグラフ2の内容です。'.repeat(10) + '\n\n' + 
                   'パラグラフ3の内容です。'.repeat(10);
      const result = splitContentByTokens(text, 50);
      
      expect(result.length).toBeGreaterThan(1);
      expect(result.some(chunk => chunk.includes('パラグラフ1'))).toBe(true);
      expect(result.some(chunk => chunk.includes('パラグラフ2'))).toBe(true);
      expect(result.some(chunk => chunk.includes('パラグラフ3'))).toBe(true);
    });
  });

  describe('splitContentForO3', () => {
    it('o3モデルの制限値を使用して分割', () => {
      const largeText = 'あ'.repeat(200000); // 20万文字
      const result = splitContentForO3(largeText);
      
      expect(result.length).toBeGreaterThan(1);
      expect(result.every(chunk => {
        const tokens = estimateTokenCount(chunk);
        return tokens <= MODEL_LIMITS.o3.safeInputTokens;
      })).toBe(true);
    });

    it('小さなコンテンツはそのまま返す', () => {
      const smallText = 'こんにちは';
      const result = splitContentForO3(smallText);
      
      expect(result).toEqual([smallText]);
    });
  });

  describe('generateTokenLimitWarning', () => {
    it('分割不要の場合は空文字列を返す', () => {
      const splitInfo = {
        needsSplit: false,
        estimatedTokens: 1000,
        maxAllowedTokens: 100000,
        safeTokens: 95000,
        exceedsBy: 0
      };
      
      const warning = generateTokenLimitWarning(splitInfo, 'gpt-4.1');
      expect(warning).toBe('');
    });

    it('o3モデルでは自動分割メッセージを生成', () => {
      const splitInfo = {
        needsSplit: true,
        estimatedTokens: 150000,
        maxAllowedTokens: 105000,
        safeTokens: 90000,
        exceedsBy: 60000
      };
      
      const warning = generateTokenLimitWarning(splitInfo, 'o3');
      expect(warning).toContain('o3モデルの制限');
      expect(warning).toContain('自動分割処理を実行');
      expect(warning).toContain('150,000');
      expect(warning).toContain('90,000');
    });

    it('その他のモデルでは通常の警告メッセージを生成', () => {
      const splitInfo = {
        needsSplit: true,
        estimatedTokens: 1200000,
        maxAllowedTokens: 1017576,
        safeTokens: 1000000,
        exceedsBy: 200000
      };
      
      const warning = generateTokenLimitWarning(splitInfo, 'gpt-4.1');
      expect(warning).toContain('gpt-4.1モデルの制限');
      expect(warning).toContain('1,200,000');
      expect(warning).toContain('1,000,000');
      expect(warning).not.toContain('自動分割処理');
    });

    it('超過率が正しく計算される', () => {
      const splitInfo = {
        needsSplit: true,
        estimatedTokens: 150000,
        maxAllowedTokens: 100000,
        safeTokens: 100000,
        exceedsBy: 50000
      };
      
      const warning = generateTokenLimitWarning(splitInfo, 'gpt-4.1');
      expect(warning).toContain('50%超過');
    });
  });
});

describe('統合テスト', () => {
  it('実際の日本語長文での完全な処理フロー', () => {
    // 実際の日本語長文を模擬
    const longText = `
      本日は議事録作成システムの開発会議を行いました。
      
      参加者：
      - 田中太郎（プロジェクトマネージャー）
      - 佐藤花子（フロントエンドエンジニア）
      - 山田次郎（バックエンドエンジニア）
      
      議題：
      1. トークン制限機能の実装について
      2. パフォーマンス改善の検討
      3. 次回スケジュールの確認
      
      決定事項：
      - トークン制限機能を緊急で実装する
      - o3モデルでは自動分割処理を行う
      - 来週火曜日に再度会議を行う
      
      ToDo：
      - 実装作業の開始（山田）
      - テストケースの作成（佐藤）
      - 進捗レポートの作成（田中）
    `.repeat(1000); // 長文を作成

    // 1. トークン数推定
    const estimatedTokens = estimateTokenCount(longText);
    expect(estimatedTokens).toBeGreaterThan(0);

    // 2. 分割判定
    const o3SplitInfo = shouldSplitContent(longText, 'o3');
    const gpt41SplitInfo = shouldSplitContent(longText, 'gpt-4.1');

    // 3. 分割処理
    if (o3SplitInfo.needsSplit) {
      const chunks = splitContentForO3(longText);
      expect(chunks.length).toBeGreaterThan(1);
      
      // 各チャンクがo3の制限内に収まることを確認
      chunks.forEach(chunk => {
        const chunkTokens = estimateTokenCount(chunk);
        expect(chunkTokens).toBeLessThanOrEqual(MODEL_LIMITS.o3.safeInputTokens);
      });
    }

    // 4. 警告メッセージ生成
    if (o3SplitInfo.needsSplit) {
      const warning = generateTokenLimitWarning(o3SplitInfo, 'o3');
      expect(warning).toContain('o3モデル');
      expect(warning).toContain('自動分割処理');
    }

    console.log('統合テスト結果:', {
      originalLength: longText.length,
      estimatedTokens,
      o3NeedsSplit: o3SplitInfo.needsSplit,
      gpt41NeedsSplit: gpt41SplitInfo.needsSplit,
      o3Chunks: o3SplitInfo.needsSplit ? splitContentForO3(longText).length : 1
    });
  });
}); 