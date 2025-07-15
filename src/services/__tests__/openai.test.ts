import { OpenAIService } from '../openai';
import { APIConfig } from '../../config/api';
import { ProcessingOptions } from '../../types';

// fetchのモック
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// authServiceのモック
jest.mock('../authService', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    isAuthenticated: jest.fn(() => true),
    getAPIConfig: jest.fn(() => Promise.resolve({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    })),
  })),
}));

describe('OpenAIService', () => {
  let service: OpenAIService;
  const mockConfig: APIConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    whisperModel: 'whisper-1',
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 30000,
    retryAttempts: 3,
  };

  beforeEach(() => {
    service = new OpenAIService();
    mockFetch.mockClear();
  });

  describe('transcribeAudio', () => {
    it('successfully transcribes audio', async () => {
      const mockResponse = {
        text: 'これはテストの音声です。',
        duration: 10.5,
        language: 'ja',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      const result = await service.transcribeAudio(audioBuffer, mockConfig);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/audio/transcriptions`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockConfig.apiKey}`,
          },
        })
      );
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid audio format' } }),
      } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      
      await expect(service.transcribeAudio(audioBuffer, mockConfig))
        .rejects
        .toThrow('Invalid audio format');
    });

    it('retries on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ text: 'Success on third attempt' }),
        } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      const result = await service.transcribeAudio(audioBuffer, mockConfig);

      expect(result.text).toBe('Success on third attempt');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('fails after maximum retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const audioBuffer = new ArrayBuffer(1024);
      
      await expect(service.transcribeAudio(audioBuffer, mockConfig))
        .rejects
        .toThrow('Persistent network error');
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateMinutes', () => {
    it('successfully generates minutes', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '## 会議議事録\n\n### 参加者\n- 田中さん\n- 佐藤さん\n\n### 議題\n1. プロジェクトの進捗について\n2. 次回のスケジュール',
          },
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const transcript = 'これは会議の音声文字起こしです。';
      const prompt = '以下の文字起こしから議事録を作成してください。';
      
      const result = await service.generateMinutes(transcript, prompt, mockConfig);

      expect(result.content).toBe(mockResponse.choices[0].message.content);
      expect(result.usage).toEqual(mockResponse.usage);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('handles token limit exceeded error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          error: { 
            message: 'This model\'s maximum context length is 4096 tokens',
            type: 'invalid_request_error',
          } 
        }),
      } as Response);

      const transcript = 'Very long transcript...'.repeat(1000);
      const prompt = 'Generate minutes';
      
      await expect(service.generateMinutes(transcript, prompt, mockConfig))
        .rejects
        .toThrow('maximum context length');
    });

    it('handles rate limit errors with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success after rate limit' } }],
          }),
        } as Response);

      const transcript = 'Test transcript';
      const prompt = 'Generate minutes';
      
      const result = await service.generateMinutes(transcript, prompt, mockConfig);
      
      expect(result.content).toBe('Success after rate limit');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateSpeech', () => {
    it('successfully generates speech', async () => {
      const mockAudioBuffer = new ArrayBuffer(2048);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockAudioBuffer,
      } as Response);

      const text = 'これは音声合成のテストです。';
      const voice = 'alloy';
      
      const result = await service.generateSpeech(text, voice, mockConfig);

      expect(result).toBe(mockAudioBuffer);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/audio/speech`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('handles text too long error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          error: { message: 'Text is too long' } 
        }),
      } as Response);

      const longText = 'Very long text...'.repeat(1000);
      const voice = 'alloy';
      
      await expect(service.generateSpeech(longText, voice, mockConfig))
        .rejects
        .toThrow('Text is too long');
    });
  });

  describe('testConnection', () => {
    it('successfully tests connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4o-mini' }] }),
      } as Response);

      const result = await service.testConnection(mockConfig);

      expect(result.success).toBe(true);
      expect(result.message).toContain('接続成功');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/models`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockConfig.apiKey}`,
          },
        })
      );
    });

    it('handles invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ 
          error: { message: 'Invalid API key' } 
        }),
      } as Response);

      const result = await service.testConnection(mockConfig);

      expect(result.success).toBe(false);
      expect(result.message).toContain('API key');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.testConnection(mockConfig);

      expect(result.success).toBe(false);
      expect(result.message).toContain('ネットワークエラー');
    });
  });

  describe('error handling', () => {
    it('handles timeout errors', async () => {
      const timeoutConfig = { ...mockConfig, timeout: 1000 };
      
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const audioBuffer = new ArrayBuffer(1024);
      
      await expect(service.transcribeAudio(audioBuffer, timeoutConfig))
        .rejects
        .toThrow('timeout');
    });

    it('handles malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      
      await expect(service.transcribeAudio(audioBuffer, mockConfig))
        .rejects
        .toThrow('Invalid JSON');
    });

    it('handles empty responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      
      await expect(service.transcribeAudio(audioBuffer, mockConfig))
        .rejects
        .toThrow();
    });
  });

  describe('request formatting', () => {
    it('formats transcription request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'test' }),
      } as Response);

      const audioBuffer = new ArrayBuffer(1024);
      await service.transcribeAudio(audioBuffer, mockConfig);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${mockConfig.baseUrl}/audio/transcriptions`);
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Authorization': `Bearer ${mockConfig.apiKey}`,
      });
      expect(options.body).toBeInstanceOf(FormData);
    });

    it('formats chat completion request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test' } }] }),
      } as Response);

      await service.generateMinutes('transcript', 'prompt', mockConfig);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${mockConfig.baseUrl}/chat/completions`);
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Authorization': `Bearer ${mockConfig.apiKey}`,
        'Content-Type': 'application/json',
      });
      
      const body = JSON.parse(options.body);
      expect(body.model).toBe(mockConfig.model);
      expect(body.max_tokens).toBe(mockConfig.maxTokens);
      expect(body.temperature).toBe(mockConfig.temperature);
    });
  });
}); 