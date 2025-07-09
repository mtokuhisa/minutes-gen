# MinutesGen 社内配布支援スクリプト
# IT部門向け - 管理者権限で実行

param(
    [string]$SharePath = "\\fileserver\software\MinutesGen",
    [string]$GroupPolicyPath = "\\domain\SYSVOL\domain\Policies\{GUID}\Machine\Scripts",
    [switch]$InstallCertificate,
    [switch]$CreateGPO,
    [switch]$DeployToShare
)

Write-Host "MinutesGen 社内配布を開始します..." -ForegroundColor Green

# 1. 共有フォルダへの配布
if ($DeployToShare) {
    Write-Host "共有フォルダへの配布を実行中..." -ForegroundColor Yellow
    
    if (!(Test-Path $SharePath)) {
        New-Item -ItemType Directory -Path $SharePath -Force
        Write-Host "共有フォルダを作成しました: $SharePath" -ForegroundColor Green
    }
    
    # ファイルをコピー
    Copy-Item -Path "dist-electron\win-unpacked\*" -Destination $SharePath -Recurse -Force
    
    # 実行権限を設定
    $acl = Get-Acl $SharePath
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("Domain Users", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $SharePath -AclObject $acl
    
    Write-Host "共有フォルダへの配布が完了しました" -ForegroundColor Green
}

# 2. 証明書の配布
if ($InstallCertificate) {
    Write-Host "証明書の配布を実行中..." -ForegroundColor Yellow
    
    $certPath = "MinutesGen-CodeSigning.p12"
    if (Test-Path $certPath) {
        # 証明書をドメイン内の全PCに配布するスクリプト
        $deployScript = @"
# 証明書インストールスクリプト
`$certPath = '$SharePath\MinutesGen-CodeSigning.p12'
`$password = ConvertTo-SecureString -String 'MinutesGen2025' -Force -AsPlainText
Import-PfxCertificate -FilePath `$certPath -CertStoreLocation Cert:\LocalMachine\Root -Password `$password
Write-Host 'MinutesGen証明書がインストールされました'
"@
        
        $deployScript | Out-File -FilePath "$SharePath\install-certificate.ps1" -Encoding UTF8
        Write-Host "証明書配布スクリプトを作成しました" -ForegroundColor Green
    }
}

# 3. グループポリシーの設定
if ($CreateGPO) {
    Write-Host "グループポリシー設定を作成中..." -ForegroundColor Yellow
    
    $gpoScript = @"
# MinutesGen 実行許可設定
# Software Restriction Policies または AppLocker で以下を設定:
# 1. $SharePath\MinutesGen.exe を信頼できるアプリケーションとして追加
# 2. 証明書ベースの信頼設定を有効化
# 3. ユーザーグループ 'MinutesGen Users' に実行権限を付与

# レジストリ設定例
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Safer\CodeIdentifiers' -Name 'DefaultLevel' -Value 0x00040000
New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Safer\CodeIdentifiers\0\Paths\{GUID}' -Name 'ItemData' -Value '$SharePath\MinutesGen.exe'
New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Safer\CodeIdentifiers\0\Paths\{GUID}' -Name 'SaferFlags' -Value 0x00000000
"@
    
    $gpoScript | Out-File -FilePath "$SharePath\gpo-settings.ps1" -Encoding UTF8
    Write-Host "グループポリシー設定スクリプトを作成しました" -ForegroundColor Green
}

# 4. ユーザー向けショートカット作成
$shortcutScript = @"
# デスクトップショートカット作成スクリプト
`$WshShell = New-Object -comObject WScript.Shell
`$Shortcut = `$WshShell.CreateShortcut("`$Home\Desktop\MinutesGen.lnk")
`$Shortcut.TargetPath = '$SharePath\MinutesGen.exe'
`$Shortcut.WorkingDirectory = '$SharePath'
`$Shortcut.IconLocation = '$SharePath\MinutesGen.exe'
`$Shortcut.Description = 'MinutesGen v0.7.1 - AI議事録生成ツール'
`$Shortcut.Save()
Write-Host 'デスクトップにMinutesGenショートカットを作成しました'
"@

$shortcutScript | Out-File -FilePath "$SharePath\create-shortcut.ps1" -Encoding UTF8

# 5. 配布完了レポート
Write-Host "`n=== 配布完了レポート ===" -ForegroundColor Cyan
Write-Host "配布先: $SharePath" -ForegroundColor White
Write-Host "証明書: $(if($InstallCertificate){'配布済み'}else{'未配布'})" -ForegroundColor White
Write-Host "GPO設定: $(if($CreateGPO){'作成済み'}else{'未作成'})" -ForegroundColor White
Write-Host "共有フォルダ: $(if($DeployToShare){'配布済み'}else{'未配布'})" -ForegroundColor White

Write-Host "`n=== 次のステップ ===" -ForegroundColor Yellow
Write-Host "1. Active Directory でユーザーグループ 'MinutesGen Users' を作成"
Write-Host "2. グループポリシーでスクリプト実行を許可"
Write-Host "3. 証明書配布スクリプトをログオンスクリプトに追加"
Write-Host "4. ユーザーに利用方法を周知"

Write-Host "`n=== ユーザー向け実行コマンド ===" -ForegroundColor Green
Write-Host "powershell -ExecutionPolicy Bypass -File `"$SharePath\install-certificate.ps1`""
Write-Host "powershell -ExecutionPolicy Bypass -File `"$SharePath\create-shortcut.ps1`"" 