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
import { buildAnnotatedMediaClientEvidenceDraft } from './annotated-media-evidence';
import { buildControlWorkbenchClientEvidenceDraft } from './control-workbench-evidence';
import { buildStructureDiagramClientEvidenceDraft } from './structure-diagram-evidence';
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
type ControlWorkbenchSubmissionField = {
  key: string;
  label: string;
  input: 'text' | 'number' | 'slider' | 'select' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  defaultValue?: string | number | boolean;
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
type StructureDiagramPoint = { x: number; y: number };
type StructureDiagramLayout = {
  mode: string;
  origin: StructureDiagramPoint;
  spacing: StructureDiagramPoint;
  textScale: string;
};
type BlockDiagramNodeType = 'block' | 'sum' | 'branch' | 'input' | 'output' | 'disturbance' | 'sensor';
type BlockDiagramNode = {
  id: string;
  type: BlockDiagramNodeType;
  display: string;
  label: string;
  position: StructureDiagramPoint;
  size: { width: number; height: number };
};
type BlockDiagramEdge = {
  id: string;
  from: string;
  to: string;
  display: string;
  fromPort: string;
  toPort: string;
  waypoints: StructureDiagramPoint[];
  route: string;
  label: string;
};
type BlockDiagramPayload = {
  graphId: string;
  layout: StructureDiagramLayout;
  mode: string;
  activeRevealState: string;
  nodes: BlockDiagramNode[];
  edges: BlockDiagramEdge[];
  revealPlan: Array<{ id: string; targetIds: string[]; label: string }>;
};
type SignalFlowNode = {
  id: string;
  labelLatex: string;
  position: StructureDiagramPoint;
};
type SignalFlowBranch = {
  id: string;
  from: string;
  to: string;
  route: string;
  gainLatex: string;
};
type SignalFlowPathSet = {
  id: string;
  label: string;
  branchIds: string[];
};
type SignalFlowLoopGroup = {
  id: string;
  label: string;
  loopIds: string[];
};
type SignalFlowPayload = {
  graphId: string;
  layout: StructureDiagramLayout;
  mode: string;
  activeRevealState: string;
  nodes: SignalFlowNode[];
  branches: SignalFlowBranch[];
  forwardPaths: SignalFlowPathSet[];
  loops: SignalFlowPathSet[];
  nonTouchingLoopGroups: SignalFlowLoopGroup[];
  revealPlan: Array<{ id: string; targetIds: string[]; emphasis: string; label: string }>;
  masonTerms: Array<{ id: string; latex: string; relatedIds: string[] }>;
};
type AnnotatedMediaEvidenceRole = 'input' | 'output' | 'structure' | 'parameter' | 'risk' | 'result';
type AnnotatedMediaRegion = { x: number; y: number; width: number; height: number };
type AnnotatedMediaAnnotation = {
  id: string;
  region: AnnotatedMediaRegion;
  label: string;
  body: string;
  evidenceRole: AnnotatedMediaEvidenceRole;
  revealStepIds: string[];
  required: boolean;
};
type AnnotatedMediaPayload = {
  mediaId: string;
  media: { src: string; alt: string };
  activeRevealState: string;
  annotations: AnnotatedMediaAnnotation[];
  initialSelectedAnnotationIds: string[];
  selectableAnnotations: string[];
  requireEvidenceSelection: boolean;
  revealPlan: Array<{ id: string; label: string; annotationIds: string[] }>;
};
type EmbeddedActivityPayload = {
  activityId: string;
  anchorId: string;
  visualModuleId: string;
  responseContractId: string;
  prompt: string;
  answerOptions: Array<{ id: string; label: string }>;
  position: StructureDiagramPoint;
};
type AnnotatedMediaSharedState = {
  selectedAnnotationIds: string[];
  selectedAnswerId: string | null;
};
type AnnotatedMediaSharedStateStore = Map<string, AnnotatedMediaSharedState>;

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

function structurePoint(value: unknown): StructureDiagramPoint {
  const point = asRecord(value);
  return {
    x: numberInRange(point.x, 0.5),
    y: numberInRange(point.y, 0.5),
  };
}

function structureLayout(value: unknown): StructureDiagramLayout {
  const layout = asRecord(value);
  const spacing = asRecord(layout.spacing);
  return {
    mode: stringFromFields(layout, ['mode', 'engine'], 'absolute'),
    origin: structurePoint(layout.origin ?? { x: 0.1, y: 0.45 }),
    spacing: {
      x: numberInRange(spacing.x ?? spacing.horizontal, 0.12, 0.02, 0.5),
      y: numberInRange(spacing.y ?? spacing.vertical, 0.28, 0.02, 0.5),
    },
    textScale: stringFromFields(layout, ['textScale', 'text_scale'], 'uniform'),
  };
}

function relativeDistance(value: unknown) {
  return numberInRange(value, 1, -6, 6);
}

function relativeNodePosition(
  node: Record<string, unknown>,
  resolved: ReadonlyMap<string, StructureDiagramPoint>,
  layout: StructureDiagramLayout,
  fallbackIndex: number,
) {
  if (node.position) return structurePoint(node.position);
  const grid = asRecord(node.grid ?? node.relativeGrid ?? node.relative_grid);
  if (Object.keys(grid).length > 0) {
    const column = relativeDistance(grid.column ?? grid.col ?? grid.x ?? 0);
    const row = relativeDistance(grid.row ?? grid.y ?? 0);
    return {
      x: clamp(layout.origin.x + column * layout.spacing.x, 0, 1),
      y: clamp(layout.origin.y + row * layout.spacing.y, 0, 1),
    };
  }
  const relativeTo = String(node.relativeTo ?? node.relative_to ?? node.of ?? '').trim();
  const anchor = relativeTo ? resolved.get(relativeTo) : undefined;
  if (anchor) {
    const placement = String(node.placement ?? node.place ?? node.side ?? 'right').trim();
    const distance = relativeDistance(node.distance ?? node.gap ?? 1);
    const offset = asRecord(node.offset);
    const offsetX = relativeDistance(offset.x ?? 0) * layout.spacing.x;
    const offsetY = relativeDistance(offset.y ?? 0) * layout.spacing.y;
    const dx = (placement === 'right' ? distance : placement === 'left' ? -distance : 0) * layout.spacing.x + offsetX;
    const dy = (placement === 'below' ? distance : placement === 'above' ? -distance : 0) * layout.spacing.y + offsetY;
    return {
      x: clamp(anchor.x + dx, 0, 1),
      y: clamp(anchor.y + dy, 0, 1),
    };
  }
  return {
    x: clamp(layout.origin.x + fallbackIndex * layout.spacing.x, 0, 1),
    y: layout.origin.y,
  };
}

function stringFromFields(source: ContentRecord, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
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
  return '按显影步骤观察公式、说明和关联线。';
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
  if (role === 'transform') return 'border-platform-action-primary/45 bg-platform-action-subtle';
  if (role === 'cancel') return 'border-platform-evidence-unsupported/45 bg-platform-evidence-unsupported/10';
  if (role === 'target') return 'border-platform-evidence-eligible/45 bg-platform-evidence-eligible/10';
  if (role === 'risk') return 'border-platform-evidence-context/45 bg-platform-evidence-context/10';
  if (role === 'result') return 'border-platform-action-primary/50 bg-platform-action-primary/10';
  return 'border-platform-border bg-platform-panel';
}

function derivationInlineFormulaClass(role?: DerivationFormulaBlockColorRole) {
  if (role === 'known') return 'border-b-platform-border bg-platform-surface';
  if (role === 'transform') return 'border-b-platform-action-primary bg-platform-action-subtle';
  if (role === 'cancel') return 'border-b-platform-evidence-unsupported bg-platform-evidence-unsupported/10';
  if (role === 'target') return 'border-b-platform-evidence-eligible bg-platform-evidence-eligible/10';
  if (role === 'risk') return 'border-b-platform-evidence-context bg-platform-evidence-context/10';
  if (role === 'result') return 'border-b-platform-action-primary bg-platform-action-primary/10';
  return 'border-b-platform-border bg-transparent';
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

function structureModeLabel(mode: string) {
  const labels: Record<string, string> = {
    read: '阅读',
    highlight: '路径高亮',
    construct: '结构构造',
    diagnose: '诊断',
  };
  return labels[mode] ?? '图形互动';
}

function isMathLabel(label: string) {
  return /[\\_^=()]/.test(label) || /^[A-Za-z]\w*$/.test(label);
}

function blockDiagramPayload(module: InteractiveRuntimeModuleManifest): BlockDiagramPayload {
  const payload = module.payload;
  const interaction = asRecord(payload.interactions ?? payload.interaction);
  const layout = structureLayout(payload.layout);
  return {
    graphId: String(payload.graphId ?? payload.graph_id ?? payload.diagramId ?? payload.diagram_id ?? module.id),
    layout,
    mode: visualStageString(interaction.mode ?? payload.mode, 'read'),
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    nodes: blockDiagramNodes(payload.nodes, layout),
    edges: blockDiagramEdges(payload.edges),
    revealPlan: structureRevealPlan(payload.revealPlan ?? payload.reveal_plan),
  };
}

function blockDiagramNodes(value: unknown, layout: StructureDiagramLayout): BlockDiagramNode[] {
  if (!Array.isArray(value)) return [];
  const resolved = new Map<string, StructureDiagramPoint>();
  return value
    .map((item, index): BlockDiagramNode | null => {
      const node = asRecord(item);
      const id = String(node.id ?? '').trim();
      if (!id) return null;
      const type = ['block', 'sum', 'branch', 'input', 'output', 'disturbance', 'sensor'].includes(String(node.type))
        ? String(node.type) as BlockDiagramNodeType
        : 'block';
      const size = asRecord(node.size);
      const result = {
        id,
        type,
        display: stringFromFields(node, ['display', 'renderAs', 'render_as']),
        label: stringFromFields(node, ['labelLatex', 'label_latex', 'label', 'title'], `节点 ${index + 1}`),
        position: relativeNodePosition(node, resolved, layout, index),
        size: {
          width: numberInRange(size.width, type === 'block' ? 0.16 : 0.07, 0.03, 0.4),
          height: numberInRange(size.height, type === 'block' ? 0.1 : 0.07, 0.03, 0.25),
        },
      };
      resolved.set(id, result.position);
      return result;
    })
    .filter((item): item is BlockDiagramNode => Boolean(item));
}

function blockDiagramEdges(value: unknown): BlockDiagramEdge[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): BlockDiagramEdge | null => {
      const edge = asRecord(item);
      const id = String(edge.id ?? '').trim();
      const fromRef = blockEndpointRef(edge.from ?? edge.fromId ?? edge.from_id, edge.fromPort ?? edge.from_port);
      const toRef = blockEndpointRef(edge.to ?? edge.toId ?? edge.to_id, edge.toPort ?? edge.to_port);
      const from = fromRef.nodeId;
      const to = toRef.nodeId;
      if (!id || !from || !to) return null;
      const waypoints = blockDiagramWaypoints(edge.waypoints ?? edge.via ?? edge.points);
      return {
        id,
        from,
        to,
        display: stringFromFields(edge, ['display', 'renderAs', 'render_as']),
        fromPort: fromRef.port,
        toPort: toRef.port,
        waypoints,
        route: stringFromFields(edge, ['route', 'path'], '--'),
        label: stringFromFields(edge, ['labelLatex', 'label_latex', 'label']),
      };
    })
    .filter((item): item is BlockDiagramEdge => Boolean(item));
}

function normalizeBlockPort(value: unknown) {
  const port = String(value ?? '').trim();
  const upper = port.toUpperCase();
  if (upper === 'N') return 'top';
  if (upper === 'NE') return 'top-right';
  if (upper === 'S') return 'bottom';
  if (upper === 'SE') return 'bottom-right';
  if (upper === 'E') return 'right';
  if (upper === 'SW') return 'bottom-left';
  if (upper === 'W') return 'left';
  if (upper === 'NW') return 'top-left';
  if (upper === 'C' || upper === 'CENTER') return 'center';
  return port;
}

function blockEndpointRef(rawEndpoint: unknown, rawPort: unknown) {
  const endpoint = String(rawEndpoint ?? '').trim();
  const [nodeId, inlinePort] = endpoint.includes('.') ? endpoint.split('.') : [endpoint, ''];
  return {
    nodeId: nodeId.trim(),
    port: normalizeBlockPort(rawPort || inlinePort),
  };
}

function blockDiagramWaypoints(value: unknown): StructureDiagramPoint[] {
  if (!Array.isArray(value)) return [];
  return value.map(structurePoint);
}

function structureRevealPlan(value: unknown): Array<{ id: string; targetIds: string[]; label: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const reveal = asRecord(item);
      const id = String(reveal.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        targetIds: asStringArray(reveal.targetIds ?? reveal.target_ids ?? reveal.targets),
        label: stringFromFields(reveal, ['label', 'title'], `显影 ${index + 1}`),
      };
    })
    .filter((item): item is { id: string; targetIds: string[]; label: string } => Boolean(item));
}

function signalFlowPayload(module: InteractiveRuntimeModuleManifest): SignalFlowPayload {
  const payload = module.payload;
  const interaction = asRecord(payload.interactions ?? payload.interaction);
  const pathSets = asRecord(payload.pathSets ?? payload.path_sets);
  const layout = structureLayout(payload.layout);
  return {
    graphId: String(payload.graphId ?? payload.graph_id ?? module.id),
    layout,
    mode: visualStageString(interaction.mode ?? payload.mode, 'read'),
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    nodes: signalFlowNodes(payload.nodes, layout),
    branches: signalFlowBranches(payload.branches),
    forwardPaths: signalFlowPathSets(pathSets.forwardPaths ?? pathSets.forward_paths, 'forward-path', '前向路径'),
    loops: signalFlowPathSets(pathSets.loops, 'feedback-loop', '反馈环路'),
    nonTouchingLoopGroups: signalFlowLoopGroups(pathSets.nonTouchingLoopGroups ?? pathSets.non_touching_loop_groups),
    revealPlan: signalFlowRevealPlan(payload.revealPlan ?? payload.reveal_plan),
    masonTerms: masonTerms(payload.masonTerms ?? payload.mason_terms),
  };
}

function signalFlowNodes(value: unknown, layout: StructureDiagramLayout): SignalFlowNode[] {
  if (!Array.isArray(value)) return [];
  const resolved = new Map<string, StructureDiagramPoint>();
  return value
    .map((item, index): SignalFlowNode | null => {
      const node = asRecord(item);
      const id = String(node.id ?? '').trim();
      if (!id) return null;
      const result = {
        id,
        labelLatex: stringFromFields(node, ['labelLatex', 'label_latex', 'label'], id),
        position: relativeNodePosition(node, resolved, layout, index),
      };
      resolved.set(id, result.position);
      return result;
    })
    .filter((item): item is SignalFlowNode => Boolean(item));
}

function signalFlowBranches(value: unknown): SignalFlowBranch[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SignalFlowBranch | null => {
      const branch = asRecord(item);
      const id = String(branch.id ?? '').trim();
      const from = String(branch.from ?? branch.fromId ?? branch.from_id ?? '').trim();
      const to = String(branch.to ?? branch.toId ?? branch.to_id ?? '').trim();
      if (!id || !from || !to) return null;
      return {
        id,
        from,
        to,
        route: stringFromFields(branch, ['route', 'path'], ''),
        gainLatex: stringFromFields(branch, ['gainLatex', 'gain_latex', 'labelLatex', 'label_latex'], '1'),
      };
    })
    .filter((item): item is SignalFlowBranch => Boolean(item));
}

function signalFlowRevealPlan(value: unknown): Array<{ id: string; targetIds: string[]; emphasis: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const reveal = asRecord(item);
      const id = String(reveal.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        targetIds: asStringArray(reveal.targetIds ?? reveal.target_ids ?? reveal.targets),
        emphasis: stringFromFields(reveal, ['emphasis'], 'path'),
        label: stringFromFields(reveal, ['label', 'title'], `路径 ${index + 1}`),
      };
    })
    .filter((item): item is { id: string; targetIds: string[]; emphasis: string; label: string } => Boolean(item));
}

function masonTerms(value: unknown): Array<{ id: string; latex: string; relatedIds: string[] }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): { id: string; latex: string; relatedIds: string[] } | null => {
      const term = asRecord(item);
      const id = String(term.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        latex: stringFromFields(term, ['latex', 'labelLatex', 'label_latex'], id),
        relatedIds: asStringArray(
          term.relatedIds
            ?? term.related_ids
            ?? term.pathIds
            ?? term.path_ids
            ?? term.loopIds
            ?? term.loop_ids
            ?? term.branchIds
            ?? term.branch_ids,
        ),
      };
    })
    .filter((item): item is { id: string; latex: string; relatedIds: string[] } => Boolean(item));
}

function signalFlowPathSets(value: unknown, idPrefix: string, labelPrefix: string): SignalFlowPathSet[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): SignalFlowPathSet | null => {
      if (Array.isArray(item)) {
        const branchIds = asStringArray(item);
        if (!branchIds.length) return null;
        return { id: `${idPrefix}-${index + 1}`, label: `${labelPrefix} ${index + 1}`, branchIds };
      }
      const path = asRecord(item);
      const id = String(path.id ?? '').trim() || `${idPrefix}-${index + 1}`;
      const branchIds = asStringArray(path.branchIds ?? path.branch_ids ?? path.branches);
      if (!branchIds.length) return null;
      return {
        id,
        label: stringFromFields(path, ['label', 'title'], `${labelPrefix} ${index + 1}`),
        branchIds,
      };
    })
    .filter((item): item is SignalFlowPathSet => Boolean(item));
}

function signalFlowLoopGroups(value: unknown): SignalFlowLoopGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): SignalFlowLoopGroup | null => {
      if (Array.isArray(item)) {
        const loopIds = item
          .filter((loop): loop is unknown[] => Array.isArray(loop))
          .map((_loop, loopIndex) => `feedback-loop-${loopIndex + 1}`);
        if (!loopIds.length) return null;
        return { id: `non-touching-loop-group-${index + 1}`, label: `不接触回路组 ${index + 1}`, loopIds };
      }
      const group = asRecord(item);
      const loopIds = asStringArray(group.loopIds ?? group.loop_ids ?? group.loops);
      if (!loopIds.length) return null;
      return {
        id: String(group.id ?? '').trim() || `non-touching-loop-group-${index + 1}`,
        label: stringFromFields(group, ['label', 'title'], `不接触回路组 ${index + 1}`),
        loopIds,
      };
    })
    .filter((item): item is SignalFlowLoopGroup => Boolean(item));
}

function annotatedMediaPayload(module: InteractiveRuntimeModuleManifest): AnnotatedMediaPayload {
  const payload = module.payload;
  const media = asRecord(payload.media);
  const interaction = asRecord(payload.interactions ?? payload.interaction);
  return {
    mediaId: String(payload.mediaId ?? payload.media_id ?? payload.id ?? module.id),
    media: {
      src: stringFromFields(media, ['src', 'url', 'path'], '/assets/lesson-05/structure-intro.svg'),
      alt: stringFromFields(media, ['alt', 'label'], '控制系统结构示意图'),
    },
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    annotations: annotatedMediaAnnotations(payload.annotations),
    initialSelectedAnnotationIds: asStringArray(payload.initialSelectedAnnotationIds ?? payload.initial_selected_annotation_ids),
    selectableAnnotations: asStringArray(interaction.selectableAnnotations ?? interaction.selectable_annotations),
    requireEvidenceSelection: Boolean(interaction.requireEvidenceSelection ?? interaction.require_evidence_selection),
    revealPlan: annotatedMediaRevealPlan(payload.revealPlan ?? payload.reveal_plan),
  };
}

function annotatedMediaAnnotations(value: unknown): AnnotatedMediaAnnotation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): AnnotatedMediaAnnotation | null => {
      const annotation = asRecord(item);
      const id = String(annotation.id ?? '').trim();
      if (!id) return null;
      const evidenceRole = annotatedMediaEvidenceRole(String(annotation.evidenceRole ?? annotation.evidence_role ?? 'structure'));
      return {
        id,
        region: annotatedMediaRegion(annotation.region),
        label: stringFromFields(annotation, ['label', 'title'], `证据热点 ${index + 1}`),
        body: stringFromFields(annotation, ['body', 'description', 'note']),
        evidenceRole,
        revealStepIds: asStringArray(annotation.revealStepIds ?? annotation.reveal_step_ids),
        required: annotation.required !== false,
      };
    })
    .filter((item): item is AnnotatedMediaAnnotation => Boolean(item));
}

function annotatedMediaEvidenceRole(value: string): AnnotatedMediaEvidenceRole {
  if (value === 'input' || value === 'output' || value === 'structure' || value === 'parameter' || value === 'risk' || value === 'result') return value;
  return 'structure';
}

function annotatedMediaRegion(value: unknown): AnnotatedMediaRegion {
  const region = asRecord(value);
  return {
    x: numberInRange(region.x, 0.1),
    y: numberInRange(region.y, 0.1),
    width: numberInRange(region.width ?? region.w, 0.16, 0.04, 0.6),
    height: numberInRange(region.height ?? region.h, 0.14, 0.04, 0.6),
  };
}

function annotatedMediaRevealPlan(value: unknown): Array<{ id: string; label: string; annotationIds: string[] }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const reveal = asRecord(item);
      const id = String(reveal.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        label: stringFromFields(reveal, ['label', 'title'], `显影 ${index + 1}`),
        annotationIds: asStringArray(reveal.annotationIds ?? reveal.annotation_ids ?? reveal.targetIds ?? reveal.target_ids),
      };
    })
    .filter((item): item is { id: string; label: string; annotationIds: string[] } => Boolean(item));
}

function embeddedActivityPayload(module: InteractiveRuntimeModuleManifest): EmbeddedActivityPayload {
  const payload = module.payload;
  const rawOptions = Array.isArray(payload.answerOptions ?? payload.options) ? payload.answerOptions ?? payload.options : [];
  return {
    activityId: String(payload.activityId ?? payload.activity_id ?? module.id),
    anchorId: String(payload.anchorId ?? payload.anchor_id ?? 'media-anchor'),
    visualModuleId: String(payload.visualModuleId ?? payload.visual_module_id ?? ''),
    responseContractId: String(payload.responseContractId ?? payload.response_contract_id ?? payload.responseKind ?? payload.response_kind ?? 'choice.single'),
    prompt: stringFromFields(payload, ['prompt', 'question'], '请选择图中最能支持判断的证据。'),
    answerOptions: (rawOptions as unknown[])
      .map((option, index) => {
        const record = asRecord(option);
        const id = String(record.id ?? record.value ?? '').trim() || `option-${index + 1}`;
        return {
          id,
          label: stringFromFields(record, ['label', 'title'], `选项 ${index + 1}`),
        };
      })
      .filter((option) => option.label),
    position: structurePoint(payload.position),
  };
}

function annotatedMediaVisibleAnnotations(graph: AnnotatedMediaPayload) {
  if (graph.activeRevealState === 'all' || graph.revealPlan.length === 0) return new Set(graph.annotations.map((item) => item.id));
  const activeIndex = graph.revealPlan.findIndex((item) => item.id === graph.activeRevealState);
  const visible = activeIndex >= 0 ? graph.revealPlan.slice(0, activeIndex + 1) : graph.revealPlan.slice(0, 1);
  return new Set(visible.flatMap((item) => item.annotationIds));
}

function annotatedMediaTeachingLabels(graph: AnnotatedMediaPayload) {
  return Object.fromEntries([
    ...graph.annotations.map((annotation) => [annotation.id, annotation.label] as const),
    ...graph.revealPlan.map((item) => [item.id, item.label] as const),
  ]);
}

function visibleStructureTargets(activeRevealState: string, revealPlan: Array<{ id: string; targetIds: string[] }>) {
  if (activeRevealState === 'all' || revealPlan.length === 0) return new Set<string>();
  const activeIndex = revealPlan.findIndex((item) => item.id === activeRevealState);
  const visible = activeIndex >= 0 ? revealPlan.slice(0, activeIndex + 1) : revealPlan.slice(0, 1);
  return new Set(visible.flatMap((item) => item.targetIds));
}

function selectedStructureTargets(
  selectedTargetId: string | null,
  revealPlan: Array<{ id: string; targetIds: string[] }>,
) {
  if (!selectedTargetId) return new Set<string>();
  const selectedReveal = revealPlan.find((item) => item.id === selectedTargetId);
  return new Set(selectedReveal ? selectedReveal.targetIds : [selectedTargetId]);
}

function selectedSignalFlowTargets(selectedTargetId: string | null, graph: SignalFlowPayload) {
  if (!selectedTargetId) return new Set<string>();
  const reveal = graph.revealPlan.find((item) => item.id === selectedTargetId);
  if (reveal) return new Set(reveal.targetIds);
  const path = [...graph.forwardPaths, ...graph.loops].find((item) => item.id === selectedTargetId);
  if (path) return new Set(path.branchIds);
  const group = graph.nonTouchingLoopGroups.find((item) => item.id === selectedTargetId);
  if (group) {
    const loopBranches = graph.loops
      .filter((loop) => group.loopIds.includes(loop.id))
      .flatMap((loop) => loop.branchIds);
    return new Set(loopBranches);
  }
  const term = graph.masonTerms.find((item) => item.id === selectedTargetId);
  if (term) {
    const relatedBranches = [...graph.forwardPaths, ...graph.loops]
      .filter((item) => term.relatedIds.includes(item.id))
      .flatMap((item) => item.branchIds);
    return new Set(relatedBranches);
  }
  return new Set([selectedTargetId]);
}

function structureNodeForId(nodes: readonly BlockDiagramNode[], id: string) {
  return nodes.find((node) => node.id === id);
}

function blockDiagramNodeVisualKind(node: BlockDiagramNode) {
  if (node.type === 'sensor') return 'block';
  if (node.type === 'disturbance') return 'input';
  if (node.type === 'branch' && node.display === 'takeoff') return 'takeoff';
  return node.type;
}

function blockDiagramNodeUsesEdgeInset(visualKind: string) {
  return visualKind === 'block' || visualKind === 'sum';
}

function blockDiagramNodePortPoint(node: BlockDiagramNode, port: string): StructureDiagramPoint {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind === 'branch' || visualKind === 'takeoff') return node.position;
  const halfWidth = node.size.width / 2;
  const halfHeight = node.size.height / 2;
  if (port === 'left') return { x: node.position.x - halfWidth, y: node.position.y };
  if (port === 'right') return { x: node.position.x + halfWidth, y: node.position.y };
  if (port === 'top') return { x: node.position.x, y: node.position.y - halfHeight };
  if (port === 'bottom') return { x: node.position.x, y: node.position.y + halfHeight };
  if (port === 'top-right') return { x: node.position.x + halfWidth, y: node.position.y - halfHeight };
  if (port === 'bottom-right') return { x: node.position.x + halfWidth, y: node.position.y + halfHeight };
  if (port === 'bottom-left') return { x: node.position.x - halfWidth, y: node.position.y + halfHeight };
  if (port === 'top-left') return { x: node.position.x - halfWidth, y: node.position.y - halfHeight };
  return node.position;
}

function blockDiagramAutoPort(node: BlockDiagramNode, otherPoint: StructureDiagramPoint) {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (!blockDiagramNodeUsesEdgeInset(visualKind)) return 'center';
  const dx = otherPoint.x - node.position.x;
  const dy = otherPoint.y - node.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function blockEdgeEndpoints(nodes: readonly BlockDiagramNode[], edge: BlockDiagramEdge) {
  const fromNode = structureNodeForId(nodes, edge.from);
  const toNode = structureNodeForId(nodes, edge.to);
  const fromCenter = fromNode?.position ?? structurePointForId(nodes, edge.from);
  const toCenter = toNode?.position ?? structurePointForId(nodes, edge.to);
  const firstTarget = edge.waypoints[0] ?? toCenter;
  const lastSource = edge.waypoints[edge.waypoints.length - 1] ?? fromCenter;
  const fromPort = edge.fromPort || (fromNode ? blockDiagramAutoPort(fromNode, firstTarget) : 'center');
  const toPort = edge.toPort || (toNode ? blockDiagramAutoPort(toNode, lastSource) : 'center');
  return {
    from: fromNode ? blockDiagramNodePortPoint(fromNode, fromPort) : fromCenter,
    to: toNode ? blockDiagramNodePortPoint(toNode, toPort) : toCenter,
    fromPort,
    toPort,
  };
}

function structureSvgValue(value: number) {
  return Number(value.toFixed(3)).toString();
}

function structureSvgPoint(point: StructureDiagramPoint) {
  return `${structureSvgValue(point.x * 100)} ${structureSvgValue(point.y * 100)}`;
}

function blockEdgePath(nodes: readonly BlockDiagramNode[], edge: BlockDiagramEdge) {
  const { from, to } = blockEdgeEndpoints(nodes, edge);
  if (edge.waypoints.length > 0) {
    const points = [from, ...edge.waypoints, to];
    const longestSegment = points.slice(1).reduce((best, point, index) => {
      const previous = points[index];
      const length = Math.hypot(point.x - previous.x, point.y - previous.y);
      return length > best.length ? { from: previous, to: point, length } : best;
    }, { from: points[0], to: points[1] ?? points[0], length: -1 });
    return {
      d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${structureSvgPoint(point)}`).join(' '),
      label: {
        x: ((longestSegment.from.x + longestSegment.to.x) / 2) * 100,
        y: ((longestSegment.from.y + longestSegment.to.y) / 2) * 100 - 3,
      },
    };
  }
  if (edge.route === '-|' || edge.route === '|-') {
    const elbow = edge.route === '-|' ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
    const points = [from, elbow, to];
    const longestSegment = points.slice(1).reduce((best, point, index) => {
      const previous = points[index];
      const length = Math.hypot(point.x - previous.x, point.y - previous.y);
      return length > best.length ? { from: previous, to: point, length } : best;
    }, { from: points[0], to: points[1], length: -1 });
    return {
      d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${structureSvgPoint(point)}`).join(' '),
      label: {
        x: ((longestSegment.from.x + longestSegment.to.x) / 2) * 100,
        y: ((longestSegment.from.y + longestSegment.to.y) / 2) * 100 - 3,
      },
    };
  }
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx > 0.03 && dy > 0.1) {
    const midY = Math.max(from.y, to.y) + 0.08;
    return {
      d: `M ${structureSvgPoint(from)} L ${structureSvgValue(from.x * 100)} ${structureSvgValue(midY * 100)} L ${structureSvgValue(to.x * 100)} ${structureSvgValue(midY * 100)} L ${structureSvgPoint(to)}`,
      label: { x: ((from.x + to.x) / 2) * 100, y: (midY * 100) - 2 },
    };
  }
  return {
    d: `M ${structureSvgPoint(from)} L ${structureSvgPoint(to)}`,
    label: { x: ((from.x + to.x) / 2) * 100, y: ((from.y + to.y) / 2) * 100 - 3 },
  };
}

function blockNodeBounds(node: BlockDiagramNode) {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind === 'sum') {
    return {
      left: `${node.position.x * 100}%`,
      top: `${node.position.y * 100}%`,
      width: '34px',
      height: '34px',
      transform: 'translate(-50%, -50%)',
    };
  }
  if (visualKind === 'branch') {
    return {
      left: `${node.position.x * 100}%`,
      top: `${node.position.y * 100}%`,
      width: '28px',
      height: '28px',
      transform: 'translate(-50%, -50%)',
    };
  }
  if (visualKind === 'takeoff') {
    return {
      left: `${node.position.x * 100}%`,
      top: `${node.position.y * 100}%`,
      width: '10px',
      height: '10px',
      transform: 'translate(-50%, -50%)',
    };
  }
  if (visualKind === 'input' || visualKind === 'output') {
    return {
      left: `${node.position.x * 100}%`,
      top: `${node.position.y * 100}%`,
      width: `${node.size.width * 100}%`,
      height: `${node.size.height * 100}%`,
      transform: 'translate(-50%, -50%)',
    };
  }
  return {
    left: `${(node.position.x - node.size.width / 2) * 100}%`,
    top: `${(node.position.y - node.size.height / 2) * 100}%`,
    width: `${node.size.width * 100}%`,
    height: `${node.size.height * 100}%`,
    transform: undefined,
  };
}

function blockDiagramNodeAnchors(node: BlockDiagramNode) {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind === 'sum') return 'N NE E SE S SW W NW C';
  if (visualKind === 'block') return 'N E S W';
  if (visualKind === 'takeoff') return 'C';
  return 'E W C';
}

function signalBranchPath(nodes: readonly SignalFlowNode[], branch: SignalFlowBranch) {
  const from = structurePointForId(nodes, branch.from);
  const to = structurePointForId(nodes, branch.to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const nodeRadius = 0.035;
  const start = { x: from.x + (dx / length) * nodeRadius, y: from.y + (dy / length) * nodeRadius };
  const end = { x: to.x - (dx / length) * nodeRadius, y: to.y - (dy / length) * nodeRadius };
  const routeKind = branch.route || (Math.abs(start.y - end.y) < 0.03 && end.x > start.x ? 'straight' : 'auto-bezier');
  if (routeKind === 'straight') {
    return {
      d: `M ${structureSvgPoint(start)} L ${structureSvgPoint(end)}`,
      label: { x: ((start.x + end.x) / 2) * 100, y: ((start.y + end.y) / 2) * 100 - 4 },
      routeKind,
    };
  }
  if (to.x < from.x || Math.abs(to.y - from.y) > 0.12) {
    const verticalDirection = start.y <= end.y ? 1 : -1;
    const controlY = (verticalDirection > 0 ? Math.max(start.y, end.y) : Math.min(start.y, end.y)) + verticalDirection * 0.16;
    return {
      d: `M ${structureSvgPoint(start)} C ${structureSvgValue(start.x * 100)} ${structureSvgValue(controlY * 100)}, ${structureSvgValue(end.x * 100)} ${structureSvgValue(controlY * 100)}, ${structureSvgPoint(end)}`,
      label: { x: ((start.x + end.x) / 2) * 100, y: controlY * 100 + 4 },
      routeKind: 'auto-bezier',
    };
  }
  const controlX = ((start.x + end.x) / 2) * 100;
  const controlY = (((start.y + end.y) / 2) - 0.06) * 100;
  return {
    d: `M ${structureSvgPoint(start)} C ${structureSvgValue(controlX)} ${structureSvgValue(controlY)}, ${structureSvgValue(controlX)} ${structureSvgValue(controlY)}, ${structureSvgPoint(end)}`,
    label: { x: ((start.x + end.x) / 2) * 100, y: controlY - 3 },
    routeKind: 'auto-bezier',
  };
}

function structureEvidenceTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function structureEvidenceViewport(): 'mobile' | 'desktop' | 'projection' {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth >= 1800) return 'projection';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function blockDiagramTeachingLabels(graph: BlockDiagramPayload) {
  return Object.fromEntries([
    ...graph.nodes.map((node) => [node.id, node.label] as const),
    ...graph.edges.map((edge) => [edge.id, edge.label || edge.id] as const),
    ...graph.revealPlan.map((item) => [item.id, item.label] as const),
  ]);
}

function signalFlowTeachingLabels(graph: SignalFlowPayload) {
  return Object.fromEntries([
    ...graph.nodes.map((node) => [node.id, node.labelLatex] as const),
    ...graph.branches.map((branch) => [branch.id, branch.gainLatex] as const),
    ...graph.forwardPaths.map((path) => [path.id, path.label] as const),
    ...graph.loops.map((loop) => [loop.id, loop.label] as const),
    ...graph.nonTouchingLoopGroups.map((group) => [group.id, group.label] as const),
    ...graph.revealPlan.map((item) => [item.id, item.label] as const),
    ...graph.masonTerms.map((term) => [term.id, term.latex] as const),
  ]);
}

type StructureDiagramPanelProps = {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
  interactionMode?: 'active' | 'readonly';
  annotatedMediaSharedState?: AnnotatedMediaSharedStateStore;
};

function structurePointForId(nodes: Array<{ id: string; position: StructureDiagramPoint }>, id: string) {
  return nodes.find((node) => node.id === id)?.position ?? { x: 0.5, y: 0.5 };
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
  const submissionFields = controlWorkbenchSubmissionFieldsFromPayload(module.payload);
  const [submissionValues, setSubmissionValues] = useState<Record<string, string | number | boolean>>(() =>
    initialControlWorkbenchSubmissionValues(module.payload, request),
  );
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
    const eventDraft = buildSharedControlWorkbenchEvidenceDraft({
      manifest,
      step,
      module,
      submittedAt,
      submissionValues,
    });
    if (!eventDraft) return;
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
          {submissionFields.length > 0 ? (
            <div className="premium-lesson-panel-soft grid gap-3 p-4 sm:grid-cols-2">
              {submissionFields.map((field) => (
                <label key={field.key} className="space-y-1 text-sm">
                  <span className="premium-lesson-muted block">{field.label}</span>
                  {field.input === 'select' || field.input === 'toggle' ? (
                    <select
                      className="premium-lesson-select w-full"
                      value={String(submissionValues[field.key] ?? '')}
                      onChange={(event) => {
                        setSubmissionValues((prev) => ({ ...prev, [field.key]: event.currentTarget.value }));
                      }}
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.input === 'slider' ? (
                    <input
                      className="w-full accent-current"
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 0.1}
                      value={Number(submissionValues[field.key] ?? field.defaultValue ?? field.min ?? 0)}
                      onChange={(event) => {
                        setSubmissionValues((prev) => ({ ...prev, [field.key]: Number(event.currentTarget.value) }));
                      }}
                    />
                  ) : (
                    <input
                      className="premium-lesson-input w-full"
                      type={field.input === 'number' ? 'number' : 'text'}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={String(submissionValues[field.key] ?? '')}
                      onChange={(event) => {
                        const value = field.input === 'number' ? Number(event.currentTarget.value) : event.currentTarget.value;
                        setSubmissionValues((prev) => ({ ...prev, [field.key]: value }));
                      }}
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}
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
  const initialRevealStepId = stage.activeRevealStepId === 'all'
    ? (stage.revealSteps.at(-1)?.id ?? 'all')
    : stage.activeRevealStepId;
  const [activeRevealStepId, setActiveRevealStepId] = useState(initialRevealStepId);
  const renderedStage = { ...stage, activeRevealStepId };
  const visibleTargetIds = derivationStageVisibleTargetIds(renderedStage);
  const visibleRevealStepIds = derivationVisibleRevealStepIds(renderedStage);
  const targetRegions = derivationTargetRegionMap(stage);
  const activeRevealIndex = stage.revealSteps.findIndex((step) => step.id === activeRevealStepId);
  const activeStepNumber = activeRevealIndex >= 0 ? activeRevealIndex + 1 : Math.min(stage.revealSteps.length, 1);
  const canUseControls = stage.releaseState !== 'unavailable' && stage.releaseState !== 'unreleased' && stage.revealSteps.length > 0;
  const goToRevealOffset = (offset: number) => {
    if (!canUseControls) return;
    const currentIndex = activeRevealIndex >= 0 ? activeRevealIndex : 0;
    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), stage.revealSteps.length - 1);
    setActiveRevealStepId(stage.revealSteps[nextIndex]?.id ?? activeRevealStepId);
  };
  const visibleFormulas = stage.formulas.filter((formula) => (
    visibleTargetIds.has(formula.id) || formula.blocks.some((block) => visibleTargetIds.has(block.id))
  ));
  const visibleTextBlocks = stage.textBlocks.filter((block) => visibleTargetIds.has(block.id));
  const visibleConnectors = stage.connectors.filter((connector) => (
    visibleTargetIds.has(connector.from) && visibleTargetIds.has(connector.to)
    && connector.revealStepIds.some((stepId) => visibleRevealStepIds.has(stepId))
  ));
  const aspectClass = stage.aspectRatio === '4:3'
    ? 'min-h-0 md:aspect-[4/3] md:min-h-0'
    : stage.aspectRatio === 'fluid'
      ? 'min-h-0 md:min-h-[520px]'
      : 'min-h-0 md:aspect-video md:min-h-0';

  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-derivation-stage-id={stage.stageId}
      data-derivation-stage-release-state={stage.releaseState}
      data-derivation-stage-active-reveal-step={activeRevealStepId}
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {stage.revealSteps.length > 0 ? (
            <span className="premium-lesson-badge" data-derivation-stage-step-progress="visible">
              第 {activeStepNumber} / {stage.revealSteps.length} 步
            </span>
          ) : null}
          <button
            type="button"
            className="premium-lesson-action-tone premium-tone-slate px-3 py-1 text-xs"
            data-derivation-stage-control-button="previous"
            data-derivation-stage-teacher-control="previous"
            onClick={() => goToRevealOffset(-1)}
            disabled={!canUseControls || activeStepNumber <= 1}
          >
            {derivationTeacherControlLabel('previous')}
          </button>
          <button
            type="button"
            className="premium-lesson-action-tone premium-tone-cyan px-3 py-1 text-xs"
            data-derivation-stage-control-button="next"
            data-derivation-stage-teacher-control="next"
            onClick={() => goToRevealOffset(1)}
            disabled={!canUseControls || activeStepNumber >= stage.revealSteps.length}
          >
            {derivationTeacherControlLabel('next')}
          </button>
        </div>
      </div>
      <div
        className={[
          'relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4 pr-16 md:block md:p-0',
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
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
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
                stroke="hsl(var(--platform-action-primary))"
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
          const renderFullFormula = visibleBlocks.length === 0;
          const visibleStandaloneBlocks = renderFullFormula
            ? visibleBlocks.filter((block) => normalizeMath(block.latex) !== normalizeMath(formula.latex))
            : visibleBlocks;
          return (
            <article
              key={formula.id}
              className="relative w-full overflow-visible p-0 md:absolute md:left-[var(--derivation-left)] md:top-[var(--derivation-top)] md:w-[var(--derivation-width)]"
              style={{
                ['--derivation-left' as string]: `${formula.region.x * 100}%`,
                ['--derivation-top' as string]: `${formula.region.y * 100}%`,
                ['--derivation-width' as string]: `${formula.region.width * 100}%`,
              }}
              data-derivation-stage-formula-id={formula.id}
              data-derivation-stage-formula-frame="freeform"
            >
              {renderFullFormula ? (
                <div
                  className="inline-block bg-[var(--platform-panel)]/35 px-2 py-1"
                  data-derivation-stage-formula-latex-source={formula.latex}
                >
                  <BlockMath math={normalizeMath(formula.latex)} />
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleStandaloneBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={[
                      'inline-block border-b-2 px-1.5 py-0.5',
                      derivationInlineFormulaClass(block.colorRole),
                    ].join(' ')}
                    data-derivation-stage-formula-block-id={block.id}
                    data-derivation-stage-formula-block-frame="inline"
                    data-derivation-stage-color-role={block.colorRole ?? 'none'}
                    data-derivation-stage-block-latex-source={block.latex}
                  >
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
            className="relative w-full overflow-visible p-0 md:absolute md:left-[var(--derivation-left)] md:top-[var(--derivation-top)] md:w-[var(--derivation-width)]"
              style={{
                ['--derivation-left' as string]: `${block.region.x * 100}%`,
                ['--derivation-top' as string]: `${block.region.y * 100}%`,
                ['--derivation-width' as string]: `${block.region.width * 100}%`,
              }}
            data-derivation-stage-text-block-id={block.id}
            data-derivation-stage-text-frame="freeform"
          >
            <h3 className="premium-lesson-title text-sm">{block.title}</h3>
            <p className="premium-lesson-body mt-1 text-sm leading-6">{renderInlineContent(block.body)}</p>
          </article>
        ))}
      </div>
      {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? null : (
        <div className="hidden" data-derivation-stage-reveal-steps="metadata" aria-hidden="true">
          {stage.revealSteps.map((step) => (
            <span
              key={step.id}
              data-derivation-stage-reveal-step-id={step.id}
              data-derivation-stage-reveal-step-active={step.id === activeRevealStepId ? 'true' : 'false'}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BlockDiagramPanel({ manifest, step, module, onPanelSubmit }: StructureDiagramPanelProps) {
  const graph = blockDiagramPayload(module);
  const visibleTargets = visibleStructureTargets(graph.activeRevealState, graph.revealPlan);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedTargets = selectedStructureTargets(selectedTargetId, graph.revealPlan);
  const highlighted = (id: string) => visibleTargets.size === 0 || visibleTargets.has(id) || selectedTargets.has(id);
  const selected = (id: string) => selectedTargets.has(id);
  const submitCurrent = () => {
    if (!onPanelSubmit) return;
    const submittedAt = Date.now();
    const selectedReveal = graph.revealPlan.find((item) => item.id === selectedTargetId);
    const draft = buildStructureDiagramClientEvidenceDraft({
      eventType: 'graph_submit',
      clientEventId: `${step.id}:${module.id}:${graph.graphId}:${submittedAt}`,
      attemptKey: `${step.id}:${module.id}:${graph.graphId}:${submittedAt}`,
      lessonKey: manifest.lessonId,
      stepId: step.id,
      moduleId: module.id,
      componentKind: 'visual.blockDiagram',
      componentId: graph.graphId,
      actorRole: 'student',
      clientEventAt: new Date(submittedAt).toISOString(),
      theme: structureEvidenceTheme(),
      viewport: structureEvidenceViewport(),
      graphId: graph.graphId,
      activeRevealState: graph.activeRevealState,
      selectedNodeIds: graph.nodes.some((node) => node.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedPathIds: selectedReveal && selectedReveal.id.includes('path') ? [selectedReveal.id] : [],
      selectedLoopIds: selectedReveal && selectedReveal.id.includes('loop') ? [selectedReveal.id] : [],
      constructedPositions: graph.nodes.map((node) => ({ nodeId: node.id, x: node.position.x, y: node.position.y })),
      constructedConnections: graph.edges.map((edge) => ({ from: edge.from, to: edge.to, branchId: edge.id, gainLabel: edge.label })),
      connectionDifferences: [],
      teachingLabels: blockDiagramTeachingLabels(graph),
    });
    onPanelSubmit({
      stepId: step.id,
      submittedAt,
      answers: {
        [module.id]: JSON.stringify(draft),
      },
    });
  };
  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-structure-diagram-kind="visual.blockDiagram"
      data-structure-diagram-id={graph.graphId}
      data-structure-diagram-layout-mode={graph.layout.mode}
      data-structure-diagram-layout-spacing-x={graph.layout.spacing.x}
      data-structure-diagram-layout-spacing-y={graph.layout.spacing.y}
      data-structure-diagram-text-scale={graph.layout.textScale}
      data-structure-diagram-mode={graph.mode}
      data-structure-diagram-active-reveal={graph.activeRevealState}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="premium-lesson-muted text-sm leading-6">用结构节点、信号线和反馈回路表达控制系统关系。</p>
        </div>
        <span className="premium-lesson-badge" data-structure-diagram-mode-label="visual">{structureModeLabel(graph.mode)}</span>
      </div>
      <div
        className="relative min-h-[420px] overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)] md:aspect-video md:min-h-0"
        tabIndex={0}
        role="group"
        aria-label={`${graph.graphId} 方框图`}
        data-structure-diagram-canvas="normalized"
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" data-structure-diagram-svg="block">
          <defs>
            <marker id={`${graph.graphId}-arrow`} markerWidth="3" markerHeight="3" refX="2.15" refY="1.2" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L2.35,1.2 L0,2.4 z" fill="hsl(var(--platform-action-primary))" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const path = blockEdgePath(graph.nodes, edge);
            const endpoints = blockEdgeEndpoints(graph.nodes, edge);
            return (
              <g
                key={edge.id}
                data-structure-diagram-edge-id={edge.id}
                data-structure-diagram-edge-from-port={endpoints.fromPort}
                data-structure-diagram-edge-to-port={endpoints.toPort}
                data-structure-diagram-edge-route={edge.route}
                data-structure-diagram-edge-waypoint-count={edge.waypoints.length || (edge.route === '-|' || edge.route === '|-' ? 1 : 0)}
                data-structure-diagram-edge-highlighted={highlighted(edge.id) ? 'true' : 'false'}
                data-structure-diagram-edge-selected={selected(edge.id) ? 'true' : 'false'}
              >
                <path
                  d={path.d}
                  fill="none"
                  stroke={highlighted(edge.id) ? 'hsl(var(--platform-action-primary))' : 'hsl(var(--platform-border-strong))'}
                  strokeWidth={selected(edge.id) ? 0.48 : highlighted(edge.id) ? 0.34 : 0.24}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#${graph.graphId}-arrow)`}
                />
              </g>
            );
          })}
        </svg>
        {graph.edges.map((edge) => {
          if (!edge.label) return null;
          const path = blockEdgePath(graph.nodes, edge);
          return (
            <div
              key={`${edge.id}-label`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 bg-[var(--platform-surface)]/80 px-1.5 py-0.5 text-[13px] font-semibold"
              style={{ left: `${path.label.x}%`, top: `${path.label.y}%` }}
              data-structure-diagram-edge-label-id={edge.id}
              data-structure-diagram-label-chrome="plain"
              data-structure-diagram-text-scale={graph.layout.textScale}
            >
              {isMathLabel(edge.label) ? <InlineMath math={normalizeMath(edge.label)} /> : edge.label}
            </div>
          );
        })}
        {graph.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className={[
              'absolute grid place-items-center text-center outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
              blockDiagramNodeVisualKind(node) === 'block' ? 'border bg-platform-panel shadow-[var(--platform-shadow-xs)]' : '',
              blockDiagramNodeVisualKind(node) === 'sum' ? 'rounded-full border bg-platform-panel' : '',
              blockDiagramNodeVisualKind(node) === 'branch' ? 'border border-transparent bg-transparent' : '',
              blockDiagramNodeVisualKind(node) === 'takeoff' ? 'rounded-full border border-platform-action-primary bg-platform-action-primary' : '',
              blockDiagramNodeVisualKind(node) === 'input' || blockDiagramNodeVisualKind(node) === 'output' ? 'border border-transparent bg-transparent' : '',
              blockDiagramNodeVisualKind(node) === 'block' || blockDiagramNodeVisualKind(node) === 'sum'
                ? (highlighted(node.id) || selectedTargetId === node.id ? 'border-platform-action-primary' : 'border-platform-border')
                : '',
            ].join(' ')}
            style={blockNodeBounds(node)}
            data-structure-diagram-node-id={node.id}
            data-structure-diagram-node-type={node.type}
            data-structure-diagram-node-visual-kind={blockDiagramNodeVisualKind(node)}
            data-structure-diagram-node-anchors={blockDiagramNodeAnchors(node)}
            data-structure-diagram-text-scale={graph.layout.textScale}
            data-structure-diagram-node-label-rendering={isMathLabel(node.label) ? 'latex' : 'text'}
            data-structure-diagram-node-symbol-size={
              blockDiagramNodeVisualKind(node) === 'branch'
                ? 'route-point'
                : blockDiagramNodeVisualKind(node) === 'takeoff'
                  ? 'takeoff-dot'
                  : blockDiagramNodeVisualKind(node) === 'sum'
                    ? 'junction'
                    : 'label'
            }
            data-structure-diagram-output-label-position={blockDiagramNodeVisualKind(node) === 'output' ? 'above-line' : undefined}
            data-structure-diagram-node-highlighted={highlighted(node.id) ? 'true' : 'false'}
            data-structure-diagram-node-selected={selectedTargetId === node.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(node.id)}
          >
            {blockDiagramNodeVisualKind(node) === 'sum' ? (
              <svg
                className="h-full w-full"
                viewBox="0 0 40 40"
                aria-hidden="true"
                data-structure-diagram-summing-junction="cross"
              >
                <line x1="13" y1="13" x2="27" y2="27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="27" y1="13" x2="13" y2="27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            ) : blockDiagramNodeVisualKind(node) === 'branch' ? (
              <span className="sr-only">{node.label}</span>
            ) : blockDiagramNodeVisualKind(node) === 'takeoff' ? (
              <span className="sr-only">{node.label}</span>
            ) : blockDiagramNodeVisualKind(node) === 'output' ? (
              <span
                className="block -translate-y-4 premium-lesson-title text-[13px]"
                data-structure-diagram-output-label-position="above-line"
              >
                {isMathLabel(node.label) ? <InlineMath math={normalizeMath(node.label)} /> : node.label}
              </span>
            ) : isMathLabel(node.label) ? (
              <span className="text-[13px]"><InlineMath math={normalizeMath(node.label)} /></span>
            ) : (
              <span className="premium-lesson-title text-[13px]">{node.label}</span>
            )}
          </button>
        ))}
        {graph.edges.map((edge) => {
          const { label } = blockEdgePath(graph.nodes, edge);
          return (
            <button
              key={`${edge.id}-target`}
              type="button"
              className="absolute h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent outline-none focus-visible:border-platform-action-primary focus-visible:bg-platform-action-primary/15 focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
              aria-label={`选择支路 ${edge.label || edge.id}`}
              data-structure-diagram-edge-select-id={edge.id}
              data-structure-diagram-edge-selected={selectedTargetId === edge.id ? 'true' : 'false'}
              onClick={() => setSelectedTargetId(edge.id)}
            />
          );
        })}
      </div>
      <div className="hidden" data-structure-diagram-reveal-plan="metadata" aria-hidden="true">
        {graph.revealPlan.map((item) => (
          <span
            key={item.id}
            data-structure-diagram-reveal-id={item.id}
            data-structure-diagram-reveal-selected={selectedTargetId === item.id ? 'true' : 'false'}
            data-structure-diagram-reveal-label={item.label}
          />
        ))}
      </div>
      <button
        type="button"
        className="premium-lesson-action-tone premium-tone-cyan justify-self-start"
        data-structure-diagram-submit={graph.graphId}
        onClick={submitCurrent}
        disabled={!onPanelSubmit}
      >
        提交结构图证据
      </button>
    </section>
  );
}

function SignalFlowGraphPanel({ manifest, step, module, onPanelSubmit }: StructureDiagramPanelProps) {
  const graph = signalFlowPayload(module);
  const visibleTargets = visibleStructureTargets(graph.activeRevealState, graph.revealPlan);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedTargets = selectedSignalFlowTargets(selectedTargetId, graph);
  const highlighted = (id: string) => visibleTargets.size === 0 || visibleTargets.has(id) || selectedTargets.has(id);
  const selected = (id: string) => selectedTargets.has(id);
  const submitCurrent = () => {
    if (!onPanelSubmit) return;
    const submittedAt = Date.now();
    const draft = buildStructureDiagramClientEvidenceDraft({
      eventType: 'graph_submit',
      clientEventId: `${step.id}:${module.id}:${graph.graphId}:${submittedAt}`,
      attemptKey: `${step.id}:${module.id}:${graph.graphId}:${submittedAt}`,
      lessonKey: manifest.lessonId,
      stepId: step.id,
      moduleId: module.id,
      componentKind: 'visual.signalFlowGraph',
      componentId: graph.graphId,
      actorRole: 'student',
      clientEventAt: new Date(submittedAt).toISOString(),
      theme: structureEvidenceTheme(),
      viewport: structureEvidenceViewport(),
      graphId: graph.graphId,
      activeRevealState: graph.activeRevealState,
      selectedNodeIds: graph.nodes.some((node) => node.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedPathIds: graph.forwardPaths.some((path) => path.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedLoopIds: graph.loops.some((loop) => loop.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      constructedPositions: graph.nodes.map((node) => ({ nodeId: node.id, x: node.position.x, y: node.position.y })),
      constructedConnections: graph.branches.map((branch) => ({ from: branch.from, to: branch.to, branchId: branch.id, gainLabel: branch.gainLatex })),
      connectionDifferences: [],
      teachingLabels: signalFlowTeachingLabels(graph),
    });
    onPanelSubmit({
      stepId: step.id,
      submittedAt,
      answers: {
        [module.id]: JSON.stringify(draft),
      },
    });
  };
  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-structure-diagram-kind="visual.signalFlowGraph"
      data-structure-diagram-id={graph.graphId}
      data-structure-diagram-layout-mode={graph.layout.mode}
      data-structure-diagram-layout-spacing-x={graph.layout.spacing.x}
      data-structure-diagram-layout-spacing-y={graph.layout.spacing.y}
      data-structure-diagram-text-scale={graph.layout.textScale}
      data-structure-diagram-mode={graph.mode}
      data-structure-diagram-active-reveal={graph.activeRevealState}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="premium-lesson-muted text-sm leading-6">把 Mason 公式中的路径与回路直接映射到图中支路。</p>
        </div>
        <span className="premium-lesson-badge" data-structure-diagram-mode-label="visual">{structureModeLabel(graph.mode)}</span>
      </div>
      <div
        className="relative min-h-[420px] overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)] md:aspect-video md:min-h-0"
        tabIndex={0}
        role="group"
        aria-label={`${graph.graphId} 信号流图`}
        data-structure-diagram-canvas="normalized"
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" data-structure-diagram-svg="signal-flow">
          <defs>
            <marker id={`${graph.graphId}-branch-arrow`} markerWidth="3" markerHeight="3" refX="2.15" refY="1.2" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L2.35,1.2 L0,2.4 z" fill="hsl(var(--platform-action-primary))" />
            </marker>
          </defs>
          {graph.branches.map((branch) => {
            const path = signalBranchPath(graph.nodes, branch);
            return (
              <g
                key={branch.id}
                data-structure-diagram-branch-id={branch.id}
                data-structure-diagram-branch-route-kind={path.routeKind}
                data-structure-diagram-branch-highlighted={highlighted(branch.id) ? 'true' : 'false'}
                data-structure-diagram-branch-selected={selected(branch.id) ? 'true' : 'false'}
              >
                <path
                  d={path.d}
                  fill="none"
                  stroke={highlighted(branch.id) ? 'hsl(var(--platform-action-primary))' : 'hsl(var(--platform-border-strong))'}
                  strokeWidth={selected(branch.id) ? 0.48 : highlighted(branch.id) ? 0.34 : 0.24}
                  strokeLinecap="round"
                  markerEnd={`url(#${graph.graphId}-branch-arrow)`}
                />
              </g>
            );
          })}
        </svg>
        {graph.branches.map((branch) => {
          const path = signalBranchPath(graph.nodes, branch);
          return (
            <div
              key={`${branch.id}-label`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 bg-[var(--platform-surface)]/80 px-1.5 py-0.5 text-[13px] font-semibold"
              style={{ left: `${path.label.x}%`, top: `${path.label.y}%` }}
              data-structure-diagram-branch-label-id={branch.id}
              data-structure-diagram-label-chrome="plain"
              data-structure-diagram-text-scale={graph.layout.textScale}
            >
              <InlineMath math={normalizeMath(branch.gainLatex)} />
            </div>
          );
        })}
        {graph.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-platform-action-primary bg-platform-panel text-[13px] shadow-[var(--platform-shadow-xs)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)] md:h-9 md:w-9"
            style={{ left: `${node.position.x * 100}%`, top: `${node.position.y * 100}%` }}
            data-structure-diagram-node-id={node.id}
            data-structure-diagram-node-anchors="E W C"
            data-structure-diagram-text-scale={graph.layout.textScale}
            data-structure-diagram-node-selected={selectedTargetId === node.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(node.id)}
          >
            <InlineMath math={normalizeMath(node.labelLatex)} />
          </button>
        ))}
        {graph.branches.map((branch) => {
          const { label } = signalBranchPath(graph.nodes, branch);
          return (
            <button
              key={`${branch.id}-target`}
              type="button"
              className="absolute h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent outline-none focus-visible:border-platform-action-primary focus-visible:bg-platform-action-primary/15 focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
              aria-label={`选择支路 ${branch.gainLatex}`}
              data-structure-diagram-branch-select-id={branch.id}
              data-structure-diagram-branch-selected={selectedTargetId === branch.id ? 'true' : 'false'}
              onClick={() => setSelectedTargetId(branch.id)}
            />
          );
        })}
      </div>
      <div className="grid gap-2 md:grid-cols-3" data-structure-diagram-path-sets="visible">
        {graph.forwardPaths.map((path) => (
          <button
            key={path.id}
            type="button"
            className="premium-lesson-card text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
            data-structure-diagram-forward-path={path.branchIds.join(' ')}
            data-structure-diagram-path-id={path.id}
            data-structure-diagram-path-selected={selectedTargetId === path.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(path.id)}
          >
            <span className="premium-lesson-caption">前向通路</span>
            <span className="premium-lesson-title block text-sm">{path.label}</span>
          </button>
        ))}
        {graph.loops.map((loop) => (
          <button
            key={loop.id}
            type="button"
            className="premium-lesson-card text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
            data-structure-diagram-loop={loop.branchIds.join(' ')}
            data-structure-diagram-loop-id={loop.id}
            data-structure-diagram-loop-selected={selectedTargetId === loop.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(loop.id)}
          >
            <span className="premium-lesson-caption">反馈回路</span>
            <span className="premium-lesson-title block text-sm">{loop.label}</span>
          </button>
        ))}
        {graph.nonTouchingLoopGroups.filter((group) => graph.loops.length > 1 && group.loopIds.length > 1).map((group) => (
          <button
            key={group.id}
            type="button"
            className="premium-lesson-card text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
            data-structure-diagram-non-touching-loop-group={group.loopIds.join(' ')}
            data-structure-diagram-loop-group-id={group.id}
            data-structure-diagram-loop-group-selected={selectedTargetId === group.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(group.id)}
          >
            <span className="premium-lesson-caption">不接触回路组</span>
            <span className="premium-lesson-title block text-sm">{group.label}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3" data-structure-diagram-mason-map="visible">
        {graph.masonTerms.map((term) => (
          <button
            key={term.id}
            type="button"
            className="premium-lesson-card text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
            data-structure-diagram-mason-term-id={term.id}
            data-structure-diagram-related-ids={term.relatedIds.join(' ')}
            data-structure-diagram-mason-term-selected={selectedTargetId === term.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(term.id)}
          >
            <p className="premium-lesson-caption">Mason 公式项</p>
            <BlockMath math={normalizeMath(term.latex)} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="premium-lesson-action-tone premium-tone-cyan justify-self-start"
        data-structure-diagram-submit={graph.graphId}
        onClick={submitCurrent}
        disabled={!onPanelSubmit}
      >
        提交结构图证据
      </button>
    </section>
  );
}

function annotatedMediaStateFor(
  store: AnnotatedMediaSharedStateStore | undefined,
  visualModuleId: string,
  initialSelectedAnnotationIds: string[],
  initialSelectedAnswerId: string | null,
) {
  if (!store) return { selectedAnnotationIds: [...initialSelectedAnnotationIds], selectedAnswerId: initialSelectedAnswerId };
  const existing = store.get(visualModuleId);
  if (existing) return existing;
  const next = { selectedAnnotationIds: [...initialSelectedAnnotationIds], selectedAnswerId: initialSelectedAnswerId };
  store.set(visualModuleId, next);
  return next;
}

function embeddedActivityForVisualModule(step: InteractiveRuntimeStepManifest, visualModuleId: string): EmbeddedActivityPayload | null {
  const embeddedModule = step.modules.find((item) => item.kind === 'visual.embedded-activity' && String(item.payload.visualModuleId ?? item.payload.visual_module_id ?? '') === visualModuleId);
  return embeddedModule ? embeddedActivityPayload(embeddedModule) : null;
}

function annotatedMediaModuleForEmbeddedActivity(step: InteractiveRuntimeStepManifest, activity: EmbeddedActivityPayload): InteractiveRuntimeModuleManifest | null {
  return step.modules.find((item) => item.id === activity.visualModuleId && item.kind === 'visual.annotatedMedia') ?? null;
}

function buildAnnotatedMediaSubmissionDraft({
  manifest,
  step,
  module,
  graph,
  activity,
  selectedAnnotationIds,
  selectedAnswerId,
  eventType,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  graph: AnnotatedMediaPayload;
  activity: EmbeddedActivityPayload | null;
  selectedAnnotationIds: string[];
  selectedAnswerId: string | null;
  eventType: 'media_submit' | 'activity_answer';
}) {
  const submittedAt = Date.now();
  const selectable = graph.selectableAnnotations.length ? new Set(graph.selectableAnnotations) : new Set(graph.annotations.map((item) => item.id));
  const selected = selectedAnnotationIds.filter((annotationId) => selectable.has(annotationId));
  const omittedRequired = graph.annotations
    .filter((annotation) => annotation.required && selectable.has(annotation.id) && !selected.includes(annotation.id))
    .map((annotation) => annotation.id);
  const answerPayload = activity
    ? {
      responseContractId: activity.responseContractId,
      selectedAnswerId,
      visualModuleId: activity.visualModuleId,
    }
    : null;
  const draft = buildAnnotatedMediaClientEvidenceDraft({
    eventType,
    clientEventId: `${step.id}:${module.id}:${graph.mediaId}:${submittedAt}`,
    attemptKey: `${step.id}:${module.id}:${graph.mediaId}:${submittedAt}`,
    lessonKey: manifest.lessonId,
    stepId: step.id,
    moduleId: module.id,
    componentKind: eventType === 'activity_answer' ? 'visual.embedded-activity' : 'visual.annotatedMedia',
    componentId: eventType === 'activity_answer' && activity ? activity.activityId : graph.mediaId,
    actorRole: 'student',
    clientEventAt: new Date(submittedAt).toISOString(),
    mediaId: graph.mediaId,
    activeRevealState: graph.activeRevealState,
    selectedAnnotationIds: selected,
    omittedRequiredAnnotationIds: omittedRequired,
    evidenceRoles: Object.fromEntries(graph.annotations.map((annotation) => [annotation.id, annotation.evidenceRole])),
    embeddedActivityAnchorId: activity?.anchorId ?? null,
    answerPayload,
    teachingLabels: {
      ...annotatedMediaTeachingLabels(graph),
      ...(activity ? { [activity.anchorId]: activity.prompt } : {}),
    },
    feedback: {
      misconceptionTagIds: omittedRequired.length ? ['omitted-required-hotspot'] : [],
      studentFeedbackMode: omittedRequired.length ? 'hint' : 'none',
      teacherNextPrompt: omittedRequired.length ? '请学生补充遗漏的图上证据。' : null,
      reviewAction: omittedRequired.length ? 'review' : 'advance',
    },
  });
  return { draft, submittedAt };
}

function AnnotatedMediaPanel({ manifest, step, module, onPanelSubmit, interactionMode = 'active', annotatedMediaSharedState }: StructureDiagramPanelProps) {
  const graph = annotatedMediaPayload(module);
  const embeddedActivity = embeddedActivityForVisualModule(step, module.id);
  const sharedState = annotatedMediaStateFor(
    annotatedMediaSharedState,
    module.id,
    graph.initialSelectedAnnotationIds,
    embeddedActivity?.answerOptions[0]?.id ?? null,
  );
  const visibleAnnotations = annotatedMediaVisibleAnnotations(graph);
  const selectable = graph.selectableAnnotations.length ? new Set(graph.selectableAnnotations) : new Set(graph.annotations.map((item) => item.id));
  const canInteract = Boolean(onPanelSubmit) && interactionMode === 'active';
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>(sharedState.selectedAnnotationIds);
  const selectedSet = new Set(selectedAnnotationIds);
  const toggleAnnotation = (annotationId: string) => {
    if (!canInteract || !selectable.has(annotationId)) return;
    setSelectedAnnotationIds((current) => {
      const next = current.includes(annotationId)
        ? current.filter((item) => item !== annotationId)
        : [...current, annotationId];
      sharedState.selectedAnnotationIds = next;
      return next;
    });
  };
  const submitCurrent = () => {
    if (!canInteract || !onPanelSubmit) return;
    const { draft, submittedAt } = buildAnnotatedMediaSubmissionDraft({
      manifest,
      step,
      module,
      graph,
      activity: embeddedActivity,
      selectedAnnotationIds,
      selectedAnswerId: sharedState.selectedAnswerId,
      eventType: 'media_submit',
    });
    onPanelSubmit({
      stepId: step.id,
      submittedAt,
      answers: {
        annotatedMediaEvidenceDraft: JSON.stringify(draft),
        [module.id]: JSON.stringify(draft),
      },
    });
  };

  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-annotated-media-kind="visual.annotatedMedia"
      data-annotated-media-id={graph.mediaId}
      data-annotated-media-active-reveal={graph.activeRevealState}
      data-annotated-media-selected-count={selectedAnnotationIds.length}
      data-annotated-media-interaction-mode={canInteract ? 'active' : 'readonly'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="premium-lesson-muted text-sm leading-6">在图中选择输入、输出、结构、参数、风险和结果证据。</p>
        </div>
        <span className="premium-lesson-badge">{selectedAnnotationIds.length} 项证据</span>
      </div>
      <div
        className="relative min-h-[420px] overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)] md:aspect-video md:min-h-0"
        data-annotated-media-canvas="normalized"
      >
        <Image src={graph.media.src} alt={graph.media.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-platform-surface-muted/35" data-annotated-media-mask="visible" />
        {graph.annotations.map((annotation) => {
          const visible = visibleAnnotations.has(annotation.id);
          return (
            <button
              key={annotation.id}
              type="button"
              className={[
                'absolute rounded-xl border px-2 py-1 text-left text-xs font-semibold shadow-[var(--platform-shadow-xs)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
                selectedSet.has(annotation.id) ? 'border-platform-action-primary bg-platform-action-primary text-accent-foreground' : 'border-platform-border bg-platform-panel/90 text-[var(--platform-text-primary)]',
                visible ? 'opacity-100' : 'opacity-45',
              ].join(' ')}
              style={{
                left: `${annotation.region.x * 100}%`,
                top: `${annotation.region.y * 100}%`,
                width: `${annotation.region.width * 100}%`,
                minHeight: `${annotation.region.height * 100}%`,
              }}
              data-annotated-media-annotation-id={annotation.id}
              data-annotated-media-evidence-role={annotation.evidenceRole}
              data-annotated-media-selected={selectedSet.has(annotation.id) ? 'true' : 'false'}
              data-annotated-media-required={annotation.required ? 'true' : 'false'}
              aria-pressed={selectedSet.has(annotation.id)}
              disabled={!canInteract}
              onClick={() => toggleAnnotation(annotation.id)}
            >
              <span className="block">{annotation.label}</span>
              {annotation.body ? <span className="block text-[11px] font-normal opacity-85">{annotation.body}</span> : null}
            </button>
          );
        })}
        {embeddedActivity ? (
          <div
            className="absolute max-w-[44%] rounded-xl border border-platform-action-primary bg-platform-panel/95 px-3 py-2 text-xs font-semibold text-[var(--platform-text-primary)] shadow-[var(--platform-shadow-xs)]"
            style={{
              left: `${embeddedActivity.position.x * 100}%`,
              top: `${embeddedActivity.position.y * 100}%`,
            }}
            data-annotated-media-activity-anchor={embeddedActivity.anchorId}
            data-annotated-media-activity-id={embeddedActivity.activityId}
          >
            {embeddedActivity.prompt}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-3" data-annotated-media-reveal-plan="visible">
        {graph.revealPlan.map((item) => (
          <div key={item.id} className="premium-lesson-card" data-annotated-media-reveal-id={item.id}>
            <p className="premium-lesson-caption">{item.id}</p>
            <p className="premium-lesson-title text-sm">{item.label}</p>
          </div>
        ))}
      </div>
      {graph.activeRevealState === 'answer-reveal' ? (
        <div className="premium-lesson-card border-platform-action-primary" data-annotated-media-answer-reveal="visible">
          <p className="premium-lesson-caption">答案显影</p>
          <p className="premium-lesson-body text-sm">
            {graph.annotations
              .filter((annotation) => annotation.required)
              .map((annotation) => annotation.label)
              .join('、')}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        className="premium-lesson-action-tone premium-tone-cyan justify-self-start"
        data-annotated-media-submit={graph.mediaId}
        onClick={submitCurrent}
        disabled={!canInteract}
      >
        提交图上证据
      </button>
    </section>
  );
}

function EmbeddedActivityPanel({ manifest, step, module, onPanelSubmit, interactionMode = 'active', annotatedMediaSharedState }: StructureDiagramPanelProps) {
  const activity = embeddedActivityPayload(module);
  const graphModule = annotatedMediaModuleForEmbeddedActivity(step, activity);
  const graph = graphModule ? annotatedMediaPayload(graphModule) : null;
  const sharedState = annotatedMediaStateFor(
    annotatedMediaSharedState,
    activity.visualModuleId,
    graph?.initialSelectedAnnotationIds ?? [],
    activity.answerOptions[0]?.id ?? null,
  );
  const canInteract = Boolean(onPanelSubmit && graphModule && graph) && interactionMode === 'active';
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(sharedState.selectedAnswerId);
  const submitCurrent = () => {
    if (!canInteract || !onPanelSubmit || !graphModule || !graph) return;
    const { draft, submittedAt } = buildAnnotatedMediaSubmissionDraft({
      manifest,
      step,
      module,
      graph,
      activity,
      selectedAnnotationIds: sharedState.selectedAnnotationIds,
      selectedAnswerId,
      eventType: 'activity_answer',
    });
    onPanelSubmit({
      stepId: step.id,
      submittedAt,
      answers: {
        annotatedMediaEvidenceDraft: JSON.stringify(draft),
        [module.id]: JSON.stringify(draft),
      },
    });
  };

  return (
    <section
      className="premium-lesson-panel grid gap-4"
      data-embedded-activity-kind="visual.embedded-activity"
      data-embedded-activity-id={activity.activityId}
      data-embedded-activity-anchor={activity.anchorId}
      data-embedded-activity-response-contract={activity.responseContractId}
    >
      <div>
        <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
        <p className="premium-lesson-muted text-sm leading-6">{activity.prompt}</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3" data-embedded-activity-options="visible" role="radiogroup" aria-label={activity.prompt}>
        {activity.answerOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            className={[
              'premium-lesson-card text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
              selectedAnswerId === option.id ? 'border-platform-action-primary bg-platform-action-primary/10' : '',
            ].join(' ')}
            data-embedded-activity-option-id={option.id}
            data-embedded-activity-option-selected={selectedAnswerId === option.id ? 'true' : 'false'}
            aria-checked={selectedAnswerId === option.id}
            disabled={!canInteract}
            onClick={() => {
              if (!canInteract) return;
              sharedState.selectedAnswerId = option.id;
              setSelectedAnswerId(option.id);
            }}
          >
            <span className="premium-lesson-title text-sm">{option.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="premium-lesson-action-tone premium-tone-cyan justify-self-start"
        data-embedded-activity-submit={activity.activityId}
        onClick={submitCurrent}
        disabled={!canInteract}
      >
        提交图上任务
      </button>
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
  interactionMode?: 'active' | 'readonly';
}): InteractiveModuleRegistry<typeof extra> {
  const annotatedMediaSharedState: AnnotatedMediaSharedStateStore = new Map();
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
    'visual.blockDiagram': ({ manifest, step, module }) => <BlockDiagramPanel manifest={manifest} step={step} module={module} onPanelSubmit={extra.onPanelSubmit} />,
    'visual.signalFlowGraph': ({ manifest, step, module }) => <SignalFlowGraphPanel manifest={manifest} step={step} module={module} onPanelSubmit={extra.onPanelSubmit} />,
    'visual.annotatedMedia': ({ manifest, step, module }) => <AnnotatedMediaPanel manifest={manifest} step={step} module={module} onPanelSubmit={extra.onPanelSubmit} interactionMode={extra.interactionMode} annotatedMediaSharedState={annotatedMediaSharedState} />,
    'visual.embedded-activity': ({ manifest, step, module }) => <EmbeddedActivityPanel manifest={manifest} step={step} module={module} onPanelSubmit={extra.onPanelSubmit} interactionMode={extra.interactionMode} annotatedMediaSharedState={annotatedMediaSharedState} />,
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

function controlWorkbenchSubmissionFieldsFromPayload(payload: ContentRecord): ControlWorkbenchSubmissionField[] {
  const fields = payload.submissionFields ?? payload.submission_fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .map((item): ControlWorkbenchSubmissionField | null => {
      const record = asRecord(item);
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : key;
      if (!key || !label) return null;
      const input = typeof record.input === 'string' ? record.input : typeof record.type === 'string' ? record.type : 'text';
      const normalizedInput = ['text', 'number', 'slider', 'select', 'toggle'].includes(input) ? input as ControlWorkbenchSubmissionField['input'] : 'text';
      return {
        key,
        label,
        input: normalizedInput,
        min: Number.isFinite(Number(record.min)) ? Number(record.min) : undefined,
        max: Number.isFinite(Number(record.max)) ? Number(record.max) : undefined,
        step: Number.isFinite(Number(record.step)) ? Number(record.step) : undefined,
        options: stringArrayField(record, ['options']),
        defaultValue: scalarSubmissionValue(record.defaultValue ?? record.default_value),
      };
    })
    .filter((item): item is ControlWorkbenchSubmissionField => Boolean(item));
}

function scalarSubmissionValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function submissionDefaultsFromPayload(payload: ContentRecord) {
  return asRecord(payload.submissionDefaults ?? payload.submission_defaults ?? payload.defaultSubmission ?? payload.default_submission);
}

function initialControlWorkbenchSubmissionValues(
  payload: ContentRecord,
  request: ControlAnalysisRequest | undefined,
): Record<string, string | number | boolean> {
  const fields = controlWorkbenchSubmissionFieldsFromPayload(payload);
  const defaults = submissionDefaultsFromPayload(payload);
  if (fields.length === 0) {
    return parameterSnapshotFromRequest(request) as Record<string, string | number | boolean>;
  }
  return Object.fromEntries(fields.map((field) => {
    const direct = scalarSubmissionValue(defaults[field.key]);
    if (direct !== undefined) return [field.key, direct];
    if (field.defaultValue !== undefined) return [field.key, field.defaultValue];
    if (field.input === 'slider' || field.input === 'number') return [field.key, field.min ?? 0];
    if ((field.input === 'select' || field.input === 'toggle') && field.options?.[0]) return [field.key, field.options[0]];
    return [field.key, ''];
  }));
}

function parameterSnapshotFromSubmissionValues(
  payload: ContentRecord,
  request: ControlAnalysisRequest | undefined,
  values?: Record<string, string | number | boolean>,
) {
  const fields = controlWorkbenchSubmissionFieldsFromPayload(payload);
  if (fields.length === 0) return parameterSnapshotFromRequest(request);
  const currentValues = values ?? initialControlWorkbenchSubmissionValues(payload, request);
  return Object.fromEntries(
    fields
      .map((field) => [field.key, currentValues[field.key]] as const)
      .filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function buildSharedControlWorkbenchEvidenceDraft({
  manifest,
  step,
  module,
  submittedAt,
  submissionValues,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  submittedAt: number;
  submissionValues?: Record<string, string | number | boolean>;
}) {
  const capabilityRef = computeCapabilityRef(module.payload);
  if (!capabilityRef) return null;
  const visiblePanelIds = stringArrayField(module.payload, ['visiblePanelIds', 'visible_panel_ids', 'panels']);
  const responseContractId = stringField(module.payload, ['responseContractId', 'response_contract_id', 'responseKind', 'response_kind']);
  const releaseState = stringField(module.payload, ['releaseState', 'release_state']) || 'course-controlled';
  const fallbackState = stringField(module.payload, ['fallbackState', 'fallback_state']) || 'supported';
  const request = controlAnalysisRequestFromPayload(module.payload);
  return buildControlWorkbenchClientEvidenceDraft({
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
    parameterSnapshot: parameterSnapshotFromSubmissionValues(module.payload, request, submissionValues),
    selectedDesignState: { releaseState, fallbackState },
    answerPayload: {
      responseContractId: responseContractId ?? 'parameter.set',
      submissionFieldKeys: controlWorkbenchSubmissionFieldsFromPayload(module.payload).map((field) => field.key),
    },
    releaseState: releaseState === 'released' || releaseState === 'revealed' ? releaseState : 'released',
    fallbackState: fallbackState === 'fallback' || fallbackState === 'unsupported' ? fallbackState : 'supported',
  });
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
