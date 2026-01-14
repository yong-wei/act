'use client';

/**
 * Participatory Learning - Mechanical Modeling Phase
 * Physics Builder (Mechanical Mode) - 搭建弹簧-质量-阻尼模型
 */

import { useState, useCallback } from 'react';
import { Wrench, CheckCircle2, ChevronRight, Lightbulb, AlertCircle, BookOpen } from 'lucide-react';
import { PhysicsBuilder } from '../../physics-modeling/physics-builder/physics-builder-canvas';
import type { PhysicsNode, PhysicsEdge } from '../../physics-modeling/types';
import { KnowledgeSidebar } from '../../shared/knowledge-card';
import { useKnowledgeCard } from '../../shared/knowledge-cards-data';

interface MechanicalPhaseProps {
  weakAreas: string[];
  onComplete: () => void;
  onNext: () => void;
}

export function MechanicalPhase({
  weakAreas,
  onComplete,
  onNext,
}: MechanicalPhaseProps) {
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [edges, setEdges] = useState<PhysicsEdge[]>([]);
  const [generatedEquation, setGeneratedEquation] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showKnowledgeCard, setShowKnowledgeCard] = useState(false);

  // 获取知识卡片数据
  const {
    card: knowledgeCard,
    isLoading: isKnowledgeCardLoading,
    error: knowledgeCardError,
  } = useKnowledgeCard('node-newton-laws');

  // 需要辅助提示（前测弱项）
  const needsHelp = weakAreas.length > 0;

  // 模型变化回调
  const handleModelChange = useCallback(
    (newNodes: PhysicsNode[], newEdges: PhysicsEdge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);

      // 检查模型完整性
      const hasMass = newNodes.some((n) => n.data?.type === 'mass');
      const hasDamper = newNodes.some((n) => n.data?.type === 'damper');
      const hasSpring = newNodes.some((n) => n.data?.type === 'spring');
      const hasForce = newNodes.some((n) => n.data?.type === 'force_source');

      if (hasMass && hasDamper && hasSpring && hasForce && !isComplete) {
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

  // AI 提示逻辑
  const getAIHint = useCallback(() => {
    const hasMass = nodes.some((n) => n.data?.type === 'mass');
    const hasDamper = nodes.some((n) => n.data?.type === 'damper');
    const hasSpring = nodes.some((n) => n.data?.type === 'spring');

    if (!hasMass) {
      return '从质量块开始吧！它代表舵叶的转动惯量。';
    }
    if (hasMass && !hasDamper) {
      return '如果没有海水阻力（阻尼），舵叶在受到扰动后会永远摆动下去，这符合物理规律吗？';
    }
    if (hasMass && hasDamper && !hasSpring) {
      return '液压系统有刚度，就像弹簧一样会产生回复力。';
    }
    return '很好！现在添加一个力源，代表液压马达的驱动力矩。';
  }, [nodes]);

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-500">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">机械建模工坊</h2>
              <p className="text-sm text-slate-400">
                搭建舵机系统的弹簧-质量-阻尼模型
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

            <button
              onClick={onNext}
              disabled={!isComplete}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isComplete
                  ? 'bg-red-500 text-white hover:bg-red-400'
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
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-red-500/20 text-xs text-red-500">
              🔧
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">
                任务：为052D驱逐舰舵机系统建立等效机械模型
              </p>
              <p className="text-xs text-slate-500">
                拖拽元件到画布，连接它们以建立微分方程。
              </p>
            </div>
          </div>
        </div>

        {/* 辅助提示（前测弱项时显示） */}
        {needsHelp && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>辅助模式已开启 - 根据前测结果提供额外提示</span>
            </div>
          </div>
        )}

        {/* 知识卡片入口 */}
        <div className="mt-2 flex justify-end">
          <button
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
              ? '牛顿定律与旋转体'
              : isKnowledgeCardLoading
                ? '知识卡片加载中...'
                : knowledgeCardError || '知识卡片暂不可用'}
          </button>
        </div>
      </div>

      {/* 主内容区：PhysicsBuilder */}
      <div className="flex-1">
        <PhysicsBuilder
          mode="mechanical"
          targetEquation="m\ddot{x} + f\dot{x} + kx = F"
          onModelChange={handleModelChange}
          onEquationChange={handleEquationChange}
          initialNodes={nodes}
          initialEdges={edges}
        />
      </div>

      {/* AI 提示浮窗 */}
      {showHint && (
        <div className="absolute bottom-24 right-4 z-10 max-w-sm animate-in fade-in slide-in-from-right-4">
          <div className="rounded-xl border border-amber-500/30 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                👨‍🏫
              </div>
              <div>
                <p className="text-xs font-medium text-amber-400">建模导师</p>
                <p className="mt-1 text-sm text-slate-300">{getAIHint()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提示按钮 */}
      <button
        onClick={() => setShowHint(!showHint)}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
      >
        <Lightbulb className="h-4 w-4" />
        {showHint ? '隐藏提示' : '需要提示？'}
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
