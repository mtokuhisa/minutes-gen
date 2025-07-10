/**
 * 包括的なEXEテストスクリプト
 * 画像表示、ページ遷移、基本機能を確認
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// EXEモードを強制的に有効化
process.env.NODE_ENV = 'production';
app.isPackaged = true;

console.log('=== 包括的EXEテスト開始 ===');
console.log('Platform:', process.platform);
console.log('Packaged:', app.isPackaged);
console.log('Environment:', process.env.NODE_ENV);

let testResults = {
  distExists: false,
  indexExists: false,
  logoExists: false,
  overviewExists: false,
  technicalExists: false,
  pageLoaded: false,
  logoDisplayed: false,
  linksWorking: false,
  jsErrors: [],
  consoleMessages: []
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // テスト用
    },
    show: false, // 最初は非表示
  });

  // ファイル存在確認
  const distPath = path.join(__dirname, '..', 'dist');
  const indexPath = path.join(distPath, 'index.html');
  const logoPath = path.join(distPath, 'mgen_logo.svg');
  const overviewPath = path.join(__dirname, '..', 'overview.html');
  const technicalPath = path.join(__dirname, '..', 'technical.html');

  testResults.distExists = fs.existsSync(distPath);
  testResults.indexExists = fs.existsSync(indexPath);
  testResults.logoExists = fs.existsSync(logoPath);
  testResults.overviewExists = fs.existsSync(overviewPath);
  testResults.technicalExists = fs.existsSync(technicalPath);

  console.log('=== ファイル存在確認 ===');
  console.log('Dist folder:', testResults.distExists ? '✓' : '✗');
  console.log('Index.html:', testResults.indexExists ? '✓' : '✗');
  console.log('Logo file:', testResults.logoExists ? '✓' : '✗');
  console.log('Overview.html:', testResults.overviewExists ? '✓' : '✗');
  console.log('Technical.html:', testResults.technicalExists ? '✓' : '✗');

  if (!testResults.indexExists) {
    console.error('✗ Production build not found. Run "npm run build" first.');
    app.quit();
    return;
  }

  console.log('=== ページ読み込み開始 ===');
  win.loadFile(indexPath);

  // ページ読み込み完了時
  win.webContents.on('did-finish-load', () => {
    console.log('✓ ページ読み込み完了');
    testResults.pageLoaded = true;
    
    // React アプリケーションの読み込み完了を待つ
    waitForReactApp(win);
  });

  // 読み込み失敗時
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('✗ ページ読み込み失敗:', errorCode, errorDescription);
    printTestResults();
    app.quit();
  });

  // コンソールメッセージ監視
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const logMessage = `[${level}] ${message}`;
    testResults.consoleMessages.push(logMessage);
    
    if (level === 3) { // ERROR
      testResults.jsErrors.push(logMessage);
      console.error('JS Error:', logMessage);
    } else if (level === 1) { // INFO
      console.log('Console:', logMessage);
    }
  });

  // ウィンドウを表示
  win.show();
  
  // 開発者ツールを開く
  win.webContents.openDevTools();

  return win;
}

function waitForReactApp(win) {
  console.log('=== React アプリケーション読み込み待機 ===');
  
  let attempts = 0;
  const maxAttempts = 20; // 10秒間待機
  
  const checkReactApp = () => {
    attempts++;
    
    win.webContents.executeJavaScript(`
      // React アプリケーションが読み込まれているかチェック
      const rootElement = document.getElementById('root');
      const hasReactContent = rootElement && rootElement.children.length > 0;
      const hasLoading = rootElement && rootElement.querySelector('.loading');
      
      const result = {
        hasRoot: !!rootElement,
        hasContent: hasReactContent,
        hasLoading: hasLoading,
        isReady: hasReactContent && !hasLoading
      };
      
      console.log('React app check:', result);
      result;
    `).then(result => {
      if (result.isReady) {
        console.log('✓ React アプリケーション読み込み完了');
        // さらに2秒待ってからテスト実行
        setTimeout(() => {
          runTests(win);
        }, 2000);
      } else if (attempts < maxAttempts) {
        console.log(`React アプリケーション読み込み中... (${attempts}/${maxAttempts})`);
        setTimeout(checkReactApp, 500);
      } else {
        console.log('⚠️ React アプリケーション読み込みタイムアウト');
        runTests(win);
      }
    }).catch(error => {
      console.error('React アプリケーションチェックエラー:', error);
      runTests(win);
    });
  };
  
  checkReactApp();
}

function runTests(win) {
  console.log('=== テスト実行開始 ===');
  
  // 1. ロゴ画像表示テスト
  win.webContents.executeJavaScript(`
    const logoImg = document.querySelector('img[alt="MinutesGen Logo"]');
    if (logoImg) {
      const rect = logoImg.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && logoImg.complete;
      console.log('Logo test:', {
        src: logoImg.src,
        width: rect.width,
        height: rect.height,
        complete: logoImg.complete,
        visible: isVisible,
        naturalWidth: logoImg.naturalWidth,
        naturalHeight: logoImg.naturalHeight
      });
      isVisible;
    } else {
      console.log('Logo not found');
      false;
    }
  `).then(result => {
    testResults.logoDisplayed = result;
    console.log('ロゴ表示テスト:', result ? '✓' : '✗');
    
    // 2. ページ遷移テスト
    return testPageNavigation(win);
  }).catch(error => {
    console.error('テスト実行エラー:', error);
    testResults.jsErrors.push(error.message);
    printTestResults();
    app.quit();
  });
}

function testPageNavigation(win) {
  console.log('=== ページ遷移テスト ===');
  
  // フッターのリンクボタンをテスト
  return win.webContents.executeJavaScript(`
    const overviewBtn = document.querySelector('button[onclick*="overview.html"]');
    const technicalBtn = document.querySelector('button[onclick*="technical.html"]');
    
    // より詳細な検索
    const allButtons = document.querySelectorAll('button');
    const overviewBtnAlt = Array.from(allButtons).find(btn => 
      btn.textContent.includes('概要') || btn.textContent.includes('使い方')
    );
    const technicalBtnAlt = Array.from(allButtons).find(btn => 
      btn.textContent.includes('技術') || btn.textContent.includes('更新')
    );
    
    const result = {
      overviewBtn: !!overviewBtn,
      technicalBtn: !!technicalBtn,
      overviewBtnAlt: !!overviewBtnAlt,
      technicalBtnAlt: !!technicalBtnAlt,
      overviewText: overviewBtn ? overviewBtn.textContent : (overviewBtnAlt ? overviewBtnAlt.textContent : null),
      technicalText: technicalBtn ? technicalBtn.textContent : (technicalBtnAlt ? technicalBtnAlt.textContent : null),
      totalButtons: allButtons.length
    };
    
    console.log('Navigation buttons:', result);
    result;
  `).then(result => {
    testResults.linksWorking = (result.overviewBtn || result.overviewBtnAlt) && (result.technicalBtn || result.technicalBtnAlt);
    console.log('ナビゲーションボタン:', testResults.linksWorking ? '✓' : '✗');
    
    // 3秒後にテスト結果を表示
    setTimeout(() => {
      printTestResults();
      
      // 10秒後に自動終了
      setTimeout(() => {
        console.log('=== テスト自動終了 ===');
        app.quit();
      }, 10000);
    }, 3000);
  });
}

function printTestResults() {
  console.log('\n=== テスト結果レポート ===');
  console.log('ファイル存在確認:');
  console.log('  - dist フォルダ:', testResults.distExists ? '✓' : '✗');
  console.log('  - index.html:', testResults.indexExists ? '✓' : '✗');
  console.log('  - ロゴファイル:', testResults.logoExists ? '✓' : '✗');
  console.log('  - overview.html:', testResults.overviewExists ? '✓' : '✗');
  console.log('  - technical.html:', testResults.technicalExists ? '✓' : '✗');
  
  console.log('\n機能テスト:');
  console.log('  - ページ読み込み:', testResults.pageLoaded ? '✓' : '✗');
  console.log('  - ロゴ表示:', testResults.logoDisplayed ? '✓' : '✗');
  console.log('  - ナビゲーションボタン:', testResults.linksWorking ? '✓' : '✗');
  
  console.log('\nエラー情報:');
  console.log('  - JSエラー数:', testResults.jsErrors.length);
  if (testResults.jsErrors.length > 0) {
    testResults.jsErrors.forEach(error => {
      console.log('    -', error);
    });
  }
  
  console.log('\nコンソールメッセージ数:', testResults.consoleMessages.length);
  
  // 総合評価
  const totalTests = 8;
  const passedTests = [
    testResults.distExists,
    testResults.indexExists,
    testResults.logoExists,
    testResults.overviewExists,
    testResults.technicalExists,
    testResults.pageLoaded,
    testResults.logoDisplayed,
    testResults.linksWorking
  ].filter(Boolean).length;
  
  console.log(`\n総合評価: ${passedTests}/${totalTests} テスト通過`);
  console.log('成功率:', Math.round((passedTests / totalTests) * 100) + '%');
  
  if (passedTests === totalTests && testResults.jsErrors.length === 0) {
    console.log('🎉 すべてのテストが成功しました！');
  } else if (passedTests >= 6) {
    console.log('✅ 主要なテストが成功しました！');
  } else {
    console.log('⚠️  一部のテストが失敗しました。');
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
}); 