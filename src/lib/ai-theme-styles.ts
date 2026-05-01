/**
 * 主题感知样式工具
 *
 * 提供AI助手组件的主题自适应样式
 */

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/providers/theme-provider';

export interface AIThemeStyles {
  container: string;
  header: string;
  message: {
    user: string;
    assistant: string;
  };
  input: string;
  button: string;
  buttonSecondary: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  icon: string;
  scrollThumb: string;
}

/**
 * 获取AI助手的主题感知样式
 */
export function useAIThemeStyles(): AIThemeStyles {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 避免服务端渲染时的闪烁
  if (!mounted) {
    return getDarkStyles();
  }

  return theme === 'light' ? getLightStyles() : getDarkStyles();
}

function getDarkStyles(): AIThemeStyles {
  return {
    container: 'bg-slate-900 border-slate-700',
    header: 'bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-b border-slate-700',
    message: {
      user: 'bg-amber-600 text-white',
      assistant: 'bg-slate-800 text-slate-200',
    },
    input: 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    buttonSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600',
    border: 'border-slate-700',
    text: {
      primary: 'text-slate-100',
      secondary: 'text-amber-300',
      muted: 'text-slate-400',
    },
    icon: 'text-amber-400',
    scrollThumb: 'bg-slate-700 hover:bg-slate-600',
  };
}

function getLightStyles(): AIThemeStyles {
  return {
    container: 'bg-white border-slate-200',
    header: 'bg-gradient-to-r from-amber-100 to-orange-100 border-b border-slate-200',
    message: {
      user: 'bg-amber-500 text-white',
      assistant: 'bg-slate-100 text-slate-800',
    },
    input: 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-500/20',
    button: 'bg-amber-500 hover:bg-amber-600 text-white',
    buttonSecondary: 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300',
    border: 'border-slate-200',
    text: {
      primary: 'text-slate-900',
      secondary: 'text-amber-700',
      muted: 'text-slate-500',
    },
    icon: 'text-amber-600',
    scrollThumb: 'bg-slate-300 hover:bg-slate-400',
  };
}

/**
 * 侧边栏悬浮面板尺寸配置
 */
export const SIDEBAR_SIZES = {
  collapsed: {
    width: '64px',
  },
  expanded: {
    mobile: { width: '100vw', height: '100vh' },
    tablet: { width: '380px', height: '100vh' },
    desktop: { width: '420px', height: '100vh' },
  },
} as const;

/**
 * 面板位置配置
 */
export const PANEL_POSITION = {
  right: 0,
  top: 0,
  height: '100vh',
  zIndex: 50,
} as const;

/**
 * 获取响应式宽度类
 */
export function getResponsiveWidthClasses(): string {
  return `
    w-screen h-screen
    sm:w-[380px] sm:h-screen
    lg:w-[420px] lg:h-screen
  `;
}

/**
 * 头像尺寸映射
 */
export const AVATAR_SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-32 w-32',
};

/**
 * 获取头像边框样式
 */
export function getAvatarBorderStyles(): string {
  return 'rounded-full border-2 border-amber-500/30 shadow-lg';
}

/**
 * 获取浮动按钮样式
 */
export function getFloatingButtonStyles(isDark: boolean): string {
  const base = 'fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110';
  const colors = isDark
    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
    : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-400/25';
  return `${base} ${colors}`;
}

/**
 * 获取未读消息角标样式
 */
export function getUnreadBadgeStyles(isDark: boolean): string {
  const base = 'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold';
  const colors = isDark
    ? 'bg-red-500 text-white'
    : 'bg-red-500 text-white';
  return `${base} ${colors}`;
}

/**
 * 过渡动画配置
 */
export const TRANSITION_CLASSES = {
  panel: 'transition-all duration-300 ease-out',
  button: 'transition-transform duration-200 ease-out',
  message: 'transition-opacity duration-200',
  fadeIn: 'animate-in fade-in slide-in-from-right-4 duration-300',
  slideIn: 'animate-in slide-in-from-right-full duration-300',
  slideOut: 'animate-out slide-out-to-right-full duration-200',
} as const;
