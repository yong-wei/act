'use client';

/**
 * ObjectiveCard - 学习目标卡片组件
 *
 * 支持：
 * - 展示知识/能力/素质三类目标
 * - 徽章解锁状态显示
 * - 编辑模式下的配置
 */

import { useId, useState } from 'react';
import {
  Target,
  Settings,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Brain,
  Zap,
  Heart,
  Trophy,
  Star,
  Medal,
  Award,
  Crown,
  Gem,
} from 'lucide-react';
import type {
  ObjectiveCardConfig,
  BaseClassroomComponentProps,
  ObjectiveItem,
  ObjectiveType,
} from './types';

type ObjectiveCardProps = BaseClassroomComponentProps<ObjectiveCardConfig>;

// ========== 图标映射 ==========

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  award: Award,
  crown: Crown,
  gem: Gem,
  brain: Brain,
  zap: Zap,
  heart: Heart,
  target: Target,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

// ========== 目标类型配置 ==========

const OBJECTIVE_TYPE_CONFIG: Record<
  ObjectiveType,
  { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }
> = {
  knowledge: {
    label: '知识目标',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: Brain,
  },
  ability: {
    label: '能力目标',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    icon: Zap,
  },
  value: {
    label: '素质目标',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    icon: Heart,
  },
};

// ========== 编辑模式组件 ==========

function ObjectiveEditor({
  config,
  onConfigChange,
}: {
  config: ObjectiveCardConfig;
  onConfigChange?: (config: ObjectiveCardConfig) => void;
}) {
  const idPrefix = useId();
  const titleInputId = `${idPrefix}-objective-title`;

  const updateConfig = (updates: Partial<ObjectiveCardConfig>) => {
    onConfigChange?.({ ...config, ...updates });
  };

  const updateObjective = (index: number, updates: Partial<ObjectiveItem>) => {
    const newObjectives = [...config.objectives];
    newObjectives[index] = { ...newObjectives[index], ...updates };
    updateConfig({ objectives: newObjectives });
  };

  const addObjective = (type: ObjectiveType) => {
    const newObjective: ObjectiveItem = {
      id: `obj-${Date.now()}`,
      type,
      description: '',
      badgeName: '',
      badgeIcon: 'trophy',
      unlocked: false,
    };
    updateConfig({ objectives: [...config.objectives, newObjective] });
  };

  const removeObjective = (index: number) => {
    updateConfig({ objectives: config.objectives.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 text-blue-400 mb-4">
        <Settings className="h-4 w-4" />
        <span className="font-medium">学习目标配置</span>
      </div>

      {/* 标题 */}
      <div>
        <label htmlFor={titleInputId} className="block text-sm text-slate-400 mb-1">卡片标题</label>
        <input id={titleInputId}
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
          placeholder="本节课学习目标"
        />
      </div>

      {/* 目标列表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-slate-400">目标列表</p>
          <div className="flex gap-2">
            {(['knowledge', 'ability', 'value'] as ObjectiveType[]).map((type) => {
              const typeConfig = OBJECTIVE_TYPE_CONFIG[type];
              return (
                <button type="button"
                  key={type}
                  onClick={() => addObjective(type)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs ${typeConfig.color} hover:bg-slate-700 rounded`}
                  title={`添加${typeConfig.label}`}
                >
                  <Plus className="h-3 w-3" />
                  {typeConfig.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {config.objectives.map((objective, index) => {
            const typeConfig = OBJECTIVE_TYPE_CONFIG[objective.type];
            const TypeIcon = typeConfig.icon;
            const objectiveIdPrefix = `${idPrefix}-objective-${objective.id || index}`;

            return (
              <div
                key={objective.id}
                className={`p-3 rounded-lg border ${typeConfig.bgColor}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                  <span className={`text-xs ${typeConfig.color}`}>{typeConfig.label}</span>
                  <button type="button"
                    onClick={() => removeObjective(index)}
                    className="ml-auto p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <textarea aria-label="目标描述..."
                  value={objective.description}
                  onChange={(e) => updateObjective(index, { description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-none mb-2"
                  rows={2}
                  placeholder="目标描述..."
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`${objectiveIdPrefix}-badge-name`} className="block text-xs text-slate-500 mb-1">徽章名称</label>
                    <input id={`${objectiveIdPrefix}-badge-name`} aria-label={'徽章名称'}
                      type="text"
                      value={objective.badgeName || ''}
                      onChange={(e) => updateObjective(index, { badgeName: e.target.value })}
                      className="w-full px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                      placeholder="如：建模大师"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${objectiveIdPrefix}-badge-icon`} className="block text-xs text-slate-500 mb-1">徽章图标</label>
                    <select id={`${objectiveIdPrefix}-badge-icon`}
                      value={objective.badgeIcon || 'trophy'}
                      onChange={(e) => updateObjective(index, { badgeIcon: e.target.value })}
                      className="w-full px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {config.objectives.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">
              点击上方按钮添加学习目标
            </div>
          )}
        </div>
      </div>

      {/* 选项 */}
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={config.showUnlockAnimation || false}
          onChange={(e) => updateConfig({ showUnlockAnimation: e.target.checked })}
          className="rounded border-slate-600 bg-slate-900 text-blue-500"
        />
        显示解锁动画
      </label>
    </div>
  );
}

// ========== 目标项组件 ==========

function ObjectiveItemCard({
  objective,
  showAnimation,
}: {
  objective: ObjectiveItem;
  showAnimation?: boolean;
}) {
  const typeConfig = OBJECTIVE_TYPE_CONFIG[objective.type];
  const TypeIcon = typeConfig.icon;
  const BadgeIcon = ICON_MAP[objective.badgeIcon || 'trophy'] || Trophy;

  return (
    <div
      className={`relative p-4 rounded-lg border transition-all duration-300 ${
        objective.unlocked
          ? `${typeConfig.bgColor} border-opacity-50`
          : 'bg-slate-800/30 border-slate-700'
      } ${showAnimation && objective.unlocked ? 'animate-pulse' : ''}`}
    >
      {/* 锁定/解锁状态 */}
      <div className="absolute top-3 right-3">
        {objective.unlocked ? (
          <Unlock className="h-4 w-4 text-emerald-400" />
        ) : (
          <Lock className="h-4 w-4 text-slate-500" />
        )}
      </div>

      {/* 目标类型 */}
      <div className="flex items-center gap-2 mb-2">
        <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
        <span className={`text-xs font-medium ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
      </div>

      {/* 目标描述 */}
      <p
        className={`text-sm leading-relaxed ${
          objective.unlocked ? 'text-slate-200' : 'text-slate-400'
        }`}
      >
        {objective.description}
      </p>

      {/* 徽章 */}
      {objective.badgeName && (
        <div
          className={`mt-3 flex items-center gap-2 ${
            objective.unlocked ? '' : 'opacity-50'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              objective.unlocked
                ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                : 'bg-slate-700'
            }`}
          >
            <BadgeIcon
              className={`h-4 w-4 ${
                objective.unlocked ? 'text-white' : 'text-slate-500'
              }`}
            />
          </div>
          <div>
            <div
              className={`text-xs ${
                objective.unlocked ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              {objective.unlocked ? '已解锁' : '待解锁'}
            </div>
            <div
              className={`text-sm font-medium ${
                objective.unlocked ? 'text-white' : 'text-slate-400'
              }`}
            >
              {objective.badgeName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 播放模式组件 ==========

function ObjectivePlayer({ config }: { config: ObjectiveCardConfig }) {
  // 防御性检查：确保 objectives 存在
  const objectives = config?.objectives ?? [];
  const isValidConfig = objectives.length > 0;

  // 按类型分组
  const grouped = {
    knowledge: objectives.filter((o) => o.type === 'knowledge'),
    ability: objectives.filter((o) => o.type === 'ability'),
    value: objectives.filter((o) => o.type === 'value'),
  };

  const unlockedCount = objectives.filter((o) => o.unlocked).length;
  const totalCount = objectives.length;

  // 如果配置无效，显示错误提示
  if (!isValidConfig) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-xl">
        <div className="text-center text-slate-400">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>学习目标配置不完整</p>
          <p className="text-sm text-slate-500 mt-1">请在编辑模式下配置学习目标</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-white">{config.title}</span>
        </div>
        <div className="text-sm text-slate-400">
          {unlockedCount}/{totalCount} 已解锁
        </div>
      </div>

      {/* 进度条 */}
      <div className="px-4 py-2 border-b border-slate-800">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* 目标列表 */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {(['knowledge', 'ability', 'value'] as ObjectiveType[]).map((type) => {
          const objectives = grouped[type];
          if (objectives.length === 0) return null;

          const typeConfig = OBJECTIVE_TYPE_CONFIG[type];
          const TypeIcon = typeConfig.icon;

          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                <span className={`text-sm font-medium ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              </div>
              <div className="space-y-3">
                {objectives.map((objective) => (
                  <ObjectiveItemCard
                    key={objective.id}
                    objective={objective}
                    showAnimation={config.showUnlockAnimation}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== 主组件 ==========

export function ObjectiveCard({
  mode,
  config,
  onConfigChange,
}: ObjectiveCardProps) {
  if (mode === 'edit') {
    return <ObjectiveEditor config={config} onConfigChange={onConfigChange} />;
  }

  return <ObjectivePlayer config={config} />;
}

// ========== 默认配置 ==========

export function createDefaultObjectiveConfig(id: string): ObjectiveCardConfig {
  return {
    id,
    type: 'objective',
    title: '本节课学习目标',
    objectives: [
      {
        id: 'obj-1',
        type: 'knowledge',
        description: '能准确阐述核心概念与原理',
        badgeName: '知识达人',
        badgeIcon: 'brain',
        unlocked: false,
      },
      {
        id: 'obj-2',
        type: 'ability',
        description: '能在实际场景中应用所学知识',
        badgeName: '实践高手',
        badgeIcon: 'zap',
        unlocked: false,
      },
      {
        id: 'obj-3',
        type: 'value',
        description: '能在工程决策中考虑伦理因素',
        badgeName: '责任工程师',
        badgeIcon: 'heart',
        unlocked: false,
      },
    ],
    showUnlockAnimation: true,
  };
}
