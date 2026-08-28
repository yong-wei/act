import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';

/**
 * Shared manifest payload field readers. Extracted verbatim from
 * `content-renderers.tsx` so plugin modules and the central runtime resolve
 * blocks, titles, and media paths through one implementation instead of
 * duplicating interpretation logic.
 */

type ContentRecord = Record<string, unknown>;

export const MODULE_KIND_TITLE: Record<string, string> = {
  'bullet-list-card': '要点',
  'comparison-graphic': '图示',
  'content.code': '代码',
  'formula-card': '公式',
  'formula-card-row': '公式',
  'goal-card-row': '本次课程目标',
  'image-panel': '图示',
  'interactive-figure-panel': '互动图形',
  'learning-stat-panel': '课堂表现统计',
  'performance-summary': '课堂表现统计',
  'native-formula-table': '公式表',
  'native-table': '表格',
  'problem-statement': '题面',
  'reveal-chain': '推导步骤',
  'stat-panel': '课堂表现统计',
  'step-reveal': '推导步骤',
  'step-reveal-chain': '推导步骤',
  'summary-card': '要点',
  'summary-card-grid': '要点',
};

export function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ContentRecord) : {};
}

export function stringField(source: ContentRecord, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export function numberField(source: ContentRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function numberTuple3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const tuple = value.slice(0, 3).map((item) => Number(item));
  return tuple.every((item) => Number.isFinite(item))
    ? tuple as [number, number, number]
    : fallback;
}

export function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

export function runtimeMediaPath(manifest: InteractiveRuntimeManifest, path: string) {
  if (path.startsWith('/')) return path;
  return `/course-runtime/lessons/${manifest.lessonId}/media/${path}`;
}

export function blockByKey(step: InteractiveRuntimeStepManifest, key: string) {
  return step.contentBlocks[key];
}

export function blockFor(step: InteractiveRuntimeStepManifest, payload: ContentRecord) {
  const key = payload.block_key ?? payload.blockKey ?? payload.formula_key ?? payload.formulaKey ?? payload.image_key ?? payload.imageKey;
  return typeof key === 'string' && key ? step.contentBlocks[key] : undefined;
}

export function blockByModuleId(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const normalizedId = module.id.replace(/-/g, '_');
  const candidates = [
    normalizedId,
    normalizedId.replace(/_card$/, ''),
    normalizedId.replace(/_cards$/, ''),
    normalizedId.replace(/_list$/, '_list'),
    normalizedId.replace(/_figure$/, '_figure'),
    normalizedId.replace(/_reading$/, '_reading'),
  ];
  const parts = normalizedId.split('_').filter(Boolean);
  if (parts.length > 1) {
    candidates.push(parts.slice(-2).join('_'));
    candidates.push(parts[parts.length - 1]);
  }
  if (normalizedId.includes('conclusion')) {
    candidates.push('conclusion', 'structure_conclusion', 'delivery_judgment');
  }
  if (normalizedId.includes('reading') && normalizedId.includes('prompt')) candidates.push('reading_prompt');
  if (normalizedId.includes('prompt')) candidates.push('prompt');
  if (normalizedId.includes('criteria')) candidates.push('criteria');
  if (normalizedId.includes('setting')) candidates.push('search_settings');
  if (normalizedId.includes('family') || normalizedId.includes('structure')) candidates.push('structures', 'structure_code_fields');
  if (normalizedId.includes('frontier') || normalizedId.includes('method')) candidates.push('frontier_methods');
  if (normalizedId.includes('limitation')) candidates.push('limitations');
  if (normalizedId.includes('header')) candidates.push('header');
  if (normalizedId.includes('explanation')) candidates.push('figure_explanation', 'formula_explanation');
  for (const key of candidates) {
    const block = blockByKey(step, key);
    if (block !== undefined) return block;
  }
  return undefined;
}

function isInternalTitleCandidate(value: string, module: InteractiveRuntimeModuleManifest) {
  const title = value.trim();
  if (!title) return true;
  if (/[\u4e00-\u9fff]/.test(title)) return false;
  if (title === module.id || title === module.id.replace(/-/g, '_')) return true;
  const payloadKeys = [
    module.payload.block_key,
    module.payload.blockKey,
    module.payload.image_key,
    module.payload.imageKey,
    module.payload.panel_id,
    module.payload.panelId,
    module.payload.spec_key,
    module.payload.specKey,
  ].filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (payloadKeys.includes(title)) return true;
  return false;
}

function titleFromBlock(value: unknown) {
  const record = asRecord(value);
  return [record.title, record.caption, record.alt, record.name, record.label]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

export function titleFromModule(module: InteractiveRuntimeModuleManifest, step?: InteractiveRuntimeStepManifest) {
  const title = module.title ?? module.payload.title ?? module.payload.caption;
  if (typeof title === 'string' && title.trim() && !isInternalTitleCandidate(title, module)) return title;
  if (step) {
    const blockTitle = titleFromBlock(blockFor(step, module.payload) ?? blockByModuleId(step, module));
    if (blockTitle && !isInternalTitleCandidate(blockTitle, module)) return blockTitle;
  }
  return MODULE_KIND_TITLE[module.kind] ?? '学习内容';
}
