# MinutesGen アプリ起動検証手順書

## 📋 概要

このドキュメントは、MinutesGenアプリケーションの起動時に実行すべき検証手順を定義します。
**アプリが完全に起動・動作していることを確認してからユーザーに案内する**ことを目的としています。

---

## 🚀 アプリ起動時の手順

### Step 1: 環境クリーンアップ

```bash
# 1. 既存プロセスの完全終了
pkill -f "concurrently\|wait-on\|vite\|electron" || true

# 2. ポート使用状況の確認と解放
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 3. キャッシュクリア（必要に応じて）
rm -rf dist/ .vite/ node_modules/.vite/ 2>/dev/null || true
```

### Step 2: 🔥【重要】NODE_ENV環境変数の確認

```bash
# 必須チェック：NODE_ENV設定確認
echo "NODE_ENV=$NODE_ENV"

# ⚠️ NODE_ENVが空の場合は以下で起動
NODE_ENV=development npm run dev
```

**❌ よくある問題**: `NODE_ENV`未設定により、Electronが`dist/index.html`（存在しない）を読み込もうとしてERR_FILE_NOT_FOUNDエラーが発生

### Step 3: アプリケーション起動

```bash
# 開発環境での起動
npm run dev
```

### Step 4: 起動状況の段階的確認

#### 3.1 Viteサーバーの確認（5秒後）
```bash
# HTTP応答確認
curl -s -o /dev/null -w "HTTP応答: %{http_code}\n" http://localhost:3000

# 期待値: HTTP応答: 200
```

#### 3.2 Electronプロセスの確認（10秒後）
```bash
# Electronプロセスの存在確認
ps aux | grep -E "Electron.*\.app" | grep -v grep

# アクティブウィンドウの確認
osascript -e 'tell application "System Events" to get name of every process whose background only is false' | grep -i electron
```

#### 3.3 ウィンドウ表示の確認（15秒後）
```bash
# ウィンドウを前面に表示
osascript -e 'tell application "Electron" to activate' 2>/dev/null || true
```

---

## ⚠️ アプリ起動時の注意事項

### 重要な確認ポイント

1. **プロセス重複の防止**
   - 既存のconcurrently、vite、electronプロセスが残っていないか確認
   - 複数の同じプロセスが起動していると正常に動作しない

2. **ポート競合の回避**
   - ポート3000が他のプロセスに使用されていないか確認
   - "Port 3000 is already in use"エラーが出た場合は強制終了が必要

3. **wait-onプロセスの問題**
   - wait-onが複数起動すると無限待機状態になる
   - wait-onプロセスが異常に多い場合は全て終了してから再起動

4. **Electronウィンドウの表示確認**
   - プロセスが起動していてもウィンドウが表示されない場合がある
   - macOS では Dock やアクティブウィンドウリストで確認が必要

---

## ✅ アプリ起動後の必須確認事項

### 確認チェックリスト

#### 1. サーバー動作確認
- [ ] Viteサーバーが正常応答（HTTP 200）
- [ ] `http://localhost:3000` でアプリにアクセス可能
- [ ] コンソールエラーがない

#### 2. Electronアプリ確認
- [ ] Electronプロセスが起動中
- [ ] アクティブウィンドウリストに「Electron」が存在
- [ ] デスクトップにアプリウィンドウが表示されている

#### 3. 機能動作確認
- [ ] ファイルアップロード画面が表示される
- [ ] UIコンポーネントが正常に表示される
- [ ] テーマ切り替えが動作する

### 確認用コマンド（ワンライナー）

```bash
# 総合確認スクリプト
echo "=== MinutesGen起動確認 ===" && \
curl -s -o /dev/null -w "Viteサーバー: %{http_code}\n" http://localhost:3000 && \
echo "Electronプロセス: $(ps aux | grep -E 'Electron.*\.app' | grep -v grep | wc -l | tr -d ' ')個" && \
echo "アクティブウィンドウ: $(osascript -e 'tell application "System Events" to get name of every process whose background only is false' | grep -i electron | wc -l | tr -d ' ')個"
```

---

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 問題1: "Port 3000 is already in use"
```bash
# 解決方法
lsof -ti:3000 | xargs kill -9
npm run dev
```

#### 問題2: Electronウィンドウが表示されない
```bash
# wait-onプロセスを確認・停止
pkill -f "wait-on"
# Electronを直接起動
node --max-old-space-size=1024 ./node_modules/.bin/electron --max-old-space-size=1024 --expose-gc . &
```

#### 問題3: プロセスが重複している
```bash
# 全プロセス強制終了
pkill -9 -f "concurrently\|wait-on\|vite\|electron"
sleep 3
npm run dev
```

---

## 📊 ユーザー案内前の最終確認

### 必須確認項目（全てクリアしてから案内）

1. **✅ Viteサーバー**: HTTP 200応答
2. **✅ Electronプロセス**: 1個以上のプロセスが動作中  
3. **✅ ウィンドウ表示**: デスクトップにアプリウィンドウが表示
4. **✅ 基本機能**: ファイルアップロード画面が正常表示

### 案内時のテンプレート

```
✅ MinutesGenアプリケーションが正常に起動しました

📱 アクセス方法:
- Electronアプリ: デスクトップのウィンドウ
- ブラウザ: http://localhost:3000

🎯 次の手順:
1. 音声ファイルをアップロードしてください
2. 処理オプションを設定してください  
3. 議事録生成を開始してください
```

### ⚠️ 問題がある場合の案内

```
❌ アプリケーションの起動に問題があります

現在の状況:
- Viteサーバー: [STATUS]
- Electronプロセス: [STATUS]  
- ウィンドウ表示: [STATUS]

解決作業を実行中です。少々お待ちください。
```

---

## 🔧 開発者向け情報

### デバッグコマンド

```bash
# 詳細なプロセス確認
ps aux | grep -E "(vite|electron|concurrently|wait-on)" | grep -v grep

# ポート使用状況
lsof -i :3000

# プロセス階層確認  
pstree -p | grep -E "(vite|electron|node)"
```

### ログ確認

```bash
# Electronアプリのログ
tail -f logs/electron.log

# 開発サーバーのログ確認
tail -f logs/electron-debug.log
```

---

## 📝 更新履歴

- **2025.1.29**: 初版作成
  - アプリ起動検証手順の標準化
  - トラブルシューティング手順の整備
  - ユーザー案内前の確認項目明確化

---

**重要**: このドキュメントに従って確認せずにユーザーに「アプリが起動しました」と案内することは禁止されています。 