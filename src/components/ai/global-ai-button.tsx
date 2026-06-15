/**
 * 全局 AI 助手入口注册器。
 * 入口由共享页面工具 Dock 渲染，避免并发固定在右下角的独立按钮。
 */

'use client';

import { useEffect, useState } from 'react';
import { KonlingAvatar } from './konling-avatar';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { usePageFloatingControls } from '@/components/shared/page-floating-controls';

export function GlobalAIFloatingButton() {
  const [mounted, setMounted] = useState(false);
  const { shouldShowButton, isOpen, toggleSidebar, unreadCount } = useGlobalAI();
  const { registerControl } = usePageFloatingControls();
  const knowledgeProductQaEnabled = mounted
    && process.env.NODE_ENV !== 'production'
    && typeof window !== 'undefined'
    && window.location.pathname === '/knowledge'
    && window.localStorage.getItem('act:knowledge-product-qa') === 'true'
    && new URLSearchParams(window.location.search).get('qa') === 'knowledge-product';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || (!shouldShowButton && !knowledgeProductQaEnabled) || isOpen) return undefined;
    return registerControl({
      id: 'konling-global-ai',
      label: '控灵 AI助手',
      ariaLabel: '呼出控灵 AI助手',
      priority: 10,
      icon: <KonlingAvatar size="sm" />,
      badge: unreadCount > 0
        ? <span className="rounded-full bg-platform-evidence-unsupported px-1.5 py-0.5 text-[10px] font-bold text-platform-fg-inverse">{unreadCount > 9 ? '9+' : unreadCount}</span>
        : undefined,
      onSelect: toggleSidebar,
    });
  }, [isOpen, knowledgeProductQaEnabled, mounted, registerControl, shouldShowButton, toggleSidebar, unreadCount]);

  return null;
}

/**
 * 带文字提示的按钮变体（用于特定场景）
 */
export function GlobalAITextButton() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { shouldShowButton, toggleSidebar } = useGlobalAI();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !shouldShowButton) {
    return null;
  }

  const isDark = mounted ? theme !== 'light' : true;

  return (
    <button type="button"
      onClick={toggleSidebar}
      className={`
        flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg
        transition-all duration-200 hover:scale-105 active:scale-95
        ${isDark
          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
        }
      `}
    >
      <KonlingAvatar size="sm" />
      <div className="text-left">
        <div className="text-sm font-semibold">向控灵提问</div>
        <div className="text-xs opacity-80">AI学习伴侣</div>
      </div>
    </button>
  );
}

export default GlobalAIFloatingButton;
