# 企業向けデプロイメントガイド

## 📋 目次
1. [概要](#概要)
2. [システム要件](#システム要件)
3. [設定ファイル](#設定ファイル)
4. [エラーハンドリング強化](#エラーハンドリング強化)
5. [パフォーマンス最適化](#パフォーマンス最適化)
6. [セキュリティ設定](#セキュリティ設定)
7. [デプロイメント手順](#デプロイメント手順)
8. [トラブルシューティング](#トラブルシューティング)

## 概要

MinutesGen v1.0 は企業環境での大規模展開に対応しています。このガイドでは、企業のセキュリティ要件とパフォーマンス要件を満たす設定方法を説明します。

## システム要件

### 最小要件
- Windows 10 / 11 (64bit)
- RAM: 8GB以上（推奨: 16GB以上）
- ストレージ: 2GB以上の空き容量
- インターネット接続（プロキシ経由可）

### 推奨要件
- Windows 11 (64bit)
- RAM: 32GB以上
- SSD ストレージ: 10GB以上
- 高速インターネット接続

## 設定ファイル

### corporate-config.json

```json
{
  "apiKey": "your-corporate-openai-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "organization": "your-org-id",
  "project": "your-project-id",
  "proxyUrl": "http://proxy.company.com:8080",
  "proxyAuth": "username:password",
  "allowPersonalKeys": false,
  "chunkSizeBytes": 80000000,
  "retryConfig": {
    "maxRetries": 5,
    "baseDelay": 3000,
    "maxDelay": 120000,
    "backoffMultiplier": 2
  },
  "models": {
    "transcribe": "gpt-4o-transcribe",
    "minutes": "gpt-4.1",
    "tts": "gpt-4o-mini-tts"
  },
  "security": {
    "enableCertificateValidation": false,
    "enableDebugLogs": false,
    "enableTelemetry": false
  },
  "performance": {
    "timeoutDuration": 300000,
    "maxConcurrentRequests": 3,
    "enableCompression": true
  }
}
```

### 設定項目の説明

#### 基本設定
- `apiKey`: 企業用OpenAI APIキー
- `baseUrl`: APIエンドポイント（通常は変更不要）
- `organization`: 組織ID（オプション）
- `project`: プロジェクトID（オプション）

#### ネットワーク設定
- `proxyUrl`: プロキシサーバーURL
- `proxyAuth`: プロキシ認証情報（username:password形式）
- `allowPersonalKeys`: 個人APIキーの使用を許可するか

#### パフォーマンス設定
- `chunkSizeBytes`: 音声ファイルのチャンクサイズ（デフォルト: 80MB）
- `timeoutDuration`: タイムアウト時間（ミリ秒）
- `maxConcurrentRequests`: 同時リクエスト数

## エラーハンドリング強化

### 自動リトライ機能

MinutesGen v1.0 では以下のエラーに対して自動リトライを実行します：

#### リトライ対象エラー
- **429 (Rate Limit)**: 利用制限エラー
- **500, 502, 503, 504**: サーバーエラー
- **ネットワークタイムアウト**: 接続タイムアウト
- **ネットワーク接続エラー**: 一時的な接続問題

#### リトライ設定
```json
"retryConfig": {
  "maxRetries": 5,        // 最大リトライ回数
  "baseDelay": 3000,      // 基本待機時間（ミリ秒）
  "maxDelay": 120000,     // 最大待機時間（ミリ秒）
  "backoffMultiplier": 2  // 待機時間の倍率
}
```

#### エラーメッセージの日本語化
すべてのエラーメッセージは日本語で表示され、ユーザーが理解しやすい形式で提供されます。

### 非リトライエラー
以下のエラーは即座に失敗として扱われます：
- **400 (Bad Request)**: リクエスト形式エラー
- **401 (Unauthorized)**: 認証エラー
- **403 (Forbidden)**: 権限エラー
- **413 (Payload Too Large)**: ファイルサイズエラー

## パフォーマンス最適化

### チャンクサイズ最適化

大容量音声ファイルの処理性能を向上させるため、チャンクサイズを最適化できます：

```json
"chunkSizeBytes": 80000000  // 80MB（デフォルト）
```

#### 推奨設定
- **高速ネットワーク環境**: 80MB - 100MB
- **標準ネットワーク環境**: 40MB - 60MB
- **低速ネットワーク環境**: 20MB - 30MB

### asar unpack 設定

ネイティブFFmpeg関連ファイルをasarから除外することで、大容量ファイル処理のパフォーマンスを向上：

```json
"asarUnpack": [
  "**/node_modules/ffmpeg-static/**/*",
  "**/node_modules/fluent-ffmpeg/**/*"
]
```

### 音声処理システムの改善

v0.7.3以降では、以下の改善が行われました：

#### ネイティブFFmpegの採用
- **FFmpeg.wasm → ネイティブFFmpeg**に移行
- **処理速度**: 5-10倍高速化
- **メモリ制限**: 15MB → 数GB対応
- **安定性**: メモリクラッシュの解消

#### 設定方法
```bash
# ネイティブFFmpegを有効にする（デフォルト）
REACT_APP_USE_NATIVE_FFMPEG=true

# レガシーFFmpegWasmにフォールバック（非推奨）
REACT_APP_USE_NATIVE_FFMPEG=false
```

### メモリ最適化

#### 推奨設定
- **RAM 8GB環境**: chunkSizeBytes = 20MB
- **RAM 16GB環境**: chunkSizeBytes = 50MB
- **RAM 32GB環境**: chunkSizeBytes = 80MB

## セキュリティ設定

### 証明書検証
企業環境での自己署名証明書に対応：

```json
"security": {
  "enableCertificateValidation": false
}
```

### ログ設定
デバッグログの有効/無効を制御：

```json
"security": {
  "enableDebugLogs": false
}
```

### テレメトリー設定
使用状況データの送信を制御：

```json
"security": {
  "enableTelemetry": false
}
```

## デプロイメント手順

### 1. 設定ファイルの準備
```bash
# 設定ファイルをコピー
cp corporate-config.sample.json corporate-config.json

# 設定を編集
notepad corporate-config.json
```

### 2. 実行ファイルの配置
```bash
# 実行ファイルを配置
mkdir C:\MinutesGen
copy MinutesGen.exe C:\MinutesGen\
copy corporate-config.json C:\MinutesGen\
```

### 3. 権限設定
- 実行ファイルに適切な権限を設定
- SmartScreen警告への対応

### 4. 動作確認
```bash
# テストモードで実行
C:\MinutesGen\MinutesGen.exe --test-mode
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. API認証エラー
```
エラー: API認証に失敗しました
解決: corporate-config.json のapiKeyを確認
```

#### 2. プロキシ接続エラー
```
エラー: プロキシ接続に失敗しました
解決: proxyUrl と proxyAuth を確認
```

#### 3. 大容量ファイル処理エラー
```
エラー: メモリ不足
解決: chunkSizeBytes を小さく設定（例: 20MB）
```

#### 4. SmartScreen警告
```
警告: 認識されないアプリ
解決: 「詳細情報」→「実行」をクリック
```

### ログの確認方法

#### デバッグログの有効化
```json
"security": {
  "enableDebugLogs": true
}
```

#### ログファイルの場所
```
Windows: %APPDATA%\MinutesGen\logs\
```

### サポート情報

#### 技術サポート
- Email: support@minutesgen.com
- 社内IT部門への連絡先を設定してください

#### 緊急時の対応
1. アプリケーションの再起動
2. 設定ファイルの初期化
3. 管理者権限での実行
4. IT部門への連絡

---

**重要**: 本ガイドの設定は企業のセキュリティポリシーに従って調整してください。 