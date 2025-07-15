# MinutesGen v0.7.3

AI を活用した次世代の議事録生成ツール。音声ファイルを美しい議事録に変換し、チームの生産性を向上させます。

## 機能

- 🎤 音声ファイルの自動文字起こし（OpenAI Whisper）
- 🤖 AI による議事録の自動生成（GPT-4o）
- 📝 複数の出力形式対応（Markdown、Word、HTML、PDF）
- 🎯 要点・アクション項目の自動抽出
- 👥 発話者識別機能
- 🎨 モダンで美しいUI
- 📱 レスポンシブデザイン

## 技術スタック

- **フロントエンド**: React 18, TypeScript, Material-UI
- **バックエンド**: Electron
- **音声処理**: ネイティブFFmpeg（ffmpeg-static + fluent-ffmpeg）
- **API**: OpenAI Whisper & GPT-4o
- **ビルドツール**: Vite
- **テスト**: Jest, Playwright

## 音声処理システムの改善 (v0.7.3)

### ネイティブFFmpegの採用
- **FFmpeg.wasm → ネイティブFFmpeg**に完全移行
- **処理速度**: 5-10倍高速化
- **メモリ制限**: 15MB → 数GB対応
- **安定性**: メモリクラッシュの解消

### 対応ファイル形式
- **音声**: MP3, WAV, M4A, FLAC, OGG
- **動画**: MP4, AVI, MOV, WMV（音声抽出）
- **大容量ファイル**: 数GB対応

### 設定方法
```bash
# ネイティブFFmpegを有効にする（デフォルト）
REACT_APP_USE_NATIVE_FFMPEG=true

# レガシーFFmpegWasmにフォールバック（非推奨）
REACT_APP_USE_NATIVE_FFMPEG=false
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. API設定

#### 方法1: 環境変数設定

`.env` ファイルを作成して以下を設定：

```env
VITE_API_BASE_URL=https://api.openai.com/v1
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_WHISPER_MODEL=whisper-1
VITE_GPT_MODEL=gpt-4o-mini
VITE_MAX_FILE_SIZE=3221225472
VITE_TIMEOUT_DURATION=300000
VITE_RETRY_ATTEMPTS=3
VITE_DEV_MODE=true
VITE_DEBUG_LOGS=true
```

#### 方法2: UI での設定

1. アプリケーションを起動
2. ヘッダーの「設定」ボタンをクリック
3. OpenAI API キーを入力
4. 「API接続テスト」で動作確認
5. 設定を保存

### 3. 実行

#### 開発環境

```bash
# React アプリのみ
npm run dev:react

# Electron アプリ
npm run dev
```

#### 本番ビルド

```bash
npm run build
npm run package
```

## 使用方法

1. **ファイルアップロード**: 音声/動画ファイルをドラッグ&ドロップ
2. **オプション設定**: 処理速度、品質、出力形式を選択
3. **AI処理**: 自動で文字起こし・議事録生成
4. **結果確認**: 生成された議事録を確認・ダウンロード

## 対応ファイル形式

- **音声**: MP3, WAV, M4A, FLAC, AAC
- **動画**: MP4, MOV, AVI
- **最大サイズ**: 3GB

## API キーの取得

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. アカウントを作成・ログイン
3. API キーを生成
4. 料金プランを確認・設定

## 料金について

- **Whisper API**: $0.006/分
- **GPT-4o**: $0.03/1K tokens（入力）、$0.06/1K tokens（出力）
- **GPT-4o-mini**: $0.0015/1K tokens（入力）、$0.006/1K tokens（出力）

## トラブルシューティング

### API接続エラー

1. API キーが正しく設定されているか確認
2. OpenAI アカウントに十分な残高があるか確認
3. ネットワーク接続を確認

### ファイルアップロードエラー

1. ファイルサイズが 3GB 以下であるか確認
2. 対応形式のファイルであるか確認
3. ファイルが破損していないか確認

### 処理が遅い

1. 高速処理モードを選択
2. ファイルサイズを小さくする
3. 品質設定を下げる

## 開発者向け

### プロジェクト構成

```
src/
├── components/     # React コンポーネント
├── hooks/         # カスタムフック
├── services/      # API サービス
├── config/        # 設定ファイル
├── types/         # TypeScript 型定義
└── theme.ts       # Material-UI テーマ
```

### コマンド

```bash
# 開発サーバー起動
npm run dev:react

# 型チェック
npm run type-check

# リント
npm run lint

# テスト
npm run test
npm run test:e2e

# ビルド
npm run build
```

## ライセンス

MIT License

## サポート

- [GitHub Issues](https://github.com/minutesgen/v1.0/issues)
- [Discord コミュニティ](https://discord.gg/minutesgen)

## 貢献

Pull Request を歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。 