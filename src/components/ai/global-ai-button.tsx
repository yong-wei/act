/**
 * 全局AI助手浮动按钮
 *
 * 固定在页面右下角，用于呼出全局AI侧边栏
 * 复用KonlingAvatar和getFloatingButtonStyles
 */

'use client';

import { useEffect, useState } from 'react';
import { KonlingAvatar } from './konling-avatar';
import { getFloatingButtonStyles, getUnreadBadgeStyles } from '@/lib/ai-theme-styles';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useTheme } from '@/components/providers/theme-provider';

export function GlobalAIFloatingButton() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { shouldShowButton, isOpen, toggleSidebar, unreadCount } = useGlobalAI();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme !== 'light' : true;

  const buttonStyles = getFloatingButtonStyles(isDark);
  const badgeStyles = getUnreadBadgeStyles(isDark);

  // 如果页面被排除或SSR时不渲染
  if (!mounted || !shouldShowButton) {
    return null;
  }

  // 如果侧边栏打开，不渲染按钮
  if (isOpen) {
    return null;
  }

  return (
    <button
      onClick={toggleSidebar}
      className={`${buttonStyles} animate-in fade-in zoom-in duration-300`}
      title="呼出控灵 AI助手"
      aria-label="呼出控灵 AI助手"
    >
      <KonlingAvatar size="md" />
      {unreadCount > 0 && (
        <span className={`${badgeStyles} animate-in zoom-in duration-200`}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
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
    <button
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
