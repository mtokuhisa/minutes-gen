import React, { useState, useCallback } from 'react';
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
  FormGroup,
  Checkbox,
  TextField,
  Chip,
  Slider,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
  IconButton,
  Divider,
  Grid,
} from '@mui/material';
import {
  Speed,
  HighQuality,
  Language,
  Description,
  People,
  Schedule,
  Settings,
  ExpandMore,
  Info,
  AutoAwesome,
  CloudQueue,
  Diamond,
  Rocket,
} from '@mui/icons-material';
import {
  ProcessingOptions as ProcessingOptionsType,
  ProcessingSpeed,
  ProcessingQuality,
  OutputFormat,
  SupportedLanguage,
} from '../types';

// ===========================================
// MinutesGen v1.0 - 処理オプション設定
// ===========================================

interface ProcessingOptionsProps {
  options: ProcessingOptionsType;
  onOptionsChange: (options: ProcessingOptionsType) => void;
  disabled?: boolean;
}

const speedOptions = [
  {
    value: 'fast' as ProcessingSpeed,
    label: '高速',
    description: '速度優先、基本的な品質',
    icon: <Rocket />,
    color: '#ff9800',
    estimatedTime: '2-5分',
  },
  {
    value: 'normal' as ProcessingSpeed,
    label: '標準',
    description: 'バランスの取れた処理',
    icon: <CloudQueue />,
    color: '#2196f3',
    estimatedTime: '5-10分',
  },
  {
    value: 'high-quality' as ProcessingSpeed,
    label: '高品質',
    description: '品質優先、詳細な解析',
    icon: <Diamond />,
    color: '#9c27b0',
    estimatedTime: '10-20分',
  },
];

const qualityOptions = [
  {
    value: 'draft' as ProcessingQuality,
    label: 'ドラフト',
    description: '基本的な文字起こし',
    features: ['基本的な文字起こし', '発話者識別なし', '簡単な整形'],
  },
  {
    value: 'standard' as ProcessingQuality,
    label: '標準',
    description: '一般的な議事録品質',
    features: ['高精度な文字起こし', '発話者識別', '要点抽出', '基本的な整形'],
  },
  {
    value: 'premium' as ProcessingQuality,
    label: 'プレミアム',
    description: '最高品質の議事録',
    features: ['最高精度の文字起こし', '詳細な発話者識別', '要点・アクション抽出', '高品質な整形', '感情分析'],
  },
];

const outputFormatOptions = [
  {
    value: 'markdown' as OutputFormat,
    label: 'Markdown',
    description: '軽量でシンプル',
    icon: '📝',
    extension: '.md',
    features: ['軽量', 'GitHub対応', 'プレーンテキスト'],
  },
  {
    value: 'word' as OutputFormat,
    label: 'Word',
    description: 'ビジネス向け',
    icon: '📄',
    extension: '.docx',
    features: ['ビジネス向け', '高い互換性', '印刷対応'],
  },
  {
    value: 'html' as OutputFormat,
    label: 'HTML',
    description: 'Web表示対応',
    icon: '🌐',
    extension: '.html',
    features: ['Web表示', 'リンク対応', 'インタラクティブ'],
  },
  {
    value: 'pdf' as OutputFormat,
    label: 'PDF',
    description: '印刷・配布向け',
    icon: '📋',
    extension: '.pdf',
    features: ['印刷対応', '配布向け', '固定レイアウト'],
  },
];

const languageOptions = [
  { value: 'ja' as SupportedLanguage, label: '日本語', flag: '🇯🇵' },
  { value: 'en' as SupportedLanguage, label: 'English', flag: '🇺🇸' },
  { value: 'auto' as SupportedLanguage, label: '自動検出', flag: '🤖' },
];

export const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  options,
  onOptionsChange,
  disabled = false,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSpeedChange = useCallback((speed: ProcessingSpeed) => {
    onOptionsChange({ ...options, speed });
  }, [options, onOptionsChange]);

  const handleQualityChange = useCallback((quality: ProcessingQuality) => {
    onOptionsChange({ ...options, quality });
  }, [options, onOptionsChange]);

  const handleOutputFormatChange = useCallback((format: OutputFormat, checked: boolean) => {
    const newFormats = checked
      ? [...options.outputFormats, format]
      : options.outputFormats.filter(f => f !== format);
    onOptionsChange({ ...options, outputFormats: newFormats });
  }, [options, onOptionsChange]);

  const handleLanguageChange = useCallback((language: SupportedLanguage) => {
    onOptionsChange({ ...options, language });
  }, [options, onOptionsChange]);

  const handleSwitchChange = useCallback((field: keyof ProcessingOptionsType, value: boolean) => {
    onOptionsChange({ ...options, [field]: value });
  }, [options, onOptionsChange]);

  const handleCustomPromptChange = useCallback((customPrompt: string) => {
    onOptionsChange({ ...options, customPrompt });
  }, [options, onOptionsChange]);

  const getEstimatedCost = () => {
    const baseCost = options.quality === 'draft' ? 100 : options.quality === 'standard' ? 200 : 400;
    const speedMultiplier = options.speed === 'fast' ? 0.8 : options.speed === 'normal' ? 1.0 : 1.5;
    const formatMultiplier = options.outputFormats.length * 0.1 + 0.9;
    return Math.round(baseCost * speedMultiplier * formatMultiplier);
  };

  const getEstimatedTime = () => {
    const selectedSpeed = speedOptions.find(s => s.value === options.speed);
    return selectedSpeed?.estimatedTime || '5-10分';
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* 処理速度設定 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Speed sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              処理速度
            </Typography>
            <Tooltip title="処理速度は品質と時間のバランスを決定します">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            {speedOptions.map((speed) => (
              <Grid item xs={12} md={4} key={speed.value}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: options.speed === speed.value ? 'primary.main' : 'grey.200',
                    backgroundColor: options.speed === speed.value ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(76, 175, 80, 0.03)',
                    },
                  }}
                  onClick={() => !disabled && handleSpeedChange(speed.value)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Box sx={{ color: speed.color, mb: 1 }}>
                      {speed.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {speed.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {speed.description}
                    </Typography>
                    <Chip
                      label={speed.estimatedTime}
                      size="small"
                      sx={{
                        backgroundColor: options.speed === speed.value ? 'primary.main' : 'grey.200',
                        color: options.speed === speed.value ? 'white' : 'text.secondary',
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* 品質設定 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <HighQuality sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              品質設定
            </Typography>
          </Box>

          <FormControl component="fieldset">
            <RadioGroup
              value={options.quality}
              onChange={(e) => handleQualityChange(e.target.value as ProcessingQuality)}
            >
              {qualityOptions.map((quality) => (
                <Box key={quality.value} sx={{ mb: 2 }}>
                  <FormControlLabel
                    value={quality.value}
                    control={<Radio disabled={disabled} />}
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {quality.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {quality.description}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ ml: 4, mt: 1 }}>
                    {quality.features.map((feature, index) => (
                      <Chip
                        key={index}
                        label={feature}
                        size="small"
                        sx={{
                          mr: 1,
                          mb: 0.5,
                          backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          fontSize: '0.7rem',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </RadioGroup>
          </FormControl>
        </CardContent>
      </Card>

      {/* 出力形式設定 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Description sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              出力形式
            </Typography>
          </Box>

          <FormGroup>
            <Grid container spacing={2}>
              {outputFormatOptions.map((format) => (
                <Grid item xs={12} md={6} key={format.value}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.outputFormats.includes(format.value)}
                        onChange={(e) => handleOutputFormatChange(format.value, e.target.checked)}
                        disabled={disabled}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography sx={{ mr: 1, fontSize: '1.2rem' }}>
                          {format.icon}
                        </Typography>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {format.label} ({format.extension})
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {format.description}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            {format.features.map((feature, index) => (
                              <Chip
                                key={index}
                                label={feature}
                                size="small"
                                sx={{
                                  mr: 0.5,
                                  fontSize: '0.6rem',
                                  height: 20,
                                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        </CardContent>
      </Card>

      {/* 言語設定 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Language sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              言語設定
            </Typography>
          </Box>

          <FormControl component="fieldset">
            <RadioGroup
              row
              value={options.language}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            >
              {languageOptions.map((lang) => (
                <FormControlLabel
                  key={lang.value}
                  value={lang.value}
                  control={<Radio disabled={disabled} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ mr: 1, fontSize: '1.2rem' }}>
                        {lang.flag}
                      </Typography>
                      <Typography>{lang.label}</Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        </CardContent>
      </Card>

      {/* 詳細設定 */}
      <Accordion expanded={advancedOpen} onChange={() => setAdvancedOpen(!advancedOpen)}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Settings sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              詳細設定
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 発話者識別 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    発話者識別
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    誰が話しているかを識別します
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={options.speakerDetection}
                onChange={(e) => handleSwitchChange('speakerDetection', e.target.checked)}
                disabled={disabled}
              />
            </Box>

            {/* 句読点自動挿入 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AutoAwesome sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    句読点自動挿入
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    文章の読みやすさを向上させます
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={options.punctuation}
                onChange={(e) => handleSwitchChange('punctuation', e.target.checked)}
                disabled={disabled}
              />
            </Box>

            {/* タイムスタンプ */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    タイムスタンプ
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    発言の時間を記録します
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={options.timestamps}
                onChange={(e) => handleSwitchChange('timestamps', e.target.checked)}
                disabled={disabled}
              />
            </Box>

            {/* カスタムプロンプト */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                カスタムプロンプト
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="議事録生成に関する追加の指示を入力してください..."
                value={options.customPrompt || ''}
                onChange={(e) => handleCustomPromptChange(e.target.value)}
                disabled={disabled}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 処理概要 */}
      <Card sx={{ mt: 3, background: 'linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%)' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            処理概要
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Chip
              label={`速度: ${speedOptions.find(s => s.value === options.speed)?.label}`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
            <Chip
              label={`品質: ${qualityOptions.find(q => q.value === options.quality)?.label}`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
            <Chip
              label={`出力: ${options.outputFormats.length}形式`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
            <Chip
              label={`予想時間: ${getEstimatedTime()}`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}; 