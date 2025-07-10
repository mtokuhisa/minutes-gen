import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Chip,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Grid,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  Speed,
  Language,
  Schedule,
  Settings,
  ExpandMore,
  Info,
  AutoAwesome,
  CloudQueue,
  Diamond,
  Rocket,
  Psychology,
  Add,
  Edit,
  Delete,
  Save,
  Search,
  Category,
  Cancel,
  Label,
} from '@mui/icons-material';
import {
  ProcessingOptions as ProcessingOptionsType,
  ProcessingSpeed,
  SupportedLanguage,
} from '../types';
import {
  PromptTemplate,
  PromptStore,
  PromptCategory,
  initializePromptStore,
  addCustomPrompt,
  updateCustomPrompt,
  deleteCustomPrompt,
  setActivePrompt,
  getActivePrompt,
  getAllPrompts,
  getPromptsByCategory,
  searchPrompts,
} from '../services/promptStore';

// ===========================================
// MinutesGen v1.0 - 処理オプション設定
// ===========================================

interface ProcessingOptionsProps {
  options: ProcessingOptionsType;
  onOptionsChange: (options: ProcessingOptionsType) => void;
  disabled?: boolean;
}

// 速度設定は1倍速固定（精度最優先）
const speedOptions = [
  {
    value: 'normal' as ProcessingSpeed,
    label: '標準 (1倍速)',
    description: '最高精度を実現するため1倍速固定',
    icon: <CloudQueue />,
    color: '#4caf50',
    estimatedTime: '5-10分',
  },
];



const languageOptions = [
  { value: 'ja' as SupportedLanguage, label: '日本語', flag: '🇯🇵' },
  { value: 'en' as SupportedLanguage, label: 'English', flag: '🇺🇸' },
  { value: 'auto' as SupportedLanguage, label: '自動検出', flag: '🤖' },
];

// モデル選択オプション
const modelOptions = [
  {
    value: 'gpt-4.1',
    label: 'GPT-4.1',
    description: '文字起こしから丁寧要約',
    icon: <AutoAwesome />,
    color: '#4caf50',
    features: ['高速処理', 'コスト効率'],
  },
  {
    value: 'o3',
    label: 'o3',
    description: '複雑議論を解析する洞察力',
    icon: <Psychology />,
    color: '#9c27b0',
    features: ['高度推論', '高性能'],
  },
];

// プロンプトカテゴリ表示名
const categoryLabels: Record<PromptCategory, string> = {
  general: '一般',
  meeting: '会議',
  interview: 'インタビュー',
  presentation: 'プレゼン',
  brainstorm: 'ブレスト',
  custom: 'カスタム',
};

// タブパネルコンポーネント
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ width: '100%' }}>
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

export const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  options,
  onOptionsChange,
  disabled = false,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [promptStore, setPromptStore] = useState<PromptStore>(initializePromptStore());
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptTab, setPromptTab] = useState(0);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    content: '',
    category: 'custom' as PromptCategory,
    tags: [] as string[],
  });
  const [searchQuery, setSearchQuery] = useState('');

  // プロンプトストアの初期化
  useEffect(() => {
    const store = initializePromptStore();
    setPromptStore(store);
    
    // アクティブプロンプトが設定されていない場合は最初のプリセットを設定
    if (!options.selectedPrompt) {
      const activePrompt = getActivePrompt(store);
      if (activePrompt) {
        onOptionsChange({
          ...options,
          selectedPrompt: activePrompt.id,
          promptType: activePrompt.type,
        });
      }
    }
  }, []);

  // 速度設定は1倍速固定のため削除



  const handleLanguageChange = useCallback((language: SupportedLanguage) => {
    onOptionsChange({ ...options, language });
  }, [options, onOptionsChange]);

  const handleSwitchChange = useCallback((field: keyof ProcessingOptionsType, value: boolean) => {
    onOptionsChange({ ...options, [field]: value });
  }, [options, onOptionsChange]);

  const handleCustomPromptChange = useCallback((customPrompt: string) => {
    onOptionsChange({ ...options, customPrompt });
  }, [options, onOptionsChange]);

  // 新しいハンドラー関数
  const handleModelChange = useCallback((minutesModel: 'gpt-4.1' | 'o3') => {
    onOptionsChange({ ...options, minutesModel });
  }, [options, onOptionsChange]);

  const handlePromptSelect = useCallback((promptId: string, type: 'preset' | 'custom') => {
    const newStore = setActivePrompt(promptStore, promptId, type);
    setPromptStore(newStore);
    onOptionsChange({
      ...options,
      selectedPrompt: promptId,
      promptType: type,
    });
  }, [options, onOptionsChange, promptStore]);

  const handleAddCustomPrompt = useCallback(() => {
    if (newPrompt.name && newPrompt.content) {
      const newStore = addCustomPrompt(promptStore, {
        ...newPrompt,
        isActive: true,
      });
      setPromptStore(newStore);
      setNewPrompt({
        name: '',
        description: '',
        content: '',
        category: 'custom',
        tags: [],
      });
      setPromptDialogOpen(false);
    }
  }, [promptStore, newPrompt]);

  const handleEditPrompt = useCallback((prompt: PromptTemplate) => {
    setEditingPrompt(prompt);
    setNewPrompt({
      name: prompt.name,
      description: prompt.description,
      content: prompt.content,
      category: prompt.category,
      tags: prompt.tags,
    });
    setPromptDialogOpen(true);
  }, []);

  const handleUpdatePrompt = useCallback(() => {
    if (editingPrompt && newPrompt.name && newPrompt.content) {
      const newStore = updateCustomPrompt(promptStore, editingPrompt.id, {
        ...newPrompt,
        updatedAt: new Date(),
      });
      setPromptStore(newStore);
      setEditingPrompt(null);
      setNewPrompt({
        name: '',
        description: '',
        content: '',
        category: 'custom',
        tags: [],
      });
      setPromptDialogOpen(false);
    }
  }, [promptStore, editingPrompt, newPrompt]);

  const handleDeletePrompt = useCallback((promptId: string) => {
    const newStore = deleteCustomPrompt(promptStore, promptId);
    setPromptStore(newStore);
    if (options.selectedPrompt === promptId) {
      // 削除されたプロンプトが選択されていた場合、最初のプリセットに戻す
      const activePrompt = getActivePrompt(newStore);
      if (activePrompt) {
        onOptionsChange({
          ...options,
          selectedPrompt: activePrompt.id,
          promptType: activePrompt.type,
        });
      }
    }
  }, [promptStore, options, onOptionsChange]);

  const getEstimatedCost = () => {
    // 1倍速固定、3形式同時生成のため簡素化
    return 200; // 標準コスト
  };

  const getEstimatedTime = () => {
    return '5-10分'; // 1倍速固定
  };

  return (
    <Box sx={{ width: '100%' }}>
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

      {/* モデル選択 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Psychology sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AIモデル選択
            </Typography>
            <Tooltip title="議事録生成に使用するAIモデルを選択します">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            {modelOptions.map((model) => (
              <Grid item xs={12} md={6} key={model.value}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: options.minutesModel === model.value ? 'primary.main' : 'grey.200',
                    backgroundColor: options.minutesModel === model.value ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(76, 175, 80, 0.03)',
                    },
                  }}
                  onClick={() => !disabled && handleModelChange(model.value)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Box sx={{ color: model.color, mb: 1 }}>
                      {model.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {model.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {model.description}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                      {model.features.map((feature, index) => (
                        <Chip
                          key={index}
                          label={feature}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                            backgroundColor: options.minutesModel === model.value ? 'primary.main' : 'grey.200',
                            color: options.minutesModel === model.value ? 'white' : 'text.secondary',
                          }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* プロンプト管理 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AutoAwesome sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                プロンプト管理
              </Typography>
              <Tooltip title="議事録生成に使用するプロンプトを管理します">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Settings />}
              onClick={() => setPromptDialogOpen(true)}
              disabled={disabled}
            >
              プロンプト設定
            </Button>
          </Box>

          {/* アクティブプロンプト表示 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              現在のプロンプト:
            </Typography>
            {options.selectedPrompt ? (
              <Box>
                {(() => {
                  const selectedPrompt = getAllPrompts(promptStore).find(p => p.id === options.selectedPrompt);
                  return selectedPrompt ? (
                    <Card sx={{ p: 2, backgroundColor: 'rgba(76, 175, 80, 0.05)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {selectedPrompt.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip
                            label={categoryLabels[selectedPrompt.category]}
                            size="small"
                            sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
                          />
                          <Chip
                            label={selectedPrompt.type === 'preset' ? 'プリセット' : 'カスタム'}
                            size="small"
                            color={selectedPrompt.type === 'preset' ? 'primary' : 'secondary'}
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        {selectedPrompt.description}
                      </Typography>
                      {selectedPrompt.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selectedPrompt.tags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                height: 18,
                                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Card>
                  ) : (
                    <Alert severity="warning">選択されたプロンプトが見つかりません</Alert>
                  );
                })()}
              </Box>
            ) : (
              <Alert severity="info">プロンプトが選択されていません</Alert>
            )}
          </Box>

          {/* クイック選択 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              クイック選択:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {getAllPrompts(promptStore).filter(p => p.type === 'preset').slice(0, 3).map((prompt) => (
                <Button
                  key={prompt.id}
                  variant={options.selectedPrompt === prompt.id ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handlePromptSelect(prompt.id, 'preset')}
                  disabled={disabled}
                  sx={{ minWidth: 'auto' }}
                >
                  {prompt.name}
                </Button>
              ))}
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setPromptDialogOpen(true)}
                disabled={disabled}
              >
                カスタム
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* プロンプト管理ダイアログ */}
      <Dialog
        open={promptDialogOpen}
        onClose={() => setPromptDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">プロンプト管理</Typography>
            <IconButton onClick={() => setPromptDialogOpen(false)}>
              <Cancel />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={promptTab} onChange={(e, newValue) => setPromptTab(newValue)}>
              <Tab label="プリセット" />
              <Tab label="カスタム" />
              <Tab label="新規作成" />
            </Tabs>
          </Box>

          {/* プリセットタブ */}
          <TabPanel value={promptTab} index={0}>
            <List>
              {getAllPrompts(promptStore).filter(p => p.type === 'preset').map((prompt) => (
                <ListItem key={prompt.id}>
                  <ListItemIcon>
                    <Label color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={prompt.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {prompt.description}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                          <Chip
                            label={categoryLabels[prompt.category]}
                            size="small"
                            sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
                          />
                          {prompt.tags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                height: 18,
                                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant={options.selectedPrompt === prompt.id ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => handlePromptSelect(prompt.id, 'preset')}
                    >
                      {options.selectedPrompt === prompt.id ? '選択中' : '選択'}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* カスタムタブ */}
          <TabPanel value={promptTab} index={1}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="プロンプトを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Box>
            <List>
              {getAllPrompts(promptStore)
                .filter(p => p.type === 'custom')
                .filter(p => searchQuery === '' || 
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((prompt) => (
                <ListItem key={prompt.id}>
                  <ListItemIcon>
                    <Category color="secondary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={prompt.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {prompt.description}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                          <Chip
                            label={categoryLabels[prompt.category]}
                            size="small"
                            sx={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}
                          />
                          {prompt.tags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                height: 18,
                                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant={options.selectedPrompt === prompt.id ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handlePromptSelect(prompt.id, 'custom')}
                      >
                        {options.selectedPrompt === prompt.id ? '選択中' : '選択'}
                      </Button>
                      <IconButton size="small" onClick={() => handleEditPrompt(prompt)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeletePrompt(prompt.id)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* 新規作成タブ */}
          <TabPanel value={promptTab} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="プロンプト名"
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="説明"
                value={newPrompt.description}
                onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={newPrompt.category}
                  label="カテゴリ"
                  onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value as PromptCategory })}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="プロンプト内容"
                value={newPrompt.content}
                onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                multiline
                rows={8}
                required
                placeholder="議事録生成のためのプロンプトを入力してください..."
              />
              <TextField
                fullWidth
                label="タグ（カンマ区切り）"
                value={newPrompt.tags.join(', ')}
                onChange={(e) => setNewPrompt({ 
                  ...newPrompt, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                })}
                placeholder="例: 会議, 要約, 詳細"
              />
            </Box>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptDialogOpen(false)}>
            キャンセル
          </Button>
          {promptTab === 2 && (
            <Button
              variant="contained"
              onClick={editingPrompt ? handleUpdatePrompt : handleAddCustomPrompt}
              disabled={!newPrompt.name || !newPrompt.content}
              startIcon={editingPrompt ? <Save /> : <Add />}
            >
              {editingPrompt ? '更新' : '作成'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
              label={`モデル: ${modelOptions.find(m => m.value === options.minutesModel)?.label}`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
            <Chip
              label={`出力: 3形式同時生成`}
              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)' }}
            />
            <Chip
              label={`プロンプト: ${options.selectedPrompt ? getAllPrompts(promptStore).find(p => p.id === options.selectedPrompt)?.name || '不明' : '未選択'}`}
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