'use client';

import { Button } from '@/components/ui/button';
import type { KonlingChatFailureCategory } from '@/lib/konling-chat-failure';

interface KonlingChatFailureActionsProps {
  category: KonlingChatFailureCategory;
  onRetry: () => void;
  onNewConversation: () => void;
}

// 恢复动作与失败类别要求的状态迁移匹配，不为不可重试状态重放原请求
export function KonlingChatFailureActions({ category, onRetry, onNewConversation }: KonlingChatFailureActionsProps) {
  switch (category) {
    case 'auth-required':
      return (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => window.location.assign('/login')}>
          重新登录
        </Button>
      );
    case 'conversation-missing':
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
            刷新会话
          </Button>
          <Button size="sm" variant="ghost" onClick={onNewConversation}>
            开启新对话
          </Button>
        </div>
      );
    case 'task-context-invalid':
    case 'state-conflict':
      return (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => window.location.reload()}>
          刷新任务状态
        </Button>
      );
    default:
      return (
        <Button size="sm" variant="ghost" className="mt-2" onClick={onRetry}>
          稍后重试
        </Button>
      );
  }
}
