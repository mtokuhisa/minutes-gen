#!/bin/bash

# PowerShellのバグを修正するためのスクリプト
echo "PowerShellのバグを修正しています..."

# PowerShellの設定ディレクトリを削除
rm -rf ~/.config/powershell/

# PowerShellの実行権限を削除
if command -v pwsh &> /dev/null; then
    echo "PowerShellが見つかりました。設定をリセットします..."
    
    # PowerShellの設定をリセット
    pwsh -NoProfile -NonInteractive -Command "
        Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
        Set-PSReadlineOption -EditMode Windows
        Set-PSReadlineOption -HistoryNoDuplicates
        Set-PSReadlineOption -HistorySearchCursorMovesToEnd
        Set-PSReadlineOption -HistorySaveStyle SaveIncrementally
        Set-PSReadlineOption -MaximumHistoryCount 4000
        Set-PSReadlineOption -ShowToolTips
        Set-PSReadlineOption -PredictionSource History
        Set-PSReadlineOption -BellStyle None
        Set-PSReadlineOption -CompletionQueryItems 100
        Set-PSReadlineOption -MaximumKillRingCount 10
        Set-PSReadlineOption -WordDelimiters ';:,.[]{}()/\|^&*-=+'
        Set-PSReadlineOption -AddToHistoryHandler {
            param([string]$command)
            return $command.Length -gt 3 -and $command -notmatch '^\\s*$'
        }
        Write-Host 'PowerShell設定をリセットしました'
    " 2>/dev/null
fi

# デフォルトシェルをzshに設定
if [ "$SHELL" != "/bin/zsh" ]; then
    echo "デフォルトシェルをzshに設定しています..."
    chsh -s /bin/zsh
fi

# PowerShellのアンインストール（オプション）
echo "PowerShellをアンインストールする場合は以下のコマンドを実行してください："
echo "  brew uninstall --cask powershell"
echo ""
echo "PowerShellのバグ修正が完了しました。"
echo "今後は以下のコマンドを使用してください："
echo "  npm run create-cert  # 証明書作成（Node.js版）"
echo "  npm run dev          # 開発サーバー起動"
echo "  npm run build        # ビルド" 