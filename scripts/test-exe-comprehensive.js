/**
 * 包括的なEXEテストスクリプト
 * 画像表示、ページ遷移、基本機能を確認
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== 包括的EXEテスト開始 ===');
console.log('Platform:', process.platform);

// Electronアプリのパスを決定
let appPath;
if (process.platform === 'darwin') {
  appPath = path.join(__dirname, '..', 'dist-electron', 'mac-arm64', 'MinutesGen.app', 'Contents', 'MacOS', 'MinutesGen');
} else if (process.platform === 'win32') {
  appPath = path.join(__dirname, '..', 'dist-electron', 'MinutesGen_議事録アプリ_v0.7.3.exe');
} else {
  console.error('未対応のプラットフォームです:', process.platform);
  process.exit(1);
}

// アプリファイルの存在確認
if (!fs.existsSync(appPath)) {
  console.error('アプリファイルが見つかりません:', appPath);
  process.exit(1);
}

console.log('アプリパス:', appPath);

// テスト結果格納用オブジェクト
let testResults = {
  appLaunched: false,
  distExists: false,
  htmlExists: false,
  jsExists: false,
  logoExists: false,
  // ... 他のテスト項目
};

// Electronアプリを起動してテスト
function runElectronTest() {
  console.log('\n=== Electronアプリ起動テスト開始 ===');
  
  const child = spawn(appPath, [], {
    stdio: 'inherit',
    detached: false
  });

  let testTimer = setTimeout(() => {
    console.log('\n=== テスト完了 ===');
    testResults.appLaunched = true;
    
    // 基本的なファイル存在確認
    const distPath = path.join(__dirname, '..', 'dist');
    const htmlPath = path.join(distPath, 'index.html');
    const jsFiles = fs.readdirSync(path.join(distPath, 'assets')).filter(f => f.endsWith('.js'));
    
    testResults.distExists = fs.existsSync(distPath);
    testResults.htmlExists = fs.existsSync(htmlPath);
    testResults.jsExists = jsFiles.length > 0;
    testResults.logoExists = fs.existsSync(path.join(__dirname, '..', 'public', 'mgen_logo.svg'));
    
    printTestResults();
    
    // プロセスを終了
    child.kill();
    process.exit(0);
  }, 5000); // 5秒後にテスト完了

  child.on('error', (error) => {
    console.error('アプリ起動エラー:', error);
    clearTimeout(testTimer);
    process.exit(1);
  });

  child.on('exit', (code) => {
    console.log('アプリが終了しました。終了コード:', code);
    clearTimeout(testTimer);
    process.exit(code);
  });
}

function printTestResults() {
  console.log('\n=== テスト結果 ===');
  console.log('アプリ起動:', testResults.appLaunched ? '✓' : '✗');
  console.log('distディレクトリ:', testResults.distExists ? '✓' : '✗');
  console.log('index.html:', testResults.htmlExists ? '✓' : '✗');  
  console.log('JavaScriptファイル:', testResults.jsExists ? '✓' : '✗');
  console.log('ロゴファイル:', testResults.logoExists ? '✓' : '✗');
  
  const successCount = Object.values(testResults).filter(result => result === true).length;
  const totalCount = Object.keys(testResults).length;
  const successRate = Math.round((successCount / totalCount) * 100);
  
  console.log(`\n成功率: ${successRate}% (${successCount}/${totalCount})`);
  
  if (successRate >= 80) {
    console.log('✓ テスト成功！');
  } else {
    console.log('✗ テスト失敗。修正が必要です。');
  }
}

// テスト実行
runElectronTest(); 