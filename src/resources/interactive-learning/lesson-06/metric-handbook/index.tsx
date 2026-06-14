'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Info, Target, Gauge, Clock, TrendingUp } from 'lucide-react';
import { PERFORMANCE_METRIC_DEFINITIONS } from '../types';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

function MetricCurve({ activeId }: { activeId: string }) {
  const points = [
    { x: 20, y: 120 },
    { x: 60, y: 90 },
    { x: 95, y: 55 },
    { x: 130, y: 80 },
    { x: 170, y: 92 },
    { x: 230, y: 95 },
  ];
  const path = points.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const finalY = 95;
  const peak = points[2];

  const highlight = useMemo(() => {
    switch (activeId) {
      case 'rise-time':
        return 'rise';
      case 'peak-time':
        return 'peak';
      case 'settling-time':
        return 'settling';
      case 'overshoot':
        return 'overshoot';
      case 'steady-error':
        return 'steady';
      default:
        return null;
    }
  }, [activeId]);

  return (
    <svg viewBox="0 0 260 140" className="w-full h-full">
      <rect x="0" y="0" width="260" height="140" fill="#0f172a" rx="12" />
      <line x1="10" y1={finalY} x2="250" y2={finalY} stroke="#1f2937" strokeDasharray="6 6" />
      <path d={path} stroke="#38bdf8" strokeWidth="3" fill="none" />

      {highlight === 'rise' && (
        <path
          d={`M ${points[0].x} ${points[0].y} L ${points[2].x} ${points[2].y}`}
          stroke="#22c55e"
          strokeWidth="5"
          fill="none"
        />
      )}

      {highlight === 'peak' && (
        <circle cx={peak.x} cy={peak.y} r="7" fill="#f97316" stroke="#fde68a" strokeWidth="3" />
      )}

      {highlight === 'settling' && (
        <rect x="160" y={finalY - 6} width="70" height="12" fill="rgba(59,130,246,0.25)" />
      )}

      {highlight === 'overshoot' && (
        <g>
          <line x1={peak.x + 12} y1={finalY} x2={peak.x + 12} y2={peak.y} stroke="#f43f5e" strokeWidth="3" />
          <circle cx={peak.x + 12} cy={finalY} r="4" fill="#f43f5e" />
          <circle cx={peak.x + 12} cy={peak.y} r="4" fill="#f43f5e" />
        </g>
      )}

      {highlight === 'steady' && (
        <g>
          <line x1={210} y1={finalY} x2={250} y2={finalY} stroke="#eab308" strokeWidth="4" />
          <line x1={210} y1={finalY - 8} x2={250} y2={finalY - 8} stroke="#eab308" strokeWidth="2" />
        </g>
      )}

      <text x="14" y="22" fill="#94a3b8" fontSize="12">指标示意</text>
    </svg>
  );
}

const metricIcons = {
  'rise-time': TrendingUp,
  'peak-time': Clock,
  'settling-time': Gauge,
  overshoot: Target,
  'steady-error': Info,
};

interface MetricHandbookCardProps extends BaseWidgetProps {}

export default function MetricHandbookCard({ onComplete, onStateChange }: MetricHandbookCardProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = PERFORMANCE_METRIC_DEFINITIONS[0]?.id ?? 'rise-time';
  const [activeId, setActiveId] = useState(initialActiveId);
  const [visitedIds, setVisitedIds] = useState<string[]>(() => [initialActiveId]);
  const publishedVisitedCountRef = useRef(0);
  const activeMetric = PERFORMANCE_METRIC_DEFINITIONS.find((item) => item.id === activeId);
  const Icon = metricIcons[activeId as keyof typeof metricIcons] ?? Info;
  const totalMetrics = PERFORMANCE_METRIC_DEFINITIONS.length;

  const recordVisit = useCallback((nextActiveId: string) => {
    setActiveId(nextActiveId);
    setVisitedIds((current) =>
      current.includes(nextActiveId) ? current : [...current, nextActiveId]
    );
  }, []);

  useEffect(() => {
    if (publishedVisitedCountRef.current >= visitedIds.length) return;
    publishedVisitedCountRef.current = visitedIds.length;
    const nextVisited = visitedIds;
    const latestVisitedId = nextVisited[nextVisited.length - 1] ?? initialActiveId;
    const progressValue = Math.round((nextVisited.length / totalMetrics) * 100);
    const snapshot = {
      progress: progressValue,
      data: { metricId: latestVisitedId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === totalMetrics && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: totalMetrics },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [initialActiveId, visitedIds, totalMetrics, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">指标裁判手册</h2>
        <p className="text-slate-600">掌握裁判席关注的时域性能指标</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="aspect-[13/7] rounded-xl overflow-hidden">
            <MetricCurve activeId={activeId} />
          </div>
          <div className="mt-4 text-sm text-slate-500">
            点击右侧指标可查看对应判分要点。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {PERFORMANCE_METRIC_DEFINITIONS.map((item) => (
              <button type="button"
                key={item.id}
                onClick={() => recordVisit(item.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  activeId === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {activeMetric && (
            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{activeMetric.name}</div>
                  <div className="text-sm text-slate-500">{activeMetric.symbol}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>{activeMetric.description}</p>
                <div className="rounded-lg bg-white p-3 text-slate-700">
                  <span className="text-xs uppercase text-slate-400">裁判关注</span>
                  <p className="mt-1">{activeMetric.judgeFocus}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { MetricHandbookCard };
