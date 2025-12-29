'use client';

/**
 * LearningDashboard - 学习仪表盘（顶部统计栏）
 */

import { Clock, Beaker, Scale, Sparkles, Ship } from 'lucide-react';
import type { LearningProfileData } from '../personal-learning-center';

interface LearningDashboardProps {
  profile: LearningProfileData;
  userName: string;
}

export function LearningDashboard({ profile, userName }: LearningDashboardProps) {
  const learningStyleLabels: Record<LearningProfileData['learningStyle'], string> = {
    VISUAL: '视觉型',
    TEXTUAL: '文本型',
    INTERACTIVE: '互动型',
    AUDITORY: '听觉型',
    LOGICAL: '逻辑型',
  };

  return (
    <div className="border-b border-cyan-500/30 bg-[#0c3654]/80 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 用户身份标识 */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-bold">
            {userName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">{userName}</span>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">
                {profile.fleetGroup}
              </span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                L{profile.cognitiveLevel}
              </span>
            </div>
            <div className="text-sm text-slate-400">
              学习风格：{learningStyleLabels[profile.learningStyle]}
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="flex items-center gap-6">
          {/* 今日学习时长 */}
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-[#0a2a43]/50 px-4 py-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400">今日学习</div>
              <div className="text-lg font-medium text-cyan-400">{profile.dailyStudyMinutes} 分钟</div>
            </div>
          </div>

          {/* 实验时长 */}
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#0a2a43]/50 px-4 py-2">
            <Beaker className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">实验时长</div>
              <div className="text-lg font-medium text-amber-400">{profile.experimentMinutes} 分钟</div>
            </div>
          </div>

          {/* 伦理学习 */}
          <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-[#0a2a43]/50 px-4 py-2">
            <Scale className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-xs text-slate-400">伦理学习</div>
              <div className="text-lg font-medium text-green-400">{profile.ethicsMinutes} 分钟</div>
            </div>
          </div>

          {/* AI 推荐指数 */}
          <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-[#0a2a43]/50 px-4 py-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <div>
              <div className="text-xs text-slate-400">AI 推荐指数</div>
              <div className="text-lg font-medium text-purple-400">
                {Math.round(profile.aiRecommendIndex * 100)}%
              </div>
            </div>
          </div>

          {/* 解锁进度 */}
          <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-[#0a2a43]/50 px-4 py-2">
            <Ship className="h-5 w-5 text-blue-400" />
            <div>
              <div className="text-xs text-slate-400">船舶解锁</div>
              <div className="text-lg font-medium text-blue-400">
                {profile.unlockedShips}/{profile.totalShips}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
