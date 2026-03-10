'use client';

/**
 * WaterDrop - 单个水滴渲染组件
 *
 * 使用 CSS 动画模拟液体晃动效果
 * 形状为不规则圆角，根据等级变大
 */

import { memo } from 'react';

interface WaterDropProps {
  /** 水滴等级 (1-4) */
  level: number;
  /** 是否显示出现动画 */
  isNew?: boolean;
  /** 是否显示摇晃动画（接近满载） */
  isWobbling?: boolean;
  /** 大小微调 */
  size?: 'md' | 'lg';
}

export const WaterDrop = memo(function WaterDrop({
  level,
  isNew = false,
  isWobbling = false,
}: WaterDropProps) {
  // 限制 level 范围 1-5 (5为爆炸态)
  const safeLevel = Math.max(1, Math.min(5, level));
  
  // 基础大小映射 (百分比)
  // 1: 40%, 2: 60%, 3: 80%, 4: 95% (铺满)
  const sizeMap = [40, 60, 80, 95, 100];
  const sizePercent = sizeMap[safeLevel - 1] || 100;

  // 颜色映射 (从浅蓝到深蓝)
  const hue = 210;
  const saturation = 90; 
  const lightness = 60 - (safeLevel * 8); // 越高级越深: 52, 44, 36, 28...
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  
  // 阴影颜色
  const shadowColor = `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`;

  // 动画类
  let animationClass = 'transition-all duration-300 ease-in-out';
  if (isNew) animationClass += ' animate-in fade-in zoom-in-50 duration-300';
  
  // 晃动动画：Level 4 或 isWobbling 时剧烈晃动
  const wobbleClass = (safeLevel >= 4 || isWobbling) ? 'animate-puddle-wobble-intense' : 'animate-puddle-idle';

  return (
    <div
      className={`relative flex items-center justify-center ${animationClass}`}
      style={{
        width: `${sizePercent}%`,
        height: `${sizePercent}%`,
      }}
    >
      {/* 液体主体 */}
      <div 
        className={`w-full h-full ${wobbleClass}`}
        style={{
          backgroundColor: color,
          boxShadow: `
            inset 2px 2px 4px rgba(255,255,255,0.4), 
            inset -2px -2px 4px ${shadowColor},
            2px 2px 5px rgba(0,0,0,0.2)
          `,
          borderRadius: getRandomBorderRadius(safeLevel),
        }}
      >
        {/* 高光 */}
        <div 
          className="absolute top-[20%] left-[20%] w-[25%] h-[15%] rounded-full bg-white/40 blur-[1px]" 
          style={{ transform: 'rotate(-45deg)' }}
        />
        <div 
          className="absolute bottom-[20%] right-[20%] w-[10%] h-[10%] rounded-full bg-white/20 blur-[1px]" 
        />
      </div>
    </div>
  );
});

// 生成不规则圆角，模拟液体
// Level 越高，越接近方形但仍有圆角（铺满格子）
function getRandomBorderRadius(level: number): string {
  if (level >= 4) {
    // 接近铺满，圆角较小，像充满容器的液体
    return '30% 70% 70% 30% / 30% 30% 70% 70%';
  }
  
  // 较小的水滴，比较圆润但不规则
  return '40% 60% 70% 30% / 40% 50% 60% 50%';
}

export default WaterDrop;
