export const SKETCH_VISION_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';

export const SKETCH_PLOTS = [
  { id: 'nyquist', label: '奈奎斯特图' },
  { id: 'bode', label: '伯德图' },
  { id: 'root-locus', label: '根轨迹图' },
  { id: 'time-response', label: '时域响应图' },
] as const;

export const SKETCH_COORDINATE_PLOTS = [
  ...SKETCH_PLOTS,
  { id: 'frequency-amplitude', label: '共振幅频图' },
  { id: 'planar-envelope', label: '平面轨迹与警戒圈图' },
] as const;

export type SketchPlotId = (typeof SKETCH_COORDINATE_PLOTS)[number]['id'];

export type SketchVerdict = {
  plotKind: SketchPlotId | 'other';
  blank: boolean;
  evaluation: string;
  featureChecks?: string[];
  socraticHint?: string;
};

const SKETCH_PLOT_ID_SET = new Set<string>(SKETCH_COORDINATE_PLOTS.map((plot) => plot.id));
const PLOT_IDS = new Set<string>([...SKETCH_PLOT_ID_SET, 'other']);

export function isSketchPlotId(value: string): value is SketchPlotId {
  return SKETCH_PLOT_ID_SET.has(value);
}

export function sketchIdForLabel(label: string): SketchPlotId | null {
  return SKETCH_COORDINATE_PLOTS.find((plot) => plot.label === label.trim())?.id ?? null;
}

export function sketchLabelForId(id: string): string {
  return SKETCH_COORDINATE_PLOTS.find((plot) => plot.id === id)?.label ?? '手绘图';
}

export function parseSketchFeatureChecks(rawChecks: unknown, rawJson?: string): string[] | undefined {
  const toList = (items: unknown[]) => {
    const cleaned = items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 6);
    return cleaned.length > 0 ? cleaned : undefined;
  };
  if (Array.isArray(rawChecks)) return toList(rawChecks);
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      return Array.isArray(parsed) ? toList(parsed) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function sketchVerdictFields(verdict: SketchVerdict): Record<string, string> {
  const fields: Record<string, string> = {
    sketchKind: verdict.plotKind,
    sketchBlank: verdict.blank ? '1' : '0',
    sketchEvaluation: verdict.evaluation.replace(/\s+/g, ' ').trim().slice(0, 80),
  };
  if (verdict.featureChecks && verdict.featureChecks.length > 0) {
    fields.sketchFeatureChecks = JSON.stringify(verdict.featureChecks);
  }
  if (verdict.socraticHint) {
    const cleanedHint = verdict.socraticHint.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (cleanedHint) fields.sketchSocraticHint = cleanedHint;
  }
  return fields;
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
  const verdict: SketchVerdict = {
    plotKind: plotKind as SketchVerdict['plotKind'],
    blank: record.blank === true,
    evaluation,
  };
  const checks = parseSketchFeatureChecks(record.featureChecks);
  if (checks) {
    verdict.featureChecks = checks;
  }
  if (typeof record.socraticHint === 'string') {
    const hint = record.socraticHint.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (hint) {
      verdict.socraticHint = hint;
    }
  }
  return verdict;
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
