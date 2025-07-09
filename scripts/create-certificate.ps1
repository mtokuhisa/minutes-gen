# MinutesGen 自己署名証明書作成スクリプト
# 管理者権限で実行してください

param(
    [string]$CertName = "MinutesGen Code Signing Certificate",
    [string]$CompanyName = "Your Company Name",
    [int]$ValidityYears = 3
)

Write-Host "MinutesGen 自己署名証明書を作成します..." -ForegroundColor Green

# 証明書の作成
$cert = New-SelfSignedCertificate -Subject "CN=$CertName, O=$CompanyName" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -Type CodeSigningCert `
    -NotAfter (Get-Date).AddYears($ValidityYears)

Write-Host "証明書が作成されました: $($cert.Thumbprint)" -ForegroundColor Green

# 証明書を信頼されたルート証明機関にインポート
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()

Write-Host "証明書が信頼されたルート証明機関に追加されました" -ForegroundColor Green

# 証明書をファイルにエクスポート
$certPath = ".\MinutesGen-CodeSigning.p12"
$password = ConvertTo-SecureString -String "MinutesGen2025" -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $password

Write-Host "証明書がエクスポートされました: $certPath" -ForegroundColor Green
Write-Host "パスワード: MinutesGen2025" -ForegroundColor Yellow

# 証明書情報を表示
Write-Host "`n証明書情報:" -ForegroundColor Cyan
Write-Host "Subject: $($cert.Subject)"
Write-Host "Issuer: $($cert.Issuer)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Valid From: $($cert.NotBefore)"
Write-Host "Valid To: $($cert.NotAfter)"

Write-Host "`n次のステップ:" -ForegroundColor Yellow
Write-Host "1. package.json の build.win.certificateFile を設定"
Write-Host "2. npm run dist:signed でビルド実行"
Write-Host "3. 社内PCに証明書を配布・インストール" 