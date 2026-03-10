'use client';

/**
 * EthicalTrigger - 伦理熔断触发器组件
 *
 * 支持：
 * - 监测指标超出阈值时触发全屏警告
 * - 显示违规原因和相关法规
 * - 整改问答验证
 * - 可配置的触发条件和警告内容
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Settings,
  Plus,
  Trash2,
  X,
  ShieldAlert,
  CheckCircle,
  Volume2,
  HelpCircle,
} from 'lucide-react';
import type {
  EthicalTriggerConfig,
  BaseClassroomComponentProps,
  EthicalCondition,
  EthicalTriggerState,
} from './types';

type EthicalTriggerProps = BaseClassroomComponentProps<EthicalTriggerConfig> & {
  /** 外部传入的当前指标值 */
  metrics?: Record<string, number>;
  /** 熔断触发回调 */
  onTrigger?: (conditions: string[]) => void;
  /** 整改完成回调 */
  onRemediate?: () => void;
};

// ========== 运算符配置 ==========

const OPERATOR_LABELS: Record<string, string> = {
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  eq: '等于',
};

// ========== 编辑模式组件 ==========

function EthicalEditor({
  config,
  onConfigChange,
}: {
  config: EthicalTriggerConfig;
  onConfigChange?: (config: EthicalTriggerConfig) => void;
}) {
  const updateConfig = (updates: Partial<EthicalTriggerConfig>) => {
    onConfigChange?.({ ...config, ...updates });
  };

  const updateCondition = (index: number, updates: Partial<EthicalCondition>) => {
    const newConditions = [...config.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    updateConfig({ conditions: newConditions });
  };

  const addCondition = () => {
    const newCondition: EthicalCondition = {
      id: `cond-${Date.now()}`,
      metric: '',
      operator: 'gt',
      threshold: 0,
      unit: '',
    };
    updateConfig({ conditions: [...config.conditions, newCondition] });
  };

  const removeCondition = (index: number) => {
    updateConfig({ conditions: config.conditions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 text-red-400 mb-4">
        <Settings className="h-4 w-4" />
        <span className="font-medium">伦理熔断配置</span>
      </div>

      {/* 违规类型 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">违规类型标识</label>
        <input
          type="text"
          value={config.violationType}
          onChange={(e) => updateConfig({ violationType: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-red-500 focus:outline-none"
          placeholder="PASSENGER_SAFETY"
        />
      </div>

      {/* 触发条件 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">触发条件</label>
          <button
            onClick={addCondition}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
          >
            <Plus className="h-3 w-3" />
            添加条件
          </button>
        </div>
        <div className="space-y-2">
          {config.conditions.map((condition, index) => (
            <div key={condition.id} className="flex items-center gap-2">
              <input
                type="text"
                value={condition.metric}
                onChange={(e) => updateCondition(index, { metric: e.target.value })}
                className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
                placeholder="指标名称"
              />
              <select
                value={condition.operator}
                onChange={(e) =>
                  updateCondition(index, {
                    operator: e.target.value as EthicalCondition['operator'],
                  })
                }
                className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
              >
                {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                  <option key={op} value={op}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={condition.threshold}
                onChange={(e) =>
                  updateCondition(index, { threshold: parseFloat(e.target.value) || 0 })
                }
                className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
                placeholder="阈值"
                step="0.01"
              />
              <input
                type="text"
                value={condition.unit || ''}
                onChange={(e) => updateCondition(index, { unit: e.target.value })}
                className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-red-500 focus:outline-none"
                placeholder="单位"
              />
              <button
                onClick={() => removeCondition(index)}
                className="p-1.5 text-slate-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 警告内容 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">警告标题</label>
        <input
          type="text"
          value={config.warningTitle}
          onChange={(e) => updateConfig({ warningTitle: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-red-500 focus:outline-none"
          placeholder="严重违规！"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">警告消息</label>
        <textarea
          value={config.warningMessage}
          onChange={(e) => updateConfig({ warningMessage: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-red-500 focus:outline-none resize-none"
          rows={3}
          placeholder="详细的违规说明..."
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">相关法规（可选）</label>
        <input
          type="text"
          value={config.regulation || ''}
          onChange={(e) => updateConfig({ regulation: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-red-500 focus:outline-none"
          placeholder="如：SOLAS公约、ISO 2631标准"
        />
      </div>

      {/* 整改问题 */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <label className="block text-sm text-amber-400 mb-2">整改问题</label>
        <input
          type="text"
          value={config.remediation.question}
          onChange={(e) =>
            updateConfig({
              remediation: { ...config.remediation, question: e.target.value },
            })
          }
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-amber-500 focus:outline-none mb-2"
          placeholder="整改问题..."
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">正确答案</label>
            <input
              type="text"
              value={config.remediation.correctAnswer}
              onChange={(e) =>
                updateConfig({
                  remediation: { ...config.remediation, correctAnswer: e.target.value },
                })
              }
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="Kd"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">答案解释（可选）</label>
            <input
              type="text"
              value={config.remediation.explanation || ''}
              onChange={(e) =>
                updateConfig({
                  remediation: { ...config.remediation, explanation: e.target.value },
                })
              }
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="增大微分增益可以..."
            />
          </div>
        </div>
      </div>

      {/* 效果选项 */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.fullScreenAlert || false}
            onChange={(e) => updateConfig({ fullScreenAlert: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-red-500"
          />
          全屏变红
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.alertSound || false}
            onChange={(e) => updateConfig({ alertSound: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-red-500"
          />
          警报音效
        </label>
      </div>
    </div>
  );
}

// ========== 熔断警告覆盖层 ==========

function MeltdownOverlay({
  config,
  state,
  onAnswer,
  onDismiss,
}: {
  config: EthicalTriggerConfig;
  state: EthicalTriggerState;
  onAnswer: (answer: string) => void;
  onDismiss: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [isWrong, setIsWrong] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    const trimmedAnswer = answer.trim().toLowerCase();
    const correctAnswer = config.remediation.correctAnswer.toLowerCase();

    if (trimmedAnswer === correctAnswer) {
      setIsCorrect(true);
      setIsWrong(false);
      onAnswer(answer);
    } else {
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 500);
    }
  };

  if (isCorrect) {
    return (
      <div className="fixed inset-0 z-[100] bg-emerald-900/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <CheckCircle className="h-20 w-20 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">整改通过</h2>
          <p className="text-emerald-300 mb-4">
            {config.remediation.explanation || '回答正确，仿真已解锁'}
          </p>
          <button
            onClick={onDismiss}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            继续仿真
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-colors duration-300 ${
        config.fullScreenAlert ? 'bg-red-900/95' : 'bg-slate-900/95'
      } backdrop-blur-sm`}
    >
      {/* 警告内容 */}
      <div className="max-w-lg w-full mx-4">
        {/* 图标 */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
            <ShieldAlert className="h-12 w-12 text-red-400" />
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-center text-white mb-4">
          {config.warningTitle}
        </h1>

        {/* 消息 */}
        <p className="text-center text-slate-300 text-lg mb-4">
          {config.warningMessage}
        </p>

        {/* 法规 */}
        {config.regulation && (
          <p className="text-center text-red-400 text-sm mb-6">
            违反：{config.regulation}
          </p>
        )}

        {/* 当前指标值 */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <div className="text-sm text-slate-400 mb-2">触发条件:</div>
          <div className="space-y-1">
            {state.triggeredConditions.map((condId) => {
              const condition = config.conditions.find((c) => c.id === condId);
              if (!condition) return null;
              const currentValue = state.currentMetrics[condition.metric];
              return (
                <div key={condId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{condition.metric}</span>
                  <span className="text-red-400">
                    {currentValue?.toFixed(2)} {condition.unit} ({OPERATOR_LABELS[condition.operator]}{' '}
                    {condition.threshold} {condition.unit})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 违规计数 */}
        <div className="text-center text-slate-400 text-sm mb-6">
          本次仿真违规次数: <span className="text-red-400 font-bold">{state.violationCount}</span>
        </div>

        {/* 整改问题 */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-3">
            <HelpCircle className="h-4 w-4" />
            <span className="font-medium">整改问题</span>
          </div>
          <p className="text-white mb-3">{config.remediation.question}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className={`flex-1 px-4 py-2 bg-slate-900 border rounded-lg text-white focus:outline-none transition-colors ${
                isWrong
                  ? 'border-red-500 animate-shake'
                  : 'border-slate-600 focus:border-amber-500'
              }`}
              placeholder="输入答案..."
              autoFocus
            />
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
            >
              提交
            </button>
          </div>
          {isWrong && (
            <p className="text-red-400 text-sm mt-2">答案错误，请重试</p>
          )}
        </div>
      </div>

      {/* 音效图标 */}
      {config.alertSound && (
        <div className="absolute top-4 right-4">
          <Volume2 className="h-6 w-6 text-red-400 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ========== 播放模式组件（监控器） ==========

function EthicalMonitor({
  config,
  metrics = {},
  onTrigger,
  onRemediate,
}: {
  config: EthicalTriggerConfig;
  metrics?: Record<string, number>;
  onTrigger?: (conditions: string[]) => void;
  onRemediate?: () => void;
}) {
  const [state, setState] = useState<EthicalTriggerState>({
    isTriggered: false,
    triggeredConditions: [],
    currentMetrics: {},
    isRemediated: false,
    violationCount: 0,
  });

  // 检查条件
  const checkConditions = useCallback(() => {
    const triggered: string[] = [];

    config.conditions.forEach((condition) => {
      const value = metrics[condition.metric];
      if (value === undefined) return;

      let isViolated = false;
      switch (condition.operator) {
        case 'gt':
          isViolated = value > condition.threshold;
          break;
        case 'lt':
          isViolated = value < condition.threshold;
          break;
        case 'gte':
          isViolated = value >= condition.threshold;
          break;
        case 'lte':
          isViolated = value <= condition.threshold;
          break;
        case 'eq':
          isViolated = value === condition.threshold;
          break;
      }

      if (isViolated) {
        triggered.push(condition.id);
      }
    });

    return triggered;
  }, [config.conditions, metrics]);

  // 监控指标变化
  useEffect(() => {
    if (state.isTriggered) return; // 已触发时不再检查

    const triggered = checkConditions();
    if (triggered.length > 0) {
      setState((prev) => ({
        ...prev,
        isTriggered: true,
        triggeredConditions: triggered,
        currentMetrics: { ...metrics },
        violationCount: prev.violationCount + 1,
      }));
      onTrigger?.(triggered);
    }
  }, [metrics, checkConditions, state.isTriggered, onTrigger]);

  // 处理整改答案
  const handleAnswer = useCallback(
    (answer: string) => {
      setState((prev) => ({
        ...prev,
        isRemediated: true,
      }));
    },
    []
  );

  // 关闭覆盖层
  const handleDismiss = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTriggered: false,
      isRemediated: false,
      triggeredConditions: [],
    }));
    onRemediate?.();
  }, [onRemediate]);

  // 显示熔断覆盖层
  if (state.isTriggered && !state.isRemediated) {
    return (
      <MeltdownOverlay
        config={config}
        state={state}
        onAnswer={handleAnswer}
        onDismiss={handleDismiss}
      />
    );
  }

  // 正常状态下不渲染任何内容（作为覆盖层组件）
  return null;
}

// ========== 主组件 ==========

export function EthicalTrigger({
  mode,
  config,
  onConfigChange,
  metrics,
  onTrigger,
  onRemediate,
}: EthicalTriggerProps) {
  if (mode === 'edit') {
    return <EthicalEditor config={config} onConfigChange={onConfigChange} />;
  }

  return (
    <EthicalMonitor
      config={config}
      metrics={metrics}
      onTrigger={onTrigger}
      onRemediate={onRemediate}
    />
  );
}

// ========== 默认配置 ==========

export function createDefaultEthicalTriggerConfig(id: string): EthicalTriggerConfig {
  return {
    id,
    type: 'ethical-trigger',
    conditions: [
      {
        id: 'cond-1',
        metric: 'lateralAcceleration',
        operator: 'gt',
        threshold: 0.2,
        unit: 'g',
      },
    ],
    violationType: 'PASSENGER_SAFETY',
    warningTitle: '严重违规！',
    warningMessage: '侧向加速度超标，存在造成乘客受伤的风险。',
    regulation: 'SOLAS公约 & ISO 2631标准',
    remediation: {
      question: '为了降低加速度，我应该增大哪一个控制参数？',
      correctAnswer: 'Kd',
      explanation: '增大微分增益Kd可以增加系统阻尼，降低响应速度，从而减小加速度。',
    },
    alertSound: true,
    fullScreenAlert: true,
  };
}
