const fs = require('fs');
const path = require('path');

/**
 * パッケージ化後のFFmpegバイナリに実行権限を付与
 * @param {Object} context - electron-builderのコンテキスト
 */
exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const platform = packager.platform.nodeName;
  
  console.log('🔧 FFmpeg/FFprobeバイナリの実行権限を修正中...');
  console.log(`Platform: ${platform}, Output: ${appOutDir}`);

  if (platform === 'darwin') {
    // macOSの場合
    const appPath = path.join(appOutDir, 'MinutesGen.app');
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    const unpackedFFmpegPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');
    const unpackedFFprobePath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
    
    console.log('📁 FFmpegバイナリパス:', unpackedFFmpegPath);
    console.log('📁 FFprobeバイナリパス:', unpackedFFprobePath);
    
    try {
      // FFmpegバイナリの処理
      const ffmpegBinaryPath = path.join(unpackedFFmpegPath, 'ffmpeg');
      
      if (fs.existsSync(ffmpegBinaryPath)) {
        console.log('✅ FFmpegバイナリを発見:', ffmpegBinaryPath);
        
        // 実行権限を付与
        fs.chmodSync(ffmpegBinaryPath, 0o755);
        console.log('✅ FFmpegバイナリに実行権限を付与しました');
        
        // 権限確認
        const stats = fs.statSync(ffmpegBinaryPath);
        console.log(`📊 FFmpegバイナリ権限: ${stats.mode.toString(8)}`);
      } else {
        console.warn('⚠️ FFmpegバイナリが見つかりません:', ffmpegBinaryPath);
        
        // 代替パスを確認
        const altPaths = [
          path.join(unpackedFFmpegPath, 'bin', 'ffmpeg'),
          path.join(unpackedFFmpegPath, 'darwin-arm64', 'ffmpeg'),
          path.join(unpackedFFmpegPath, 'darwin-x64', 'ffmpeg'),
        ];
        
        for (const altPath of altPaths) {
          if (fs.existsSync(altPath)) {
            console.log('✅ 代替パスでFFmpegバイナリを発見:', altPath);
            fs.chmodSync(altPath, 0o755);
            console.log('✅ FFmpegバイナリに実行権限を付与しました');
            break;
          }
        }
      }
      
      // FFprobeバイナリの処理
      const ffprobeBinaryPath = path.join(unpackedFFprobePath, 'ffprobe');
      
      if (fs.existsSync(ffprobeBinaryPath)) {
        console.log('✅ FFprobeバイナリを発見:', ffprobeBinaryPath);
        
        // 実行権限を付与
        fs.chmodSync(ffprobeBinaryPath, 0o755);
        console.log('✅ FFprobeバイナリに実行権限を付与しました');
        
        // 権限確認
        const stats = fs.statSync(ffprobeBinaryPath);
        console.log(`📊 FFprobeバイナリ権限: ${stats.mode.toString(8)}`);
      } else {
        console.warn('⚠️ FFprobeバイナリが見つかりません:', ffprobeBinaryPath);
        
        // 代替パスを確認（ffprobe-staticの実際の構造に基づく）
        const altPaths = [
          path.join(unpackedFFprobePath, 'bin', 'darwin', 'arm64', 'ffprobe'),
          path.join(unpackedFFprobePath, 'bin', 'darwin', 'x64', 'ffprobe'),
          path.join(unpackedFFprobePath, 'bin', 'ffprobe'),
          path.join(unpackedFFprobePath, 'darwin-arm64', 'ffprobe'),
          path.join(unpackedFFprobePath, 'darwin-x64', 'ffprobe'),
        ];
        
        for (const altPath of altPaths) {
          if (fs.existsSync(altPath)) {
            console.log('✅ 代替パスでFFprobeバイナリを発見:', altPath);
            fs.chmodSync(altPath, 0o755);
            console.log('✅ FFprobeバイナリに実行権限を付与しました');
            
            // 権限確認
            const stats = fs.statSync(altPath);
            console.log(`📊 FFprobeバイナリ権限: ${stats.mode.toString(8)}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('❌ FFmpeg/FFprobeバイナリの権限修正でエラー:', error);
    }
  } else if (platform === 'win32') {
    // Windowsの場合
    const unpackedFFmpegPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');
    const unpackedFFprobePath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'ffprobe-static');
    const ffmpegBinaryPath = path.join(unpackedFFmpegPath, 'ffmpeg.exe');
    const ffprobeBinaryPath = path.join(unpackedFFprobePath, 'ffprobe.exe');
    
    console.log('📁 FFmpegバイナリパス:', ffmpegBinaryPath);
    console.log('📁 FFprobeバイナリパス:', ffprobeBinaryPath);
    
    if (fs.existsSync(ffmpegBinaryPath)) {
      console.log('✅ Windows FFmpegバイナリを発見:', ffmpegBinaryPath);
      // Windowsでは特別な権限設定は不要
    } else {
      console.warn('⚠️ FFmpegバイナリが見つかりません:', ffmpegBinaryPath);
    }
    
    if (fs.existsSync(ffprobeBinaryPath)) {
      console.log('✅ Windows FFprobeバイナリを発見:', ffprobeBinaryPath);
      // Windowsでは特別な権限設定は不要
    } else {
      console.warn('⚠️ FFprobeバイナリが見つかりません:', ffprobeBinaryPath);
    }
  }
  
  console.log('🎉 FFmpeg/FFprobeバイナリの権限修正完了');
}; 