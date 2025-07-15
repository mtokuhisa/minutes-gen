import markdownDocx, { Packer } from 'markdown-docx';

export class MD2DOCXService {
  /**
   * MarkdownからDOCXバイナリデータを生成
   */
  async convertMarkdownToDOCX(markdownContent: string): Promise<Uint8Array> {
    try {
      console.log('MD2DOCX変換開始:', {
        contentLength: markdownContent.length,
        contentPreview: markdownContent.substring(0, 200)
      });

      // markdownDocx関数を使用してDocumentを生成
      const document = await markdownDocx(markdownContent, {
        ignoreImage: false,
        ignoreFootnote: false,
        ignoreHtml: false,
        gfm: true
      });
      
      // ブラウザ環境では toBlob() を使用
      const blob = await Packer.toBlob(document);
      
      // BlobをUint8Arrayに変換
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('MD2DOCX変換完了:', {
        outputSize: uint8Array.length,
        outputType: typeof uint8Array
      });

      return uint8Array;
    } catch (error) {
      console.error('MD2DOCX変換エラー:', error);
      throw new Error(`Markdown to DOCX変換に失敗しました: ${error.message}`);
    }
  }

  /**
   * MarkdownからDOCXファイルを生成（フォールバック版）
   */
  async convertMarkdownToDOCXFallback(markdownContent: string): Promise<Uint8Array> {
    try {
      console.log('MD2DOCX フォールバック変換開始');

      // より単純な設定でフォールバック変換
      const document = await markdownDocx(markdownContent, {
        ignoreImage: true, // 画像を無視してフォールバック
        ignoreFootnote: true,
        ignoreHtml: true,
        gfm: false
      });

      // ブラウザ環境では toBlob() を使用
      const blob = await Packer.toBlob(document);
      
      // BlobをUint8Arrayに変換
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log('MD2DOCX フォールバック変換完了:', {
        outputSize: uint8Array.length
      });

      return uint8Array;
    } catch (error) {
      console.error('MD2DOCX フォールバック変換エラー:', error);
      throw new Error(`Markdown to DOCX変換（フォールバック）に失敗しました: ${error.message}`);
    }
  }

  /**
   * Markdownコンテンツの前処理
   */
  private preprocessMarkdown(content: string): string {
    // 日本語文書に適したMarkdown前処理
    return content
      // 不要な技術説明を削除
      .replace(/Microsoft Word対応Markdown文書/g, '')
      .replace(/Word互換性のため標準的なMarkdown記法を使用/g, '')
      .replace(/後でDOCX形式に変換されるため、Word互換性を考慮/g, '')
      .replace(/重要：Microsoft Word互換性のため標準的なMarkdown記法を使用/g, '')
      .replace(/日本語文書に適したMarkdown形式で記述/g, '')
      .replace(/後でDOCX形式に変換されるため、Word互換性を考慮/g, '')
      // 技術的なコメントを削除
      .replace(/\/\/ 重要：.*$/gm, '')
      .replace(/\/\/ 日本語文書に適した.*$/gm, '')
      .replace(/\/\/ 後でDOCX形式に.*$/gm, '')
      // 全角スペースを半角スペースに変換
      .replace(/　/g, ' ')
      // 改行の正規化
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 連続する改行を制限
      .replace(/\n{3,}/g, '\n\n')
      // 先頭と末尾の空白を削除
      .trim();
  }

  /**
   * 高品質なDOCX生成（前処理付き）
   */
  async generateHighQualityDOCX(markdownContent: string): Promise<Uint8Array> {
    try {
      // Markdown前処理
      const processedMarkdown = this.preprocessMarkdown(markdownContent);

      // まず標準変換を試行
      try {
        return await this.convertMarkdownToDOCX(processedMarkdown);
      } catch (error) {
        console.warn('標準変換に失敗、フォールバック変換を試行:', error.message);
        
        // フォールバック変換を試行
        return await this.convertMarkdownToDOCXFallback(processedMarkdown);
      }
    } catch (error) {
      console.error('DOCX生成に完全に失敗:', error);
      throw new Error(`DOCX生成に失敗しました: ${error.message}`);
    }
  }
}

// シングルトンインスタンス
export const md2docxService = new MD2DOCXService(); 