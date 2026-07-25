'use client';

import {
  DefaultChatTransport,
} from 'ai';
import { useChat as useAiSdkChat } from '@ai-sdk/react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toLegacyMessage } from '@/lib/ai-message-compat';
import type { Message } from '@/types/ai-message';
export type { Message } from '@/types/ai-message';

interface UseLegacyChatOptions {
  api: string;
  body?: Record<string, unknown>;
  onError?: (error: Error) => void;
  onFinish?: (event: unknown) => void;
  onResponse?: (response: Response) => void;
}

export function useChat({ api, body, onError, onFinish, onResponse }: UseLegacyChatOptions) {
  const [input, setInput] = useState('');
  const bodyRef = useRef(body);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        body: () => bodyRef.current ?? {},
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          onResponse?.(response.clone());
          return response;
        },
      }),
    [api, onResponse],
  );

  const chat = useAiSdkChat({
    transport,
    onError,
    onFinish,
  });

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const append = useCallback(
    async (
      message: Pick<Message, 'role' | 'content'>,
      requestBody?: Record<string, unknown>,
    ) => {
      await chat.sendMessage(
        { text: message.content },
        requestBody ? { body: { ...bodyRef.current, ...requestBody } } : undefined,
      );
    },
    [chat],
  );

  const handleSubmit = useCallback(
    async (
      event?: { preventDefault?: () => void },
      requestBody?: Record<string, unknown>,
    ) => {
      event?.preventDefault?.();
      const text = input.trim();
      if (!text || chat.status === 'submitted' || chat.status === 'streaming') {
        return;
      }
      setInput('');
      await chat.sendMessage(
        { text },
        requestBody ? { body: { ...bodyRef.current, ...requestBody } } : undefined,
      );
    },
    [chat, input],
  );

  return {
    messages: chat.messages.map(toLegacyMessage),
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    error: chat.error,
    reload: chat.regenerate,
    stop: chat.stop,
    append,
    setMessages: chat.setMessages,
  };
}
