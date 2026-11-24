import { NextResponse } from 'next/server';

import { isSketchPlotId } from '@/features/ilab/sketch-plots';
import { recognizeSketch, type SketchRecognitionContext } from '@/features/ilab/sketch-recognition';

export const dynamic = 'force-dynamic';

function clipText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || undefined;
}

function parseContext(raw: unknown): SketchRecognitionContext | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const context: SketchRecognitionContext = {};
  if (record.mode === 'analysis' || record.mode === 'prediction') {
    context.mode = record.mode;
  }
  if (typeof record.plotId === 'string' && isSketchPlotId(record.plotId)) {
    context.plotId = record.plotId;
  }
  const vesselKey = clipText(record.vesselKey, 80);
  if (vesselKey) context.vesselKey = vesselKey;
  const vesselTitle = clipText(record.vesselTitle, 120);
  if (vesselTitle) context.vesselTitle = vesselTitle;
  if (typeof record.stepSeq === 'number' && Number.isFinite(record.stepSeq)) {
    context.stepSeq = Math.floor(record.stepSeq);
  }
  const stepTitle = clipText(record.stepTitle, 120);
  if (stepTitle) context.stepTitle = stepTitle;
  const promptFocus = clipText(record.promptFocus, 240);
  if (promptFocus) context.promptFocus = promptFocus;
  const originId = clipText(record.originId, 80);
  if (originId) context.originId = originId;
  return Object.keys(context).length > 0 ? context : undefined;
}

export async function POST(request: Request) {
  let image = '';
  let context: SketchRecognitionContext | undefined;
  try {
    const body = await request.json() as { image?: unknown; context?: unknown };
    image = typeof body.image === 'string' ? body.image : '';
    context = parseContext(body.context);
  } catch {
    return NextResponse.json({ error: '手绘图无法识别，请重画一张较小的图。' }, { status: 400 });
  }
  const recognition = await recognizeSketch({ image, context });
  if (!recognition.ok) return NextResponse.json({ error: recognition.message }, { status: 422 });
  return NextResponse.json({
    ...recognition.fields,
    ...(recognition.verdict.featureChecks ? { featureChecks: recognition.verdict.featureChecks } : {}),
    ...(recognition.verdict.socraticHint ? { socraticHint: recognition.verdict.socraticHint } : {}),
  });
}
