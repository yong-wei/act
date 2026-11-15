'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Eye, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SKETCH_PLOTS, sketchLabelForId, type SketchPlotId } from '@/features/ilab/sketch-plots';
import { simulationUi } from '../components/simulation-ui';
import { buildSketchAnalyticalOverlay } from '../experiments/sketch-analytical-overlay';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';

export interface SketchRecognitionOutcome {
  sketchKind: SketchPlotId | 'other';
  sketchBlank: boolean;
  sketchEvaluation: string;
}

export function SketchPad({
  label,
  hint,
  onChange,
  value,
  studentModel,
  defaultPlotId = 'bode',
  onRecognized,
  overlayEnabledByDefault = true,
}: {
  label: string;
  hint: string;
  onChange: (dataUrl: string) => void;
  value?: string;
  studentModel?: FrozenVesselStudentModel | null;
  defaultPlotId?: SketchPlotId;
  onRecognized?: (verdict: SketchRecognitionOutcome) => void;
  overlayEnabledByDefault?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moved = useRef(0);
  const published = useRef<string | undefined>(undefined);
  const [selectedPlotId, setSelectedPlotId] = useState<SketchPlotId>(defaultPlotId);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SketchRecognitionOutcome | null>(null);
  const [showOverlay, setShowOverlay] = useState(overlayEnabledByDefault);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    if (value && value === published.current) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!value) {
      moved.current = 0;
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      moved.current = 8;
      published.current = value;
    };
    image.src = value;
    return () => {
      cancelled = true;
    };
  }, [value]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function publish() {
    const canvas = canvasRef.current;
    if (!canvas || moved.current < 8) {
      onChange('');
      return;
    }
    const image = canvas.toDataURL('image/png');
    published.current = image;
    onChange(image);
  }

  async function runSketchRecognition() {
    const canvas = canvasRef.current;
    const rawDataUrl =
      value && value.startsWith('data:image/')
        ? value
        : canvas && moved.current >= 8
          ? canvas.toDataURL('image/png')
          : '';
    if (!rawDataUrl) {
      setRecognizeError('请先在白色画布上绘制曲线后再执行识图。');
      return;
    }
    setRecognizing(true);
    setRecognizeError(null);
    try {
      const response = await fetch('/api/simulations/sketch-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: rawDataUrl }),
      });
      const body = (await response.json()) as {
        error?: string;
        sketchKind?: string;
        sketchBlank?: string;
        sketchEvaluation?: string;
      };
      if (!response.ok || !body.sketchKind) {
        setRecognizeError(body.error || '图像识别暂时不可用，请稍后重试。');
        return;
      }
      const nextVerdict: SketchRecognitionOutcome = {
        sketchKind:
          body.sketchKind === 'nyquist' ||
          body.sketchKind === 'bode' ||
          body.sketchKind === 'root-locus' ||
          body.sketchKind === 'time-response'
            ? body.sketchKind
            : 'other',
        sketchBlank: body.sketchBlank === '1',
        sketchEvaluation: (body.sketchEvaluation ?? '').trim(),
      };
      setVerdict(nextVerdict);
      if (nextVerdict.sketchKind !== 'other' && !nextVerdict.sketchBlank) {
        setSelectedPlotId(nextVerdict.sketchKind);
        setShowOverlay(true);
      }
      onRecognized?.(nextVerdict);
    } catch {
      setRecognizeError('图像识别网络请求失败，请检查服务连接后重试。');
    } finally {
      setRecognizing(false);
    }
  }

  const activePlotForOverlay: SketchPlotId | null =
    verdict && !verdict.sketchBlank && verdict.sketchKind !== 'other'
      ? verdict.sketchKind
      : verdict
        ? selectedPlotId
        : null;

  const overlaySpec = useMemo(
    () => (activePlotForOverlay ? buildSketchAnalyticalOverlay(activePlotForOverlay, studentModel) : null),
    [activePlotForOverlay, studentModel],
  );

  return (
    <div className="space-y-2" data-sketch-pad>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-platform-fg-primary">{label}</span>
        <select
          aria-label="手绘图目标图种"
          className="sim-hud-input h-7 w-auto px-2 py-0.5 text-[11px]"
          value={selectedPlotId}
          onChange={(event) => setSelectedPlotId(event.target.value as SketchPlotId)}
        >
          {SKETCH_PLOTS.map((plot) => (
            <option key={plot.id} value={plot.id}>
              目标：{plot.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-platform-fg-muted">{hint}</p>

      <div className="relative inline-block w-full max-w-xs overflow-hidden rounded-md border border-platform-border bg-white">
        <canvas
          ref={canvasRef}
          width={280}
          height={160}
          className="block h-auto w-full touch-none bg-white"
          aria-label={label}
          onPointerDown={(event) => {
            const context = event.currentTarget.getContext('2d');
            const cursor = point(event);
            context?.beginPath();
            context?.moveTo(cursor.x, cursor.y);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            const context = event.currentTarget.getContext('2d');
            if (!context) return;
            const cursor = point(event);
            context.strokeStyle = '#1e3a5f';
            context.lineWidth = 2;
            context.lineCap = 'round';
            context.lineTo(cursor.x, cursor.y);
            context.stroke();
            moved.current += 1;
          }}
          onPointerUp={publish}
        />

        {overlaySpec && showOverlay ? (
          <svg
            viewBox={overlaySpec.viewBox}
            className="pointer-events-none absolute inset-0 h-full w-full"
            data-sketch-analytical-overlay
            aria-hidden="true"
          >
            {overlaySpec.paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke={path.stroke}
                strokeWidth={1.6}
                strokeDasharray={path.dashed ? '4 3' : undefined}
                opacity={0.85}
              />
            ))}
            {overlaySpec.markers.map((marker) => (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={3.5} fill={marker.color} />
                <text
                  x={Math.min(240, marker.x + 5)}
                  y={Math.max(12, marker.y - 4)}
                  fontSize={8.5}
                  fontWeight={600}
                  fill={marker.color}
                >
                  {marker.label}
                </text>
              </g>
            ))}
          </svg>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={simulationUi.buttonOutline}
          onClick={() => {
            const canvas = canvasRef.current;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) return;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            moved.current = 0;
            published.current = '';
            setVerdict(null);
            setRecognizeError(null);
            onChange('');
          }}
        >
          清空手绘
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={recognizing}
          data-sketch-recognize
          className={simulationUi.buttonOutline}
          onClick={() => {
            void runSketchRecognition();
          }}
        >
          <Sparkles className="mr-1 size-3" aria-hidden="true" />
          <span>{recognizing ? '识图中...' : '识图核验'}</span>
        </Button>

        {overlaySpec ? (
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <input
              type="checkbox"
              data-sketch-overlay-toggle
              checked={showOverlay}
              onChange={(event) => setShowOverlay(event.target.checked)}
            />
            <Layers className="size-3" aria-hidden="true" />
            <span>叠加本人模型参考特征</span>
          </label>
        ) : null}
      </div>

      {recognizeError ? (
        <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-300">
          {recognizeError}
        </p>
      ) : null}

      {verdict ? (
        <div
          data-sketch-verdict
          className="sim-hud-tile space-y-1 p-2 text-[11px] text-platform-fg-secondary"
        >
          <p className="flex items-center gap-1 font-medium text-platform-fg-primary">
            <Eye className="size-3.5 text-cyan-500" aria-hidden="true" />
            <span>
              识图结果：{verdict.sketchBlank ? '空白草图' : sketchLabelForId(verdict.sketchKind)}
              {verdict.sketchEvaluation ? ` · ${verdict.sketchEvaluation}` : ''}
            </span>
          </p>
          {overlaySpec ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-platform-fg-muted">
              {overlaySpec.referenceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
            纯画布隔离保护：参考特征仅绘制在只读覆盖层，不会污染上传草图像素。
          </p>
        </div>
      ) : null}
    </div>
  );
}
