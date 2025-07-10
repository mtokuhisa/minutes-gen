# MinutesGen 自己署名証明書作成スクリプト
# 管理者権限で実行してください

param(
    [string]$CertName = "DENTSU PROMOTION EXE INC. - MinutesGen Code Signing",
    [string]$CompanyName = "DENTSU PROMOTION EXE INC.",
    [int]$ValidityYears = 3,
    [string]$Password = "MinutesGen2025!DPE"
)

Write-Host "=== MinutesGen 自己署名証明書作成 ===" -ForegroundColor Green
Write-Host "会社名: $CompanyName" -ForegroundColor Cyan
Write-Host "有効期間: $ValidityYears 年" -ForegroundColor Cyan
Write-Host "証明書名: $CertName" -ForegroundColor Cyan
Write-Host ""

# 管理者権限チェック
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ エラー: 管理者権限で実行してください" -ForegroundColor Red
    Write-Host "PowerShellを右クリック → '管理者として実行' を選択してください" -ForegroundColor Yellow
    exit 1
}

try {
    # 証明書の作成
    Write-Host "🔧 証明書を作成中..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -Subject "CN=$CertName, O=$CompanyName" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
        -KeyExportPolicy Exportable `
        -KeyUsage DigitalSignature `
        -Type CodeSigningCert `
        -NotAfter (Get-Date).AddYears($ValidityYears)

    Write-Host "✅ 証明書が作成されました: $($cert.Thumbprint)" -ForegroundColor Green

    # 証明書を信頼されたルート証明機関にインポート
    Write-Host "🔧 証明書を信頼されたルート証明機関に追加中..." -ForegroundColor Yellow
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $store.Open("ReadWrite")
    $store.Add($cert)
    $store.Close()

    Write-Host "✅ 証明書が信頼されたルート証明機関に追加されました" -ForegroundColor Green

    # 証明書をファイルにエクスポート
    $certPath = ".\MinutesGen-CodeSigning.p12"
    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText

    Write-Host "🔧 証明書をファイルにエクスポート中..." -ForegroundColor Yellow
    Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $securePassword | Out-Null

    Write-Host "✅ 証明書がエクスポートされました: $certPath" -ForegroundColor Green
    Write-Host "🔑 パスワード: $Password" -ForegroundColor Yellow

    # 証明書情報を表示
    Write-Host "`n=== 証明書情報 ===" -ForegroundColor Cyan
    Write-Host "Subject: $($cert.Subject)"
    Write-Host "Issuer: $($cert.Issuer)"
    Write-Host "Thumbprint: $($cert.Thumbprint)"
    Write-Host "Valid From: $($cert.NotBefore)"
    Write-Host "Valid To: $($cert.NotAfter)"

    # package.json設定例を表示
    Write-Host "`n=== package.json 設定例 ===" -ForegroundColor Cyan
    Write-Host '"win": {' -ForegroundColor Gray
    Write-Host '  "certificateFile": "MinutesGen-CodeSigning.p12",' -ForegroundColor Gray
    Write-Host "  `"certificatePassword`": `"$Password`"," -ForegroundColor Gray
    Write-Host '  "publisherName": "DENTSU PROMOTION EXE INC.",' -ForegroundColor Gray
    Write-Host '  // ... 他の設定' -ForegroundColor Gray
    Write-Host '}' -ForegroundColor Gray

    # 次のステップを表示
    Write-Host "`n=== 次のステップ ===" -ForegroundColor Yellow
    Write-Host "1. 📝 package.json の build.win に証明書設定を追加"
    Write-Host "2. 🔨 npm run dist:signed でビルド実行"
    Write-Host "3. 📦 社内PCに証明書を配布・インストール"
    Write-Host "4. 🧪 SmartScreen警告の改善を確認"

    # 社内配布用の証明書作成
    Write-Host "`n=== 社内配布用証明書 ===" -ForegroundColor Cyan
    $publicCertPath = ".\MinutesGen-PublicKey.cer"
    Export-Certificate -Cert $cert -FilePath $publicCertPath | Out-Null
    Write-Host "✅ 公開鍵証明書: $publicCertPath"
    Write-Host "   → 社内PCの '信頼されたルート証明機関' にインストール"

    Write-Host "`n🎉 証明書作成が完了しました！" -ForegroundColor Green

} catch {
    Write-Host "❌ エラーが発生しました: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "詳細: $($_.Exception.StackTrace)" -ForegroundColor Red
    exit 1
} 