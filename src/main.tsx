// React関連のインポートを明示的に行う
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from './theme';
import App from './App';

// グローバルにReactを設定（Electron環境での安全性確保）
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
}

// Electron環境でのReact安全初期化
const initializeMinutesGen = () => {
  console.log('MinutesGen 初期化開始...');
  console.log('React version:', React.version);
  console.log('ReactDOM available:', !!ReactDOM);
  
  try {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // Reactとバンドルの読み込み確認
    if (!React || !ReactDOM || !React.createElement) {
      throw new Error('React dependencies not loaded properly');
    }

    console.log('React dependencies loaded successfully');

    // ローディング要素を削除
    const loadingElement = rootElement.querySelector('.loading');
    if (loadingElement) {
      loadingElement.remove();
    }

    // React 18の新しいルートAPIを使用
    const root = ReactDOM.createRoot(rootElement);

    // 最もシンプルな方法でコンポーネントを構築
    try {
      root.render(
        React.createElement(React.StrictMode, null,
          React.createElement(ThemeProvider, null,
            React.createElement(React.Fragment, null, [
              React.createElement(CssBaseline, { key: 'cssbaseline' }),
              React.createElement(App, { key: 'app' })
            ])
          )
        )
      );
    } catch (renderError) {
      console.error('Render error:', renderError);
      // フォールバック：StrictModeなしで試行
      root.render(
        React.createElement(ThemeProvider, null,
          React.createElement(React.Fragment, null, [
            React.createElement(CssBaseline, { key: 'cssbaseline' }),
            React.createElement(App, { key: 'app' })
          ])
        )
      );
    }

    // アプリケーションの読み込み確認用のグローバル変数を設定
    (window as any).__MINUTES_GEN_LOADED__ = true;
    (window as any).__MINUTES_GEN_VERSION__ = '1.0';
    console.log('MinutesGen アプリケーションが正常に読み込まれました');

    // 初期化完了イベントを発火
    const initEvent = new CustomEvent('minutesGenReady', {
      detail: { version: '1.0', timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(initEvent);

  } catch (error) {
    console.error('MinutesGen アプリケーションの初期化に失敗しました:', error);
    
    // フォールバック: シンプルなエラーメッセージを表示
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          flex-direction: column;
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #f1f8e9 0%, #c8e6c9 100%);
        ">
          <div style="
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          ">
            <h1 style="
              color: #2e7d32; 
              margin-bottom: 20px;
              font-size: 2rem;
            ">MinutesGen</h1>
            <p style="
              color: #555; 
              margin-bottom: 30px;
              line-height: 1.6;
            ">
              アプリケーションの初期化に失敗しました。<br>
              ページを再読み込みしてお試しください。
            </p>
            <div style="margin-bottom: 20px;">
              <button onclick="location.reload()" style="
                margin: 5px;
                padding: 12px 24px;
                background: #4caf50;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
              ">
                再読み込み
              </button>
              <button onclick="console.log('Error details:', '${error}')" style="
                margin: 5px;
                padding: 12px 24px;
                background: #2196f3;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
              ">
                エラー詳細
              </button>
            </div>
            <small style="color: #888;">
              エラー: ${error?.message || 'Unknown error'}
            </small>
          </div>
        </div>
      `;
    }

    // エラー情報をグローバルに保存
    (window as any).__MINUTES_GEN_ERROR__ = {
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }
};

// DOM読み込み完了後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMinutesGen);
} else {
  initializeMinutesGen();
} 