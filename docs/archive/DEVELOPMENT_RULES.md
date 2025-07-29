# MinutesGen v1.0 - 開発ルール

## 1. 基本方針

### 1.1 開発原則
- **品質第一**: 動作する高品質なコードを優先
- **ユーザー体験重視**: 直感的で使いやすいインターフェース
- **保守性**: 可読性と拡張性を考慮したコード設計
- **セキュリティ**: API Key管理とデータ保護を最優先

### 1.2 コーディング規約
- **言語**: TypeScript必須（JavaScript禁止）
- **フォーマット**: Prettier + ESLint
- **命名**: camelCase（関数・変数）、PascalCase（コンポーネント・型）
- **コメント**: JSDoc形式で関数・クラスにドキュメント化

## 2. プロジェクト構成ルール

### 2.1 ディレクトリ構成
```
src/
├── components/     # Reactコンポーネント
├── hooks/         # カスタムフック
├── services/      # API連携・外部サービス
├── types/         # TypeScript型定義
├── utils/         # ユーティリティ関数
├── config/        # 設定ファイル
├── assets/        # 静的ファイル
└── __tests__/     # テストファイル
```

### 2.2 ファイル命名規則
- **コンポーネント**: PascalCase.tsx (例: FileUpload.tsx)
- **フック**: camelCase.ts (例: useAppState.ts)
- **サービス**: camelCase.ts (例: openaiService.ts)
- **型定義**: index.ts (各ディレクトリ)
- **テスト**: *.test.tsx または *.spec.tsx

### 2.3 インポート順序
1. React関連
2. 外部ライブラリ
3. 内部モジュール（絶対パス）
4. 相対パス

## 3. API連携ルール

### 3.1 OpenAI API使用規則
- **認証**: Bearer Token方式
- **エンドポイント**: 公式APIのみ使用
- **エラーハンドリング**: 必須実装
- **レート制限**: 適切な制御実装

### 3.2 API Key管理
- **環境変数**: `.env`ファイルで管理
- **暗号化**: ローカルストレージ保存時は暗号化
- **検証**: 設定画面でのテスト機能
- **セキュリティ**: ハードコーディング禁止

### 3.3 API呼び出しパターン
```typescript
// 推奨パターン
const apiCall = async (data: RequestData): Promise<ResponseData> => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new APIError(response.status, response.statusText);
    }
    
    return await response.json();
  } catch (error) {
    handleAPIError(error);
    throw error;
  }
};
```

## 4. コンポーネント設計ルール

### 4.1 コンポーネント構成
```typescript
// 推奨構成
import React, { useState, useCallback } from 'react';
import { ComponentProps } from '../types';

interface Props {
  // プロパティ定義
}

export const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // ステート定義
  const [state, setState] = useState<StateType>(initialValue);
  
  // イベントハンドラー
  const handleEvent = useCallback(() => {
    // 処理内容
  }, [dependencies]);
  
  // レンダリング
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### 4.2 Props設計
- **必須プロパティ**: 明確に定義
- **オプショナル**: デフォルト値を設定
- **コールバック**: useCallback使用
- **型定義**: 必須（any禁止）

### 4.3 状態管理
- **ローカル状態**: useState
- **複雑な状態**: useReducer
- **グローバル状態**: カスタムフック
- **副作用**: useEffect

## 5. 型定義ルール

### 5.1 型定義方針
- **interface**: オブジェクト型に使用
- **type**: Union型・関数型に使用
- **enum**: 定数値の管理
- **generic**: 再利用可能な型

### 5.2 型定義例
```typescript
// インターフェース
interface AudioFile {
  id: string;
  name: string;
  size: number;
  duration: number;
  format: string;
  path: string;
  uploadedAt: Date;
}

// Union型
type ProcessingStage = 'uploading' | 'transcribing' | 'generating' | 'completed';

// 列挙型
enum OutputFormat {
  MARKDOWN = 'markdown',
  WORD = 'word',
  HTML = 'html',
  PDF = 'pdf',
}

// ジェネリック型
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## 6. エラーハンドリングルール

### 6.1 エラー分類
- **APIエラー**: 外部API関連
- **ファイルエラー**: ファイル処理関連
- **バリデーションエラー**: 入力検証関連
- **システムエラー**: 予期しないエラー

### 6.2 エラー処理パターン
```typescript
interface AppError {
  id: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

const handleError = (error: Error): AppError => {
  return {
    id: generateId(),
    code: error.name,
    message: error.message,
    details: error.stack,
    timestamp: new Date(),
    recoverable: isRecoverable(error),
  };
};
```

## 7. テストルール

### 7.1 テスト方針
- **単体テスト**: 全コンポーネント・関数
- **結合テスト**: API連携・ワークフロー
- **E2Eテスト**: 主要ユーザーシナリオ
- **カバレッジ**: 80%以上

### 7.2 テストツール
- **単体テスト**: Jest + React Testing Library
- **E2Eテスト**: Playwright
- **モック**: MSW (Mock Service Worker)
- **カバレッジ**: Jest Coverage

### 7.3 テストパターン
```typescript
// コンポーネントテスト
describe('FileUpload', () => {
  it('should upload file successfully', async () => {
    const mockFile = new File(['content'], 'test.mp3', { type: 'audio/mp3' });
    const onFileSelect = jest.fn();
    
    render(<FileUpload onFileSelect={onFileSelect} />);
    
    const input = screen.getByLabelText('file-input');
    fireEvent.change(input, { target: { files: [mockFile] } });
    
    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(mockFile);
    });
  });
});
```

## 8. パフォーマンスルール

### 8.1 最適化方針
- **メモ化**: React.memo、useMemo、useCallback
- **遅延読み込み**: React.lazy、Suspense
- **仮想化**: 大量データ表示時
- **バンドル分割**: 動的インポート

### 8.2 パフォーマンス指標
- **初期読み込み**: 5秒以内
- **ファイル処理**: 3GB以下で5分以内
- **メモリ使用量**: 8GB以下
- **CPU使用率**: 80%以下

## 9. セキュリティルール

### 9.1 API Key保護
- **環境変数**: 本番環境
- **暗号化**: ローカル保存時
- **検証**: 設定時のテスト
- **ログ**: 機密情報の除外

### 9.2 ファイル処理
- **検証**: ファイル形式・サイズ
- **サニタイズ**: ファイル名・パス
- **一時ファイル**: 自動削除
- **アクセス制御**: 適切な権限設定

## 10. 品質管理ルール

### 10.1 コードレビュー
- **必須項目**: 機能・性能・セキュリティ
- **チェックリスト**: 標準化された項目
- **自動化**: ESLint・Prettier
- **ドキュメント**: 変更内容の記録

### 10.2 継続的改善
- **リファクタリング**: 定期的な実施
- **技術債務**: 計画的な解消
- **パフォーマンス**: 定期的な測定
- **セキュリティ**: 脆弱性の監視

## 11. 禁止事項

### 11.1 コーディング禁止
- **any型**: 型安全性を損なう
- **console.log**: 本番環境での使用
- **ハードコーディング**: 設定値・API Key
- **グローバル変数**: 名前空間の汚染

### 11.2 API使用禁止
- **非公式API**: 安定性の欠如
- **直接的なDOM操作**: Reactの原則違反
- **同期処理**: UI応答性の低下
- **無制限リクエスト**: レート制限違反

## 12. アプリケーション起動・検証ルール

### 12.1 起動検証義務
- **必須ドキュメント**: `docs/archive/APP_STARTUP_VERIFICATION.md` に従う
- **確認完了前の案内禁止**: 全ての検証が完了するまでユーザーに「起動完了」と案内しない
- **段階的確認**: Viteサーバー → Electronプロセス → ウィンドウ表示の順で確認
- **エラー時の透明性**: 問題がある場合は正直に状況を報告

### 12.2 必須確認項目
- **Viteサーバー**: HTTP 200応答の確認
- **Electronプロセス**: 実際のプロセス存在確認
- **ウィンドウ表示**: デスクトップでの視覚的確認
- **基本機能**: ファイルアップロード画面の正常表示

### 12.3 禁止事項
- **推測による案内**: 実際に確認せずに「起動完了」と案内する
- **部分確認**: 一部の確認のみで完了とする
- **時間による推測**: 時間経過のみで起動を判断する
- **プロセス確認のみ**: ウィンドウ表示を確認しない

### 12.4 トラブルシューティング
- **重複プロセス**: 必ず既存プロセスを終了してから起動
- **ポート競合**: lsofコマンドでポート状況を確認
- **wait-on問題**: 複数のwait-onプロセスは即座に終了
- **詳細ログ**: 問題時は詳細なプロセス情報を収集

### 12.5 ❌ 過去の障害事例（2025年1月）
- **症状**: ElectronでERR_FILE_NOT_FOUND（dist/index.htmlが存在しない）
- **根本原因**: package.jsonでNODE_ENV=development未設定
- **影響**: 開発モードでプロダクション判定され、存在しないファイルを読み込み
- **教訓**: 環境変数は必ず最初に確認、基本事項の確認怠慢は禁物
- **対策**: package.json修正、診断手順標準化、防御的プログラミング強化

## 13. 緊急時対応

### 13.1 障害対応
- **ログ収集**: 詳細なエラー情報
- **ロールバック**: 安定版への復帰
- **ユーザー通知**: 適切な情報提供
- **原因分析**: 再発防止策

### 13.2 セキュリティ対応
- **API Key漏洩**: 即座に無効化
- **脆弱性発見**: 緊急パッチ適用
- **不正アクセス**: アクセス制御強化
- **データ保護**: 暗号化・バックアップ 