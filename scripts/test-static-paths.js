/**
 * 静的ファイルパスのテストスクリプト
 * file://プロトコルでの画像読み込みをテスト
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('=== Static Path Test ===\n');

// distフォルダのパスを確認
const distPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('✗ Build not found. Run "npm run build" first.');
  process.exit(1);
}

// index.htmlを読み込み
const html = fs.readFileSync(indexPath, 'utf-8');
const dom = new JSDOM(html, {
  url: `file://${indexPath}`,
  resources: 'usable',
  runScripts: 'outside-only'
});

const document = dom.window.document;

// 画像パスをチェック
console.log('Checking image paths...\n');

// 1. 絶対パスの画像を探す
const absoluteImages = Array.from(document.querySelectorAll('img[src^="/"]'));
if (absoluteImages.length > 0) {
  console.log('⚠️  Found absolute path images:');
  absoluteImages.forEach(img => {
    console.log(`   - ${img.src}`);
  });
  console.log('   These will NOT work in file:// protocol!\n');
} else {
  console.log('✓ No absolute path images found\n');
}

// 2. 相対パスの画像を探す
const relativeImages = Array.from(document.querySelectorAll('img[src^="./"], img[src^="../"]'));
if (relativeImages.length > 0) {
  console.log('✓ Found relative path images:');
  relativeImages.forEach(img => {
    console.log(`   - ${img.src}`);
  });
  console.log('   These should work in file:// protocol\n');
}

// 3. JavaScriptファイル内の画像参照をチェック
const scriptTags = Array.from(document.querySelectorAll('script[src]'));
console.log('Checking JavaScript files for image references...\n');

scriptTags.forEach(script => {
  const scriptPath = path.join(distPath, script.getAttribute('src'));
  if (fs.existsSync(scriptPath)) {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    
    // 絶対パスの画像参照を探す
    const absoluteRefs = content.match(/["'](\/[^"']*\.(svg|png|jpg|jpeg|gif|ico))["']/g);
    if (absoluteRefs) {
      console.log(`⚠️  Found absolute paths in ${path.basename(scriptPath)}:`);
      absoluteRefs.forEach(ref => {
        console.log(`   - ${ref}`);
      });
      console.log('');
    }
  }
});

// 4. 推奨される修正方法を表示
console.log('\n=== Recommendations ===\n');
console.log('1. Change absolute paths to relative:');
console.log('   Before: <img src="/mgen_logo.svg" />');
console.log('   After:  <img src="./mgen_logo.svg" />\n');

console.log('2. Or use import statements:');
console.log('   import logo from "./assets/mgen_logo.svg";');
console.log('   <img src={logo} />\n');

console.log('3. Test with: npm run test:exe-mode');

// クリーンアップ
dom.window.close(); 