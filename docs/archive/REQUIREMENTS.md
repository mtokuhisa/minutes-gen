# MinutesGen v1.0 - 要件定義書

## 1. プロジェクト概要

### 1.1 プロジェクト名
MinutesGen v1.0

### 1.2 目的
音声ファイル・動画ファイルを自動的に議事録に変換するElectronアプリケーションの開発

### 1.3 対象ユーザー
- 会議の議事録作成を効率化したい企業・組織
- 音声コンテンツから文字起こしが必要な個人・団体
- 日本語での議事録作成が主要な用途

## 2. 機能要件

### 2.1 基本機能
1. **ファイルアップロード機能**
   - 対応形式: MP3, WAV, M4A, FLAC, AAC, MP4, MOV, AVI
   - 最大ファイルサイズ: 3GB
   - ドラッグ&ドロップ対応

2. **音声処理機能**
   - 音声の文字起こし（日本語メイン）
   - 発話者識別
   - タイムスタンプ付与

3. **AI議事録生成機能**
   - 要点の自動抽出
   - アクション項目の識別
   - 参加者情報の整理
   - 議事録の構造化

4. **出力機能**
   - Markdown形式
   - Word形式
   - HTML形式
   - PDF形式

### 2.2 処理オプション
- **速度設定**: 高速・標準・高品質
- **品質設定**: ドラフト・標準・プレミアム
- **言語設定**: 日本語・英語・自動検出
- **詳細設定**: 発話者識別・句読点・タイムスタンプ

### 2.3 ユーザーインターフェース
- 4段階のワークフロー
  1. ファイルアップロード
  2. 処理オプション設定
  3. AI処理（進捗表示）
  4. 結果確認・ダウンロード

## 3. 技術要件

### 3.1 フロントエンド
- **フレームワーク**: React 18
- **言語**: TypeScript
- **UIライブラリ**: Material-UI v5
- **ビルドツール**: Vite

### 3.2 バックエンド
- **プラットフォーム**: Electron
- **API**: OpenAI API（Whisper + GPT-4）
- **データ処理**: ローカル処理メイン

### 3.3 API仕様
- **音声認識**: GPT-4 Transcribe
- **議事録生成**: GPT-4.1 or o3（選択可能）
- **音声発声**: GPT-4 Mini TTS（ポッドキャスト用）
- **エンドポイント**: https://api.openai.com/v1/
- **認証**: API Key方式

## 4. 非機能要件

### 4.1 性能要件
- ファイルアップロード時間: 3GB以下で5分以内
- 処理時間: 1時間の音声で10-30分以内
- メモリ使用量: 8GB以下

### 4.2 セキュリティ要件
- ファイルはローカル処理
- API通信はHTTPS
- 一時ファイルの自動削除

### 4.3 互換性要件
- **OS**: macOS 10.15+, Windows 10+, Linux Ubuntu 18.04+
- **Node.js**: 18.0+
- **Electron**: 28.0+

## 5. 制約事項

### 5.1 技術制約
- インターネット接続必須（API使用のため）
- OpenAI APIの利用制限に依存
- 大容量ファイルの処理時間

### 5.2 ビジネス制約
- OpenAI APIの利用料金
- 処理可能な言語の制限
- 音声品質による認識精度の差

## 6. 成功基準

### 6.1 機能基準
- 95%以上の音声ファイル形式に対応
- 日本語音声で90%以上の認識精度
- 議事録生成の完了率95%以上

### 6.2 性能基準
- 1時間の音声処理を30分以内
- アプリケーション起動時間5秒以内
- メモリ使用量8GB以下

### 6.3 品質基準
- クラッシュ率1%以下
- ユーザビリティテスト合格
- 主要機能の自動テストカバレッジ80%以上

## 7. 開発スケジュール

### Phase 1: 基盤開発（Week 1-2）
- プロジェクト設定
- 基本UI実装
- ファイルアップロード機能

### Phase 2: 処理機能（Week 3-4）
- API連携実装
- 音声処理機能
- 進捗表示機能

### Phase 3: 出力機能（Week 5-6）
- 議事録生成機能
- 各種形式の出力
- 結果表示UI

### Phase 4: 品質向上（Week 7-8）
- テスト実装
- バグ修正
- 性能最適化

## 8. リスク管理

### 8.1 技術リスク
- **OpenAI API制限**: 代替処理の実装
- **大容量ファイル処理**: チャンク処理の実装
- **音声品質問題**: 前処理機能の追加

### 8.2 スケジュールリスク
- **API応答遅延**: 非同期処理の最適化
- **予期せぬバグ**: 十分なテスト期間の確保
- **要件変更**: アジャイル開発手法の採用

## 9. 付録

### 9.1 用語集
- **GPT-4 Transcribe**: OpenAIの最新音声認識AI
- **GPT-4.1/o3**: OpenAIの最新大規模言語モデル（議事録生成用）
- **GPT-4 Mini TTS**: OpenAIの音声合成AI（ポッドキャスト用）
- **Electron**: クロスプラットフォームデスクトップアプリ開発フレームワーク

### 9.2 参考資料
- OpenAI API Documentation
- Electron Documentation
- Material-UI Documentation
- React TypeScript Documentation 