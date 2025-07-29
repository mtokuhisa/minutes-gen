const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Windows用FFmpegバイナリの自動置換を行う関数
async function replaceWithWindowsFFmpeg(ffmpegBinaryPath) {
  console.log('🔄 Windows用FFmpegの配置を開始...');
  
  try {
    // 一時ディレクトリを作成
    const tempDir = path.join(process.cwd(), 'temp-ffmpeg-win');
    
    console.log('🔄 Windows用FFmpegバイナリをダウンロード中...');
    console.log('📦 Windows用ffmpeg-staticパッケージをダウンロード中...');
    
    // Windows用ffmpeg-staticを一時ディレクトリにダウンロード
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // package.jsonを作成してffmpeg-staticをインストール
    const tempPackageJson = {
      "name": "temp-ffmpeg-win",
      "version": "1.0.0",
      "dependencies": {
        "ffmpeg-static": "^5.2.0"
      }
    };
    
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(tempPackageJson, null, 2));
    
    // npm installを実行（Windowsバイナリを取得）
    execSync('npm install --platform=win32 --arch=ia32', { 
      cwd: tempDir, 
      stdio: 'inherit',
      env: { ...process.env, npm_config_target_platform: 'win32', npm_config_target_arch: 'ia32' }
    });
    
    // Windows用バイナリのパスを確認
    const tempFFmpegPaths = [
      path.join(tempDir, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
      path.join(tempDir, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      path.join(tempDir, 'node_modules', 'ffmpeg-static', 'win32', 'ffmpeg.exe'),
      path.join(tempDir, 'node_modules', 'ffmpeg-static', 'bin', 'win32', 'ia32', 'ffmpeg.exe'),
    ];
    
    let windowsFFmpegPath = null;
    for (const tempPath of tempFFmpegPaths) {
      if (fs.existsSync(tempPath)) {
        windowsFFmpegPath = tempPath;
        console.log('✅ Windows用FFmpegバイナリを発見:', windowsFFmpegPath);
        break;
      }
    }
    
    if (!windowsFFmpegPath) {
      throw new Error('Windows用FFmpegバイナリが見つかりません');
    }
    
    // バイナリ形式を確認
    try {
      const fileResult = execSync(`file "${windowsFFmpegPath}"`, { encoding: 'utf8' });
      if (fileResult.includes('PE32') || fileResult.includes('MS Windows')) {
        console.log('✅ Windows PE形式のバイナリを確認');
      } else {
        console.warn('⚠️ バイナリ形式の確認に失敗:', fileResult.trim());
      }
    } catch (error) {
      console.warn('⚠️ file コマンドによる確認に失敗:', error.message);
    }
    
    // 元のファイルをバックアップ
    const backupPath = ffmpegBinaryPath + '.backup';
    if (fs.existsSync(ffmpegBinaryPath)) {
      fs.copyFileSync(ffmpegBinaryPath, backupPath);
    }
    
    // Windows用バイナリを配置
    fs.copyFileSync(windowsFFmpegPath, ffmpegBinaryPath);
    console.log('✅ Windows用FFmpegバイナリを配置:', ffmpegBinaryPath);
    
    // サイズ確認
    const stats = fs.statSync(ffmpegBinaryPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`📊 配置されたFFmpegバイナリサイズ: ${sizeMB}MB`);
    
    // 一時ディレクトリを削除
    execSync(`rm -rf "${tempDir}"`);
    console.log('🧹 一時ディレクトリを削除しました');
    
    console.log('✅ Windows用FFmpegの配置完了');
    return true;
    
  } catch (error) {
    console.error('❌ Windows用FFmpegの配置に失敗:', error.message);
    return false;
  }
}

/**
 * パッケージ化後のFFmpegバイナリに実行権限を付与・Windows用バイナリ置換
 * @param {Object} context - electron-builderのコンテキスト
 */
exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const platform = packager.platform.nodeName;
  
  console.log('🔧 FFmpeg/FFprobeバイナリの実行権限を修正中...');
  console.log(`Platform: ${platform}, Output: ${appOutDir}`);

  if (platform === 'win32') {
    // Windowsの場合
    const unpackedFFmpegPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');
    const unpackedFFprobePath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
    
    // FFmpegバイナリの処理
    const ffmpegBinaryPath = path.join(unpackedFFmpegPath, 'ffmpeg');
    console.log('📁 FFmpegバイナリパス:', ffmpegBinaryPath);
    
    if (fs.existsSync(ffmpegBinaryPath)) {
      console.log('✅ Windows FFmpegバイナリを発見:', ffmpegBinaryPath);
      
      // バイナリ形式を確認
      try {
        const fileResult = execSync(`file "${ffmpegBinaryPath}"`, { encoding: 'utf8' });
        if (!fileResult.includes('PE32') && !fileResult.includes('MS Windows')) {
          console.warn('⚠️ 非Windows形式のFFmpegバイナリを検出 - Windows用に置換します');
          console.log(`検出された形式: ${fileResult.trim()}`);
          
          // Windows用バイナリに置換
          const replaceSuccess = await replaceWithWindowsFFmpeg(ffmpegBinaryPath);
          if (!replaceSuccess) {
            console.error('❌ Windows用FFmpegバイナリの置換に失敗しました');
          }
        } else {
          console.log('✅ Windows PE形式のFFmpegバイナリを確認');
        }
      } catch (error) {
        console.warn('⚠️ バイナリ形式の確認に失敗、Windows用バイナリに置換を試行');
        await replaceWithWindowsFFmpeg(ffmpegBinaryPath);
      }
    } else {
      console.warn('⚠️ FFmpegバイナリが見つかりません:', ffmpegBinaryPath);
    }
    
    // FFprobeバイナリの処理（通常は正しく配置されている）
    const ffprobeBinaryPath = path.join(unpackedFFprobePath, 'bin', 'win32', 'ia32', 'ffprobe.exe');
    console.log('📁 FFprobeバイナリパス:', ffprobeBinaryPath);
    
    if (fs.existsSync(ffprobeBinaryPath)) {
      console.log('✅ Windows FFprobeバイナリを発見:', ffprobeBinaryPath);
    } else {
      console.warn('⚠️ FFprobeバイナリが見つかりません:', ffprobeBinaryPath);
    }
    
  } else if (platform === 'darwin') {
    // macOSの場合 - 実行権限付与
    const appPath = path.join(appOutDir, 'MinutesGen.app');
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    const unpackedFFmpegPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');
    const unpackedFFprobePath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
    
    console.log('📁 FFmpegバイナリパス:', unpackedFFmpegPath);
    
    try {
      const ffmpegBinaryPath = path.join(unpackedFFmpegPath, 'ffmpeg');
      if (fs.existsSync(ffmpegBinaryPath)) {
        fs.chmodSync(ffmpegBinaryPath, 0o755);
        console.log('✅ FFmpegバイナリに実行権限を付与しました');
      }
      
      // FFprobeの実行権限付与
      const ffprobePaths = [
        path.join(unpackedFFprobePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
        path.join(unpackedFFprobePath, 'bin', 'darwin', 'x64', 'ffprobe'),
      ];
      
      for (const ffprobePath of ffprobePaths) {
        if (fs.existsSync(ffprobePath)) {
          fs.chmodSync(ffprobePath, 0o755);
          console.log('✅ FFprobeバイナリに実行権限を付与しました:', ffprobePath);
          break;
        }
      }
    } catch (error) {
      console.error('❌ macOS バイナリの権限修正でエラー:', error);
    }
  }
  
  console.log('🎉 FFmpeg/FFprobeバイナリの権限修正完了');
}; 