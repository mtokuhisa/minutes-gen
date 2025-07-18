// ===========================================
// MinutesGen v0.7.5 - WebCodecs Audio Processor
// ffmpeg.wasm が利用できない環境向けブラウザのみ分割
// 依存ライブラリなし（AudioContext + 手作り WAV エンコード）
// ===========================================

import { AudioSegment } from './audioProcessor';

/**
 * AudioBuffer を PCM(WAV) Blob に変換
 */
function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  // PCM 書き込み
  const interleaved = new Float32Array(numFrames * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    buffer.copyFromChannel(interleaved.subarray(ch, interleaved.length), ch, 0);
  }
  // Interleave
  const pcm = new DataView(arrayBuffer, offset);
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      pcm.setInt16((i * numChannels + ch) * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export class WebCodecsProcessor {
  /**
   * 音声ファイルを指定秒数ごとに分割し WAV Blob を返す
   */
  static async splitAudioFile(file: File, segmentSec = 600): Promise<AudioSegment[]> {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const totalDuration = audioBuffer.duration;
    const segments: AudioSegment[] = [];

    const totalSegments = Math.ceil(totalDuration / segmentSec);
    for (let i = 0; i < totalSegments; i++) {
      const start = i * segmentSec;
      const end = Math.min((i + 1) * segmentSec, totalDuration);
      const frameStart = Math.floor(start * audioBuffer.sampleRate);
      const frameCount = Math.floor((end - start) * audioBuffer.sampleRate);

      const segmentBuffer = audioCtx.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        audioBuffer.sampleRate
      );
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch).subarray(frameStart, frameStart + frameCount);
        segmentBuffer.copyToChannel(channelData, ch, 0);
      }

      const wavBlob = encodeWav(segmentBuffer);
      segments.push({
        blob: wavBlob,
        name: `${file.name.replace(/\.[^.]+$/, '')}_segment${i + 1}.wav`,
        duration: end - start,
        startTime: start,
        endTime: end,
      });
    }

    audioCtx.close();
    return segments;
  }
} 