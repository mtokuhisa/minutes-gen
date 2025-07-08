// ===========================================
// MinutesGen v1.0 - プロンプト管理システム
// ===========================================

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'preset' | 'custom';
  createdAt: Date;
  updatedAt: Date;
  category: PromptCategory;
  tags: string[];
  isActive: boolean;
}

export type PromptCategory = 
  | 'general'      // 一般的な議事録
  | 'meeting'      // 会議
  | 'interview'    // インタビュー
  | 'presentation' // プレゼンテーション
  | 'brainstorm'   // ブレインストーミング
  | 'custom';      // カスタム

export interface PromptStore {
  presets: PromptTemplate[];
  customs: PromptTemplate[];
  activePreset: string | null;
  activeCustom: string | null;
}

// プリセットプロンプト（5種類）
const PRESET_PROMPTS: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '標準議事録',
    description: '一般的な会議や打ち合わせに適した標準的な議事録形式',
    content: `あなたは議事録作成のプロフェッショナルです。以下の文字起こしテキストから、構造化された議事録を作成してください。

## 出力形式
### 1. 会議概要
- 会議名: [会議のタイトル]
- 日時: [日時]
- 参加者: [参加者リスト]

### 2. 議題・討議内容
[主要な議題ごとに整理]

### 3. 決定事項
[決定された事項を箇条書きで]

### 4. アクション項目
[担当者・期限付きで整理]

### 5. 次回予定
[次回の予定があれば記載]

## 注意事項
- 重要な発言は話者名を明記
- 数値や日付は正確に記録
- 曖昧な表現は避け、具体的に記述
- 議論の流れが分かるように構成`,
    type: 'preset',
    category: 'general',
    tags: ['標準', '会議', '汎用'],
    isActive: true,
  },
  {
    name: '詳細議事録',
    description: '重要な会議や公式な場での詳細な議事録作成',
    content: `あなたは公式議事録作成の専門家です。以下の文字起こしから、詳細で正確な議事録を作成してください。

## 出力形式
### 1. 会議情報
- 会議名: [正式名称]
- 開催日時: [年月日・時刻]
- 開催場所: [場所]
- 出席者: [役職・氏名]
- 欠席者: [該当者がいれば]

### 2. 議事内容
#### 2.1 開会・挨拶
[開会の挨拶や冒頭発言]

#### 2.2 議題別討議
[議題ごとに詳細な討議内容]
- 発言者: [氏名・役職]
- 発言内容: [具体的な発言]
- 質疑応答: [Q&A形式で整理]

### 3. 決議事項
[正式な決定事項を番号付きで]

### 4. 承認事項
[承認された事項]

### 5. 今後の予定・課題
[フォローアップ事項]

### 6. 閉会
[閉会時刻・挨拶]

## 作成基準
- 発言の文脈と意図を正確に反映
- 専門用語は適切に使用
- 時系列に沿って整理
- 重要度に応じて詳細度を調整`,
    type: 'preset',
    category: 'meeting',
    tags: ['詳細', '公式', '正式'],
    isActive: true,
  },
  {
    name: 'インタビュー記録',
    description: 'インタビューや聞き取り調査の記録作成',
    content: `あなたはインタビュー記録作成の専門家です。以下の文字起こしから、構造化されたインタビュー記録を作成してください。

## 出力形式
### 1. インタビュー概要
- 対象者: [氏名・役職・所属]
- インタビュアー: [実施者]
- 実施日時: [日時]
- 実施場所: [場所]
- 目的: [インタビューの目的]

### 2. 主要な質問と回答
#### Q1: [質問内容]
**A:** [回答内容]
- 補足: [必要に応じて]

#### Q2: [質問内容]
**A:** [回答内容]

### 3. 重要な発言・エピソード
[特に印象的な発言や具体的なエピソード]

### 4. 気づき・考察
[インタビューから得られた気づき]

### 5. 今後のアクション
[フォローアップが必要な事項]

## 記録基準
- 対象者の発言を正確に記録
- 感情や表情も可能な限り記録
- 具体例やエピソードを重視
- 客観的な記録を心がける`,
    type: 'preset',
    category: 'interview',
    tags: ['インタビュー', '聞き取り', '調査'],
    isActive: true,
  },
  {
    name: 'プレゼン記録',
    description: 'プレゼンテーションや発表会の記録作成',
    content: `あなたはプレゼンテーション記録作成の専門家です。以下の文字起こしから、プレゼンテーションの記録を作成してください。

## 出力形式
### 1. プレゼンテーション概要
- タイトル: [発表タイトル]
- 発表者: [氏名・所属]
- 日時: [実施日時]
- 対象者: [聴衆]

### 2. 発表内容
#### 2.1 導入・背景
[プレゼンの背景や目的]

#### 2.2 主要ポイント
[発表の核となる内容をポイント別に]
- ポイント1: [内容]
- ポイント2: [内容]
- ポイント3: [内容]

#### 2.3 データ・事例
[提示されたデータや具体例]

### 3. 質疑応答
#### Q: [質問内容]
**A:** [回答内容]

### 4. 重要な指摘・コメント
[聴衆からの重要な指摘]

### 5. 今後の展開
[今後の予定や課題]

## 記録基準
- 発表の流れと構成を重視
- 重要なデータや数値を正確に記録
- 質疑応答の内容を詳細に記録
- 視覚的な資料の説明も含める`,
    type: 'preset',
    category: 'presentation',
    tags: ['プレゼン', '発表', '説明'],
    isActive: true,
  },
  {
    name: 'ブレスト記録',
    description: 'ブレインストーミングやアイデア出しの記録作成',
    content: `あなたはブレインストーミング記録作成の専門家です。以下の文字起こしから、アイデア出しの記録を作成してください。

## 出力形式
### 1. セッション概要
- テーマ: [ブレストのテーマ]
- 参加者: [参加者リスト]
- 日時: [実施日時]
- 進行: [ファシリテーター]

### 2. 出されたアイデア
#### カテゴリA: [分類名]
- アイデア1: [内容] - 提案者: [氏名]
- アイデア2: [内容] - 提案者: [氏名]

#### カテゴリB: [分類名]
- アイデア1: [内容] - 提案者: [氏名]

### 3. 発展したアイデア
[議論の中で発展・統合されたアイデア]

### 4. 評価・選定
[評価基準と選定されたアイデア]

### 5. 次のステップ
[具体化に向けた次のアクション]

## 記録基準
- 全てのアイデアを平等に記録
- 発言者を明記
- アイデアの発展過程を記録
- 評価コメントも含める
- 創造性を重視した記録`,
    type: 'preset',
    category: 'brainstorm',
    tags: ['ブレスト', 'アイデア', '創造'],
    isActive: true,
  },
];

// ローカルストレージキー
const STORAGE_KEY = 'minutesgen-prompts';

// プロンプトストアの初期化
export const initializePromptStore = (): PromptStore => {
  const stored = localStorage.getItem(STORAGE_KEY);
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        presets: PRESET_PROMPTS.map((preset, index) => ({
          ...preset,
          id: `preset-${index}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        customs: parsed.customs || [],
        activePreset: parsed.activePreset || 'preset-0',
        activeCustom: parsed.activeCustom || null,
      };
    } catch (error) {
      console.error('プロンプトストアの読み込みに失敗:', error);
    }
  }
  
  return {
    presets: PRESET_PROMPTS.map((preset, index) => ({
      ...preset,
      id: `preset-${index}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    customs: [],
    activePreset: 'preset-0',
    activeCustom: null,
  };
};

// プロンプトストアの保存
export const savePromptStore = (store: PromptStore): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customs: store.customs,
      activePreset: store.activePreset,
      activeCustom: store.activeCustom,
    }));
  } catch (error) {
    console.error('プロンプトストアの保存に失敗:', error);
  }
};

// カスタムプロンプトの追加
export const addCustomPrompt = (store: PromptStore, prompt: Omit<PromptTemplate, 'id' | 'type' | 'createdAt' | 'updatedAt'>): PromptStore => {
  const newPrompt: PromptTemplate = {
    ...prompt,
    id: `custom-${Date.now()}`,
    type: 'custom',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const newStore = {
    ...store,
    customs: [...store.customs, newPrompt],
  };
  
  savePromptStore(newStore);
  return newStore;
};

// カスタムプロンプトの更新
export const updateCustomPrompt = (store: PromptStore, id: string, updates: Partial<PromptTemplate>): PromptStore => {
  const newStore = {
    ...store,
    customs: store.customs.map(prompt => 
      prompt.id === id 
        ? { ...prompt, ...updates, updatedAt: new Date() }
        : prompt
    ),
  };
  
  savePromptStore(newStore);
  return newStore;
};

// カスタムプロンプトの削除
export const deleteCustomPrompt = (store: PromptStore, id: string): PromptStore => {
  const newStore = {
    ...store,
    customs: store.customs.filter(prompt => prompt.id !== id),
    activeCustom: store.activeCustom === id ? null : store.activeCustom,
  };
  
  savePromptStore(newStore);
  return newStore;
};

// アクティブプロンプトの設定
export const setActivePrompt = (store: PromptStore, id: string, type: 'preset' | 'custom'): PromptStore => {
  const newStore = {
    ...store,
    activePreset: type === 'preset' ? id : store.activePreset,
    activeCustom: type === 'custom' ? id : store.activeCustom,
  };
  
  savePromptStore(newStore);
  return newStore;
};

// アクティブプロンプトの取得
export const getActivePrompt = (store: PromptStore): PromptTemplate | null => {
  if (store.activeCustom) {
    return store.customs.find(p => p.id === store.activeCustom) || null;
  }
  
  if (store.activePreset) {
    return store.presets.find(p => p.id === store.activePreset) || null;
  }
  
  return null;
};

// 全プロンプトの取得
export const getAllPrompts = (store: PromptStore): PromptTemplate[] => {
  return [...store.presets, ...store.customs];
};

// カテゴリ別プロンプトの取得
export const getPromptsByCategory = (store: PromptStore, category: PromptCategory): PromptTemplate[] => {
  return getAllPrompts(store).filter(prompt => prompt.category === category);
};

// プロンプトの検索
export const searchPrompts = (store: PromptStore, query: string): PromptTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return getAllPrompts(store).filter(prompt => 
    prompt.name.toLowerCase().includes(lowercaseQuery) ||
    prompt.description.toLowerCase().includes(lowercaseQuery) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}; 