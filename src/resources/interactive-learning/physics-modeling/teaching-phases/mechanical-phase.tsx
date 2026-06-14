'use client';

/**
 * 阶段二：机械系统建模
 * Phase 2: Mechanical System Modeling
 *
 * 时长: 10-40 分钟
 * 目标: 掌握牛顿力学建模方法，理解二阶系统的物理意义
 */

import { useState, useCallback } from 'react';
import { Cog, CheckCircle2, AlertCircle, ChevronRight, Lightbulb } from 'lucide-react';
import { PhysicsBuilder } from '../physics-builder/physics-builder-canvas';
import type { PhysicsNode, PhysicsEdge } from '../types';
import { SCENARIOS } from '../types';

interface MechanicalPhaseProps {
  nodes: PhysicsNode[];
  edges: PhysicsEdge[];
  onModelChange: (nodes: PhysicsNode[], edges: PhysicsEdge[]) => void;
  onComplete: () => void;
  generatedEquation: string;
  onEquationChange: (equation: string, isComplete: boolean) => void;
  aiHint?: string;
}

export function MechanicalPhase({
  nodes,
  edges,
  onModelChange,
  onComplete,
  generatedEquation,
  onEquationChange,
  aiHint,
}: MechanicalPhaseProps) {
  const [showHint, setShowHint] = useState(false);
  const scenario = SCENARIOS.rudder;

  const isComplete = nodes.length >= 4; // 至少需要4个元件

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-500">
              <Cog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">阶段二：机械系统建模</h2>
              <p className="text-sm text-slate-400">
                搭建舵机的弹簧-质量-阻尼模型
              </p>
            </div>
          </div>

          {/* 完成状态 */}
          <div className="flex items-center gap-4">
            {isComplete ? (
              <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1.5 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>模型完整</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1.5 text-sm text-amber-500">
                <AlertCircle className="h-4 w-4" />
                <span>继续搭建</span>
              </div>
            )}

            <button type="button"
              onClick={onComplete}
              disabled={!isComplete}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isComplete
                  ? 'bg-green-500 text-slate-900 hover:bg-green-400'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500'
              }`}
            >
              下一阶段
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 任务说明 */}
        <div className="mt-3 rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-amber-500/20 text-xs text-amber-500">
              📋
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">任务：{scenario.name}</p>
              <p className="text-xs text-slate-500">{scenario.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区：PhysicsBuilder */}
      <div className="flex-1">
        <PhysicsBuilder
          mode="mechanical"
          targetEquation={scenario.targetEquation}
          onModelChange={onModelChange}
          onEquationChange={onEquationChange}
          initialNodes={nodes}
          initialEdges={edges}
        />
      </div>

      {/* AI 提示浮窗 */}
      {aiHint && (
        <div className="absolute bottom-24 right-4 z-10 max-w-sm animate-in fade-in slide-in-from-right-4">
          <div className="rounded-xl border border-blue-500/30 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-blue-400">建模导师提示</p>
                <p className="mt-1 text-sm text-slate-300">{aiHint}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提示按钮 */}
      <button type="button"
        onClick={() => setShowHint(!showHint)}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
      >
        <Lightbulb className="h-4 w-4" />
        {showHint ? '隐藏提示' : '显示提示'}
      </button>

      {showHint && (
        <div className="absolute bottom-16 right-4 z-10 w-64 rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl">
          <h4 className="text-xs font-medium text-slate-400">建模提示</h4>
          <ul className="mt-2 space-y-1.5">
            {scenario.hints.map((hint, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="text-amber-500">•</span>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
