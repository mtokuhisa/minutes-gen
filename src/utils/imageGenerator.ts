// ===========================================
// MinutesGen v1.0 - HTML→PNG変換ユーティリティ
// ===========================================

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  scale?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0-1 (JPEG/WebP用)
  backgroundColor?: string;
}

export interface GeneratedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  format: string;
}

/**
 * HTMLをPNG画像に変換するクラス
 */
export class ImageGenerator {
  /**
   * HTMLコンテンツをPNG画像に変換
   */
  async convertHTMLToPNG(
    htmlContent: string,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage> {
    const {
      width = 1200,
      height = 800,
      scale = 2,
      format = 'png',
      quality = 0.9,
      backgroundColor = '#ffffff',
    } = options;

    try {
      // 1. HTMLをSVGに変換
      const svgContent = this.convertHTMLToSVG(htmlContent, width, height, backgroundColor);
      
      // 2. SVGを画像に変換
      const image = await this.convertSVGToImage(svgContent, width * scale, height * scale, format, quality);
      
      return image;
    } catch (error) {
      console.error('HTML→PNG変換エラー:', error);
      throw new Error(`画像生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  /**
   * HTMLをSVGに変換
   */
  private convertHTMLToSVG(
    htmlContent: string,
    width: number,
    height: number,
    backgroundColor: string
  ): string {
    // HTMLを外部リソースなしの形式に変換
    const cleanedHTML = this.cleanHTMLForSVG(htmlContent);
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" 
           xmlns:xhtml="http://www.w3.org/1999/xhtml"
           width="${width}" 
           height="${height}"
           viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <foreignObject x="0" y="0" width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" 
               style="width: ${width}px; height: ${height}px; overflow: hidden; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
            ${cleanedHTML}
          </div>
        </foreignObject>
      </svg>
    `.trim();
  }

  /**
   * HTMLから外部リソース参照を除去
   */
  private cleanHTMLForSVG(htmlContent: string): string {
    return htmlContent
      // 外部リンクを削除
      .replace(/<link[^>]*>/gi, '')
      // 外部スクリプトを削除
      .replace(/<script[^>]*src[^>]*><\/script>/gi, '')
      // インラインスクリプトも削除
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // 外部画像をプレースホルダーに置換
      .replace(/<img[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/gi, '<div style="background: #f0f0f0; border: 1px dashed #ccc; padding: 20px; text-align: center; color: #666;">画像</div>')
      // 相対パスの画像も削除
      .replace(/<img[^>]*>/gi, '<div style="background: #f0f0f0; border: 1px dashed #ccc; padding: 20px; text-align: center; color: #666;">画像</div>')
      // 外部CSSを削除
      .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
      // 危険な要素を削除
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      // CSSのurl()参照を削除
      .replace(/url\([^)]*\)/gi, 'none');
  }

  /**
   * SVGを画像に変換
   */
  private async convertSVGToImage(
    svgContent: string,
    width: number,
    height: number,
    format: 'png' | 'jpeg' | 'webp',
    quality: number
  ): Promise<GeneratedImage> {
    return new Promise((resolve, reject) => {
      // SVGをBlob URLに変換
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // 画像要素を作成
      const img = new Image();
      
      img.onload = () => {
        try {
          // Canvasを作成
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas 2D contextを取得できませんでした'));
            return;
          }

          canvas.width = width;
          canvas.height = height;

          // 背景を描画（透明でない場合）
          if (format === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }

          // SVG画像をCanvasに描画
          ctx.drawImage(img, 0, 0, width, height);

          // Canvasを指定形式のBlobに変換
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('画像の生成に失敗しました'));
                return;
              }

              // Data URLも生成
              const dataUrl = canvas.toDataURL(`image/${format}`, quality);

              resolve({
                blob,
                dataUrl,
                width,
                height,
                format,
              });

              // クリーンアップ
              URL.revokeObjectURL(svgUrl);
            },
            `image/${format}`,
            format === 'png' ? undefined : quality
          );
        } catch (error) {
          reject(error);
          URL.revokeObjectURL(svgUrl);
        }
      };

      img.onerror = () => {
        reject(new Error('SVG画像の読み込みに失敗しました'));
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    });
  }

  /**
   * 複数ページのHTMLを分割してPNG生成
   */
  async convertMultiPageHTML(
    htmlContent: string,
    structure: 'horizontal' | 'vertical',
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage[]> {
    const pages = this.splitHTMLIntoPages(htmlContent, structure);
    const images: GeneratedImage[] = [];

    for (let i = 0; i < pages.length; i++) {
      const pageOptions = {
        ...options,
        width: structure === 'horizontal' ? 1600 : 800,
        height: structure === 'horizontal' ? 900 : 1200,
      };

      const image = await this.convertHTMLToPNG(pages[i], pageOptions);
      images.push(image);
    }

    return images;
  }

  /**
   * HTMLを複数ページに分割
   */
  private splitHTMLIntoPages(
    htmlContent: string,
    structure: 'horizontal' | 'vertical'
  ): string[] {
    // HTMLを解析してページ高さに基づいて分割
    const pageHeight = structure === 'horizontal' ? 900 : 1200;
    const estimatedLineHeight = 24; // 平均行高
    const linesPerPage = Math.floor(pageHeight / estimatedLineHeight);
    
    // HTMLをテキストベースで分割
    const paragraphs = htmlContent.split(/<\/p>|<\/div>|<\/section>|<\/article>/gi);
    const pages: string[] = [];
    let currentPage = '';
    let currentLines = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const estimatedLines = Math.max(1, Math.ceil(paragraph.length / 80)); // 80文字程度で1行と推定
      
      // 現在のページに追加できるかチェック
      if (currentLines + estimatedLines > linesPerPage && currentPage.trim()) {
        // 新しいページを開始
        pages.push(this.wrapPageContent(currentPage, structure, pages.length + 1));
        currentPage = paragraph;
        currentLines = estimatedLines;
      } else {
        // 現在のページに追加
        currentPage += paragraph;
        currentLines += estimatedLines;
      }
    }
    
    // 最後のページを追加
    if (currentPage.trim()) {
      pages.push(this.wrapPageContent(currentPage, structure, pages.length + 1));
    }
    
    return pages.length > 0 ? pages : [this.wrapPageContent(htmlContent, structure, 1)];
  }

  /**
   * ページコンテンツをHTMLでラップ
   */
  private wrapPageContent(content: string, structure: 'horizontal' | 'vertical', pageNumber: number): string {
    const width = structure === 'horizontal' ? 1600 : 800;
    const height = structure === 'horizontal' ? 900 : 1200;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>インフォグラフィック - ページ ${pageNumber}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            width: ${width - 40}px;
            height: ${height - 40}px;
            overflow: hidden;
            box-sizing: border-box;
          }
          .page-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #ddd;
          }
          .page-number {
            position: absolute;
            bottom: 20px;
            right: 20px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="page-header">
          <h1>議事録インフォグラフィック</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="page-number">ページ ${pageNumber}</div>
      </body>
      </html>
    `.trim();
  }

  /**
   * 画像をダウンロード
   */
  downloadImage(image: GeneratedImage, filename: string): void {
    const url = URL.createObjectURL(image.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 複数画像をZIPでダウンロード（将来実装）
   */
  async downloadImagesAsZip(images: GeneratedImage[], baseFilename: string): Promise<void> {
    // TODO: JSZipライブラリを使用してZIP生成
    console.warn('ZIP出力機能は今後実装予定です');
    
    // 代替として個別ダウンロード
    images.forEach((image, index) => {
      const filename = `${baseFilename}_page_${index + 1}.${image.format}`;
      this.downloadImage(image, filename);
    });
  }
}

// シングルトンインスタンス
export const imageGenerator = new ImageGenerator(); 