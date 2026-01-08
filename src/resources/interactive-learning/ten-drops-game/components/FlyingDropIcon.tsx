'use client';

/**
 * FlyingDropIcon - 飞行中的水滴图标
 *
 * 这是一个纯 SVG 组件，渲染经典的泪滴形状。
 * 用于连锁反应中飞行的投射物。
 */

import { memo } from 'react';

interface FlyingDropIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const FlyingDropIcon = memo(function FlyingDropIcon({
  size = 24,
  color = '#60A5FA', // blue-400
  className = '',
}: FlyingDropIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
    >
      <defs>
        <radialGradient id="flyDropGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 18) rotate(-90) scale(18 18)">
          <stop stopColor={color} />
          <stop offset="1" stopColor="#1E3A8A" /> {/* blue-900 */}
        </radialGradient>
      </defs>
      
      {/* 水滴形状 - 尖头朝上 */}
      <path
        d="M12 2C12 2 5 10 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10 12 2 12 2Z"
        fill="url(#flyDropGrad)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1"
      />
      
      {/* 高光 */}
      <ellipse
        cx="9"
        cy="13"
        rx="2"
        ry="3"
        fill="rgba(255,255,255,0.6)"
        transform="rotate(-15 9 13)"
      />
    </svg>
  );
});

export default FlyingDropIcon;
