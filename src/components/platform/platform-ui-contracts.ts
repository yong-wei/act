export type PlatformRole = 'student' | 'teacher' | 'admin' | 'audit';

export type PlatformTokenCategory =
  | 'canvas'
  | 'surface'
  | 'foreground'
  | 'border'
  | 'action'
  | 'evidence'
  | 'privacy'
  | 'replay'
  | 'evaluation';

export interface PlatformSemanticToken {
  name: string;
  category: PlatformTokenCategory;
  purpose: string;
}

export interface PlatformNavigationItem {
  id: string;
  label: string;
  href: string;
  role: PlatformRole | 'all';
  order: number;
  featureFlag?: string;
  children?: PlatformNavigationItem[];
}

export interface PlatformNavigationFilter {
  role: PlatformRole;
  enabledFeatureFlags?: readonly string[];
}

export interface PlatformShellAdapter {
  legacyComponent: 'FeaturePageNav' | 'UnifiedTopBar' | 'ArenaPageShell' | 'TeacherLayout' | 'AdminConsoleHeader';
  adapterContract: string;
  migrationRule: string;
}

export const PLATFORM_SHELL_ROLLBACK_FLAG = 'platform.unifiedShell';

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
    .filter((item) => !item.featureFlag || enabledFlags.has(item.featureFlag))
    .map((item) => ({
      ...item,
      children: item.children
        ? filterPlatformNavigation(item.children, filter)
        : undefined,
    }));
}
