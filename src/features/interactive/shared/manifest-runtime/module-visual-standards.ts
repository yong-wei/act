import {
  INTERACTIVE_MODULE_DEFINITIONS,
  LEGACY_INTERACTIVE_MODULE_KIND_ALIASES,
  type InteractiveModuleCanonicalClass,
} from './module-taxonomy';

export const INTERACTIVE_MODULE_CHROME_CATEGORIES = [
  'content',
  'interaction',
  'teacher-control',
  'student-state',
  'fallback',
  'layout',
] as const;

export type InteractiveModuleChromeCategory = typeof INTERACTIVE_MODULE_CHROME_CATEGORIES[number];
export type InteractiveModuleRoleState = typeof INTERACTIVE_MODULE_ROLE_STATES[number];
export type InteractiveModuleThemeState = typeof INTERACTIVE_MODULE_THEME_STATES[number];
export type InteractiveModuleViewportState = typeof INTERACTIVE_MODULE_VIEWPORT_STATES[number];

export const INTERACTIVE_MODULE_ROLE_STATES = [
  'student',
  'guest',
  'teacher',
] as const;

export const INTERACTIVE_MODULE_THEME_STATES = [
  'light',
  'dark',
] as const;

export const INTERACTIVE_MODULE_VIEWPORT_STATES = [
  'desktop',
  'mobile',
  'projection',
] as const;

export interface InteractiveModuleVisualStandard {
  canonicalClass: InteractiveModuleCanonicalClass;
  chromeCategory: InteractiveModuleChromeCategory;
  chromeClassName: string;
  projectionSafe: true;
  projectionTypography: 'projection-readable';
  geometry: 'stable-panel';
  teacherControlAttachment: 'module' | 'none';
  roleStates: readonly InteractiveModuleRoleState[];
  themeStates: readonly InteractiveModuleThemeState[];
  viewportStates: readonly InteractiveModuleViewportState[];
}

const SHARED_STATES = {
  projectionSafe: true,
  projectionTypography: 'projection-readable',
  geometry: 'stable-panel',
  roleStates: INTERACTIVE_MODULE_ROLE_STATES,
  themeStates: INTERACTIVE_MODULE_THEME_STATES,
  viewportStates: INTERACTIVE_MODULE_VIEWPORT_STATES,
} as const;

export const INTERACTIVE_MODULE_VISUAL_STANDARDS: Record<InteractiveModuleCanonicalClass, InteractiveModuleVisualStandard> = {
  'content.rich': standard('content.rich', 'content', 'commercial-module-chrome--content', 'none'),
  'content.cardSet': standard('content.cardSet', 'content', 'commercial-module-chrome--card-set', 'none'),
  'content.formula': standard('content.formula', 'content', 'commercial-module-chrome--formula', 'none'),
  'content.code': standard('content.code', 'content', 'commercial-module-chrome--code', 'none'),
  'content.table': standard('content.table', 'content', 'commercial-module-chrome--table', 'none'),
  'content.figure': standard('content.figure', 'content', 'commercial-module-chrome--media', 'none'),
  'content.reveal': standard('content.reveal', 'student-state', 'commercial-module-chrome--reveal', 'module'),
  'content.stageMap': standard('content.stageMap', 'content', 'commercial-module-chrome--stage-map', 'none'),
  'visual.stage': standard('visual.stage', 'interaction', 'commercial-module-chrome--visual-stage', 'module'),
  'visual.derivationStage': standard('visual.derivationStage', 'interaction', 'commercial-module-chrome--visual-derivation-stage', 'module'),
  'visual.blockDiagram': standard('visual.blockDiagram', 'interaction', 'commercial-module-chrome--visual-block-diagram', 'module'),
  'visual.signalFlowGraph': standard('visual.signalFlowGraph', 'interaction', 'commercial-module-chrome--visual-signal-flow-graph', 'module'),
  'visual.annotatedMedia': standard('visual.annotatedMedia', 'interaction', 'commercial-module-chrome--visual-annotated-media', 'module'),
  'visual.embedded-activity': standard('visual.embedded-activity', 'interaction', 'commercial-module-chrome--visual-embedded-activity', 'module'),
  'activity.panel': standard('activity.panel', 'interaction', 'commercial-module-chrome--interaction', 'module'),
  'activity.workspace': standard('activity.workspace', 'interaction', 'commercial-module-chrome--workspace', 'module'),
  'compute.panel': standard('compute.panel', 'interaction', 'commercial-module-chrome--compute', 'module'),
  'analytics.summary': standard('analytics.summary', 'teacher-control', 'commercial-module-chrome--teacher-summary', 'module'),
  'layout.support': standard('layout.support', 'layout', 'commercial-module-chrome--support', 'none'),
  'legacy.adapter': standard('legacy.adapter', 'fallback', 'commercial-module-chrome--fallback', 'none'),
};

function standard(
  canonicalClass: InteractiveModuleCanonicalClass,
  chromeCategory: InteractiveModuleChromeCategory,
  chromeClassName: string,
  teacherControlAttachment: InteractiveModuleVisualStandard['teacherControlAttachment'],
): InteractiveModuleVisualStandard {
  return {
    canonicalClass,
    chromeCategory,
    chromeClassName,
    teacherControlAttachment,
    ...SHARED_STATES,
  };
}

export function resolveInteractiveModuleVisualStandard(kind: string): InteractiveModuleVisualStandard | null {
  if (kind in INTERACTIVE_MODULE_DEFINITIONS) {
    return INTERACTIVE_MODULE_VISUAL_STANDARDS[kind as InteractiveModuleCanonicalClass];
  }

  const alias = LEGACY_INTERACTIVE_MODULE_KIND_ALIASES[kind as keyof typeof LEGACY_INTERACTIVE_MODULE_KIND_ALIASES];
  if (!alias) return null;
  return INTERACTIVE_MODULE_VISUAL_STANDARDS[alias.canonicalClass];
}

export function isActivityRuntimeModuleKind(kind: string): boolean {
  const standard = resolveInteractiveModuleVisualStandard(kind);
  if (!standard) return false;
  return INTERACTIVE_MODULE_DEFINITIONS[standard.canonicalClass].renderBehavior === 'activity-slot';
}
