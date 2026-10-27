export const SKETCH_VISION_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';

export const SKETCH_PLOTS = [
  { id: 'nyquist', label: '奈奎斯特图' },
  { id: 'bode', label: '伯德图' },
  { id: 'root-locus', label: '根轨迹图' },
  { id: 'time-response', label: '时域响应图' },
] as const;

export type SketchPlotId = (typeof SKETCH_PLOTS)[number]['id'];

export type SketchVerdict = {
  plotKind: SketchPlotId | 'other';
  blank: boolean;
  evaluation: string;
};

const PLOT_IDS = new Set<string>([...SKETCH_PLOTS.map((plot) => plot.id), 'other']);

export function sketchIdForLabel(label: string): SketchPlotId | null {
  return SKETCH_PLOTS.find((plot) => plot.label === label.trim())?.id ?? null;
}

export function sketchLabelForId(id: string): string {
  return SKETCH_PLOTS.find((plot) => plot.id === id)?.label ?? '手绘图';
}

export function sketchVerdictFields(verdict: SketchVerdict): Record<string, string> {
  return {
    sketchKind: verdict.plotKind,
    sketchBlank: verdict.blank ? '1' : '0',
    sketchEvaluation: verdict.evaluation.replace(/\s+/g, ' ').trim().slice(0, 80),
  };
}

export function parseSketchVerdict(text: string): SketchVerdict | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const plotKind = typeof record.plotKind === 'string' ? record.plotKind : '';
  if (!PLOT_IDS.has(plotKind)) return null;
  const evaluation = typeof record.evaluation === 'string'
    ? record.evaluation.replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
  return {
    plotKind: plotKind as SketchVerdict['plotKind'],
    blank: record.blank === true,
    evaluation,
  };
}

/** 识别结果和所选图种不一致时返回学生可见的失败说明。通过时返回 null。 */
export function sketchReadingError(readings: Record<string, string | undefined>, choiceKey = 'plotKind'): string | null {
  const selected = sketchIdForLabel(readings[choiceKey] ?? '');
  if (!selected) return '请先选择要画的图。';
  const kind = (readings.sketchKind ?? '').trim();
  if (!kind) return '请先画完曲线并完成识别。';
  if (readings.sketchBlank === '1' || kind === 'other') return '画布是空的或看不出是哪一种图，请按所选图种重画。';
  if (kind !== selected) return '识别出的图和你选择的种类不一致，请按所选图重画。';
  return null;
}
