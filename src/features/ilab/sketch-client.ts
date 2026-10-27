export async function applyLocalSketchVerdict(
  readings: Record<string, string>,
  hasSketch: boolean,
  hasTicket: boolean,
): Promise<
  | { ok: true; readings: Record<string, string>; sketchImage?: string; skipLocalScore: boolean }
  | { ok: false; message: string }
> {
  if (!hasSketch) {
    const next = { ...readings };
    delete next.sketchImage;
    return { ok: true, readings: next, skipLocalScore: false };
  }
  const image = readings.sketchImage?.trim() ?? '';
  if (!image.startsWith('data:image/')) return { ok: false, message: '请先在画布上画出曲线。' };
  const next = { ...readings };
  delete next.sketchImage;
  if (hasTicket) return { ok: true, readings: next, sketchImage: image, skipLocalScore: true };
  const response = await fetch('/api/simulations/sketch-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const body = await response.json() as { error?: string; sketchKind?: string; sketchBlank?: string; sketchEvaluation?: string };
  if (!response.ok || !body.sketchKind) return { ok: false, message: body.error || '图像识别暂时不可用，请稍后重试。' };
  next.sketchKind = body.sketchKind;
  next.sketchBlank = body.sketchBlank === '1' ? '1' : '0';
  next.sketchEvaluation = (body.sketchEvaluation ?? '').slice(0, 80);
  return { ok: true, readings: next, skipLocalScore: false };
}
