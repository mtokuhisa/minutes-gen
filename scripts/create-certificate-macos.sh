#!/bin/bash

# MinutesGen macOS用 自己署名証明書作成スクリプト
# Windows用のP12証明書を生成します

set -e

# 設定
COMPANY_NAME="DENTSU PROMOTION EXE INC."
CERT_NAME="DENTSU PROMOTION EXE INC. - MinutesGen Code Signing"
VALIDITY_DAYS=1095  # 3年
PASSWORD="MinutesGen2025!DPE"
CERT_FILE="MinutesGen-CodeSigning"

echo "=== MinutesGen 自己署名証明書作成 (macOS) ==="
echo "会社名: $COMPANY_NAME"
echo "有効期間: $((VALIDITY_DAYS/365)) 年"
echo "証明書名: $CERT_NAME"
echo ""

# OpenSSLがインストールされているか確認
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSLがインストールされていません"
    echo "インストール: brew install openssl"
    exit 1
fi

echo "🔧 秘密鍵を生成中..."
openssl genrsa -aes256 -passout pass:$PASSWORD -out "${CERT_FILE}.key" 2048

echo "🔧 証明書署名要求(CSR)を生成中..."
openssl req -new -key "${CERT_FILE}.key" -out "${CERT_FILE}.csr" -passin pass:$PASSWORD -subj "/CN=$CERT_NAME/O=$COMPANY_NAME/C=JP"

echo "🔧 自己署名証明書を生成中..."
openssl x509 -req -in "${CERT_FILE}.csr" -signkey "${CERT_FILE}.key" -out "${CERT_FILE}.crt" -days $VALIDITY_DAYS -passin pass:$PASSWORD

echo "🔧 PKCS#12形式(P12)に変換中..."
openssl pkcs12 -export -out "${CERT_FILE}.p12" -inkey "${CERT_FILE}.key" -in "${CERT_FILE}.crt" -passin pass:$PASSWORD -passout pass:$PASSWORD

echo "🔧 公開鍵証明書(CER)を生成中..."
openssl x509 -outform DER -in "${CERT_FILE}.crt" -out "MinutesGen-PublicKey.cer"

# 証明書情報を表示
echo ""
echo "=== 証明書情報 ==="
openssl x509 -in "${CERT_FILE}.crt" -text -noout | grep -A 5 "Subject:\|Issuer:\|Validity"

echo ""
echo "=== 生成されたファイル ==="
echo "✅ ${CERT_FILE}.p12 - Windows用署名証明書"
echo "✅ MinutesGen-PublicKey.cer - 社内配布用公開鍵"
echo "🔑 パスワード: $PASSWORD"

echo ""
echo "=== package.json 設定例 ==="
echo '"win": {'
echo '  "certificateFile": "MinutesGen-CodeSigning.p12",'
echo "  \"certificatePassword\": \"$PASSWORD\","
echo '  "publisherName": "DENTSU PROMOTION EXE INC.",'
echo '  // ... 他の設定'
echo '}'

echo ""
echo "=== 次のステップ ==="
echo "1. 📝 package.json の build.win に証明書設定を追加"
echo "2. 🔨 npm run dist:signed でビルド実行"
echo "3. 📦 社内PCに MinutesGen-PublicKey.cer を配布・インストール"
echo "4. 🧪 SmartScreen警告の改善を確認"

echo ""
echo "🎉 証明書作成が完了しました！"

# 一時ファイルを削除
rm -f "${CERT_FILE}.csr" "${CERT_FILE}.key" "${CERT_FILE}.crt"

echo ""
echo "🗑️ 一時ファイルを削除しました" 