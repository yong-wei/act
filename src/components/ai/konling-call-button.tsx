/**
 * 控灵呼叫按钮组件
 *
 * 固定在右下角的悬浮按钮，用于呼出AI助手
 */

'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { KonlingAvatar } from './konling-avatar';
import { getFloatingButtonStyles, getUnreadBadgeStyles } from '@/lib/ai-theme-styles';

interface KonlingCallButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
  className?: string;
}

export function KonlingCallButton({
  isOpen,
  onClick,
  unreadCount = 0,
  className = '',
}: KonlingCallButtonProps) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted
    ? (theme === 'system' ? systemTheme : theme) !== 'light'
    : true;

  const buttonStyles = getFloatingButtonStyles(isDark);
  const badgeStyles = getUnreadBadgeStyles(isDark);

  return (
    <button
      onClick={onClick}
      className={`
        ${buttonStyles}
        ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}
        ${className}
      `}
      title="呼出控灵 AI助手"
      aria-label="呼出控灵 AI助手"
    >
      <KonlingAvatar size="md" />
      {unreadCount > 0 && (
        <span className={badgeStyles}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

/**
 * 最小化状态的按钮（仅图标）
 */
export function KonlingMiniButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted
    ? (theme === 'system' ? systemTheme : theme) !== 'light'
    : true;

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 rounded-full px-3 py-2 shadow-lg transition-all hover:scale-105
        ${isDark
          ? 'bg-slate-800 border border-slate-700 text-slate-200'
          : 'bg-white border border-slate-200 text-slate-800'
        }
        ${className}
      `}
      title="控灵"
    >
      <KonlingAvatar size="sm" />
      <span className="text-sm font-medium">控灵</span>
    </button>
  );
}

/**
 * 带文字的呼叫按钮（用于特定场景）
 */
export function KonlingTextButton({
  onClick,
  label = '向控灵提问',
  className = '',
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted
    ? (theme === 'system' ? systemTheme : theme) !== 'light'
    : true;

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all hover:scale-105
        ${isDark
          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
        }
        ${className}
      `}
    >
      <KonlingAvatar size="sm" />
      <div className="text-left">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs opacity-80">AI学习伴侣</div>
      </div>
    </button>
  );
}
