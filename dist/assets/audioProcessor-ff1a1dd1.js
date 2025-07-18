class s{constructor(){this.isInitialized=!1,console.warn("⚠️ レガシーAudioProcessorServiceが使用されています。"),console.warn("パフォーマンスを向上させるため、Electron環境ではNativeAudioProcessorServiceの使用を推奨します。")}async initialize(e){this.isInitialized||(e?.({stage:"transcribing",percentage:5,currentTask:"レガシー音声処理システムを初期化中...",estimatedTimeRemaining:0,logs:[{id:Date.now().toString(),timestamp:new Date,level:"warning",message:"レガシー音声処理システムを使用しています。性能向上のため、Electron環境での使用を推奨します。"}],startedAt:new Date}),await new Promise(n=>setTimeout(n,1e3)),this.isInitialized=!0,e?.({stage:"transcribing",percentage:15,currentTask:"レガシー音声処理システムの初期化完了",estimatedTimeRemaining:0,logs:[{id:Date.now().toString(),timestamp:new Date,level:"info",message:"レガシー音声処理システムの初期化が完了しました。"}],startedAt:new Date}))}async processLargeAudioFile(e,n=600,a){if(await this.initialize(a),!e.rawFile)throw new Error("音声ファイルが見つかりません");const t=100*1024*1024;if(e.rawFile.size>t){const o=`
大容量音声ファイル（${Math.round(e.rawFile.size/1024/1024)}MB）の処理には、
ネイティブFFmpegの使用を強く推奨します。

現在の制限:
- レガシー処理: 最大100MB
- ネイティブFFmpeg: 制限なし（数GB対応）

解決方法:
1. Electron環境でアプリを実行
2. 環境変数 REACT_APP_USE_NATIVE_FFMPEG=true を設定
3. より小さなファイルサイズで再試行
      `.trim();throw new Error(o)}e.rawFile.size>50*1024*1024&&(console.warn("⚠️ 大容量ファイル処理中:",{fileSize:Math.round(e.rawFile.size/1024/1024)+"MB",recommendation:"ネイティブFFmpegの使用を推奨"}),typeof window<"u"&&window.gc&&window.gc()),a?.({stage:"transcribing",percentage:30,currentTask:`音声ファイル（${Math.round(e.rawFile.size/1024/1024)}MB）を処理中...`,estimatedTimeRemaining:0,logs:[{id:Date.now().toString(),timestamp:new Date,level:"info",message:"レガシー処理でファイルを単一セグメントとして処理します。"}],startedAt:new Date});const i=await this.getAudioDurationFromBlob(e.rawFile),r=[{blob:e.rawFile,name:"segment_000.wav",duration:i,startTime:0,endTime:i}];return a?.({stage:"transcribing",percentage:50,currentTask:"音声ファイルの処理完了",estimatedTimeRemaining:0,logs:[{id:Date.now().toString(),timestamp:new Date,level:"info",message:`音声セグメント準備完了 (${Math.round(e.rawFile.size/1024/1024)}MB)`}],startedAt:new Date}),r}async getAudioDurationFromBlob(e){return new Promise((n,a)=>{const t=new Audio,i=URL.createObjectURL(e);t.onloadedmetadata=()=>{URL.revokeObjectURL(i),n(t.duration||0)},t.onerror=()=>{URL.revokeObjectURL(i),a(new Error("音声ファイルの長さを取得できませんでした"))},t.src=i})}async cleanup(){this.isInitialized=!1,console.log("レガシーAudioProcessorServiceのクリーンアップが完了しました。")}}const d=new s;export{s as AudioProcessorService,d as audioProcessor};
//# sourceMappingURL=audioProcessor-ff1a1dd1.js.map
