'use client';

/**
 * PresetLessonPreview - 预置教案预览组件
 *
 * 显示预置教案的详细信息和 BOPPPS 教学流程
 */

import { Fragment } from 'react';
import {
  X,
  Clock,
  Play,
  Copy,
  ChevronRight,
  Tag,
  Ship,
  Layers,
} from 'lucide-react';
import type { PresetLessonConfig, PresetLessonItem } from './types';
import { BOPPPS_STAGES } from './types';
import { BopppsStage } from '@prisma/client';

interface PresetLessonPreviewProps {
  preset: PresetLessonConfig;
  onClose: () => void;
  onUse: () => void;
  isCloning?: boolean;
}

export function PresetLessonPreview({
  preset,
  onClose,
  onUse,
  isCloning = false,
}: PresetLessonPreviewProps) {
  // 按 BOPPPS 阶段分组教案环节
  const groupedItems = groupItemsByStage(preset.items);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 头部 */}
        <div className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 p-6">
          <div className="flex items-start gap-4">
            {/* 图标 */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
              <Ship className="h-8 w-8 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{preset.title}</h2>
              <p className="mt-2 text-slate-400">{preset.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-slate-300">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  {preset.totalDuration} 分钟
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-300">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  {preset.items.length} 个环节
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {preset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs text-slate-300"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 教学流程时间轴 */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          <h3 className="mb-4 text-lg font-semibold text-white">BOPPPS 教学流程</h3>
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([stage, items]) => (
              <StageSection key={stage} stage={stage as BopppsStage} items={items} />
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              使用此模板将创建一份您自己的教案副本，您可以自由修改。
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                关闭
              </button>
              <button
                onClick={onUse}
                disabled={isCloning}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
              >
                {isCloning ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                使用此模板
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 按阶段分组教案环节
 */
function groupItemsByStage(
  items: PresetLessonItem[]
): Partial<Record<BopppsStage, PresetLessonItem[]>> {
  const groups: Partial<Record<BopppsStage, PresetLessonItem[]>> = {};

  items.forEach((item) => {
    if (!groups[item.stage]) {
      groups[item.stage] = [];
    }
    groups[item.stage]!.push(item);
  });

  // 按阶段顺序排序
  const stageOrder: BopppsStage[] = [
    'BRIDGE_IN',
    'OBJECTIVE',
    'PRE_ASSESSMENT',
    'PARTICIPATORY',
    'POST_ASSESSMENT',
    'SUMMARY',
  ];

  const orderedGroups: Partial<Record<BopppsStage, PresetLessonItem[]>> = {};
  stageOrder.forEach((stage) => {
    if (groups[stage]) {
      orderedGroups[stage] = groups[stage]!.sort((a, b) => a.order - b.order);
    }
  });

  return orderedGroups;
}

/**
 * 阶段区块组件
 */
interface StageSectionProps {
  stage: BopppsStage;
  items: PresetLessonItem[];
}

function StageSection({ stage, items }: StageSectionProps) {
  const stageInfo = BOPPPS_STAGES[stage];
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  return (
    <div className="relative">
      {/* 阶段标题 */}
      <div className="mb-3 flex items-center gap-3">
        <div className={`h-10 w-1 rounded-full ${stageInfo.color}`} />
        <div>
          <h4 className="font-semibold text-white">{stageInfo.label}</h4>
          <p className="text-xs text-slate-500">{stageInfo.description}</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-sm text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {totalDuration} 分钟
        </span>
      </div>

      {/* 环节列表 */}
      <div className="ml-5 space-y-2 border-l-2 border-slate-700 pl-4">
        {items.map((item, index) => (
          <div
            key={`${item.stage}-${item.order}`}
            className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:border-slate-600"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    {index + 1}
                  </span>
                  <h5 className="font-medium text-white">{item.title}</h5>
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-slate-400 ml-7">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {item.duration}分钟
              </div>
            </div>
            {/* 组件类型标识 */}
            <div className="mt-2 ml-7">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400">
                <Layers className="h-3 w-3" />
                {item.registryId}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
