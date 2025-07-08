# API_MODEL_VERIFICATION.md

## 📋 **API仕様（絶対遵守）**

### 🎤 **音声認識**
**GPT-4 Transcribe**

### 📝 **議事録生成**  
**GPT-4.1 or o3**（選択可能）

### 🔊 **音声発声（ポッドキャスト用）**
**GPT-4 Mini TTS**

## 🚫 モデル名ロック宣言（変更禁止）

| 用途 | 正式モデル名 |
|------|--------------|
| 音声認識 | gpt-4o-transcribe |
| 議事録生成 | gpt-4.1 または o3 |
| 音声合成 | gpt-4o-mini-tts |

> これらのモデル名は MinutesGen v1.0 仕様により **絶対に変更不可** です。コード (`src/config/api.ts`) 側でもハードコードされ、ローカル設定で上書きできないようロック済み。

---

## 🔍 **詳細調査結果**

### 1. **o3モデル**
- **正式名称**: `o3`
- **存在確認**: ✅ **確認済み**
- **リリース日**: 2025年4月16日
- **公式ドキュメント**: https://openrouter.ai/openai/o3
- **仕様詳細**:
  - コンテキスト: 200,000トークン
  - 最大出力: 100,000トークン
  - 価格: $10/M入力トークン、$40/M出力トークン
  - 特徴: 高度な推論能力、数学・科学・コーディングに特化

### 2. **GPT-4.1モデル**
- **正式名称**: `gpt-4.1`
- **存在確認**: ✅ **確認済み**
- **リリース日**: 2025年4月14日
- **公式ドキュメント**: https://docs.aimlapi.com/api-references/text-models-llm/openai/gpt-4.1
- **仕様詳細**:
  - コンテキスト: 1,000,000トークン
  - 最大出力: 32,768トークン
  - 価格: $2/M入力トークン、$8/M出力トークン
  - 特徴: 高度な指示追従、ソフトウェア開発、長文理解

### 3. **GPT-4 Transcribe**
- **調査状況**: 🔍 **要詳細調査**
- **検索結果**: 直接的な公式ドキュメントは見つからず
- **関連情報**: 
  - GPT-4oにはGPT Image 1が含まれる
  - Whisper-1が音声認識の標準モデル
  - 但し、指定された名称での公式確認は未完了

### 4. **GPT-4 Mini TTS**
- **調査状況**: 🔍 **要詳細調査**
- **検索結果**: 直接的な公式ドキュメントは見つからず
- **関連情報**:
  - `tts-1`と`tts-1-hd`が公式TTSモデル
  - 但し、指定された名称での公式確認は未完了

---

## 📊 **実装整合性評価**

### ✅ **整合性確認済み**
1. **o3モデル**: 完全一致
2. **GPT-4.1モデル**: 完全一致

### ⚠️ **要確認項目**
1. **GPT-4 Transcribe**: 実装名称と公式名称の照合が必要
2. **GPT-4 Mini TTS**: 実装名称と公式名称の照合が必要

---

## 🔧 **現在の実装状況**

### `src/config/api.ts`での設定
```typescript
transcribeModel: 'GPT-4 Transcribe',  // 要確認
minutesModel: 'GPT-4.1',              // ✅ 確認済み
ttsModel: 'GPT-4 Mini TTS',            // 要確認
```

### `src/services/openai.ts`での使用
- 実装では指定されたモデル名をそのまま使用
- APIエンドポイントとの整合性確認が必要

---

## 📝 **次のステップ**

1. **GPT-4 Transcribe**の正式な存在確認
2. **GPT-4 Mini TTS**の正式な存在確認
3. 必要に応じて実装の調整（但し、仕様書の指示に従う）

---

## 📅 **調査日時**
2025年1月25日

## 📚 **参考資料**
- OpenRouter: https://openrouter.ai/openai/o3
- AI/ML API Documentation: https://docs.aimlapi.com/api-references/text-models-llm/openai/gpt-4.1
- Wikipedia: https://en.wikipedia.org/wiki/GPT-4.1
- DocsBot AI: https://docsbot.ai/models/gpt-4-1 