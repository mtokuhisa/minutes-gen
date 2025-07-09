/**
 * EXEモード擬似テストスクリプト
 * Mac環境でWindows exeの動作を部分的に検証
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// EXEモードを強制的に有効化
process.env.NODE_ENV = 'production';
app.isPackaged = true;

// Windows環境を擬似
const originalPlatform = process.platform;
Object.defineProperty(process, 'platform', {
  value: 'win32'
});

console.log('=== EXE Mode Test ===');
console.log('Platform:', process.platform);
console.log('Packaged:', app.isPackaged);
console.log('Environment:', process.env.NODE_ENV);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });

  // distフォルダの存在確認
  const distPath = path.join(__dirname, '..', 'dist');
  const indexPath = path.join(distPath, 'index.html');
  
  console.log('Checking dist folder:', distPath);
  console.log('Dist exists:', fs.existsSync(distPath));
  console.log('Index exists:', fs.existsSync(indexPath));

  if (fs.existsSync(indexPath)) {
    console.log('Loading production build...');
    win.loadFile(indexPath);
    
    // ファイルパスの問題をチェック
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Load failed:', errorCode, errorDescription);
    });
    
    win.webContents.on('did-finish-load', () => {
      console.log('✓ Page loaded successfully');
      
      // コンソールメッセージを監視
      win.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer ${level}]:`, message);
      });
    });
    
    // 開発者ツールを開く
    win.webContents.openDevTools();
  } else {
    console.error('✗ Production build not found. Run "npm run build" first.');
    app.quit();
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  // プラットフォームを元に戻す
  Object.defineProperty(process, 'platform', {
    value: originalPlatform
  });
  app.quit();
}); 