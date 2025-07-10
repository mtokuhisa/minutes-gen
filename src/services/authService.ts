// ===========================================
// MinutesGen v1.0 - 認証サービス（ハイブリッド方式）
// ===========================================

import CryptoJS from 'crypto-js';

// 暗号化されたAPI KEY（ビルド時に設定）
const ENCRYPTED_CORPORATE_API_KEY = "U2FsdGVkX18WMitVxBZ+HEPIM4KLStpcJEfCTJ3pJygPe4FhPgtB+9HpURyNyYAUK1CabYbMD037QjdRv3CCKEkTEy47Z6FGTBK64HrOcb7gbM6nJ8AysW/zyjSfy2YCb7zG02YQvKk1up7eN42U9w58jsx9e0KN3EMQUZrJum12OBAlHvu668sZ781gmAUvS0upJ7X1UVEwCoi+pMz9FIv5MkfTekt3eUGtHuvMZ6whsHGB1vWRz1Ljlw0aqr/l";

// パスワード（本番では環境変数から取得）
const CORPORATE_PASSWORD = "Negsetunum";

export interface AuthState {
  isAuthenticated: boolean;
  authMethod: 'corporate' | 'personal' | null;
  apiKey: string | null;
}

export interface AuthResult {
  success: boolean;
  message: string;
  authState?: AuthState;
}

export class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    authMethod: null,
    apiKey: null,
  };

  private constructor() {
    this.loadAuthState();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 認証状態をローカルストレージから読み込み
   */
  private loadAuthState(): void {
    try {
      const savedAuthState = localStorage.getItem('minutesgen_auth_state');
      if (savedAuthState) {
        const parsed = JSON.parse(savedAuthState);
        if (parsed.isAuthenticated) {
          this.authState = {
            isAuthenticated: true,
            authMethod: parsed.authMethod,
            apiKey: null, // セキュリティのため、API KEYは毎回復号
          };
        }
      }
    } catch (error) {
      console.warn('認証状態の読み込みに失敗:', error);
      this.clearAuthState();
    }
  }

  /**
   * 認証状態をローカルストレージに保存
   */
  private saveAuthState(): void {
    try {
      const stateToSave = {
        isAuthenticated: this.authState.isAuthenticated,
        authMethod: this.authState.authMethod,
        // API KEYは保存しない（セキュリティ）
      };
      localStorage.setItem('minutesgen_auth_state', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('認証状態の保存に失敗:', error);
    }
  }

  /**
   * 認証状態をクリア
   */
  private clearAuthState(): void {
    this.authState = {
      isAuthenticated: false,
      authMethod: null,
      apiKey: null,
    };
    localStorage.removeItem('minutesgen_auth_state');
    localStorage.removeItem('minutesgen_personal_api_key');
  }

  /**
   * 企業パスワードで認証
   */
  public authenticateWithPassword(password: string): AuthResult {
    try {
      if (password !== CORPORATE_PASSWORD) {
        return {
          success: false,
          message: 'パスワードが正しくありません。',
        };
      }

      // 企業API KEYを復号
      const decryptedKey = this.decryptCorporateApiKey(password);
      if (!decryptedKey) {
        return {
          success: false,
          message: 'API KEYの復号に失敗しました。',
        };
      }

      this.authState = {
        isAuthenticated: true,
        authMethod: 'corporate',
        apiKey: decryptedKey,
      };

      this.saveAuthState();

      return {
        success: true,
        message: '企業アカウントで認証成功しました。',
        authState: this.authState,
      };
    } catch (error) {
      return {
        success: false,
        message: '認証中にエラーが発生しました。',
      };
    }
  }

  /**
   * 個人API KEYで認証
   */
  public authenticateWithPersonalKey(apiKey: string): AuthResult {
    try {
      if (!apiKey || !apiKey.startsWith('sk-')) {
        return {
          success: false,
          message: '有効なOpenAI APIキーを入力してください（sk-で始まる）。',
        };
      }

      // 個人API KEYを暗号化してローカルストレージに保存
      const encryptedPersonalKey = CryptoJS.AES.encrypt(apiKey, 'personal_key_salt').toString();
      localStorage.setItem('minutesgen_personal_api_key', encryptedPersonalKey);

      this.authState = {
        isAuthenticated: true,
        authMethod: 'personal',
        apiKey: apiKey,
      };

      this.saveAuthState();

      return {
        success: true,
        message: '個人アカウントで認証成功しました。',
        authState: this.authState,
      };
    } catch (error) {
      return {
        success: false,
        message: '認証中にエラーが発生しました。',
      };
    }
  }

  /**
   * 企業API KEYを復号
   */
  private decryptCorporateApiKey(password: string): string | null {
    try {
      // 本実装では、パスワードをキーとして暗号化されたAPI KEYを復号
      // 実際のビルド時には、より複雑な暗号化を行う
      const bytes = CryptoJS.AES.decrypt(ENCRYPTED_CORPORATE_API_KEY, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (decrypted && decrypted.startsWith('sk-')) {
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('API KEYの復号に失敗:', error);
      return null;
    }
  }

  /**
   * 個人API KEYを復号
   */
  private decryptPersonalApiKey(): string | null {
    try {
      const encryptedKey = localStorage.getItem('minutesgen_personal_api_key');
      if (!encryptedKey) {
        return null;
      }

      const bytes = CryptoJS.AES.decrypt(encryptedKey, 'personal_key_salt');
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (decrypted && decrypted.startsWith('sk-')) {
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('個人API KEYの復号に失敗:', error);
      return null;
    }
  }

  /**
   * 現在の認証状態を取得
   */
  public getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * 認証済みかどうかを確認
   */
  public isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * 現在のAPI KEYを取得
   */
  public async getApiKey(): Promise<string | null> {
    if (!this.authState.isAuthenticated) {
      return null;
    }

    // メモリ上にAPI KEYがある場合はそれを返す
    if (this.authState.apiKey) {
      return this.authState.apiKey;
    }

    // 認証方法に応じてAPI KEYを復号
    if (this.authState.authMethod === 'corporate') {
      const decryptedKey = this.decryptCorporateApiKey(CORPORATE_PASSWORD);
      this.authState.apiKey = decryptedKey;
      return decryptedKey;
    } else if (this.authState.authMethod === 'personal') {
      const decryptedKey = this.decryptPersonalApiKey();
      this.authState.apiKey = decryptedKey;
      return decryptedKey;
    }

    return null;
  }

  /**
   * 認証方法を取得
   */
  public getAuthMethod(): 'corporate' | 'personal' | null {
    return this.authState.authMethod;
  }

  /**
   * ログアウト
   */
  public logout(): void {
    this.clearAuthState();
  }

  /**
   * 認証をリセット（初回セットアップ画面に戻る）
   */
  public resetAuth(): void {
    this.clearAuthState();
  }

  /**
   * API KEYをメモリから削除（セキュリティ）
   */
  public clearApiKeyFromMemory(): void {
    this.authState.apiKey = null;
  }

  /**
   * 認証が必要かどうかを判定
   */
  public needsAuthentication(): boolean {
    return !this.authState.isAuthenticated;
  }
} 