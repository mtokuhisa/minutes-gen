import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      // React初期化の問題を解決するための設定
      jsxRuntime: 'automatic',
      include: '**/*.{jsx,tsx}',
    })
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // process.envを安全に定義
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.HTTPS_PROXY': JSON.stringify(process.env.HTTPS_PROXY || ''),
    'process.env.HTTP_PROXY': JSON.stringify(process.env.HTTP_PROXY || ''),
    'process.env.PROXY_AUTH': JSON.stringify(process.env.PROXY_AUTH || ''),
    'process.env.CORPORATE_CONFIG': JSON.stringify(process.env.CORPORATE_CONFIG || ''),
    // globalオブジェクトを明示的に定義
    global: 'globalThis',
    // ReactとReactDOMを確実に利用可能にする
    'typeof React': JSON.stringify('object'),
    'typeof ReactDOM': JSON.stringify('object'),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Electron環境でのバンドル最適化
    target: 'esnext',
    rollupOptions: {
      // 外部依存関係の処理を改善
      external: [],
      output: {
        // Electron環境での安全性のためチャンク分割を無効化
        manualChunks: undefined,
        // 単一バンドルで確実な動作を保証
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // 依存関係の事前バンドル
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    port: 9000,
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['ffmpeg-static'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
    // ビルド時の最適化
    esbuildOptions: {
      target: 'esnext',
    }
  },
  // Electron環境特有の設定
  envPrefix: ['VITE_', 'ELECTRON_'],
}); 