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
