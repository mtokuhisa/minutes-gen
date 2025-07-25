# MinutesGen 設計ドキュメント

## 1. システム全体設計

### 1.1. 概要と設計思想

本システムは、音声・テキストファイルからAIを活用して高品質な議事録を生成するElectronベースのデスクトップアプリケーションである。設計の核となる思想は以下の通り。

-   **ハイブリッド対応**: 企業での一括導入と個人利用の両方を想定し、認証・設定システムを柔軟に切り替えられる。
-   **ローカルファーストとセキュリティ**: ユーザーデータとAPIキーは最大限ローカルで管理・暗号化し、外部への情報漏洩リスクを最小限に抑える。AIモデルの学習にデータが利用されないことを保証する。
-   **スケーラビリティ**: 大容量の音声ファイル（最大3GB）や長文テキスト（最大100万トークン）に対応するため、ネイティブ処理、動的メモリ管理、チャンク分割などの技術を積極的に採用する。
-   **UX（ユーザー体験）**: 専門知識がないユーザーでも直感的に操作できるよう、ステップ・バイ・ステップのUIと、処理中の詳細な進捗フィードバックを提供する。

### 1.2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│    (Node.js / ファイルシステム / FFmpegネイティブ実行)        │
├─────────────────────────────────────────────────────────────┤
│                React Frontend Application (Vite)            │
│          (UI / 状態管理 / APIクライアント)                    │
├─────────────────────────────────────────────────────────────┤
│           File System          │        OpenAI API         │
│        (Local Storage)         │   (Transcribe / GPT)      │
└─────────────────────────────────────────────────────────────┘
```

### 1.3. 技術スタック

-   **Frontend**: React (`^18.2.0`), TypeScript (`^5.0.0`), Material-UI (`^5.14.0`), Vite (`^4.4.0`)
-   **Desktop App**: Electron (`^28.0.0`), Node.js (`>=18.0.0` 推奨)
-   **AI API**: OpenAI API (詳細は後述)
-   **音声処理**: FFmpeg (ネイティブバイナリを`ffmpeg-static`経由で利用)
-   **データ永続化**: LocalStorage (設定・認証状態), ローカルファイルシステム (出力ファイル)
-   **暗号化**: `crypto-js` (AES)

## 2. 主要機能の技術設計

### 2.1. 音声処理 (ネイティブFFmpeg)

従来のブラウザベースのWebCodecsやWasm実装の制限（メモリ、処理速度）を克服するため、ElectronのNode.js環境から直接ネイティブのFFmpegバイナリを実行する。

-   **機能**:
    -   30種類以上の音声・動画フォーマット入力に対応。
    -   音声解析 (`ffprobe-static`): 再生時間、フォーマット、ビットレート等のメタデータを正確に取得。
    -   セグメント分割: 600秒（10分）単位で音声ファイルを`.wav`形式に無劣化で分割し、OpenAI APIの個別リクエスト上限に対応。
    -   APIへのアップロード: 安全のため、分割後の音声ファイルも**15MB**ごとのチャンクに分割してAPIに送信する。
    -   大容量ファイル（最大3GB）の安定処理を実現。

### 2.2. 動的メモリ管理

大容量ファイルを安全に処理するため、ファイルサイズに基づいて処理戦略を動的に変更する。

-   **`MemoryEstimationService`**: ファイルサイズとファイル名から、処理に必要なメモリ量を推定する。
-   **`DynamicMemoryService`**:
    -   メモリ使用量に応じて処理モードを`light`, `medium`, `heavy`に自動選択。
    -   `light`モード: メインプロセスで直接処理。
    -   `heavy`モード: メモリ超過が予測される場合、ElectronのWorkerプロセスを生成して処理を委譲し、メインプロセスのクラッシュを防止する。(v0.7.5時点)

### 2.3. AI連携・テキスト処理

#### 2.3.1. 利用APIモデルとレート制限

以下の利用APIモデルはユーザー側で実際に存在していることとスペックを確認済
AI側で情報がなくても"間違い"ではなく、明示的な指示がない限り絶対変更不可

| 用途 | モデル | コンテキストウィンドウ | 最大出力トークン |
| :--- | :--- | :--- | :--- |
| **音声認識** | `gpt-4o-transcribe` | - | - |
| **議事録生成** | `GPT-4.1` | 1,047,576 | 32,768 |
| | `o3` | 200,000 | 100,000 |
| **音声合成** | `gpt-4o-mini-tts` | - | - |

-   **TPM (Tokens Per Minute)**: 800,000
-   **RPM (Requests Per Minute)**: 5,000

> [!IMPORTANT]
> **o3モデルの特殊なパラメータ要件**
> `o3`はReasoning Modelのため、APIリクエスト時に以下の特殊なパラメータ要件が存在します。
> - **`max_completion_tokens`**: `max_tokens`の代わりに使用する必要があります。
> - **`temperature`**: このパラメータはリクエストに含めてはなりません。

#### 2.3.2. 大容量テキスト処理 (チャンキング)

`GPT-4.1`の100万トークンを超えるような長文文字起こしデータを処理するため、テキストを意味のある単位で分割し、個別に要約させてから最終的に結合する戦略をとる。

1.  **トークン数推定**: `text.length * 1.5` の簡易式で推定。
2.  **分割判定**: 推定トークン数がモデルの安全入力上限 (`safeInputTokens`) を超える場合に分割処理を実行。
3.  **分割処理**:
    -   まず改行（`\n\n`）で段落に分割。
    -   段落が長すぎる場合は句読点（`。` `！` `？`）で文に分割。
    -   それでも長すぎる場合は指定文字数で強制分割。
4.  **並列処理と結合**: 分割されたチャンクを個別にAPIに送信し、得られた結果を後続のプロンプトで結合・整形する。

### 2.4. セキュリティと認証

#### 2.4.1. ハイブリッド認証システム

-   **企業パスワード認証**:
    -   ビルド時に管理者が `scripts/encrypt-api-key.js` を実行し、環境変数に設定した企業用APIキーをパスワードで暗号化して`authService.ts`内に埋め込む。
    -   ユーザーは配布されたパスワードでAPIキーを復号して利用する。
-   **個人APIキー認証**:
    -   ユーザーが入力したAPIキーを、固定のソルト (`personal_key_salt`) を使用してAES暗号化し、`localStorage`に保存する。

#### 2.4.2. APIキーの管理

-   **原則**: APIキーの平文は`localStorage`に保存しない。
-   **フロー**:
    1.  アプリ起動時に`localStorage`から認証状態（`authMethod`）と暗号化済みキーを読み込む。
    2.  必要に応じてパスワード入力/復号を行い、シングルトンである`AuthService`のメモリ上にAPIキーを一時的に保持する。
    3.  一度メモリに保持されたAPIキーは、アプリケーションが終了するまで再利用されるため、パスワードの再入力は不要となる。
    4.  APIリクエスト時にヘッダーに付与する。

## 3. フロントエンド設計

### 3.1. コンポーネント構成

UIは主要なステップに対応するコンポーネントで構成される。

```
App.tsx (アプリケーション全体のコンテナ)
├── AppHeader.tsx (ヘッダー)
├── StepIndicator.tsx (進捗インジケーター: 1.ファイル選択, 2.オプション, 3.処理中...)
├── FileUpload.tsx (Step 1)
├── ProcessingOptions.tsx (Step 2)
├── ProcessingProgress.tsx (Step 3)
└── Results.tsx (Step 4: 結果表示)
```

### 3.2. 状態管理 (`useAppState.ts`)

`useState`と`useContext`を組み合わせたカスタムフック`useAppState`で、アプリケーション全体のグローバルな状態を一元管理する。

```typescript
interface AppState {
  currentStep: number;
  selectedFile: AudioFile | null;
  processingOptions: ProcessingOptions;
  progress: ProcessingProgress | null;
  results: MinutesData | null;
  error: AppError | null;
  isProcessing: boolean;
  // ...その他、認証状態など
}
```

### 3.3. データフロー

ユーザー操作による状態遷移は、すべて`useAppState`が提供するセッター関数を通じて行われる。

1.  **ファイル選択**: `FileUpload` → `setSelectedFile` → `currentStep`が `1` に。
2.  **オプション設定**: `ProcessingOptions` → `setProcessingOptions`。
3.  **処理開始**: 「AI処理」ボタンクリック → `setIsProcessing(true)` → `currentStep`が `2` に。
4.  **進捗更新**: バックエンドサービスからの`onProgress`コールバック → `setProgress` → `ProcessingProgress`コンポーネントが再描画。
5.  **処理完了**: `setResults` → `currentStep`が `3` に → `Results`コンポーネントが表示される。

## 4. テストと品質保証

### 4.1. テスト戦略

-   **単体テスト (Jest)**: `services`層のロジック、`utils`の関数など、UIに依存しないビジネスロジックを中心にテスト。
-   **コンポーネントテスト (React Testing Library)**: 各UIコンポーネントが期待通りに描画され、ユーザーインタラクションに反応することをテスト。
-   **E2Eテスト (Playwright)**: ユーザーの主要な操作フロー（ファイルアップロードから議事録ダウンロードまで）を自動テスト。

### 4.2. パフォーマンス

-   **UI**: `React.memo`や`useCallback`による不要な再レンダリングの抑制。仮想化リストによる大量データ表示の最適化。
-   **バックエンド**: 非同期処理を徹底し、UIスレッドをブロックしない。メモリ監視と、必要に応じたWorkerプロセスの利用。
