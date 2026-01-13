'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface SlopeTile {
  id: string;
  label: string;
  tone: 'neutral' | 'accent';
}

interface Slot {
  id: string;
  title: string;
  hint: string;
  expectedTileId: string;
}

const TILES: SlopeTile[] = [
  { id: 'slope-0', label: '0 dB/dec', tone: 'neutral' },
  { id: 'slope-neg-20', label: '-20 dB/dec', tone: 'accent' },
  { id: 'slope-neg-40', label: '-40 dB/dec', tone: 'accent' },
  { id: 'slope-pos-20', label: '+20 dB/dec', tone: 'neutral' },
];

const SLOTS: Slot[] = [
  {
    id: 'low',
    title: '低频段 (ω < 10)',
    hint: '基准段斜率',
    expectedTileId: 'slope-0',
  },
  {
    id: 'mid',
    title: '中频段 (10 ≤ ω < 100)',
    hint: '第一个极点后',
    expectedTileId: 'slope-neg-20',
  },
  {
    id: 'high',
    title: '高频段 (ω ≥ 100)',
    hint: '第二个极点后',
    expectedTileId: 'slope-neg-40',
  },
];

interface BodeSlopePuzzleProps extends BaseWidgetProps {}

export default function BodeSlopePuzzle({ onComplete, onStateChange }: BodeSlopePuzzleProps) {
  const interactive = useOptionalInteractiveContext();
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [checked, setChecked] = useState(false);

  const filledCount = useMemo(
    () => SLOTS.filter((slot) => assignments[slot.id]).length,
    [assignments]
  );

  const progress = useMemo(
    () => Math.round((filledCount / SLOTS.length) * 100),
    [filledCount]
  );

  const availableTiles = useMemo(
    () => TILES.filter((tile) => !Object.values(assignments).includes(tile.id)),
    [assignments]
  );

  const correctCount = useMemo(
    () => SLOTS.reduce((acc, slot) => acc + (assignments[slot.id] === slot.expectedTileId ? 1 : 0), 0),
    [assignments]
  );

  const isCorrect = correctCount === SLOTS.length;

  const handleDrop = useCallback((slotId: string, tileId: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key] === tileId) next[key] = null;
      });
      next[slotId] = tileId;
      return next;
    });
    setChecked(false);

    const snapshot = {
      progress,
      data: { action: 'drop', slotId, tileId },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('interact', snapshot.data);
  }, [interactive, onStateChange, progress]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, tileId: string) => {
    event.dataTransfer.setData('text/plain', tileId);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDropSlot = useCallback((event: React.DragEvent<HTMLDivElement>, slotId: string) => {
    event.preventDefault();
    const tileId = event.dataTransfer.getData('text/plain');
    if (!tileId) return;
    handleDrop(slotId, tileId);
  }, [handleDrop]);

  const handleReset = useCallback(() => {
    setAssignments({});
    setChecked(false);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [interactive, onStateChange]);

  const handleCheck = useCallback(() => {
    setChecked(true);
    const snapshot = {
      progress: Math.round((correctCount / SLOTS.length) * 100),
      data: { correctCount, total: SLOTS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(snapshot.progress);
    interactive?.tracking.emit('submit', snapshot.data);

    if (isCorrect) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: snapshot.data,
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [correctCount, isCorrect, onComplete, onStateChange, interactive]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">参与式 · 斜率叠加拼图</p>
            <h2 className="text-2xl font-bold text-slate-900">从转折频率叠加斜率</h2>
          </div>
          <div className="text-sm text-slate-500">完成度 {filledCount}/{SLOTS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          目标传递函数：<span className="font-mono">G(s) = 10 / ((1 + s/10)(1 + s/100))</span>
          <div className="mt-2 text-xs text-slate-500">提示：每个一阶极点会在转折频率后使斜率下降 20 dB/dec。</div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            {SLOTS.map((slot) => (
              <div
                key={slot.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDropSlot(event, slot.id)}
                className={`rounded-xl border border-dashed p-4 transition-colors ${
                  checked && assignments[slot.id] === slot.expectedTileId
                    ? 'border-emerald-300 bg-emerald-50'
                    : checked
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{slot.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{slot.hint}</p>
                  </div>
                  <div className="text-xs text-slate-400">拖拽斜率到这里</div>
                </div>
                <div className="mt-3">
                  {assignments[slot.id] ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {TILES.find((tile) => tile.id === assignments[slot.id])?.label}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">尚未放置</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700">可用斜率拼图</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {availableTiles.map((tile) => (
                <div
                  key={tile.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, tile.id)}
                  className={`cursor-grab rounded-lg border px-3 py-2 text-sm shadow-sm ${
                    tile.tone === 'accent'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {tile.label}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
              叠加思路：低频先确定基准斜率，然后在每个转折频率后叠加新增斜率。
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            清空重来
          </button>
          <button
            onClick={handleCheck}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
              checked && isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            检查答案
          </button>
        </div>

        {checked && (
          <div className={`mt-4 rounded-lg border p-4 text-sm ${
            isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600'
          }`}>
            {isCorrect ? '叠加正确！你已经掌握斜率累加的方法。' : '有频段斜率不匹配，再调整一下。'}
          </div>
        )}
      </div>
    </div>
  );
}
