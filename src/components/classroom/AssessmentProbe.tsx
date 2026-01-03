'use client';

/**
 * AssessmentProbe - 后测评估探针
 *
 * 用于收集学生提交的参数，运行后台仿真评分。
 * 支持可编辑的评估公式、参数范围和评分权重。
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Calculator,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Target,
  Award,
  TrendingUp,
  Clock,
  Zap,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import type { AssessmentProbeConfig, BaseClassroomComponentProps } from './types';

export interface AssessmentProbeProps extends BaseClassroomComponentProps<AssessmentProbeConfig> {
  /** 提交回调 */
  onSubmit?: (params: Record<string, number>, score: number) => void;
  /** 是否已完成 */
  isCompleted?: boolean;
}

interface SubmissionResult {
  score: number;
  metrics: {
    msi: number;
    settlingTime: number;
    maxAccel: number;
  };
  violations: number;
  grade: 'excellent' | 'good' | 'pass' | 'fail';
  feedback: string;
}

export function AssessmentProbe({
  config,
  mode = 'play',
  onConfigChange,
  onSubmit,
  isCompleted = false,
}: AssessmentProbeProps) {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [editConfig, setEditConfig] = useState(config);
  const [params, setParams] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // 初始化参数值
  useMemo(() => {
    const initialParams: Record<string, number> = {};
    config.parameters.forEach((param) => {
      initialParams[param.id] = param.defaultValue ?? (param.min + param.max) / 2;
    });
    setParams(initialParams);
  }, [config.parameters]);

  // 处理参数变化
  const handleParamChange = useCallback((paramId: string, value: number) => {
    setParams((prev) => ({
      ...prev,
      [paramId]: value,
    }));
    setResult(null); // 清除之前的结果
  }, []);

  // 模拟仿真评分
  const simulateAndScore = useCallback(
    async (submittedParams: Record<string, number>): Promise<SubmissionResult> => {
      // 模拟仿真过程（实际应调用后端仿真服务）
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 基于参数计算模拟结果
      const Kp = submittedParams['kp'] ?? 1;
      const Ki = submittedParams['ki'] ?? 0;
      const Kd = submittedParams['kd'] ?? 0;
      const zeta = submittedParams['zeta'] ?? 0.7;

      // 简化的评估模型
      const overshoot = Math.max(0, 20 - Kd * 30 + Kp * 10);
      const settlingTime = Math.max(20, 60 - Kp * 20 + Ki * 5);
      const maxAccel = Math.max(0.05, 0.15 - Kd * 0.1 + Kp * 0.05);

      // 晕船指数 (基于超调量)
      const msi = overshoot * 2.5;

      // 违规次数 (加速度超标)
      const violations = maxAccel > 0.2 ? 1 : 0;

      // 评分公式: Score = 100 / (1 + MSI/100) - Penalty × N_fail
      const { baseScore, msiWeight, penaltyPerViolation } = config.scoring;
      const score = Math.max(
        0,
        Math.round(baseScore / (1 + (msi / 100) * msiWeight) - penaltyPerViolation * violations)
      );

      // 评级
      let grade: SubmissionResult['grade'];
      let feedback: string;

      if (score >= 90) {
        grade = 'excellent';
        feedback = '优秀！你的参数设计实现了舒适与安全的完美平衡。';
      } else if (score >= 75) {
        grade = 'good';
        feedback = '良好。建议增大微分系数以减少超调和加速度。';
      } else if (score >= 60) {
        grade = 'pass';
        feedback = '及格。需要进一步优化参数以提高乘客舒适度。';
      } else {
        grade = 'fail';
        feedback = '未达标。请重新学习阻尼调节的原理并调整参数。';
      }

      return {
        score,
        metrics: {
          msi,
          settlingTime,
          maxAccel,
        },
        violations,
        grade,
        feedback,
      };
    },
    [config.scoring]
  );

  // 提交评估
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const submissionResult = await simulateAndScore(params);
      setResult(submissionResult);
      onSubmit?.(params, submissionResult.score);
    } catch (error) {
      console.error('Assessment submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [params, simulateAndScore, onSubmit]);

  // 重置
  const handleReset = useCallback(() => {
    const initialParams: Record<string, number> = {};
    config.parameters.forEach((param) => {
      initialParams[param.id] = param.defaultValue ?? (param.min + param.max) / 2;
    });
    setParams(initialParams);
    setResult(null);
  }, [config.parameters]);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    onConfigChange?.(editConfig);
    setIsEditing(false);
  }, [editConfig, onConfigChange]);

  // 评级颜色
  const gradeColors = {
    excellent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    good: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    pass: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    fail: 'text-red-500 bg-red-500/10 border-red-500/30',
  };

  const gradeLabels = {
    excellent: '优秀',
    good: '良好',
    pass: '及格',
    fail: '不及格',
  };

  if (isEditing) {
    return (
      <div className="w-full max-w-2xl mx-auto rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-blue-500" />
            编辑评估配置
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
            >
              <X className="h-4 w-4" />
              取消
            </button>
          </div>
        </div>

        {/* 编辑表单 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
            <input
              type="text"
              value={editConfig.title}
              onChange={(e) =>
                setEditConfig((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">说明</label>
            <textarea
              value={editConfig.description}
              onChange={(e) =>
                setEditConfig((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">基础分</label>
              <input
                type="number"
                value={editConfig.scoring.baseScore}
                onChange={(e) =>
                  setEditConfig((prev) => ({
                    ...prev,
                    scoring: { ...prev.scoring, baseScore: Number(e.target.value) },
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MSI权重</label>
              <input
                type="number"
                step="0.1"
                value={editConfig.scoring.msiWeight}
                onChange={(e) =>
                  setEditConfig((prev) => ({
                    ...prev,
                    scoring: { ...prev.scoring, msiWeight: Number(e.target.value) },
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">违规扣分</label>
              <input
                type="number"
                value={editConfig.scoring.penaltyPerViolation}
                onChange={(e) =>
                  setEditConfig((prev) => ({
                    ...prev,
                    scoring: { ...prev.scoring, penaltyPerViolation: Number(e.target.value) },
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 标题 */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Calculator className="h-6 w-6 text-violet-500" />
          <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
        </div>
        <p className="text-slate-600 text-sm">{config.description}</p>
      </div>

      {/* 评分公式说明 */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">评分公式</span>
        </div>
        <div className="font-mono text-sm text-slate-600 bg-white p-2 rounded border">
          Score = {config.scoring.baseScore} / (1 + MSI × {config.scoring.msiWeight}) -{' '}
          {config.scoring.penaltyPerViolation} × N<sub>violation</sub>
        </div>
      </div>

      {/* 参数输入 */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-blue-500" />
          <span className="font-medium text-slate-900">控制参数设置</span>
        </div>

        <div className="space-y-4">
          {config.parameters.map((param) => (
            <div key={param.id}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-slate-700">
                  {param.name}
                  <span className="ml-1 text-xs text-slate-500">({param.symbol})</span>
                </label>
                <span className="font-mono text-sm text-slate-900">
                  {params[param.id]?.toFixed(param.step < 1 ? 2 : 0)}
                  {param.unit && <span className="text-slate-500 ml-0.5">{param.unit}</span>}
                </span>
              </div>
              <input
                type="range"
                min={param.min}
                max={param.max}
                step={param.step}
                value={params[param.id] ?? param.defaultValue ?? param.min}
                onChange={(e) => handleParamChange(param.id, Number(e.target.value))}
                disabled={isSubmitting || isCompleted}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                <span>{param.min}</span>
                <span>{param.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isCompleted}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            isSubmitting || isCompleted
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              正在评估...
            </>
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              已完成评估
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              提交评估
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          disabled={isSubmitting || isCompleted}
          className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* 评估结果 */}
      {result && (
        <div className={`p-4 rounded-xl border-2 ${gradeColors[result.grade]}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6" />
              <span className="font-bold text-lg">{gradeLabels[result.grade]}</span>
            </div>
            <div className="text-3xl font-bold">{result.score}分</div>
          </div>

          {/* 详细指标 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-2 bg-white/50 rounded-lg text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-slate-600" />
              <div className="text-xs text-slate-500">晕船指数</div>
              <div className="font-mono font-medium">{result.metrics.msi.toFixed(1)}%</div>
            </div>
            <div className="p-2 bg-white/50 rounded-lg text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-slate-600" />
              <div className="text-xs text-slate-500">调节时间</div>
              <div className="font-mono font-medium">{result.metrics.settlingTime.toFixed(1)}s</div>
            </div>
            <div className="p-2 bg-white/50 rounded-lg text-center">
              <Zap className="h-4 w-4 mx-auto mb-1 text-slate-600" />
              <div className="text-xs text-slate-500">最大加速度</div>
              <div className="font-mono font-medium">{result.metrics.maxAccel.toFixed(3)}g</div>
            </div>
          </div>

          {/* 反馈 */}
          <p className="text-sm">{result.feedback}</p>

          {result.violations > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>触发了 {result.violations} 次伦理熔断</span>
            </div>
          )}
        </div>
      )}

      {/* 编辑按钮 (仅在编辑模式可用) */}
      {mode === 'edit' && !isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <Edit3 className="h-4 w-4" />
          编辑配置
        </button>
      )}
    </div>
  );
}

/**
 * 创建默认评估配置
 */
export function createDefaultAssessmentConfig(id: string = 'assessment-default'): AssessmentProbeConfig {
  return {
    id,
    type: 'assessment',
    title: '后测评估',
    description: '提交你的控制参数设计，系统将运行仿真并评估效果',
    parameters: [
      {
        id: 'kp',
        name: '比例系数',
        symbol: 'Kp',
        min: 0,
        max: 5,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: 'ki',
        name: '积分系数',
        symbol: 'Ki',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.1,
      },
      {
        id: 'kd',
        name: '微分系数',
        symbol: 'Kd',
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.5,
      },
    ],
    scoring: {
      baseScore: 100,
      msiWeight: 1.0,
      penaltyPerViolation: 10,
    },
  };
}

export default AssessmentProbe;
