'use client';

import { useEffect, useState } from 'react';

interface MdxContentState {
  content: string;
  isLoading: boolean;
  error: string | null;
}

interface MdxContentLoadState {
  path: string;
  content: string;
  error: string | null;
}

export function useMdxContent(path?: string): MdxContentState {
  const [loadState, setLoadState] = useState<MdxContentLoadState | null>(null);

  useEffect(() => {
    if (!path) {
      return;
    }

    const controller = new AbortController();
    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/content/mdx?path=${encodeURIComponent(path)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error('加载 MDX 内容失败');
        }
        const data = (await res.json()) as { content?: string };
        if (!controller.signal.aborted) {
          setLoadState({ path, content: data.content ?? '', error: null });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setLoadState({ path, content: '', error: (err as Error).message || '加载 MDX 内容失败' });
        }
      }
    };

    fetchContent();

    return () => controller.abort();
  }, [path]);

  if (!path) {
    return { content: '', isLoading: false, error: null };
  }

  if (loadState?.path !== path) {
    return { content: '', isLoading: true, error: null };
  }

  return { content: loadState.content, isLoading: false, error: loadState.error };
}
