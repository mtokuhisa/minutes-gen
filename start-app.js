#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const sleep = promisify(setTimeout);

console.log('🚀 MinutesGen アプリケーションを起動中...');
console.log('📁 作業ディレクトリ:', process.cwd());

// PowerShellのバグを回避してzshを使用
process.env.SHELL = '/bin/zsh';
process.env.NODE_ENV = 'development';

// 既存のプロセスを終了
function killExistingProcesses() {
  try {
    const killCmd = spawn('pkill', ['-f', 'node|npm|vite|electron'], {
      stdio: 'ignore',
      shell: '/bin/zsh'
    });
    
    killCmd.on('close', () => {
      console.log('✅ 既存のプロセスを終了しました');
    });
  } catch (error) {
    console.log('⚠️  既存のプロセス終了をスキップしました');
  }
}

// Viteサーバーを起動
function startViteServer() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Viteサーバーを起動中...');
    
    const vite = spawn('npx', ['vite', '--port', '3000', '--strictPort'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/zsh',
      cwd: process.cwd(),
      env: { ...process.env, SHELL: '/bin/zsh' }
    });

    vite.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Vite:', output);
      
      if (output.includes('Local:') || output.includes('localhost:3000')) {
        console.log('✅ Viteサーバーが起動しました - http://localhost:3000');
        resolve(vite);
      }
    });

    vite.stderr.on('data', (data) => {
      console.error('Vite Error:', data.toString());
    });

    vite.on('error', (error) => {
      console.error('❌ Viteサーバーの起動に失敗:', error);
      reject(error);
    });

    // 10秒でタイムアウト
    setTimeout(() => {
      console.log('⏱️  Viteサーバーの起動を確認中...');
      resolve(vite);
    }, 10000);
  });
}

// Electronを起動
function startElectron() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Electronを起動中...');
    
    const electron = spawn('npx', ['electron', '--max-old-space-size=1024', '--expose-gc', '.'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/zsh',
      cwd: process.cwd(),
      env: { ...process.env, SHELL: '/bin/zsh' }
    });

    electron.stdout.on('data', (data) => {
      console.log('Electron:', data.toString());
    });

    electron.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('GPU process')) {
        console.error('Electron Error:', error);
      }
    });

    electron.on('error', (error) => {
      console.error('❌ Electronの起動に失敗:', error);
      reject(error);
    });

    electron.on('close', (code) => {
      console.log('🔄 Electronが終了しました (コード:', code, ')');
    });

    console.log('✅ Electronを起動しました');
    resolve(electron);
  });
}

// メインの実行関数
async function main() {
  try {
    // 既存のプロセスを終了
    killExistingProcesses();
    await sleep(2000);
    
    // Viteサーバーを起動
    const viteProcess = await startViteServer();
    await sleep(3000);
    
    // Electronを起動
    const electronProcess = await startElectron();
    
    console.log('🎉 MinutesGenアプリケーションが起動しました！');
    console.log('🌐 ブラウザURL: http://localhost:3000');
    console.log('📱 Electronアプリが開いているはずです');
    
    // プロセスを監視
    process.on('SIGINT', () => {
      console.log('\n⏹️  アプリケーションを終了中...');
      viteProcess.kill();
      electronProcess.kill();
      process.exit(0);
    });
    
    // プロセスを永続化
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ アプリケーションの起動に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
}

module.exports = { main }; 