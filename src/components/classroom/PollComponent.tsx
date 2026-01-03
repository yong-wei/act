'use client';

/**
 * PollComponent - 课堂投票组件
 *
 * 支持：
 * - 实时投票收集
 * - 静态柱状图展示结果
 * - 编辑模式下配置问题和选项
 * - 多选/单选模式
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Vote,
  Settings,
  Plus,
  Trash2,
  Check,
  Clock,
  Users,
  BarChart3,
} from 'lucide-react';
import type {
  PollComponentConfig,
  BaseClassroomComponentProps,
  PollOption,
  PollResult,
  PollState,
} from './types';

type PollComponentProps = BaseClassroomComponentProps<PollComponentConfig>;

// ========== 默认颜色 ==========

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
];

// ========== 编辑模式组件 ==========

function PollEditor({
  config,
  onConfigChange,
}: {
  config: PollComponentConfig;
  onConfigChange?: (config: PollComponentConfig) => void;
}) {
  const updateConfig = (updates: Partial<PollComponentConfig>) => {
    onConfigChange?.({ ...config, ...updates });
  };

  const updateOption = (index: number, updates: Partial<PollOption>) => {
    const newOptions = [...config.options];
    newOptions[index] = { ...newOptions[index], ...updates };
    updateConfig({ options: newOptions });
  };

  const addOption = () => {
    const key = String.fromCharCode(65 + config.options.length); // A, B, C, D...
    const newOption: PollOption = {
      key,
      text: '',
      color: DEFAULT_COLORS[config.options.length % DEFAULT_COLORS.length],
    };
    updateConfig({ options: [...config.options, newOption] });
  };

  const removeOption = (index: number) => {
    if (config.options.length <= 2) return; // 至少保留2个选项
    const newOptions = config.options.filter((_, i) => i !== index);
    // 重新分配key
    const reindexed = newOptions.map((opt, i) => ({
      ...opt,
      key: String.fromCharCode(65 + i),
    }));
    updateConfig({ options: reindexed });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 text-blue-400 mb-4">
        <Settings className="h-4 w-4" />
        <span className="font-medium">投票组件配置</span>
      </div>

      {/* 问题 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">投票问题</label>
        <textarea
          value={config.question}
          onChange={(e) => updateConfig({ question: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
          rows={2}
          placeholder="输入投票问题..."
        />
      </div>

      {/* 选项列表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">选项列表</label>
          <button
            onClick={addOption}
            disabled={config.options.length >= 6}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
            添加选项
          </button>
        </div>
        <div className="space-y-2">
          {config.options.map((option, index) => (
            <div key={option.key} className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: option.color || DEFAULT_COLORS[index] }}
              >
                {option.key}
              </div>
              <input
                type="text"
                value={option.text}
                onChange={(e) => updateOption(index, { text: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
                placeholder={`选项 ${option.key} 内容`}
              />
              <input
                type="color"
                value={option.color || DEFAULT_COLORS[index]}
                onChange={(e) => updateOption(index, { color: e.target.value })}
                className="w-8 h-8 rounded border border-slate-600 cursor-pointer"
                title="选项颜色"
              />
              <button
                onClick={() => removeOption(index)}
                disabled={config.options.length <= 2}
                className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 选项 */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.multiSelect || false}
            onChange={(e) => updateConfig({ multiSelect: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-blue-500"
          />
          允许多选
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.anonymous || false}
            onChange={(e) => updateConfig({ anonymous: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-blue-500"
          />
          匿名投票
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.showLiveResults || false}
            onChange={(e) => updateConfig({ showLiveResults: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-blue-500"
          />
          实时显示结果
        </label>
      </div>

      {/* 时限 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          投票时限（秒，0表示无限制）
        </label>
        <input
          type="number"
          value={config.timeLimit || 0}
          onChange={(e) => updateConfig({ timeLimit: parseInt(e.target.value) || 0 })}
          className="w-32 px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
          min={0}
          max={300}
        />
      </div>
    </div>
  );
}

// ========== 柱状图组件 ==========

function BarChart({
  results,
  options,
}: {
  results: PollResult[];
  options: PollOption[];
}) {
  const maxCount = Math.max(...results.map((r) => r.count), 1);

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const result = results.find((r) => r.optionKey === option.key);
        const count = result?.count || 0;
        const percentage = result?.percentage || 0;
        const barWidth = (count / maxCount) * 100;

        return (
          <div key={option.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: option.color || DEFAULT_COLORS[0] }}
                >
                  {option.key}
                </div>
                <span className="text-slate-300">{option.text}</span>
              </div>
              <div className="text-slate-400">
                {count} 票 ({percentage.toFixed(1)}%)
              </div>
            </div>
            <div className="h-6 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: option.color || DEFAULT_COLORS[0],
                  minWidth: count > 0 ? '2rem' : '0',
                }}
              >
                {count > 0 && (
                  <span className="text-xs font-medium text-white">{count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== 播放模式组件 ==========

function PollPlayer({
  config,
  classroomSession,
  userId,
}: {
  config: PollComponentConfig;
  classroomSession?: string;
  userId?: string;
}) {
  const [pollState, setPollState] = useState<PollState>({
    results: config.options.map((opt) => ({
      optionKey: opt.key,
      count: 0,
      percentage: 0,
    })),
    totalVotes: 0,
    hasVoted: false,
    isClosed: false,
  });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(config.timeLimit || 0);

  // 模拟获取投票数据
  useEffect(() => {
    // TODO: 实际实现应从API获取
    // 这里使用模拟数据
    if (config.showLiveResults) {
      // 模拟一些初始投票
      const mockResults: PollResult[] = config.options.map((opt, i) => ({
        optionKey: opt.key,
        count: Math.floor(Math.random() * 10),
        percentage: 0,
      }));
      const total = mockResults.reduce((sum, r) => sum + r.count, 0);
      mockResults.forEach((r) => {
        r.percentage = total > 0 ? (r.count / total) * 100 : 0;
      });
      setPollState((prev) => ({
        ...prev,
        results: mockResults,
        totalVotes: total,
      }));
    }
  }, [config.options, config.showLiveResults]);

  // 倒计时
  useEffect(() => {
    if (config.timeLimit && config.timeLimit > 0 && !pollState.isClosed) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setPollState((s) => ({ ...s, isClosed: true }));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [config.timeLimit, pollState.isClosed]);

  const handleOptionClick = (key: string) => {
    if (pollState.hasVoted || pollState.isClosed) return;

    if (config.multiSelect) {
      setSelectedOptions((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    } else {
      setSelectedOptions([key]);
    }
  };

  const handleSubmit = useCallback(() => {
    if (selectedOptions.length === 0 || pollState.hasVoted) return;

    // 更新结果
    const newResults = [...pollState.results];
    selectedOptions.forEach((key) => {
      const result = newResults.find((r) => r.optionKey === key);
      if (result) {
        result.count += 1;
      }
    });
    const total = newResults.reduce((sum, r) => sum + r.count, 0);
    newResults.forEach((r) => {
      r.percentage = total > 0 ? (r.count / total) * 100 : 0;
    });

    setPollState((prev) => ({
      ...prev,
      results: newResults,
      totalVotes: total,
      hasVoted: true,
      userChoice: selectedOptions,
    }));

    // TODO: 实际实现应提交到API
  }, [selectedOptions, pollState]);

  const showResults = pollState.hasVoted || pollState.isClosed || config.showLiveResults;

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-white">课堂投票</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {config.timeLimit && config.timeLimit > 0 && !pollState.isClosed && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{timeRemaining}s</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{pollState.totalVotes} 人</span>
          </div>
        </div>
      </div>

      {/* 问题 */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h3 className="text-lg font-medium text-white">{config.question}</h3>
        {config.multiSelect && (
          <p className="text-sm text-slate-500 mt-1">可多选</p>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!pollState.hasVoted && !pollState.isClosed ? (
          // 投票选项
          <div className="space-y-3">
            {config.options.map((option) => {
              const isSelected = selectedOptions.includes(option.key);
              return (
                <button
                  key={option.key}
                  onClick={() => handleOptionClick(option.key)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold ${
                      isSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''
                    }`}
                    style={{ backgroundColor: option.color || DEFAULT_COLORS[0] }}
                  >
                    {option.key}
                  </div>
                  <span className="text-slate-200 flex-1 text-left">{option.text}</span>
                  {isSelected && <Check className="h-5 w-5 text-blue-400" />}
                </button>
              );
            })}

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={selectedOptions.length === 0}
              className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {selectedOptions.length === 0 ? '请选择选项' : '提交投票'}
            </button>
          </div>
        ) : (
          // 结果展示
          <div className="space-y-6">
            {pollState.hasVoted && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <Check className="h-4 w-4" />
                <span>
                  已投票：
                  {pollState.userChoice?.map((k) => {
                    const opt = config.options.find((o) => o.key === k);
                    return opt?.text;
                  }).join('、')}
                </span>
              </div>
            )}

            {pollState.isClosed && !pollState.hasVoted && (
              <div className="text-center text-slate-500 py-4">
                投票已结束
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-slate-400">投票结果</span>
            </div>

            <BarChart results={pollState.results} options={config.options} />
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 主组件 ==========

export function PollComponent({
  mode,
  config,
  onConfigChange,
  classroomSession,
  userId,
}: PollComponentProps) {
  if (mode === 'edit') {
    return <PollEditor config={config} onConfigChange={onConfigChange} />;
  }

  return (
    <PollPlayer
      config={config}
      classroomSession={classroomSession}
      userId={userId}
    />
  );
}

// ========== 默认配置 ==========

export function createDefaultPollConfig(id: string): PollComponentConfig {
  return {
    id,
    type: 'poll',
    question: '请选择你的答案',
    options: [
      { key: 'A', text: '', color: DEFAULT_COLORS[0] },
      { key: 'B', text: '', color: DEFAULT_COLORS[1] },
      { key: 'C', text: '', color: DEFAULT_COLORS[2] },
      { key: 'D', text: '', color: DEFAULT_COLORS[3] },
    ],
    multiSelect: false,
    anonymous: true,
    showLiveResults: false,
    timeLimit: 0,
  };
}
