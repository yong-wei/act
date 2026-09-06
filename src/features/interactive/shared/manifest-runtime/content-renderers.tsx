'use client';

import Image from 'next/image';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type {
  InteractiveModuleRegistry,
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';
import { buildAnnotatedMediaClientEvidenceDraft } from './annotated-media-evidence';
import { buildStructureDiagramClientEvidenceDraft } from './structure-diagram-evidence';
import { computeCapabilityRef } from './compute-capability-ref';
import {
  asRecord,
  blockByKey,
  blockByModuleId,
  blockFor,
  numericArray,
  runtimeMediaPath,
  stringField,
  titleFromModule,
} from './manifest-payload-fields';
import { composeManifestPluginRegistry, type ManifestPluginRegistry } from './plugins/plugin-contract';
import { staticSurface3DPluginSet } from './plugins/static-surface-3d-module';
import { controlWorkbenchPluginSet } from './plugins/control-workbench-module';
import { interactiveFigurePluginSet } from './plugins/interactive-figure-module';

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
type VisualStageAspectRatio = '16:9' | '4:3' | 'fluid';
type VisualStageLayerKind = 'diagram' | 'formula' | 'annotation' | 'media' | 'activity' | 'control';
type VisualStageLayerAppearance = 'card' | 'flowNode' | 'note' | 'objective';
type VisualStageAnchor = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';
type VisualStageRegion = { x: number; y: number; width: number; height: number };
type VisualStageLayer = {
  id: string;
  kind: VisualStageLayerKind;
  appearance: VisualStageLayerAppearance;
  title: string;
  body: string;
  region: VisualStageRegion;
  zIndex: number;
  revealState?: string;
  activityAnchor?: string;
};
type VisualStageConnection = {
  id: string;
  from: string;
  to: string;
  fromAnchor: VisualStageAnchor;
  toAnchor: VisualStageAnchor;
  revealState?: string;
};
type VisualStagePayload = {
  stageId: string;
  aspectRatio: VisualStageAspectRatio;
  releaseState: string;
  activeRevealState: string;
  layers: VisualStageLayer[];
  connections: VisualStageConnection[];
};
type DerivationFormulaBlockColorRole = 'known' | 'transform' | 'cancel' | 'target' | 'risk' | 'result';
type DerivationStageRegion = VisualStageRegion;
type DerivationFormulaBlock = {
  id: string;
  latex: string;
  title: string;
  region?: DerivationStageRegion;
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
  fromAnchor: VisualStageAnchor;
  toAnchor: VisualStageAnchor;
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
  subtitle?: string;
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
const STRUCTURE_DIAGRAM_DEFAULT_SPACING_X = 0.24;
const STRUCTURE_DIAGRAM_DEFAULT_SPACING_Y = 0.14;
const STRUCTURE_DIAGRAM_DEFAULT_BLOCK_WIDTH = 0.12;
const STRUCTURE_DIAGRAM_DEFAULT_BLOCK_HEIGHT = 0.1;
const STRUCTURE_DIAGRAM_DEFAULT_NODE_WIDTH = 0.07;
const STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS = 'text-[19.5px]';
const STRUCTURE_DIAGRAM_SIGNAL_STROKE = 1.6;
const STRUCTURE_DIAGRAM_SIGNAL_HALO_STROKE = 3.2;
const STRUCTURE_DIAGRAM_SIGNAL_SELECTED_HALO_STROKE = 4;
const STRUCTURE_DIAGRAM_ARROWHEAD_WIDTH = 13.5;
const STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT = 9;
const STRUCTURE_DIAGRAM_ARROWHEAD_PATH = `M0,0 L${STRUCTURE_DIAGRAM_ARROWHEAD_WIDTH},${STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT / 2} L0,${STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT} z`;
const STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y = 5;
const SIGNAL_FLOW_NODE_SIZE_PX = 12;
const SIGNAL_FLOW_NODE_HIT_SIZE_PX = 28;
const SIGNAL_FLOW_BRANCH_LABEL_OFFSET = 4;
const SIGNAL_FLOW_AUTO_BEZIER_MIN_CURVE = 0.045;
const SIGNAL_FLOW_AUTO_BEZIER_MAX_CURVE = 0.12;
const SIGNAL_FLOW_AUTO_BEZIER_CURVE_FACTOR = 0.24;
const STRUCTURE_DIAGRAM_REFERENCE_CANVAS_HEIGHT_PX = 420;
const STRUCTURE_DIAGRAM_TRIMMED_CANVAS_HEIGHT_PX = 340;
const STRUCTURE_DIAGRAM_CANVAS_CLASS =
  'relative min-h-[300px] overflow-hidden bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)] md:h-[340px] md:min-h-0';
const BLOCK_DIAGRAM_Y_TARGET_SPAN = 0.66;
const BLOCK_DIAGRAM_Y_TARGET_CENTER = 0.46;
const SIGNAL_FLOW_Y_TARGET_SPAN = 0.7;
const SIGNAL_FLOW_Y_TARGET_CENTER = 0.42;
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
  terminalSign: string;
  fromPort: string;
  toPort: string;
  waypoints: StructureDiagramPoint[];
  route: string;
  label: string;
  labelPlacement: string;
};
type BlockDiagramPayload = {
  graphId: string;
  layout: StructureDiagramLayout;
  mode: string;
  activeRevealState: string;
  nodes: readonly BlockDiagramNode[];
  edges: readonly BlockDiagramEdge[];
  revealPlan: ReadonlyArray<{ id: string; targetIds: string[]; label: string }>;
};
type BlockDiagramCanvasMetrics = {
  width: number;
  height: number;
  sumSizePx: number;
};
type SignalFlowNode = {
  id: string;
  labelLatex: string;
  labelPosition: string;
  position: StructureDiagramPoint;
};
type SignalFlowBranch = {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
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
  showPathSets: boolean;
  showMasonMap: boolean;
  nodes: readonly SignalFlowNode[];
  branches: readonly SignalFlowBranch[];
  forwardPaths: readonly SignalFlowPathSet[];
  loops: readonly SignalFlowPathSet[];
  nonTouchingLoopGroups: readonly SignalFlowLoopGroup[];
  revealPlan: ReadonlyArray<{ id: string; targetIds: string[]; emphasis: string; label: string }>;
  masonTerms: ReadonlyArray<{ id: string; latex: string; relatedIds: string[] }>;
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
  media: { src: string; alt: string; aspectRatio: string };
  instruction: string;
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

  return <p className="interactive-courseware-body">{renderInlineContent(value)}</p>;
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
      x: numberInRange(spacing.x ?? spacing.horizontal, STRUCTURE_DIAGRAM_DEFAULT_SPACING_X, 0.02, 0.5),
      y: numberInRange(spacing.y ?? spacing.vertical, STRUCTURE_DIAGRAM_DEFAULT_SPACING_Y, 0.02, 0.5),
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
    const nodeType = String(node.type ?? '').trim();
    const nodeDisplay = String(node.display ?? node.renderAs ?? node.render_as ?? '').trim();
    const defaultDistance = nodeType === 'branch' && nodeDisplay === 'takeoff' ? 0.5 : 1;
    const distance = relativeDistance(node.distance ?? node.gap ?? defaultDistance);
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

function booleanFromFields(source: ContentRecord, fields: string[], fallback = false) {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
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

function visualStageLayerAppearance(value: unknown): VisualStageLayerAppearance {
  return ['card', 'flowNode', 'note', 'objective'].includes(String(value))
    ? String(value) as VisualStageLayerAppearance
    : 'card';
}

function visualStageAnchor(value: unknown, fallback: VisualStageAnchor): VisualStageAnchor {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'C'].includes(String(value))
    ? String(value) as VisualStageAnchor
    : fallback;
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
        appearance: visualStageLayerAppearance(layer.appearance ?? layer.variant),
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

function visualStageConnections(value: unknown): VisualStageConnection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): VisualStageConnection | null => {
      const connection = asRecord(item);
      const id = String(connection.id ?? '').trim();
      const from = String(connection.from ?? connection.fromId ?? connection.from_id ?? '').trim();
      const to = String(connection.to ?? connection.toId ?? connection.to_id ?? '').trim();
      if (!id || !from || !to) return null;
      return {
        id,
        from,
        to,
        fromAnchor: visualStageAnchor(connection.fromAnchor ?? connection.from_anchor, 'S'),
        toAnchor: visualStageAnchor(connection.toAnchor ?? connection.to_anchor, 'N'),
        revealState: visualStageOptionalString(connection.revealState ?? connection.reveal_state),
      };
    })
    .filter((item): item is VisualStageConnection => Boolean(item));
}

function visualStagePayload(module: InteractiveRuntimeModuleManifest): VisualStagePayload {
  const payload = module.payload;
  return {
    stageId: String(payload.stageId ?? payload.stage_id ?? module.id),
    aspectRatio: visualStageAspectRatio(payload.aspectRatio ?? payload.aspect_ratio),
    releaseState: visualStageString(payload.releaseState ?? payload.release_state, 'released'),
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    layers: visualStageLayers(payload.layers),
    connections: visualStageConnections(payload.connections ?? payload.edges),
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
        region: block.region ? visualStageRegion(block.region) : undefined,
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
        fromAnchor: visualStageAnchor(connector.fromAnchor ?? connector.from_anchor, 'E'),
        toAnchor: visualStageAnchor(connector.toAnchor ?? connector.to_anchor, 'W'),
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
    subtitle: visualStageOptionalString(payload.subtitle ?? payload.lead ?? payload.description),
    formulas: derivationFormulas(payload.formulas),
    textBlocks: derivationTextBlocks(payload.textBlocks ?? payload.text_blocks),
    connectors: derivationConnectors(payload.connectors),
    revealSteps,
    teacherControls,
    answerVisible: Boolean(payload.answerVisible ?? payload.answer_visible),
  };
}

function derivationStageReleaseLabel(releaseState: string, fallback?: string) {
  if (releaseState === 'unavailable') return '当前推导暂不可用。';
  if (releaseState === 'unreleased') return '等待教师发放后查看推导。';
  if (releaseState === 'revealed') return '教师已展开当前推导位置。';
  return fallback ?? '按显影步骤观察公式、说明和关联线。';
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
      entries.set(block.id, block.region ?? {
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

function derivationConnectorEndpoint(
  region: DerivationStageRegion | undefined,
  anchor: VisualStageAnchor,
  fallback: { x: number; y: number },
) {
  if (!region) return fallback;
  const { x, y, width, height } = region;
  const anchorPoints: Record<VisualStageAnchor, { x: number; y: number }> = {
    N: { x: x + width / 2, y },
    NE: { x: x + width, y },
    E: { x: x + width, y: y + height / 2 },
    SE: { x: x + width, y: y + height },
    S: { x: x + width / 2, y: y + height },
    SW: { x, y: y + height },
    W: { x, y: y + height / 2 },
    NW: { x, y },
    C: { x: x + width / 2, y: y + height / 2 },
  };
  const point = anchorPoints[anchor];
  return {
    x: point.x * 100,
    y: point.y * 100,
  };
}

function derivationFixedArrowStyle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  metrics: { width: number; height: number } | undefined,
): CSSProperties {
  if (!metrics) {
    return {
      left: `${from.x}%`,
      top: `${from.y}%`,
      width: '0px',
      height: '1.5em',
      visibility: 'hidden',
    };
  }
  const startX = (from.x / 100) * metrics.width;
  const startY = (from.y / 100) * metrics.height;
  const endX = (to.x / 100) * metrics.width;
  const endY = (to.y / 100) * metrics.height;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.max(Math.hypot(dx, dy), 24);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return {
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${length}px`,
    height: '1.5em',
    transform: `translateY(-50%) rotate(${angle}deg)`,
    transformOrigin: '0 50%',
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
      const isBlockLike = type === 'block' || type === 'sensor';
      const result = {
        id,
        type,
        display: stringFromFields(node, ['display', 'renderAs', 'render_as']),
        label: stringFromFields(node, ['labelLatex', 'label_latex', 'label', 'title'], `节点 ${index + 1}`),
        position: relativeNodePosition(node, resolved, layout, index),
        size: {
          width: numberInRange(size.width, isBlockLike ? STRUCTURE_DIAGRAM_DEFAULT_BLOCK_WIDTH : STRUCTURE_DIAGRAM_DEFAULT_NODE_WIDTH, 0.03, 0.4),
          height: numberInRange(size.height, isBlockLike ? STRUCTURE_DIAGRAM_DEFAULT_BLOCK_HEIGHT : STRUCTURE_DIAGRAM_DEFAULT_NODE_WIDTH, 0.03, 0.25),
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
        terminalSign: normalizeTerminalSign(stringFromFields(edge, ['terminalSign', 'terminal_sign', 'inputSign', 'input_sign'])),
        fromPort: fromRef.port,
        toPort: toRef.port,
        waypoints,
        route: stringFromFields(edge, ['route', 'path'], '--'),
        label: stringFromFields(edge, ['labelLatex', 'label_latex', 'label']),
        labelPlacement: stringFromFields(edge, ['labelPlacement', 'label_placement', 'labelPosition', 'label_position']),
      };
    })
    .filter((item): item is BlockDiagramEdge => Boolean(item));
}

function normalizeTerminalSign(value: string) {
  if (value === '-') return '−';
  return value;
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
  const nodes = centerSignalFlowNodes(signalFlowNodes(payload.nodes, layout));
  return {
    graphId: String(payload.graphId ?? payload.graph_id ?? module.id),
    layout,
    mode: visualStageString(interaction.mode ?? payload.mode, 'read'),
    activeRevealState: visualStageString(payload.activeRevealState ?? payload.active_reveal_state, 'all'),
    showPathSets: booleanFromFields(payload, ['showPathSets', 'show_path_sets'], true),
    showMasonMap: booleanFromFields(payload, ['showMasonMap', 'show_mason_map'], true),
    nodes,
    branches: signalFlowBranches(payload.branches),
    forwardPaths: signalFlowPathSets(pathSets.forwardPaths ?? pathSets.forward_paths, 'forward-path', '前向路径'),
    loops: signalFlowPathSets(pathSets.loops, 'feedback-loop', '反馈环路'),
    nonTouchingLoopGroups: signalFlowLoopGroups(pathSets.nonTouchingLoopGroups ?? pathSets.non_touching_loop_groups),
    revealPlan: signalFlowRevealPlan(payload.revealPlan ?? payload.reveal_plan),
    masonTerms: masonTerms(payload.masonTerms ?? payload.mason_terms),
  };
}

function centerSignalFlowNodes(nodes: SignalFlowNode[]) {
  if (!nodes.length) return nodes;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const maxX = Math.max(...nodes.map((node) => node.position.x));
  const shiftX = 0.5 - (minX + maxX) / 2;
  if (Math.abs(shiftX) < 0.001) return nodes;
  return nodes.map((node) => ({
    ...node,
    position: {
      ...node.position,
      x: clamp(node.position.x + shiftX, 0.08, 0.92),
    },
  }));
}

function compactStructureDiagramNodeY<T extends { position: StructureDiagramPoint }>(
  nodes: readonly T[],
  targetSpan = 0.34,
  targetCenter = 0.5,
) {
  if (nodes.length < 2) return nodes;
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxY = Math.max(...nodes.map((node) => node.position.y));
  const span = maxY - minY;
  if (span < 0.02 || span >= targetSpan) return nodes;
  const scale = Math.min(targetSpan / span, 4);
  const sourceCenter = (minY + maxY) / 2;
  return nodes.map((node) => ({
    ...node,
    position: {
      ...node.position,
      y: clamp(targetCenter + (node.position.y - sourceCenter) * scale, 0.12, 0.88),
    },
  }));
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
        labelPosition: stringFromFields(node, ['labelPosition', 'label_position'], 'below') === 'above' ? 'above' : 'below',
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
      const fromRef = blockEndpointRef(branch.from ?? branch.fromId ?? branch.from_id, branch.fromPort ?? branch.from_port);
      const toRef = blockEndpointRef(branch.to ?? branch.toId ?? branch.to_id, branch.toPort ?? branch.to_port);
      const from = fromRef.nodeId;
      const to = toRef.nodeId;
      if (!id || !from || !to) return null;
      return {
        id,
        from,
        to,
        fromPort: fromRef.port,
        toPort: toRef.port,
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
      aspectRatio: stringFromFields(media, ['aspectRatio', 'aspect_ratio'], stringFromFields(payload, ['aspectRatio', 'aspect_ratio'], '16 / 9')),
    },
    instruction: stringFromFields(payload, ['instruction', 'task', 'prompt'], '在图中选择能支持当前判断的证据。'),
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

function visibleStructureTargets(activeRevealState: string, revealPlan: ReadonlyArray<{ id: string; targetIds: string[] }>) {
  if (activeRevealState === 'all' || revealPlan.length === 0) return new Set<string>();
  const activeIndex = revealPlan.findIndex((item) => item.id === activeRevealState);
  const visible = activeIndex >= 0 ? revealPlan.slice(0, activeIndex + 1) : revealPlan.slice(0, 1);
  return new Set(visible.flatMap((item) => item.targetIds));
}

function selectedStructureTargets(
  selectedTargetId: string | null,
  revealPlan: ReadonlyArray<{ id: string; targetIds: string[] }>,
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

function blockDiagramNodeSizeForCanvas(node: BlockDiagramNode, metrics?: BlockDiagramCanvasMetrics) {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind !== 'block') return node.size;
  const canvasHeight = metrics?.height && metrics.height > 0 ? metrics.height : STRUCTURE_DIAGRAM_TRIMMED_CANVAS_HEIGHT_PX;
  const heightScale = STRUCTURE_DIAGRAM_REFERENCE_CANVAS_HEIGHT_PX / canvasHeight;
  return {
    ...node.size,
    height: clamp(node.size.height * heightScale, node.size.height, 0.25),
  };
}

function blockDiagramSumPortRadius(node: BlockDiagramNode, metrics?: BlockDiagramCanvasMetrics): StructureDiagramPoint {
  if (metrics && metrics.width > 0 && metrics.height > 0) {
    return {
      x: (metrics.sumSizePx / 2) / metrics.width,
      y: (metrics.sumSizePx / 2) / metrics.height,
    };
  }
  const radius = Math.min(node.size.width, node.size.height) / 2;
  return { x: radius, y: radius };
}

function blockDiagramNodePortPoint(node: BlockDiagramNode, port: string, metrics?: BlockDiagramCanvasMetrics): StructureDiagramPoint {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind === 'branch' || visualKind === 'takeoff') return node.position;
  const renderedSize = blockDiagramNodeSizeForCanvas(node, metrics);
  const halfWidth = renderedSize.width / 2;
  const halfHeight = renderedSize.height / 2;
  if (visualKind === 'sum') {
    const radius = blockDiagramSumPortRadius(node, metrics);
    const diagonal = { x: radius.x / Math.SQRT2, y: radius.y / Math.SQRT2 };
    if (port === 'left') return { x: node.position.x - radius.x, y: node.position.y };
    if (port === 'right') return { x: node.position.x + radius.x, y: node.position.y };
    if (port === 'top') return { x: node.position.x, y: node.position.y - radius.y };
    if (port === 'bottom') return { x: node.position.x, y: node.position.y + radius.y };
    if (port === 'top-right') return { x: node.position.x + diagonal.x, y: node.position.y - diagonal.y };
    if (port === 'bottom-right') return { x: node.position.x + diagonal.x, y: node.position.y + diagonal.y };
    if (port === 'bottom-left') return { x: node.position.x - diagonal.x, y: node.position.y + diagonal.y };
    if (port === 'top-left') return { x: node.position.x - diagonal.x, y: node.position.y - diagonal.y };
    return node.position;
  }
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

function blockEdgeEndpoints(nodes: readonly BlockDiagramNode[], edge: BlockDiagramEdge, metrics?: BlockDiagramCanvasMetrics) {
  const fromNode = structureNodeForId(nodes, edge.from);
  const toNode = structureNodeForId(nodes, edge.to);
  const fromCenter = fromNode?.position ?? structurePointForId(nodes, edge.from);
  const toCenter = toNode?.position ?? structurePointForId(nodes, edge.to);
  const firstTarget = edge.waypoints[0] ?? toCenter;
  const lastSource = edge.waypoints[edge.waypoints.length - 1] ?? fromCenter;
  const fromPort = edge.fromPort || (fromNode ? blockDiagramAutoPort(fromNode, firstTarget) : 'center');
  const toPort = edge.toPort || (toNode ? blockDiagramAutoPort(toNode, lastSource) : 'center');
  return {
    from: fromNode ? blockDiagramNodePortPoint(fromNode, fromPort, metrics) : fromCenter,
    to: toNode ? blockDiagramNodePortPoint(toNode, toPort, metrics) : toCenter,
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

function structureArrowheadFromSegment(
  from: StructureDiagramPoint,
  to: StructureDiagramPoint,
  metrics?: BlockDiagramCanvasMetrics,
) {
  const width = metrics?.width ?? 100;
  const height = metrics?.height ?? 100;
  const dx = (to.x - from.x) * width;
  const dy = (to.y - from.y) * height;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return {
    x: to.x * 100,
    y: to.y * 100,
    angle: Number(angle.toFixed(2)),
  };
}

function structureArrowhead(points: readonly StructureDiagramPoint[], metrics?: BlockDiagramCanvasMetrics) {
  const to = points[points.length - 1] ?? { x: 0.5, y: 0.5 };
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const from = points[index];
    if (Math.hypot(to.x - from.x, to.y - from.y) > 0.001) {
      return structureArrowheadFromSegment(from, to, metrics);
    }
  }
  return structureArrowheadFromSegment({ x: to.x - 0.01, y: to.y }, to, metrics);
}

function blockEdgePath(nodes: readonly BlockDiagramNode[], edge: BlockDiagramEdge, metrics?: BlockDiagramCanvasMetrics) {
  const { from, to } = blockEdgeEndpoints(nodes, edge, metrics);
  if (edge.waypoints.length > 0) {
    const points = [from, ...edge.waypoints, to];
    const longestSegment = points.slice(1).reduce((best, point, index) => {
      const previous = points[index];
      const length = Math.hypot(point.x - previous.x, point.y - previous.y);
      return length > best.length ? { from: previous, to: point, length } : best;
    }, { from: points[0], to: points[1] ?? points[0], length: -1 });
    return {
      d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${structureSvgPoint(point)}`).join(' '),
      arrow: structureArrowhead(points, metrics),
      label: {
        x: ((longestSegment.from.x + longestSegment.to.x) / 2) * 100,
        y: ((longestSegment.from.y + longestSegment.to.y) / 2) * 100 - STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y,
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
      arrow: structureArrowhead(points, metrics),
      label: {
        x: ((longestSegment.from.x + longestSegment.to.x) / 2) * 100,
        y: ((longestSegment.from.y + longestSegment.to.y) / 2) * 100 - STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y,
      },
    };
  }
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx > 0.03 && dy > 0.1) {
    const midY = Math.max(from.y, to.y) + 0.08;
    return {
      d: `M ${structureSvgPoint(from)} L ${structureSvgValue(from.x * 100)} ${structureSvgValue(midY * 100)} L ${structureSvgValue(to.x * 100)} ${structureSvgValue(midY * 100)} L ${structureSvgPoint(to)}`,
      arrow: structureArrowhead([from, { x: from.x, y: midY }, { x: to.x, y: midY }, to], metrics),
      label: { x: ((from.x + to.x) / 2) * 100, y: (midY * 100) - STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y },
    };
  }
  return {
    d: `M ${structureSvgPoint(from)} L ${structureSvgPoint(to)}`,
    arrow: structureArrowhead([from, to], metrics),
    label: { x: ((from.x + to.x) / 2) * 100, y: ((from.y + to.y) / 2) * 100 - STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y },
  };
}

function blockEdgeLabelPosition(
  nodes: readonly BlockDiagramNode[],
  edge: BlockDiagramEdge,
  fallback: StructureDiagramPoint,
  metrics?: BlockDiagramCanvasMetrics,
) {
  const fromNode = structureNodeForId(nodes, edge.from);
  if (edge.labelPlacement === 'source-left' && fromNode) {
    const size = blockDiagramNodeSizeForCanvas(fromNode, metrics);
    return {
      x: clamp((fromNode.position.x - size.width / 2) * 100 - 5, 0, 100),
      y: clamp(fromNode.position.y * 100 - STRUCTURE_DIAGRAM_EDGE_LABEL_OFFSET_Y, 0, 100),
    };
  }
  return fallback;
}

function blockEdgeTerminalSignPosition(nodes: readonly BlockDiagramNode[], edge: BlockDiagramEdge, metrics?: BlockDiagramCanvasMetrics) {
  const { to, toPort } = blockEdgeEndpoints(nodes, edge, metrics);
  const offsets: Record<string, StructureDiagramPoint> = {
    left: { x: -3.2, y: -2.8 },
    right: { x: 2.5, y: -2.8 },
    top: { x: 1.8, y: -3.8 },
    bottom: { x: 1.8, y: 4.2 },
    'top-left': { x: -3.2, y: -3.8 },
    'top-right': { x: 2.5, y: -3.8 },
    'bottom-right': { x: 2.5, y: 4.2 },
    'bottom-left': { x: -3.2, y: 4.2 },
    center: { x: 1.8, y: 4.2 },
  };
  const offset = offsets[toPort] ?? offsets.center;
  return {
    x: clamp(to.x * 100 + offset.x, 0, 100),
    y: clamp(to.y * 100 + offset.y, 0, 100),
  };
}

function blockNodeBounds(node: BlockDiagramNode, metrics?: BlockDiagramCanvasMetrics) {
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
  const renderedSize = blockDiagramNodeSizeForCanvas(node, metrics);
  return {
    left: `${(node.position.x - renderedSize.width / 2) * 100}%`,
    top: `${(node.position.y - renderedSize.height / 2) * 100}%`,
    width: `${renderedSize.width * 100}%`,
    height: `${renderedSize.height * 100}%`,
    transform: undefined,
  };
}

function blockDiagramSelectionColor() {
  return 'hsl(var(--platform-brand-evidence))';
}

function StructureDiagramArrowhead({
  id,
  x,
  y,
  angle,
  selected,
}: {
  id: string;
  x: number;
  y: number;
  angle: number;
  selected: boolean;
}) {
  return (
    <span
      className="pointer-events-none absolute z-[2] h-0 w-0"
      style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${angle}deg)` }}
      data-structure-diagram-arrowhead-id={id}
      data-structure-diagram-arrow-style="fixed-pixel"
      data-structure-diagram-arrow-state={selected ? 'selected' : 'default'}
      data-structure-diagram-arrow-angle={angle}
    >
      <svg
        className="absolute"
        width={STRUCTURE_DIAGRAM_ARROWHEAD_WIDTH}
        height={STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT}
        viewBox={`0 0 ${STRUCTURE_DIAGRAM_ARROWHEAD_WIDTH} ${STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT}`}
        aria-hidden="true"
        style={{
          left: -STRUCTURE_DIAGRAM_ARROWHEAD_WIDTH,
          top: -STRUCTURE_DIAGRAM_ARROWHEAD_HEIGHT / 2,
        }}
      >
        <path
          d={STRUCTURE_DIAGRAM_ARROWHEAD_PATH}
          fill={selected ? blockDiagramSelectionColor() : 'hsl(var(--platform-action-primary))'}
        />
      </svg>
    </span>
  );
}

function useBlockDiagramCanvasMetrics() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize((current) => {
        if (current && Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const metrics = size ? { width: size.width, height: size.height, sumSizePx: 34 } : undefined;
  return { ref, metrics };
}

function blockDiagramNodeAnchors(node: BlockDiagramNode) {
  const visualKind = blockDiagramNodeVisualKind(node);
  if (visualKind === 'sum') return 'N NE E SE S SW W NW C';
  if (visualKind === 'block') return 'N E S W';
  if (visualKind === 'takeoff') return 'C';
  return 'E W C';
}

function signalFlowNodePortRadius(metrics?: BlockDiagramCanvasMetrics): StructureDiagramPoint {
  if (metrics && metrics.width > 0 && metrics.height > 0) {
    return {
      x: (SIGNAL_FLOW_NODE_SIZE_PX / 2) / metrics.width,
      y: (SIGNAL_FLOW_NODE_SIZE_PX / 2) / metrics.height,
    };
  }
  return { x: 0.006, y: 0.011 };
}

function signalFlowNodePortPoint(node: SignalFlowNode, port: string, metrics?: BlockDiagramCanvasMetrics): StructureDiagramPoint {
  const radius = signalFlowNodePortRadius(metrics);
  const diagonal = { x: radius.x / Math.SQRT2, y: radius.y / Math.SQRT2 };
  if (port === 'left') return { x: node.position.x - radius.x, y: node.position.y };
  if (port === 'right') return { x: node.position.x + radius.x, y: node.position.y };
  if (port === 'top') return { x: node.position.x, y: node.position.y - radius.y };
  if (port === 'bottom') return { x: node.position.x, y: node.position.y + radius.y };
  if (port === 'top-right') return { x: node.position.x + diagonal.x, y: node.position.y - diagonal.y };
  if (port === 'bottom-right') return { x: node.position.x + diagonal.x, y: node.position.y + diagonal.y };
  if (port === 'bottom-left') return { x: node.position.x - diagonal.x, y: node.position.y + diagonal.y };
  if (port === 'top-left') return { x: node.position.x - diagonal.x, y: node.position.y - diagonal.y };
  return node.position;
}

function signalFlowAutoPorts(from: SignalFlowNode, to: SignalFlowNode, routeKind: string) {
  if (routeKind === 'straight') {
    return { fromPort: 'right', toPort: 'left' };
  }
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  if (Math.abs(dy) <= 0.03) {
    return dx < 0
      ? { fromPort: 'bottom-left', toPort: 'bottom-right' }
      : { fromPort: 'top-right', toPort: 'top-left' };
  }
  if (dy > 0) {
    return dx >= 0
      ? { fromPort: 'bottom-right', toPort: 'top-left' }
      : { fromPort: 'bottom-left', toPort: 'top-right' };
  }
  return dx >= 0
    ? { fromPort: 'top-right', toPort: 'bottom-left' }
    : { fromPort: 'top-left', toPort: 'bottom-right' };
}

function signalFlowBranchRouteKind(from: SignalFlowNode, to: SignalFlowNode, branch: SignalFlowBranch) {
  if (branch.route) return branch.route === 'straight' ? 'straight' : 'auto-bezier';
  return Math.abs(from.position.y - to.position.y) < 0.03 && to.position.x > from.position.x ? 'straight' : 'auto-bezier';
}

function signalFlowNodeForId(nodes: readonly SignalFlowNode[], id: string) {
  return nodes.find((node) => node.id === id);
}

function signalFlowBezierPoint(
  start: StructureDiagramPoint,
  control1: StructureDiagramPoint,
  control2: StructureDiagramPoint,
  end: StructureDiagramPoint,
  t: number,
) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * start.x + 3 * mt ** 2 * t * control1.x + 3 * mt * t ** 2 * control2.x + t ** 3 * end.x,
    y: mt ** 3 * start.y + 3 * mt ** 2 * t * control1.y + 3 * mt * t ** 2 * control2.y + t ** 3 * end.y,
  };
}

function signalBranchPath(nodes: readonly SignalFlowNode[], branch: SignalFlowBranch, metrics?: BlockDiagramCanvasMetrics) {
  const fromNode = signalFlowNodeForId(nodes, branch.from);
  const toNode = signalFlowNodeForId(nodes, branch.to);
  const fallbackFrom = structurePointForId(nodes, branch.from);
  const fallbackTo = structurePointForId(nodes, branch.to);
  const routeKind = fromNode && toNode ? signalFlowBranchRouteKind(fromNode, toNode, branch) : 'straight';
  const autoPorts = fromNode && toNode ? signalFlowAutoPorts(fromNode, toNode, routeKind) : { fromPort: 'right', toPort: 'left' };
  const fromPort = branch.fromPort || autoPorts.fromPort;
  const toPort = branch.toPort || autoPorts.toPort;
  const start = fromNode ? signalFlowNodePortPoint(fromNode, fromPort, metrics) : fallbackFrom;
  const end = toNode ? signalFlowNodePortPoint(toNode, toPort, metrics) : fallbackTo;
  if (routeKind === 'straight') {
    return {
      d: `M ${structureSvgPoint(start)} L ${structureSvgPoint(end)}`,
      arrow: structureArrowhead([start, end], metrics),
      label: { x: ((start.x + end.x) / 2) * 100, y: ((start.y + end.y) / 2) * 100 - SIGNAL_FLOW_BRANCH_LABEL_OFFSET },
      routeKind,
      fromPort,
      toPort,
    };
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const normalLength = Math.max(0.001, Math.hypot(dx, dy));
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const isLowerArc = fromPort.includes('bottom') || toPort.includes('bottom');
  const normalDirection = isLowerArc ? -1 : 1;
  const curveHeight = Math.min(
    SIGNAL_FLOW_AUTO_BEZIER_MAX_CURVE,
    Math.max(SIGNAL_FLOW_AUTO_BEZIER_MIN_CURVE, normalLength * SIGNAL_FLOW_AUTO_BEZIER_CURVE_FACTOR),
  );
  const controlPoint = {
    x: midpoint.x + (-dy / normalLength) * curveHeight * normalDirection,
    y: midpoint.y + (dx / normalLength) * curveHeight * normalDirection,
  };
  const control1 = controlPoint;
  const control2 = controlPoint;
  const labelPoint = signalFlowBezierPoint(start, control1, control2, end, 0.5);
  return {
    d: `M ${structureSvgPoint(start)} C ${structureSvgPoint(control1)}, ${structureSvgPoint(control2)}, ${structureSvgPoint(end)}`,
    arrow: structureArrowheadFromSegment(control2, end, metrics),
    label: { x: labelPoint.x * 100, y: labelPoint.y * 100 - SIGNAL_FLOW_BRANCH_LABEL_OFFSET },
    routeKind: 'auto-bezier',
    fromPort,
    toPort,
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
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void | Promise<void>;
  interactionMode?: 'active' | 'readonly';
  annotatedMediaSharedState?: AnnotatedMediaSharedStateStore;
};

function structurePointForId(nodes: readonly { id: string; position: StructureDiagramPoint }[], id: string) {
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
    <h2 className="interactive-courseware-title-level-2">
      {typeof children === 'string' ? renderInlineContent(children) : children}
    </h2>
  );
}

function ManifestSubsectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="interactive-courseware-title-level-3">
      {typeof children === 'string' ? renderInlineContent(children) : children}
    </h3>
  );
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
    <div className="mt-3 rounded-md border border-platform-border bg-platform-surface p-3 interactive-courseware-body">
      <h3 className="interactive-courseware-title-level-3">符号说明</h3>
      <dl className="mt-2 grid gap-2 md:grid-cols-2">
        {symbols.map((item) => (
          <div key={`${item.symbol}-${item.meaning}`} className="flex gap-2">
            <dt className="shrink-0">
              <InlineMath math={normalizeMath(item.symbol)} />
            </dt>
            {item.meaning ? <dd className="interactive-courseware-body">{renderInlineContent(item.meaning)}</dd> : null}
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
    <div className="interactive-courseware-section interactive-courseware-body">
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
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {symbols.length ? formulaBlock : noteBlock}
      {symbols.length ? <FormulaSymbolList symbols={symbols} /> : null}
      {symbols.length ? noteBlock : formulaBlock}
    </div>
  );
}

function visualStageLayerAnchorPoint(layer: VisualStageLayer, anchor: VisualStageAnchor) {
  const { x, y, width, height } = layer.region;
  const anchorPoints: Record<VisualStageAnchor, { x: number; y: number }> = {
    N: { x: x + width / 2, y },
    NE: { x: x + width, y },
    E: { x: x + width, y: y + height / 2 },
    SE: { x: x + width, y: y + height },
    S: { x: x + width / 2, y: y + height },
    SW: { x, y: y + height },
    W: { x, y: y + height / 2 },
    NW: { x, y },
    C: { x: x + width / 2, y: y + height / 2 },
  };
  return anchorPoints[anchor];
}

function visualStageConnectionLine(connection: VisualStageConnection, layersById: Map<string, VisualStageLayer>) {
  const fromLayer = layersById.get(connection.from);
  const toLayer = layersById.get(connection.to);
  if (!fromLayer || !toLayer) return null;
  const from = visualStageLayerAnchorPoint(fromLayer, connection.fromAnchor);
  const to = visualStageLayerAnchorPoint(toLayer, connection.toAnchor);
  return {
    x1: from.x * 100,
    y1: from.y * 100,
    x2: to.x * 100,
    y2: to.y * 100,
  };
}

function visualStageConnectionArrowAngle(
  line: NonNullable<ReturnType<typeof visualStageConnectionLine>>,
  aspectRatio: VisualStagePayload['aspectRatio'],
) {
  const ratio = aspectRatio === '4:3'
    ? { x: 4, y: 3 }
    : aspectRatio === '16:9'
      ? { x: 16, y: 9 }
      : { x: 1, y: 1 };
  return Math.atan2((line.y2 - line.y1) * ratio.y, (line.x2 - line.x1) * ratio.x) * 180 / Math.PI;
}

function VisualStagePanel({
  module,
}: {
  module: InteractiveRuntimeModuleManifest;
}) {
  const stage = visualStagePayload(module);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const visibleLayers = stage.layers.filter((layer) => (
    stage.releaseState !== 'unavailable'
    && stage.releaseState !== 'unreleased'
    && (!layer.revealState || layer.revealState === stage.activeRevealState || stage.activeRevealState === 'all')
  ));
  const visibleLayerIds = new Set(visibleLayers.map((layer) => layer.id));
  const visibleLayersById = new Map(visibleLayers.map((layer) => [layer.id, layer]));
  const visibleConnections = stage.connections.filter((connection) => (
    visibleLayerIds.has(connection.from)
    && visibleLayerIds.has(connection.to)
    && (!connection.revealState || connection.revealState === stage.activeRevealState || stage.activeRevealState === 'all')
  ));
  const aspectClass = stage.aspectRatio === '4:3'
    ? 'min-h-[420px] md:aspect-[4/3] md:min-h-0'
    : stage.aspectRatio === 'fluid'
      ? 'min-h-[420px]'
      : 'min-h-[420px] md:aspect-video md:min-h-0';

  return (
    <section
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-visual-stage-id={stage.stageId}
      data-visual-stage-release-state={stage.releaseState}
      data-visual-stage-active-reveal-state={stage.activeRevealState}
      data-visual-stage-layer-count={stage.layers.length}
      data-visual-stage-visible-layer-ids={visibleLayers.map((layer) => layer.id).join(' ')}
      data-visual-stage-connection-count={stage.connections.length}
      data-visual-stage-panel-chrome="title-panel"
      data-visual-stage-canvas-chrome="none"
      data-visual-stage-layer-kind-labels="hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="interactive-courseware-body">
            {visualStageReleaseLabel(stage.releaseState)}
          </p>
        </div>
      </div>
      <div
        className={[
          'relative w-full overflow-hidden bg-transparent',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
          aspectClass,
        ].join(' ')}
        tabIndex={0}
        role="group"
        aria-label={`${stage.stageId} 视觉舞台`}
        data-visual-stage-canvas="normalized"
        data-visual-stage-layout="freeform"
      >
        <svg
          className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ color: 'var(--platform-body)' }}
          aria-hidden="true"
          data-visual-stage-connections="normalized"
        >
          {visibleConnections.map((connection) => {
            const line = visualStageConnectionLine(connection, visibleLayersById);
            if (!line) return null;
            return (
              <line
                key={connection.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="currentColor"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
                data-visual-stage-connection-line-id={connection.id}
                data-visual-stage-connection-id={connection.id}
                data-visual-stage-connection-from={connection.from}
                data-visual-stage-connection-to={connection.to}
              />
            );
          })}
        </svg>
        {visibleConnections.map((connection) => {
          const line = visualStageConnectionLine(connection, visibleLayersById);
          if (!line) return null;
          const angle = visualStageConnectionArrowAngle(line, stage.aspectRatio);
          return (
            <span
              key={`${connection.id}-arrowhead`}
              className="pointer-events-none absolute z-20 block h-[8px] w-[16px] [clip-path:polygon(0_0,100%_50%,0_100%)]"
              style={{
                left: `${line.x2}%`,
                top: `${line.y2}%`,
                backgroundColor: 'currentColor',
                transform: `translate(-100%, -50%) rotate(${angle}deg)`,
                transformOrigin: '100% 50%',
              }}
              aria-hidden="true"
              data-visual-stage-arrowhead-id={connection.id}
              data-visual-stage-arrow-style="independent-fixed-shape"
              data-visual-stage-arrow-width-ratio="0.5"
              data-visual-stage-arrow-shape-stability="rotation-only"
              data-visual-stage-arrow-angle={angle}
            />
          );
        })}
        {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <p className="interactive-courseware-body">{visualStageReleaseLabel(stage.releaseState)}</p>
          </div>
        ) : null}
        {visibleLayers.map((layer) => {
          const selected = selectedLayerId === layer.id;
          return (
          <article
            key={layer.id}
            className={[
              'absolute z-10 overflow-hidden text-left outline-none transition',
              'focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
              layer.appearance === 'flowNode'
                ? 'grid place-items-center rounded-sm border-[3px] border-[hsl(var(--platform-action-primary))] bg-[var(--platform-panel)] px-3 py-2 text-center shadow-[var(--platform-shadow-xs)]'
                : '',
              layer.appearance === 'note'
                ? 'grid place-items-center bg-transparent text-center'
                : '',
              layer.appearance === 'objective'
                ? 'grid place-items-center bg-transparent text-center'
                : '',
              layer.appearance === 'card'
                ? 'rounded-xl border bg-[var(--platform-panel)]/95 p-3 shadow-[var(--platform-shadow-xs)]'
                : '',
              selected
                ? 'border-[hsl(var(--platform-brand-evidence))] ring-2 ring-[hsl(var(--platform-brand-evidence))] ring-offset-2 ring-offset-[hsl(var(--platform-surface))]'
                : layer.appearance === 'card'
                  ? 'border-[var(--platform-border)]'
                  : '',
              layer.kind === 'formula' ? 'premium-lesson-formula-surface' : '',
            ].join(' ')}
            role="button"
            tabIndex={0}
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
            data-visual-stage-layer-selected={selected ? 'true' : 'false'}
            onClick={() => setSelectedLayerId(layer.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setSelectedLayerId(layer.id);
            }}
          >
            {layer.appearance === 'flowNode' ? (
              <h3 className="interactive-courseware-title-level-3 font-bold">{layer.title}</h3>
            ) : layer.appearance === 'objective' ? (
              <h3 className="interactive-courseware-title-level-3 font-bold">{renderInlineContent(layer.body || layer.title)}</h3>
            ) : layer.appearance === 'note' ? (
              <div className="interactive-courseware-body whitespace-pre-line">
                <div>{layer.title}</div>
                {layer.body ? <div>{renderInlineContent(layer.body)}</div> : null}
              </div>
            ) : (
              <>
                <h3 className="interactive-courseware-title-level-3">{layer.title}</h3>
                <p className="interactive-courseware-body">{renderInlineContent(layer.body)}</p>
              </>
            )}
          </article>
          );
        })}
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
  const { ref: canvasRef, metrics: canvasMetrics } = useBlockDiagramCanvasMetrics();
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
  const activeRevealStep = activeRevealIndex >= 0 ? stage.revealSteps[activeRevealIndex] : stage.revealSteps[0];
  const aspectClass = stage.aspectRatio === '4:3'
    ? 'min-h-0 md:aspect-[4/3] md:min-h-0'
    : stage.aspectRatio === 'fluid'
      ? 'min-h-0 md:min-h-[520px]'
      : 'min-h-0 md:aspect-video md:min-h-0';
  const visibleConnectorLines = visibleConnectors.map((connector) => {
    const from = derivationConnectorEndpoint(targetRegions.get(connector.from), connector.fromAnchor, { x: 12, y: 18 });
    const to = derivationConnectorEndpoint(targetRegions.get(connector.to), connector.toAnchor, { x: 88, y: 72 });
    return { connector, from, to };
  });

  return (
    <section
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-derivation-stage-id={stage.stageId}
      data-derivation-stage-release-state={stage.releaseState}
      data-derivation-stage-active-reveal-step={activeRevealStepId}
      data-derivation-stage-visible-target-ids={[...visibleTargetIds].join(' ')}
      data-derivation-stage-answer-visible={stage.answerVisible ? 'true' : 'false'}
      data-derivation-stage-panel-chrome="title-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="interactive-courseware-body">
            {derivationStageReleaseLabel(stage.releaseState, stage.subtitle ?? activeRevealStep?.reasoning)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {stage.revealSteps.length > 0 ? (
            <span className="premium-lesson-badge" data-derivation-stage-step-progress="visible">
              {activeRevealStep?.title ?? '显影'} · {activeStepNumber}/{stage.revealSteps.length}
            </span>
          ) : null}
          <button
            type="button"
            className="premium-lesson-action-tone interactive-courseware-control premium-tone-slate px-3 py-1"
            data-derivation-stage-control-button="previous"
            data-derivation-stage-teacher-control="previous"
            onClick={() => goToRevealOffset(-1)}
            disabled={!canUseControls || activeStepNumber <= 1}
          >
            {derivationTeacherControlLabel('previous')}
          </button>
          <button
            type="button"
            className="premium-lesson-action-tone interactive-courseware-control premium-tone-cyan px-3 py-1"
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
        ref={canvasRef}
        className={[
          'relative flex w-full flex-col gap-4 overflow-hidden bg-transparent p-2 md:block md:p-0',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
          aspectClass,
        ].join(' ')}
        tabIndex={0}
        role="group"
        aria-label={`${stage.stageId} 推导舞台`}
        data-derivation-stage-canvas="normalized"
        data-derivation-stage-canvas-chrome="none"
        data-derivation-stage-layout="freeform"
        data-katex-rendered="true"
      >
        {stage.releaseState === 'unavailable' || stage.releaseState === 'unreleased' ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <p className="interactive-courseware-body">{derivationStageReleaseLabel(stage.releaseState)}</p>
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 hidden text-base md:block"
          aria-hidden="true"
          data-derivation-stage-connectors="visible"
          data-derivation-stage-connector-renderer="fixed-css-arrow"
          data-derivation-stage-connector-fixed-shape="true"
        >
          {visibleConnectorLines.map(({ connector, from, to }) => {
            return (
              <span
                key={connector.id}
                className="interactive-courseware-flow-arrow absolute block opacity-90"
                style={derivationFixedArrowStyle(from, to, canvasMetrics)}
                data-derivation-stage-connector-id={connector.id}
                data-derivation-stage-connector-kind={connector.kind}
                data-derivation-stage-connector-from={connector.from}
                data-derivation-stage-connector-to={connector.to}
                data-derivation-stage-connector-from-anchor={connector.fromAnchor}
                data-derivation-stage-connector-to-anchor={connector.toAnchor}
                data-derivation-stage-connector-gradient="tail-to-head"
                data-derivation-stage-connector-arrow-style="fixed-gradient-wide"
                data-derivation-stage-connector-arrow-width="1.5em"
                data-derivation-stage-connector-arrowhead="css-clip"
                data-derivation-stage-connector-shape-stability="rotation-only"
              />
            );
          })}
        </div>
        {visibleFormulas.map((formula) => {
          const visibleBlocks = formula.blocks.filter((block) => visibleTargetIds.has(block.id));
          const renderFullFormula = visibleBlocks.length === 0;
          const visibleStandaloneBlocks = renderFullFormula
            ? visibleBlocks.filter((block) => normalizeMath(block.latex) !== normalizeMath(formula.latex))
            : visibleBlocks;
          if (!renderFullFormula) {
            return (
              <Fragment key={formula.id}>
                {visibleStandaloneBlocks.map((block) => {
                  const blockRegion = targetRegions.get(block.id) ?? formula.region;
                  return (
                    <article
                      key={block.id}
                      className="relative w-full overflow-visible p-0 md:absolute md:left-[var(--derivation-left)] md:top-[var(--derivation-top)] md:w-[var(--derivation-width)]"
                      style={{
                        ['--derivation-left' as string]: `${blockRegion.x * 100}%`,
                        ['--derivation-top' as string]: `${blockRegion.y * 100}%`,
                        ['--derivation-width' as string]: `${blockRegion.width * 100}%`,
                      }}
                      data-derivation-stage-formula-id={formula.id}
                      data-derivation-stage-formula-frame="freeform"
                      data-derivation-stage-formula-block-id={block.id}
                      data-derivation-stage-formula-block-frame="freeform"
                      data-derivation-stage-color-role={block.colorRole ?? 'none'}
                      data-derivation-stage-block-latex-source={block.latex}
                    >
                      <div
                        className={[
                          'interactive-courseware-body inline-block border-b-2 px-1.5 py-0.5',
                          derivationInlineFormulaClass(block.colorRole),
                        ].join(' ')}
                      >
                        <InlineMath math={normalizeMath(block.latex)} />
                      </div>
                    </article>
                  );
                })}
              </Fragment>
            );
          }
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
                  className="interactive-courseware-body inline-block bg-transparent px-1 py-0.5"
                  data-derivation-stage-formula-latex-source={formula.latex}
                >
                  <InlineMath math={normalizeMath(formula.latex)} />
                </div>
              ) : null}
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
            <h3 className="interactive-courseware-title-level-3">{block.title}</h3>
            <p className="interactive-courseware-body">{renderInlineContent(block.body)}</p>
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
  const renderGraph = {
    ...graph,
    nodes: compactStructureDiagramNodeY(graph.nodes, BLOCK_DIAGRAM_Y_TARGET_SPAN, BLOCK_DIAGRAM_Y_TARGET_CENTER),
  };
  const visibleTargets = visibleStructureTargets(renderGraph.activeRevealState, renderGraph.revealPlan);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const { ref: canvasRef, metrics: canvasMetrics } = useBlockDiagramCanvasMetrics();
  const selectedTargets = selectedStructureTargets(selectedTargetId, renderGraph.revealPlan);
  const highlighted = (id: string) => visibleTargets.has(id) || selectedTargets.has(id);
  const selected = (id: string) => selectedTargets.has(id);
  const selectEdgeFromKeyboard = (event: KeyboardEvent<SVGPathElement>, edgeId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedTargetId(edgeId);
  };
  const submitCurrent = () => {
    if (!onPanelSubmit) return;
    const submittedAt = Date.now();
    const selectedReveal = renderGraph.revealPlan.find((item) => item.id === selectedTargetId);
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
      graphId: renderGraph.graphId,
      activeRevealState: renderGraph.activeRevealState,
      selectedNodeIds: renderGraph.nodes.some((node) => node.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedPathIds: selectedReveal && selectedReveal.id.includes('path') ? [selectedReveal.id] : [],
      selectedLoopIds: selectedReveal && selectedReveal.id.includes('loop') ? [selectedReveal.id] : [],
      constructedPositions: renderGraph.nodes.map((node) => ({ nodeId: node.id, x: node.position.x, y: node.position.y })),
      constructedConnections: renderGraph.edges.map((edge) => ({ from: edge.from, to: edge.to, branchId: edge.id, gainLabel: edge.label })),
      connectionDifferences: [],
      teachingLabels: blockDiagramTeachingLabels(renderGraph),
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
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-structure-diagram-kind="visual.blockDiagram"
      data-structure-diagram-id={renderGraph.graphId}
      data-structure-diagram-layout-mode={renderGraph.layout.mode}
      data-structure-diagram-layout-spacing-x={renderGraph.layout.spacing.x}
      data-structure-diagram-layout-spacing-y={renderGraph.layout.spacing.y}
      data-structure-diagram-text-scale={renderGraph.layout.textScale}
      data-structure-diagram-mode={renderGraph.mode}
      data-structure-diagram-active-reveal={renderGraph.activeRevealState}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="interactive-courseware-body">用结构节点、信号线和反馈回路表达控制系统关系。</p>
        </div>
        {renderGraph.mode === 'construct' ? (
          <span className="premium-lesson-badge" data-structure-diagram-mode-label="visual">{structureModeLabel(renderGraph.mode)}</span>
        ) : null}
      </div>
      <div
        ref={canvasRef}
        className={STRUCTURE_DIAGRAM_CANVAS_CLASS}
        tabIndex={0}
        role="group"
        aria-label={`${renderGraph.graphId} 方框图`}
        data-structure-diagram-canvas="normalized"
        data-structure-diagram-canvas-vertical-fit="content-trimmed"
        data-structure-diagram-y-target-span={BLOCK_DIAGRAM_Y_TARGET_SPAN}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" data-structure-diagram-svg="block">
          {renderGraph.edges.map((edge) => {
            const path = blockEdgePath(renderGraph.nodes, edge, canvasMetrics);
            const endpoints = blockEdgeEndpoints(renderGraph.nodes, edge, canvasMetrics);
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
                {highlighted(edge.id) || selected(edge.id) ? (
                  <path
                    d={path.d}
                    fill="none"
                    stroke={blockDiagramSelectionColor()}
                    strokeWidth={selected(edge.id) ? STRUCTURE_DIAGRAM_SIGNAL_SELECTED_HALO_STROKE : STRUCTURE_DIAGRAM_SIGNAL_HALO_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={selected(edge.id) ? 0.62 : 0.28}
                    vectorEffect="non-scaling-stroke"
                    data-structure-diagram-edge-halo={selected(edge.id) ? 'selected' : 'highlighted'}
                  />
                ) : null}
                <path
                  d={path.d}
                  fill="none"
                  stroke={selected(edge.id) ? blockDiagramSelectionColor() : 'hsl(var(--platform-action-primary))'}
                  strokeWidth={STRUCTURE_DIAGRAM_SIGNAL_STROKE}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  data-structure-diagram-edge-main-line="true"
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer outline-none focus-visible:stroke-[hsl(var(--platform-brand-evidence))]"
                  pointerEvents="stroke"
                  role="button"
                  tabIndex={0}
                  aria-label={`选择信号线 ${edge.label || edge.id}`}
                  vectorEffect="non-scaling-stroke"
                  onClick={() => setSelectedTargetId(edge.id)}
                  onKeyDown={(event) => selectEdgeFromKeyboard(event, edge.id)}
                  data-structure-diagram-edge-hit-target={edge.id}
                  data-structure-diagram-edge-keyboard-selectable="true"
                />
              </g>
            );
          })}
        </svg>
        {renderGraph.edges.map((edge) => {
          const path = blockEdgePath(renderGraph.nodes, edge, canvasMetrics);
          return (
            <StructureDiagramArrowhead
              key={`${edge.id}-arrowhead`}
              id={edge.id}
              x={path.arrow.x}
              y={path.arrow.y}
              angle={path.arrow.angle}
              selected={selected(edge.id)}
            />
          );
        })}
        {renderGraph.edges.map((edge) => {
          if (!edge.terminalSign) return null;
          const signPosition = blockEdgeTerminalSignPosition(renderGraph.nodes, edge, canvasMetrics);
          return (
            <button
              key={`${edge.id}-terminal-sign`}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 premium-lesson-title bg-[var(--platform-surface)]/80 px-1.5 py-0.5 ${STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS} leading-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]`}
              style={{ left: `${signPosition.x}%`, top: `${signPosition.y}%` }}
              data-structure-diagram-terminal-sign-id={edge.id}
              data-structure-diagram-terminal-sign={edge.terminalSign}
              onClick={() => setSelectedTargetId(edge.id)}
            >
              {edge.terminalSign}
            </button>
          );
        })}
        {renderGraph.edges.map((edge) => {
          if (!edge.label) return null;
          const path = blockEdgePath(renderGraph.nodes, edge, canvasMetrics);
          const labelPosition = blockEdgeLabelPosition(renderGraph.nodes, edge, path.label, canvasMetrics);
          return (
            <div
              key={`${edge.id}-label`}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 premium-lesson-title bg-[var(--platform-surface)]/80 px-1.5 py-0.5 ${STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS} leading-none`}
              style={{ left: `${labelPosition.x}%`, top: `${labelPosition.y}%` }}
              data-structure-diagram-edge-label-id={edge.id}
              data-structure-diagram-edge-label-placement={edge.labelPlacement || 'auto'}
              data-structure-diagram-label-chrome="plain"
              data-structure-diagram-text-scale={renderGraph.layout.textScale}
            >
              {isMathLabel(edge.label) ? <InlineMath math={normalizeMath(edge.label)} /> : edge.label}
            </div>
          );
        })}
        {renderGraph.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className={[
              'absolute grid place-items-center text-center outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)] [&_*]:pointer-events-none',
              blockDiagramNodeVisualKind(node) === 'block' ? 'border-[3px] bg-platform-panel shadow-[var(--platform-shadow-xs)]' : '',
              blockDiagramNodeVisualKind(node) === 'sum' ? 'rounded-full border-[3px] bg-platform-panel' : '',
              blockDiagramNodeVisualKind(node) === 'branch' ? 'border border-transparent bg-transparent' : '',
              blockDiagramNodeVisualKind(node) === 'takeoff' ? 'rounded-full border border-platform-action-primary bg-platform-action-primary' : '',
              blockDiagramNodeVisualKind(node) === 'input' || blockDiagramNodeVisualKind(node) === 'output' ? 'border border-transparent bg-transparent' : '',
              blockDiagramNodeVisualKind(node) === 'block' || blockDiagramNodeVisualKind(node) === 'sum'
                ? (highlighted(node.id) || selectedTargetId === node.id ? 'border-[hsl(var(--platform-brand-evidence))]' : 'border-[hsl(var(--platform-action-primary))]')
                : '',
              blockDiagramNodeVisualKind(node) === 'sum'
                ? (highlighted(node.id) || selectedTargetId === node.id ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-[hsl(var(--platform-action-primary))]')
                : '',
              selectedTargetId === node.id && blockDiagramNodeVisualKind(node) !== 'sum' ? 'ring-2 ring-[hsl(var(--platform-brand-evidence))] ring-offset-2 ring-offset-[hsl(var(--platform-surface))]' : '',
            ].join(' ')}
            style={blockNodeBounds(node, canvasMetrics)}
            data-structure-diagram-node-id={node.id}
            data-structure-diagram-node-type={node.type}
            data-structure-diagram-node-visual-kind={blockDiagramNodeVisualKind(node)}
            data-structure-diagram-node-anchors={blockDiagramNodeAnchors(node)}
            data-structure-diagram-text-scale={renderGraph.layout.textScale}
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
            data-structure-diagram-node-rendered-height={blockDiagramNodeSizeForCanvas(node, canvasMetrics).height}
            data-structure-diagram-output-label-position={
              blockDiagramNodeVisualKind(node) === 'output' && node.display !== 'anchor' ? 'above-line' : undefined
            }
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
                <line x1="4" y1="4" x2="36" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <line x1="36" y1="4" x2="4" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : blockDiagramNodeVisualKind(node) === 'branch' ? (
              <span className="sr-only">{node.label}</span>
            ) : blockDiagramNodeVisualKind(node) === 'takeoff' ? (
              <span className="sr-only">{node.label}</span>
            ) : (blockDiagramNodeVisualKind(node) === 'input' || blockDiagramNodeVisualKind(node) === 'output') && node.display === 'anchor' ? (
              <span className="sr-only">{node.label}</span>
            ) : blockDiagramNodeVisualKind(node) === 'output' ? (
              <span
                className={`block -translate-y-4 premium-lesson-title ${STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS}`}
                data-structure-diagram-output-label-position="above-line"
              >
                {isMathLabel(node.label) ? <InlineMath math={normalizeMath(node.label)} /> : node.label}
              </span>
            ) : isMathLabel(node.label) ? (
              <span className={STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS}><InlineMath math={normalizeMath(node.label)} /></span>
            ) : (
              <span className={`premium-lesson-title ${STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS}`}>{node.label}</span>
            )}
          </button>
        ))}
      </div>
      <div className="hidden" data-structure-diagram-reveal-plan="metadata" aria-hidden="true">
        {renderGraph.revealPlan.map((item) => (
          <span
            key={item.id}
            data-structure-diagram-reveal-id={item.id}
            data-structure-diagram-reveal-selected={selectedTargetId === item.id ? 'true' : 'false'}
            data-structure-diagram-reveal-label={item.label}
          />
        ))}
      </div>
      {renderGraph.mode === 'construct' ? (
        <button
          type="button"
          className="premium-lesson-action-tone interactive-courseware-control premium-tone-cyan justify-self-start"
          data-structure-diagram-submit={renderGraph.graphId}
          onClick={submitCurrent}
          disabled={!onPanelSubmit}
        >
          提交构图结果
        </button>
      ) : null}
    </section>
  );
}

function SignalFlowGraphPanel({ manifest, step, module, onPanelSubmit }: StructureDiagramPanelProps) {
  const graph = signalFlowPayload(module);
  const renderGraph = {
    ...graph,
    nodes: compactStructureDiagramNodeY(graph.nodes, SIGNAL_FLOW_Y_TARGET_SPAN, SIGNAL_FLOW_Y_TARGET_CENTER),
  };
  const visibleTargets = visibleStructureTargets(renderGraph.activeRevealState, renderGraph.revealPlan);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const { ref: canvasRef, metrics: canvasMetrics } = useBlockDiagramCanvasMetrics();
  const selectedTargets = selectedSignalFlowTargets(selectedTargetId, renderGraph);
  const highlighted = (id: string) => visibleTargets.has(id) || selectedTargets.has(id);
  const selected = (id: string) => selectedTargets.has(id);
  const selectBranchFromKeyboard = (event: KeyboardEvent<SVGPathElement>, branchId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedTargetId(branchId);
  };
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
      graphId: renderGraph.graphId,
      activeRevealState: renderGraph.activeRevealState,
      selectedNodeIds: renderGraph.nodes.some((node) => node.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedPathIds: renderGraph.forwardPaths.some((path) => path.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      selectedLoopIds: renderGraph.loops.some((loop) => loop.id === selectedTargetId) && selectedTargetId ? [selectedTargetId] : [],
      constructedPositions: renderGraph.nodes.map((node) => ({ nodeId: node.id, x: node.position.x, y: node.position.y })),
      constructedConnections: renderGraph.branches.map((branch) => ({ from: branch.from, to: branch.to, branchId: branch.id, gainLabel: branch.gainLatex })),
      connectionDifferences: [],
      teachingLabels: signalFlowTeachingLabels(renderGraph),
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
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-structure-diagram-kind="visual.signalFlowGraph"
      data-structure-diagram-id={renderGraph.graphId}
      data-structure-diagram-layout-mode={renderGraph.layout.mode}
      data-structure-diagram-layout-spacing-x={renderGraph.layout.spacing.x}
      data-structure-diagram-layout-spacing-y={renderGraph.layout.spacing.y}
      data-structure-diagram-text-scale={renderGraph.layout.textScale}
      data-structure-diagram-mode={renderGraph.mode}
      data-structure-diagram-active-reveal={renderGraph.activeRevealState}
      data-structure-diagram-path-sets-enabled={renderGraph.showPathSets ? 'true' : 'false'}
      data-structure-diagram-mason-map-enabled={renderGraph.showMasonMap ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="interactive-courseware-body">用信号节点、支路增益和回路表达变量间的因果关系。</p>
        </div>
      </div>
      <div
        ref={canvasRef}
        className={STRUCTURE_DIAGRAM_CANVAS_CLASS}
        tabIndex={0}
        role="group"
        aria-label={`${renderGraph.graphId} 信号流图`}
        data-structure-diagram-canvas="normalized"
        data-structure-diagram-canvas-vertical-fit="content-trimmed"
        data-structure-diagram-y-target-span={SIGNAL_FLOW_Y_TARGET_SPAN}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" data-structure-diagram-svg="signal-flow">
          {renderGraph.branches.map((branch) => {
            const path = signalBranchPath(renderGraph.nodes, branch, canvasMetrics);
            return (
              <g
                key={branch.id}
                data-structure-diagram-branch-id={branch.id}
                data-structure-diagram-branch-route-kind={path.routeKind}
                data-structure-diagram-branch-from-port={path.fromPort}
                data-structure-diagram-branch-to-port={path.toPort}
                data-structure-diagram-branch-highlighted={highlighted(branch.id) ? 'true' : 'false'}
                data-structure-diagram-branch-selected={selected(branch.id) ? 'true' : 'false'}
              >
                {highlighted(branch.id) || selected(branch.id) ? (
                  <path
                    d={path.d}
                    fill="none"
                    stroke={blockDiagramSelectionColor()}
                    strokeWidth={selected(branch.id) ? STRUCTURE_DIAGRAM_SIGNAL_SELECTED_HALO_STROKE : STRUCTURE_DIAGRAM_SIGNAL_HALO_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={selected(branch.id) ? 0.62 : 0.28}
                    vectorEffect="non-scaling-stroke"
                    data-structure-diagram-branch-halo={selected(branch.id) ? 'selected' : 'highlighted'}
                  />
                ) : null}
                <path
                  d={path.d}
                  fill="none"
                  stroke={selected(branch.id) ? blockDiagramSelectionColor() : 'hsl(var(--platform-action-primary))'}
                  strokeWidth={selected(branch.id) ? 2.4 : highlighted(branch.id) ? 2 : STRUCTURE_DIAGRAM_SIGNAL_STROKE}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  data-structure-diagram-branch-main-line="true"
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer outline-none focus-visible:stroke-[hsl(var(--platform-brand-evidence))]"
                  pointerEvents="stroke"
                  role="button"
                  tabIndex={0}
                  aria-label={`选择支路 ${branch.gainLatex}`}
                  vectorEffect="non-scaling-stroke"
                  onClick={() => setSelectedTargetId(branch.id)}
                  onKeyDown={(event) => selectBranchFromKeyboard(event, branch.id)}
                  data-structure-diagram-branch-hit-target={branch.id}
                  data-structure-diagram-branch-keyboard-selectable="true"
                />
              </g>
            );
          })}
        </svg>
        {renderGraph.branches.map((branch) => {
          const path = signalBranchPath(renderGraph.nodes, branch, canvasMetrics);
          return (
            <StructureDiagramArrowhead
              key={`${branch.id}-arrowhead`}
              id={branch.id}
              x={path.arrow.x}
              y={path.arrow.y}
              angle={path.arrow.angle}
              selected={selected(branch.id)}
            />
          );
        })}
        {renderGraph.branches.map((branch) => {
          const path = signalBranchPath(renderGraph.nodes, branch, canvasMetrics);
          return (
            <div
              key={`${branch.id}-label`}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 bg-[var(--platform-surface)]/80 px-1.5 py-0.5 ${STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS} font-semibold`}
              style={{ left: `${path.label.x}%`, top: `${path.label.y}%` }}
              data-structure-diagram-branch-label-id={branch.id}
              data-structure-diagram-label-chrome="plain"
              data-structure-diagram-text-scale={renderGraph.layout.textScale}
            >
              <InlineMath math={normalizeMath(branch.gainLatex)} />
            </div>
          );
        })}
        {renderGraph.nodes.map((node) => (
          <div
            key={node.id}
            style={{ left: `${node.position.x * 100}%`, top: `${node.position.y * 100}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            data-structure-diagram-node-id={node.id}
            data-structure-diagram-node-anchors="N NE E SE S SW W NW C"
            data-structure-diagram-node-visual-kind="signal-node"
            data-structure-diagram-node-label-position={node.labelPosition}
            data-structure-diagram-text-scale={renderGraph.layout.textScale}
            data-structure-diagram-node-selected={selectedTargetId === node.id ? 'true' : 'false'}
          >
            <button
              type="button"
              className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-transparent bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]"
              style={{
                width: `${SIGNAL_FLOW_NODE_HIT_SIZE_PX}px`,
                height: `${SIGNAL_FLOW_NODE_HIT_SIZE_PX}px`,
              }}
              data-structure-diagram-node-hit-target={node.id}
              onClick={() => setSelectedTargetId(node.id)}
            >
              <span
                className={[
                  'rounded-full border-2',
                  highlighted(node.id) || selected(node.id)
                    ? 'border-[hsl(var(--platform-brand-evidence))] bg-[hsl(var(--platform-brand-evidence))]/20'
                    : 'border-[hsl(var(--platform-action-primary))] bg-platform-panel',
                ].join(' ')}
                style={{ width: `${SIGNAL_FLOW_NODE_SIZE_PX}px`, height: `${SIGNAL_FLOW_NODE_SIZE_PX}px` }}
                data-structure-diagram-node-dot={node.id}
              />
              <span className="sr-only">{node.labelLatex}</span>
            </button>
            <div
              className={[
                'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap premium-lesson-title',
                node.labelPosition === 'above' ? 'bottom-4' : 'top-4',
                STRUCTURE_DIAGRAM_DEFAULT_LABEL_CLASS,
                highlighted(node.id) || selected(node.id) ? 'text-[hsl(var(--platform-brand-evidence))]' : '',
              ].join(' ')}
              data-structure-diagram-node-label-id={node.id}
            >
              <InlineMath math={normalizeMath(node.labelLatex)} />
            </div>
          </div>
        ))}
        {renderGraph.branches.map((branch) => {
          const { label } = signalBranchPath(renderGraph.nodes, branch, canvasMetrics);
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
      <div className="flex flex-wrap gap-2" data-structure-diagram-keyword-toolbar="visible">
        {renderGraph.revealPlan.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              'rounded-full border px-3 py-1.5 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
              selectedTargetId === item.id
                ? 'border-[hsl(var(--platform-brand-evidence))] bg-[hsl(var(--platform-brand-evidence))]/15 text-[hsl(var(--platform-brand-evidence))]'
                : 'border-[hsl(var(--platform-action-primary))]/55 bg-platform-panel text-[var(--platform-text-primary)] hover:bg-[hsl(var(--platform-action-primary))]/10',
            ].join(' ')}
            data-structure-diagram-keyword-id={item.id}
            data-structure-diagram-keyword-targets={item.targetIds.join(' ')}
            data-structure-diagram-keyword-selected={selectedTargetId === item.id ? 'true' : 'false'}
            onClick={() => setSelectedTargetId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {renderGraph.showPathSets ? (
        <div className="grid gap-2 md:grid-cols-3" data-structure-diagram-path-sets="visible">
          {renderGraph.forwardPaths.map((path) => (
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
              <span className="interactive-courseware-body block">{path.label}</span>
            </button>
          ))}
          {renderGraph.loops.map((loop) => (
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
              <span className="interactive-courseware-body block">{loop.label}</span>
            </button>
          ))}
          {renderGraph.nonTouchingLoopGroups.filter((group) => renderGraph.loops.length > 1 && group.loopIds.length > 1).map((group) => (
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
              <span className="interactive-courseware-body block">{group.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {renderGraph.showMasonMap && renderGraph.masonTerms.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-3" data-structure-diagram-mason-map="visible">
          {renderGraph.masonTerms.map((term) => (
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
      ) : null}
      {renderGraph.mode === 'construct' ? (
        <button
          type="button"
          className="premium-lesson-action-tone interactive-courseware-control premium-tone-cyan justify-self-start"
          data-structure-diagram-submit={renderGraph.graphId}
          onClick={submitCurrent}
          disabled={!onPanelSubmit}
        >
          提交构图结果
        </button>
      ) : null}
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
  const mediaSrc = runtimeMediaPath(manifest, graph.media.src);
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
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-annotated-media-kind="visual.annotatedMedia"
      data-annotated-media-id={graph.mediaId}
      data-annotated-media-active-reveal={graph.activeRevealState}
      data-annotated-media-selected-count={selectedAnnotationIds.length}
      data-annotated-media-interaction-mode={canInteract ? 'active' : 'readonly'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
          <p className="interactive-courseware-body">{graph.instruction}</p>
        </div>
        <span className="premium-lesson-badge">{selectedAnnotationIds.length} 项证据</span>
      </div>
      <div
        className="relative min-h-[420px] overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-surface)] md:min-h-0"
        style={{ aspectRatio: graph.media.aspectRatio }}
        data-annotated-media-canvas="normalized"
      >
        <Image src={mediaSrc} alt={graph.media.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-platform-surface-muted/35" data-annotated-media-mask="visible" />
        {graph.annotations.map((annotation, index) => {
          const visible = visibleAnnotations.has(annotation.id);
          const isSelectable = selectable.has(annotation.id);
          const isSelected = selectedSet.has(annotation.id);
          const markerIndex = index + 1;
          return (
            <button
              key={annotation.id}
              type="button"
              className={[
                'absolute rounded-lg border-2 bg-transparent text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--platform-focus-ring)]',
                isSelected
                  ? 'border-[hsl(var(--platform-brand-evidence))] bg-[hsl(var(--platform-brand-evidence)/0.14)] shadow-[0_0_0_6px_hsl(var(--platform-brand-evidence)/0.24),0_18px_42px_rgba(8,145,178,0.18)]'
                  : 'border-transparent shadow-none hover:border-platform-action-primary/70',
                visible ? 'opacity-100' : 'opacity-45',
                isSelectable ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
              style={{
                left: `${annotation.region.x * 100}%`,
                top: `${annotation.region.y * 100}%`,
                width: `${annotation.region.width * 100}%`,
                height: `${annotation.region.height * 100}%`,
                ...(isSelected ? {
                  borderColor: blockDiagramSelectionColor(),
                  backgroundColor: 'hsl(var(--platform-brand-evidence) / 0.16)',
                  boxShadow: '0 0 0 6px hsl(var(--platform-brand-evidence) / 0.28), 0 18px 42px rgba(8, 145, 178, 0.18)',
                } : {}),
              }}
              data-annotated-media-annotation-id={annotation.id}
              data-annotated-media-evidence-role={annotation.evidenceRole}
              data-annotated-media-hotspot-frame="true"
              data-annotated-media-frame-visibility={isSelected ? 'selected' : 'hidden-until-selected'}
              data-annotated-media-frame-selected-style={isSelected ? 'structure-diagram-evidence-halo' : 'none'}
              data-annotated-media-selectable={isSelectable ? 'true' : 'false'}
              data-annotated-media-selected={isSelected ? 'true' : 'false'}
              data-annotated-media-required={annotation.required ? 'true' : 'false'}
              aria-label={`证据 ${markerIndex}：${annotation.label}`}
              aria-pressed={isSelected}
              disabled={!canInteract || !isSelectable}
              onClick={() => toggleAnnotation(annotation.id)}
            />
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
      <div className="grid gap-2 md:grid-cols-2" data-annotated-media-candidate-list="visible">
        {graph.annotations.map((annotation, index) => {
          const isSelectable = selectable.has(annotation.id);
          const isSelected = selectedSet.has(annotation.id);
          return (
            <button
              key={annotation.id}
              type="button"
              className={[
                'premium-lesson-card text-left transition',
                isSelected
                  ? 'border-[hsl(var(--platform-brand-evidence))] bg-[hsl(var(--platform-brand-evidence)/0.18)] shadow-[0_0_0_3px_hsl(var(--platform-brand-evidence)/0.18),0_18px_42px_rgba(8,145,178,0.16)]'
                  : '',
                isSelectable ? 'interactive-courseware-control cursor-pointer' : 'cursor-default opacity-75',
              ].join(' ')}
              data-annotated-media-candidate-id={annotation.id}
              data-annotated-media-candidate-selectable={isSelectable ? 'true' : 'false'}
              data-annotated-media-candidate-selected={isSelected ? 'true' : 'false'}
              data-annotated-media-candidate-selected-style={isSelected ? 'structure-diagram-evidence-halo' : 'none'}
              style={isSelected ? {
                borderColor: blockDiagramSelectionColor(),
                backgroundColor: 'hsl(var(--platform-brand-evidence) / 0.18)',
                boxShadow: '0 0 0 4px hsl(var(--platform-brand-evidence) / 0.22), 0 18px 42px rgba(8, 145, 178, 0.16)',
              } : undefined}
              onClick={() => toggleAnnotation(annotation.id)}
              disabled={!canInteract || !isSelectable}
            >
              <p className="premium-lesson-caption">候选证据 {index + 1}</p>
              <p className="premium-lesson-title interactive-courseware-title-level-3 font-semibold">{annotation.label}</p>
              <p className="interactive-courseware-body mt-1">{annotation.body}</p>
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 md:grid-cols-3" data-annotated-media-reveal-plan="visible">
        {graph.revealPlan.map((item) => (
          <div key={item.id} className="premium-lesson-card" data-annotated-media-reveal-id={item.id}>
            <p className="premium-lesson-caption">判断任务</p>
            <p className="interactive-courseware-body">{item.label}</p>
          </div>
        ))}
      </div>
      {graph.activeRevealState === 'answer-reveal' ? (
        <div className="premium-lesson-card border-platform-action-primary" data-annotated-media-answer-reveal="visible">
          <p className="premium-lesson-caption">答案显影</p>
          <p className="interactive-courseware-body">
            {graph.annotations
              .filter((annotation) => annotation.required)
              .map((annotation) => annotation.label)
              .join('、')}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        className="premium-lesson-action-tone interactive-courseware-control premium-tone-cyan justify-self-start"
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
      className="premium-lesson-panel interactive-courseware-panel grid gap-4"
      data-embedded-activity-kind="visual.embedded-activity"
      data-embedded-activity-id={activity.activityId}
      data-embedded-activity-anchor={activity.anchorId}
      data-embedded-activity-response-contract={activity.responseContractId}
    >
      <div>
        <ManifestContentTitle>{titleFromModule(module)}</ManifestContentTitle>
        <p className="interactive-courseware-body">{activity.prompt}</p>
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
            <span className="interactive-courseware-body">{option.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="premium-lesson-action-tone interactive-courseware-control premium-tone-cyan justify-self-start"
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
    <div className="premium-lesson-panel interactive-courseware-panel" data-module-kind="content.code">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ManifestContentTitle>{title}</ManifestContentTitle>
        <span className="premium-lesson-chip">{languageLabel}</span>
      </div>
      <pre className="premium-code-block mt-3" data-code-language={normalizedLanguage}>
        <code>{renderHighlightedCode(code, normalizedLanguage)}</code>
      </pre>
      {note ? <p className="interactive-courseware-body">{renderInlineContent(note)}</p> : null}
    </div>
  );
}

function SummaryCard({ title, text, bullets }: { title: string; text?: string; bullets?: string[] }) {
  if (!text && !bullets?.length) return null;
  return (
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {text ? <p className="interactive-courseware-body">{renderInlineContent(text)}</p> : null}
      {bullets?.length ? (
        <ul className="interactive-courseware-section interactive-courseware-body">
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
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className={`mt-3 grid gap-3 ${columns}`}>
        {items.map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 interactive-courseware-body">
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
    <div className="premium-lesson-panel interactive-courseware-panel">
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
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {items.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {items.map((item, index) => (
            <Fragment key={item.key}>
              <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-center interactive-courseware-body font-semibold">
                {renderInlineContent(item.label)}
                {item.status === 'current' ? (
                  <div className="premium-lesson-caption mt-2">当前</div>
                ) : null}
              </div>
              {index < items.length - 1 ? <div className="premium-lesson-muted hidden items-center md:flex">→</div> : null}
            </Fragment>
          ))}
        </div>
      ) : null}
      {lead ? <p className="interactive-courseware-body">{renderInlineContent(lead)}</p> : null}
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
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {formulas.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {formulas.map((formula) => (
            <div key={formula} className="overflow-x-auto rounded-2xl border border-platform-border bg-platform-surface px-3 py-2">
              <BlockMath math={normalizeMath(formula)} />
            </div>
          ))}
        </div>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="interactive-courseware-body">{renderInlineContent(note)}</p>
      ))}
      {goals.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {goals.map((goal) => (
            <div key={goal} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 interactive-courseware-body">
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
    <div className="premium-lesson-panel interactive-courseware-panel overflow-hidden">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {notes?.length ? (
        <div className="interactive-courseware-section interactive-courseware-body">
          {notes.map((note) => (
            <p key={note}>{renderInlineContent(note)}</p>
          ))}
        </div>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left interactive-courseware-body">
          <thead>
            <tr className="border-b border-platform-border">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold">{renderInlineContent(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-b border-platform-border-soft">
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
  const nodeClass = 'premium-lesson-surface-elevated rounded-xl px-4 py-3 text-center';
  const arrowClass = 'premium-lesson-muted';
  return (
    <div className="premium-lesson-panel interactive-courseware-panel" data-local-modeling-paths-figure="true">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 rounded-2xl border border-platform-border bg-platform-surface p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="premium-lesson-kicker">机理建模路径</div>
            <div className={nodeClass}>真实对象</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>物理定律</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>微分方程</div>
            <div className={arrowClass}>↓</div>
            <div className="rounded-xl border border-platform-action-primary/55 bg-platform-action-primary/10 px-4 py-3 text-center shadow-sm">传递函数</div>
            <p className="interactive-courseware-body">优势：结构清楚、物理含义明确；边界：对象过复杂时建方程成本高。</p>
          </div>
          <div className="space-y-3">
            <div className="premium-lesson-kicker">数据驱动路径</div>
            <div className={nodeClass}>真实对象</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>采集输入输出数据</div>
            <div className={arrowClass}>↓</div>
            <div className={nodeClass}>算法学习映射</div>
            <div className={arrowClass}>↓</div>
            <div className="rounded-xl border border-platform-evidence-eligible/55 bg-platform-evidence-eligible/10 px-4 py-3 text-center shadow-sm">预测模型</div>
            <p className="interactive-courseware-body">优势：先验要求低；边界：解释性弱，训练范围外可靠性下降。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePanel({ title, src, alt = title, notes, displayMode = 'default' }: { title: string; src: string; alt?: string; notes: string[]; displayMode?: ImageDisplayMode }) {
  return (
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 overflow-hidden" data-image-panel-frame="none">
        <Image src={src} alt={alt} width={1600} height={960} className={imageClassFor(displayMode)} unoptimized />
      </div>
      {notes.length ? (
        <ul className="interactive-courseware-section interactive-courseware-body">
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
    <div className="premium-lesson-panel interactive-courseware-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.src} className="overflow-hidden rounded-2xl border border-platform-border bg-platform-surface">
            <Image src={item.src} alt={item.caption || title} width={1600} height={960} className="h-auto w-full" unoptimized />
            {item.caption ? (
              <p className="premium-lesson-muted border-t border-platform-border-soft px-3 py-2 interactive-courseware-body">
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
  revealLocked = false,
}: {
  title: string;
  items: RevealItem[];
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
  revealLocked?: boolean;
}) {
  const teacherVisibleCount = Math.min(items.length, Math.max(1, revealProgress + 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  const visibleCount = onInlineReveal
    ? teacherVisibleCount
    : Math.min(items.length, Math.max(teacherVisibleCount, localVisibleCount));

  if (revealLocked) {
    return (
      <div className="premium-lesson-panel interactive-courseware-panel">
        <ManifestContentTitle>{title}</ManifestContentTitle>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未开放浏览，请等待课堂推进。</div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-panel interactive-courseware-panel">
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
            canExpand ? 'cursor-pointer border-platform-action-primary bg-platform-action-primary/10 hover:border-platform-action-primary' : 'border-platform-border bg-platform-surface'
          }`;
          const cardContent = (
            <>
              {item.title ? <ManifestSubsectionTitle>{item.title}</ManifestSubsectionTitle> : null}
              {item.body ? (
                <p className="interactive-courseware-body">{renderInlineContent(item.body)}</p>
              ) : null}
              {item.formula ? <div className="mt-2 overflow-x-auto">{renderFormulaContent(item.formula)}</div> : null}
              {canExpand ? <p className="interactive-courseware-caption">点击当前最下方步骤继续显示下一层。</p> : null}
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

const defaultManifestPluginRegistrySingleton: { registry?: ManifestPluginRegistry } = {};

function defaultManifestPluginRegistry(): ManifestPluginRegistry {
  if (!defaultManifestPluginRegistrySingleton.registry) {
    defaultManifestPluginRegistrySingleton.registry = composeManifestPluginRegistry([staticSurface3DPluginSet, controlWorkbenchPluginSet, interactiveFigurePluginSet]);
  }
  return defaultManifestPluginRegistrySingleton.registry;
}


function renderSummaryModule(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const content = summaryContent(step, module);
  return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
}

function renderSummaryCardGrid(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
  columns?: string,
) {
  const content = summaryContent(step, module);
  const items = [content.text, ...content.bullets].filter(Boolean) as string[];
  if (columns) return <CardGrid title={titleFromModule(module)} items={items} columns={columns} />;
  return <CardGrid title={titleFromModule(module)} items={items} />;
}

function renderNativeTableModule(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const table = tableFor(step, module);
  if (!table) return null;
  return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
}

function renderFormulaModule(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  return (
    <FormulaCard
      title={titleFromModule(module)}
      formulas={getFormulaItems(step, module)}
      notes={formulaNotes(step, module)}
      symbols={formulaSymbols(step, module)}
    />
  );
}

export function createManifestContentModuleRegistry(extra: {
  revealProgress: number;
  allowInlineReveal: boolean;
  revealLocked?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void | Promise<void>;
  showFrequencyReadings?: boolean;
  analyticsSummary?: string[];
  interactionMode?: 'active' | 'readonly';
  /**
   * Viewer role used for plugin role projection; student is the safe default
   * so an omitted role can never leak teacher-only projections.
   */
  viewerRole?: 'student' | 'teacher';
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
        return <ImagePanel title={titleFromModule(module, step)} src={item.src} alt={stringField(module.payload, ['alt']) || undefined} notes={notes} displayMode={displayMode} />;
      }
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module, step)} src={src} alt={stringField(module.payload, ['alt']) || undefined} notes={imageNotes(step, module)} displayMode={displayMode} />;
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
            revealLocked={renderExtra.revealLocked}
          />
        );
      }
      return renderSummaryModule(step, module);
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
    'compute.panel': ({ manifest, step, module, extra: renderExtra }) => {
      const pluginLookup = defaultManifestPluginRegistry().lookupModule({
        moduleKind: module.kind,
        capabilityRef: computeCapabilityRef(module.payload),
        contractVersion: typeof module.payload.contractVersion === 'string'
          ? module.payload.contractVersion
          : typeof module.payload.contract_version === 'string'
            ? module.payload.contract_version
            : null,
      });
      if (pluginLookup.status === 'rendered') {
        const plugin = pluginLookup.plugin;
        const role = renderExtra.viewerRole ?? 'student';
        return plugin.render({
          manifest,
          step,
          module,
          role,
          onPanelSubmit: extra.onPanelSubmit,
          showFrequencyReadings: extra.showFrequencyReadings,
          payload: plugin.projectRole(plugin.schema({ manifest, step, module, role }), role),
        });
      }
      if (pluginLookup.status === 'missing') {
        return (
          <div
            data-manifest-plugin-missing={pluginLookup.contract.marker}
            className="rounded-lg border border-platform-danger bg-platform-danger/5 p-4 text-sm text-platform-fg-primary"
            role="alert"
          >
            {pluginLookup.contract.reason}
          </div>
        );
      }
      return renderSummaryModule(step, module);
    },
    'analytics.summary': ({ step, module, extra: renderExtra }) => (
      <CardGrid title={titleFromModule(module)} items={renderExtra.analyticsSummary?.length ? renderExtra.analyticsSummary : learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'layout.support': ({ step, module }) => renderSummaryModule(step, module),
    'formula-card': ({ step, module }) => renderFormulaModule(step, module),
    'summary-card': ({ step, module }) => renderSummaryModule(step, module),
    'question-card-row': ({ step, module }) => renderSummaryCardGrid(step, module),
    'comparison-table': ({ step, module }) => renderNativeTableModule(step, module) ?? renderSummaryModule(step, module),
    'interactive-figure-panel': ({ manifest, step, module }) => {
      const galleryItems = imageItemsFromPayload(manifest, module.payload);
      if (galleryItems.length > 1) return <ImageGallery title={titleFromModule(module)} items={galleryItems} />;
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      return renderSummaryModule(step, module);
    },
    'evidence-bank': ({ step, module }) => renderSummaryCardGrid(step, module, 'grid-cols-1'),
    'example-card': ({ step, module }) => renderSummaryModule(step, module),
    'equation-card-row': ({ step, module }) => {
      const block = blockFor(step, module.payload) ?? blockByModuleId(step, module) ?? step.contentBlocks.target_cards;
      const items = listFromRecordItems(block);
      return <CardGrid title={titleFromModule(module)} items={items} columns="md:grid-cols-4" />;
    },
    'native-table': ({ step, module }) => renderNativeTableModule(step, module),
    'native-formula-table': ({ step, module }) => renderNativeTableModule(step, module),
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
    'native-figure': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const caption = typeof block.caption === 'string' ? block.caption : titleFromModule(module);
      const conclusion = typeof block.conclusion === 'string' ? block.conclusion : undefined;
      const source = typeof block.source === 'string' ? `图源：${block.source}` : undefined;
      return <SummaryCard title={caption} text={conclusion ?? source} bullets={conclusion && source ? [source] : []} />;
    },
    'stat-panel': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const fields = asStringArray(block.fields);
      const bullets = asStringArray(block.bullets);
      const note = typeof block.note === 'string' ? block.note : undefined;
      return <SummaryCard title={titleFromModule(module)} text={note} bullets={[...fields, ...bullets]} />;
    },
  };
}


export {
  tryBeginControlWorkbenchSubmission,
  buildControlWorkbenchRequestForSubmission,
  buildSharedControlWorkbenchEvidenceDraft,
} from './control-workbench-compute-support';
