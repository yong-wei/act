'use client';

import { memo } from 'react';
import { Crown, User } from 'lucide-react';

export interface LeaderboardEntry {
  userId: string;
  name: string | null;
  score: number;
}

interface LevelLeaderboardProps {
  levelName: string;
  entries: LeaderboardEntry[];
  isLoading: boolean;
  hasError: boolean;
  isAuthenticated: boolean;
  currentUserId?: string;
}

export const LevelLeaderboard = memo(function LevelLeaderboard({
  levelName,
  entries,
  isLoading,
  hasError,
  isAuthenticated,
  currentUserId,
}: LevelLeaderboardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">关卡排行榜</h3>
      </div>
      <div className="mb-4 text-xs text-slate-400">{levelName}</div>

      {!isAuthenticated && (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400">
          登录后可查看全站排行榜
        </div>
      )}

      {isAuthenticated && isLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-slate-300" />
          正在加载排行榜...
        </div>
      )}

      {isAuthenticated && hasError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          排行榜加载失败，请稍后重试
        </div>
      )}

      {isAuthenticated && !isLoading && !hasError && (
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-xs text-slate-500">暂无记录</div>
          ) : (
            entries.map((entry, index) => {
              const isCurrentUser = currentUserId && entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                    isCurrentUser
                      ? 'bg-blue-500/20 text-blue-100'
                      : 'bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-[11px] text-slate-500">#{index + 1}</span>
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate max-w-[120px]">
                      {entry.name || '匿名用户'}
                    </span>
                  </div>
                  <span className="font-semibold text-amber-300">{entry.score}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

export default LevelLeaderboard;
