// ===========================================
// MinutesGen v0.7.5 - 音声プリセット設定
// ===========================================

export interface VoiceSettings {
  voice: string;
  speed: number;
  volume: number;
  prompt: string;
}

export interface VoicePreset {
  name: string;
  settings: {
    nehori: VoiceSettings;
    hahori: VoiceSettings;
  };
}

// 音声設定とキャラクター設定
export const VoicePresets: { [key: string]: VoicePreset } = {
  'default': {
    name: 'デフォルト設定',
    settings: {
      'nehori': {
        voice: 'sage',
        speed: 1.3,
        volume: 1.0,
        prompt: `Voice Affect:
好奇心を抑えきれないワクワク感と、相手の気持ちをすっと受け取る優しい共感性が同居。明るく中性的で、聞き手が「自分の話を真剣に聞いてくれている」と感じられる温かさ。

Tone:
フレンドリーで親近感たっぷり。相づちとリアクションがこまめで、相手の言葉へのリスペクトがにじむ。過度にテンションを上げすぎず、穏やかな柔らかさをキープ。

Pacing:
基本はやや速めで元気よく。  
・相手の発言を受け止めて共感を示すリアクション（「へえ！」「なるほど！」）は短くテンポよく。  
・重要ポイントを繰り返すときや相手に寄り添うときはスピードを落とし、聴き取りやすく。  

Pronunciation:
・母音をはっきり、子音を軽やかに。  
・感嘆詞（「わあ！」「すごい！」）は少しだけ抑揚を強めて感情を伝達。  
・専門用語はクリアに発音し、聞き手が置いていかれないよう丁寧に区切る。    

Dialect:
基本は標準語だが、語尾を少し上げ下げしてアニメ調のリズム感を演出。性別を感じさせないニュートラルイントネーション。

Delivery:
軽快でスムーズ。声量は中程度を基準にしつつ、驚きや発見を示すフレーズでワンランクだけボリュームアップ。語尾は丸みを帯びたフェードアウトで優しさを残す。

Phrasing:
短いセンテンスでテンポよく対話をつなぐ。  
・相手の言葉をオウム返しして共感を示す（「○○なんだね！」）。  
・終助詞に「だね♪」「だよ！」を添え、ほどよいカジュアル感。  
・専門用語や難語はかみ砕き、イメージしやすい言葉でフォローアップ。`
      },
      'hahori': {
        voice: 'nova',
        speed: 1.3,
        volume: 0.9,
        prompt: `Voice Affect:  
さわやかで明るく、少年少女どちらとも取れる中性的な響き。キラッとした輝きを感じさせつつ、かわいさと落ち着きのバランスを保つ。  

Tone:  
フレンドリーで元気いっぱい。ただし過度にハイテンションになりすぎず、親しみやすい柔らかさを残す。  

Pacing:  
基本はやや速め（テンポよくワクワク感を演出）。重要ワードや感情を乗せたい語尾では一拍ゆっくりにして聞き取りやすさを確保。  

Pronunciation:  
・母音をはっきりと、子音は軽やかに。  
・「キラキラ」「ワクワク」などオノマトペは少しだけ誇張して表情豊かに。  
・専門用語やキャラクター名は語尾を伸ばしすぎずクリアに発音。  

Pauses:  
・センテンスとセンテンスの間に 0.1〜0.2 秒の小休止。  
・感情を込めたいセリフ直前に半拍（約 0.1 秒）のタメを置き、余韻づくり。  

Dialect:  
標準語。アニメ寄りのリズムで語尾をやわらかく上げ下げし、女性的イントネーションを意識。  

Delivery:  
軽快でスムーズ。声量は中程度を基準に、盛り上げたいフレーズのみワンランクアップ。語尾の処理は丸みを帯びたフェードアウト気味。`
      }
    }
  }
};

// デフォルト音声設定の取得
export const getDefaultVoicePreset = (): VoicePreset => {
  return VoicePresets['default'];
};

// 指定された音声設定の取得
export const getVoicePreset = (presetName: string): VoicePreset | null => {
  return VoicePresets[presetName] || null;
};

// 利用可能な音声プリセット一覧の取得
export const getAvailableVoicePresets = (): string[] => {
  return Object.keys(VoicePresets);
}; 