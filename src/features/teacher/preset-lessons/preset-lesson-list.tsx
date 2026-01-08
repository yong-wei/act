'use client';

/**
 * PresetLessonList - 预置教案列表组件
 *
 * 展示所有可用的预置教案，支持预览和使用模板功能
 */

import { useState } from 'react';
import {
  Clock,
  Play,
  Eye,
  Copy,
  Ship,
  Tag,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { ALL_PRESETS } from './presets/cruise-comfort';
import { PresetLessonPreview } from './preset-lesson-preview';
import type { PresetLessonConfig, PresetLessonSummary } from './types';
import { BOPPPS_STAGES } from './types';
import { BopppsStage } from '@prisma/client';

interface PresetLessonListProps {
  onUseTemplate?: (preset: PresetLessonConfig) => void;
}

export function PresetLessonList({ onUseTemplate }: PresetLessonListProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetLessonConfig | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  /**
   * 计算教案摘要信息
   */
  const getPresetSummary = (preset: PresetLessonConfig): PresetLessonSummary => {
    const stageCount: Record<BopppsStage, number> = {
      BRIDGE_IN: 0,
      OBJECTIVE: 0,
      PRE_ASSESSMENT: 0,
      PARTICIPATORY: 0,
      POST_ASSESSMENT: 0,
      SUMMARY: 0,
    };

    preset.items.forEach((item) => {
      stageCount[item.stage]++;
    });

    return {
      key: preset.key,
      title: preset.title,
      description: preset.description,
      totalDuration: preset.totalDuration,
      thumbnail: preset.thumbnail,
      tags: preset.tags,
      stageCount,
    };
  };

  /**
   * 克隆预置教案到教师自己的教案
   */
  const handleClone = async (preset: PresetLessonConfig) => {
    setIsCloning(true);
    try {
      const response = await fetch('/api/teacher/preset-lessons/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetKey: preset.key }),
      });

      if (!response.ok) {
        throw new Error('克隆失败');
      }

      const result = await response.json();

      // 跳转到编辑页面
      window.location.href = `/teacher/lesson-plans/${result.lessonPlanId}/edit`;
    } catch (error) {
      console.error('克隆预置教案失败:', error);
      alert('克隆失败，请重试');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面说明 */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-cyan-300">什么是预置教案？</h3>
            <p className="mt-1 text-sm text-slate-400">
              预置教案是由平台精心设计的教学模板，包含完整的 BOPPPS 教学流程和互动组件。
              您可以直接使用这些模板开始上课，或将其克隆为自己的教案进行修改。
            </p>
          </div>
        </div>
      </div>

      {/* 预置教案网格 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ALL_PRESETS.map((preset) => {
          const summary = getPresetSummary(preset);
          return (
            <PresetCard
              key={preset.key}
              preset={preset}
              summary={summary}
              onPreview={() => setSelectedPreset(preset)}
              onClone={() => handleClone(preset)}
              isCloning={isCloning}
            />
          );
        })}
      </div>

      {/* 空状态 */}
      {ALL_PRESETS.length === 0 && (
        <div className="py-16 text-center">
          <Ship className="mx-auto h-16 w-16 text-slate-600" />
          <p className="mt-4 text-slate-500">暂无预置教案</p>
        </div>
      )}

      {/* 预览弹窗 */}
      {selectedPreset && (
        <PresetLessonPreview
          preset={selectedPreset}
          onClose={() => setSelectedPreset(null)}
          onUse={() => handleClone(selectedPreset)}
          isCloning={isCloning}
        />
      )}
    </div>
  );
}

/**
 * 预置教案卡片组件
 */
interface PresetCardProps {
  preset: PresetLessonConfig;
  summary: PresetLessonSummary;
  onPreview: () => void;
  onClone: () => void;
  isCloning: boolean;
}

function PresetCard({ preset, summary, onPreview, onClone, isCloning }: PresetCardProps) {
  return (
    <div className="group rounded-2xl border border-slate-700 bg-slate-800/50 p-5 transition-all hover:border-cyan-500/50 hover:bg-slate-800">
      {/* 缩略图区域 */}
      <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-800">
        {preset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preset.thumbnail}
            alt={preset.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Ship className="h-16 w-16 text-slate-500" />
          </div>
        )}
        {/* 时长标签 */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
          <Clock className="h-3 w-3" />
          <span>{preset.totalDuration} 分钟</span>
        </div>
      </div>

      {/* 标题和描述 */}
      <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
        {preset.title}
      </h3>
      <p className="mt-2 text-sm text-slate-400 line-clamp-2">{preset.description}</p>

      {/* 标签 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {preset.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300"
          >
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </span>
        ))}
      </div>

      {/* BOPPPS 阶段统计 */}
      <div className="mt-4 flex items-center gap-1">
        {Object.entries(summary.stageCount)
          .filter(([, count]) => count > 0)
          .map(([stage, count]) => (
            <div
              key={stage}
              className={`h-2 flex-1 rounded-full ${BOPPPS_STAGES[stage as BopppsStage].color} opacity-60`}
              title={`${BOPPPS_STAGES[stage as BopppsStage].label}: ${count} 个环节`}
            />
          ))}
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onPreview}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <Eye className="h-4 w-4" />
          预览
        </button>
        <button
          onClick={onClone}
          disabled={isCloning}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
        >
          {isCloning ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
          使用模板
        </button>
      </div>
    </div>
  );
}
