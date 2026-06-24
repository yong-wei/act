'use client';

/**
 * Bridge-in Phase: 导入
 * 看不见的"骨架" - 透视舵机系统
 */

import { useState, useEffect } from 'react';
import { Eye, Ship, ChevronRight, AlertTriangle, Waves, BookOpen } from 'lucide-react';
import { KnowledgeSidebar } from '../../shared/knowledge-card';
import { useKnowledgeCard } from '../../shared/knowledge-cards-data';

interface BridgePhaseProps {
  onComplete: () => void;
}

export function BridgePhase({ onComplete }: BridgePhaseProps) {
  const [isTransparent, setIsTransparent] = useState(false);
  const [seaState, setSeaState] = useState(5);
  const [showAIMessage, setShowAIMessage] = useState(false);
  const [showKnowledgeCard, setShowKnowledgeCard] = useState(false);

  // 获取知识卡片数据
  const {
    card: knowledgeCard,
    isLoading: isKnowledgeCardLoading,
    error: knowledgeCardError,
  } = useKnowledgeCard('数学模型_2_b21e01f6');

  // 延迟显示 AI 消息
  useEffect(() => {
    const timer = setTimeout(() => setShowAIMessage(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* 主场景区 - 3D 占位 */}
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
        {/* 3D 场景占位符 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`relative transition-opacity duration-1000 ${isTransparent ? 'opacity-30' : 'opacity-100'}`}
          >
            {/* 驱逐舰占位图 */}
            <div className="relative h-64 w-96 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Ship className="mb-4 h-24 w-24 text-slate-500" />
                <p className="text-sm text-slate-500">052D 驱逐舰 3D 模型</p>
                <p className="mt-1 text-xs text-slate-600">(scene-destroyer-rough-sea)</p>
              </div>

              {/* 海浪动画指示 */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 pb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Waves
                    key={i}
                    className={`h-4 w-4 text-blue-400/50 ${
                      i < seaState ? 'animate-pulse' : 'opacity-30'
                    }`}
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>

            {/* 舵机高亮层 */}
            {isTransparent && (
              <div className="absolute bottom-8 right-8 animate-pulse rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-2">
                <p className="text-sm font-medium text-amber-400">电液伺服舵机</p>
              </div>
            )}
          </div>
        </div>

        {/* HUD 面板 */}
        <div className="absolute left-4 top-4 rounded-xl border border-red-500/30 bg-slate-900/90 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">航向误差</span>
          </div>
          <div className="mt-2 text-3xl font-bold text-red-500">15°</div>
          <div className="mt-1 text-xs text-red-400/70">(异常)</div>
        </div>

        {/* 海况控制 */}
        <div className="absolute right-4 top-4 rounded-xl border border-slate-700 bg-slate-900/90 p-4 backdrop-blur">
          <div className="mb-2 text-xs text-slate-400">海况等级</div>
          <div className="flex items-center gap-2">
            <input aria-label="桥接阶段作答"
              type="range"
              min="1"
              max="9"
              value={seaState}
              onChange={(e) => setSeaState(parseInt(e.target.value))}
              className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-slate-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
            />
            <span className="w-6 text-center text-lg font-bold text-blue-400">
              {seaState}
            </span>
          </div>
        </div>

        {/* 透视按钮 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <button type="button"
            onClick={() => setIsTransparent(!isTransparent)}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all ${
              isTransparent
                ? 'bg-amber-500 text-slate-900'
                : 'border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="h-4 w-4" />
            {isTransparent ? '已透视' : '透视船体'}
          </button>
        </div>

        {/* 知识卡片按钮 */}
        <button type="button"
          onClick={() => setShowKnowledgeCard(!showKnowledgeCard)}
          disabled={!knowledgeCard}
          className={`absolute right-4 bottom-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            knowledgeCard
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          {knowledgeCard
            ? '为什么需要建模？'
            : isKnowledgeCardLoading
              ? '知识卡片加载中...'
              : knowledgeCardError || '知识卡片暂不可用'}
        </button>

        {/* 知识卡片侧边栏 */}
        {knowledgeCard && (
          <KnowledgeSidebar
            node={knowledgeCard}
            isOpen={showKnowledgeCard}
            onClose={() => setShowKnowledgeCard(false)}
            position="left"
          />
        )}
      </div>

      {/* AI 消息区 */}
      {showAIMessage && (
        <div className="border-t border-slate-800 bg-slate-900/50 p-4">
          <div className="mx-auto flex max-w-3xl items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xl">
              🔬
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-blue-400">系统分析师</span>
                <span className="text-xs text-slate-600">AI Agent</span>
              </div>
              <p className="text-sm text-slate-300">
                指挥官，航向不稳不仅是因为浪大，更是因为控制器不懂舵机的「脾气」（物理特性）。
                <span className="text-amber-400">我们需要为舵机建立数学档案。</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                点击「透视船体」按钮，查看隐藏在船体内部的舵机系统。
              </p>
            </div>
            <button type="button"
              onClick={onComplete}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
            >
              开始任务
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
