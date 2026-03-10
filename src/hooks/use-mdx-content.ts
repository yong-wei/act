'use client';

import { useEffect, useState } from 'react';

interface MdxContentState {
  content: string;
  isLoading: boolean;
  error: string | null;
}

export function useMdxContent(path?: string): MdxContentState {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setContent('');
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/content/mdx?path=${encodeURIComponent(path)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error('加载 MDX 内容失败');
        }
        const data = (await res.json()) as { content?: string };
        setContent(data.content ?? '');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || '加载 MDX 内容失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();

    return () => controller.abort();
  }, [path]);

  return { content, isLoading, error };
}
