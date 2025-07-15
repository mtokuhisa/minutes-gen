/**
 * アクセシビリティサービス
 * WCAG 2.1 AA準拠、キーボードナビゲーション、スクリーンリーダー対応
 */

// アクセシビリティ設定
export interface AccessibilityConfig {
  keyboardNavigation: boolean;
  screenReader: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  focusManagement: boolean;
  announcements: boolean;
}

// フォーカス管理
export interface FocusableElement {
  element: HTMLElement;
  tabIndex: number;
  role?: string;
  ariaLabel?: string;
}

// アナウンス優先度
export type AnnouncementPriority = 'polite' | 'assertive' | 'off';

// アクセシビリティ違反
export interface AccessibilityViolation {
  element: HTMLElement;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

export class AccessibilityService {
  private config: AccessibilityConfig;
  private focusableElements: FocusableElement[] = [];
  private currentFocusIndex: number = -1;
  private announcer: HTMLElement | null = null;
  private isInitialized: boolean = false;

  constructor(config?: Partial<AccessibilityConfig>) {
    this.config = {
      keyboardNavigation: true,
      screenReader: true,
      highContrast: false,
      reducedMotion: false,
      focusManagement: true,
      announcements: true,
      ...config,
    };
  }

  /**
   * アクセシビリティサービスの初期化
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.setupScreenReaderSupport();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
    this.setupUserPreferences();
    this.isInitialized = true;

    console.log('♿ アクセシビリティサービスが初期化されました');
  }

  /**
   * スクリーンリーダー対応の設定
   */
  private setupScreenReaderSupport(): void {
    if (!this.config.screenReader) return;

    // ライブリージョン（アナウンサー）の作成
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    document.body.appendChild(this.announcer);

    // ページタイトルの設定
    this.setPageTitle('MinutesGen - AI議事録生成アプリ');

    // ランドマークの設定
    this.setupLandmarks();
  }

  /**
   * キーボードナビゲーションの設定
   */
  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavigation) return;

    document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
    
    // スキップリンクの追加
    this.addSkipLinks();
  }

  /**
   * フォーカス管理の設定
   */
  private setupFocusManagement(): void {
    if (!this.config.focusManagement) return;

    // フォーカス可能要素の監視
    this.updateFocusableElements();
    
    // DOM変更の監視
    const observer = new MutationObserver(() => {
      this.updateFocusableElements();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'disabled', 'aria-hidden'],
    });
  }

  /**
   * ユーザー設定の検出と適用
   */
  private setupUserPreferences(): void {
    // ハイコントラストモードの検出
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.config.highContrast = true;
      document.body.classList.add('high-contrast');
    }

    // 動作の減少設定の検出
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.config.reducedMotion = true;
      document.body.classList.add('reduced-motion');
    }

    // 設定変更の監視
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      this.config.highContrast = e.matches;
      document.body.classList.toggle('high-contrast', e.matches);
    });

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.config.reducedMotion = e.matches;
      document.body.classList.toggle('reduced-motion', e.matches);
    });
  }

  /**
   * ランドマークの設定
   */
  private setupLandmarks(): void {
    // メインコンテンツの識別
    const main = document.querySelector('main');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
    }

    // ナビゲーションの識別
    const nav = document.querySelector('nav');
    if (nav && !nav.getAttribute('role')) {
      nav.setAttribute('role', 'navigation');
    }

    // バナーの識別
    const header = document.querySelector('header');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }

    // コンテンツ情報の識別
    const footer = document.querySelector('footer');
    if (footer && !footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
    }
  }

  /**
   * スキップリンクの追加
   */
  private addSkipLinks(): void {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">メインコンテンツにスキップ</a>
      <a href="#navigation" class="skip-link">ナビゲーションにスキップ</a>
    `;
    
    // CSSスタイルの追加
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 6px;
        z-index: 1000;
      }
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        padding: 8px;
        background: #000;
        color: #fff;
        text-decoration: none;
        border-radius: 4px;
        transition: top 0.3s;
      }
      .skip-link:focus {
        top: 6px;
      }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * キーボードナビゲーションの処理
   */
  private handleKeyboardNavigation(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Tab':
        this.handleTabNavigation(event);
        break;
      case 'Escape':
        this.handleEscapeKey(event);
        break;
      case 'Enter':
      case ' ':
        this.handleActivation(event);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        this.handleArrowNavigation(event);
        break;
    }
  }

  /**
   * Tabナビゲーションの処理
   */
  private handleTabNavigation(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.findIndex(el => el === document.activeElement);
    
    if (event.shiftKey) {
      // Shift+Tab: 前の要素へ
      if (currentIndex <= 0) {
        event.preventDefault();
        focusableElements[focusableElements.length - 1]?.focus();
      }
    } else {
      // Tab: 次の要素へ
      if (currentIndex >= focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    }
  }

  /**
   * Escapeキーの処理
   */
  private handleEscapeKey(event: KeyboardEvent): void {
    // モーダルやドロップダウンを閉じる
    const modal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
    if (modal) {
      event.preventDefault();
      this.closeModal(modal as HTMLElement);
    }
  }

  /**
   * 要素のアクティベーション
   */
  private handleActivation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.getAttribute('role') === 'button' || target.tagName === 'BUTTON') {
      event.preventDefault();
      target.click();
    }
  }

  /**
   * 矢印キーナビゲーション
   */
  private handleArrowNavigation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const role = target.getAttribute('role');
    
    if (role === 'radiogroup' || role === 'tablist' || role === 'listbox') {
      event.preventDefault();
      this.navigateWithArrows(target, event.key);
    }
  }

  /**
   * 矢印キーでの要素間移動
   */
  private navigateWithArrows(container: HTMLElement, key: string): void {
    const items = Array.from(container.querySelectorAll('[role="radio"], [role="tab"], [role="option"]'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    let nextIndex = currentIndex;

    switch (key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
    }

    if (nextIndex !== currentIndex) {
      (items[nextIndex] as HTMLElement).focus();
    }
  }

  /**
   * フォーカス可能要素の取得
   */
  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'button',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
    ].join(', ');

    return Array.from(document.querySelectorAll(selector))
      .filter(el => {
        const element = el as HTMLElement;
        return element.offsetParent !== null && !element.getAttribute('aria-hidden');
      }) as HTMLElement[];
  }

  /**
   * フォーカス可能要素の更新
   */
  private updateFocusableElements(): void {
    const elements = this.getFocusableElements();
    this.focusableElements = elements.map((element, index) => ({
      element,
      tabIndex: parseInt(element.getAttribute('tabindex') || '0'),
      role: element.getAttribute('role') || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
    }));
  }

  /**
   * スクリーンリーダーへのアナウンス
   */
  public announce(message: string, priority: AnnouncementPriority = 'polite'): void {
    if (!this.config.announcements || !this.announcer) return;

    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;

    // 短時間後にクリア
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = '';
      }
    }, 1000);
  }

  /**
   * ページタイトルの設定
   */
  public setPageTitle(title: string): void {
    document.title = title;
    this.announce(`ページが変更されました: ${title}`);
  }

  /**
   * フォーカスの設定
   */
  public setFocus(element: HTMLElement | string): void {
    const targetElement = typeof element === 'string' 
      ? document.querySelector(element) as HTMLElement
      : element;

    if (targetElement) {
      targetElement.focus();
      this.announce(`フォーカスが移動しました: ${this.getElementDescription(targetElement)}`);
    }
  }

  /**
   * 要素の説明を取得
   */
  private getElementDescription(element: HTMLElement): string {
    return element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           element.textContent?.trim() ||
           element.tagName.toLowerCase();
  }

  /**
   * モーダルを閉じる
   */
  private closeModal(modal: HTMLElement): void {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    
    // 前にフォーカスがあった要素に戻す
    const previousFocus = modal.getAttribute('data-previous-focus');
    if (previousFocus) {
      const element = document.querySelector(previousFocus) as HTMLElement;
      element?.focus();
    }
  }

  /**
   * ARIA属性の設定
   */
  public setAriaAttributes(element: HTMLElement, attributes: Record<string, string>): void {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(`aria-${key}`, value);
    }
  }

  /**
   * 要素の役割を設定
   */
  public setRole(element: HTMLElement, role: string): void {
    element.setAttribute('role', role);
  }

  /**
   * アクセシビリティ違反の検出
   */
  public checkAccessibility(): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = [];

    // 画像のalt属性チェック
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        violations.push({
          element: img,
          rule: 'img-alt',
          severity: 'error',
          message: '画像にalt属性がありません',
          suggestion: 'alt属性を追加して画像の説明を提供してください',
        });
      }
    });

    // フォーム要素のラベルチェック
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!id || (!ariaLabel && !ariaLabelledBy && !document.querySelector(`label[for="${id}"]`))) {
        violations.push({
          element: input as HTMLElement,
          rule: 'form-label',
          severity: 'error',
          message: 'フォーム要素にラベルが関連付けられていません',
          suggestion: 'label要素またはaria-label属性を追加してください',
        });
      }
    });

    // 見出しの階層チェック
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        violations.push({
          element: heading as HTMLElement,
          rule: 'heading-order',
          severity: 'warning',
          message: '見出しの階層が正しくありません',
          suggestion: '見出しレベルを順番に使用してください',
        });
      }
      previousLevel = level;
    });

    return violations;
  }

  /**
   * 色のコントラスト比を計算
   */
  public calculateContrastRatio(foreground: string, background: string): number {
    const getLuminance = (color: string): number => {
      const rgb = this.hexToRgb(color);
      if (!rgb) return 0;
      
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * 16進数カラーをRGBに変換
   */
  private hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('♿ アクセシビリティ設定が更新されました');
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  /**
   * 初期化状態の確認
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

// シングルトンインスタンス
export const accessibilityService = new AccessibilityService(); 