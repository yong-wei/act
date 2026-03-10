'use client';

/**
 * 十滴水游戏独立页面
 *
 * 直接加载游戏组件，无需数据库配置
 */

import dynamic from 'next/dynamic';

const TenDropsGame = dynamic(
  () => import('@/resources/interactive-learning/ten-drops-game'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>加载游戏中...</p>
        </div>
      </div>
    ),
  }
);

export default function TenDropsPage() {
  return (
    <TenDropsGame
      initialLevelId="tutorial-1"
      showEducation={true}
      onComplete={(score, levelId) => {
        console.log(`完成关卡 ${levelId}，得分: ${score}`);
      }}
    />
  );
}
