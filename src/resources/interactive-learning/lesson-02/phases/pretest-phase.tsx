'use client';

/**
 * Pre-assessment Phase: 前测
 * 装备点检 - 物理基础连线
 */

import { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { PRETEST_MATCHING } from '../types';

interface PretestPhaseProps {
  onComplete: (score: number, weakAreas: string[]) => void;
  onNext: () => void;
}

interface Connection {
  leftId: string;
  rightId: string;
}

export function PretestPhase({ onComplete, onNext }: PretestPhaseProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});

  const { leftItems, rightItems } = PRETEST_MATCHING;

  // 计算正确率和弱项
  const { score, weakAreas } = useMemo(() => {
    if (!showResults) return { score: 0, weakAreas: [] };

    let correct = 0;
    const weak: string[] = [];

    connections.forEach((conn) => {
      const rightItem = rightItems.find((r) => r.id === conn.rightId);
      if (rightItem?.matchesLeft === conn.leftId) {
        correct++;
      } else {
        weak.push(conn.leftId);
      }
    });

    return {
      score: Math.round((correct / leftItems.length) * 100),
      weakAreas: weak,
    };
  }, [connections, showResults, leftItems.length, rightItems]);

  // 处理左侧项选择
  const handleLeftClick = useCallback((id: string) => {
    // 检查是否已连接
    const existing = connections.find((c) => c.leftId === id);
    if (existing) {
      // 取消已有连接
      setConnections((prev) => prev.filter((c) => c.leftId !== id));
      return;
    }
    setSelectedLeft(id);
  }, [connections]);

  // 处理右侧项选择
  const handleRightClick = useCallback(
    (id: string) => {
      if (!selectedLeft) return;

      // 检查右侧是否已被连接
      const existingRight = connections.find((c) => c.rightId === id);
      if (existingRight) {
        // 替换已有连接
        setConnections((prev) =>
          prev.filter((c) => c.rightId !== id).concat({ leftId: selectedLeft, rightId: id })
        );
      } else {
        // 新建连接
        setConnections((prev) => [...prev, { leftId: selectedLeft, rightId: id }]);
      }

      setSelectedLeft(null);
    },
    [selectedLeft, connections]
  );

  // 检查答案
  const checkAnswers = useCallback(() => {
    const newFeedback: Record<string, boolean> = {};

    connections.forEach((conn) => {
      const rightItem = rightItems.find((r) => r.id === conn.rightId);
      newFeedback[conn.leftId] = rightItem?.matchesLeft === conn.leftId;
    });

    setFeedback(newFeedback);
    setShowResults(true);
  }, [connections, rightItems]);

  // 重置
  const reset = useCallback(() => {
    setConnections([]);
    setSelectedLeft(null);
    setShowResults(false);
    setFeedback({});
  }, []);

  // 继续下一步
  const handleContinue = useCallback(() => {
    onComplete(score, weakAreas);
    onNext();
  }, [score, weakAreas, onComplete, onNext]);

  // 检查左侧项是否已连接
  const isLeftConnected = useCallback(
    (id: string) => connections.some((c) => c.leftId === id),
    [connections]
  );

  // 检查右侧项是否已连接
  const isRightConnected = useCallback(
    (id: string) => connections.some((c) => c.rightId === id),
    [connections]
  );

  // 获取连接到右侧项的左侧项
  const getConnectedLeft = useCallback(
    (rightId: string) => connections.find((c) => c.rightId === rightId)?.leftId,
    [connections]
  );

  const allConnected = connections.length === leftItems.length;

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
              📋
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">装备点检</h2>
              <p className="text-sm text-slate-400">
                将左侧物理元件与右侧对应定律连线
              </p>
            </div>
          </div>

          {showResults && (
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 ${
                score >= 75
                  ? 'bg-green-500/20 text-green-400'
                  : score >= 50
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
              }`}
            >
              <span className="text-lg font-bold">{score}%</span>
              <span className="text-sm">正确率</span>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* 连线区域 */}
          <div className="flex justify-between gap-8">
            {/* 左侧：物理元件 */}
            <div className="w-1/3 space-y-4">
              <div className="mb-4 text-center text-sm font-medium text-slate-400">
                物理元件
              </div>
              {leftItems.map((item) => {
                const isConnected = isLeftConnected(item.id);
                const isSelected = selectedLeft === item.id;
                const isCorrect = feedback[item.id];
                const showFeedback = showResults && isConnected;

                return (
                  <button
                    key={item.id}
                    onClick={() => !showResults && handleLeftClick(item.id)}
                    disabled={showResults}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      showFeedback
                        ? isCorrect
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : isSelected
                          ? 'border-amber-500 bg-amber-500/20'
                          : isConnected
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="text-xs text-slate-500">
                          {item.type === 'mechanical' ? '机械' : '电气'}元件
                        </div>
                      </div>
                      {showFeedback && (
                        <div className="ml-auto">
                          {isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 中间：连线指示 */}
            <div className="flex w-1/3 flex-col items-center justify-center">
              <div className="space-y-2 text-center">
                {selectedLeft ? (
                  <>
                    <div className="text-sm text-amber-400">
                      已选择：{leftItems.find((l) => l.id === selectedLeft)?.label}
                    </div>
                    <div className="text-xs text-slate-500">点击右侧定律完成连线</div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">点击左侧元件开始连线</div>
                )}
              </div>

              {/* 连线可视化 */}
              <div className="mt-4 space-y-1">
                {connections.map((conn) => (
                  <div
                    key={`${conn.leftId}-${conn.rightId}`}
                    className={`h-1 w-16 rounded ${
                      showResults
                        ? feedback[conn.leftId]
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : 'bg-blue-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 右侧：物理定律 */}
            <div className="w-1/3 space-y-4">
              <div className="mb-4 text-center text-sm font-medium text-slate-400">
                物理定律
              </div>
              {rightItems.map((item) => {
                const isConnected = isRightConnected(item.id);
                const connectedLeftId = getConnectedLeft(item.id);
                const isCorrect = connectedLeftId
                  ? feedback[connectedLeftId]
                  : undefined;
                const showFeedback = showResults && isConnected;

                return (
                  <button
                    key={item.id}
                    onClick={() => !showResults && handleRightClick(item.id)}
                    disabled={showResults || !selectedLeft}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      showFeedback
                        ? isCorrect
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : isConnected
                          ? 'border-blue-500 bg-blue-500/10'
                          : selectedLeft
                            ? 'border-slate-600 bg-slate-800/50 hover:border-amber-500 hover:bg-amber-500/10'
                            : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    <div className="font-medium text-white">{item.label}</div>
                    {showFeedback && !isCorrect && (
                      <div className="mt-1 text-xs text-red-400">
                        应连接：{leftItems.find((l) => l.id === item.matchesLeft)?.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI 考官反馈 */}
          {showResults && (
            <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xl">
                  📋
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-amber-400">考官</div>
                  <p className="text-sm text-slate-300">
                    {score >= 75 ? (
                      '基础扎实！准备好进入建模工坊了。'
                    ) : score >= 50 ? (
                      <>
                        还不错，但{weakAreas.includes('inductor') || weakAreas.includes('capacitor')
                          ? '电感和电容的区分需要加强。'
                          : '需要复习一下基础物理。'}
                        不过别担心，接下来的实践会帮助你加深理解。
                      </>
                    ) : (
                      '看来需要先补习一下基础物理知识。不过这只是热身，我们边学边练！'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="border-t border-slate-800 bg-slate-900/50 p-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>

          <div className="flex items-center gap-3">
            {!showResults ? (
              <button
                onClick={checkAnswers}
                disabled={!allConnected}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                  allConnected
                    ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                    : 'cursor-not-allowed bg-slate-700 text-slate-500'
                }`}
              >
                检查答案
              </button>
            ) : (
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
              >
                开始建模工坊
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
