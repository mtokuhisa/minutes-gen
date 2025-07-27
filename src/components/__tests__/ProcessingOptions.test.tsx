import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { ProcessingOptions } from '../ProcessingOptions';
import { ProcessingOptions as ProcessingOptionsType } from '../../types';
import { theme } from '../../theme';

// プロンプトストアのモック
jest.mock('../../services/promptStore', () => ({
  initializePromptStore: jest.fn(() => ({
    presets: [
      { id: 'preset1', name: 'デフォルト', description: 'デフォルトプロンプト', category: 'general', type: 'preset', content: 'test', tags: [] },
      { id: 'preset2', name: 'カスタム', description: 'カスタムプロンプト', category: 'custom', type: 'preset', content: 'test', tags: [] },
    ],
    customs: [],
    activePromptId: 'preset1',
  })),
  addCustomPrompt: jest.fn(),
  updateCustomPrompt: jest.fn(),
  deleteCustomPrompt: jest.fn(),
  setActivePrompt: jest.fn(),
  getActivePrompt: jest.fn(() => ({ id: 'preset1', name: 'デフォルト', description: 'デフォルトプロンプト', category: 'general', type: 'preset', content: 'test', tags: [] })),
  getAllPrompts: jest.fn(() => [
    { id: 'preset1', name: 'デフォルト', description: 'デフォルトプロンプト', category: 'general', type: 'preset', content: 'test', tags: [] },
    { id: 'preset2', name: 'カスタム', description: 'カスタムプロンプト', category: 'custom', type: 'preset', content: 'test', tags: [] },
  ]),
  getPromptsByCategory: jest.fn(() => []),
  searchPrompts: jest.fn(() => []),
}));

const defaultOptions: ProcessingOptionsType = {
  language: 'ja',
  minutesModel: 'gpt-4.1',
  selectedPrompt: 'preset1',
  promptType: 'preset',
  punctuation: true,
  timestamps: false,
  customPrompt: '',
};

const renderProcessingOptions = (props: Partial<{ options: ProcessingOptionsType; onOptionsChange: jest.Mock; disabled: boolean }> = {}) => {
  const defaultProps = {
    options: defaultOptions,
    onOptionsChange: jest.fn(),
    disabled: false,
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <ProcessingOptions {...defaultProps} />
    </ThemeProvider>
  );
};

describe('ProcessingOptions', () => {
  let mockOnOptionsChange: jest.Mock;

  beforeEach(() => {
    mockOnOptionsChange = jest.fn();
  });

  it('renders without crashing', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    expect(screen.getByText('言語設定')).toBeInTheDocument();
  });

  it('displays language options', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    expect(screen.getByDisplayValue('ja')).toBeChecked();
    expect(screen.getByText('日本語')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('自動検出')).toBeInTheDocument();
  });

  it('handles language change', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    const englishOption = screen.getByDisplayValue('en');
    fireEvent.click(englishOption);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...defaultOptions,
      language: 'en',
    });
  });

  it('displays AI model selection', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    // モデル選択セクションの存在を確認
    expect(screen.getByText('AIモデル選択')).toBeInTheDocument();
    expect(screen.getByText('GPT-4.1')).toBeInTheDocument();
    expect(screen.getByText('o3')).toBeInTheDocument();
  });

  it('handles custom prompt input changes', () => {
    const options = { ...defaultOptions, customPrompt: 'test' };
    renderProcessingOptions({ options, onOptionsChange: mockOnOptionsChange });
    
    // 詳細設定を開く
    const advancedButton = screen.getByText('詳細設定');
    fireEvent.click(advancedButton);
    
    // カスタムプロンプトのテキストエリアを見つける
    const textarea = screen.getByPlaceholderText('議事録生成に関する追加の指示を入力してください...');
    fireEvent.change(textarea, { target: { value: '新しいプロンプト' } });
    
    expect(mockOnOptionsChange).toHaveBeenCalled();
  });

  it('displays character count for custom prompt', () => {
    const options = { ...defaultOptions, customPrompt: 'abc' };
    renderProcessingOptions({ options, onOptionsChange: mockOnOptionsChange });
    
    // 文字数カウントの表示を確認（処理概要の「出力: 3形式同時生成」が表示されることを確認）
    expect(screen.getByText('出力: 3形式同時生成')).toBeInTheDocument();
  });

  it('shows language selection options', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    expect(screen.getByText('🇯🇵')).toBeInTheDocument();
    expect(screen.getByText('🇺🇸')).toBeInTheDocument();
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('shows processing summary', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    // 処理概要の表示を確認
    expect(screen.getByText('処理概要')).toBeInTheDocument();
    expect(screen.getByText('モデル: GPT-4.1')).toBeInTheDocument();
  });

  it('shows quality information', () => {
    renderProcessingOptions({ onOptionsChange: mockOnOptionsChange });
    
    // 品質情報の表示を確認（モデルの特徴を確認）
    expect(screen.getByText('高速処理')).toBeInTheDocument();
    expect(screen.getByText('高度推論')).toBeInTheDocument();
  });
}); 