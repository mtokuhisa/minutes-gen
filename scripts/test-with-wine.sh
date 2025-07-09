#!/bin/bash

# Wine を使用してWindows EXEをMacでテスト
# 注意: Wineは完全なWindows環境ではないため、一部機能が動作しない可能性があります

echo "=== Wine EXE Test ==="
echo ""

# Wineがインストールされているか確認
if ! command -v wine &> /dev/null; then
    echo "❌ Wine is not installed."
    echo ""
    echo "To install Wine on macOS:"
    echo "  brew install --cask wine-stable"
    echo ""
    exit 1
fi

echo "✓ Wine version: $(wine --version)"
echo ""

# ビルドが存在するか確認
EXE_PATH="dist-electron/win-unpacked/MinutesGen.exe"

if [ ! -f "$EXE_PATH" ]; then
    echo "❌ EXE file not found at: $EXE_PATH"
    echo ""
    echo "Please run: npm run dist:zip"
    echo ""
    exit 1
fi

echo "✓ Found EXE file: $EXE_PATH"
echo "  Size: $(du -h "$EXE_PATH" | cut -f1)"
echo ""

# Wine環境の準備
export WINEARCH=win64
export WINEPREFIX="$HOME/.wine-minutesgen"

echo "Setting up Wine environment..."
echo "  WINEARCH: $WINEARCH"
echo "  WINEPREFIX: $WINEPREFIX"
echo ""

# 必要なWindows DLLをインストール
echo "Installing required Windows components..."
winetricks -q dotnet48 vcrun2019 > /dev/null 2>&1

# EXEを実行
echo "Starting MinutesGen.exe with Wine..."
echo "========================================="
echo ""

cd dist-electron/win-unpacked
wine MinutesGen.exe 2>&1 | while IFS= read -r line; do
    # Wine特有の警告をフィルタリング
    if [[ ! "$line" =~ "fixme:" ]] && [[ ! "$line" =~ "err:winediag:" ]]; then
        echo "$line"
    fi
done

echo ""
echo "========================================="
echo "Test completed." 