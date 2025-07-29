# 🚀 **MinutesGen Windows アプリビルドガイド**

## 📋 **アプリ基本仕様**

### **概要**
- **アプリ名**: MinutesGen（議事録生成アプリ）
- **対象OS**: Windows 11 x64/ia32
- **配布形式**: ポータブルEXE（インストール不要）
- **主要機能**: 音声ファイルから議事録生成（大容量ファイル対応）

### **技術スタック**
```javascript
// フロントエンド
- React 18.3.1
- TypeScript
- Vite 4.5.14

// バックエンド  
- Electron 28.3.3
- Node.js
- FFmpeg/FFprobe（音声処理）

// ビルドツール
- electron-builder 24.13.3
```

### **アーキテクチャ特徴**
- **FFmpeg固定配置システム**: 一時ディレクトリ実行制限を回避
- **チャンク転送システム（戦略C）**: IPC制限を回避して大容量ファイル処理
- **動的メモリ管理**: ファイルサイズに応じた最適処理
- **コード署名**: セキュリティ警告回避

---

## 🔧 **ビルド方法**

### **前提条件**
```bash
# Node.js環境
node --version  # v18以上推奨
npm --version   # v9以上推奨

# 必要なグローバルパッケージ
npm install -g electron-builder
```

### **開発環境セットアップ**
```bash
# リポジトリクローン後
cd 議事録

# 依存関係インストール
npm install

# 開発サーバー起動（React）
npm run dev:react

# Electronアプリ起動（別ターミナル）
npm run electron:dev
```

### **Windowsポータブルアプリビルド**
```bash
# フルビルド（推奨）
npm run dist:portable

# または段階的ビルド
npm run build           # React + Electron ビルド
npm run build:react     # Reactのみビルド  
npm run build:electron  # Electronのみビルド
electron-builder --win portable --ia32  # ポータブルEXE生成
```

### **ビルド成果物**
```
dist-electron/
├── win-ia32-unpacked/           # 展開済みアプリ（テスト用）
└── MinutesGen_議事録アプリ_v0.7.7.exe  # 配布用ポータブルEXE（185MB）
```

---

## ⚙️ **重要なシステム仕様**

### **1. FFmpeg固定配置システム**

#### **目的**
Windows11ポータブルアプリの一時ディレクトリ実行制限を回避

#### **動作メカニズム**
```typescript
// アプリ起動時の自動処理
app.whenReady() → FFmpegBinaryManager.initialize() → 固定場所配置

// 配置場所
Windows: %USERPROFILE%\.minutesgen\bin\ffmpeg.exe
macOS: ~/.minutesgen/bin/ffmpeg  
Linux: ~/.minutesgen/bin/ffmpeg
```

#### **処理フロー**
1. **ディレクトリ作成**: `~/.minutesgen/bin/` 作成
2. **バイナリコピー**: app.asar.unpackedからFFmpeg/FFprobeをコピー
3. **権限設定**: 非Windows環境で実行権限付与
4. **動作確認**: `ffmpeg -version` 実行テスト
5. **初期化完了**: NativeAudioProcessorで固定パス使用開始

### **2. チャンク転送システム（戦略C）**

#### **目的**
大容量ファイル（635MB等）のIPC制限回避

#### **動作メカニズム**
```typescript
// 処理フロー
File(635MB) → 50MBチャンク×13 → IPC転送 → 結合 → FFmpeg処理

// 自動判定
100MB未満: 直接転送
100MB以上: チャンク転送（自動）
```

#### **技術詳細**
- **チャンクサイズ**: 50MB（IPC制限を大幅に下回る）
- **セッション管理**: ユニークID・専用ディレクトリ管理
- **エラー耐性**: チャンク単位のリトライ・自動クリーンアップ
- **メモリ効率**: 最大50MBのメモリ使用（96%削減）

### **3. 動的メモリ管理**
```typescript
// ファイルサイズ別処理選択
小ファイル: WebCodecs処理
大ファイル: NativeAudioProcessor（FFmpeg使用）

// メモリ推定
推定メモリ = ファイルサイズ × 4.5倍
必要メモリ = 推定メモリ × 1.5倍（バッファ）
```

---

## 📦 **package.json設定詳細**

### **electron-builder設定**
```json
{
  "build": {
    "appId": "com.example.minutes-gen",
    "productName": "MinutesGen_議事録アプリ",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "node_modules/**/*"
    ],
    "asarUnpack": [
      "node_modules/ffmpeg-static/**/*",
      "node_modules/ffprobe-static/**/*"
    ],
    "afterPack": "scripts/fix-ffmpeg-permissions.js",
    "win": {
      "target": [
        {
          "target": "portable",
          "arch": ["ia32"]
        }
      ],
      "artifactName": "${productName}_v${version}.exe",
      "publisherName": "YourCompany",
      "certificateFile": "MinutesGen-CodeSigning.p12",
      "certificatePassword": "your-password"
    }
  }
}
```

### **重要な設定項目**
- **`asarUnpack`**: FFmpeg/FFprobeバイナリをASAR外に配置
- **`afterPack`**: Windows PE32バイナリ置換スクリプト実行
- **`portable`**: インストール不要のポータブルEXE生成
- **`ia32`**: 32bit版（互換性重視）

---

## 🛠️ **重要なスクリプト**

### **`scripts/fix-ffmpeg-permissions.js`**
```javascript
// 目的: Windows PE32バイナリの確保
// 動作: macOS ARM64バイナリをWindows PE32に置換
// 実行タイミング: electron-builderのafterPackフック
```

#### **実行内容**
1. FFmpegバイナリ形式確認（`file`コマンド）
2. 非Windows形式検出時の自動置換
3. Windows用ffmpeg-staticパッケージダウンロード
4. PE32バイナリの配置・サイズ確認

---

## ⚠️ **注意点・トラブルシューティング**

### **1. FFmpeg実行エラー**

#### **症状**
```
spawn C:\Users\...\AppData\Local\Temp\...\ffmpeg ENOENT
```

#### **原因**
- Windows11の一時ディレクトリ実行制限
- ポータブルアプリの権限制限

#### **解決策**
✅ **FFmpeg固定配置システムが自動解決**
- アプリ起動時の自動初期化
- `~/.minutesgen/bin/`への固定配置
- 一時ディレクトリ依存の完全排除

### **2. 大容量ファイル処理エラー**

#### **症状**
```
Unable to deserialize cloned data
```

#### **原因**
- ElectronのIPC制限（大容量ArrayBuffer転送不可）

#### **解決策**
✅ **チャンク転送システム（戦略C）が自動解決**
- 100MB以上のファイルを自動判定
- 50MBチャンクへの分割転送
- IPC制限の完全回避

### **3. ビルドエラー対策**

#### **TypeScriptエラー**
```bash
# コンパイルエラー確認
npm run build:electron

# 型定義更新
npm install --save-dev @types/node
```

#### **electron-builderエラー**
```bash
# キャッシュクリア
npm run clean
rm -rf node_modules package-lock.json
npm install

# 権限エラー（macOS）
sudo xcode-select --install
```

### **4. コード署名**

#### **証明書設定**
```json
{
  "win": {
    "certificateFile": "MinutesGen-CodeSigning.p12",
    "certificatePassword": "your-password"
  }
}
```

#### **証明書作成**
```bash
# 自己署名証明書作成（開発用）
./scripts/create-certificate.js
```

---

## 🚀 **推奨ビルドフロー**

### **1. 開発・テスト**
```bash
# 開発サーバー起動
npm run dev:react

# Electronテスト
npm run electron:dev
```

### **2. ビルド前確認**
```bash
# TypeScriptコンパイル確認
npm run build:electron

# Reactビルド確認  
npm run build:react
```

### **3. ポータブルEXE生成**
```bash
# フルビルド実行
npm run dist:portable

# 成果物確認
ls -la dist-electron/MinutesGen_議事録アプリ_v*.exe
```

### **4. 動作確認**
```bash
# ポータブルEXE実行テスト
./dist-electron/MinutesGen_議事録アプリ_v0.7.7.exe

# 大容量ファイルテスト推奨
# - 635MB以上のファイルで処理確認
# - FFmpeg固定配置システム動作確認
# - チャンク転送処理確認
```

---

## 📊 **パフォーマンス仕様**

### **処理能力**
- **最大ファイルサイズ**: 3GB（理論値）
- **推奨ファイルサイズ**: 1GB以下
- **メモリ使用量**: 最大50MB（チャンク処理時）
- **処理速度**: ファイルサイズに比例（FFmpeg依存）

### **システム要件**
- **OS**: Windows 11（推奨）、Windows 10対応
- **メモリ**: 4GB以上推奨
- **ディスク**: 一時領域として処理ファイル×2倍の空き容量
- **CPU**: FFmpeg処理のためマルチコア推奨

---

## 🔄 **今後のメンテナンス**

### **定期更新項目**
1. **Electronバージョン**: セキュリティアップデート
2. **FFmpegバイナリ**: 最新版への更新
3. **証明書**: 期限切れ前の更新
4. **依存関係**: npm audit対応

### **機能拡張予定**
- **x64対応**: 64bit Windows環境での最適化
- **並列処理**: 複数ファイル同時処理
- **クラウド処理**: 大容量ファイルのサーバー処理

---

## 📚 **参考資料**

### **関連ドキュメント**
- `docs/FFMPEG_FIXED_PLACEMENT_SYSTEM_COMPLETE.md`: FFmpeg固定配置システム詳細
- `docs/STRATEGY_C_IMPLEMENTATION_COMPLETE.md`: チャンク転送システム詳細
- `package.json`: ビルド設定詳細

### **技術リファレンス**
- [Electron Builder](https://www.electron.build/): ビルドツール公式ドキュメント
- [FFmpeg](https://ffmpeg.org/): 音声処理エンジン
- [React](https://react.dev/): フロントエンドフレームワーク

---

**最終更新**: 2025年1月28日  
**対応バージョン**: v0.7.7  
**動作確認環境**: Windows 11, macOS (ビルド環境) 