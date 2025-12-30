'use client';

/**
 * 物理建模工坊主系统
 * Physics Modeling Workshop Main System
 *
 * 课程 ID: lesson-03-differential-equations
 * 主题: 机理建模：微分方程
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { IntroPhase } from './teaching-phases/intro-phase';
import { MechanicalPhase } from './teaching-phases/mechanical-phase';
import { ElectricalPhase } from './teaching-phases/electrical-phase';
import { AnalogyPhase } from './teaching-phases/analogy-phase';
import { PracticePhase } from './teaching-phases/practice-phase';

import {
  type TeachingPhase,
  type LessonState,
  type PhysicsNode,
  type PhysicsEdge,
  PHASE_CONFIGS,
  INITIAL_LESSON_STATE,
  SCENARIOS,
  AI_SYSTEM_PROMPTS,
} from './types';

/** 阶段进度指示器 */
function PhaseIndicator({
  phases,
  currentPhase,
  phaseProgress,
}: {
  phases: typeof PHASE_CONFIGS;
  currentPhase: TeachingPhase;
  phaseProgress: Record<TeachingPhase, number>;
}) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const progress = phaseProgress[phase.id];

        return (
          <div key={phase.id} className="flex items-center">
            {/* 阶段圆点 */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>

            {/* 连接线 */}
            {index < phases.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
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
export function PhysicsModelingSystem() {
  // 课程状态
  const [state, setState] = useState<LessonState>(INITIAL_LESSON_STATE);

  // AI 交互状态
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>(undefined);

  // 当前阶段配置
  const currentPhaseConfig = useMemo(
    () => PHASE_CONFIGS.find((p) => p.id === state.currentPhase),
    [state.currentPhase]
  );

  // 切换阶段
  const goToPhase = useCallback((phase: TeachingPhase) => {
    setState((prev) => ({
      ...prev,
      currentPhase: phase,
      phaseProgress: {
        ...prev.phaseProgress,
        [prev.currentPhase]: 100, // 标记当前阶段完成
      },
    }));
  }, []);

  // 更新海况
  const handleSeaStateChange = useCallback((level: number) => {
    setState((prev) => ({ ...prev, seaState: level }));
  }, []);

  // 更新机械模型
  const handleMechanicalModelChange = useCallback(
    (nodes: PhysicsNode[], edges: PhysicsEdge[]) => {
      setState((prev) => ({
        ...prev,
        mechanicalModel: { nodes, edges },
      }));
    },
    []
  );

  // 更新电路模型
  const handleElectricalModelChange = useCallback(
    (nodes: PhysicsNode[], edges: PhysicsEdge[]) => {
      setState((prev) => ({
        ...prev,
        electricalModel: { nodes, edges },
      }));
    },
    []
  );

  // 更新生成的方程
  const handleEquationChange = useCallback(
    (equation: string, isComplete: boolean) => {
      setState((prev) => ({ ...prev, generatedEquation: equation }));
    },
    []
  );

  // 完成映射
  const handleMappingComplete = useCallback((mappingId: string) => {
    setState((prev) => {
      if (prev.completedMappings.includes(mappingId)) return prev;
      return {
        ...prev,
        completedMappings: [...prev.completedMappings, mappingId],
      };
    });
  }, []);

  // 更新练习答案
  const handlePracticeAnswerChange = useCallback((answer: string) => {
    setState((prev) => ({ ...prev, practiceAnswer: answer }));
    setAiFeedback('');
    setIsCorrect(undefined);
  }, []);

  // 提交练习答案给 AI 批改
  const handlePracticeSubmit = useCallback(async () => {
    if (!state.practiceAnswer.trim()) return;

    setIsAILoading(true);
    setAiFeedback('');

    try {
      const targetEquation = SCENARIOS.missileLauncher.targetEquation;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `${AI_SYSTEM_PROMPTS.equationValidator}

标准答案是: ${targetEquation}
这是一个导弹发射架俯仰系统的微分方程，包含重力非线性项。

学生的答案是: ${state.practiceAnswer}

请判断学生的答案是否正确。如果基本正确但有小问题，给出改进建议。如果错误较大，指出缺少哪些项，但不要直接给出答案。`,
            },
            {
              role: 'user',
              content: `请批改我的方程: ${state.practiceAnswer}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('AI 请求失败');
      }

      const data = await response.json();
      const feedback = data.content || data.message || '无法获取反馈';

      setAiFeedback(feedback);

      // 简单判断是否正确（实际应由 AI 判断）
      const isAnswerCorrect =
        feedback.includes('正确') ||
        feedback.includes('很好') ||
        feedback.includes('完全正确');
      setIsCorrect(isAnswerCorrect);
    } catch (error) {
      console.error('AI 批改失败:', error);
      setAiFeedback('抱歉，AI 助教暂时无法响应。请稍后再试。');
    } finally {
      setIsAILoading(false);
    }
  }, [state.practiceAnswer]);

  // 完成课程
  const handleLessonComplete = useCallback(() => {
    // 可以在这里保存学习记录
    alert('🎉 恭喜完成本课时学习！');
  }, []);

  // 获取 AI 提示
  const getAIHint = useCallback((phase: TeachingPhase): string | undefined => {
    // 根据当前阶段和模型状态生成提示
    if (phase === 'mechanical') {
      if (state.mechanicalModel.nodes.length === 0) {
        return '开始拖拽元件到画布吧！先从质量块开始。';
      }
      const hasMass = state.mechanicalModel.nodes.some(
        (n) => n.data?.type === 'mass'
      );
      const hasDamper = state.mechanicalModel.nodes.some(
        (n) => n.data?.type === 'damper'
      );
      if (hasMass && !hasDamper) {
        return '如果没有海水阻力（阻尼），舵叶在受到扰动后会永远摆动下去（永动机），这符合物理规律吗？';
      }
    }
    return undefined;
  }, [state.mechanicalModel.nodes]);

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

          <div>
            <h1 className="text-sm font-medium text-white">
              Lesson 03: 机理建模 - 微分方程
            </h1>
            <p className="text-xs text-slate-500">
              {currentPhaseConfig?.title} ({currentPhaseConfig?.durationMinutes} 分钟)
            </p>
          </div>
        </div>

        {/* 阶段指示器 */}
        <PhaseIndicator
          phases={PHASE_CONFIGS}
          currentPhase={state.currentPhase}
          phaseProgress={state.phaseProgress}
        />
      </header>

      {/* 主内容区 */}
      <main className="relative flex-1 overflow-hidden">
        {state.currentPhase === 'intro' && (
          <IntroPhase
            seaState={state.seaState}
            onSeaStateChange={handleSeaStateChange}
            onComplete={() => goToPhase('mechanical')}
            aiMessage="指挥官，舵机响应迟钝。为了优化控制，我们需要透视它的'物理骨架'。请调节海况等级观察响应变化。"
          />
        )}

        {state.currentPhase === 'mechanical' && (
          <MechanicalPhase
            nodes={state.mechanicalModel.nodes}
            edges={state.mechanicalModel.edges}
            onModelChange={handleMechanicalModelChange}
            onComplete={() => goToPhase('electrical')}
            generatedEquation={state.generatedEquation}
            onEquationChange={handleEquationChange}
            aiHint={getAIHint('mechanical')}
          />
        )}

        {state.currentPhase === 'electrical' && (
          <ElectricalPhase
            nodes={state.electricalModel.nodes}
            edges={state.electricalModel.edges}
            onModelChange={handleElectricalModelChange}
            onComplete={() => goToPhase('analogy')}
            generatedEquation={state.generatedEquation}
            onEquationChange={handleEquationChange}
            aiHint={getAIHint('electrical')}
          />
        )}

        {state.currentPhase === 'analogy' && (
          <AnalogyPhase
            completedMappings={state.completedMappings}
            onMappingComplete={handleMappingComplete}
            onComplete={() => goToPhase('practice')}
          />
        )}

        {state.currentPhase === 'practice' && (
          <PracticePhase
            practiceAnswer={state.practiceAnswer}
            onAnswerChange={handlePracticeAnswerChange}
            onSubmit={handlePracticeSubmit}
            isSubmitting={isAILoading}
            aiFeedback={aiFeedback}
            isCorrect={isCorrect}
            onComplete={handleLessonComplete}
          />
        )}
      </main>
    </div>
  );
}
