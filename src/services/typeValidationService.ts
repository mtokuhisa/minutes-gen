/**
 * 型検証サービス
 * TypeScript型安全性向上のためのランタイム型検証
 */

import { ProcessingOptions, AudioFile, ProcessingProgress, AppError } from '../types';

// 型検証結果
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  data?: T;
  errors: string[];
}

// 型ガード関数
export class TypeValidationService {
  /**
   * 文字列型の検証
   */
  public static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * 数値型の検証
   */
  public static isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * ブール型の検証
   */
  public static isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  /**
   * 配列型の検証
   */
  public static isArray<T>(value: unknown, itemValidator?: (item: unknown) => item is T): value is T[] {
    if (!Array.isArray(value)) return false;
    if (!itemValidator) return true;
    return value.every(itemValidator);
  }

  /**
   * オブジェクト型の検証
   */
  public static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 日付型の検証
   */
  public static isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }

  /**
   * AudioFile型の検証
   */
  public static validateAudioFile(value: unknown): ValidationResult<AudioFile> {
    const errors: string[] = [];

    if (!this.isObject(value)) {
      errors.push('AudioFileはオブジェクトである必要があります');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    // 必須フィールドの検証
    if (!this.isString(obj.id)) {
      errors.push('AudioFile.idは文字列である必要があります');
    }

    if (!this.isString(obj.name)) {
      errors.push('AudioFile.nameは文字列である必要があります');
    }

    if (!this.isNumber(obj.size) || obj.size < 0) {
      errors.push('AudioFile.sizeは0以上の数値である必要があります');
    }

    if (!this.isNumber(obj.duration) || obj.duration < 0) {
      errors.push('AudioFile.durationは0以上の数値である必要があります');
    }

    if (!this.isString(obj.format)) {
      errors.push('AudioFile.formatは文字列である必要があります');
    }

    if (!this.isString(obj.path)) {
      errors.push('AudioFile.pathは文字列である必要があります');
    }

    if (!this.isDate(obj.uploadedAt)) {
      errors.push('AudioFile.uploadedAtは日付である必要があります');
    }

    // オプションフィールドの検証
    if (obj.metadata !== undefined && !this.isObject(obj.metadata)) {
      errors.push('AudioFile.metadataはオブジェクトである必要があります');
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: obj as AudioFile,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * ProcessingOptions型の検証
   */
  public static validateProcessingOptions(value: unknown): ValidationResult<ProcessingOptions> {
    const errors: string[] = [];

    if (!this.isObject(value)) {
      errors.push('ProcessingOptionsはオブジェクトである必要があります');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    // 言語設定の検証
    const validLanguages = ['ja', 'en', 'auto'];
    if (!this.isString(obj.language) || !validLanguages.includes(obj.language)) {
      errors.push(`ProcessingOptions.languageは${validLanguages.join(', ')}のいずれかである必要があります`);
    }

    // 速度設定の検証
    const validSpeeds = ['normal', 'fast', 'slow'];
    if (!this.isString(obj.speed) || !validSpeeds.includes(obj.speed)) {
      errors.push(`ProcessingOptions.speedは${validSpeeds.join(', ')}のいずれかである必要があります`);
    }

    // モデル設定の検証
    const validModels = ['gpt-4.1', 'o3'];
    if (!this.isString(obj.minutesModel) || !validModels.includes(obj.minutesModel)) {
      errors.push(`ProcessingOptions.minutesModelは${validModels.join(', ')}のいずれかである必要があります`);
    }

    // プロンプト設定の検証
    if (obj.selectedPrompt !== null && !this.isString(obj.selectedPrompt)) {
      errors.push('ProcessingOptions.selectedPromptは文字列またはnullである必要があります');
    }

    const validPromptTypes = ['preset', 'custom'];
    if (!this.isString(obj.promptType) || !validPromptTypes.includes(obj.promptType)) {
      errors.push(`ProcessingOptions.promptTypeは${validPromptTypes.join(', ')}のいずれかである必要があります`);
    }

    // ブール値フィールドの検証
    if (!this.isBoolean(obj.punctuation)) {
      errors.push('ProcessingOptions.punctuationはブール値である必要があります');
    }

    // オプションフィールドの検証
    if (obj.customPrompt !== undefined && obj.customPrompt !== null && !this.isString(obj.customPrompt)) {
      errors.push('ProcessingOptions.customPromptは文字列である必要があります');
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: obj as ProcessingOptions,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * ProcessingProgress型の検証
   */
  public static validateProcessingProgress(value: unknown): ValidationResult<ProcessingProgress> {
    const errors: string[] = [];

    if (!this.isObject(value)) {
      errors.push('ProcessingProgressはオブジェクトである必要があります');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    // 必須フィールドの検証
    if (!this.isString(obj.stage)) {
      errors.push('ProcessingProgress.stageは文字列である必要があります');
    }

    if (!this.isNumber(obj.percentage) || obj.percentage < 0 || obj.percentage > 100) {
      errors.push('ProcessingProgress.percentageは0から100の数値である必要があります');
    }

    if (!this.isString(obj.currentTask)) {
      errors.push('ProcessingProgress.currentTaskは文字列である必要があります');
    }

    if (!this.isNumber(obj.estimatedTimeRemaining) || obj.estimatedTimeRemaining < 0) {
      errors.push('ProcessingProgress.estimatedTimeRemainingは0以上の数値である必要があります');
    }

    // オプションフィールドの検証
    if (obj.logs !== undefined && !this.isArray(obj.logs)) {
      errors.push('ProcessingProgress.logsは配列である必要があります');
    }

    if (obj.startedAt !== undefined && !this.isDate(obj.startedAt)) {
      errors.push('ProcessingProgress.startedAtは日付である必要があります');
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: obj as ProcessingProgress,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * AppError型の検証
   */
  public static validateAppError(value: unknown): ValidationResult<AppError> {
    const errors: string[] = [];

    if (!this.isObject(value)) {
      errors.push('AppErrorはオブジェクトである必要があります');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    // 必須フィールドの検証
    if (!this.isString(obj.id)) {
      errors.push('AppError.idは文字列である必要があります');
    }

    if (!this.isString(obj.code)) {
      errors.push('AppError.codeは文字列である必要があります');
    }

    if (!this.isString(obj.message)) {
      errors.push('AppError.messageは文字列である必要があります');
    }

    if (!this.isDate(obj.timestamp)) {
      errors.push('AppError.timestampは日付である必要があります');
    }

    if (!this.isBoolean(obj.recoverable)) {
      errors.push('AppError.recoverableはブール値である必要があります');
    }

    // オプションフィールドの検証
    if (obj.details !== undefined && obj.details !== null && !this.isObject(obj.details)) {
      errors.push('AppError.detailsはオブジェクトである必要があります');
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: obj as AppError,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * 汎用的な型検証
   */
  public static validateType<T>(
    value: unknown,
    validator: (value: unknown) => ValidationResult<T>
  ): ValidationResult<T> {
    try {
      return validator(value);
    } catch (error) {
      return {
        isValid: false,
        errors: [`型検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * 深いオブジェクト検証
   */
  public static validateDeepObject(
    value: unknown,
    schema: Record<string, (value: unknown) => boolean>
  ): ValidationResult<Record<string, unknown>> {
    const errors: string[] = [];

    if (!this.isObject(value)) {
      errors.push('値はオブジェクトである必要があります');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    for (const [key, validator] of Object.entries(schema)) {
      if (obj[key] !== undefined && !validator(obj[key])) {
        errors.push(`プロパティ '${key}' の型が正しくありません`);
      }
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: obj,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * ランタイム型アサーション
   */
  public static assertType<T>(
    value: unknown,
    validator: (value: unknown) => ValidationResult<T>,
    errorMessage?: string
  ): T {
    const result = validator(value);
    if (!result.isValid) {
      const message = errorMessage || `型検証に失敗しました: ${result.errors.join(', ')}`;
      throw new Error(message);
    }
    return result.data!;
  }

  /**
   * 安全な型変換
   */
  public static safeConvert<T>(
    value: unknown,
    validator: (value: unknown) => ValidationResult<T>,
    defaultValue: T
  ): T {
    const result = validator(value);
    return result.isValid ? result.data! : defaultValue;
  }

  /**
   * 配列要素の型検証
   */
  public static validateArrayItems<T>(
    array: unknown[],
    itemValidator: (value: unknown) => ValidationResult<T>
  ): ValidationResult<T[]> {
    const errors: string[] = [];
    const validItems: T[] = [];

    array.forEach((item, index) => {
      const result = itemValidator(item);
      if (result.isValid) {
        validItems.push(result.data!);
      } else {
        errors.push(`配列のインデックス ${index}: ${result.errors.join(', ')}`);
      }
    });

    if (errors.length === 0) {
      return {
        isValid: true,
        data: validItems,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }

  /**
   * 型の一致確認
   */
  public static typeMatches<T>(
    value: unknown,
    typeGuard: (value: unknown) => value is T
  ): value is T {
    return typeGuard(value);
  }

  /**
   * 複数の型検証
   */
  public static validateMultiple(
    values: Record<string, unknown>,
    validators: Record<string, (value: unknown) => ValidationResult<unknown>>
  ): ValidationResult<Record<string, unknown>> {
    const errors: string[] = [];
    const validatedData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      const validator = validators[key];
      if (validator) {
        const result = validator(value);
        if (result.isValid) {
          validatedData[key] = result.data;
        } else {
          errors.push(`${key}: ${result.errors.join(', ')}`);
        }
      } else {
        validatedData[key] = value; // バリデーターがない場合はそのまま通す
      }
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        data: validatedData,
        errors: [],
      };
    }

    return { isValid: false, errors };
  }
}

// 便利なエクスポート
export const {
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isDate,
  validateAudioFile,
  validateProcessingOptions,
  validateProcessingProgress,
  validateAppError,
  validateType,
  assertType,
  safeConvert,
} = TypeValidationService; 