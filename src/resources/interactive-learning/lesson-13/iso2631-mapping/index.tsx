'use client';

/**
 * ISO2631MappingCard - ISO 2631标准映射知识卡片
 *
 * 学习主题：控制指标与用户体验的映射
 * 展示控制系统术语与乘客舒适度指标的对应关系：
 * - 超调量 σ% → 晕船指数 MSI
 * - 调节时间 ts → 避障窗口期
 * - 加速度 a → 物品滑落/老人摔倒风险
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight,
  TrendingUp,
  Clock,
  Gauge,
  AlertTriangle,
  Info,
  Ship,
  Heart,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ISO_2631_MAPPINGS, type ComfortMapping } from '../types';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface MappingCardProps {
  mapping: ComfortMapping;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}

function MappingCard({ mapping, isExpanded, onToggle, index }: MappingCardProps) {
  // 不同映射的图标和颜色配置
  const iconConfigs = [
    { icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { icon: Gauge, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  ];

  const config = iconConfigs[index] || iconConfigs[0];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-300 overflow-hidden ${config.border} ${
        isExpanded ? 'shadow-lg' : 'hover:shadow-md'
      }`}
    >
      {/* 卡片头部 - 可点击展开 */}
      <button type="button"
        onClick={onToggle}
        className={`w-full p-4 flex items-center justify-between ${config.bg} transition-colors hover:opacity-90`}
      >
        <div className="flex items-center gap-4">
          {/* 控制指标 */}
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-900">{mapping.controlMetric}</div>
              <div className="text-sm font-mono text-slate-600">{mapping.controlSymbol}</div>
            </div>
          </div>

          {/* 箭头 */}
          <ArrowRight className="h-5 w-5 text-slate-400 mx-2" />

          {/* 用户体验 */}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Heart className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-900">{mapping.userExperience}</div>
            </div>
          </div>
        </div>

        {/* 展开/收起按钮 */}
        <div className={`p-1 rounded-full transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          )}
        </div>
      </button>

      {/* 展开的详情内容 */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* 描述 */}
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-slate-700">{mapping.description}</p>
          </div>

          {/* 阈值警告 */}
          {mapping.threshold && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">{mapping.threshold}</p>
            </div>
          )}

          {/* 实际应用示例 */}
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <Ship className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              {index === 0 && (
                <span>
                  在爱达·魔都号的宴会厅中，当船舶转向产生的横摇超调量过大时，
                  乘客会感到明显的眩晕不适，这直接体现在晕船指数(MSI)的上升。
                </span>
              )}
              {index === 1 && (
                <span>
                  紧急避障时，船舶需要在有限的时间窗口内完成转向。
                  调节时间决定了船舶能否及时避开障碍物，同时保持乘客舒适度。
                </span>
              )}
              {index === 2 && (
                <span>
                  快速转向会产生侧向加速度。当加速度超过0.15g时，餐桌上的香槟杯会滑动；
                  超过0.2g时，站立的老年乘客有摔倒风险。
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface ISO2631MappingCardProps extends BaseWidgetProps {
  /** 是否显示互动提示 */
  showHints?: boolean;
  /** 初始展开的卡片索引 */
  initialExpanded?: number;
  /** 紧凑模式 */
  compact?: boolean;
}

export function ISO2631MappingCard({
  showHints = true,
  initialExpanded = 0,
  compact = false,
  onComplete,
  onStateChange,
}: ISO2631MappingCardProps) {
  const interactive = useOptionalInteractiveContext();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialExpanded);
  const [visitedIndices, setVisitedIndices] = useState<number[]>(
    Number.isFinite(initialExpanded) ? [initialExpanded] : []
  );

  const handleToggle = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
    setVisitedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
    interactive?.tracking.emit('interact', { mappingIndex: index });
  }, [interactive]);

  useEffect(() => {
    if (!visitedIndices.length) return;
    const progressValue = Math.round((visitedIndices.length / ISO_2631_MAPPINGS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { visitedCount: visitedIndices.length, total: ISO_2631_MAPPINGS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);

    if (visitedIndices.length === ISO_2631_MAPPINGS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: snapshot.data,
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [visitedIndices, onComplete, onStateChange, interactive]);

  return (
    <div className={`w-full ${compact ? 'max-w-2xl' : 'max-w-4xl'} mx-auto`}>
      {/* 标题区域 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          ISO 2631-1 舒适度标准映射
        </h2>
        <p className="text-slate-600">
          理解控制系统性能指标如何影响乘客的实际体验
        </p>
      </div>

      {/* 映射卡片列表 */}
      <div className="space-y-4">
        {ISO_2631_MAPPINGS.map((mapping, index) => (
          <MappingCard
            key={mapping.controlMetric}
            mapping={mapping}
            isExpanded={expandedIndex === index}
            onToggle={() => handleToggle(index)}
            index={index}
          />
        ))}
      </div>

      {/* 知识要点提示 */}
      {showHints && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">知识要点</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 控制系统的每个性能指标都对应着真实的用户体验</li>
                <li>• 超调量、调节时间和加速度是影响舒适度的三个关键指标</li>
                <li>• 好的控制设计需要在响应速度和舒适度之间找到平衡</li>
                <li>• ISO 2631-1是国际通用的人体振动舒适度评价标准</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 交互式可视化区域 */}
      <div className="mt-6">
        <MappingVisualization />
      </div>
    </div>
  );
}

/**
 * 交互式映射可视化
 * 展示控制指标与舒适度的定量关系
 */
function MappingVisualization() {
  const [overshoot, setOvershoot] = useState(15);
  const [settlingTime, setSettlingTime] = useState(45);
  const [acceleration, setAcceleration] = useState(0.12);

  // 计算晕船指数 (简化公式)
  const calculateMSI = (sigma: number): number => {
    // 基于超调量的简化MSI计算
    return Math.min(100, sigma * 2.5);
  };

  // 评估加速度风险
  const getAccelRisk = (accel: number): { level: string; color: string } => {
    if (accel < 0.1) return { level: '安全', color: 'text-emerald-600' };
    if (accel < 0.15) return { level: '轻微风险', color: 'text-yellow-600' };
    if (accel < 0.2) return { level: '中等风险', color: 'text-amber-600' };
    return { level: '高风险', color: 'text-red-600' };
  };

  // 评估调节时间
  const getSettlingRating = (ts: number): { level: string; color: string } => {
    if (ts <= 30) return { level: '优秀', color: 'text-emerald-600' };
    if (ts <= 45) return { level: '良好', color: 'text-blue-600' };
    if (ts <= 60) return { level: '及格', color: 'text-amber-600' };
    return { level: '过慢', color: 'text-red-600' };
  };

  const msi = calculateMSI(overshoot);
  const accelRisk = getAccelRisk(acceleration);
  const settlingRating = getSettlingRating(settlingTime);

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Gauge className="h-5 w-5 text-slate-600" />
        交互式参数探索
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 超调量滑块 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">超调量 σ%</span>
            <span className="font-mono font-medium">{overshoot}%</span>
          </div>
          <input aria-label="ISO 2631 频率"
            type="range"
            min={0}
            max={40}
            step={1}
            value={overshoot}
            onChange={(e) => setOvershoot(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <div className="text-center">
            <span className="text-xs text-slate-500">晕船指数: </span>
            <span
              className={`text-sm font-semibold ${
                msi < 20 ? 'text-emerald-600' : msi < 40 ? 'text-amber-600' : 'text-red-600'
              }`}
            >
              {msi.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* 调节时间滑块 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">调节时间 ts</span>
            <span className="font-mono font-medium">{settlingTime}s</span>
          </div>
          <input aria-label="ISO 2631 加速度"
            type="range"
            min={10}
            max={90}
            step={5}
            value={settlingTime}
            onChange={(e) => setSettlingTime(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="text-center">
            <span className="text-xs text-slate-500">避障评级: </span>
            <span className={`text-sm font-semibold ${settlingRating.color}`}>
              {settlingRating.level}
            </span>
          </div>
        </div>

        {/* 加速度滑块 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">侧向加速度</span>
            <span className="font-mono font-medium">{acceleration.toFixed(2)}g</span>
          </div>
          <input aria-label="ISO 2631 暴露时间"
            type="range"
            min={0}
            max={0.3}
            step={0.01}
            value={acceleration}
            onChange={(e) => setAcceleration(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="text-center">
            <span className="text-xs text-slate-500">安全评估: </span>
            <span className={`text-sm font-semibold ${accelRisk.color}`}>{accelRisk.level}</span>
          </div>
        </div>
      </div>

      {/* 综合评价 */}
      <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">综合舒适度评价</span>
          <div className="flex items-center gap-2">
            {msi < 30 && acceleration < 0.15 && settlingTime <= 60 ? (
              <>
                <span className="text-emerald-600 font-semibold">✓ 满足舒适度要求</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600 font-semibold">需要优化控制参数</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ISO2631MappingCard;
