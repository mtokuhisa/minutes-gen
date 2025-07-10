#!/usr/bin/env node

// ===========================================
// MinutesGen v1.0 - API KEY暗号化スクリプト
// ===========================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  password: process.env.CORPORATE_PASSWORD || 'Negsetunum',
  apiKey: process.env.CORPORATE_API_KEY || '',
  outputFile: 'src/services/authService.ts',
};

/**
 * API KEYを暗号化
 */
function encryptApiKey(apiKey, password) {
  // CryptoJS を使用して AES 暗号化 (CBC, 256bit)
  // authService.ts 側と同じ実装 (CryptoJS.AES.decrypt) で復号可能な形式を生成
  // パスワード文字列をそのままキーとして使用するシンプルな方式
  const CryptoJS = require('crypto-js');
  const encrypted = CryptoJS.AES.encrypt(apiKey, password).toString();
  return encrypted;
}

/**
 * authService.tsファイルを更新
 */
function updateAuthServiceFile(encryptedApiKey) {
  const authServicePath = path.join(__dirname, '..', CONFIG.outputFile);
  
  if (!fs.existsSync(authServicePath)) {
    console.error('❌ authService.tsファイルが見つかりません:', authServicePath);
    process.exit(1);
  }
  
  let content = fs.readFileSync(authServicePath, 'utf8');
  
  // 暗号化されたAPI KEYを置換
  const oldPattern = /const ENCRYPTED_CORPORATE_API_KEY = "[^"]*";/;
  const newLine = `const ENCRYPTED_CORPORATE_API_KEY = "${encryptedApiKey}";`;
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newLine);
  } else {
    console.error('❌ ENCRYPTED_CORPORATE_API_KEY定数が見つかりません');
    process.exit(1);
  }
  
  // パスワードも更新（必要に応じて）
  const passwordPattern = /const CORPORATE_PASSWORD = "[^"]*";/;
  const newPasswordLine = `const CORPORATE_PASSWORD = "${CONFIG.password}";`;
  
  if (passwordPattern.test(content)) {
    content = content.replace(passwordPattern, newPasswordLine);
  }
  
  fs.writeFileSync(authServicePath, content);
  console.log('✅ authService.tsファイルを更新しました');
}

/**
 * メイン処理
 */
function main() {
  console.log('🔐 MinutesGen v1.0 - API KEY暗号化スクリプト');
  console.log('=====================================');
  
  // API KEYの検証
  if (!CONFIG.apiKey) {
    console.error('❌ CORPORATE_API_KEYが設定されていません');
    console.log('');
    console.log('使用方法:');
    console.log('  CORPORATE_API_KEY=sk-xxx... npm run encrypt-api-key');
    console.log('  または');
    console.log('  CORPORATE_API_KEY=sk-xxx... CORPORATE_PASSWORD=MyPassword npm run encrypt-api-key');
    process.exit(1);
  }
  
  if (!CONFIG.apiKey.startsWith('sk-')) {
    console.error('❌ 無効なAPI KEY形式です（sk-で始まる必要があります）');
    process.exit(1);
  }
  
  console.log('📝 設定情報:');
  console.log(`  - API KEY: ${CONFIG.apiKey.substring(0, 10)}...`);
  console.log(`  - パスワード: ${CONFIG.password}`);
  console.log('');
  
  try {
    // API KEYを暗号化
    console.log('🔒 API KEYを暗号化中...');
    const encryptedApiKey = encryptApiKey(CONFIG.apiKey, CONFIG.password);
    console.log('✅ 暗号化完了');
    
    // authService.tsファイルを更新
    console.log('📝 authService.tsファイルを更新中...');
    updateAuthServiceFile(encryptedApiKey);
    
    console.log('');
    console.log('🎉 API KEY暗号化が完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('  1. npm run build でアプリケーションをビルド');
    console.log('  2. npm run electron:build でexeファイルを生成');
    console.log('  3. パスワード「' + CONFIG.password + '」を別途ユーザーに伝達');
    
  } catch (error) {
    console.error('❌ 暗号化処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみメイン処理を実行
if (require.main === module) {
  main();
}

module.exports = {
  encryptApiKey,
  updateAuthServiceFile,
}; 