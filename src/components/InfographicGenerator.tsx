// ===========================================
// MinutesGen v1.0 - インフォグラフィック生成UI
// ===========================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  Grid,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Palette,
  Info,
  ViewModule,
  AttachFile,
  CloudDownload,
  Visibility,
  Image,
  PictureAsPdf,
  Delete,
  Add,
} from '@mui/icons-material';
import { 
  InfographicConfig, 
  InfographicOutput, 
  InfographicGenerationProgress,
  InfographicToneConfig 
} from '../types/infographic';
import { infographicGenerator } from '../services/infographicGenerator';
import { imageGenerator, ImageGenerationOptions } from '../utils/imageGenerator';
import { useTheme } from '../theme';

interface InfographicGeneratorProps {
  minutesContent: string;
  onGenerated?: (output: InfographicOutput) => void;
}

export const InfographicGenerator: React.FC<InfographicGeneratorProps> = ({
  minutesContent,
  onGenerated,
}) => {
  const { themeMode } = useTheme();
  
  // 設定状態
  const [config, setConfig] = useState<InfographicConfig>({
    tone: {
      type: 'theme',
      themeMode: themeMode,
    },
    informationLevel: 'medium',
    structure: 'scroll',
    additionalFiles: [],
    additionalText: '',
  });

  // UI状態
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<InfographicGenerationProgress | null>(null);
  const [output, setOutput] = useState<InfographicOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toneUrl, setToneUrl] = useState('');
  const [toneImageFile, setToneImageFile] = useState<File | null>(null);

  // テーマ変更時の同期
  useEffect(() => {
    if (config.tone.type === 'theme') {
      setConfig(prev => ({
        ...prev,
        tone: {
          ...prev.tone,
          themeMode: themeMode,
        },
      }));
    }
  }, [themeMode, config.tone.type]);

  // 進捗コールバック設定は不要（generateInfographicメソッドで直接onProgressを渡すため）
  // useEffect(() => {
  //   infographicGenerator.setProgressCallback(setProgress);
  // }, []);

  /**
   * トーン設定変更
   */
  const handleToneChange = (type: InfographicToneConfig['type']) => {
    setConfig(prev => ({
      ...prev,
      tone: {
        type,
        themeMode: type === 'theme' ? themeMode : undefined,
        source: type === 'url' ? toneUrl : undefined,
        imageFile: type === 'image' ? toneImageFile : undefined,
      },
    }));
  };

  /**
   * URL設定
   */
  const handleUrlSet = () => {
    if (toneUrl.trim()) {
      setConfig(prev => ({
        ...prev,
        tone: {
          type: 'url',
          source: toneUrl.trim(),
        },
      }));
    }
  };

  /**
   * 画像ファイル選択
   */
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setToneImageFile(file);
      setConfig(prev => ({
        ...prev,
        tone: {
          type: 'image',
          imageFile: file,
        },
      }));
    }
  };

  /**
   * 添付ファイル追加
   */
  const handleAddAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setConfig(prev => ({
      ...prev,
      additionalFiles: [...(prev.additionalFiles || []), ...files],
    }));
  };

  /**
   * 添付ファイル削除
   */
  const handleRemoveAttachment = (index: number) => {
    setConfig(prev => ({
      ...prev,
      additionalFiles: prev.additionalFiles?.filter((_, i) => i !== index) || [],
    }));
  };

  /**
   * インフォグラフィック生成
   */
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(null);

    try {
      const htmlResult = await infographicGenerator.generateInfographic(minutesContent, config, (progressValue: number) => {
        setProgress({
          stage: 'generating',
          percentage: progressValue,
          currentTask: progressValue < 30 ? 'トーン分析中...' : progressValue < 60 ? '情報量調整中...' : 'HTML生成中...',
          estimatedTimeRemaining: 30 - (progressValue / 100) * 30
        });
      });
      
      const result: InfographicOutput = {
        html: htmlResult,
        metadata: {
          pageCount: 1,
          dimensions: { width: 800, height: 1200 },
          generatedAt: new Date(),
          config: config
        }
      };
      
      setOutput(result);
      onGenerated?.(result);
    } catch (err) {
      console.error('インフォグラフィック生成エラー:', err);
      
      // エラーメッセージを詳細化
      let errorMessage = '生成に失敗しました。';
      
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          errorMessage = 'APIキーが設定されていません。設定画面で確認してください。';
        } else if (err.message.includes('URL分析')) {
          errorMessage = 'URL分析に失敗しました。URLを確認するか、別のトーン設定をお試しください。';
        } else if (err.message.includes('画像分析')) {
          errorMessage = '画像分析に失敗しました。画像ファイルを確認するか、別のトーン設定をお試しください。';
        } else if (err.message.includes('Network')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'APIキーが無効です。設定画面で正しいAPIキーを設定してください。';
        } else if (err.message.includes('429') || err.message.includes('Rate limit')) {
          errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください。';
        } else if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
          errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
        } else {
          errorMessage = `生成エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  /**
   * HTMLダウンロード
   */
  const handleDownloadHTML = () => {
    if (!output) return;

    const blob = new Blob([output.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infographic_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * PNGダウンロード
   */
  const handleDownloadPNG = async () => {
    if (!output) return;

    try {
      setError(null);
      
      if (config.structure === 'scroll') {
        // 単一画像として出力
        const imageOptions: ImageGenerationOptions = {
          width: 800,
          height: 1200,
          scale: 2,
          format: 'png',
          backgroundColor: config.tone.themeMode === 'dark' ? '#121212' : '#ffffff',
        };

        const image = await imageGenerator.convertHTMLToPNG(output.html, imageOptions);
        imageGenerator.downloadImage(image, `infographic_${new Date().toISOString().slice(0, 10)}.png`);
      } else {
        // 複数ページに分割して出力
        const images = await imageGenerator.convertMultiPageHTML(
          output.html,
          config.structure,
          {
            scale: 2,
            format: 'png',
            backgroundColor: config.tone.themeMode === 'dark' ? '#121212' : '#ffffff',
          }
        );

        // 複数画像をダウンロード
        await imageGenerator.downloadImagesAsZip(images, `infographic_${new Date().toISOString().slice(0, 10)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PNG出力に失敗しました。');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Palette />
        インフォグラフィック生成
      </Typography>

      <Grid container spacing={3}>
        {/* 設定パネル */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              {/* トーン設定 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Palette />
                  トーン設定
                </Typography>
                
                <FormControl component="fieldset">
                  <RadioGroup
                    value={config.tone.type}
                    onChange={(e) => handleToneChange(e.target.value as InfographicToneConfig['type'])}
                  >
                    <FormControlLabel
                      value="theme"
                      control={<Radio />}
                      label={`アプリテーマ（${themeMode === 'light' ? 'ライト' : themeMode === 'dark' ? 'ダーク' : 'カラー'}）`}
                    />
                    <FormControlLabel
                      value="url"
                      control={<Radio />}
                      label="URL指定"
                    />
                    <FormControlLabel
                      value="image"
                      control={<Radio />}
                      label="画像添付"
                    />
                  </RadioGroup>
                </FormControl>

                {config.tone.type === 'url' && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="https://example.com"
                      value={toneUrl}
                      onChange={(e) => setToneUrl(e.target.value)}
                    />
                    <Button variant="outlined" onClick={handleUrlSet}>
                      取得
                    </Button>
                  </Box>
                )}

                {config.tone.type === 'image' && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<Image />}
                    >
                      画像を選択
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleImageFileChange}
                      />
                    </Button>
                    {toneImageFile && (
                      <Chip
                        label={toneImageFile.name}
                        onDelete={() => {
                          setToneImageFile(null);
                          setConfig(prev => ({
                            ...prev,
                            tone: {
                              type: 'theme',
                              themeMode: themeMode,
                            },
                          }));
                        }}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 情報量設定 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info />
                  情報量設定
                </Typography>
                
                <FormControl component="fieldset">
                  <RadioGroup
                    value={config.informationLevel}
                    onChange={(e) => setConfig(prev => ({ ...prev, informationLevel: e.target.value as any }))}
                  >
                    <FormControlLabel
                      value="large"
                      control={<Radio />}
                      label="大（議事録そのまま）"
                    />
                    <FormControlLabel
                      value="medium"
                      control={<Radio />}
                      label="中（中間レベル）"
                    />
                    <FormControlLabel
                      value="small"
                      control={<Radio />}
                      label="小（20行・一画面）"
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 構造設定 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ViewModule />
                  構造設定
                </Typography>
                
                <FormControl component="fieldset">
                  <RadioGroup
                    value={config.structure}
                    onChange={(e) => setConfig(prev => ({ ...prev, structure: e.target.value as any }))}
                  >
                    <FormControlLabel
                      value="scroll"
                      control={<Radio />}
                      label="スクロール（縦長）"
                    />
                    <FormControlLabel
                      value="horizontal"
                      control={<Radio />}
                      label="ページ分割横（16:9）"
                    />
                    <FormControlLabel
                      value="vertical"
                      control={<Radio />}
                      label="ページ分割縦（2:3）"
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* オプション設定 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachFile />
                  オプション（ファイル追加した場合は、そのファイル内容でインフォグラフィックを生成します）
                </Typography>
                
                {/* 対応ファイル形式の説明 */}
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>対応ファイル形式:</strong><br />
                    • テキストファイル (.txt)
                  </Typography>
                </Alert>
                
                {/* 添付ファイル */}
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<Add />}
                    size="small"
                  >
                    ファイル追加
                    <input
                      type="file"
                      hidden
                      multiple
                      accept=".txt"
                      onChange={handleAddAttachment}
                    />
                  </Button>
                  
                  {config.additionalFiles && config.additionalFiles.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {config.additionalFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          onDelete={() => handleRemoveAttachment(index)}
                          sx={{ mr: 1, mb: 1 }}
                          icon={
                            file.type.includes('pdf') ? <PictureAsPdf /> : 
                            file.type.includes('image') ? <Image /> : 
                            <AttachFile />
                          }
                        />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* 追加テキスト */}
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="追加で含めたい情報があれば入力してください..."
                  value={config.additionalText}
                  onChange={(e) => setConfig(prev => ({ ...prev, additionalText: e.target.value }))}
                />
              </Box>

              {/* 生成ボタン */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={isGenerating || !minutesContent.trim()}
                  sx={{ flex: 1 }}
                >
                  {isGenerating ? '生成中...' : 'プレビュー生成'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 結果パネル */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                生成結果
              </Typography>

              {/* 進捗表示 */}
              {progress && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {progress.currentTask}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress.percentage || 0} 
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {progress.percentage || 0}%
                  </Typography>
                </Box>
              )}

              {/* エラー表示 */}
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* 結果表示 */}
              {output && (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    インフォグラフィックが生成されました！
                  </Alert>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<Visibility />}
                      onClick={() => setPreviewOpen(true)}
                    >
                      プレビュー
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CloudDownload />}
                      onClick={handleDownloadHTML}
                    >
                      HTML出力
                    </Button>
                  </Box>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    生成日時: {output.metadata.generatedAt.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* プレビューダイアログ */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>インフォグラフィック プレビュー</DialogTitle>
        <DialogContent>
          {output && (
            <iframe
              srcDoc={output.html}
              style={{
                width: '100%',
                height: '600px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 