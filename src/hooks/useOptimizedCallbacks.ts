import { useCallback, useMemo } from 'react';

/**
 * パフォーマンス最適化のためのカスタムフック
 */

// ファイルサイズフォーマット関数のメモ化
export const useFileFormatters = () => {
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return useMemo(() => ({
    formatFileSize,
    formatDuration,
  }), [formatFileSize, formatDuration]);
};

// 配列のメモ化
export const useArrayMemo = <T>(array: T[], deps?: React.DependencyList): T[] => {
  return useMemo(() => array, deps || []);
};

// オブジェクトのメモ化
export const useObjectMemo = <T extends Record<string, any>>(
  object: T, 
  deps?: React.DependencyList
): T => {
  return useMemo(() => object, deps || []);
};

// 条件付きレンダリングのメモ化
export const useConditionalMemo = <T>(
  condition: boolean,
  value: T,
  fallback?: T
): T | undefined => {
  return useMemo(() => {
    return condition ? value : fallback;
  }, [condition, value, fallback]);
};

// フィルタリング結果のメモ化
export const useFilteredArray = <T>(
  array: T[],
  filterFn: (item: T) => boolean,
  deps?: React.DependencyList
): T[] => {
  return useMemo(() => {
    return array.filter(filterFn);
  }, [array, filterFn, ...(deps || [])]);
};

// ソート結果のメモ化
export const useSortedArray = <T>(
  array: T[],
  compareFn: (a: T, b: T) => number,
  deps?: React.DependencyList
): T[] => {
  return useMemo(() => {
    return [...array].sort(compareFn);
  }, [array, compareFn, ...(deps || [])]);
};

// 計算結果のメモ化
export const useComputedValue = <T>(
  computeFn: () => T,
  deps: React.DependencyList
): T => {
  return useMemo(computeFn, deps);
};

// イベントハンドラーのメモ化
export const useEventHandlers = <T extends Record<string, (...args: any[]) => any>>(
  handlers: T
): T => {
  const memoizedHandlers = useMemo(() => {
    const result = {} as T;
    Object.keys(handlers).forEach((key) => {
      result[key as keyof T] = useCallback(handlers[key], [handlers[key]]);
    });
    return result;
  }, [handlers]);

  return memoizedHandlers;
};

// スタイルオブジェクトのメモ化
export const useStylesMemo = <T extends Record<string, any>>(
  styles: T,
  deps?: React.DependencyList
): T => {
  return useMemo(() => styles, deps || []);
}; 