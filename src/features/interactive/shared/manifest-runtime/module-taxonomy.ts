export const INTERACTIVE_MODULE_CANONICAL_CLASSES = [
  'content.rich',
  'content.cardSet',
  'content.formula',
  'content.table',
  'content.figure',
  'content.reveal',
  'content.stageMap',
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

export const INTERACTIVE_MODULE_RESPONSE_KINDS = [
  'none',
  'singleChoice',
  'binaryChoice',
  'multiSelect',
  'matching',
  'sorting',
  'categorization',
  'shortText',
  'structured',
  'table',
  'parameterRecord',
  'reasonRecord',
  'hotspotLabeling',
] as const;

export type InteractiveModuleResponseKind = typeof INTERACTIVE_MODULE_RESPONSE_KINDS[number];

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
  if (kind.includes('interactive-figure') || kind.includes('rust-') || kind.includes('shared-engine') || kind === 'phase-peak-locator') {
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
  return {
    ...(presentationForLegacyKind(kind) ? { presentation: presentationForLegacyKind(kind) } : {}),
    ...(semanticRoleForLegacyKind(kind) ? { semanticRole: semanticRoleForLegacyKind(kind) } : {}),
    ...(interactionForLegacyKind(kind) ? { interactionKind: interactionForLegacyKind(kind) } : {}),
    ...(responseForLegacyKind(kind) ? { responseKind: responseForLegacyKind(kind) } : {}),
    ...(capabilityForLegacyKind(kind) ? { capabilityRef: capabilityForLegacyKind(kind) } : {}),
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
  if (kind.includes('quiz') || kind.includes('choice') || kind.includes('check') || kind.includes('judge')) return 'quiz';
  if (kind.includes('reason-record')) return 'reason-record';
  if (kind.includes('single-choice')) return 'single-choice';
  if (kind.includes('structured-compare')) return 'structured-compare';
  if (kind.includes('structured-submit')) return 'structured-submit';
  if (kind.includes('table-builder')) return 'table-builder';
  if (kind.includes('teacher-only')) return 'teacher-only';
  return null;
}

function responseForLegacyKind(kind: ObservedLegacyInteractiveModuleKind): InteractiveModuleResponseKind | null {
  if (kind.includes('single-choice') || kind.includes('choice-check') || kind.includes('annotation-choice')) return 'singleChoice';
  if (kind.includes('binary-choice')) return 'binaryChoice';
  if (kind.includes('multi-')) return 'multiSelect';
  if (kind.includes('drag-match') || kind.includes('triple-match')) return 'matching';
  if (kind.includes('sort')) return 'sorting';
  if (kind.includes('categorize')) return 'categorization';
  if (kind.includes('short-response')) return 'shortText';
  if (kind.includes('structured') || kind.includes('three-field-form') || kind.includes('judge-form')) return 'structured';
  if (kind.includes('table-builder')) return 'table';
  if (kind.includes('parametric')) return 'parameterRecord';
  if (kind.includes('reason-record') || kind.includes('single-reason')) return 'reasonRecord';
  if (kind.includes('hotspot') || kind.includes('labeling')) return 'hotspotLabeling';
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
    'multi',
    'quiz',
    'reason-record',
    'response',
    'sort',
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
