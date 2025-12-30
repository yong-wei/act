'use client';

/**
 * 阶段四：机电相似
 * Phase 4: Mechanical-Electrical Analogy
 *
 * 时长: 60-75 分钟
 * 目标: 理解机械-电气系统的相似性，掌握广义坐标概念
 */

import { useState, useCallback } from 'react';
import { Link2, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { ANALOGY_MAPPINGS, type AnalogyMapping } from '../types';

interface AnalogyPhaseProps {
  completedMappings: string[];
  onMappingComplete: (mappingId: string) => void;
  onComplete: () => void;
}

/** 映射卡片组件 */
function MappingCard({
  mapping,
  isCompleted,
  onConnect,
}: {
  mapping: AnalogyMapping;
  isCompleted: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isCompleted
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* 机械侧 */}
        <div className="flex-1 rounded-lg bg-slate-900/50 p-3">
          <div className="text-center">
            <div
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${mapping.color}20` }}
            >
              <span
                className="font-mono text-xl font-bold"
                style={{ color: mapping.color }}
              >
                {mapping.mechanical.symbol}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300">
              {mapping.mechanical.name}
            </p>
            <p className="text-xs text-slate-500">{mapping.mechanical.unit}</p>
          </div>
        </div>

        {/* 连接线/按钮 */}
        <div className="flex flex-col items-center">
          {isCompleted ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 transition-all hover:scale-110 hover:bg-amber-500/30"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}
          <div
            className={`my-1 h-1 w-16 rounded ${
              isCompleted ? 'bg-green-500' : 'bg-slate-700'
            }`}
            style={isCompleted ? { backgroundColor: mapping.color } : undefined}
          />
          <p className="text-xs text-slate-500">{mapping.meaning}</p>
        </div>

        {/* 电气侧 */}
        <div className="flex-1 rounded-lg bg-slate-900/50 p-3">
          <div className="text-center">
            <div
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${mapping.color}20` }}
            >
              <span
                className="font-mono text-xl font-bold"
                style={{ color: mapping.color }}
              >
                {mapping.electrical.symbol}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300">
              {mapping.electrical.name}
            </p>
            <p className="text-xs text-slate-500">{mapping.electrical.unit}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalogyPhase({
  completedMappings,
  onMappingComplete,
  onComplete,
}: AnalogyPhaseProps) {
  const allCompleted = completedMappings.length === ANALOGY_MAPPINGS.length;

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-500">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">阶段四：万物归一</h2>
              <p className="text-sm text-slate-400">
                发现机械与电气系统的数学相似性
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">
              完成进度:{' '}
              <span className="font-mono text-amber-500">
                {completedMappings.length}/{ANALOGY_MAPPINGS.length}
              </span>
            </div>

            <button
              onClick={onComplete}
              disabled={!allCompleted}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                allCompleted
                  ? 'bg-violet-500 text-white hover:bg-violet-400'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500'
              }`}
            >
              下一阶段
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* 说明 */}
          <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-violet-400" />
              <div>
                <p className="text-sm text-slate-300">
                  点击中间的连接按钮，将左侧机械量与右侧电气量配对。
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  无论外表是钢铁还是电子，数学灵魂是相通的。这就是二阶系统的普遍性。
                </p>
              </div>
            </div>
          </div>

          {/* 映射卡片列表 */}
          <div className="grid gap-4">
            {ANALOGY_MAPPINGS.map((mapping) => (
              <MappingCard
                key={mapping.id}
                mapping={mapping}
                isCompleted={completedMappings.includes(mapping.id)}
                onConnect={() => onMappingComplete(mapping.id)}
              />
            ))}
          </div>

          {/* 完成提示 */}
          {allCompleted && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-400">
                    恭喜！你已掌握机电相似原理
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    现在你可以用统一的数学语言描述机械和电气系统了。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
