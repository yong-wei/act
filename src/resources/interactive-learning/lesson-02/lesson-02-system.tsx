'use client';

/**
 * Lesson 02: 机理建模 - 微分方程
 * BOPPPS 教学流程主系统
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Ship } from 'lucide-react';

import { BridgePhase } from './phases/bridge-phase';
import { ObjectivePhase } from './phases/objective-phase';
import { PretestPhase } from './phases/pretest-phase';
import { MechanicalPhase } from './phases/mechanical-phase';
import { ElectricalPhase } from './phases/electrical-phase';
import { AnalogyPhase } from './phases/analogy-phase';
import { PosttestPhase } from './phases/posttest-phase';
import { SummaryPhase } from './phases/summary-phase';

import {
  type BOPPPSPhase,
  type Lesson02State,
  BOPPPS_PHASES,
  INITIAL_LESSON02_STATE,
} from './types';

/** 阶段进度指示器 */
function PhaseIndicator({
  phases,
  currentPhase,
  phaseProgress,
}: {
  phases: typeof BOPPPS_PHASES;
  currentPhase: BOPPPSPhase;
  phaseProgress: Record<BOPPPSPhase, number>;
}) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const progress = phaseProgress[phase.id];

        // 颜色映射
        const colorMap: Record<string, string> = {
          emerald: 'bg-emerald-500',
          blue: 'bg-blue-500',
          amber: 'bg-amber-500',
          red: 'bg-red-500',
          orange: 'bg-orange-500',
          pink: 'bg-pink-500',
          violet: 'bg-violet-500',
          slate: 'bg-slate-500',
        };

        return (
          <div key={phase.id} className="flex items-center">
            {/* 阶段圆点 */}
            <div
              className={`group relative flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                    ? `${colorMap[phase.color]} text-white`
                    : 'bg-slate-700 text-slate-400'
              }`}
              title={`${phase.title} (${phase.durationMinutes}分钟)`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px]">{phase.icon}</span>
              )}
              {/* Tooltip */}
              <span className="pointer-events-none absolute -bottom-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                {phase.title}
              </span>
            </div>

            {/* 连接线 */}
            {index < phases.length - 1 && (
              <div
                className={`h-0.5 w-4 transition-colors ${
                  isCompleted ? 'bg-green-500' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 主系统组件 */
export function Lesson02System() {
  // 课程状态
  const [state, setState] = useState<Lesson02State>(INITIAL_LESSON02_STATE);

  // AI 交互状态
  const [isAILoading, setIsAILoading] = useState(false);

  // 当前阶段配置
  const currentPhaseConfig = useMemo(
    () => BOPPPS_PHASES.find((p) => p.id === state.currentPhase),
    [state.currentPhase]
  );

  // 切换阶段
  const goToPhase = useCallback((phase: BOPPPSPhase) => {
    setState((prev) => ({
      ...prev,
      currentPhase: phase,
      phaseProgress: {
        ...prev.phaseProgress,
        [prev.currentPhase]: 100,
      },
    }));
  }, []);

  // 更新前测成绩
  const handlePretestComplete = useCallback(
    (score: number, weakAreas: string[]) => {
      setState((prev) => ({
        ...prev,
        pretestScore: score,
        pretestWeakAreas: weakAreas,
      }));
    },
    []
  );

  // 解锁学习目标
  const unlockObjective = useCallback((objectiveId: string) => {
    setState((prev) => {
      if (prev.objectivesUnlocked.includes(objectiveId)) return prev;
      return {
        ...prev,
        objectivesUnlocked: [...prev.objectivesUnlocked, objectiveId],
      };
    });
  }, []);

  // 机械建模完成
  const handleMechanicalComplete = useCallback(() => {
    setState((prev) => ({ ...prev, mechanicalModelComplete: true }));
    unlockObjective('mechanical-modeler');
  }, [unlockObjective]);

  // 电路建模完成
  const handleElectricalComplete = useCallback(() => {
    setState((prev) => ({ ...prev, electricalModelComplete: true }));
    unlockObjective('circuit-analyst');
  }, [unlockObjective]);

  // 机电相似完成
  const handleAnalogyProgress = useCallback((count: number) => {
    setState((prev) => ({ ...prev, analogyMappingsComplete: count }));
    if (count >= 6) {
      unlockObjective('system-architect');
    }
  }, [unlockObjective]);

  // 更新后测答案
  const handlePosttestAnswerChange = useCallback((answer: string) => {
    setState((prev) => ({
      ...prev,
      postTestAnswer: answer,
      postTestFeedback: '',
      isPostTestCorrect: null,
    }));
  }, []);

  // 提交后测答案
  const handlePosttestSubmit = useCallback(async () => {
    if (!state.postTestAnswer.trim()) return;

    setIsAILoading(true);

    try {
      const response = await fetch('/api/ai/check-modeling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equation: state.postTestAnswer,
          scenario: 'missile-launcher',
          targetEquation: 'J\\ddot{\\theta} + f\\dot{\\theta} + mgl\\sin\\theta = T',
        }),
      });

      if (!response.ok) {
        throw new Error('AI 请求失败');
      }

      const data = await response.json();
      const feedback = data.feedback || '无法获取反馈';
      const isCorrect = data.isCorrect || false;

      setState((prev) => ({
        ...prev,
        postTestFeedback: feedback,
        isPostTestCorrect: isCorrect,
      }));
    } catch (error) {
      console.error('AI 批改失败:', error);
      setState((prev) => ({
        ...prev,
        postTestFeedback: '抱歉，AI 助教暂时无法响应。请稍后再试。',
        isPostTestCorrect: false,
      }));
    } finally {
      setIsAILoading(false);
    }
  }, [state.postTestAnswer]);

  // 计算总进度
  const totalProgress = useMemo(() => {
    const completed = Object.values(state.phaseProgress).filter(
      (p) => p === 100
    ).length;
    return Math.round((completed / BOPPPS_PHASES.length) * 100);
  }, [state.phaseProgress]);

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
              <Ship className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-medium text-white">
                Lesson 02: 机理建模 - 微分方程
              </h1>
              <p className="text-xs text-slate-500">
                {currentPhaseConfig?.icon} {currentPhaseConfig?.title} · {currentPhaseConfig?.durationMinutes} 分钟
              </p>
            </div>
          </div>
        </div>

        {/* 阶段指示器 */}
        <div className="flex items-center gap-4">
          <PhaseIndicator
            phases={BOPPPS_PHASES}
            currentPhase={state.currentPhase}
            phaseProgress={state.phaseProgress}
          />
          <div className="text-xs text-slate-500">{totalProgress}%</div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="relative flex-1 overflow-hidden">
        {/* Bridge-in 导入 */}
        {state.currentPhase === 'bridge' && (
          <BridgePhase onComplete={() => goToPhase('objective')} />
        )}

        {/* Objective 学习目标 */}
        {state.currentPhase === 'objective' && (
          <ObjectivePhase
            unlockedObjectives={state.objectivesUnlocked}
            onComplete={() => goToPhase('pretest')}
          />
        )}

        {/* Pre-assessment 前测 */}
        {state.currentPhase === 'pretest' && (
          <PretestPhase
            onComplete={handlePretestComplete}
            onNext={() => goToPhase('participatory-mechanical')}
          />
        )}

        {/* Participatory Learning - Mechanical */}
        {state.currentPhase === 'participatory-mechanical' && (
          <MechanicalPhase
            weakAreas={state.pretestWeakAreas}
            onComplete={handleMechanicalComplete}
            onNext={() => goToPhase('participatory-electrical')}
          />
        )}

        {/* Participatory Learning - Electrical */}
        {state.currentPhase === 'participatory-electrical' && (
          <ElectricalPhase
            weakAreas={state.pretestWeakAreas}
            onComplete={handleElectricalComplete}
            onNext={() => goToPhase('participatory-analogy')}
          />
        )}

        {/* Participatory Learning - Analogy */}
        {state.currentPhase === 'participatory-analogy' && (
          <AnalogyPhase
            completedCount={state.analogyMappingsComplete}
            onProgress={handleAnalogyProgress}
            onComplete={() => goToPhase('posttest')}
          />
        )}

        {/* Post-assessment 后测 */}
        {state.currentPhase === 'posttest' && (
          <PosttestPhase
            answer={state.postTestAnswer}
            feedback={state.postTestFeedback}
            isCorrect={state.isPostTestCorrect}
            isLoading={isAILoading}
            onAnswerChange={handlePosttestAnswerChange}
            onSubmit={handlePosttestSubmit}
            onComplete={() => goToPhase('summary')}
          />
        )}

        {/* Summary 总结 */}
        {state.currentPhase === 'summary' && (
          <SummaryPhase
            unlockedObjectives={state.objectivesUnlocked}
            pretestScore={state.pretestScore}
          />
        )}
      </main>
    </div>
  );
}

export default Lesson02System;
