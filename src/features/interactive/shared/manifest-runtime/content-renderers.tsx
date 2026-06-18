'use client';

import Image from 'next/image';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type {
  InteractiveModuleRegistry,
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';
import { buildControlWorkbenchClientEvidenceDraft } from './control-workbench-evidence';
import { isControlWorkbenchComputeCapabilityRef } from './module-taxonomy';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import { StaticSurface3DPanel, type StaticSurface3DPanelProps, type StaticSurfaceDataset } from './static-surface-3d-panel';

type ContentRecord = Record<string, unknown>;
type ManifestComputePanelSubmission = {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
};
type TableCell = string | { kind: 'math'; value: string };
type NativeTableData = { columns: string[]; rows: TableCell[][] };
type RevealItem = { body: string; formula?: string; title?: string };
type FormulaSymbol = { symbol: string; meaning: string };
type CodeTokenKind = 'keyword' | 'function' | 'number' | 'string' | 'comment' | 'operator' | 'plain';
type CodeToken = { value: string; kind: CodeTokenKind };
type InteractiveFigureKind = 'drag_pole_s_plane' | 'three_ships_case';
type VisualStageAspectRatio = '16:9' | '4:3' | 'fluid';
type VisualStageLayerKind = 'diagram' | 'formula' | 'annotation' | 'media' | 'activity' | 'control';
type VisualStageRegion = { x: number; y: number; width: number; height: number };
type VisualStageLayer = {
  id: string;
  kind: VisualStageLayerKind;
  title: string;
  body: string;
  region: VisualStageRegion;
  zIndex: number;
  revealState?: string;
  activityAnchor?: string;
};
type VisualStagePayload = {
  stageId: string;
  aspectRatio: VisualStageAspectRatio;
  releaseState: string;
  activeRevealState: string;
  layers: VisualStageLayer[];
};
type DerivationFormulaBlockColorRole = 'known' | 'transform' | 'cancel' | 'target' | 'risk' | 'result';
type DerivationStageRegion = VisualStageRegion;
type DerivationFormulaBlock = {
  id: string;
  latex: string;
  title: string;
  colorRole?: DerivationFormulaBlockColorRole;
};
type DerivationFormula = {
  id: string;
  title: string;
  latex: string;
  region: DerivationStageRegion;
  blocks: DerivationFormulaBlock[];
};
type DerivationTextBlock = {
  id: string;
  title: string;
  body: string;
  region: DerivationStageRegion;
};
type DerivationConnector = {
  id: string;
  kind: string;
  from: string;
  to: string;
  revealStepIds: string[];
};
type DerivationRevealStep = {
  id: string;
  title: string;
  targetIds: string[];
  reasoning: string;
};
type DerivationStagePayload = {
  stageId: string;
  aspectRatio: VisualStageAspectRatio;
  releaseState: string;
  activeRevealStepId: string;
  formulas: DerivationFormula[];
  textBlocks: DerivationTextBlock[];
  connectors: DerivationConnector[];
  revealSteps: DerivationRevealStep[];
  teacherControls: string[];
  answerVisible: boolean;
};

const MATLAB_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'classdef',
  'continue',
  'else',
  'elseif',
  'end',
  'for',
  'function',
  'global',
  'if',
  'otherwise',
  'parfor',
  'persistent',
  'return',
  'spmd',
  'switch',
  'try',
  'while',
]);

const MATLAB_CONTROL_FUNCTIONS = new Set([
  'bode',
  'feedback',
  'figure',
  'grid',
  'hold',
  'isstable',
  'margin',
  'rlocus',
  'step',
  'stepinfo',
  'tf',
  'title',
]);

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ContentRecord) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    .map((item) => String(item));
}

function asTableRows(value: unknown): TableCell[][] {
  if (!Array.isArray(value)) return [];
  const rows: TableCell[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) continue;
    rows.push(
      row.map((cell) => {
        if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
          const record = cell as ContentRecord;
          if (record.kind === 'math') {
            return { kind: 'math', value: String(record.value ?? '') };
          }
        }
        return String(cell);
      }),
    );
  }
  return rows;
}

function tableFromBlock(block: unknown): NativeTableData | null {
  const source = asRecord(block);
  const columns = asStringArray(source.columns);
  const rows = asTableRows(source.rows);
  if (!columns.length || !rows.length) return null;
  return { columns, rows };
}

function keyValueFormulaTableFromBlock(block: unknown): NativeTableData | null {
  const source = asRecord(block);
  const entries = Object.entries(source)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => [key, String(value)] as TableCell[]);
  if (!entries.length) return null;
  return { columns: ['对象', '公式'], rows: entries };
}

function normalizeMath(value: string) {
  return value
    .trim()
    .replace(/^\$/, '')
    .replace(/\$$/, '')
    .replace(/\\\\/g, '\\');
}

function renderInlineContent(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={`${part}-${index}`} math={normalizeMath(part)} />;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderTableCell(cell: TableCell) {
  if (typeof cell === 'string') return renderInlineContent(cell);
  return <InlineMath math={normalizeMath(cell.value)} />;
}

function renderFormulaContent(formula: string) {
  const value = formula.trim();
  const inlineMatches = value.match(/\$[^$]+\$/g) ?? [];
  const nonMathText = value.replace(/\$[^$]+\$/g, '').trim();
  const isSingleMathExpression = inlineMatches.length === 1 && !nonMathText;
  const hasLatexCommand = /\\[a-zA-Z]+/.test(value);
  const isBareMathExpression = !inlineMatches.length && (hasLatexCommand || !/[\u4e00-\u9fff]/.test(value));

  if (isSingleMathExpression || isBareMathExpression) {
    return <BlockMath math={normalizeMath(value)} />;
  }

  return <p className="premium-lesson-title text-sm leading-7">{renderInlineContent(value)}</p>;
}

const MODULE_KIND_TITLE: Record<string, string> = {
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

function titleFromModule(module: InteractiveRuntimeModuleManifest, step?: InteractiveRuntimeStepManifest) {
  const title = module.title ?? module.payload.title ?? module.payload.caption;
  if (typeof title === 'string' && title.trim() && !isInternalTitleCandidate(title, module)) return title;
  if (step) {
    const blockTitle = titleFromBlock(blockFor(step, module.payload) ?? blockByModuleId(step, module));
    if (blockTitle && !isInternalTitleCandidate(blockTitle, module)) return blockTitle;
  }
  return MODULE_KIND_TITLE[module.kind] ?? '学习内容';
}

function uniqueStrings(items: string[]) {
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed && !result.includes(trimmed)) result.push(trimmed);
  }
  return result;
}

function numberInRange(value: unknown, fallback: number, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

function visualStageAspectRatio(value: unknown): VisualStageAspectRatio {
  return value === '4:3' || value === 'fluid' ? value : '16:9';
}

function visualStageString(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function visualStageOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function visualStageRegion(value: unknown): VisualStageRegion {
  const region = asRecord(value);
  return {
    x: numberInRange(region.x, 0),
    y: numberInRange(region.y, 0),
    width: numberInRange(region.width ?? region.w, 1, 0.05, 1),
    height: numberInRange(region.height ?? region.h, 1, 0.05, 1),
  };
}

function visualStageLayers(value: unknown): VisualStageLayer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): VisualStageLayer | null => {
      const layer = asRecord(item);
      const id = String(layer.id ?? '').trim();
      if (!id) return null;
      const kind = ['diagram', 'formula', 'annotation', 'media', 'activity', 'control'].includes(String(layer.kind))
        ? String(layer.kind) as VisualStageLayerKind
        : 'annotation';
      return {
        id,
        kind,
        title: String(layer.title ?? layer.label ?? `Layer ${index + 1}`),
        body: String(layer.body ?? layer.text ?? layer.description ?? ''),
        region: visualStageRegion(layer.region),
        zIndex: Number.isFinite(Number(layer.zIndex ?? layer.z_index)) ? Number(layer.zIndex ?? layer.z_index) : index,
        revealState: visualStageOptionalString(layer.revealState ?? layer.reveal_state),
        activityAnchor: typeof layer.activityAnchor === 'string'
          ? layer.activityAnchor
          : typeof layer.activity_anchor === 'string'
            ? layer.activity_anchor
            : undefined,
      };
    })
    .filter((item): item is VisualStageLayer => Boolean(item))
    .sort((left, right) => left.zIndex - right.zIndex);
}

function visualStagePayload(module: InteractiveRuntimeModuleManifest): VisualStagePayload {
  const payload = module.payload;
  return {
    stageId: String(payload.stageId ?? payload.stage_id ?? module.id),
    aspectRatio: visualStageAspectRatio(payload.aspectRatio ?? payload.aspect_ratio),
    releaseState: visualStageString(payload.releaseState ?? payload.release_state, 'released'),
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    layers: visualStageLayers(payload.layers),
  };
}

function visualStageReleaseLabel(releaseState: string) {
  if (releaseState === 'unavailable') return '当前舞台暂不可用。';
  if (releaseState === 'unreleased') return '等待教师发放后查看舞台内容。';
  if (releaseState === 'revealed') return '教师已展开当前显影步骤。';
  return '在同一画布中观察对象、关系和显影步骤。';
}

function visualStageLayerKindLabel(kind: VisualStageLayerKind) {
  const labels: Record<VisualStageLayerKind, string> = {
    diagram: '关系图',
    formula: '公式',
    annotation: '标注',
    media: '媒体',
    activity: '活动锚点',
    control: '控制对象',
  };
  return labels[kind];
}

function derivationColorRole(value: unknown): DerivationFormulaBlockColorRole | undefined {
  return ['known', 'transform', 'cancel', 'target', 'risk', 'result'].includes(String(value))
    ? String(value) as DerivationFormulaBlockColorRole
    : undefined;
}

function derivationFormulaBlocks(value: unknown, fallbackLatex: string): DerivationFormulaBlock[] {
  if (!Array.isArray(value)) {
    return [{ id: 'formula', latex: fallbackLatex, title: '完整公式' }];
  }
  return value
    .map((item, index): DerivationFormulaBlock | null => {
      const block = asRecord(item);
      const id = String(block.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        latex: visualStageString(block.latex ?? block.latexSource ?? block.latex_source, fallbackLatex),
        title: String(block.title ?? block.label ?? `公式块 ${index + 1}`),
        colorRole: derivationColorRole(block.colorRole ?? block.color_role),
      };
    })
    .filter((item): item is DerivationFormulaBlock => Boolean(item));
}

function derivationFormulas(value: unknown): DerivationFormula[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): DerivationFormula | null => {
      const formula = asRecord(item);
      const id = String(formula.id ?? '').trim();
      const latex = visualStageString(formula.latex ?? formula.latexSource ?? formula.latex_source, '');
      if (!id || !latex) return null;
      return {
        id,
        title: String(formula.title ?? formula.label ?? `公式 ${index + 1}`),
        latex,
        region: visualStageRegion(formula.region),
        blocks: derivationFormulaBlocks(formula.blocks, latex),
      };
    })
    .filter((item): item is DerivationFormula => Boolean(item));
}

function derivationTextBlocks(value: unknown): DerivationTextBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): DerivationTextBlock | null => {
      const textBlock = asRecord(item);
      const id = String(textBlock.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        title: String(textBlock.title ?? textBlock.label ?? `说明 ${index + 1}`),
        body: String(textBlock.body ?? textBlock.text ?? textBlock.description ?? ''),
        region: visualStageRegion(textBlock.region),
      };
    })
    .filter((item): item is DerivationTextBlock => Boolean(item));
}

function derivationConnectors(value: unknown): DerivationConnector[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): DerivationConnector | null => {
      const connector = asRecord(item);
      const id = String(connector.id ?? '').trim();
      const from = String(connector.from ?? connector.fromId ?? connector.from_id ?? '').trim();
      const to = String(connector.to ?? connector.toId ?? connector.to_id ?? '').trim();
      if (!id || !from || !to) return null;
      return {
        id,
        from,
        to,
        kind: String(connector.kind ?? `connector-${index + 1}`),
        revealStepIds: asStringArray(connector.revealStepIds ?? connector.reveal_step_ids),
      };
    })
    .filter((item): item is DerivationConnector => Boolean(item));
}

function derivationRevealSteps(value: unknown): DerivationRevealStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): DerivationRevealStep | null => {
      const step = asRecord(item);
      const id = String(step.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        title: String(step.title ?? step.label ?? `显影 ${index + 1}`),
        targetIds: asStringArray(step.targetIds ?? step.target_ids ?? step.targets),
        reasoning: String(step.reasoning ?? step.teachingNote ?? step.teaching_note ?? ''),
      };
    })
    .filter((item): item is DerivationRevealStep => Boolean(item));
}

function derivationStagePayload(module: InteractiveRuntimeModuleManifest): DerivationStagePayload {
  const payload = module.payload;
  const revealSteps = derivationRevealSteps(payload.revealSteps ?? payload.reveal_steps);
  const activeRevealStepId = visualStageString(
    payload.activeRevealStepId ?? payload.active_reveal_step_id,
    revealSteps[0]?.id ?? 'all',
  );
  const teacherControlsPayload = asRecord(payload.teacherControls ?? payload.teacher_controls);
  const teacherControls = asStringArray(teacherControlsPayload.enabled ?? teacherControlsPayload.controls);
  return {
    stageId: String(payload.stageId ?? payload.stage_id ?? module.id),
    aspectRatio: visualStageAspectRatio(payload.aspectRatio ?? payload.aspect_ratio),
    releaseState: visualStageString(payload.releaseState ?? payload.release_state, 'released'),
    activeRevealStepId,
    formulas: derivationFormulas(payload.formulas),
    textBlocks: derivationTextBlocks(payload.textBlocks ?? payload.text_blocks),
    connectors: derivationConnectors(payload.connectors),
    revealSteps,
    teacherControls,
    answerVisible: Boolean(payload.answerVisible ?? payload.answer_visible),
  };
}

function derivationStageReleaseLabel(releaseState: string) {
  if (releaseState === 'unavailable') return '当前推导暂不可用。';
  if (releaseState === 'unreleased') return '等待教师发放后查看推导。';
  if (releaseState === 'revealed') return '教师已展开当前推导位置。';
  return '按显影步骤观察公式块、说明和关联线。';
}

function derivationStageVisibleTargetIds(stage: DerivationStagePayload) {
  if (stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased') return new Set<string>();
  if (stage.activeRevealStepId === 'all') {
    return new Set([
      ...stage.formulas.flatMap((formula) => [formula.id, ...formula.blocks.map((block) => block.id)]),
      ...stage.textBlocks.map((block) => block.id),
    ]);
  }
  const activeIndex = stage.revealSteps.findIndex((step) => step.id === stage.activeRevealStepId);
  const visibleSteps = activeIndex >= 0 ? stage.revealSteps.slice(0, activeIndex + 1) : stage.revealSteps.slice(0, 1);
  return new Set(visibleSteps.flatMap((step) => step.targetIds));
}

function derivationVisibleRevealStepIds(stage: DerivationStagePayload) {
  if (stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased') return new Set<string>();
  if (stage.activeRevealStepId === 'all') return new Set(stage.revealSteps.map((step) => step.id));
  const activeIndex = stage.revealSteps.findIndex((step) => step.id === stage.activeRevealStepId);
  const visibleSteps = activeIndex >= 0 ? stage.revealSteps.slice(0, activeIndex + 1) : stage.revealSteps.slice(0, 1);
  return new Set(visibleSteps.map((step) => step.id));
}

function derivationTargetRegionMap(stage: DerivationStagePayload) {
  const entries = new Map<string, DerivationStageRegion>();
  for (const formula of stage.formulas) {
    entries.set(formula.id, formula.region);
    const blockHeight = formula.region.height / Math.max(formula.blocks.length, 1);
    formula.blocks.forEach((block, index) => {
      entries.set(block.id, {
        x: formula.region.x,
        y: formula.region.y + (blockHeight * index),
        width: formula.region.width,
        height: blockHeight,
      });
    });
  }
  for (const textBlock of stage.textBlocks) {
    entries.set(textBlock.id, textBlock.region);
  }
  return entries;
}

function derivationConnectorEndpoint(region: DerivationStageRegion | undefined, fallback: { x: number; y: number }) {
  if (!region) return fallback;
  return {
    x: (region.x + region.width / 2) * 100,
    y: (region.y + region.height / 2) * 100,
  };
}

function derivationColorRoleClass(role?: DerivationFormulaBlockColorRole) {
  if (role === 'known') return 'border-platform-border bg-platform-surface';
  if (role === 'transform') return 'border-platform-accent/45 bg-platform-action-subtle';
  if (role === 'cancel') return 'border-platform-evidence-unsupported/45 bg-platform-evidence-unsupported/10';
  if (role === 'target') return 'border-platform-evidence-eligible/45 bg-platform-evidence-eligible/10';
  if (role === 'risk') return 'border-platform-evidence-context/45 bg-platform-evidence-context/10';
  if (role === 'result') return 'border-platform-accent/50 bg-platform-accent/10';
  return 'border-platform-border bg-platform-panel';
}

function derivationTeacherControlLabel(control: string) {
  const labels: Record<string, string> = {
    next: '下一步',
    previous: '上一步',
    jump: '跳转',
    highlight: '高亮',
    answerReveal: '答案',
    reset: '重置',
  };
  return labels[control] ?? control;
}

function textFieldsFromPayload(payload: ContentRecord, fields: string[]) {
  return uniqueStrings(
    fields
      .map((field) => payload[field])
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim())),
  );
}

function ManifestContentTitle({ children }: { children: ReactNode }) {
  return (
    <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">
      {typeof children === 'string' ? renderInlineContent(children) : children}
    </div>
  );
}

function blockFor(step: InteractiveRuntimeStepManifest, payload: ContentRecord) {
  const key = payload.block_key ?? payload.blockKey ?? payload.formula_key ?? payload.formulaKey ?? payload.image_key ?? payload.imageKey;
  return typeof key === 'string' && key ? step.contentBlocks[key] : undefined;
}

function stringField(source: ContentRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function blockByKey(step: InteractiveRuntimeStepManifest, key: string) {
  return step.contentBlocks[key];
}

function blockByModuleId(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
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

function codePayload(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const block = asRecord(blockFor(step, payload));
  const moduleBlock = asRecord(blockByModuleId(step, module));
  const code = stringField(payload, ['code', 'text', 'formula'])
    || stringField(block, ['code', 'text', 'formula'])
    || stringField(moduleBlock, ['code', 'text', 'formula']);
  const language = stringField(payload, ['language', 'lang'])
    || stringField(block, ['language', 'lang'])
    || stringField(moduleBlock, ['language', 'lang'])
    || 'matlab';
  const note = stringField(payload, ['note', 'explanation'])
    || stringField(block, ['note', 'explanation'])
    || stringField(moduleBlock, ['note', 'explanation']);

  return {
    code,
    language: language.toLowerCase(),
    note,
  };
}

function tokenizeMatlabLine(line: string): CodeToken[] {
  const commentIndex = line.indexOf('%');
  if (commentIndex >= 0) {
    return [
      ...tokenizeMatlabCodeSegment(line.slice(0, commentIndex)),
      { value: line.slice(commentIndex), kind: 'comment' as const },
    ].filter((token) => token.value.length > 0);
  }
  return tokenizeMatlabCodeSegment(line);
}

function tokenizeMatlabCodeSegment(segment: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const matcher = /('(?:''|[^'])*')|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b[A-Za-z_]\w*\b)|([()[\]{},;=+\-*/^<>:.]+)|(\s+)|([^A-Za-z_\d\s()[\]{},;=+\-*/^<>:.]+)/gi;
  for (const match of segment.matchAll(matcher)) {
    const value = match[0];
    if (match[1]) {
      tokens.push({ value, kind: 'string' });
    } else if (match[2]) {
      tokens.push({ value, kind: 'number' });
    } else if (match[3]) {
      const lower = value.toLowerCase();
      if (MATLAB_KEYWORDS.has(lower)) {
        tokens.push({ value, kind: 'keyword' });
      } else if (MATLAB_CONTROL_FUNCTIONS.has(lower)) {
        tokens.push({ value, kind: 'function' });
      } else {
        tokens.push({ value, kind: 'plain' });
      }
    } else if (match[4]) {
      tokens.push({ value, kind: 'operator' });
    } else {
      tokens.push({ value, kind: 'plain' });
    }
  }
  return tokens;
}

function renderHighlightedCode(code: string, language: string) {
  const lines = code.split('\n');
  return lines.map((line, lineIndex) => {
    const tokens = language === 'matlab' || language === 'octave'
      ? tokenizeMatlabLine(line)
      : [{ value: line, kind: 'plain' as const }];
    return (
      <span key={`${line}-${lineIndex}`} className="premium-code-line">
        {tokens.map((token, tokenIndex) => (
          <span
            key={`${lineIndex}-${tokenIndex}-${token.kind}`}
            className={`premium-code-token premium-code-token-${token.kind}`}
          >
            {token.value}
          </span>
        ))}
      </span>
    );
  });
}

function moduleIndexByKind(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
  kinds: string[],
) {
  return step.modules
    .filter((item) => kinds.includes(item.kind))
    .findIndex((item) => item.id === module.id);
}

function firstBlockWithTable(step: InteractiveRuntimeStepManifest) {
  for (const value of Object.values(step.contentBlocks)) {
    const table = tableFromBlock(value);
    if (table) return table;
  }
  return null;
}

function valueAtField(source: unknown, field: unknown) {
  if (typeof field !== 'string' || !field) return source;
  return asRecord(source)[field];
}

function formulaItemsFromSource(source: unknown): string[] {
  const directItems = asStringArray(source);
  if (typeof source === 'string') directItems.push(source);
  const record = asRecord(source);
  directItems.push(
    ...asStringArray(record.items),
    ...asStringArray(record.formulas),
    ...asStringArray(record.latex),
    ...asStringArray(record.math),
    ...asStringArray(record.values),
  );
  for (const key of ['formula', 'latex', 'math', 'value'] as const) {
    const value = record[key];
    if (typeof value === 'string') directItems.push(value);
  }
  return uniqueStrings(directItems);
}

function getFormulaItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const direct = payload.formula ?? payload.formulas;
  const keyedBlock = blockFor(step, payload);
  const fallbackBlock = asRecord(blockByKey(step, 'formula_block'));
  const moduleBlock = blockByModuleId(step, module);
  const keyFormulas = asStringArray(step.contentBlocks.key_formulas);
  const formulaModuleIndex = moduleIndexByKind(step, module, ['formula-card']);
  const requestedField = Object.prototype.hasOwnProperty.call(payload, 'field') ? payload.field : 'latex';
  const source = direct
    ?? valueAtField(keyedBlock, requestedField)
    ?? valueAtField(keyedBlock, 'formula')
    ?? valueAtField(keyedBlock, 'formulas')
    ?? valueAtField(keyedBlock, 'latex')
    ?? valueAtField(keyedBlock, 'math')
    ?? valueAtField(keyedBlock, 'value')
    ?? valueAtField(keyedBlock, 'items')
    ?? keyedBlock
    ?? valueAtField(moduleBlock, requestedField)
    ?? valueAtField(moduleBlock, 'formula')
    ?? valueAtField(moduleBlock, 'latex')
    ?? valueAtField(moduleBlock, 'math')
    ?? valueAtField(moduleBlock, 'value')
    ?? valueAtField(moduleBlock, 'formulas')
    ?? valueAtField(moduleBlock, 'items')
    ?? moduleBlock
    ?? payload.text
    ?? (
      formulaModuleIndex >= 0 && keyFormulas[formulaModuleIndex] !== undefined
        ? keyFormulas[formulaModuleIndex]
        : undefined
    )
    ?? [fallbackBlock.object, fallbackBlock.controller, fallbackBlock.controller_form].filter(Boolean);
  const items = formulaItemsFromSource(source);

  if (typeof payload.formula_index === 'number') {
    return items[payload.formula_index] ? [items[payload.formula_index]] : [];
  }
  if (typeof payload.formulaIndex === 'number') {
    return items[payload.formulaIndex] ? [items[payload.formulaIndex]] : [];
  }

  return items.filter(Boolean);
}

function formulaNotes(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const hasExplicitFormula = Boolean(module.payload.formula ?? module.payload.formulas);
  const keyedBlock = asRecord(blockFor(step, module.payload));
  const moduleBlock = asRecord(blockByModuleId(step, module));
  const blockNotes = textFieldsFromPayload(keyedBlock, ['body', 'note', 'explanation', 'text'])
    .concat(textFieldsFromPayload(moduleBlock, ['body', 'note', 'explanation', 'text']));
  return textFieldsFromPayload(
    module.payload,
    hasExplicitFormula ? ['body', 'text', 'note', 'explanation'] : ['body', 'note', 'explanation'],
  ).concat(blockNotes);
}

function formulaSymbolFromValue(value: unknown): FormulaSymbol | null {
  if (typeof value === 'string' && value.trim()) return { symbol: value, meaning: '' };
  const record = asRecord(value);
  const symbol = [record.symbol, record.latex, record.math, record.name, record.value]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (!symbol) return null;
  const meaning = [record.meaning, record.description, record.text, record.explanation, record.note]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim())) ?? '';
  return { symbol, meaning };
}

function formulaSymbols(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const sources = [
    module.payload.symbols,
    asRecord(blockFor(step, module.payload)).symbols,
    asRecord(blockByModuleId(step, module)).symbols,
  ];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const symbols = source
      .map(formulaSymbolFromValue)
      .filter((item): item is FormulaSymbol => Boolean(item));
    if (symbols.length) return symbols;
  }
  return [];
}

function runtimeMediaPath(manifest: InteractiveRuntimeManifest, path: string) {
  if (path.startsWith('/')) return path;
  return `/course-runtime/lessons/${manifest.lessonId}/media/${path}`;
}

function mediaPathFromBlock(value: unknown, imageIndex: number, imageCount: number) {
  const record = asRecord(value);
  const direct = record.runtime_media ?? record.runtimeMedia ?? record.path ?? record.src ?? record.asset;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const items = Array.isArray(record.assets)
    ? record.assets
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(value)
        ? value
        : [];
  if (items.length) {
    const selected = items.length === imageCount ? items[imageIndex] : items[0];
    if (typeof selected === 'string' && selected.trim()) return selected;
    const selectedRecord = asRecord(selected);
    const selectedPath = selectedRecord.runtime_media ?? selectedRecord.runtimeMedia ?? selectedRecord.path ?? selectedRecord.src ?? selectedRecord.asset;
    if (typeof selectedPath === 'string' && selectedPath.trim()) return selectedPath;
  }
  return null;
}

function getImageSrc(
  manifest: InteractiveRuntimeManifest,
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const payload = module.payload;
  const direct = [payload.src, payload.path, payload.runtime_media, payload.runtimeMedia, payload.fallback_image, payload.fallbackImage]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (direct?.trim()) return runtimeMediaPath(manifest, direct);
  const { index, count } = imageModulePosition(step, module);
  const imageIndex = Math.max(0, index);
  const field = payload.field ?? 'runtime_media';
  const value = valueAtField(blockFor(step, payload), field);
  if (typeof value === 'string' && value.trim()) return value;
  const blockMediaPath = mediaPathFromBlock(blockFor(step, payload) ?? blockByModuleId(step, module), imageIndex, count);
  if (blockMediaPath) return runtimeMediaPath(manifest, blockMediaPath);

  const mediaItems = Object.values(step.contentBlocks).flatMap((block) => {
    const record = asRecord(block);
    if (typeof record.runtime_media === 'string') return [record.runtime_media];
    if (typeof record.path === 'string') return [runtimeMediaPath(manifest, record.path)];
    if (typeof record.asset === 'string') return [runtimeMediaPath(manifest, record.asset)];
    if (Array.isArray(block)) {
      return block
        .map((item) => asRecord(item).runtime_media ?? asRecord(item).asset)
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
    return [];
  });
  return mediaItems[imageIndex] ?? mediaItems[0] ?? null;
}

function imageModulePosition(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const modules = step.modules.filter((item) => ['content.figure', 'image-panel', 'comparison-graphic', 'interactive-figure-panel', 'media-card'].includes(item.kind));
  return {
    index: modules.findIndex((item) => item.id === module.id),
    count: modules.length,
  };
}

function imageItemsFromPayload(manifest: InteractiveRuntimeManifest, payload: ContentRecord) {
  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.assets)
      ? payload.assets
      : Array.isArray(payload.fallback_images)
        ? payload.fallback_images
        : Array.isArray(payload.fallbackImages)
          ? payload.fallbackImages
          : [];
  return items
    .map((item) => {
      if (typeof item === 'string') {
        return { src: runtimeMediaPath(manifest, item), caption: '' };
      }
      const record = asRecord(item);
      const path = [record.path, record.src, record.runtime_media, record.runtimeMedia, record.asset]
        .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
      if (!path) return null;
      const caption = [record.caption, record.explanation, record.note]
        .find((value): value is string => typeof value === 'string' && Boolean(value.trim())) ?? '';
      return { src: runtimeMediaPath(manifest, path), caption };
    })
    .filter((item): item is { src: string; caption: string } => Boolean(item));
}

function staticSurfacePanelProps(
  manifest: InteractiveRuntimeManifest,
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
): StaticSurface3DPanelProps {
  const payload = module.payload;
  const block = asRecord(blockFor(step, payload));
  const data = asRecord(payload.data ?? payload.dataSource ?? payload.surfaceData);
  const axes = asRecord(payload.axes);
  const colorScale = asRecord(payload.colorScale ?? payload.color_scale);
  const defaultCamera = asRecord(payload.defaultCamera ?? payload.default_camera);
  const fallback = asRecord(payload.fallback);
  const fallbackImage = stringField(fallback, ['image', 'src', 'path'])
    || stringField(payload, ['fallback_image', 'fallbackImage']);
  const dataUrl = stringField(data, ['url', 'src', 'path']);

  return {
    moduleId: module.id,
    title: titleFromModule(module, step),
    caption: stringField(payload, ['caption', 'description', 'text'])
      || stringField(block, ['description', 'body', 'text']),
    dataUrl: dataUrl ? runtimeMediaPath(manifest, dataUrl) : undefined,
    dataset: staticSurfaceDataset(data),
    axes: {
      x: { label: axisLabel(axes.x, '实部 σ') },
      y: { label: axisLabel(axes.y, '虚部 jω') },
      z: { label: axisLabel(axes.z, '幅值') },
    },
    colorScale: {
      label: stringField(colorScale, ['label', 'title']) || '幅值',
      min: numberField(colorScale, ['min']),
      max: numberField(colorScale, ['max']),
    },
    defaultCamera: {
      position: numberTuple3(defaultCamera.position, [3, 3, 2]),
      target: numberTuple3(defaultCamera.target, [0, 0, 0]),
      zoom: numberField(defaultCamera, ['zoom']) ?? 1,
    },
    fallback: {
      image: runtimeMediaPath(manifest, fallbackImage),
      alt: stringField(fallback, ['alt', 'description'])
        || stringField(block, ['description', 'body', 'text'])
        || `${titleFromModule(module, step)}静态图`,
      note: stringField(fallback, ['note']),
    },
    markers: markerConfigs(payload.markers ?? block.markers),
  };
}

function axisLabel(value: unknown, fallback: string) {
  const axis = asRecord(value);
  return stringField(axis, ['label', 'title', 'name']) || fallback;
}

function numberField(source: ContentRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function numberTuple3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const tuple = value.slice(0, 3).map((item) => Number(item));
  return tuple.every((item) => Number.isFinite(item))
    ? tuple as [number, number, number]
    : fallback;
}

function markerConfigs(value: unknown): StaticSurface3DPanelProps['markers'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const marker = asRecord(item);
      const label = stringField(marker, ['label', 'title']);
      if (!label) return null;
      return {
        label,
        position: numberTuple3(marker.position, [0, 0, 0]),
      };
    })
    .filter((item): item is NonNullable<StaticSurface3DPanelProps['markers']>[number] => Boolean(item));
}

function staticSurfaceDataset(data: ContentRecord): StaticSurfaceDataset | undefined {
  const regularGrid = asRecord(data.regularGrid);
  if (regularGrid.x || regularGrid.y || regularGrid.values) {
    return {
      regularGrid: {
        x: numericArray(regularGrid.x),
        y: numericArray(regularGrid.y),
        values: numericRows(regularGrid.values),
      },
      markers: markerConfigs(data.markers),
    };
  }

  if (Array.isArray(data.vertices)) {
    return {
      vertices: pointRows(data.vertices),
      indices: triangleRows(data.indices) ?? numericArray(data.indices),
      markers: markerConfigs(data.markers),
    };
  }

  return undefined;
}

function interactiveFigureSpecKey(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const block = asRecord(blockFor(step, module.payload));
  return stringField(module.payload, ['spec_key', 'specKey'])
    || stringField(block, ['spec_key', 'specKey']);
}

function isInteractiveFigureKind(value: string): value is InteractiveFigureKind {
  return value === 'drag_pole_s_plane' || value === 'three_ships_case';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function svgPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function responsePoints({
  sigma,
  omega,
  mode,
  width,
  height,
  timeScale = 1,
}: {
  sigma: number;
  omega: number;
  mode: 'conjugate_pair' | 'single_real';
  width: number;
  height: number;
  timeScale?: number;
}) {
  const points: Array<{ x: number; raw: number }> = [];
  const horizon = 8 / Math.max(1, timeScale);
  for (let index = 0; index <= 96; index += 1) {
    const t = (index / 96) * horizon;
    const envelope = Math.exp(sigma * t);
    const raw = mode === 'single_real'
      ? 1 - envelope
      : 1 - envelope * Math.cos(Math.max(0.05, omega) * t);
    points.push({ x: (index / 96) * width, raw });
  }
  const rawValues = points.map((point) => point.raw);
  const minY = Math.min(-1.5, ...rawValues);
  const maxY = Math.max(2.5, ...rawValues);
  return points.map((point) => ({
    x: point.x,
    y: height - ((point.raw - minY) / Math.max(1e-6, maxY - minY)) * height,
  }));
}

function PoleResponseComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const [sigma, setSigma] = useState(-1);
  const [omega, setOmega] = useState(2);
  const [mode, setMode] = useState<'conjugate_pair' | 'single_real'>('conjugate_pair');
  const [observationText, setObservationText] = useState('左半平面对应收敛，虚部越大摆动越密。');
  const plotWidth = 320;
  const plotHeight = 180;
  const planeX = ((clamp(sigma, -5, 2) + 5) / 7) * plotWidth;
  const planeY = plotHeight - (clamp(omega, 0, 5) / 5) * plotHeight;
  const curve = responsePoints({ sigma, omega, mode, width: plotWidth, height: plotHeight });
  const cardId = step.interactionSpec.activityCards?.[0]?.id ?? 'drag-pole-submit';

  const submitCurrent = () => {
    if (!onPanelSubmit) return;
    onPanelSubmit?.({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: {
        [cardId]: JSON.stringify({
          sigma: sigma.toFixed(2),
          omega: mode === 'single_real' ? '0.00' : omega.toFixed(2),
          observation_text: observationText,
        }),
      },
    });
  };

  return (
    <section className="premium-lesson-panel space-y-4" data-interactive-figure-panel="drag_pole_s_plane" data-module-id={module.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="premium-lesson-kicker">极点行为地图</div>
          <h3 className="premium-lesson-title mt-1 text-lg font-semibold">拖动极点看响应</h3>
          <p className="premium-lesson-muted mt-1 text-sm leading-6">左侧记录极点坐标，右侧实时显示对应的响应走势。</p>
        </div>
        <button
          type="button"
          onClick={submitCurrent}
          disabled={!onPanelSubmit}
          className="premium-lesson-action-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {onPanelSubmit ? '提交当前参数' : '等待教师发放'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="premium-lesson-surface-elevated p-3">
          <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[220px] w-full" role="img" aria-label="极点复平面">
            <rect x="0" y="0" width={plotWidth / 7 * 5} height={plotHeight} fill="hsl(var(--platform-action-primary) / 0.10)" />
            <rect x={plotWidth / 7 * 5} y="0" width={plotWidth / 7 * 2} height={plotHeight} fill="hsl(var(--platform-evidence-unsupported) / 0.10)" />
            <line x1={plotWidth / 7 * 5} y1="0" x2={plotWidth / 7 * 5} y2={plotHeight} stroke="hsl(var(--platform-fg-secondary))" strokeWidth="2" />
            <line x1="0" y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="hsl(var(--platform-border-strong))" />
            <line x1="0" y1={plotHeight} x2="0" y2="0" stroke="hsl(var(--platform-border-strong))" />
            <text x="10" y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">稳定区</text>
            <text x={plotWidth - 60} y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">不稳定区</text>
            <text x={plotWidth / 7 * 5 + 6} y={plotHeight - 8} fill="hsl(var(--platform-fg-muted))" className="text-[10px]">虚轴</text>
            <circle cx={planeX} cy={planeY} r="8" fill="hsl(var(--platform-action-primary))" />
            <line x1={planeX - 12} y1={planeY} x2={planeX + 12} y2={planeY} stroke="hsl(var(--platform-fg-inverse))" strokeWidth="2" />
            <line x1={planeX} y1={planeY - 12} x2={planeX} y2={planeY + 12} stroke="hsl(var(--platform-fg-inverse))" strokeWidth="2" />
          </svg>
        </div>
        <div className="premium-lesson-surface-elevated p-3">
          <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[220px] w-full" role="img" aria-label="极点对应的时域响应">
            <line x1="0" y1={plotHeight * 0.58} x2={plotWidth} y2={plotHeight * 0.58} stroke="hsl(var(--platform-border))" strokeDasharray="4 4" />
            <path d={svgPath(curve)} fill="none" stroke="hsl(var(--platform-action-primary))" strokeWidth="3" />
            <text x="10" y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">响应曲线</text>
          </svg>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
          <span>σ（实部）</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="-5" max="2" step="0.1" value={sigma} onChange={(event) => setSigma(Number(event.target.value))} />
          <span className="premium-lesson-caption">{sigma.toFixed(1)}</span>
        </label>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
          <span>ω（虚部）</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="0" max="5" step="0.1" value={omega} disabled={mode === 'single_real'} onChange={(event) => setOmega(Number(event.target.value))} />
          <span className="premium-lesson-caption">{mode === 'single_real' ? '0.0' : omega.toFixed(1)}</span>
        </label>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
          <span>极点模式</span>
          <select className="premium-lesson-select" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="conjugate_pair">共轭极点</option>
            <option value="single_real">单实极点</option>
          </select>
        </label>
        <button type="button" className="premium-lesson-action-tone premium-tone-slate self-end px-4 py-2 text-sm" onClick={() => { setSigma(-1); setOmega(2); setMode('conjugate_pair'); }}>
          复位
        </button>
      </div>

      <label className="premium-lesson-control block px-3 py-2 text-sm">
        <span className="premium-lesson-title font-medium">行为特征</span>
        <textarea value={observationText} onChange={(event) => setObservationText(event.target.value)} className="premium-lesson-input mt-2 min-h-[76px] w-full" />
      </label>
    </section>
  );
}

function ThreeShipsCaseComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const [selectedShip, setSelectedShip] = useState<'A' | 'B' | 'C' | 'all'>('all');
  const [timeScale, setTimeScale] = useState(1.5);
  const [interactionCount, setInteractionCount] = useState(0);
  const plotWidth = 360;
  const plotHeight = 190;
  const shipSeries = [
    { id: 'A', label: 'A：边摆边收', sigma: -1.5, omega: 2.2, stroke: 'hsl(var(--platform-action-primary))' },
    { id: 'B', label: 'B：单调收敛', sigma: -0.8, omega: 0, stroke: 'hsl(var(--platform-evidence-eligible))' },
    { id: 'C', label: 'C：摆动发散', sigma: 0.3, omega: 1.4, stroke: 'hsl(var(--platform-evidence-unsupported))' },
  ] as const;
  const visible = shipSeries.filter((ship) => selectedShip === 'all' || ship.id === selectedShip);
  const updateSelectedShip = (ship: 'A' | 'B' | 'C' | 'all') => {
    setSelectedShip(ship);
    setInteractionCount((value) => value + 1);
  };
  const updateTimeScale = (value: number) => {
    setTimeScale(value);
    setInteractionCount((current) => current + 1);
  };
  const submitSimulationRecord = () => {
    if (!onPanelSubmit) return;
    onPanelSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: {
        [module.id]: JSON.stringify({
          selected_ship: selectedShip,
          time_scale: timeScale.toFixed(1),
          simulation_interaction_count: interactionCount,
          compared_ships: selectedShip === 'all' ? ['A', 'B', 'C'] : [selectedShip],
        }),
      },
    });
  };

  return (
    <section className="premium-lesson-panel space-y-4" data-interactive-figure-panel="three_ships_case" data-module-id={module.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="premium-lesson-kicker">三艘船响应仿真</div>
          <h3 className="premium-lesson-title mt-1 text-lg font-semibold">同样指令下的三种极点行为</h3>
          <p className="premium-lesson-muted mt-1 text-sm leading-6">切换船型，观察“边摆边收、单调收敛、摆动发散”与极点位置的对应关系。</p>
        </div>
        <button
          type="button"
          onClick={submitSimulationRecord}
          disabled={!onPanelSubmit}
          className="premium-lesson-action-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {onPanelSubmit ? '记录比较' : '等待教师发放'}
        </button>
      </div>
      <div className="premium-lesson-surface-elevated p-3">
        <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[240px] w-full" role="img" aria-label="三艘船航向响应曲线">
          <line x1="0" y1={plotHeight * 0.55} x2={plotWidth} y2={plotHeight * 0.55} stroke="hsl(var(--platform-border))" strokeDasharray="4 4" />
          {visible.map((ship) => (
            <path
              key={ship.id}
              d={svgPath(responsePoints({
                sigma: ship.sigma,
                omega: ship.omega,
                mode: ship.omega === 0 ? 'single_real' : 'conjugate_pair',
                width: plotWidth,
                height: plotHeight,
                timeScale,
              }))}
              fill="none"
              stroke={ship.stroke}
              strokeWidth="3"
            />
          ))}
          {visible.map((ship, index) => (
            <g key={ship.id} transform={`translate(18, ${22 + index * 20})`}>
              <line x1="0" y1="0" x2="24" y2="0" stroke={ship.stroke} strokeWidth="3" />
              <text x="32" y="4" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">{ship.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-wrap gap-2">
          {(['all', 'A', 'B', 'C'] as const).map((ship) => (
            <button
              key={ship}
              type="button"
              onClick={() => updateSelectedShip(ship)}
              className={`premium-lesson-action-tone ${selectedShip === ship ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
            >
              {ship === 'all' ? '全部' : `船 ${ship}`}
            </button>
          ))}
        </div>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
          <span>时间轴缩放</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="1" max="5" step="0.5" value={timeScale} onChange={(event) => updateTimeScale(Number(event.target.value))} />
        </label>
      </div>
    </section>
  );
}

function InteractiveFigureComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const specKey = interactiveFigureSpecKey(step, module);
  if (isInteractiveFigureKind(specKey)) {
    return specKey === 'drag_pole_s_plane'
      ? <PoleResponseComputePanel step={step} module={module} onPanelSubmit={onPanelSubmit} />
      : <ThreeShipsCaseComputePanel step={step} module={module} onPanelSubmit={onPanelSubmit} />;
  }
  const content = summaryContent(step, module);
  return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
}

function SharedControlWorkbenchComputePanel({
  manifest,
  step,
  module,
  onPanelSubmit,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const capabilityRef = computeCapabilityRef(module.payload);
  const visiblePanelIds = stringArrayField(module.payload, ['visiblePanelIds', 'visible_panel_ids', 'panels']);
  const responseContractId = stringField(module.payload, ['responseContractId', 'response_contract_id', 'responseKind', 'response_kind']);
  const releaseState = stringField(module.payload, ['releaseState', 'release_state']) || 'course-controlled';
  const fallbackState = stringField(module.payload, ['fallbackState', 'fallback_state']) || 'supported';
  const request = controlAnalysisRequestFromPayload(module.payload);
  const fallbackResult = controlAnalysisResultFromPayload(module.payload);
  const layout = controlWorkbenchLayoutFromPayload(module.payload);
  const content = summaryContent(step, module);
  const bullets = [
    visiblePanelIds.length ? '课程已声明本页需要的分析视图。' : '分析视图由课程配置选择。',
    responseContractId ? '提交会保存当前参数、图形状态和判断。' : '提交方式由课程活动设置提供。',
    fallbackState === 'unsupported' ? '当前状态仅提供替代说明。' : '本次参数探索可用于课后复盘。',
    ...content.bullets,
  ];
  const submitCurrent = () => {
    if (!onPanelSubmit || !capabilityRef) return;
    const submittedAt = Date.now();
    const eventDraft = buildControlWorkbenchClientEvidenceDraft({
      eventType: 'lesson_submit',
      clientEventId: `${step.id}:${module.id}:${submittedAt}`,
      attemptKey: `${step.id}:response:${submittedAt}`,
      lessonKey: manifest.lessonId,
      stepId: step.id,
      moduleId: module.id,
      componentId: module.id,
      actorRole: 'student',
      clientEventAt: new Date(submittedAt).toISOString(),
      capabilityId: capabilityRef,
      visiblePanelIds,
      parameterSnapshot: parameterSnapshotFromRequest(request),
      selectedDesignState: { releaseState, fallbackState },
      answerPayload: { responseContractId: responseContractId ?? 'parameter.set' },
      releaseState: releaseState === 'released' || releaseState === 'revealed' ? releaseState : 'released',
      fallbackState: fallbackState === 'fallback' || fallbackState === 'unsupported' ? fallbackState : 'supported',
    });
    onPanelSubmit({
      stepId: step.id,
      submittedAt,
      answers: {
        [responseContractId ?? `${module.id}:control-workbench`]: JSON.stringify(eventDraft),
      },
    });
  };

  return (
    <section
      className="premium-lesson-panel space-y-4"
      data-control-workbench-capability={capabilityRef}
      data-control-workbench-module-id={module.id}
      data-control-workbench-release-state={releaseState}
      data-control-workbench-fallback-state={fallbackState}
    >
      <SummaryCard
        title={titleFromModule(module, step)}
        text={content.text || '本页使用控制分析工具观察参数变化、曲线响应和设计判断。'}
        bullets={bullets}
      />
      {request ? (
        <>
          <ControlFigureWorkspace
            request={request}
            fallbackResult={fallbackResult}
            layout={layout}
            allowedPanelIds={visiblePanelIds}
          />
          <button
            type="button"
            onClick={submitCurrent}
            disabled={!onPanelSubmit}
            className="premium-lesson-action-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {onPanelSubmit ? '提交当前观察' : '等待教师发放'}
          </button>
        </>
      ) : null}
    </section>
  );
}

function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function numericRows(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value.map(numericArray);
}

function pointRows(value: unknown): Array<[number, number, number]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => numericArray(item).slice(0, 3))
    .filter((item): item is [number, number, number] => item.length === 3);
}

function triangleRows(value: unknown): Array<[number, number, number]> | undefined {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return undefined;
  return value
    .map((item) => numericArray(item).slice(0, 3))
    .filter((item): item is [number, number, number] => item.length === 3);
}

function textFromRecord(value: unknown) {
  const record = asRecord(value);
  return [
    record.caption,
    record.explanation,
    record.note,
    record.conclusion,
    record.source ? `图源：${record.source}` : undefined,
  ]
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function imageNotesFromValue(value: unknown, imageIndex: number, imageCount: number): string[] {
  if (typeof value === 'string' && value.trim()) return [value];

  if (Array.isArray(value)) {
    const indexed = value[imageIndex];
    if (value.length === imageCount && indexed !== undefined) {
      if (typeof indexed === 'string') return indexed.trim() ? [indexed] : [];
      const indexedRecordItems = listFromRecordItems([indexed]);
      return indexedRecordItems.length ? indexedRecordItems : textFromRecord(indexed);
    }
    if (imageCount === 1) {
      const arrayItems = asStringArray(value).filter(Boolean);
      if (arrayItems.length) return arrayItems;
      return listFromRecordItems(value);
    }
  }

  return textFromRecord(value);
}

function imageNotes(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const { index, count } = imageModulePosition(step, module);
  const imageIndex = Math.max(0, index);
  const notes: string[] = [];
  const payloadNotes = imageNotesFromValue(
    module.payload.caption ?? module.payload.explanation ?? module.payload.note,
    imageIndex,
    count,
  );
  notes.push(...payloadNotes);

  const block = blockFor(step, module.payload) ?? blockByModuleId(step, module);
  notes.push(...imageNotesFromValue(block, imageIndex, count));

  const media = step.contentBlocks.media;
  if (Array.isArray(media)) {
    notes.push(...imageNotesFromValue(media[imageIndex], imageIndex, count));
  } else {
    notes.push(...textFromRecord(media));
  }

  for (const key of [
    'figure_explanations',
    'figure_explanation',
    'figure_reading',
    'figure_requirements',
    'parameter_explanation',
    'formula_explanation',
  ]) {
    notes.push(...imageNotesFromValue(step.contentBlocks[key], imageIndex, count));
  }

  const uniqueNotes: string[] = [];
  for (const note of notes) {
    if (note && !uniqueNotes.includes(note)) uniqueNotes.push(note);
  }
  return uniqueNotes;
}

function tableFor(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): NativeTableData | null {
  const payloadTable = tableFromBlock(module.payload);
  if (payloadTable) return payloadTable;
  const keyedTable = tableFromBlock(blockFor(step, module.payload));
  if (keyedTable) return keyedTable;
  const keyedFormulaTable = keyValueFormulaTableFromBlock(blockFor(step, module.payload));
  if (keyedFormulaTable) return keyedFormulaTable;

  const tables = Object.values(step.contentBlocks)
    .map(tableFromBlock)
    .filter((table): table is NativeTableData => Boolean(table));
  const tableModuleIndex = step.modules
    .filter((item) => item.kind === 'native-table' || item.kind === 'native-formula-table' || item.kind === 'table-card')
    .findIndex((item) => item.id === module.id);
  return tables[tableModuleIndex] ?? firstBlockWithTable(step);
}

function revealItemFromValue(value: unknown): RevealItem | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { body: String(value) };
  }
  const record = asRecord(value);
  const body = record.body ?? record.text ?? record.content ?? record.prompt ?? record.explanation ?? record.note ?? record.value;
  const formula = record.formula ?? record.latex ?? record.math;
  const title = record.title ?? record.label ?? record.name;
  if (typeof body !== 'string' && typeof formula !== 'string') return null;
  return {
    body: typeof body === 'string' ? body : '',
    formula: typeof formula === 'string' ? formula : undefined,
    title: typeof title === 'string' ? title : undefined,
  };
}

function revealItemsFromValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(revealItemFromValue)
    .filter((item): item is RevealItem => Boolean(item));
}

function revealItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): RevealItem[] {
  const payload = module.payload;
  const directItems = revealItemsFromValue(payload.items);
  if (directItems.length) return directItems;
  const rawBlock = blockFor(step, payload) ?? blockByModuleId(step, module);
  const rawBlockItems = revealItemsFromValue(rawBlock);
  if (rawBlockItems.length) return rawBlockItems;
  const block = asRecord(rawBlock);
  const items = revealItemsFromValue(block.items ?? block.steps ?? block.layers ?? block.bullets);
  if (items.length) return items;
  const revealLayers = step.contentBlocks.reveal_layers ?? step.contentBlocks.reveal_steps;
  const layerItems = revealItemsFromValue(revealLayers);
  if (layerItems.length) return layerItems;
  return listFromRecordItems(revealLayers).map((body) => ({ body }));
}

function summaryContent(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const rawBlock = blockFor(step, payload) ?? blockByModuleId(step, module);
  const block = asRecord(rawBlock);
  const field = typeof payload.field === 'string' ? payload.field : 'text';
  const bulletsKey = typeof payload.bullets_key === 'string'
    ? payload.bullets_key
    : typeof payload.bulletsKey === 'string'
      ? payload.bulletsKey
      : 'bullets';
  const text = typeof payload.text === 'string'
    ? payload.text
    : typeof rawBlock === 'string'
      ? rawBlock
    : typeof block[field] === 'string'
      ? String(block[field])
      : typeof block.text === 'string'
        ? block.text
        : typeof block.body === 'string'
          ? block.body
          : typeof block.lead === 'string'
            ? block.lead
            : undefined;
  const recordItems = listFromRecordItems(rawBlock);
  const sectionItems = listFromRecordItems(block.sections);
  const rawArrayItems = Array.isArray(rawBlock) ? asStringArray([...rawBlock]) : [];
  const bullets = asStringArray(payload.bullets).length
    ? asStringArray(payload.bullets)
    : recordItems.length
      ? recordItems
    : sectionItems.length
      ? sectionItems
    : rawArrayItems.length
      ? rawArrayItems
    : asStringArray(
      block[bulletsKey]
        ?? block.items
        ?? block.bullets
        ?? step.contentBlocks.takeaways
        ?? step.contentBlocks.goal_cards
        ?? step.contentBlocks.target_constraints,
    );
  return { text, bullets };
}

function listFromRecordItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);
      const title = typeof record.title === 'string' ? record.title : '';
      const name = typeof record.name === 'string' ? record.name : '';
      const label = typeof record.label === 'string' ? record.label : '';
      const domain = typeof record.domain === 'string' ? record.domain : '';
      const caption = typeof record.caption === 'string' ? record.caption : '';
      const heading = title || name || label || domain || caption;
      const explanation = typeof record.explanation === 'string' ? record.explanation : '';
      const note = typeof record.note === 'string' ? record.note : '';
      const body = typeof record.body === 'string' ? record.body : '';
      const prompt = typeof record.prompt === 'string' ? record.prompt : '';
      const value = typeof record.value === 'string' ? record.value : '';
      const detail = explanation || note || body || prompt || value;
      return [heading, detail].filter(Boolean).join('：');
    })
    .filter(Boolean);
}

function stringFromKnownBlocks(step: InteractiveRuntimeStepManifest, keys: string[]) {
  for (const key of keys) {
    const block = asRecord(blockByKey(step, key));
    const value = block.text ?? block.lead ?? block.note ?? block.task ?? block.explanation ?? block.body;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function listFromKnownBlocks(step: InteractiveRuntimeStepManifest, keys: string[]) {
  for (const key of keys) {
    const value = blockByKey(step, key);
    const items = asStringArray(value);
    if (items.length) return items;
    const block = asRecord(value);
    const fields = asStringArray(block.fields ?? block.items ?? block.goals ?? block.requirements);
    if (fields.length) return fields;
  }
  return [];
}

function cardGridItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payloadItems = asStringArray(module.payload.items);
  if (payloadItems.length) return payloadItems;
  const rawBlock = blockFor(step, module.payload) ?? blockByModuleId(step, module);
  const block = asRecord(rawBlock);
  const fromItems = asStringArray(block.items);
  if (fromItems.length) return fromItems;
  const recordItems = listFromRecordItems(rawBlock);
  if (recordItems.length) return recordItems;
  const content = summaryContent(step, module);
  return [content.text, ...content.bullets].filter((item): item is string => Boolean(item));
}

function learningStatItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
  const studentFields = asStringArray(block.student_fields ?? block.studentFields);
  const teacherFields = asStringArray(block.teacher_fields ?? block.teacherFields);
  const studentItems = asStringArray(block.student);
  const teacherItems = asStringArray(block.teacher);
  const genericFields = asStringArray(block.fields);
  const items: string[] = [];
  if (studentFields.length) items.push(`学生端：${studentFields.join('、')}`);
  if (teacherFields.length) items.push(`教师端：${teacherFields.join('、')}`);
  if (studentItems.length) items.push(`学生端：${studentItems.join('、')}`);
  if (teacherItems.length) items.push(`教师端：${teacherItems.join('、')}`);
  if (!items.length) items.push(...genericFields);
  return items;
}

function FormulaSymbolList({ symbols }: { symbols: FormulaSymbol[] }) {
  if (!symbols.length) return null;
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 text-sm leading-7">
      <div className="premium-lesson-title font-semibold">符号说明</div>
      <dl className="mt-2 grid gap-2 md:grid-cols-2">
        {symbols.map((item) => (
          <div key={`${item.symbol}-${item.meaning}`} className="flex gap-2">
            <dt className="shrink-0">
              <InlineMath math={normalizeMath(item.symbol)} />
            </dt>
            {item.meaning ? <dd className="premium-lesson-muted">{renderInlineContent(item.meaning)}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function FormulaCard({
  title,
  formulas,
  notes,
  symbols = [],
}: {
  title: string;
  formulas: string[];
  notes?: string[];
  symbols?: FormulaSymbol[];
}) {
  if (!formulas.length) return null;
  const noteBlock = notes?.length ? (
    <div className="premium-lesson-muted mt-2 space-y-2 text-sm leading-7">
      {notes.map((note) => (
        <p key={note}>{renderInlineContent(note)}</p>
      ))}
    </div>
  ) : null;
  const formulaBlock = (
    <div className="mt-3 space-y-2 overflow-x-auto">
      {formulas.map((formula) => (
        <Fragment key={formula}>{renderFormulaContent(formula)}</Fragment>
      ))}
    </div>
  );
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {symbols.length ? formulaBlock : noteBlock}
      {symbols.length ? <FormulaSymbolList symbols={symbols} /> : null}
      {symbols.length ? noteBlock : formulaBlock}
    </div>
  );
}

function VisualStagePanel({
  module,
}: {
  module: InteractiveRuntimeModuleManifest;
}) {
  const stage = visualStagePayload(module);
  const visibleLayers = stage.layers.filter((layer) => (
    stage.releaseState !== 'unavailable'
    && stage.releaseState !== 'unreleased'
    && (!layer.revealState || layer.revealState === stage.activeRevealState || stage.activeRevealState === 'all')
  ));
  const aspectClass = stage.aspectRatio === '4:3'
    ? 'min-h-[420px] md:aspect-[4/3] md:min-h-0'
    : stage.aspectRatio === 'fluid'
      ? 'min-h-[420px]'
      : 'min-h-[420px] md:aspect-video md:min-h-0';

  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-visual-stage-id={stage.stageId}
      data-visual-stage-release-state={stage.releaseState}
      data-visual-stage-active-reveal-state={stage.activeRevealState}
      data-visual-stage-layer-count={stage.layers.length}
      data-visual-stage-visible-layer-ids={visibleLayers.map((layer) => layer.id).join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="premium-lesson-muted text-sm leading-6">
            {visualStageReleaseLabel(stage.releaseState)}
          </p>
        </div>
        <span className="premium-lesson-badge" data-visual-stage-layer-summary>
          {visibleLayers.length}/{stage.layers.length}
        </span>
      </div>
      <div
        className={[
          'relative w-full overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)]',
          'shadow-[var(--platform-shadow-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
          aspectClass,
        ].join(' ')}
        tabIndex={0}
        role="group"
        aria-label={`${stage.stageId} 视觉舞台`}
        data-visual-stage-canvas="normalized"
        data-visual-stage-layout="freeform"
      >
        {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <p className="premium-lesson-body text-sm">{visualStageReleaseLabel(stage.releaseState)}</p>
          </div>
        ) : null}
        {visibleLayers.map((layer) => (
          <article
            key={layer.id}
            className={[
              'absolute overflow-hidden rounded-xl border border-[var(--platform-border)]',
              'bg-[var(--platform-panel)]/95 p-3 shadow-[var(--platform-shadow-xs)]',
              layer.kind === 'formula' ? 'premium-lesson-formula-surface' : '',
            ].join(' ')}
            style={{
              left: `${layer.region.x * 100}%`,
              top: `${layer.region.y * 100}%`,
              width: `${layer.region.width * 100}%`,
              height: `${layer.region.height * 100}%`,
              zIndex: layer.zIndex,
            }}
            data-visual-stage-layer-id={layer.id}
            data-visual-stage-layer-kind={layer.kind}
            data-visual-stage-layer-reveal-state={layer.revealState ?? 'always'}
            data-visual-stage-activity-anchor={layer.activityAnchor ?? undefined}
          >
            <div className="premium-lesson-caption">{visualStageLayerKindLabel(layer.kind)}</div>
            <h3 className="premium-lesson-title text-sm">{layer.title}</h3>
            <p className="premium-lesson-body mt-2 text-sm leading-6">{renderInlineContent(layer.body)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DerivationStagePanel({
  module,
}: {
  module: InteractiveRuntimeModuleManifest;
}) {
  const stage = derivationStagePayload(module);
  const visibleTargetIds = derivationStageVisibleTargetIds(stage);
  const visibleRevealStepIds = derivationVisibleRevealStepIds(stage);
  const targetRegions = derivationTargetRegionMap(stage);
  const visibleFormulas = stage.formulas.filter((formula) => (
    visibleTargetIds.has(formula.id) || formula.blocks.some((block) => visibleTargetIds.has(block.id))
  ));
  const visibleTextBlocks = stage.textBlocks.filter((block) => visibleTargetIds.has(block.id));
  const visibleConnectors = stage.connectors.filter((connector) => (
    visibleTargetIds.has(connector.from) && visibleTargetIds.has(connector.to)
    && connector.revealStepIds.some((stepId) => visibleRevealStepIds.has(stepId))
  ));
  const aspectClass = stage.aspectRatio === '4:3'
    ? 'min-h-[520px] md:aspect-[4/3] md:min-h-0'
    : stage.aspectRatio === 'fluid'
      ? 'min-h-[520px]'
      : 'min-h-[520px] md:aspect-video md:min-h-0';

  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-derivation-stage-id={stage.stageId}
      data-derivation-stage-release-state={stage.releaseState}
      data-derivation-stage-active-reveal-step={stage.activeRevealStepId}
      data-derivation-stage-visible-target-ids={[...visibleTargetIds].join(' ')}
      data-derivation-stage-answer-visible={stage.answerVisible ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="premium-lesson-muted text-sm leading-6">
            {derivationStageReleaseLabel(stage.releaseState)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stage.teacherControls.map((control) => (
            <span key={control} className="premium-lesson-badge" data-derivation-stage-teacher-control={control}>
              {derivationTeacherControlLabel(control)}
            </span>
          ))}
        </div>
      </div>
      <div
        className={[
          'relative w-full overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)]',
          'shadow-[var(--platform-shadow-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
          aspectClass,
        ].join(' ')}
        tabIndex={0}
        role="group"
        aria-label={`${stage.stageId} 推导舞台`}
        data-derivation-stage-canvas="normalized"
        data-derivation-stage-layout="freeform"
        data-katex-rendered="true"
      >
        {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <p className="premium-lesson-body text-sm">{derivationStageReleaseLabel(stage.releaseState)}</p>
          </div>
        ) : null}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-derivation-stage-connectors="visible"
        >
          {visibleConnectors.map((connector) => {
            const from = derivationConnectorEndpoint(targetRegions.get(connector.from), { x: 12, y: 18 });
            const to = derivationConnectorEndpoint(targetRegions.get(connector.to), { x: 88, y: 72 });
            return (
              <line
                key={connector.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="hsl(var(--platform-accent))"
                strokeWidth="0.4"
                strokeDasharray={connector.kind === 'reference' || connector.kind === 'dependency' ? '2 2' : undefined}
                data-derivation-stage-connector-id={connector.id}
                data-derivation-stage-connector-kind={connector.kind}
                data-derivation-stage-connector-from={connector.from}
                data-derivation-stage-connector-to={connector.to}
              />
            );
          })}
        </svg>
        {visibleFormulas.map((formula) => {
          const visibleBlocks = formula.blocks.filter((block) => visibleTargetIds.has(block.id));
          const renderFullFormula = visibleTargetIds.has(formula.id) || visibleBlocks.length === 0;
          return (
            <article
              key={formula.id}
              className="absolute overflow-auto rounded-xl border border-[var(--platform-border)] bg-[var(--platform-panel)]/95 p-3 shadow-[var(--platform-shadow-xs)]"
              style={{
                left: `${formula.region.x * 100}%`,
                top: `${formula.region.y * 100}%`,
                width: `${formula.region.width * 100}%`,
                height: `${formula.region.height * 100}%`,
              }}
              data-derivation-stage-formula-id={formula.id}
            >
              <div className="premium-lesson-caption">LaTeX 公式</div>
              <h3 className="premium-lesson-title text-sm">{formula.title}</h3>
              {renderFullFormula ? (
                <div className="mt-2 overflow-x-auto" data-derivation-stage-formula-latex-source={formula.latex}>
                  <BlockMath math={normalizeMath(formula.latex)} />
                </div>
              ) : null}
              <div className="mt-2 grid gap-2">
                {visibleBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={[
                      'rounded-lg border px-2 py-1',
                      derivationColorRoleClass(block.colorRole),
                    ].join(' ')}
                    data-derivation-stage-formula-block-id={block.id}
                    data-derivation-stage-color-role={block.colorRole ?? 'none'}
                    data-derivation-stage-block-latex-source={block.latex}
                  >
                    <div className="premium-lesson-caption">{block.title}</div>
                    <BlockMath math={normalizeMath(block.latex)} />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {visibleTextBlocks.map((block) => (
          <article
            key={block.id}
            className="absolute overflow-auto rounded-xl border border-[var(--platform-border)] bg-[var(--platform-panel)]/95 p-3 shadow-[var(--platform-shadow-xs)]"
            style={{
              left: `${block.region.x * 100}%`,
              top: `${block.region.y * 100}%`,
              width: `${block.region.width * 100}%`,
              height: `${block.region.height * 100}%`,
            }}
            data-derivation-stage-text-block-id={block.id}
          >
            <div className="premium-lesson-caption">推导说明</div>
            <h3 className="premium-lesson-title text-sm">{block.title}</h3>
            <p className="premium-lesson-body mt-2 text-sm leading-6">{renderInlineContent(block.body)}</p>
          </article>
        ))}
      </div>
      {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? null : (
        <div className="grid gap-2 md:grid-cols-3" data-derivation-stage-reveal-steps="visible">
          {stage.revealSteps.map((step) => (
            <div
              key={step.id}
              className="premium-lesson-card"
              data-derivation-stage-reveal-step-id={step.id}
              data-derivation-stage-reveal-step-active={step.id === stage.activeRevealStepId ? 'true' : 'false'}
            >
              <p className="premium-lesson-caption">{step.id}</p>
              <p className="premium-lesson-title text-sm">{step.title}</p>
              <p className="premium-lesson-muted mt-1 text-xs leading-5">{step.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ManifestCodeBlock({
  title,
  code,
  language = 'matlab',
  note,
}: {
  title: string;
  code: string;
  language?: string;
  note?: string;
}) {
  if (!code.trim()) return null;
  const normalizedLanguage = language.toLowerCase();
  const languageLabel = normalizedLanguage === 'matlab' ? 'MATLAB / Octave' : normalizedLanguage.toUpperCase();

  return (
    <div className="premium-lesson-panel" data-module-kind="content.code">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ManifestContentTitle>{title}</ManifestContentTitle>
        <span className="premium-lesson-chip">{languageLabel}</span>
      </div>
      <pre className="premium-code-block mt-3" data-code-language={normalizedLanguage}>
        <code>{renderHighlightedCode(code, normalizedLanguage)}</code>
      </pre>
      {note ? <p className="premium-lesson-muted mt-3 text-sm leading-7">{renderInlineContent(note)}</p> : null}
    </div>
  );
}

function SummaryCard({ title, text, bullets }: { title: string; text?: string; bullets?: string[] }) {
  if (!text && !bullets?.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {text ? <p className="premium-lesson-title mt-2 text-sm leading-7">{renderInlineContent(text)}</p> : null}
      {bullets?.length ? (
        <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-7">
          {bullets.map((bullet) => (
            <li key={bullet} className="ml-5 list-disc">{renderInlineContent(bullet)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CardGrid({ title, items, columns = 'md:grid-cols-2' }: { title: string; items: string[]; columns?: string }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className={`mt-3 grid gap-3 ${columns}`}>
        {items.map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm leading-7">
            {renderInlineContent(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseObjectiveList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>完成本次课程后，学习者能够</ManifestContentTitle>
      <ol className="premium-lesson-muted mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3">
            <span className="premium-lesson-caption shrink-0 font-semibold">{index + 1}.</span>
            <span>{renderInlineContent(item)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type PathStageMapItem = {
  key: string;
  label: string;
  status?: string;
};

function stageMapItemsFrom(value: unknown): PathStageMapItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): PathStageMapItem | null => {
      if (typeof item === 'string' && item.trim()) {
        return { key: item, label: item };
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const label = typeof record.title === 'string'
          ? record.title
          : typeof record.label === 'string'
            ? record.label
            : '';
        if (!label.trim()) return null;
        const key = typeof record.id === 'string' && record.id.trim()
          ? record.id
          : `${label}-${index}`;
        return {
          key,
          label,
          ...(typeof record.status === 'string' ? { status: record.status } : {}),
        };
      }
      return null;
    })
    .filter((item): item is PathStageMapItem => Boolean(item));
}

function PathStageMap({ title, lead, items }: { title: string; lead?: string; items: PathStageMapItem[] }) {
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {items.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {items.map((item, index) => (
            <Fragment key={item.key}>
              <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-center text-sm font-semibold">
                {renderInlineContent(item.label)}
                {item.status === 'current' ? (
                  <div className="premium-lesson-caption mt-2">当前</div>
                ) : null}
              </div>
              {index < items.length - 1 ? <div className="hidden items-center text-slate-500 md:flex">→</div> : null}
            </Fragment>
          ))}
        </div>
      ) : null}
      {lead ? <p className="premium-lesson-muted mt-3 text-sm leading-7">{renderInlineContent(lead)}</p> : null}
    </div>
  );
}

function ProblemStatement({ title, block }: { title: string; block: ContentRecord }) {
  const formulas = [block.object, block.controller, block.controller_form]
    .filter(Boolean)
    .map((item) => String(item));
  const notes = [block.text, block.body, block.prompt, block.note, block.task, block.given_condition, block.explanation]
    .filter(Boolean)
    .map((item) => String(item));
  const goals = asStringArray(block.goals ?? block.requirements);

  if (!formulas.length && !notes.length && !goals.length) return null;

  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {formulas.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {formulas.map((formula) => (
            <div key={formula} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <BlockMath math={normalizeMath(formula)} />
            </div>
          ))}
        </div>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="premium-lesson-muted mt-3 text-sm leading-7">{renderInlineContent(note)}</p>
      ))}
      {goals.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {goals.map((goal) => (
            <div key={goal} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm leading-7">
              {renderInlineContent(goal)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NativeTable({
  title,
  columns,
  rows,
  notes,
}: {
  title: string;
  columns: string[];
  rows: TableCell[][];
  notes?: string[];
}) {
  return (
    <div className="premium-lesson-panel overflow-hidden">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {notes?.length ? (
        <div className="premium-lesson-muted mt-2 space-y-2 text-sm leading-7">
          {notes.map((note) => (
            <p key={note}>{renderInlineContent(note)}</p>
          ))}
        </div>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-700">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold">{renderInlineContent(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-b border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${row[0]}-${cellIndex}`} className="px-3 py-3 align-top leading-7">
                    {renderTableCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ImageDisplayMode = 'default' | 'medium' | 'compact';

function imageDisplayMode(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): ImageDisplayMode {
  const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
  const value = stringField(module.payload, ['display_width', 'displayWidth', 'image_size', 'imageSize'])
    || stringField(block, ['display_width', 'displayWidth', 'image_size', 'imageSize']);
  if (value === 'compact' || value === 'small' || value === 'narrow') return 'compact';
  if (value === 'medium') return 'medium';
  return 'default';
}

function imageClassFor(mode: ImageDisplayMode) {
  if (mode === 'compact') return 'mx-auto h-auto w-full max-w-[680px]';
  if (mode === 'medium') return 'mx-auto h-auto w-full max-w-[900px]';
  return 'h-auto w-full';
}

function figureKind(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
  return stringField(module.payload, ['figure_kind', 'figureKind'])
    || stringField(block, ['figure_kind', 'figureKind']);
}

function ModelingPathsComparisonFigure({ title }: { title: string }) {
  const nodeClass = 'rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm';
  const arrowClass = 'text-slate-400';
  return (
    <div className="premium-lesson-panel" data-local-modeling-paths-figure="true">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="premium-lesson-kicker">机理建模路径</div>
            <div className={nodeClass}>真实对象</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>物理定律</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>微分方程</div>
            <div className={arrowClass}>↓</div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center text-cyan-950 shadow-sm">传递函数</div>
            <p className="premium-lesson-muted text-sm leading-6">优势：结构清楚、物理含义明确；边界：对象过复杂时建方程成本高。</p>
          </div>
          <div className="space-y-3">
            <div className="premium-lesson-kicker">数据驱动路径</div>
            <div className={nodeClass}>真实对象</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>采集输入输出数据</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>算法学习映射</div>
            <div className={arrowClass}>↓</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-emerald-950 shadow-sm">预测模型</div>
            <p className="premium-lesson-muted text-sm leading-6">优势：先验要求低；边界：解释性弱，训练范围外可靠性下降。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePanel({ title, src, notes, displayMode = 'default' }: { title: string; src: string; notes: string[]; displayMode?: ImageDisplayMode }) {
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={src} alt={title} width={1600} height={960} className={imageClassFor(displayMode)} unoptimized />
      </div>
      {notes.length ? (
        <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-7">
          {notes.map((note) => (
            <li key={note} className="ml-5 list-disc">{renderInlineContent(note)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ImageGallery({ title, items }: { title: string; items: Array<{ src: string; caption: string }> }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.src} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Image src={item.src} alt={item.caption || title} width={1600} height={960} className="h-auto w-full" unoptimized />
            {item.caption ? (
              <p className="premium-lesson-muted border-t border-slate-100 px-3 py-2 text-sm leading-6">
                {renderInlineContent(item.caption)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReveal({
  title,
  items,
  revealProgress,
  allowInlineReveal,
  onInlineReveal,
}: {
  title: string;
  items: RevealItem[];
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
}) {
  const teacherVisibleCount = Math.min(items.length, Math.max(1, revealProgress + 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  const visibleCount = onInlineReveal
    ? teacherVisibleCount
    : Math.min(items.length, Math.max(teacherVisibleCount, localVisibleCount));

  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 space-y-3" data-progressive-reveal="step_click_reveal">
        {items.slice(0, visibleCount).map((item, index) => {
          const canExpand = allowInlineReveal && index === visibleCount - 1 && visibleCount < items.length;
          const showNext = () => {
            if (!canExpand) return;
            if (onInlineReveal) {
              onInlineReveal?.();
              return;
            }
            setLocalVisibleCount((prev) => Math.min(items.length, prev + 1));
          };
          const key = `${item.title ?? ''}:${item.body}:${item.formula ?? ''}`;
          const cardClassName = `block w-full rounded-2xl border px-4 py-3 text-left ${
            canExpand ? 'cursor-pointer border-cyan-200 bg-cyan-50 hover:border-cyan-300' : 'border-slate-200 bg-slate-50'
          }`;
          const cardContent = (
            <>
              {item.title ? <ManifestContentTitle>{item.title}</ManifestContentTitle> : null}
              {item.body ? (
                <p className="premium-lesson-title text-sm leading-7">{renderInlineContent(item.body)}</p>
              ) : null}
              {item.formula ? <div className="mt-2 overflow-x-auto">{renderFormulaContent(item.formula)}</div> : null}
              {canExpand ? <p className="premium-lesson-muted mt-2 text-xs">点击当前最下方步骤继续显示下一层。</p> : null}
            </>
          );
          if (canExpand) {
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={showNext}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  showNext();
                }}
                className={cardClassName}
              >
                {cardContent}
              </div>
            );
          }
          return (
            <div key={key} className={cardClassName}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function stepRevealIdentityKey(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
  revealProgress: number,
) {
  return `${step.id}:${module.id}:${revealProgress}`;
}

export function createManifestContentModuleRegistry(extra: {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}): InteractiveModuleRegistry<typeof extra> {
  return {
    'content.rich': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module, step)} text={content.text} bullets={content.bullets} />;
    },
    'content.cardSet': ({ step, module }) => {
      const items = cardGridItems(step, module);
      if (items.length) return <CardGrid title={titleFromModule(module, step)} items={items} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module, step)} text={content.text} bullets={content.bullets} />;
    },
    'content.formula': ({ step, module }) => (
      <FormulaCard
        title={titleFromModule(module, step)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'content.code': ({ step, module }) => {
      const content = codePayload(step, module);
      return (
        <ManifestCodeBlock
          title={titleFromModule(module, step)}
          code={content.code}
          language={content.language}
          note={content.note}
        />
      );
    },
    'content.table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (table) return <NativeTable title={titleFromModule(module, step)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module, step)} text={content.text} bullets={content.bullets} />;
    },
    'content.figure': ({ manifest, step, module }) => {
      if (figureKind(step, module) === 'modeling_paths_comparison') {
        return <ModelingPathsComparisonFigure title={titleFromModule(module, step)} />;
      }
      const galleryItems = imageItemsFromPayload(manifest, module.payload);
      const displayMode = imageDisplayMode(step, module);
      if (galleryItems.length > 1) return <ImageGallery title={titleFromModule(module, step)} items={galleryItems} />;
      if (galleryItems.length === 1) {
        const [item] = galleryItems;
        const notes = [item.caption, ...imageNotes(step, module)].filter((value) => value.trim());
        return <ImagePanel title={titleFromModule(module, step)} src={item.src} notes={notes} displayMode={displayMode} />;
      }
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module, step)} src={src} notes={imageNotes(step, module)} displayMode={displayMode} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module, step)} text={content.text} bullets={content.bullets} />;
    },
    'content.reveal': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (items.length) {
        return (
          <StepReveal
            key={stepRevealIdentityKey(step, module, renderExtra.revealProgress)}
            title={titleFromModule(module, step)}
            items={items}
            revealProgress={renderExtra.revealProgress}
            allowInlineReveal={renderExtra.allowInlineReveal}
            onInlineReveal={renderExtra.onInlineReveal}
          />
        );
      }
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.stageMap': ({ step, module }) => {
      const intro = asRecord(step.contentBlocks.page_intro);
      const title = typeof intro.title === 'string' ? intro.title : titleFromModule(module);
      const lead = typeof intro.lead === 'string' ? intro.lead : summaryContent(step, module).text;
      const payloadItems = stageMapItemsFrom(
        module.payload.items ?? module.payload.stages ?? module.payload.path_items ?? module.payload.pathItems,
      );
      const items = payloadItems.length ? payloadItems : stageMapItemsFrom(intro.path_items ?? step.contentBlocks.path_items);
      if (items.length) return <PathStageMap title={title} lead={lead} items={items} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={title} text={content.text} bullets={content.bullets} />;
    },
    'visual.stage': ({ module }) => <VisualStagePanel module={module} />,
    'visual.derivationStage': ({ module }) => <DerivationStagePanel module={module} />,
    'compute.panel': ({ manifest, step, module }) => {
      if (computeCapabilityRef(module.payload) === 'static-surface-3d') {
        return <StaticSurface3DPanel {...staticSurfacePanelProps(manifest, step, module)} />;
      }
      if (isControlWorkbenchComputeCapabilityRef(computeCapabilityRef(module.payload))) {
        return <SharedControlWorkbenchComputePanel manifest={manifest} step={step} module={module} onPanelSubmit={extra.onPanelSubmit} />;
      }
      if (computeCapabilityRef(module.payload) === 'interactive-figure') {
        return <InteractiveFigureComputePanel step={step} module={module} onPanelSubmit={extra.onPanelSubmit} />;
      }
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'analytics.summary': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'layout.support': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'stage-map': ({ step }) => {
      const intro = asRecord(step.contentBlocks.page_intro);
      const title = typeof intro.title === 'string' ? intro.title : '路径定位';
      const lead = typeof intro.lead === 'string' ? intro.lead : undefined;
      const items = stageMapItemsFrom(intro.path_items ?? step.contentBlocks.path_items);
      return <PathStageMap title={title} lead={lead} items={items} />;
    },
    'goal-card-row': ({ step, module }) => {
      const payloadItems = asStringArray(module.payload.items ?? module.payload.goals ?? module.payload.requirements);
      const rawBlock = blockFor(step, module.payload);
      const block = asRecord(rawBlock);
      const arrayBlockItems = Array.isArray(rawBlock) ? asStringArray([...rawBlock]) : [];
      const blockItems = arrayBlockItems.length ? arrayBlockItems : asStringArray(block.items ?? block.goals ?? block.requirements);
      const items = payloadItems.length ? payloadItems : blockItems.length ? blockItems : listFromKnownBlocks(step, ['goal_cards']);
      return <CourseObjectiveList items={items} />;
    },
    'goal-card-set': ({ step }) => {
      const items = listFromKnownBlocks(step, ['target_constraints', 'goal_cards']);
      return <CardGrid title="目标约束" items={items} columns="md:grid-cols-3" />;
    },
    'question-card-set': ({ step }) => {
      const items = listFromKnownBlocks(step, ['question_cards']);
      return <CardGrid title="问题组" items={items} />;
    },
    'formula-card': ({ step, module }) => (
      <FormulaCard
        title={titleFromModule(module)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'formula-card-row': ({ step, module }) => (
      <FormulaCard
        title={titleFromModule(module)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'formula-chain': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'summary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'summary-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-2" />;
    },
    'summary-card-grid': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={cardGridItems(step, module)} columns="md:grid-cols-2" />
    ),
    'question-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'question-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'boundary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'process-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'objective-list': ({ step, module }) => {
      const content = summaryContent(step, module);
      const items = content.bullets.length
        ? content.bullets
        : [content.text].filter((item): item is string => Boolean(item));
      return <CourseObjectiveList items={items} />;
    },
    'bullet-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reason-record': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'notice-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'comparison-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (table) return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'structured-compare': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'row-focus-toggle': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'tab-selector': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'overlay-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'graphic': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'interactive-figure': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'interactive-figure-panel': ({ manifest, step, module }) => {
      const galleryItems = imageItemsFromPayload(manifest, module.payload);
      if (galleryItems.length > 1) return <ImageGallery title={titleFromModule(module)} items={galleryItems} />;
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'rule-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'card-bank': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'evidence-bank': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="grid-cols-1" />;
    },
    'example-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'worked-example-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'condition-list': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reference-answer-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'comparison-graphic': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'band-focus-panel': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'ai-compare-workspace': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'revision-note': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'case-context-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'metric-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-4" />;
    },
    'teacher-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'next-step-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reflection-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'key-task-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'next-step-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-3" />;
    },
    'bullet-list-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'equation-card-row': ({ step, module }) => {
      const block = blockFor(step, module.payload) ?? blockByModuleId(step, module) ?? step.contentBlocks.target_cards;
      const items = listFromRecordItems(block);
      return <CardGrid title={titleFromModule(module)} items={items} columns="md:grid-cols-4" />;
    },
    'native-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'native-formula-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'table-card': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'template-card': ({ step, module }) => {
      const block = blockFor(step, module.payload) ?? blockByModuleId(step, module);
      const source = valueAtField(block, module.payload.field);
      const items = asStringArray(module.payload.items).length
        ? asStringArray(module.payload.items)
        : asStringArray(source).length
          ? asStringArray(source)
          : listFromRecordItems(source);
      return <CardGrid title={titleFromModule(module)} items={items} columns="grid-cols-1" />;
    },
    'image-panel': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
    },
    'figure': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
    },
    'media-card': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'native-figure': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const caption = typeof block.caption === 'string' ? block.caption : titleFromModule(module);
      const conclusion = typeof block.conclusion === 'string' ? block.conclusion : undefined;
      const source = typeof block.source === 'string' ? `图源：${block.source}` : undefined;
      return <SummaryCard title={caption} text={conclusion ?? source} bullets={conclusion && source ? [source] : []} />;
    },
    'figure-note': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'rust-analysis-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'rust-time-compare-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'rust-bode-compare-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'stat-panel': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const fields = asStringArray(block.fields);
      const bullets = asStringArray(block.bullets);
      const note = typeof block.note === 'string' ? block.note : undefined;
      return <SummaryCard title={titleFromModule(module)} text={note} bullets={[...fields, ...bullets]} />;
    },
    'learning-stat-panel': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'performance-summary': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'problem-statement': ({ step, module }) => {
      const rawBlock = blockFor(step, module.payload)
        ?? blockByKey(step, 'problem_statement')
          ?? blockByKey(step, 'fixed_problem')
          ?? blockByKey(step, 'formula_block')
          ?? module.payload;
      const block = typeof rawBlock === 'string' ? { text: rawBlock } : asRecord(rawBlock);
      return <ProblemStatement title={titleFromModule(module)} block={block} />;
    },
    'title-card': ({ step, module }) => {
      const text = stringFromKnownBlocks(step, ['post_quiz_title', 'page_intro']);
      return text ? <SummaryCard title={titleFromModule(module)} text={text} /> : null;
    },
    'quiz-stack': ({ step, module }) => {
      const items = listFromKnownBlocks(step, ['post_quiz_items']);
      return <CardGrid title={titleFromModule(module)} items={items} columns="grid-cols-1" />;
    },
    'route-card': ({ step, module }) => {
      const text = stringFromKnownBlocks(step, ['next_route']);
      return text ? <SummaryCard title={titleFromModule(module)} text={text} /> : null;
    },
    'step-reveal': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (!items.length) return null;
      return (
        <StepReveal
          key={stepRevealIdentityKey(step, module, renderExtra.revealProgress)}
          title={titleFromModule(module)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
          onInlineReveal={renderExtra.onInlineReveal}
        />
      );
    },
    'reveal-chain': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (!items.length) return null;
      return (
        <StepReveal
          key={stepRevealIdentityKey(step, module, renderExtra.revealProgress)}
          title={titleFromModule(module)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
          onInlineReveal={renderExtra.onInlineReveal}
        />
      );
    },
    'step-reveal-chain': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (!items.length) return null;
      return (
        <StepReveal
          key={stepRevealIdentityKey(step, module, renderExtra.revealProgress)}
          title={titleFromModule(module)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
          onInlineReveal={renderExtra.onInlineReveal}
        />
      );
    },
    'step-reveal-column': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (items.length) {
        return (
          <StepReveal
            key={stepRevealIdentityKey(step, module, renderExtra.revealProgress)}
            title={titleFromModule(module)}
            items={items}
            revealProgress={renderExtra.revealProgress}
            allowInlineReveal={renderExtra.allowInlineReveal}
            onInlineReveal={renderExtra.onInlineReveal}
          />
        );
      }
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
  };
}

function computeCapabilityRef(payload: ContentRecord) {
  return stringField(payload, ['capabilityRef', 'capability_ref', 'capability']);
}

function stringArrayField(payload: ContentRecord, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
  }
  return [];
}

function controlAnalysisRequestFromPayload(payload: ContentRecord): ControlAnalysisRequest | undefined {
  const request = asRecord(payload.request ?? payload.analysisRequest ?? payload.analysis_request);
  return isControlAnalysisRequest(request) ? request as unknown as ControlAnalysisRequest : undefined;
}

function controlAnalysisResultFromPayload(payload: ContentRecord): ControlAnalysisResult | undefined {
  const fallback = asRecord(payload.fallbackResult ?? payload.fallback_result);
  return isControlAnalysisResult(fallback) ? fallback as unknown as ControlAnalysisResult : undefined;
}

function controlWorkbenchLayoutFromPayload(payload: ContentRecord): 'quad' | 'platform' | 'standard-quad' {
  const layout = stringField(payload, ['layout', 'workbenchLayout', 'workbench_layout']);
  return layout === 'platform' || layout === 'standard-quad' ? layout : 'quad';
}

function isControlAnalysisRequest(value: ContentRecord): boolean {
  return value.runtimeMode === 'analysis'
    && typeof value.plant === 'object'
    && Array.isArray(value.structures)
    && Array.isArray(value.outputs)
    && typeof value.timeRange === 'object'
    && typeof value.frequencyRange === 'object'
    && typeof value.rootLocus === 'object';
}

function isControlAnalysisResult(value: ContentRecord): boolean {
  return typeof value.metrics === 'object'
    && typeof value.stepResponse === 'object'
    && typeof value.rootLocus === 'object'
    && typeof value.magnitude === 'object'
    && typeof value.phase === 'object'
    && typeof value.nyquist === 'object';
}

function parameterSnapshotFromRequest(request: ControlAnalysisRequest | undefined): Record<string, unknown> {
  if (!request) return {};
  return Object.fromEntries(
    request.structures.flatMap((structure) => Object.entries(structure.params).map(([key, value]) => [`${structure.kind}.${key}`, value])),
  );
}
