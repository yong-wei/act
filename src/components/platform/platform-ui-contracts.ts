export type PlatformRole = 'student' | 'teacher' | 'admin' | 'audit';
export type PlatformNavigationAudience = PlatformRole | 'guest' | 'all';
export type PlatformNavigationAvailability = 'enabled' | 'disabled' | 'hidden';
export type PlatformStatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';
export type PlatformStatusRoleScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';
export type PlatformStatusDomain =
  | 'simulation'
  | 'arena'
  | 'learner-state'
  | 'path'
  | 'konling'
  | 'resource-node'
  | 'teacher-management'
  | 'experiment';
export type PlatformStatusRenderingVariant =
  | 'compact-chip'
  | 'inline-explanation'
  | 'detail-panel'
  | 'audit-row'
  | 'empty-state'
  | 'error-state';
export type PlatformConfidenceStatus = 'high' | 'medium' | 'low' | 'unknown';
export type PlatformSourceCoverageStatus = 'complete' | 'partial' | 'stale' | 'missing' | 'unsupported';
export type PlatformPrivacyStatus = 'public' | 'classroom' | 'restricted' | 'private';
export type PlatformReplayStatus = 'ready' | 'partial' | 'stale' | 'missing' | 'unsupported';
export type PlatformProtocolStatus = 'current' | 'preview' | 'legacy' | 'unsupported' | 'missing';
export type PlatformEvaluationStatus = 'official' | 'preview' | 'hidden' | 'not-evaluated';
export type PlatformReadinessStatus = 'ready' | 'degraded' | 'blocked' | 'not-ready';
export type PlatformFallbackStatus = 'none' | 'fallback-active' | 'fallback-missing-context' | 'unsupported';

export type PlatformTokenCategory =
  | 'canvas'
  | 'surface'
  | 'foreground'
  | 'border'
  | 'action'
  | 'evidence'
  | 'privacy'
  | 'replay'
  | 'evaluation'
  | 'chart';
export type PlatformThemeMode = 'light' | 'dark';
export type PlatformPremiumVisualRole =
  | 'matte-chart'
  | 'engineering-paper'
  | 'instrument-panel'
  | 'evidence-state'
  | 'night-navigation'
  | 'low-light-instrument'
  | 'trace-signal'
  | 'warning-success-signal';
export type PlatformFloatingActionDockControl = 'konling' | 'management' | 'settings' | 'page-tools' | 'issue-badge';
export type PlatformFloatingActionDockVisibility = 'role-aware' | 'feature-flagged' | 'workspace-hidden';
export type PlatformFloatingActionDockResponsiveMode = 'expanded' | 'collapsed-icons' | 'hidden-by-workspace';

export interface PlatformSemanticToken {
  name: string;
  category: PlatformTokenCategory;
  purpose: string;
}

export interface PlatformPremiumVisualThemeContract {
  theme: PlatformThemeMode;
  visualWorld: string;
  requiredRoles: readonly PlatformPremiumVisualRole[];
  requiredTokenCategories: readonly PlatformTokenCategory[];
  prohibitedFallbacks: readonly string[];
}

export interface PlatformNavigationItem {
  id: string;
  label: string;
  href: string;
  role: PlatformNavigationAudience;
  order: number;
  group?: string;
  description?: string;
  iconKey?: string;
  actionLabel?: string;
  actionPriority?: number;
  featureFlag?: string;
  availability?: PlatformNavigationAvailability;
  disabledReason?: string;
  aliasHrefs?: readonly string[];
  children?: PlatformNavigationItem[];
}

export interface PlatformStatusCategories {
  confidence: PlatformConfidenceStatus;
  sourceCoverage: PlatformSourceCoverageStatus;
  privacy: PlatformPrivacyStatus;
  replay: PlatformReplayStatus;
  protocol: PlatformProtocolStatus;
  evaluation: PlatformEvaluationStatus;
  readiness: PlatformReadinessStatus;
  fallback: PlatformFallbackStatus;
}

export interface PlatformStatusSource {
  domain: PlatformStatusDomain;
  capability: string;
}

export interface PlatformStatusDetail {
  label: string;
  value: string;
  roleScope: PlatformStatusRoleScope;
  restricted?: boolean;
}

export interface PlatformStatusPayload {
  id: string;
  label: string;
  categories: PlatformStatusCategories;
  source: PlatformStatusSource;
  summary?: string;
  details?: readonly PlatformStatusDetail[];
  fallbackReason?: string;
}

export interface PlatformStatusViewModel {
  id: string;
  label: string;
  summaryLabel: string;
  summary?: string;
  tone: PlatformStatusTone;
  tokenNames: string[];
  sourceLabel: string;
  details: PlatformStatusDetail[];
  fallbackReason?: string;
}

export interface PlatformStatusRenderOptions {
  role: PlatformRole;
}

export interface PlatformStatusRenderingContract {
  variant: PlatformStatusRenderingVariant;
  purpose: string;
  requiredPayload: string;
}

export interface PlatformStatusIntegrationContract {
  domain: PlatformStatusDomain;
  acceptedPayload: string;
  domainOwnership: string;
  sharedPrimitiveRule: string;
}

export interface PlatformNavigationFilter {
  role: PlatformRole | 'guest';
  enabledFeatureFlags?: readonly string[];
  includeDisabled?: boolean;
  includeHidden?: boolean;
}

export interface PlatformShellAdapter {
  legacyComponent: 'FeaturePageNav' | 'UnifiedTopBar' | 'ArenaPageShell' | 'TeacherLayout' | 'AdminConsoleHeader';
  adapterContract: string;
  migrationRule: string;
}

export interface PlatformLegacyShellRetirementContract {
  legacyComponent: PlatformShellAdapter['legacyComponent'];
  allowedDisposition: 'retire-or-adapt';
  preservationRequirements: readonly string[];
  retirementRule: string;
}

export interface PlatformFloatingActionDockContract {
  owner: 'platform-shell';
  controls: readonly PlatformFloatingActionDockControl[];
  visibility: PlatformFloatingActionDockVisibility;
  bottomOffset: string;
  rightOffset: string;
  spacing: string;
  minHitTargetPx: number;
  zIndexToken: string;
  responsiveModes: readonly PlatformFloatingActionDockResponsiveMode[];
  collisionRules: readonly string[];
  keyboardRules: readonly string[];
}

export interface PlatformFloatingActionDockControlContract {
  control: PlatformFloatingActionDockControl;
  roleScope: readonly PlatformNavigationAudience[];
  purpose: string;
  hiddenWhen: readonly string[];
  payloadBoundary: string;
}

export interface PlatformDockControlDispositionContract {
  legacyComponent: 'PageFloatingControls' | 'GlobalAIFloatingButton';
  owner: 'platform-shell';
  disposition: 'register-or-retire';
  replacementControl: PlatformFloatingActionDockControl;
  removalCondition: string;
  collisionRequirements: readonly string[];
}

export interface PlatformCommercialWorkspaceShell {
  workspace: 'simulation' | 'arena' | 'control-workbench' | 'interactive-learning' | 'adaptive-learning' | 'teacher' | 'data-center' | 'admin';
  derivedFrom: 'commercial-platform-shell';
  density: 'tool' | 'learning' | 'analytics' | 'governance';
  zones: readonly PlatformCommercialWorkspaceZoneId[];
  contextualNavigation: string;
  inheritsTokenCategories: readonly PlatformTokenCategory[];
  requiredConventions: readonly string[];
}

export type PlatformCommercialWorkspaceZoneId =
  | 'context-strip'
  | 'command-bar'
  | 'instrument-area'
  | 'evidence-rail'
  | 'support-drawer';

export interface PlatformCommercialWorkspaceZone {
  id: PlatformCommercialWorkspaceZoneId;
  label: string;
  purpose: string;
  domainOwnership: 'feature-owned';
  presentationOwnership: 'shared-commercial-surface';
}

export interface PlatformCommercialWorkspaceRoute {
  href: string;
  workspace: PlatformCommercialWorkspaceShell['workspace'];
  density: PlatformCommercialWorkspaceShell['density'];
  representativeSurface: string;
  expectedZones: readonly PlatformCommercialWorkspaceZoneId[];
}

export const PLATFORM_SHELL_ROLLBACK_FLAG = 'platform.unifiedShell';

export const PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS: PlatformPremiumVisualThemeContract[] = [
  {
    theme: 'light',
    visualWorld: 'matte chart paper with engineering instruments and governed evidence signals',
    requiredRoles: ['matte-chart', 'engineering-paper', 'instrument-panel', 'evidence-state'],
    requiredTokenCategories: ['canvas', 'surface', 'foreground', 'border', 'action', 'evidence', 'chart'],
    prohibitedFallbacks: [
      'unrelated white-card administration styling',
      'page-local pastel marketing palette',
      'decorative gradients without token roles',
    ],
  },
  {
    theme: 'dark',
    visualWorld: 'night-navigation control desk with low-light instruments and readable traces',
    requiredRoles: ['night-navigation', 'low-light-instrument', 'trace-signal', 'warning-success-signal'],
    requiredTokenCategories: ['canvas', 'surface', 'foreground', 'border', 'action', 'evidence', 'chart'],
    prohibitedFallbacks: [
      'washed-out inverted light theme',
      'low-contrast chart traces',
      'hidden controls on dark surfaces',
    ],
  },
] as const;

const PLATFORM_STATUS_LABELS = {
  confidence: {
    high: '高置信',
    medium: '中置信',
    low: '低置信',
    unknown: '置信未知',
  },
  sourceCoverage: {
    complete: '完整覆盖',
    partial: '部分覆盖',
    stale: '覆盖过期',
    missing: '缺少来源',
    unsupported: '来源不支持',
  },
  privacy: {
    public: '公开',
    classroom: '课堂可见',
    restricted: '受限',
    private: '私有',
  },
  replay: {
    ready: '回放就绪',
    partial: '回放部分可用',
    stale: '回放过期',
    missing: '缺少回放',
    unsupported: '回放不支持',
  },
  protocol: {
    current: '当前协议',
    preview: '预览协议',
    legacy: '旧协议',
    unsupported: '协议不支持',
    missing: '缺少协议',
  },
  evaluation: {
    official: '正式评价',
    preview: '预览评价',
    hidden: '隐藏评价',
    'not-evaluated': '未评价',
  },
  readiness: {
    ready: '就绪',
    degraded: '降级可用',
    blocked: '阻塞',
    'not-ready': '未就绪',
  },
  fallback: {
    none: '无回退',
    'fallback-active': '已使用回退',
    'fallback-missing-context': '上下文不足',
    unsupported: '回退不支持',
  },
} as const;

export const PLATFORM_STATUS_TOKEN_MAP = {
  confidence: {
    high: 'platform-evidence-eligible',
    medium: 'platform-evidence-context',
    low: 'platform-evidence-context',
    unknown: 'platform-evidence-unsupported',
  },
  sourceCoverage: {
    complete: 'platform-evidence-eligible',
    partial: 'platform-evidence-context',
    stale: 'platform-evidence-context',
    missing: 'platform-evidence-unsupported',
    unsupported: 'platform-evidence-unsupported',
  },
  privacy: {
    public: 'platform-privacy-public',
    classroom: 'platform-privacy-public',
    restricted: 'platform-privacy-restricted',
    private: 'platform-privacy-private',
  },
  replay: {
    ready: 'platform-replay-ready',
    partial: 'platform-replay-partial',
    stale: 'platform-replay-partial',
    missing: 'platform-replay-missing',
    unsupported: 'platform-replay-missing',
  },
  protocol: {
    current: 'platform-action-primary',
    preview: 'platform-action-subtle',
    legacy: 'platform-action-subtle',
    unsupported: 'platform-evidence-unsupported',
    missing: 'platform-evidence-unsupported',
  },
  evaluation: {
    official: 'platform-evaluation-official',
    preview: 'platform-evaluation-preview',
    hidden: 'platform-evaluation-hidden',
    'not-evaluated': 'platform-evidence-context',
  },
  readiness: {
    ready: 'platform-evidence-eligible',
    degraded: 'platform-evidence-context',
    blocked: 'platform-evidence-unsupported',
    'not-ready': 'platform-evidence-unsupported',
  },
  fallback: {
    none: 'platform-evidence-eligible',
    'fallback-active': 'platform-action-subtle',
    'fallback-missing-context': 'platform-evidence-context',
    unsupported: 'platform-evidence-unsupported',
  },
} as const satisfies {
  confidence: Record<PlatformConfidenceStatus, string>;
  sourceCoverage: Record<PlatformSourceCoverageStatus, string>;
  privacy: Record<PlatformPrivacyStatus, string>;
  replay: Record<PlatformReplayStatus, string>;
  protocol: Record<PlatformProtocolStatus, string>;
  evaluation: Record<PlatformEvaluationStatus, string>;
  readiness: Record<PlatformReadinessStatus, string>;
  fallback: Record<PlatformFallbackStatus, string>;
};

export const PLATFORM_STATUS_RENDERING_CONTRACTS: PlatformStatusRenderingContract[] = [
  {
    variant: 'compact-chip',
    purpose: 'Render a terse label and tone for dense tables, headers, and cards.',
    requiredPayload: 'Governed status categories plus role scope.',
  },
  {
    variant: 'inline-explanation',
    purpose: 'Render a short summary with limiting coverage or fallback reason.',
    requiredPayload: 'Governed status categories, source summary, and optional fallback reason.',
  },
  {
    variant: 'detail-panel',
    purpose: 'Render role-filtered details without exposing restricted payloads.',
    requiredPayload: 'Governed details with explicit roleScope and restricted markers.',
  },
  {
    variant: 'audit-row',
    purpose: 'Render compact evidence source, role scope, and status trail rows.',
    requiredPayload: 'Governed status source and role-filtered details.',
  },
  {
    variant: 'empty-state',
    purpose: 'Render missing evidence or missing context as an intentional state.',
    requiredPayload: 'Human-authored title and description from the owning feature.',
  },
  {
    variant: 'error-state',
    purpose: 'Render unavailable status surfaces without implying evidence failure.',
    requiredPayload: 'Human-authored title and description from the owning feature.',
  },
];

export const PLATFORM_STATUS_INTEGRATION_CONTRACTS: PlatformStatusIntegrationContract[] = [
  {
    domain: 'simulation',
    acceptedPayload: 'Replay/checksum readiness and source coverage from simulation runtime contracts.',
    domainOwnership: 'Simulation code computes replay status, checksum validity, and protocol support.',
    sharedPrimitiveRule: 'Shared primitives are display-only and map the governed payload to labels and tones.',
  },
  {
    domain: 'arena',
    acceptedPayload: 'Official/preview evaluation, confidence, and source coverage from Arena evaluation contracts.',
    domainOwnership: 'Arena code computes scoring mode, official boundary, and evidence completeness.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never decide official evaluation status.',
  },
  {
    domain: 'learner-state',
    acceptedPayload: 'Confidence, coverage, and privacy scope from learner-state services.',
    domainOwnership: 'Learner-state code computes competency state, confidence, authorization, and freshness.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never derive learner state.',
  },
  {
    domain: 'path',
    acceptedPayload: 'Readiness, fallback reason, and source coverage from path planning services.',
    domainOwnership: 'Path code computes recommendation readiness, prerequisites, and fallback decisions.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never choose a path or intervention.',
  },
  {
    domain: 'konling',
    acceptedPayload: 'Privacy scope, confidence, and fallback status from governed Konling payloads.',
    domainOwnership: 'Konling code computes memory access policy, intervention state, and private context.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never expose private memory.',
  },
  {
    domain: 'resource-node',
    acceptedPayload: 'ResourceNode audit readiness and protocol status from resource graph contracts.',
    domainOwnership: 'ResourceNode code computes node readiness, mapping status, and audit findings.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never mark resources plannable.',
  },
  {
    domain: 'teacher-management',
    acceptedPayload: 'Teacher-scoped source coverage and privacy status from management features.',
    domainOwnership: 'Teacher feature code computes scoped roster, classroom, and student evidence authorization.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never bypass teacher policy checks.',
  },
  {
    domain: 'experiment',
    acceptedPayload: 'Preview, readiness, confidence, and fallback status from experiment contracts.',
    domainOwnership: 'Experiment code computes protocol compatibility, rollout readiness, and result confidence.',
    sharedPrimitiveRule: 'Shared primitives are display-only and never decide experiment validity.',
  },
];

export const PLATFORM_SEMANTIC_TOKENS: PlatformSemanticToken[] = [
  { name: 'platform-canvas', category: 'canvas', purpose: 'Page background canvas for role and product workspaces.' },
  { name: 'platform-canvas-muted', category: 'canvas', purpose: 'Subtle canvas band for dense dashboards and side regions.' },
  { name: 'platform-surface', category: 'surface', purpose: 'Default panel, card, and tool surface.' },
  { name: 'platform-surface-raised', category: 'surface', purpose: 'Raised surface for headers, sticky panels, and prominent cards.' },
  { name: 'platform-surface-overlay', category: 'surface', purpose: 'Overlay surface for drawers, menus, and dialogs.' },
  { name: 'platform-fg-primary', category: 'foreground', purpose: 'Primary foreground text.' },
  { name: 'platform-fg-secondary', category: 'foreground', purpose: 'Secondary foreground text and supporting copy.' },
  { name: 'platform-fg-muted', category: 'foreground', purpose: 'Muted labels, captions, and disabled contextual text.' },
  { name: 'platform-fg-inverse', category: 'foreground', purpose: 'Foreground text on strong action or inverse surfaces.' },
  { name: 'platform-border', category: 'border', purpose: 'Default structural border.' },
  { name: 'platform-border-strong', category: 'border', purpose: 'Emphasis border for selected or elevated regions.' },
  { name: 'platform-action-primary', category: 'action', purpose: 'Primary command, selected navigation, and focus affordance.' },
  { name: 'platform-action-hover', category: 'action', purpose: 'Hover and active command surface.' },
  { name: 'platform-action-subtle', category: 'action', purpose: 'Low-emphasis action background.' },
  { name: 'platform-evidence-eligible', category: 'evidence', purpose: 'Evidence source can contribute to governed learner state.' },
  { name: 'platform-evidence-context', category: 'evidence', purpose: 'Evidence source is contextual or low value.' },
  { name: 'platform-evidence-unsupported', category: 'evidence', purpose: 'Evidence source is not profile-ready.' },
  { name: 'platform-privacy-public', category: 'privacy', purpose: 'Public or classroom-visible evidence status.' },
  { name: 'platform-privacy-restricted', category: 'privacy', purpose: 'Restricted evidence or hidden evaluation boundary.' },
  { name: 'platform-privacy-private', category: 'privacy', purpose: 'Private learner evidence or memory boundary.' },
  { name: 'platform-replay-ready', category: 'replay', purpose: 'Replay metadata is complete.' },
  { name: 'platform-replay-partial', category: 'replay', purpose: 'Replay metadata is partial or degraded.' },
  { name: 'platform-replay-missing', category: 'replay', purpose: 'Replay metadata is unavailable.' },
  { name: 'platform-evaluation-official', category: 'evaluation', purpose: 'Official evaluation result.' },
  { name: 'platform-evaluation-preview', category: 'evaluation', purpose: 'Preview or rehearsal evaluation result.' },
  { name: 'platform-evaluation-hidden', category: 'evaluation', purpose: 'Hidden evaluation scenario or protected result.' },
  { name: 'platform-chart-1', category: 'chart', purpose: 'Primary chart series color for commercial dashboards.' },
  { name: 'platform-chart-2', category: 'chart', purpose: 'Secondary chart series color for commercial dashboards.' },
  { name: 'platform-chart-3', category: 'chart', purpose: 'Success or growth chart series color for commercial dashboards.' },
  { name: 'platform-chart-4', category: 'chart', purpose: 'Warning or variance chart series color for commercial dashboards.' },
  { name: 'platform-chart-5', category: 'chart', purpose: 'Comparison chart series color for commercial dashboards.' },
  { name: 'platform-chart-6', category: 'chart', purpose: 'Accent chart series color for commercial dashboards.' },
];

export const PLATFORM_SHELL_ADAPTERS: PlatformShellAdapter[] = [
  {
    legacyComponent: 'FeaturePageNav',
    adapterContract: 'Map local back-link title bars to AppHeader title, breadcrumb, and page action slots.',
    migrationRule: 'Preserve route behavior and floating mode while delegating shared visual treatment to platform primitives.',
  },
  {
    legacyComponent: 'UnifiedTopBar',
    adapterContract: 'Map cockpit routing, back link, subtitle, and right slot into AppHeader and AppBreadcrumb props.',
    migrationRule: 'Keep existing role cockpit destinations until role navigation schema owns the page entry.',
  },
  {
    legacyComponent: 'ArenaPageShell',
    adapterContract: 'Map Arena breadcrumbs and active path into AppShell navigation and product-content slots.',
    migrationRule: 'Keep Arena scoring, submissions, and task orchestration in src/features/arena.',
  },
  {
    legacyComponent: 'TeacherLayout',
    adapterContract: 'Map teacher cockpit navigation into AppSidebar while preserving authenticated layout behavior.',
    migrationRule: 'Keep class/session data loading in teacher feature and route layers.',
  },
  {
    legacyComponent: 'AdminConsoleHeader',
    adapterContract: 'Map admin headings, status notes, tabs, and action slots into AppHeader and PlatformSurface variants.',
    migrationRule: 'Keep governance data aggregation and redaction decisions in admin/data-governance feature modules.',
  },
];

export const PLATFORM_LEGACY_SHELL_RETIREMENT_CONTRACTS: PlatformLegacyShellRetirementContract[] = [
  {
    legacyComponent: 'UnifiedTopBar',
    allowedDisposition: 'retire-or-adapt',
    preservationRequirements: ['route access', 'role actions', 'contextual navigation'],
    retirementRule: 'Replace with a commercial shell when the page can preserve cockpit routing, back links, and right-side actions.',
  },
  {
    legacyComponent: 'ArenaPageShell',
    allowedDisposition: 'retire-or-adapt',
    preservationRequirements: ['route access', 'role actions', 'contextual navigation'],
    retirementRule: 'Replace with a commercial shell when Arena task, scoring, and submission context remain owned by Arena modules.',
  },
  {
    legacyComponent: 'TeacherLayout',
    allowedDisposition: 'retire-or-adapt',
    preservationRequirements: ['route access', 'role actions', 'contextual navigation'],
    retirementRule: 'Replace with a commercial shell when authenticated teacher routing and class/session actions remain intact.',
  },
  {
    legacyComponent: 'AdminConsoleHeader',
    allowedDisposition: 'retire-or-adapt',
    preservationRequirements: ['route access', 'role actions', 'contextual navigation'],
    retirementRule: 'Replace with a commercial shell when admin governance tabs, status notes, and actions remain reachable.',
  },
  {
    legacyComponent: 'FeaturePageNav',
    allowedDisposition: 'retire-or-adapt',
    preservationRequirements: ['route access', 'role actions', 'contextual navigation'],
    retirementRule: 'Replace with a commercial shell when local return links and floating tool mode are preserved.',
  },
] as const;

export const PLATFORM_FLOATING_ACTION_DOCK_CONTRACT: PlatformFloatingActionDockContract = {
  owner: 'platform-shell',
  controls: ['konling', 'management', 'settings', 'page-tools', 'issue-badge'],
  visibility: 'role-aware',
  bottomOffset: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
  rightOffset: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
  spacing: '0.5rem',
  minHitTargetPx: 44,
  zIndexToken: 'platform-floating-dock',
  responsiveModes: ['expanded', 'collapsed-icons', 'hidden-by-workspace'],
  collisionRules: [
    'dock owns bottom-right fixed controls on primary platform routes',
    'page-local fixed buttons must register as dock controls or move into local tool navigation',
    'mobile collapse must not cover primary submit, playback, or lesson navigation controls',
  ],
  keyboardRules: [
    'controls remain reachable in document order after page-local toolbars',
    'collapsed icon controls expose accessible labels',
    'hidden controls do not leave orphan focus targets',
  ],
} as const;

export const PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS: PlatformFloatingActionDockControlContract[] = [
  {
    control: 'konling',
    roleScope: ['student', 'teacher', 'admin'],
    purpose: 'Open governed assistant, coaching, or support affordances without page-local fixed buttons.',
    hiddenWhen: ['feature flag disabled', 'workspace uses a modal assistant surface', 'role cannot access assistant context'],
    payloadBoundary: 'Dock receives visibility and launcher state only; feature-owned assistant modules own private memory and prompts.',
  },
  {
    control: 'management',
    roleScope: ['teacher', 'admin'],
    purpose: 'Expose teacher/admin management shortcuts without competing with local workspace command bars.',
    hiddenWhen: ['role lacks management permissions', 'route frame declares management controls local-only'],
    payloadBoundary: 'Dock does not fetch classroom, roster, governance, or audit payloads.',
  },
  {
    control: 'settings',
    roleScope: ['student', 'teacher', 'admin'],
    purpose: 'Expose theme, density, account, and workspace preference entry points consistently.',
    hiddenWhen: ['workspace takes over settings in an immersive full-screen mode'],
    payloadBoundary: 'Dock receives account/action metadata only; profile and authorization data stay in auth and route layers.',
  },
  {
    control: 'page-tools',
    roleScope: ['student', 'teacher', 'admin'],
    purpose: 'Host route-owned tools, report actions, classroom controls, and workspace support drawers without separate fixed systems.',
    hiddenWhen: ['route has no page-local tools', 'immersive route declares hidden dock behavior'],
    payloadBoundary: 'Dock receives registration metadata only; page-owned modules retain command execution and data loading.',
  },
  {
    control: 'issue-badge',
    roleScope: ['teacher', 'admin'],
    purpose: 'Expose governance, evidence, or issue count badges without overlapping forms, charts, report labels, or graph canvases.',
    hiddenWhen: ['route has no issue badge', 'badge is rendered inline in a report table'],
    payloadBoundary: 'Dock receives count, label, and target href only; issue details remain in feature-owned routes.',
  },
] as const;

export const PLATFORM_DOCK_CONTROL_DISPOSITION_CONTRACTS: PlatformDockControlDispositionContract[] = [
  {
    legacyComponent: 'PageFloatingControls',
    owner: 'platform-shell',
    disposition: 'register-or-retire',
    replacementControl: 'page-tools',
    removalCondition: 'PageFloatingControls registrations move into the shared dock or route-local command surfaces retire their fixed bottom-right placement.',
    collisionRequirements: ['safe-area', 'z-index', 'keyboard reachability', 'primary task control clearance'],
  },
  {
    legacyComponent: 'GlobalAIFloatingButton',
    owner: 'platform-shell',
    disposition: 'register-or-retire',
    replacementControl: 'konling',
    removalCondition: 'GlobalAIFloatingButton registers through the shared dock and no longer renders as an independent fixed control.',
    collisionRequirements: ['safe-area', 'z-index', 'keyboard reachability', 'primary task control clearance'],
  },
] as const;

const commercialWorkspaceShellConventions = [
  'account/profile action remains secondary to role cockpit action',
  'contextual navigation does not duplicate global product navigation',
  'panel wrappers preserve stable width and height while controls or fallback text change',
] as const;

const commercialWorkspaceShellTokenCategories = [
  'canvas',
  'surface',
  'foreground',
  'border',
  'action',
  'evidence',
  'privacy',
] as const;

export const PLATFORM_COMMERCIAL_WORKSPACE_ZONES: PlatformCommercialWorkspaceZone[] = [
  {
    id: 'context-strip',
    label: 'Context strip',
    purpose: 'Expose object, mode, route source, class, challenge, lesson, or return context.',
    domainOwnership: 'feature-owned',
    presentationOwnership: 'shared-commercial-surface',
  },
  {
    id: 'command-bar',
    label: 'Command bar',
    purpose: 'Expose primary submit, save, reset, view, report, and role operations.',
    domainOwnership: 'feature-owned',
    presentationOwnership: 'shared-commercial-surface',
  },
  {
    id: 'instrument-area',
    label: 'Instrument area',
    purpose: 'Hold charts, diagrams, media, lesson modules, simulators, and analysis panels.',
    domainOwnership: 'feature-owned',
    presentationOwnership: 'shared-commercial-surface',
  },
  {
    id: 'evidence-rail',
    label: 'Evidence rail',
    purpose: 'Show confidence, official or preview state, coverage, readiness, and missing context.',
    domainOwnership: 'feature-owned',
    presentationOwnership: 'shared-commercial-surface',
  },
  {
    id: 'support-drawer',
    label: 'Support drawer',
    purpose: 'Hold explanations, hints, logs, assistant support, and teacher-only controls.',
    domainOwnership: 'feature-owned',
    presentationOwnership: 'shared-commercial-surface',
  },
] as const;

const commercialWorkspaceZoneIds = PLATFORM_COMMERCIAL_WORKSPACE_ZONES.map((zone) => zone.id);

export const PLATFORM_COMMERCIAL_WORKSPACE_SHELLS: PlatformCommercialWorkspaceShell[] = [
  {
    workspace: 'simulation',
    derivedFrom: 'commercial-platform-shell',
    density: 'tool',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Simulation catalog, launch provenance, scene tools, replay, and route-derived return target context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'arena',
    derivedFrom: 'commercial-platform-shell',
    density: 'tool',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Arena challenge, publication, ranking, submission, and return target context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'control-workbench',
    derivedFrom: 'commercial-platform-shell',
    density: 'tool',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Control Workbench object, preset, mode, Arena source, and route-derived return target context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'interactive-learning',
    derivedFrom: 'commercial-platform-shell',
    density: 'learning',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Interactive lesson, classroom session, step, and catalog return context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'adaptive-learning',
    derivedFrom: 'commercial-platform-shell',
    density: 'learning',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Adaptive practice, diagnosis, growth profile, and recommendation context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'teacher',
    derivedFrom: 'commercial-platform-shell',
    density: 'analytics',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Teacher class, lesson plan, classroom session, resource, and history context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'data-center',
    derivedFrom: 'commercial-platform-shell',
    density: 'analytics',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Platform data center source quality, presentation metrics, drilldown, and export context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
  {
    workspace: 'admin',
    derivedFrom: 'commercial-platform-shell',
    density: 'governance',
    zones: commercialWorkspaceZoneIds,
    contextualNavigation: 'Admin user, system usage, data governance, configuration, and audit context.',
    inheritsTokenCategories: commercialWorkspaceShellTokenCategories,
    requiredConventions: commercialWorkspaceShellConventions,
  },
] as const;

export const PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX: PlatformCommercialWorkspaceRoute[] = [
  {
    href: '/simulations/[id]',
    workspace: 'simulation',
    density: 'tool',
    representativeSurface: 'immersive simulation scene',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar', 'evidence-rail', 'support-drawer'],
  },
  {
    href: '/interactive-learning/control-workbench',
    workspace: 'control-workbench',
    density: 'tool',
    representativeSurface: 'direct and Arena-bound Control Workbench',
    expectedZones: commercialWorkspaceZoneIds,
  },
  {
    href: '/arena/challenges/[taskId]',
    workspace: 'arena',
    density: 'tool',
    representativeSurface: 'Arena challenge detail with collapsible workspace shell and centralized Arena visual assets',
    expectedZones: commercialWorkspaceZoneIds,
  },
  {
    href: '/interactive-learning/[lesson]',
    workspace: 'interactive-learning',
    density: 'learning',
    representativeSurface: 'standard interactive lesson runtime',
    expectedZones: commercialWorkspaceZoneIds,
  },
  {
    href: '/teacher',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher operations dashboard',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/teacher/classes',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher class operations',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/teacher/lesson-plans',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher lesson plan operations',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/teacher/resources',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher resource operations',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/teacher/history',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher classroom history operations',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/teacher/classes/[classId]/analytics-v2',
    workspace: 'teacher',
    density: 'analytics',
    representativeSurface: 'teacher class analytics',
    expectedZones: ['instrument-area'],
  },
  {
    href: '/admin',
    workspace: 'admin',
    density: 'governance',
    representativeSurface: 'admin operations console home',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/admin/users',
    workspace: 'admin',
    density: 'governance',
    representativeSurface: 'admin user management console',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/admin/config',
    workspace: 'admin',
    density: 'governance',
    representativeSurface: 'admin system and model configuration console',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/admin/states',
    workspace: 'admin',
    density: 'governance',
    representativeSurface: 'admin usage statistics console',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/data-center',
    workspace: 'data-center',
    density: 'analytics',
    representativeSurface: 'platform data center',
    expectedZones: ['context-strip', 'instrument-area', 'command-bar'],
  },
  {
    href: '/admin/data-governance',
    workspace: 'admin',
    density: 'governance',
    representativeSurface: 'admin data governance',
    expectedZones: ['instrument-area'],
  },
] as const;

export const FORBIDDEN_SHARED_UI_IMPORT_PREFIXES = [
  '@/features/',
  '@/resources/',
  '@/lib/resource-registry',
  '@/features/lesson-engine',
] as const;

export const PLATFORM_UI_GUARDRAILS = [
  'New product pages use platform semantic tokens or approved primitive variants instead of page-local hex palettes.',
  'New role pages use AppShell or a documented adapter instead of introducing another local page shell.',
  'Shared primitives receive navigation, status, actions, and evidence state through props.',
  'Course runtime, ResourceNode, Arena, simulation, adaptive, and governance business rules stay outside shared UI primitives.',
  `Rollback keeps legacy shells reachable when ${PLATFORM_SHELL_ROLLBACK_FLAG} is disabled.`,
] as const;

const statusCategoryOrder = [
  'confidence',
  'sourceCoverage',
  'privacy',
  'replay',
  'protocol',
  'evaluation',
  'readiness',
  'fallback',
] as const;

const allowedStatusDetailScopes: Record<PlatformRole, readonly PlatformStatusRoleScope[]> = {
  student: ['student-visible'],
  teacher: ['student-visible', 'teacher-scoped'],
  admin: ['student-visible', 'teacher-scoped', 'admin-scoped', 'system-internal'],
  audit: ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only'],
};

function uniqueTokenNames(tokenNames: readonly string[]) {
  return Array.from(new Set(tokenNames));
}

function resolveStatusTone(categories: PlatformStatusCategories): PlatformStatusTone {
  if (
    categories.readiness === 'blocked' ||
    categories.sourceCoverage === 'missing' ||
    categories.sourceCoverage === 'unsupported' ||
    categories.replay === 'missing' ||
    categories.replay === 'unsupported' ||
    categories.protocol === 'missing' ||
    categories.protocol === 'unsupported'
  ) {
    return 'danger';
  }
  if (
    categories.confidence === 'low' ||
    categories.confidence === 'unknown' ||
    categories.sourceCoverage === 'partial' ||
    categories.sourceCoverage === 'stale' ||
    categories.privacy === 'restricted' ||
    categories.privacy === 'private' ||
    categories.replay === 'partial' ||
    categories.replay === 'stale' ||
    categories.protocol === 'legacy' ||
    categories.evaluation === 'preview' ||
    categories.readiness === 'degraded' ||
    categories.fallback !== 'none'
  ) {
    return 'warning';
  }
  if (categories.evaluation === 'official' && categories.readiness === 'ready') {
    return 'success';
  }
  return 'info';
}

function statusCategoryLabel<TCategory extends keyof PlatformStatusCategories>(
  category: TCategory,
  status: PlatformStatusCategories[TCategory],
) {
  return PLATFORM_STATUS_LABELS[category][status as never];
}

function statusCategoryToken<TCategory extends keyof PlatformStatusCategories>(
  category: TCategory,
  status: PlatformStatusCategories[TCategory],
) {
  return PLATFORM_STATUS_TOKEN_MAP[category][status as never];
}

export function filterPlatformStatusDetailsForRole(
  details: readonly PlatformStatusDetail[] = [],
  role: PlatformRole,
): PlatformStatusDetail[] {
  const allowedScopes = new Set(allowedStatusDetailScopes[role]);
  return details
    .filter((detail) => allowedScopes.has(detail.roleScope))
    .map((detail) => {
      if (!detail.restricted && detail.roleScope !== 'system-internal') return { ...detail };
      return {
        ...detail,
        restricted: true,
        value: '受限内容不可在当前界面展示',
      };
    });
}

export function buildPlatformStatusViewModel(
  payload: PlatformStatusPayload,
  options: PlatformStatusRenderOptions,
): PlatformStatusViewModel {
  return {
    id: payload.id,
    label: payload.label,
    summaryLabel: statusCategoryOrder
      .map((category) => statusCategoryLabel(category, payload.categories[category]))
      .join(' · '),
    summary: payload.summary,
    tone: resolveStatusTone(payload.categories),
    tokenNames: uniqueTokenNames(
      statusCategoryOrder.map((category) => statusCategoryToken(category, payload.categories[category])),
    ),
    sourceLabel: `${payload.source.domain}:${payload.source.capability}`,
    details: filterPlatformStatusDetailsForRole(payload.details, options.role),
    fallbackReason: payload.fallbackReason,
  };
}

function sortNavigationItems(items: readonly PlatformNavigationItem[]): PlatformNavigationItem[] {
  return [...items]
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return left.id.localeCompare(right.id);
    })
    .map((item) => ({
      ...item,
      children: item.children ? sortNavigationItems(item.children) : undefined,
    }));
}

export function createPlatformNavigation(items: readonly PlatformNavigationItem[]): PlatformNavigationItem[] {
  return sortNavigationItems(items);
}

export function filterPlatformNavigation(
  items: readonly PlatformNavigationItem[],
  filter: PlatformNavigationFilter,
): PlatformNavigationItem[] {
  const enabledFlags = new Set(filter.enabledFeatureFlags ?? []);
  return sortNavigationItems(items)
    .filter((item) => item.role === 'all' || item.role === filter.role)
    .map((item) => {
      const featureEnabled = item.featureFlag ? enabledFlags.has(item.featureFlag) : true;
      const fallbackAvailability = item.featureFlag ? 'hidden' : 'enabled';
      const availability = item.featureFlag && !featureEnabled
        ? item.availability ?? fallbackAvailability
        : item.availability ?? 'enabled';
      return {
        ...item,
        availability,
      } satisfies PlatformNavigationItem;
    })
    .filter((item) => filter.includeHidden || item.availability !== 'hidden')
    .filter((item) => filter.includeDisabled || item.availability !== 'disabled')
    .map((item) => ({
      ...item,
      children: item.children
        ? filterPlatformNavigation(item.children, filter)
        : undefined,
    }));
}
