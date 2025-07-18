#!/bin/zsh

# PowerShellのバグを回避してアプリケーションを起動
export SHELL=/bin/zsh
export PATH=/usr/local/bin:/usr/bin:/bin

echo "🚀 MinutesGen アプリケーションを起動中..."
echo "📁 作業ディレクトリ: $(pwd)"

# 既存のプロセスを終了
echo "🔧 既存のプロセスを終了中..."
pkill -f "node\|npm\|vite\|electron" 2>/dev/null || true
sleep 2

# Viteサーバーを起動
echo "🔧 Viteサーバーを起動中..."
npx vite --port 3000 --strictPort &
VITE_PID=$!

# Viteサーバーが起動するまで待機
echo "⏱️  Viteサーバーの起動を待機中..."
while ! curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
done

echo "✅ Viteサーバーが起動しました - http://localhost:3000"

# Electronを起動
echo "🔧 Electronを起動中..."
npx electron --max-old-space-size=8192 --expose-gc . &
ELECTRON_PID=$!

echo "✅ Electronを起動しました"
echo "🎉 MinutesGenアプリケーションが起動しました！"
echo "🌐 ブラウザURL: http://localhost:3000"
echo "📱 Electronアプリが開いているはずです"

# プロセスを監視
trap 'echo "⏹️  アプリケーションを終了中..."; kill $VITE_PID $ELECTRON_PID 2>/dev/null || true; exit' INT TERM

# プロセスを永続化
wait 