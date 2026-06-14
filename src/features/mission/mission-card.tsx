'use client';

/**
 * MissionCard - 任务卡片组件
 *
 * 展示单个学习任务的状态和信息
 */

import Link from 'next/link';

export interface MissionData {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  order: number;
  objectives: string[];
  seaStateConfig: {
    level: number;
    waveHeight: number;
    windSpeed: number;
  };
  unlockCriteria: {
    requiredScore?: number;
    requiredMissionId?: string;
  };
  status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
  bestScore?: number;
  completedAt?: string;
}

interface MissionCardProps {
  mission: MissionData;
  onStart?: (missionId: string) => void;
}

const difficultyConfig = {
  EASY: {
    label: '入门',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
  },
  MEDIUM: {
    label: '进阶',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  HARD: {
    label: '挑战',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
  },
  EXPERT: {
    label: '专家',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
};

const statusConfig = {
  LOCKED: {
    icon: '🔒',
    label: '未解锁',
    cardStyle: 'opacity-60 grayscale',
  },
  UNLOCKED: {
    icon: '🔓',
    label: '可挑战',
    cardStyle: 'hover:border-amber-500 hover:shadow-amber-500/20 hover:shadow-lg',
  },
  COMPLETED: {
    icon: '✅',
    label: '已完成',
    cardStyle: 'border-emerald-500/50',
  },
};

export function MissionCard({ mission, onStart }: MissionCardProps) {
  const difficulty = difficultyConfig[mission.difficulty];
  const status = statusConfig[mission.status];
  const isPlayable = mission.status !== 'LOCKED';

  const cardContent = (
    <div
      className={`relative rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all duration-300 ${status.cardStyle}`}
    >
      {/* 序号标签 */}
      <div className="absolute -left-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white shadow-lg">
        {mission.order}
      </div>

      {/* 状态图标 */}
      <div className="absolute right-4 top-4 text-2xl">{status.icon}</div>

      {/* 难度标签 */}
      <div
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${difficulty.bgColor} ${difficulty.color}`}
      >
        {difficulty.label}
      </div>

      {/* 标题 */}
      <h3 className="mt-4 text-xl font-bold text-white">{mission.title}</h3>

      {/* 描述 */}
      <p className="mt-2 text-sm text-slate-400 line-clamp-2">{mission.description}</p>

      {/* 海况信息 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          🌊 海况 {mission.seaStateConfig.level} 级
        </span>
        <span className="flex items-center gap-1">
          💨 风速 {mission.seaStateConfig.windSpeed} m/s
        </span>
      </div>

      {/* 目标列表 */}
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500">任务目标</p>
        <ul className="mt-2 space-y-1">
          {mission.objectives.slice(0, 3).map((objective, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-slate-400">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
              {objective}
            </li>
          ))}
          {mission.objectives.length > 3 && (
            <li className="text-xs text-slate-500">
              还有 {mission.objectives.length - 3} 个目标...
            </li>
          )}
        </ul>
      </div>

      {/* 完成信息 */}
      {mission.status === 'COMPLETED' && mission.bestScore !== undefined && (
        <div className="mt-4 rounded-lg bg-emerald-500/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400">最佳成绩</span>
            <span className="text-2xl font-bold text-emerald-400">{mission.bestScore}</span>
          </div>
          {mission.completedAt && (
            <p className="mt-1 text-xs text-slate-500">
              完成于 {new Date(mission.completedAt).toLocaleDateString('zh-CN')}
            </p>
          )}
        </div>
      )}

      {/* 解锁条件 */}
      {mission.status === 'LOCKED' && mission.unlockCriteria.requiredScore && (
        <div className="mt-4 rounded-lg bg-slate-700/50 p-3">
          <p className="text-xs text-slate-500">
            解锁条件：上一关卡得分达到 {mission.unlockCriteria.requiredScore} 分
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-6">
        {mission.status === 'LOCKED' ? (
          <button type="button"
            disabled
            className="w-full rounded-lg bg-slate-700 px-4 py-3 text-sm font-medium text-slate-500 cursor-not-allowed"
          >
            暂未解锁
          </button>
        ) : mission.status === 'COMPLETED' ? (
          <button type="button"
            onClick={() => onStart?.(mission.id)}
            className="w-full rounded-lg bg-emerald-600/20 px-4 py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
          >
            再次挑战
          </button>
        ) : (
          <button type="button"
            onClick={() => onStart?.(mission.id)}
            className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
          >
            开始挑战
          </button>
        )}
      </div>
    </div>
  );

  if (isPlayable) {
    return (
      <Link href={`/simulations/destroyer?mission=${mission.id}`} prefetch={false} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

// 任务列表骨架屏
export function MissionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-700 bg-slate-800 p-6">
      <div className="h-6 w-16 rounded-full bg-slate-700" />
      <div className="mt-4 h-6 w-3/4 rounded bg-slate-700" />
      <div className="mt-2 h-4 w-full rounded bg-slate-700" />
      <div className="mt-2 h-4 w-2/3 rounded bg-slate-700" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-700" />
        <div className="h-3 w-5/6 rounded bg-slate-700" />
      </div>
      <div className="mt-6 h-12 rounded-lg bg-slate-700" />
    </div>
  );
}

export default MissionCard;
