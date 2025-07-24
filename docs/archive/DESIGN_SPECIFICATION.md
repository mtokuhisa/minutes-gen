# MinutesGen v1.0 - 設計仕様書

## 1. システム全体設計

### 1.1 アーキテクチャ概要
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
├─────────────────────────────────────────────────────────────┤
│                React Frontend Application                   │
├─────────────────────────────────────────────────────────────┤
│           File System          │        OpenAI API         │
│        (Local Storage)         │    (Whisper + GPT-4)      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技術スタック
- **Frontend**: React 18 + TypeScript + Material-UI
- **Backend**: Electron 28 + Node.js
- **Build**: Vite + TypeScript
- **API**: OpenAI API (Whisper + GPT-4)
- **Storage**: Local File System

### 1.3 API統合仕様
- **Base URL**: https://api.openai.com/v1/
- **Authentication**: Bearer Token (API Key)
- **Models**:
  - **音声認識**: GPT-4 Transcribe
  - **議事録生成**: GPT-4.1 or o3（選択可能）
  - **音声発声**: GPT-4 Mini TTS（ポッドキャスト用）

## 2. フロントエンド設計

### 2.1 コンポーネント構成
```
App.tsx
├── AppHeader.tsx
├── StepIndicator.tsx
├── FileUpload.tsx
├── ProcessingOptions.tsx
├── ProcessingProgress.tsx
├── Results.tsx
└── AppFooter.tsx
```

### 2.2 状態管理
```typescript
interface AppState {
  currentStep: number;
  selectedFile: AudioFile | null;
  processingOptions: ProcessingOptions;
  progress: ProcessingProgress | null;
  results: MinutesData | null;
  error: AppError | null;
  isProcessing: boolean;
}
```

### 2.3 型定義システム
- **AudioFile**: 音声ファイル情報
- **ProcessingOptions**: 処理オプション設定
- **MinutesData**: 議事録データ
- **APIResponse**: API応答形式

## 3. API連携設計

### 3.1 GPT-4 Transcribe API
```typescript
// 音声文字起こし
const transcribeAudio = async (audioFile: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'gpt-4-transcribe');
  formData.append('language', 'ja');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: formData,
  });
  
  return response.json();
};
```

### 3.2 GPT-4.1/o3 API
```typescript
// 議事録生成（選択可能モデル）
const generateMinutes = async (transcription: string, model: 'gpt-4.1' | 'o3' = 'gpt-4.1'): Promise<MinutesData> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: '議事録作成のプロフェッショナルとして、構造化された議事録を作成してください。'
        },
        {
          role: 'user',
          content: `以下の文字起こしから議事録を作成してください：\n\n${transcription}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });
  
  return response.json();
};
```

### 3.3 GPT-4 Mini TTS API
```typescript
// 音声発声（ポッドキャスト用）
const generateSpeech = async (text: string): Promise<Blob> => {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-mini-tts',
      input: text,
      voice: 'alloy',
      response_format: 'mp3',
    }),
  });
  
  return response.blob();
};
```

### 3.3 エラーハンドリング
```typescript
interface APIError {
  code: string;
  message: string;
  type: 'rate_limit' | 'invalid_request' | 'server_error';
  retryAfter?: number;
}

const handleAPIError = (error: APIError): void => {
  switch (error.type) {
    case 'rate_limit':
      // レート制限時の処理
      break;
    case 'invalid_request':
      // 無効なリクエスト時の処理
      break;
    case 'server_error':
      // サーバーエラー時の処理
      break;
  }
};
```

## 4. データフロー設計

### 4.1 処理フロー
```
1. ファイルアップロード
   ↓
2. ファイル検証・前処理
   ↓
3. Whisper APIで文字起こし
   ↓
4. GPT-4 APIで議事録生成
   ↓
5. 結果の構造化・表示
   ↓
6. 各種形式での出力
```

### 4.2 進捗管理
```typescript
interface ProcessingProgress {
  stage: 'uploading' | 'transcribing' | 'generating' | 'formatting' | 'completed';
  percentage: number;
  currentTask: string;
  estimatedTimeRemaining: number;
  logs: string[];
  startedAt: Date;
}
```

## 5. セキュリティ設計

### 5.1 API Key管理
- 環境変数での管理
- ローカルストレージでの暗号化保存
- 設定画面での安全な入力

### 5.2 ファイル処理
- 一時ファイルの自動削除
- メモリ効率的な処理
- ファイル形式の検証

### 5.3 通信セキュリティ
- HTTPS通信の強制
- API応答の検証
- エラー情報の適切な処理

## 6. パフォーマンス設計

### 6.1 ファイル処理最適化
- チャンク処理による大容量ファイル対応
- 非同期処理によるUI応答性維持
- メモリ使用量の監視

### 6.2 API呼び出し最適化
- リクエスト分割による制限回避
- 適切なタイムアウト設定
- リトライ機構の実装

### 6.3 UI最適化
- 仮想化による大量データ表示
- 遅延読み込み
- 適切なローディング表示

## 7. テスト設計

### 7.1 単体テスト
- コンポーネントテスト (Jest + React Testing Library)
- API連携テスト
- ユーティリティ関数テスト

### 7.2 結合テスト
- ワークフロー全体のテスト
- API統合テスト
- ファイル処理テスト

### 7.3 E2Eテスト
- Playwright による自動テスト
- 主要ユーザーシナリオのテスト
- クロスプラットフォームテスト

## 8. 配布・運用設計

### 8.1 ビルド設定
```json
{
  "build": {
    "appId": "com.minutesgen.app",
    "productName": "MinutesGen",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*"
    ]
  }
}
```

### 8.2 プラットフォーム対応
- **macOS**: .dmg形式
- **Windows**: .exe形式 (NSIS)
- **Linux**: AppImage形式

### 8.3 自動更新
- Electron Updater による自動更新
- 差分更新による効率化
- 更新通知とユーザー確認

## 9. 拡張性設計

### 9.1 プラグイン機構
- 出力形式の拡張
- 前処理フィルターの追加
- カスタムプロンプトの管理

### 9.2 多言語対応
- i18n による国際化
- 言語設定の保存
- 動的言語切り替え

### 9.3 API拡張
- 他のAIサービスとの統合
- カスタムAPIエンドポイント
- プロバイダー切り替え機能

## 10. 設定管理

### 10.1 アプリケーション設定
```typescript
interface AppConfig {
  apiKey: string;
  defaultLanguage: 'ja' | 'en' | 'auto';
  outputFormats: OutputFormat[];
  processingQuality: 'draft' | 'standard' | 'premium';
  autoSave: boolean;
  theme: 'light' | 'dark' | 'auto';
}
```

### 10.2 設定の永続化
- Electron Store による設定保存
- 設定の暗号化
- 設定のインポート/エクスポート

### 10.3 デフォルト設定
- 初回起動時の設定ウィザード
- 推奨設定の提案
- 設定のリセット機能 