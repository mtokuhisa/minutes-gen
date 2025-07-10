import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // process.envを安全に定義
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      HTTPS_PROXY: JSON.stringify(process.env.HTTPS_PROXY || ''),
      HTTP_PROXY: JSON.stringify(process.env.HTTP_PROXY || ''),
      PROXY_AUTH: JSON.stringify(process.env.PROXY_AUTH || ''),
      CORPORATE_CONFIG: JSON.stringify(process.env.CORPORATE_CONFIG || ''),
    },
    // globalオブジェクトも定義
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    include: [
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
}); 