# CHANGELOG

## [v0.7.5] - 2025-01-17

### 🚀 新機能追加
- **PDF処理進捗表示機能**: 5段階の詳細進捗報告システムを追加
  - 10%: "PDFファイルをアップロード中..."
  - 30%: "PDFファイルのアップロード完了"
  - 40%: "PDFからテキストを抽出中..."
  - 80%: "テキスト抽出完了"
  - 90%: "一時ファイルを削除中..."
  - 100%: "PDF処理完了"
- **FileProcessorのOpenAI Files API統合**: 最新のOpenAI Files APIを使用した堅牢なPDF処理
  - 3段階のOpenAI Files API処理フロー実装
  - 自動一時ファイルクリーンアップ機能
  - 堅牢なエラーハンドリング
- **メモリ推定・管理サービス**: 動的メモリ管理システムを追加
  - `MemoryEstimationService`: ファイルサイズからメモリ使用量を推定
  - `DynamicMemoryService`: リアルタイムメモリ監視と適応的処理
  - 処理モード自動選択（light/medium/heavy）
- **Worker管理システム**: プロセス管理の最適化
  - `WorkerManager`: Electron環境でのワーカープロセス管理
  - タスクキューイング機能
  - メモリ制限付きタスク実行

### 🔧 システム改善
- **PDF処理専用UI**: 青色テーマの専用進捗表示カード
  - PDF アイコン（PictureAsPdf）の追加
  - Material-UI LinearProgress コンポーネントの統合
  - 詳細進捗メッセージとパーセンテージ表示
- **進捗状態管理**: `pdfProcessingProgress` 状態の追加
  - 進捗コールバック統合
  - 完了・エラー時の適切なクリーンアップ

### 🛠️ 開発環境改善
- **各種スクリプトの追加**:
  - `start-app.js`: アプリケーション起動管理スクリプト
  - `scripts/create-certificate.js`: 証明書作成スクリプト
  - `scripts/fix-ffmpeg-permissions.js`: FFmpeg権限修正スクリプト
  - `scripts/fix-powershell-bug.sh`: PowerShell関連問題修正スクリプト

### 🐛 バグ修正
- PDF処理時の `file.text()` エラーの修正
- バイナリファイル処理の改善
- 一時ファイルの自動削除機能の追加

### 🏗️ 内部構造改善
- FileProcessor サービスの完全統合
- 進捗コールバック機能の強化
- エラーハンドリングの多段階フォールバック実装

---

## [v0.7.4] - 2025-01-XX

### 🔧 システム改善
- **進捗メッセージフォーマットの改善**:
  - "AI が6つ目の音声を文字にしています.." → "AI が音声を文字にしています...6/12"
  - "セグメント 1/12 生成中..." → "大きいファイルを分割中...1/12"
  - 総数表示対応による進捗の可視化向上

### 🆕 API対応
- **gpt-4o-transcribeモデル対応**: 最新の音声認識モデルへの対応
  - "Whisperモデルで音声認識中..." → "gpt-4o-transcribeで音声認識中..."
  - 新しいモデルの response_format 対応

### 🐛 バグ修正
- **音声処理システムの安定性向上**:
  - FFmpeg処理の改善
  - セグメント処理の最適化
  - メモリ使用量の最適化

### 🏗️ 内部構造改善
- エラーハンドリング機能の強化
- 進捗通知システムの改善
- 各種サービスの統合とモジュール化

---

## [v0.7.3] - 2025-01-XX (Base Version)

### 基本機能
- 音声ファイルの自動文字起こし
- 議事録の自動生成（Markdown/HTML/Word形式）
- 大容量ファイルの分割処理
- 基本的なPDF処理機能
- エラーハンドリングとリトライ機能

---

## 📊 統計情報

### v0.7.5 統計
- **変更ファイル数**: 24個
- **追加行数**: 3,327行
- **削除行数**: 545行
- **新規ファイル数**: 7個
- **主要機能追加数**: 4個（PDF進捗、メモリ管理、Worker管理、OpenAI Files API）

### 主要技術スタック
- **Frontend**: React + TypeScript + Material-UI
- **Backend**: Electron + Node.js
- **APIs**: OpenAI Files API + Chat Completions API
- **Audio Processing**: FFmpeg + 音声分割処理
- **File Processing**: mammoth (Office), OpenAI Files API (PDF), encoding-japanese (テキスト)

---

## 🔮 今後の予定

### 次期バージョン計画
- 並行文字起こし機能の実装
- パフォーマンス最適化
- UIの更なる改善
- 追加ファイル形式対応 