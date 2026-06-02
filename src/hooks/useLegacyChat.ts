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
}

export function useChat({ api, body, onError }: UseLegacyChatOptions) {
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
      }),
    [api],
  );

  const chat = useAiSdkChat({
    transport,
    onError,
  });

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const append = useCallback(
    async (message: Pick<Message, 'role' | 'content'>) => {
      await chat.sendMessage({ text: message.content });
    },
    [chat],
  );

  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      const text = input.trim();
      if (!text || chat.status === 'submitted' || chat.status === 'streaming') {
        return;
      }
      setInput('');
      await chat.sendMessage({ text });
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
