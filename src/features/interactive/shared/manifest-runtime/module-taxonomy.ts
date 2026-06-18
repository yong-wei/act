import {
  CANONICAL_INTERACTIVE_RESPONSE_KINDS,
  type InteractiveResponseKind,
} from '@/lib/interactive-response-contracts';

export const INTERACTIVE_MODULE_CANONICAL_CLASSES = [
  'content.rich',
  'content.cardSet',
  'content.formula',
  'content.code',
  'content.table',
  'content.figure',
  'content.reveal',
  'content.stageMap',
  'visual.stage',
  'visual.derivationStage',
  'activity.panel',
  'activity.workspace',
  'compute.panel',
  'analytics.summary',
  'layout.support',
  'legacy.adapter',
] as const;

export type InteractiveModuleCanonicalClass = typeof INTERACTIVE_MODULE_CANONICAL_CLASSES[number];

export const INTERACTIVE_MODULE_PRESENTATION_LAYOUTS = [
  'single',
  'row',
  'grid',
  'strip',
  'tabs',
  'column',
  'matrix',
  'board',
  'fallback',
] as const;

export type InteractiveModulePresentationLayout = typeof INTERACTIVE_MODULE_PRESENTATION_LAYOUTS[number];

export const INTERACTIVE_MODULE_SEMANTIC_ROLES = [
  'goal',
  'boundary',
  'bridge',
  'caseContext',
  'comparison',
  'conclusion',
  'condition',
  'copy',
  'definition',
  'deliverable',
  'entry',
  'evidence',
  'example',
  'feedback',
  'keyTask',
  'media',
  'metric',
  'misconception',
  'nextStep',
  'notice',
  'objective',
  'principle',
  'problem',
  'process',
  'question',
  'record',
  'referenceAnswer',
  'risk',
  'role',
  'rule',
  'summary',
  'target',
  'task',
  'teacherHint',
  'term',
  'template',
  'workedExample',
] as const;

export type InteractiveModuleSemanticRole = typeof INTERACTIVE_MODULE_SEMANTIC_ROLES[number];

export const INTERACTIVE_MODULE_INTERACTION_KINDS = [
  'none',
  'display',
  'ai-assisted',
  'binary-choice',
  'categorization',
  'card-sort',
  'drag-match',
  'figure-submit',
  'hotspot-labeling',
  'multi-select',
  'parameter-workspace',
  'progressive-reveal',
  'quiz',
  'reason-record',
  'single-choice',
  'structured-compare',
  'structured-submit',
  'table-builder',
  'teacher-only',
] as const;

export type InteractiveModuleInteractionKind = typeof INTERACTIVE_MODULE_INTERACTION_KINDS[number];

export const INTERACTIVE_MODULE_RESPONSE_KINDS = CANONICAL_INTERACTIVE_RESPONSE_KINDS;

export type InteractiveModuleResponseKind = InteractiveResponseKind;

export type InteractiveModuleRenderBehavior = 'renderer' | 'activity-slot' | 'layout-only';
export type InteractiveModuleScoringSupport = 'objective' | 'unsupported';

export interface InteractiveModuleDefinition {
  canonicalClass: InteractiveModuleCanonicalClass;
  renderBehavior: InteractiveModuleRenderBehavior;
  configShape: string;
  producesEvidence: boolean;
  allowedInNewAuthoring: boolean;
  requiresResponseContract?: boolean;
  requiresCapabilityRef?: boolean;
  migrationOnly?: true;
}

export interface InteractiveModuleResponseKindDefinition {
  responseKind: InteractiveModuleResponseKind;
  scoring: InteractiveModuleScoringSupport;
}

export interface InteractiveModuleComputeCapabilityDefinition {
  capabilityRef: string;
  description: string;
}

export const CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS = [
  'control-workbench',
  'control-linked-comparison',
  'control-root-locus-design-map',
  'control-frequency-reading-workbench',
  'nonlinear-analysis-workbench',
  'training-workbench',
] as const;

export type ControlWorkbenchComputeCapabilityRef = typeof CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS[number];

export const INTERACTIVE_MODULE_DEFINITIONS: Record<InteractiveModuleCanonicalClass, InteractiveModuleDefinition> = {
  'content.rich': {
    canonicalClass: 'content.rich',
    renderBehavior: 'renderer',
    configShape: 'rich content payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.cardSet': {
    canonicalClass: 'content.cardSet',
    renderBehavior: 'renderer',
    configShape: 'card collection payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.formula': {
    canonicalClass: 'content.formula',
    renderBehavior: 'renderer',
    configShape: 'formula payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.code': {
    canonicalClass: 'content.code',
    renderBehavior: 'renderer',
    configShape: 'code payload with language and source',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.table': {
    canonicalClass: 'content.table',
    renderBehavior: 'renderer',
    configShape: 'table payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.figure': {
    canonicalClass: 'content.figure',
    renderBehavior: 'renderer',
    configShape: 'figure or media payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.reveal': {
    canonicalClass: 'content.reveal',
    renderBehavior: 'renderer',
    configShape: 'progressive reveal payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'content.stageMap': {
    canonicalClass: 'content.stageMap',
    renderBehavior: 'renderer',
    configShape: 'stage map payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'visual.stage': {
    canonicalClass: 'visual.stage',
    renderBehavior: 'renderer',
    configShape: 'normalized 2D stage payload with layers, regions, reveal state, and evidence anchors',
    producesEvidence: true,
    allowedInNewAuthoring: true,
  },
  'visual.derivationStage': {
    canonicalClass: 'visual.derivationStage',
    renderBehavior: 'renderer',
    configShape: 'normalized 2D derivation stage with LaTeX formulas, reveal steps, regions, and teaching-load limits',
    producesEvidence: true,
    allowedInNewAuthoring: true,
  },
  'activity.panel': {
    canonicalClass: 'activity.panel',
    renderBehavior: 'activity-slot',
    configShape: 'activity payload with response contract',
    producesEvidence: true,
    allowedInNewAuthoring: true,
    requiresResponseContract: true,
  },
  'activity.workspace': {
    canonicalClass: 'activity.workspace',
    renderBehavior: 'activity-slot',
    configShape: 'workspace payload with response contract',
    producesEvidence: true,
    allowedInNewAuthoring: true,
    requiresResponseContract: true,
  },
  'compute.panel': {
    canonicalClass: 'compute.panel',
    renderBehavior: 'renderer',
    configShape: 'compute payload with capability reference',
    producesEvidence: true,
    allowedInNewAuthoring: true,
    requiresCapabilityRef: true,
  },
  'analytics.summary': {
    canonicalClass: 'analytics.summary',
    renderBehavior: 'renderer',
    configShape: 'analytics summary payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'layout.support': {
    canonicalClass: 'layout.support',
    renderBehavior: 'layout-only',
    configShape: 'layout helper payload',
    producesEvidence: false,
    allowedInNewAuthoring: true,
  },
  'legacy.adapter': {
    canonicalClass: 'legacy.adapter',
    renderBehavior: 'renderer',
    configShape: 'legacy adapter payload',
    producesEvidence: false,
    allowedInNewAuthoring: false,
    migrationOnly: true,
  },
};

export const INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS: Record<InteractiveModuleResponseKind, InteractiveModuleResponseKindDefinition> = {
  'choice.single': { responseKind: 'choice.single', scoring: 'objective' },
  'choice.binary': { responseKind: 'choice.binary', scoring: 'objective' },
  'choice.multi': { responseKind: 'choice.multi', scoring: 'objective' },
  'text.short': { responseKind: 'text.short', scoring: 'unsupported' },
  'text.long': { responseKind: 'text.long', scoring: 'unsupported' },
  'text.structured': { responseKind: 'text.structured', scoring: 'unsupported' },
  'parameter.set': { responseKind: 'parameter.set', scoring: 'unsupported' },
  'ordering.sequence': { responseKind: 'ordering.sequence', scoring: 'objective' },
  'matching.pairs': { responseKind: 'matching.pairs', scoring: 'objective' },
  'table.builder': { responseKind: 'table.builder', scoring: 'unsupported' },
  'simulation.result': { responseKind: 'simulation.result', scoring: 'unsupported' },
  'training.result': { responseKind: 'training.result', scoring: 'unsupported' },
};

export const INTERACTIVE_MODULE_COMPUTE_CAPABILITY_DEFINITIONS: Record<string, InteractiveModuleComputeCapabilityDefinition> = {
  'interactive-figure': {
    capabilityRef: 'interactive-figure',
    description: 'Runtime interactive figure backed by a shared renderer.',
  },
  'static-surface-3d': {
    capabilityRef: 'static-surface-3d',
    description: 'Precomputed static 3D surface panel with shared rotate and zoom controls.',
  },
  'rust-analysis': {
    capabilityRef: 'rust-analysis',
    description: 'Rust or WASM-backed analysis panel.',
  },
  'shared-engine-root-locus': {
    capabilityRef: 'shared-engine-root-locus',
    description: 'Shared control-engine root locus panel.',
  },
  'phase-peak-locator': {
    capabilityRef: 'phase-peak-locator',
    description: 'Frequency-domain peak locator compute panel.',
  },
  'parametric-risk': {
    capabilityRef: 'parametric-risk',
    description: 'Parametric risk visualization panel.',
  },
  'control-workbench': {
    capabilityRef: 'control-workbench',
    description: 'Shared control workbench embedded in an interactive course.',
  },
  'control-linked-comparison': {
    capabilityRef: 'control-linked-comparison',
    description: 'Shared linked comparison workbench for baseline and parameter variants.',
  },
  'control-root-locus-design-map': {
    capabilityRef: 'control-root-locus-design-map',
    description: 'Shared root locus design map and handle-based design surface.',
  },
  'control-frequency-reading-workbench': {
    capabilityRef: 'control-frequency-reading-workbench',
    description: 'Shared Bode and Nyquist reading workbench.',
  },
  'nonlinear-analysis-workbench': {
    capabilityRef: 'nonlinear-analysis-workbench',
    description: 'Shared nonlinear phase plane and describing-function workbench.',
  },
  'training-workbench': {
    capabilityRef: 'training-workbench',
    description: 'Shared training and policy-learning workbench.',
  },
};

export function isControlWorkbenchComputeCapabilityRef(
  capabilityRef: string | null | undefined,
): capabilityRef is ControlWorkbenchComputeCapabilityRef {
  return typeof capabilityRef === 'string'
    && (CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS as readonly string[]).includes(capabilityRef);
}

export interface LegacyInteractiveModuleKindAlias {
  canonicalClass: InteractiveModuleCanonicalClass;
  migrationOnly: true;
  presentation?: InteractiveModulePresentationLayout;
  semanticRole?: InteractiveModuleSemanticRole;
  interactionKind?: InteractiveModuleInteractionKind;
  responseKind?: InteractiveModuleResponseKind;
  capabilityRef?: string;
}

export const OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS = [
  'activity-card',
  'activity-card-grid',
  'activity-card-set',
  'ai-assistant',
  'analysis-workspace',
  'annotation-choice',
  'band-focus-panel',
  'binary-choice',
  'binary-choice-set',
  'boundary-card',
  'bridge-card',
  'bullet-card',
  'bullet-list-card',
  'card-bank',
  'card-sort',
  'case-context-card',
  'categorize-and-confirm',
  'choice-check',
  'compare-board',
  'comparison-card',
  'comparison-card-row',
  'comparison-graphic',
  'comparison-matrix',
  'comparison-table',
  'conclusion-card-row',
  'conclusion-cards',
  'condition-list',
  'copy-card',
  'decision-matrix',
  'definition-cards',
  'deliverable-card-row',
  'derivation-reveal',
  'diagram-pair',
  'dimension-card-row',
  'drag-match',
  'drag-match-board',
  'drawer',
  'dual-diagram',
  'engineering-diagram',
  'entry-note',
  'equation-card-row',
  'evidence-bank',
  'evidence-card',
  'example-card',
  'feedback-strip',
  'figure',
  'formula-card',
  'formula-card-row',
  'formula-chain',
  'formula-panel',
  'formula-strip',
  'frequency-band-labeling',
  'goal-card',
  'goal-card-row',
  'graphic',
  'hotspot-labeling',
  'illustration',
  'image-card',
  'image-or-table-fallback',
  'image-panel',
  'interactive-figure',
  'interactive-figure-panel',
  'judge-form',
  'key-task-card',
  'learning-stat-panel',
  'media-card',
  'metric-card-row',
  'metric-strip',
  'misconception-note',
  'multi-check',
  'multi-select-matrix',
  'native-figure',
  'native-formula-table',
  'native-svg-diagram',
  'native-table',
  'next-lesson-card',
  'next-step-card',
  'next-step-card-row',
  'note-card',
  'notice-card',
  'object-card',
  'objective-list',
  'parametric-risk-panel',
  'parametric-workspace',
  'path-highlight-stage',
  'performance-summary',
  'phase-peak-locator',
  'principle-card',
  'problem-statement',
  'process-card',
  'question-card',
  'question-card-row',
  'question-card-set',
  'question-list',
  'quiz-card',
  'quiz-group',
  'reason-record',
  'record-card',
  'record-table',
  'reference-answer-card',
  'reflection-card',
  'risk-card',
  'role-card-row',
  'rule-card',
  'rule-card-row',
  'rule-check',
  'rust-analysis-panel',
  'scenario-sort-matrix',
  'sequence-card',
  'shared-engine-root-locus-panel',
  'short-response',
  'single-choice',
  'single-choice-card',
  'single-reason-response',
  'stage-map',
  'stat-panel',
  'step-reveal',
  'step-reveal-chain',
  'step-reveal-column',
  'step-reveal-list',
  'structured-compare',
  'structured-response',
  'structured-submit',
  'submit-feedback-bar',
  'summary-card',
  'summary-card-grid',
  'summary-card-row',
  'summary-chain',
  'summary-graphic',
  'summary-image',
  'summary-list',
  'tabbed-formula-panel',
  'table',
  'table-builder',
  'table-card',
  'target-card',
  'task-card-workspace',
  'task-chain',
  'task-table',
  'teacher-only-distribution',
  'teacher-strip',
  'template-card',
  'term-card-row',
  'term-explainer',
  'three-field-form',
  'title-card',
  'triple-match',
  'two-column-compare',
  'worked-example-card',
  'worked-example-cards',
  'worked-example-workspace',
] as const;

export type ObservedLegacyInteractiveModuleKind = typeof OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS[number];

export const LEGACY_INTERACTIVE_MODULE_KIND_ALIASES: Record<ObservedLegacyInteractiveModuleKind, LegacyInteractiveModuleKindAlias> =
  Object.fromEntries(
    OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS.map((kind) => [kind, defineLegacyInteractiveModuleKindAlias(kind)]),
  ) as Record<ObservedLegacyInteractiveModuleKind, LegacyInteractiveModuleKindAlias>;

function defineLegacyInteractiveModuleKindAlias(kind: ObservedLegacyInteractiveModuleKind): LegacyInteractiveModuleKindAlias {
  return {
    canonicalClass: canonicalClassForLegacyKind(kind),
    migrationOnly: true,
    ...orthogonalFieldsForLegacyKind(kind),
  };
}

function canonicalClassForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModuleCanonicalClass {
  if (kind === 'image-or-table-fallback') return 'legacy.adapter';
  if (kind.includes('interactive-figure') || kind.includes('rust-') || kind.includes('shared-engine') || kind === 'phase-peak-locator' || kind === 'parametric-risk-panel') {
    return 'compute.panel';
  }
  if (kind.includes('workspace')) return 'activity.workspace';
  if (isAnalyticsKind(kind)) return 'analytics.summary';
  if (kind.includes('stage') || kind === 'path-highlight-stage') return 'content.stageMap';
  if (kind.includes('reveal') || kind === 'derivation-reveal') return 'content.reveal';
  if (kind.includes('formula') || kind.includes('equation')) return 'content.formula';
  if (isActivityKind(kind)) return 'activity.panel';
  if (kind.includes('table') || kind.includes('matrix')) return 'content.table';
  if (kind.includes('figure') || kind.includes('graphic') || kind.includes('diagram') || kind.includes('image') || kind === 'illustration') {
    return 'content.figure';
  }
  if (isLayoutSupportKind(kind)) return 'layout.support';
  if (kind.includes('card') || kind.includes('list') || kind.includes('bank') || kind.includes('chain')) return 'content.cardSet';
  return 'content.rich';
}

function orthogonalFieldsForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): Omit<LegacyInteractiveModuleKindAlias, 'canonicalClass' | 'migrationOnly'> {
  const presentation = presentationForLegacyKind(kind);
  const semanticRole = semanticRoleForLegacyKind(kind);
  const interactionKind = interactionForLegacyKind(kind);
  const responseKind = responseForLegacyKind(kind);
  const capabilityRef = capabilityForLegacyKind(kind);

  return {
    ...(presentation ? { presentation } : {}),
    ...(semanticRole ? { semanticRole } : {}),
    ...(interactionKind ? { interactionKind } : {}),
    ...(responseKind ? { responseKind } : {}),
    ...(capabilityRef ? { capabilityRef } : {}),
  };
}

function presentationForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModulePresentationLayout | null {
  if (kind.includes('fallback')) return 'fallback';
  if (kind.includes('row')) return 'row';
  if (kind.includes('grid')) return 'grid';
  if (kind.includes('strip')) return 'strip';
  if (kind.includes('tabbed')) return 'tabs';
  if (kind.includes('column') || kind.includes('two-column')) return 'column';
  if (kind.includes('matrix')) return 'matrix';
  if (kind.includes('board')) return 'board';
  return 'single';
}

function semanticRoleForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModuleSemanticRole | null {
  if (kind.includes('goal')) return 'goal';
  if (kind.includes('boundary')) return 'boundary';
  if (kind.includes('bridge')) return 'bridge';
  if (kind.includes('case-context')) return 'caseContext';
  if (kind.includes('compare') || kind.includes('comparison')) return 'comparison';
  if (kind.includes('conclusion')) return 'conclusion';
  if (kind.includes('condition')) return 'condition';
  if (kind.includes('copy')) return 'copy';
  if (kind.includes('definition')) return 'definition';
  if (kind.includes('deliverable')) return 'deliverable';
  if (kind.includes('entry')) return 'entry';
  if (kind.includes('evidence')) return 'evidence';
  if (kind.includes('example')) return 'example';
  if (kind.includes('feedback')) return 'feedback';
  if (kind.includes('key-task')) return 'keyTask';
  if (kind.includes('media')) return 'media';
  if (kind.includes('metric')) return 'metric';
  if (kind.includes('misconception')) return 'misconception';
  if (kind.includes('next-')) return 'nextStep';
  if (kind.includes('notice')) return 'notice';
  if (kind.includes('objective')) return 'objective';
  if (kind.includes('principle')) return 'principle';
  if (kind.includes('problem')) return 'problem';
  if (kind.includes('process')) return 'process';
  if (kind.includes('question')) return 'question';
  if (kind.includes('record')) return 'record';
  if (kind.includes('reference-answer')) return 'referenceAnswer';
  if (kind.includes('risk')) return 'risk';
  if (kind.includes('role')) return 'role';
  if (kind.includes('rule')) return 'rule';
  if (kind.includes('summary')) return 'summary';
  if (kind.includes('target')) return 'target';
  if (kind.includes('task')) return 'task';
  if (kind.includes('teacher')) return 'teacherHint';
  if (kind.includes('term')) return 'term';
  if (kind.includes('template')) return 'template';
  if (kind.includes('worked-example')) return 'workedExample';
  return null;
}

function interactionForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModuleInteractionKind | null {
  if (kind === 'ai-assistant') return 'ai-assisted';
  if (kind.includes('binary-choice')) return 'binary-choice';
  if (kind.includes('categorize')) return 'categorization';
  if (kind.includes('card-sort') || kind.includes('scenario-sort')) return 'card-sort';
  if (kind.includes('drag-match') || kind.includes('triple-match')) return 'drag-match';
  if (kind.includes('hotspot') || kind.includes('labeling')) return 'hotspot-labeling';
  if (kind.includes('multi-')) return 'multi-select';
  if (kind.includes('parametric')) return 'parameter-workspace';
  if (kind.includes('reveal')) return 'progressive-reveal';
  if (kind.includes('single-choice')) return 'single-choice';
  if (kind.includes('quiz') || kind.includes('choice') || kind.includes('check') || kind.includes('judge')) return 'quiz';
  if (kind.includes('reason-record')) return 'reason-record';
  if (kind.includes('structured-compare')) return 'structured-compare';
  if (kind.includes('structured-submit')) return 'structured-submit';
  if (kind.includes('table-builder')) return 'table-builder';
  if (kind.includes('teacher-only')) return 'teacher-only';
  return null;
}

function responseForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModuleResponseKind | null {
  if (kind.includes('single-choice') || kind.includes('choice-check') || kind.includes('annotation-choice')) return 'choice.single';
  if (kind.includes('binary-choice')) return 'choice.binary';
  if (kind.includes('multi-')) return 'choice.multi';
  if (kind.includes('drag-match') || kind.includes('triple-match')) return 'matching.pairs';
  if (kind.includes('sort')) return 'ordering.sequence';
  if (kind.includes('categorize')) return 'text.structured';
  if (kind.includes('short-response')) return 'text.short';
  if (kind.includes('structured') || kind.includes('three-field-form') || kind.includes('judge-form')) return 'text.structured';
  if (kind.includes('table-builder')) return 'table.builder';
  if (kind.includes('parametric')) return 'parameter.set';
  if (kind.includes('workspace')) return 'text.structured';
  if (kind.includes('reason-record') || kind.includes('single-reason')) return 'text.structured';
  if (kind.includes('hotspot') || kind.includes('labeling')) return 'matching.pairs';
  return null;
}

function capabilityForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): string | null {
  if (kind === 'interactive-figure' || kind === 'interactive-figure-panel') return 'interactive-figure';
  if (kind === 'rust-analysis-panel') return 'rust-analysis';
  if (kind === 'shared-engine-root-locus-panel') return 'shared-engine-root-locus';
  if (kind === 'phase-peak-locator') return 'phase-peak-locator';
  if (kind === 'parametric-risk-panel') return 'parametric-risk';
  return null;
}

function isActivityKind(kind: ObservedLegacyInteractiveModuleKind): boolean {
  return [
    'activity',
    'choice',
    'check',
    'confirm',
    'drag',
    'form',
    'hotspot',
    'judge',
    'labeling',
    'multi',
    'quiz',
    'reason-record',
    'response',
    'sort',
    'structured-compare',
    'submit',
    'table-builder',
    'triple-match',
  ].some((token) => kind.includes(token));
}

function isAnalyticsKind(kind: ObservedLegacyInteractiveModuleKind): boolean {
  return [
    'learning-stat-panel',
    'performance-summary',
    'stat-panel',
    'teacher-only-distribution',
  ].includes(kind);
}

function isLayoutSupportKind(kind: ObservedLegacyInteractiveModuleKind): boolean {
  return [
    'drawer',
    'entry-note',
    'feedback-strip',
    'next-lesson-card',
    'next-step-card',
    'submit-feedback-bar',
    'teacher-strip',
    'title-card',
  ].includes(kind);
}
