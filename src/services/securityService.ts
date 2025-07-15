/**
 * セキュリティサービス
 * CSP、入力サニタイゼーション、XSS対策を提供
 */

import DOMPurify from 'isomorphic-dompurify';

// セキュリティ設定
export interface SecurityConfig {
  csp: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  sanitization: {
    enabled: boolean;
    allowedTags: string[];
    allowedAttributes: Record<string, string[]>;
  };
  validation: {
    maxInputLength: number;
    allowedFileTypes: string[];
    maxFileSize: number;
  };
}

// デフォルトセキュリティ設定
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://api.openai.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'https://api.openai.com', 'https://unpkg.com'],
      'media-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    },
  },
  sanitization: {
    enabled: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    allowedAttributes: {
      '*': ['class', 'id'],
      'a': ['href', 'target', 'rel'],
    },
  },
  validation: {
    maxInputLength: 50000,
    allowedFileTypes: [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac',
      'video/mp4', 'video/webm', 'video/quicktime',
      'text/plain', 'text/vtt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'
    ],
    maxFileSize: 25 * 1024 * 1024, // 25MB
  },
};

export class SecurityService {
  private config: SecurityConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      ...DEFAULT_SECURITY_CONFIG,
      ...config,
    };
  }

  /**
   * セキュリティサービスの初期化
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.setupCSP();
    this.setupGlobalErrorHandling();
    this.isInitialized = true;

    console.log('🔒 セキュリティサービスが初期化されました');
  }

  /**
   * CSP（Content Security Policy）を設定
   */
  setupCSP(): void {
    const cspPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://api.openai.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.openai.com https://unpkg.com",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // frame-ancestorsはmetaタグでは無効なので削除
      "upgrade-insecure-requests"
    ].join('; ');

    const metaTag = document.createElement('meta');
    metaTag.httpEquiv = 'Content-Security-Policy';
    metaTag.content = cspPolicy;
    document.head.appendChild(metaTag);

    console.log('🔒 CSP設定完了:', cspPolicy);
  }

  /**
   * グローバルエラーハンドリングの設定
   */
  private setupGlobalErrorHandling(): void {
    // CSP違反の監視
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error('🚨 CSP違反検出:', {
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
        originalPolicy: e.originalPolicy,
        disposition: e.disposition,
      });
    });
  }

  /**
   * HTML入力のサニタイゼーション
   */
  public sanitizeHTML(input: string): string {
    if (!this.config.sanitization.enabled) return input;

    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: this.config.sanitization.allowedTags,
      ALLOWED_ATTR: Object.keys(this.config.sanitization.allowedAttributes).reduce((acc, tag) => {
        if (tag === '*') {
          acc.push(...this.config.sanitization.allowedAttributes[tag]);
        }
        return acc;
      }, [] as string[]),
    });
  }

  /**
   * テキスト入力の検証とサニタイゼーション
   */
  public validateAndSanitizeText(input: string): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];
    let sanitized = input;

    // 長さチェック
    if (input.length > this.config.validation.maxInputLength) {
      errors.push(`入力が長すぎます（最大${this.config.validation.maxInputLength}文字）`);
      sanitized = input.substring(0, this.config.validation.maxInputLength);
    }

    // 危険なパターンの検出
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        errors.push(`危険なパターンが検出されました（パターン${index + 1}）`);
        sanitized = sanitized.replace(pattern, '');
      }
    });

    // HTMLエンティティのエスケープ
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * ファイルの検証
   */
  public validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ファイルサイズチェック
    if (file.size > this.config.validation.maxFileSize) {
      errors.push(`ファイルサイズが大きすぎます（最大${Math.round(this.config.validation.maxFileSize / 1024 / 1024)}MB）`);
    }

    // ファイルタイプチェック
    if (!this.config.validation.allowedFileTypes.includes(file.type)) {
      errors.push(`サポートされていないファイル形式です: ${file.type}`);
    }

    // ファイル名の検証
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileName = file.name.toLowerCase();
    if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
      errors.push('危険なファイル形式です');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * URLの検証
   */
  public validateURL(url: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const urlObj = new URL(url);
      
      // プロトコルチェック
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push('HTTPまたはHTTPSプロトコルのみ許可されています');
      }

      // ローカルIPアドレスの禁止
      const hostname = urlObj.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        errors.push('ローカルIPアドレスはアクセスできません');
      }

    } catch (e) {
      errors.push('無効なURL形式です');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * API キーの検証
   */
  public validateAPIKey(apiKey: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基本的な形式チェック
    if (!apiKey || apiKey.length < 20) {
      errors.push('APIキーが短すぎます');
    }

    // 危険なパターンの検出
    if (apiKey.includes('<') || apiKey.includes('>') || apiKey.includes('&')) {
      errors.push('APIキーに無効な文字が含まれています');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * セキュリティヘッダーを設定
   * 注意: metaタグで設定できないヘッダーは除外
   */
  setSecurityHeaders(): void {
    // X-Content-Type-Options
    const noSniffMeta = document.createElement('meta');
    noSniffMeta.httpEquiv = 'X-Content-Type-Options';
    noSniffMeta.content = 'nosniff';
    document.head.appendChild(noSniffMeta);

    // Referrer-Policy
    const referrerMeta = document.createElement('meta');
    referrerMeta.name = 'referrer';
    referrerMeta.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(referrerMeta);

    // X-Frame-OptionsとX-XSS-Protectionはmetaタグでは設定できないため除外
    // これらはサーバーサイドで設定する必要がある
    
    console.log('🔒 セキュリティヘッダー設定完了（meta対応分のみ）');
  }

  /**
   * セキュリティ設定の更新
   */
  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    console.log('🔒 セキュリティ設定が更新されました');
  }

  /**
   * セキュリティ状態の取得
   */
  public getSecurityStatus(): {
    initialized: boolean;
    cspEnabled: boolean;
    sanitizationEnabled: boolean;
    configHash: string;
  } {
    return {
      initialized: this.isInitialized,
      cspEnabled: this.config.csp.enabled,
      sanitizationEnabled: this.config.sanitization.enabled,
      configHash: this.generateConfigHash(),
    };
  }

  /**
   * 設定のハッシュ生成
   */
  private generateConfigHash(): string {
    const configString = JSON.stringify(this.config);
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString(16);
  }
}

// シングルトンインスタンス
export const securityService = new SecurityService(); 