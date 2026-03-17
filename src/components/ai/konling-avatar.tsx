/**
 * 控灵头像组件
 *
 * 支持多种尺寸的主题自适应头像
 */

import Image from 'next/image';
import { KONLING_BRAND, type KonlingAvatarSize } from '@/lib/ai-branding';
import { getAvatarBorderStyles, AVATAR_SIZE_CLASSES } from '@/lib/ai-theme-styles';

interface KonlingAvatarProps {
  size?: KonlingAvatarSize;
  className?: string;
  animate?: boolean;
  showStatus?: boolean;
  status?: 'online' | 'busy' | 'offline';
}

export function KonlingAvatar({
  size = 'md',
  className = '',
  animate = false,
  showStatus = false,
  status = 'online',
}: KonlingAvatarProps) {
  const imageUrl = KONLING_BRAND.avatar[size];
  const sizeClass = AVATAR_SIZE_CLASSES[size];
  const borderStyles = getAvatarBorderStyles();

  const statusColors = {
    online: 'bg-green-500',
    busy: 'bg-amber-500',
    offline: 'bg-slate-400',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${sizeClass}
          ${borderStyles}
          overflow-hidden
          ${animate ? 'animate-pulse' : ''}
        `}
      >
        <Image
          src={imageUrl}
          alt={KONLING_BRAND.name}
          width={size === 'xl' ? 128 : size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          height={size === 'xl' ? 128 : size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          className="h-full w-full object-cover"
          priority={size === 'lg' || size === 'xl'}
        />
      </div>
      {showStatus && (
        <span
          className={`
            absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white
            ${statusColors[status]}
          `}
        />
      )}
    </div>
  );
}

/**
 * 带头像的欢迎组件
 */
export function KonlingWelcome({
  pageType = 'default',
  topic,
  className = '',
}: {
  pageType?: 'default' | 'theory' | 'practice' | 'quiz' | 'reflection';
  topic?: string;
  className?: string;
}) {
  const getWelcomeText = () => {
    switch (pageType) {
      case 'theory':
        return `你好，我是${KONLING_BRAND.name}。今天我们将探索「${topic || '本节内容'}」，有任何问题随时问我。`;
      case 'practice':
        return `你好，我是${KONLING_BRAND.name}。让我协助你完成「${topic || '实践任务'}」，遇到困难可以向我求助。`;
      case 'quiz':
        return `你好，我是${KONLING_BRAND.name}。测试是检验学习成果的好机会，需要提示的话可以问我。`;
      case 'reflection':
        return `你好，我是${KONLING_BRAND.name}。反思是深度学习的关键，让我们一起回顾今天的收获。`;
      default:
        return KONLING_BRAND.welcomeMessages.default;
    }
  };

  return (
    <div className={`flex items-start gap-4 ${className}`}>
      <KonlingAvatar size="lg" showStatus status="online" />
      <div className="flex-1">
        <p className="text-base leading-relaxed">{getWelcomeText()}</p>
        <p className="mt-1 text-sm text-slate-500">{KONLING_BRAND.subtitle}</p>
      </div>
    </div>
  );
}

/**
 * 头像组（用于对话消息）
 */
export function KonlingAvatarGroup({
  showUser = true,
  userAvatar,
}: {
  showUser?: boolean;
  userAvatar?: string;
}) {
  return (
    <div className="flex items-center -space-x-2">
      <KonlingAvatar size="sm" />
      {showUser && (
        <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200">
          {userAvatar ? (
            <Image
              src={userAvatar}
              alt="User"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs font-medium text-slate-600">
              我
            </div>
          )}
        </div>
      )}
    </div>
  );
}
