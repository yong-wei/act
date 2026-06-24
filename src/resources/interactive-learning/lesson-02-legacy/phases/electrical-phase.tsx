'use client';

/**
 * Participatory Learning - Electrical Modeling Phase
 * Physics Builder (Electrical Mode) - 建立RLC电路模型
 */

import { useState, useCallback } from 'react';
import { Zap, CheckCircle2, ChevronRight, Lightbulb, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';
import { PhysicsBuilder } from '../../physics-modeling/physics-builder/physics-builder-canvas';
import type { PhysicsNode, PhysicsEdge } from '../../physics-modeling/types';
import { KnowledgeSidebar } from '../../shared/knowledge-card';
import { useKnowledgeCard } from '../../shared/knowledge-cards-data';

interface ElectricalPhaseProps {
  weakAreas: string[];
  onComplete: () => void;
  onNext: () => void;
}

export function ElectricalPhase({
  weakAreas,
  onComplete,
  onNext,
}: ElectricalPhaseProps) {
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [edges, setEdges] = useState<PhysicsEdge[]>([]);
  const [generatedEquation, setGeneratedEquation] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'charge'>('current');
  const [showKnowledgeCard, setShowKnowledgeCard] = useState(false);

  // 获取知识卡片数据
  const {
    card: knowledgeCard,
    isLoading: isKnowledgeCardLoading,
    error: knowledgeCardError,
  } = useKnowledgeCard('动态数学模型_2_b7f98344');

  // 需要辅助提示（前测在电感/电容上出错）
  const needsHelp = weakAreas.includes('inductor') || weakAreas.includes('capacitor');

  // 模型变化回调
  const handleModelChange = useCallback(
    (newNodes: PhysicsNode[], newEdges: PhysicsEdge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);

      // 检查模型完整性（RLC + 电压源）
      const hasResistor = newNodes.some((n) => n.data?.type === 'resistor');
      const hasInductor = newNodes.some((n) => n.data?.type === 'inductor');
      const hasCapacitor = newNodes.some((n) => n.data?.type === 'capacitor');
      const hasSource = newNodes.some((n) => n.data?.type === 'voltage_source');

      if (hasResistor && hasInductor && hasCapacitor && hasSource && !isComplete) {
        setIsComplete(true);
        onComplete();
      }
    },
    [isComplete, onComplete]
  );

  // 方程变化回调
  const handleEquationChange = useCallback((equation: string, complete: boolean) => {
    setGeneratedEquation(equation);
  }, []);

  // 切换视角
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'current' ? 'charge' : 'current'));
  }, []);

  // AI 提示逻辑
  const getAIHint = useCallback(() => {
    const hasResistor = nodes.some((n) => n.data?.type === 'resistor');
    const hasInductor = nodes.some((n) => n.data?.type === 'inductor');
    const hasCapacitor = nodes.some((n) => n.data?.type === 'capacitor');

    if (!hasResistor && !hasInductor && !hasCapacitor) {
      return '从电阻开始吧！它消耗能量，类似于机械系统中的阻尼器。';
    }
    if (!hasInductor) {
      return needsHelp
        ? '电感存储磁场能量。当电流变化时，它会产生感应电动势 L·di/dt。'
        : '添加一个电感，它是回路中的惯性元件。';
    }
    if (!hasCapacitor) {
      return needsHelp
        ? '电容存储电场能量。电压与电荷的关系是 u = q/C。'
        : '添加一个电容，它存储电荷能量。';
    }
    return '很好！现在添加电压源来驱动电路。';
  }, [nodes, needsHelp]);

  // 获取当前显示的方程
  const displayEquation = viewMode === 'current'
    ? generatedEquation || 'L\\frac{di}{dt} + Ri + \\frac{1}{C}\\int i\\,dt = u'
    : 'L\\ddot{q} + R\\dot{q} + \\frac{1}{C}q = u';

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20 text-orange-500">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">电路建模工坊</h2>
              <p className="text-sm text-slate-400">
                建立直流电机电枢回路的RLC模型
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
              onClick={onNext}
              disabled={!isComplete}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isComplete
                  ? 'bg-orange-500 text-white hover:bg-orange-400'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500'
              }`}
            >
              下一阶段
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 任务说明 */}
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex-1 rounded-lg bg-slate-800/50 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-orange-500/20 text-xs text-orange-500">
                ⚡
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">
                  任务：搭建 R-L-C 串联回路
                </p>
                <p className="text-xs text-slate-500">
                  使用基尔霍夫电压定律(KVL)建立回路方程
                </p>
              </div>
            </div>
          </div>

          {/* 视角切换 */}
          {isComplete && (
            <button type="button"
              onClick={toggleViewMode}
              className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              切换为{viewMode === 'current' ? '电荷 q' : '电流 i'} 视角
            </button>
          )}
        </div>

        {/* 辅助提示 */}
        {needsHelp && (
          <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2">
            <div className="flex items-center gap-2 text-xs text-orange-400">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>提示：电感和电容是动态元件，它们的电压与电流是微分/积分关系</span>
            </div>
          </div>
        )}

        {/* 知识卡片入口 */}
        <div className="mt-2 flex justify-end">
          <button type="button"
            onClick={() => setShowKnowledgeCard(!showKnowledgeCard)}
            disabled={!knowledgeCard}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              knowledgeCard
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'cursor-not-allowed bg-slate-800 text-slate-500'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {knowledgeCard
              ? 'KVL与动态电路'
              : isKnowledgeCardLoading
                ? '知识卡片加载中...'
                : knowledgeCardError || '知识卡片暂不可用'}
          </button>
        </div>
      </div>

      {/* 主内容区：PhysicsBuilder */}
      <div className="flex-1">
        <PhysicsBuilder
          mode="electrical"
          targetEquation="L\frac{di}{dt} + Ri + \frac{1}{C}\int i\,dt = u"
          onModelChange={handleModelChange}
          onEquationChange={handleEquationChange}
          initialNodes={nodes}
          initialEdges={edges}
        />
      </div>

      {/* 方程视角说明 */}
      {isComplete && (
        <div className="absolute bottom-20 left-4 z-10 max-w-sm rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
          <div className="mb-2 text-xs text-slate-400">
            {viewMode === 'current' ? '电流 i 视角' : '电荷 q 视角'}
          </div>
          <div className="font-mono text-sm text-white">
            {displayEquation}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {viewMode === 'current'
              ? '以电流 i 为变量，包含积分项'
              : '以电荷 q 为变量，q = ∫i·dt，得到标准二阶形式'}
          </p>
        </div>
      )}

      {/* AI 提示浮窗 */}
      {showHint && (
        <div className="absolute bottom-24 right-4 z-10 max-w-sm animate-in fade-in slide-in-from-right-4">
          <div className="rounded-xl border border-orange-500/30 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                👨‍🏫
              </div>
              <div>
                <p className="text-xs font-medium text-orange-400">建模导师</p>
                <p className="mt-1 text-sm text-slate-300">{getAIHint()}</p>
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
        {showHint ? '隐藏提示' : 'KVL 提示'}
      </button>

      {/* 知识卡片侧边栏 */}
      {knowledgeCard && (
        <KnowledgeSidebar
          node={knowledgeCard}
          isOpen={showKnowledgeCard}
          onClose={() => setShowKnowledgeCard(false)}
          position="right"
        />
      )}
    </div>
  );
}
