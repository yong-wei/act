import React from 'react';
import { Trophy, Lock, Star, User, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeaderboardEntry } from '@/app/actions/control-odyssey';
import type { ControlOdysseyLevel } from '../level-data';
import { Button } from '@/components/ui/button';

interface LevelSelectorProps {
  levels: ControlOdysseyLevel[];
  selectedLevelId: string;
  leaderboardData: LeaderboardEntry[];
  onSelectLevel: (levelId: string) => void;
  onConfirmLevel?: () => void;
  isLoadingLeaderboard?: boolean;
  controlCredits?: number;
  onOpenShop?: () => void;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({ 
  levels, 
  selectedLevelId,
  leaderboardData,
  onSelectLevel,
  onConfirmLevel,
  isLoadingLeaderboard = false,
  controlCredits = 0,
  onOpenShop
}) => {
  const tierColorMap: Record<string, string> = {
    bronze: 'text-amber-400',
    silver: 'text-slate-200',
    gold: 'text-yellow-400'
  };
  return (
    <div className="flex w-full min-h-full max-w-[1400px] mx-auto gap-6 p-8 text-white">
      {/* 左侧：动态排行榜 */}
      <div className="w-96 bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
             <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wider text-white">精英榜单</h2>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {levels.find(l => l.id === selectedLevelId)?.name}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[300px]">
           {isLoadingLeaderboard ? (
             <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
               <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
               <span className="text-xs">同步星际数据...</span>
             </div>
           ) : leaderboardData.length === 0 ? (
             <div className="text-center text-slate-500 py-10 text-sm italic">
               暂无舰长征服此星域。
               <br/>
               成为第一个传奇吧！
             </div>
           ) : (
             leaderboardData.map((player) => (
               <div key={player.rank} className="flex items-center justify-between p-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors rounded-lg border border-slate-700/30 group">
                 <div className="flex items-center gap-3 overflow-hidden">
                   <div className={cn(
                     "w-6 h-6 flex-none flex items-center justify-center font-bold rounded text-xs font-mono",
                     player.rank === 1 ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30" : 
                     player.rank === 2 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" :
                     player.rank === 3 ? "bg-amber-700/20 text-amber-700 border border-amber-700/30" : "text-slate-500 bg-slate-900"
                   )}>
                     {player.rank}
                   </div>
                   <div className="flex items-center gap-2 overflow-hidden">
                      {player.userImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.userImage} alt="avatar" className="w-6 h-6 rounded-full bg-slate-700" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-300 truncate group-hover:text-white transition-colors">{player.userName}</span>
                   </div>
                 </div>
                 <div className="text-right flex-none">
                   <div className="flex items-center justify-end gap-1 text-emerald-400 font-mono font-bold text-sm">
                     {player.tier && (
                       <Star className={cn('w-3 h-3 fill-current', tierColorMap[player.tier] ?? 'text-slate-500')} />
                     )}
                     <span>{player.score.toLocaleString()}</span>
                   </div>
                   {player.metrics?.maxOvershoot !== undefined && (
                      <div className="text-[10px] text-slate-600">
                        超调 {Number(player.metrics.maxOvershoot).toFixed(1)}%
                        {' '}| 稳态 {Number(player.metrics.steadyError ?? 0).toFixed(1)}%
                        {' '}| 平均 {Number(player.metrics.avgRelativeError ?? 0).toFixed(1)}%
                      </div>
                   )}
                 </div>
               </div>
             ))
           )}
        </div>
        
        <div className="text-center text-[10px] text-slate-600 mt-4 pt-4 border-t border-slate-800 uppercase tracking-widest">
           Top 50 Commanders
        </div>
      </div>

      {/* 右侧：关卡网格 */}
      <div className="flex-1 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white">选择关卡</h1>
            <p className="text-slate-400 mt-2">攻克不同特性的控制系统，解锁更高级的控制器。</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={onOpenShop}
              disabled={!onOpenShop}
              className="relative h-12 px-6 rounded-full font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 shadow-[0_10px_30px_rgba(251,146,60,0.35)] hover:shadow-[0_12px_36px_rgba(251,146,60,0.45)] transition-transform hover:-translate-y-0.5"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              控制商店
              <span className="ml-2 rounded-full bg-slate-950/15 px-2 py-0.5 text-xs text-slate-900/70">积分 {controlCredits.toLocaleString()}</span>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levels.map((level) => {
            const isSelected = level.id === selectedLevelId;
            return (
            <div 
              key={level.id}
              className={cn(
                "relative group overflow-hidden rounded-2xl border p-6 transition-all duration-300",
                level.unlocked 
                  ? "bg-slate-900 border-slate-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer" 
                  : "bg-slate-900/50 border-slate-800 opacity-60 grayscale cursor-not-allowed",
                level.id === selectedLevelId && level.unlocked
                  ? "border-blue-400 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                  : ""
              )}
              onClick={() => level.unlocked && onSelectLevel(level.id)}
            >
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  {level.unlocked ? (
                    <Button
                      size="sm"
                      disabled={!isSelected || !onConfirmLevel}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!isSelected || !onConfirmLevel) return;
                        onConfirmLevel();
                      }}
                      className={cn(
                        'h-10 px-4 rounded-xl text-xs font-semibold',
                        isSelected
                          ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      )}
                    >
                      配置并开始
                    </Button>
                  ) : (
                    <div className="h-10 px-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 flex items-center gap-2 text-xs font-semibold">
                      <Lock className="w-4 h-4" />
                      已锁定
                    </div>
                  )}
                  {typeof level.highScore === 'number' && level.highScore > 0 && (
                    <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded text-xs font-mono">
                      <Star className="w-3 h-3 fill-current" />
                      {level.highScore}
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{level.name}</h3>
                <p className="text-sm text-slate-400 mb-4 h-10 line-clamp-2">
                  {level.description}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-t border-slate-800 pt-4 mt-auto">
                   <span>DIFFICULTY</span>
                   <div className="flex gap-0.5">
                     {[...Array(5)].map((_, i) => (
                       <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < level.difficulty ? "bg-blue-500" : "bg-slate-800")} />
                     ))}
                   </div>
                </div>
              </div>
            </div>
          );
          })}

          {/* 敬请期待 */}
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 flex flex-col items-center justify-center text-slate-600 gap-2">
            <Lock className="w-8 h-8 opacity-50" />
            <span className="text-sm">更多关卡开发中...</span>
          </div>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
};
