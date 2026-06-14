'use client';

import { useCallback, useMemo, useState } from 'react';
import { Award, CheckCircle2, Sliders, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface ChallengeResult {
  score: number;
  grade: 'excellent' | 'good' | 'pass' | 'fail';
  feedback: string;
}

interface ParameterChallengeProps extends BaseWidgetProps {}

const TARGET = {
  overshoot: 15,
  settling: 4.0,
};

function computeMetrics(zeta: number, wn: number) {
  const safeZeta = Math.min(0.95, Math.max(0.05, zeta));
  const overshoot = Math.exp((-safeZeta * Math.PI) / Math.sqrt(1 - safeZeta * safeZeta)) * 100;
  const settlingTime = 4 / (safeZeta * wn);
  return { overshoot, settlingTime };
}

export default function ParameterChallenge({ onComplete, onStateChange }: ParameterChallengeProps) {
  const interactive = useOptionalInteractiveContext();
  const [zeta, setZeta] = useState(0.4);
  const [wn, setWn] = useState(2.2);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const metrics = useMemo(() => computeMetrics(zeta, wn), [zeta, wn]);

  const evaluate = useCallback(() => {
    const overshootDiff = Math.abs(metrics.overshoot - TARGET.overshoot);
    const settlingDiff = Math.abs(metrics.settlingTime - TARGET.settling);
    const score = Math.max(0, Math.round(100 - overshootDiff * 2 - settlingDiff * 12));

    let grade: ChallengeResult['grade'] = 'fail';
    if (score >= 90) grade = 'excellent';
    else if (score >= 75) grade = 'good';
    else if (score >= 60) grade = 'pass';

    const feedbackMap: Record<ChallengeResult['grade'], string> = {
      excellent: '优秀！你的参数几乎完美匹配目标响应。',
      good: '良好！仍可微调阻尼比或提高自然频率。',
      pass: '及格。建议降低超调或缩短调节时间。',
      fail: '未达标。需要重新平衡阻尼比与自然频率。',
    };

    const payload: ChallengeResult = {
      score,
      grade,
      feedback: feedbackMap[grade],
    };
    setResult(payload);

    const snapshot = {
      progress: 100,
      data: { zeta, wn, score, overshoot: metrics.overshoot, settlingTime: metrics.settlingTime },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(100);
    interactive?.tracking.emit('submit', snapshot.data);

    const completion: WidgetResult = {
      success: true,
      score,
      data: snapshot.data,
    };
    interactive?.progress.markComplete(completion);
    onComplete?.(completion);
  }, [metrics.overshoot, metrics.settlingTime, zeta, wn, onStateChange, interactive, onComplete]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">后测 · 参数匹配挑战</p>
            <h2 className="text-2xl font-bold text-slate-900">目标响应调参</h2>
            <p className="mt-2 text-sm text-slate-600">目标：超调量 ≤ {TARGET.overshoot}% ，调节时间 ≤ {TARGET.settling}s。</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              当前超调 {metrics.overshoot.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs">调节时间 {metrics.settlingTime.toFixed(2)} s</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
              <Sliders className="h-4 w-4" />
              参数调整
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500">阻尼比 ζ: {zeta.toFixed(2)}</label>
                <input aria-label="参数挑战输入一"
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  value={zeta}
                  onChange={(event) => setZeta(Number(event.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">自然频率 ω_n: {wn.toFixed(2)} rad/s</label>
                <input aria-label="参数挑战输入二"
                  type="range"
                  min={1.0}
                  max={4.5}
                  step={0.05}
                  value={wn}
                  onChange={(event) => setWn(Number(event.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
              <Award className="h-4 w-4" />
              评分结果
            </div>
            {result ? (
              <div className="mt-4 space-y-3">
                <div className="text-3xl font-semibold text-slate-900">{result.score} 分</div>
                <div className="text-sm text-slate-600">{result.feedback}</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {result.grade === 'excellent' && '优秀'}
                  {result.grade === 'good' && '良好'}
                  {result.grade === 'pass' && '及格'}
                  {result.grade === 'fail' && '未达标'}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">调整参数后点击提交，系统将给出评分。</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button"
            onClick={evaluate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
          >
            提交参数
          </button>
        </div>
      </div>
    </div>
  );
}
