#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 設定
const config = {
  certName: "DENTSU PROMOTION EXE INC. - MinutesGen Code Signing",
  companyName: "DENTSU PROMOTION EXE INC.",
  validityYears: 3,
  password: "MinutesGen2025!DPE"
};

console.log('=== MinutesGen 証明書作成 ===');
console.log(`会社名: ${config.companyName}`);
console.log(`有効期間: ${config.validityYears} 年`);
console.log(`証明書名: ${config.certName}`);
console.log('');

async function createCertificate() {
  try {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows用証明書作成
      await createWindowsCertificate();
    } else if (platform === 'darwin') {
      // macOS用証明書作成
      await createMacOSCertificate();
    } else {
      // Linux用証明書作成
      await createLinuxCertificate();
    }
    
    console.log('🎉 証明書作成が完了しました！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

async function createWindowsCertificate() {
  console.log('🔧 Windows用証明書を作成中...');
  console.log('⚠️  Windows環境では管理者権限で以下のコマンドを実行してください：');
  
  const psCommand = `
$cert = New-SelfSignedCertificate -Subject "CN=${config.certName}, O=${config.companyName}" -CertStoreLocation "Cert:\\CurrentUser\\My" -KeyAlgorithm RSA -KeyLength 2048 -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" -KeyExportPolicy Exportable -KeyUsage DigitalSignature -Type CodeSigningCert -NotAfter (Get-Date).AddYears(${config.validityYears})
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
$securePassword = ConvertTo-SecureString -String "${config.password}" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ".\\MinutesGen-CodeSigning.p12" -Password $securePassword
Export-Certificate -Cert $cert -FilePath ".\\MinutesGen-PublicKey.cer"
Write-Host "証明書が作成されました: $($cert.Thumbprint)"
  `.trim();
  
  console.log('powershell -ExecutionPolicy Bypass -Command "' + psCommand + '"');
  console.log('⚠️  上記コマンドをWindows PowerShellで実行してください');
  console.log('✅ Windows用証明書作成手順を表示しました');
}

async function createMacOSCertificate() {
  console.log('🔧 macOS用証明書を作成中...');
  
  // opensslを使用した証明書作成
  const keyPath = 'MinutesGen-CodeSigning.key';
  const csrPath = 'MinutesGen-CodeSigning.csr';
  const certPath = 'MinutesGen-CodeSigning.crt';
  const p12Path = 'MinutesGen-CodeSigning.p12';
  
  try {
    // 1. 秘密鍵の作成
    await execAsync(`openssl genrsa -out ${keyPath} 2048`);
    console.log('✅ 秘密鍵を作成しました');
    
    // 2. CSR（証明書署名要求）の作成
    const subject = `/CN=${config.certName}/O=${config.companyName}/C=JP`;
    await execAsync(`openssl req -new -key ${keyPath} -out ${csrPath} -subj "${subject}"`);
    console.log('✅ CSRを作成しました');
    
    // 3. 自己署名証明書の作成
    const days = config.validityYears * 365;
    await execAsync(`openssl x509 -req -days ${days} -in ${csrPath} -signkey ${keyPath} -out ${certPath}`);
    console.log('✅ 自己署名証明書を作成しました');
    
    // 4. PKCS#12形式でエクスポート
    await execAsync(`openssl pkcs12 -export -out ${p12Path} -inkey ${keyPath} -in ${certPath} -password pass:${config.password}`);
    console.log('✅ PKCS#12証明書を作成しました');
    
    // 5. 一時ファイルの削除
    [keyPath, csrPath, certPath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
    console.log('✅ macOS用証明書が作成されました');
    
  } catch (error) {
    console.error('❌ 証明書作成エラー:', error.message);
    console.log('📝 OpenSSLがインストールされていることを確認してください');
    console.log('   インストール: brew install openssl');
    throw error;
  }
}

async function createLinuxCertificate() {
  console.log('🔧 Linux用証明書を作成中...');
  
  // LinuxもmacOSと同様にOpenSSLを使用
  await createMacOSCertificate();
}

// 使用方法の表示
function showUsage() {
  console.log('\n=== 証明書情報 ===');
  console.log('ファイル: MinutesGen-CodeSigning.p12');
  console.log(`パスワード: ${config.password}`);
  
  console.log('\n=== package.json 設定例 ===');
  console.log('"win": {');
  console.log('  "certificateFile": "MinutesGen-CodeSigning.p12",');
  console.log(`  "certificatePassword": "${config.password}",`);
  console.log('  "publisherName": "DENTSU PROMOTION EXE INC.",');
  console.log('  // ... 他の設定');
  console.log('}');
  
  console.log('\n=== 次のステップ ===');
  console.log('1. 📝 package.json の build.win に証明書設定を追加');
  console.log('2. 🔨 npm run dist:signed でビルド実行');
  console.log('3. 📦 社内PCに証明書を配布・インストール');
  console.log('4. 🧪 SmartScreen警告の改善を確認');
}

// メイン実行
if (require.main === module) {
  createCertificate()
    .then(() => {
      showUsage();
    })
    .catch(console.error);
}

module.exports = { createCertificate }; 