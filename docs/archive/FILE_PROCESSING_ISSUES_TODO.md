# ファイル処理問題調査結果と修正TODO

## 🔍 調査完了日: 2025-01-17

## 📊 問題1: 文字量の多いtxt/docxファイルでのエラー

### 🚨 特定された問題点

#### 1. トークン制限の不適切な設定
- **現状**: 議事録生成時に`max_tokens: 50,000`設定
- **問題**: 入力+出力でAPI制限（128K～2M tokens）を超える
- **影響**: 大きなファイルでAPI制限超過エラー発生

#### 2. テキストファイル処理の問題
- **場所**: `src/components/FileUpload.tsx:327`
- **問題**: `const text = await file.text();` でファイル全体を一度にメモリ読み込み
- **影響**: 大きなファイルでメモリエラー、ブラウザクラッシュ

#### 3. DOCX処理の問題
- **場所**: `src/components/FileUpload.tsx:390`
- **問題**: `mammoth.extractRawText()`抽出後のサイズ制限なし
- **影響**: 100ページdocx → 300,000文字 → 450,000トークン → API制限超過

#### 4. コンテンツ最適化の未実装
- **問題**: `optimizeContentForAPI`関数が存在するが使用されていない
- **影響**: 大きなコンテンツの自動分割機能なし

### ✅ TODO項目（優先度順）

- [ ] **優先度1**: テキストファイルのチャンク処理実装
  - [ ] ファイル読み込み時のメモリ効率化
  - [ ] 大きなファイルの段階的読み込み機能
  - [ ] 文字エンコーディング処理の最適化

- [ ] **優先度1**: 入力サイズの事前チェック機能
  - [ ] ファイルサイズからトークン数推定
  - [ ] API制限に基づく事前警告システム
  - [ ] 自動分割提案機能

- [ ] **優先度2**: コンテンツ最適化機能の実装
  - [ ] `optimizeContentForAPI`関数の実際の使用
  - [ ] 重要度に基づく段落選択機能
  - [ ] 段階的要約機能

- [ ] **優先度3**: エラーハンドリングの改善
  - [ ] ユーザーフレンドリーなエラーメッセージ
  - [ ] 処理継続のための代替案提示
  - [ ] 分割処理の自動実行

---

## 📊 問題2: PDFファイルの文字抽出問題

### 🚨 特定された問題点

#### 1. max_tokens制限不足
- **場所**: `src/services/fileProcessor.ts:112`
- **現状**: `max_tokens: 16000`
- **問題**: 16,000トークンでは大きなPDFに不十分
- **影響**: 大きなPDFの内容が途中で切れる

#### 2. File API実装の問題
- **場所**: `src/services/fileProcessor.ts:99-102`
- **問題**: 現在の実装形式がOpenAI API最新仕様に不適合の可能性
- **現状形式**: `type: 'file', file: { file_id: fileId }`
- **推奨形式**: `file_search` toolsを使用

#### 3. フォールバック処理の不備
- **場所**: `src/components/FileUpload.tsx:358`
- **問題**: `const text = await file.text();` PDFファイルには通常テキストが含まれない
- **影響**: フォールバック処理が機能しない

#### 4. OCR機能の不実装
- **問題**: 画像ベースPDFの処理ができない
- **影響**: OCR処理の指示が不十分

### ✅ TODO項目（優先度順）

- [ ] **優先度1**: PDFファイルのmax_tokens増加
  - [ ] 16,000 → 50,000トークンに増加
  - [ ] モデル別の最適なトークン数設定
  - [ ] 段階的処理機能の実装

- [ ] **優先度1**: PDF File API形式の修正
  - [ ] 最新OpenAI API仕様への準拠
  - [ ] `file_search` toolsの実装検討
  - [ ] APIエラーハンドリングの強化

- [ ] **優先度2**: OCR処理の改善
  - [ ] 画像ベースPDF対応の明確化
  - [ ] OCR処理指示の詳細化
  - [ ] 処理品質の向上

- [ ] **優先度3**: フォールバック機能の改善
  - [ ] 適切なPDFフォールバック処理
  - [ ] 複数処理方式の実装
  - [ ] エラー回復機能の強化

---

## 📊 問題3: API制限とエラーハンドリング

### 🚨 特定された問題点

#### 1. 入力制限の管理不足
- **GPT-4o**: 128K tokens制限
- **GPT-4.1**: 200K tokens制限  
- **o3**: 2M tokens制限
- **問題**: モデル別制限の適切な管理なし

#### 2. エラーハンドリングの不十分
- **問題**: トークン制限超過時の適切な分割処理なし
- **影響**: ユーザーへの分かりやすいエラーメッセージ不足

#### 3. メモリ効率の問題
- **問題**: 大きなファイルを一度に処理
- **影響**: チャンク処理の実装不足

### ✅ TODO項目（優先度順）

- [ ] **優先度1**: モデル別制限管理システム
  - [ ] 各モデルの制限値定数化
  - [ ] 動的制限チェック機能
  - [ ] 自動モデル選択機能

- [ ] **優先度2**: 分割処理機能の実装
  - [ ] 自動コンテンツ分割機能
  - [ ] 段階的処理システム
  - [ ] 並列処理の実装

- [ ] **優先度3**: メモリ効率の最適化
  - [ ] ストリーミング処理の実装
  - [ ] メモリ使用量監視機能
  - [ ] ガベージコレクション最適化

---

## 🎯 修正実装優先度

### 🔥 緊急修正（即座に対応）
1. **テキストファイルのチャンク処理実装**
2. **PDFファイルのmax_tokens増加**
3. **入力サイズの事前チェック機能**

### ⚡ 高優先度修正（1週間以内）
1. **PDF File API形式の修正**
2. **コンテンツ最適化機能の実装**
3. **モデル別制限管理システム**

### 🔧 中優先度修正（2週間以内）
1. **OCR処理の改善**
2. **エラーメッセージの改善**
3. **分割処理機能の実装**

### 🚀 低優先度修正（1ヶ月以内）
1. **メモリ効率の最適化**
2. **並列処理の実装**
3. **進捗表示の改善**

---

## 📝 実装時の注意事項

### 🚫 絶対遵守事項
- [[memory:3045030]] すべての変更は事前承認が必要
- [[memory:3045028]] API_SPECIFICATION.mdの変更は絶対禁止
- [[memory:3043666]] 'markdown-docx (vace)' ライブラリを使用

### 📋 実装ガイドライン
- 既存動作機能の変更は承認なしで絶対禁止
- 後方互換性の完全維持
- 段階的な実装とテスト
- ログ出力の充実

### 🔍 テスト要件
- 各ファイルサイズでの動作確認
- API制限近辺での動作テスト
- エラーケースの網羅的テスト
- メモリ使用量の監視

---

## 📊 調査に使用したファイル

### 主要調査対象ファイル
- `src/services/fileProcessor.ts` (PDF処理)
- `src/services/openai.ts` (API制限設定)
- `src/components/FileUpload.tsx` (ファイル処理)
- `src/services/infographicGenerator.ts` (コンテンツ最適化)

### 確認済み問題箇所
- Line 112: `max_tokens: 16000` (PDF処理)
- Line 327: `await file.text()` (テキスト処理)
- Line 390: `mammoth.extractRawText()` (DOCX処理)
- Line 1150: `max_tokens: 50000` (議事録生成)

---

*調査完了: 2025-01-17*  
*次回見直し予定: 修正実装後* 