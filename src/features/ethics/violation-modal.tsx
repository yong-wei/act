'use client';

/**
 * ViolationModal - 伦理违规全屏模态框
 *
 * 当仿真触发伦理红线时显示，要求学生输入整改方案后才能继续
 */

import { useState, useCallback } from 'react';
import { type EthicalViolation, type ViolationType } from '@/resources/simulations/types';
import { VIOLATION_DESCRIPTIONS, VIOLATION_SEVERITY, ETHICS_SCORE_DEDUCTION } from '@/lib/constants/ethics';
import { Button } from '@/components/ui/button';

interface ViolationModalProps {
  violation: EthicalViolation;
  aiCritique?: string; // AI 生成的风险描述
  onSubmit: (justification: string) => Promise<void>;
  isLoading?: boolean;
}

export function ViolationModal({ violation, aiCritique, onSubmit, isLoading = false }: ViolationModalProps) {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);

  const description = VIOLATION_DESCRIPTIONS[violation.type] || {
    title: '安全违规警告',
    consequence: '发生安全违规行为。',
    suggestion: '请分析原因并提出整改方案。',
  };

  const severity = VIOLATION_SEVERITY[violation.type] || 'HIGH';
  const deduction = ETHICS_SCORE_DEDUCTION[severity];

  const handleSubmit = useCallback(async () => {
    if (justification.trim().length < 10) {
      setError('整改方案至少需要10个字符');
      return;
    }

    setError(null);
    try {
      await onSubmit(justification.trim());
    } catch (e) {
      setError('提交失败，请重试');
    }
  }, [justification, onSubmit]);

  const getSeverityColor = () => {
    switch (severity) {
      case 'CRITICAL':
        return 'from-red-900 via-red-800 to-red-900';
      case 'HIGH':
        return 'from-red-800 via-red-700 to-red-800';
      case 'MEDIUM':
        return 'from-orange-800 via-orange-700 to-orange-800';
      default:
        return 'from-yellow-800 via-yellow-700 to-yellow-800';
    }
  };

  const getSeverityLabel = () => {
    switch (severity) {
      case 'CRITICAL':
        return '严重违规';
      case 'HIGH':
        return '高风险违规';
      case 'MEDIUM':
        return '中等违规';
      default:
        return '轻微违规';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br ${getSeverityColor()} p-4`}>
      {/* 警告闪烁边框 */}
      <div className="absolute inset-0 animate-pulse border-8 border-red-500/50" />

      {/* 警告图标 */}
      <div className="absolute left-8 top-8 flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/30">
          <svg
            className="h-10 w-10 text-red-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-red-200">伦理熔断触发</p>
          <p className="text-sm text-red-300">仿真已暂停</p>
        </div>
      </div>

      {/* 伦理分扣减提示 */}
      <div className="absolute right-8 top-8 rounded-lg bg-red-950/80 px-4 py-2">
        <p className="text-sm text-red-300">伦理分扣减</p>
        <p className="text-3xl font-bold text-red-400">-{deduction}</p>
      </div>

      {/* 主内容区 */}
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-950/95 shadow-2xl">
        {/* 标题栏 */}
        <div className="border-b border-red-800/50 bg-red-950/50 px-8 py-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
              {getSeverityLabel()}
            </span>
            <h2 className="text-2xl font-bold text-red-100">{description.title}</h2>
          </div>
        </div>

        {/* 内容区 */}
        <div className="space-y-6 p-8">
          {/* 违规数据 */}
          <div className="rounded-lg bg-red-950/30 p-4">
            <h3 className="mb-3 text-sm font-semibold text-red-300">违规数据</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-red-400">安全阈值</p>
                <p className="text-xl font-bold text-white">{violation.thresholdValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-red-400">实际数值</p>
                <p className="text-xl font-bold text-red-300">{violation.actualValue.toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-red-400">发生时间</p>
                <p className="text-white">仿真第 {violation.timestamp.toFixed(1)} 秒</p>
              </div>
            </div>
          </div>

          {/* 风险后果 */}
          <div className="rounded-lg bg-slate-900/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-amber-400">风险后果</h3>
            <p className="text-slate-300">{description.consequence}</p>
          </div>

          {/* AI 分析（如果有） */}
          {aiCritique && (
            <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                AI 总工分析
              </h3>
              <p className="text-amber-100/90">{aiCritique}</p>
            </div>
          )}

          {/* 整改建议 */}
          <div className="rounded-lg bg-emerald-950/30 p-4">
            <h3 className="mb-2 text-sm font-semibold text-emerald-400">整改建议</h3>
            <p className="text-slate-300">{description.suggestion}</p>
          </div>

          {/* 整改方案输入 */}
          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">
                请输入您的整改方案 <span className="text-red-400">*</span>
              </span>
              <span className="mb-2 block text-xs text-slate-400">
                分析违规原因，并说明如何避免再次发生（至少10个字符）
              </span>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="例如：将 Kp 参数从 1.4 降低至 1.0，以减缓舵角响应速度，避免舵机过载..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                rows={4}
                disabled={isLoading}
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-4 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isLoading || justification.trim().length < 10}
              className="bg-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isLoading ? '提交中...' : '提交整改方案并继续'}
            </Button>
          </div>
        </div>

        {/* 底部警告 */}
        <div className="border-t border-red-800/30 bg-red-950/30 px-8 py-4">
          <p className="text-center text-xs text-red-400">
            未提交整改方案无法关闭此窗口。违规记录将保存至您的学习档案。
          </p>
        </div>
      </div>
    </div>
  );
}

export default ViolationModal;
