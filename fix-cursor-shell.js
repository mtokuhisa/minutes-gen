#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 Cursorのシェル設定を修正中...');

// Cursorの設定ファイルパス
const cursorSettingsPath = path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');

console.log('📍 設定ファイルパス:', cursorSettingsPath);

// 設定ファイルが存在するかチェック
if (!fs.existsSync(cursorSettingsPath)) {
    console.log('⚠️  Cursorの設定ファイルが見つかりません。新しく作成します。');
    
    // ディレクトリを作成
    const settingsDir = path.dirname(cursorSettingsPath);
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
        console.log('✅ 設定ディレクトリを作成しました:', settingsDir);
    }
}

// 新しい設定内容
const newSettings = {
    "terminal.integrated.defaultProfile.osx": "zsh",
    "terminal.integrated.shell.osx": "/bin/zsh",
    "terminal.integrated.profiles.osx": {
        "zsh": {
            "path": "/bin/zsh",
            "args": ["-l"],
            "icon": "terminal"
        },
        "bash": {
            "path": "/bin/bash",
            "args": ["-l"],
            "icon": "terminal-bash"
        }
    },
    "terminal.integrated.automationShell.osx": "/bin/zsh",
    "terminal.integrated.env.osx": {
        "SHELL": "/bin/zsh"
    },
    "terminal.integrated.inheritEnv": true,
    "terminal.integrated.enableMultiLinePasteWarning": false,
    "terminal.integrated.fontSize": 14,
    "terminal.integrated.fontFamily": "Monaco, 'Courier New', monospace"
};

try {
    let currentSettings = {};
    
    // 既存の設定を読み込み
    if (fs.existsSync(cursorSettingsPath)) {
        const content = fs.readFileSync(cursorSettingsPath, 'utf8');
        if (content.trim()) {
            currentSettings = JSON.parse(content);
            console.log('✅ 既存の設定を読み込みました');
        }
    }
    
    // PowerShell関連の設定を削除
    const powershellKeys = [
        'terminal.integrated.shell.powershell',
        'terminal.integrated.profiles.powershell',
        'terminal.integrated.profiles.osx.PowerShell',
        'terminal.integrated.profiles.osx.pwsh'
    ];
    
    powershellKeys.forEach(key => {
        if (currentSettings[key]) {
            delete currentSettings[key];
            console.log('🗑️  PowerShell設定を削除:', key);
        }
    });
    
    // 新しい設定をマージ
    const mergedSettings = { ...currentSettings, ...newSettings };
    
    // 設定ファイルに保存
    fs.writeFileSync(cursorSettingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ Cursorの設定を更新しました');
    console.log('📋 適用された設定:');
    console.log('   - デフォルトシェル: zsh');
    console.log('   - シェルパス: /bin/zsh');
    console.log('   - PowerShell設定: 削除済み');
    
} catch (error) {
    console.error('❌ 設定の更新に失敗しました:', error);
    
    // バックアップ設定を作成
    const backupSettings = JSON.stringify(newSettings, null, 2);
    fs.writeFileSync(cursorSettingsPath, backupSettings);
    console.log('🔄 バックアップ設定を適用しました');
}

console.log('\n🎯 次の手順:');
console.log('1. Cursorを再起動してください');
console.log('2. 新しいターミナルを開いてください (Cmd+Shift+`)');
console.log('3. zshプロンプトが表示されることを確認してください');
console.log('4. PowerShellのエラーが解決されていることを確認してください');

console.log('\n✅ 修正完了！'); 