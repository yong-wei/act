'use client';

/**
 * Participatory Learning - Analogy Mapping Phase
 * 机电相似性映射
 */

import { useState, useCallback } from 'react';
import { Link2, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { ANALOGY_MAPPINGS } from '../../physics-modeling/types';

interface AnalogyPhaseProps {
  completedCount: number;
  onProgress: (count: number) => void;
  onComplete: () => void;
}

interface MappingCardProps {
  mapping: (typeof ANALOGY_MAPPINGS)[0];
  isCompleted: boolean;
  onConnect: () => void;
}

function MappingCard({ mapping, isCompleted, onConnect }: MappingCardProps) {
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20 text-pink-500 transition-all hover:scale-110 hover:bg-pink-500/30"
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
  completedCount,
  onProgress,
  onComplete,
}: AnalogyPhaseProps) {
  const [completedMappings, setCompletedMappings] = useState<string[]>([]);

  const handleConnect = useCallback(
    (mappingId: string) => {
      if (completedMappings.includes(mappingId)) return;

      const newCompleted = [...completedMappings, mappingId];
      setCompletedMappings(newCompleted);
      onProgress(newCompleted.length);
    },
    [completedMappings, onProgress]
  );

  const allCompleted = completedMappings.length === ANALOGY_MAPPINGS.length;

  // 统一方程模板
  const unifiedEquation = 'a_2\\ddot{q} + a_1\\dot{q} + a_0 q = f(t)';

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/20 text-pink-500">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">机电相似映射</h2>
              <p className="text-sm text-slate-400">
                发现机械与电气系统的数学同构
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">
              完成进度:{' '}
              <span className="font-mono text-pink-500">
                {completedMappings.length}/{ANALOGY_MAPPINGS.length}
              </span>
            </div>

            <button
              onClick={onComplete}
              disabled={!allCompleted}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                allCompleted
                  ? 'bg-pink-500 text-white hover:bg-pink-400'
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
          <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-pink-500/10 to-violet-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-pink-400" />
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

          {/* 分屏方程展示 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 text-xs font-medium text-amber-400">机械系统</div>
              <div className="font-mono text-sm text-white">
                m·ẍ + f·ẋ + k·x = F
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 text-xs font-medium text-blue-400">电路系统</div>
              <div className="font-mono text-sm text-white">
                L·q̈ + R·q̇ + (1/C)·q = u
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
                onConnect={() => handleConnect(mapping.id)}
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

              {/* 统一方程 */}
              <div className="mt-4 rounded-lg bg-slate-800/50 p-4 text-center">
                <div className="mb-2 text-xs text-slate-400">通用二阶微分方程模板</div>
                <div className="font-mono text-lg text-white">
                  a₂·q̈ + a₁·q̇ + a₀·q = f(t)
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  其中 q 是广义坐标，可以是位移、角度、电荷等
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
