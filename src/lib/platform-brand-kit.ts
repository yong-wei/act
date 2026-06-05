export type PlatformBrandAssetKind =
  | 'app-mark'
  | 'horizontal-lockup'
  | 'compact-mark'
  | 'favicon'
  | 'route-badge'
  | 'arena-badge'
  | 'course-badge'
  | 'workbench-chrome'
  | 'data-snapshot'
  | 'governance-snapshot'
  | 'report-watermark';

export type PlatformBrandTokenRole =
  | 'canvas'
  | 'surface-1'
  | 'surface-2'
  | 'elevated'
  | 'hairline'
  | 'trace-accent'
  | 'muted-accent'
  | 'danger'
  | 'success'
  | 'focus-ring'
  | 'evidence'
  | 'report-output';

export type PlatformBrandEvidenceSurface =
  | 'navigation'
  | 'learner-record'
  | 'mission-workspace'
  | 'knowledge-data-map'
  | 'operations-console'
  | 'report-ledger';

export interface PlatformBrandAssetReference {
  kind: PlatformBrandAssetKind;
  sourcePath: string;
  publicUrl: string;
  usage: string;
  lightBehavior: string;
  darkBehavior: string;
}

export interface PlatformDualTemplateTokenRole {
  role: PlatformBrandTokenRole;
  cssVariable: string;
  tailwindColor: string;
  lightTemplateUse: string;
  darkTemplateUse: string;
}

export interface PlatformBrandLegacyNamespaceMapping {
  namespace: 'interactive-course-hub-*' | 'admin-console-*' | 'premium-lesson-*' | 'surface-card';
  disposition: 'map-to-brand-roles' | 'retire-on-touch';
  tokenRoles: readonly PlatformBrandTokenRole[];
  acceptanceRule: string;
}

export interface PlatformBrandApplicationEvidenceEntry {
  surface: PlatformBrandEvidenceSurface;
  lightEvidence: string;
  darkEvidence: string;
  requiredBrandRoles: readonly string[];
}

export const PLATFORM_BRAND_ASSET_REFERENCES: PlatformBrandAssetReference[] = [
  {
    kind: 'app-mark',
    sourcePath: 'public/assets/platform-brand/app-mark.svg',
    publicUrl: '/assets/platform-brand/app-mark.svg',
    usage: 'primary platform identity in public entry and role cockpit shells',
    lightBehavior: 'paper stamp with printed trace contrast on engineering chart surfaces',
    darkBehavior: 'night instrument mark with low-light trace contrast',
  },
  {
    kind: 'horizontal-lockup',
    sourcePath: 'public/assets/platform-brand/horizontal-lockup.svg',
    publicUrl: '/assets/platform-brand/horizontal-lockup.svg',
    usage: 'wide header and report cover identity where route context is available',
    lightBehavior: 'daylight lockup using matte ink and printed route trace language',
    darkBehavior: 'instrument lockup using night bridge foreground and trace signal',
  },
  {
    kind: 'compact-mark',
    sourcePath: 'public/assets/platform-brand/compact-mark.svg',
    publicUrl: '/assets/platform-brand/compact-mark.svg',
    usage: 'collapsed navigation, mobile shell, and favicon fallback identity',
    lightBehavior: 'paper-scale compact stamp with clear matte edge',
    darkBehavior: 'low-light compact instrument mark with visible hairline edge',
  },
  {
    kind: 'favicon',
    sourcePath: 'public/assets/platform-brand/favicon.svg',
    publicUrl: '/assets/platform-brand/favicon.svg',
    usage: 'browser tab and installed app identity',
    lightBehavior: 'printed app stamp that remains legible on daylight browser chrome',
    darkBehavior: 'night app stamp that remains legible on dark browser chrome',
  },
  {
    kind: 'route-badge',
    sourcePath: 'public/assets/platform-brand/route-badge.svg',
    publicUrl: '/assets/platform-brand/route-badge.svg',
    usage: 'route family identity in navigation traces and migration ledgers',
    lightBehavior: 'paper route badge with matte trace edge',
    darkBehavior: 'instrument route badge with controlled trace illumination',
  },
  {
    kind: 'arena-badge',
    sourcePath: 'public/assets/platform-brand/arena-badge.svg',
    publicUrl: '/assets/platform-brand/arena-badge.svg',
    usage: 'Arena challenge readiness and competition identity',
    lightBehavior: 'daylight challenge stamp with readable signal state',
    darkBehavior: 'night challenge badge with low-light signal edge',
  },
  {
    kind: 'course-badge',
    sourcePath: 'public/assets/platform-brand/course-badge.svg',
    publicUrl: '/assets/platform-brand/course-badge.svg',
    usage: 'course, lesson, and learning path identity',
    lightBehavior: 'paper course stamp aligned with printed path traces',
    darkBehavior: 'instrument course badge aligned with low-light route traces',
  },
  {
    kind: 'workbench-chrome',
    sourcePath: 'public/assets/platform-brand/workbench-chrome.svg',
    publicUrl: '/assets/platform-brand/workbench-chrome.svg',
    usage: 'mission workspace frame, command strips, and local tool chrome',
    lightBehavior: 'matte daylight instrument rail with fine hairline structure',
    darkBehavior: 'night workbench rail with controlled instrument separation',
  },
  {
    kind: 'data-snapshot',
    sourcePath: 'public/assets/platform-brand/data-snapshot.svg',
    publicUrl: '/assets/platform-brand/data-snapshot.svg',
    usage: 'learner record, evidence browser, and knowledge/data map snapshot',
    lightBehavior: 'paper evidence snapshot with printed grid and source stamp',
    darkBehavior: 'night evidence snapshot with trace grid and low-light labels',
  },
  {
    kind: 'governance-snapshot',
    sourcePath: 'public/assets/platform-brand/governance-snapshot.svg',
    publicUrl: '/assets/platform-brand/governance-snapshot.svg',
    usage: 'administrator governance state, audit summary, and data quality snapshot',
    lightBehavior: 'daylight governance stamp with matte status lanes',
    darkBehavior: 'night governance instrument with status signal lanes',
  },
  {
    kind: 'report-watermark',
    sourcePath: 'public/assets/platform-brand/report-watermark.svg',
    publicUrl: '/assets/platform-brand/report-watermark.svg',
    usage: 'exported report and ledger watermark identity',
    lightBehavior: 'paper report watermark with low-ink printed trace opacity',
    darkBehavior: 'night report watermark with restrained low-light opacity',
  },
] as const;

export const PLATFORM_DUAL_TEMPLATE_TOKEN_ROLES: PlatformDualTemplateTokenRole[] = [
  {
    role: 'canvas',
    cssVariable: 'platform-brand-canvas',
    tailwindColor: 'platform-brand-canvas',
    lightTemplateUse: 'engineering chart paper base',
    darkTemplateUse: 'night bridge canvas base',
  },
  {
    role: 'surface-1',
    cssVariable: 'platform-brand-surface-1',
    tailwindColor: 'platform-brand-surface-1',
    lightTemplateUse: 'matte daylight panel',
    darkTemplateUse: 'low-light instrument panel',
  },
  {
    role: 'surface-2',
    cssVariable: 'platform-brand-surface-2',
    tailwindColor: 'platform-brand-surface-2',
    lightTemplateUse: 'raised paper module',
    darkTemplateUse: 'layered instrument module',
  },
  {
    role: 'elevated',
    cssVariable: 'platform-brand-elevated',
    tailwindColor: 'platform-brand-elevated',
    lightTemplateUse: 'daylight floating evidence sheet',
    darkTemplateUse: 'foreground instrument desk layer',
  },
  {
    role: 'hairline',
    cssVariable: 'platform-brand-hairline',
    tailwindColor: 'platform-brand-hairline',
    lightTemplateUse: 'printed chart hairline',
    darkTemplateUse: 'low-light instrument divider',
  },
  {
    role: 'trace-accent',
    cssVariable: 'platform-brand-trace-accent',
    tailwindColor: 'platform-brand-trace-accent',
    lightTemplateUse: 'printed navigation trace',
    darkTemplateUse: 'controlled illuminated trace',
  },
  {
    role: 'muted-accent',
    cssVariable: 'platform-brand-muted-accent',
    tailwindColor: 'platform-brand-muted-accent',
    lightTemplateUse: 'matte secondary route cue',
    darkTemplateUse: 'low-light secondary instrument cue',
  },
  {
    role: 'danger',
    cssVariable: 'platform-brand-danger',
    tailwindColor: 'platform-brand-danger',
    lightTemplateUse: 'printed exception stamp',
    darkTemplateUse: 'night alert signal',
  },
  {
    role: 'success',
    cssVariable: 'platform-brand-success',
    tailwindColor: 'platform-brand-success',
    lightTemplateUse: 'verified evidence stamp',
    darkTemplateUse: 'confirmed instrument signal',
  },
  {
    role: 'focus-ring',
    cssVariable: 'platform-brand-focus-ring',
    tailwindColor: 'platform-brand-focus-ring',
    lightTemplateUse: 'inked keyboard focus trace',
    darkTemplateUse: 'illuminated keyboard focus trace',
  },
  {
    role: 'evidence',
    cssVariable: 'platform-brand-evidence',
    tailwindColor: 'platform-brand-evidence',
    lightTemplateUse: 'paper evidence provenance label',
    darkTemplateUse: 'low-light evidence provenance label',
  },
  {
    role: 'report-output',
    cssVariable: 'platform-brand-report-output',
    tailwindColor: 'platform-brand-report-output',
    lightTemplateUse: 'export ledger watermark ink',
    darkTemplateUse: 'night ledger watermark signal',
  },
] as const;

export const PLATFORM_BRAND_LEGACY_NAMESPACE_MAPPINGS: PlatformBrandLegacyNamespaceMapping[] = [
  {
    namespace: 'interactive-course-hub-*',
    disposition: 'map-to-brand-roles',
    tokenRoles: ['canvas', 'surface-1', 'trace-accent', 'evidence'],
    acceptanceRule: 'silent coexistence with route-local hub palettes is rejected once a course entry route is touched',
  },
  {
    namespace: 'admin-console-*',
    disposition: 'map-to-brand-roles',
    tokenRoles: ['surface-2', 'elevated', 'danger', 'success', 'report-output'],
    acceptanceRule: 'silent coexistence with local admin console colors is rejected once an operations route is touched',
  },
  {
    namespace: 'premium-lesson-*',
    disposition: 'map-to-brand-roles',
    tokenRoles: ['surface-1', 'hairline', 'muted-accent', 'focus-ring'],
    acceptanceRule: 'silent coexistence with private lesson chrome is rejected unless mapped to the brand kit',
  },
  {
    namespace: 'surface-card',
    disposition: 'retire-on-touch',
    tokenRoles: ['surface-1', 'surface-2', 'elevated', 'hairline'],
    acceptanceRule: 'silent coexistence of generic card surfaces is rejected when the route declares an archetype',
  },
] as const;

export const PLATFORM_BRAND_FORBIDDEN_ACCENT_FAMILIES = [
  'slate',
  'cyan',
  'amber',
  'violet',
  'fuchsia',
] as const;

export const PLATFORM_BRAND_NUMERIC_TYPOGRAPHY_CONTRACT = {
  numericFontFeature: 'tnum',
  iconFamily: 'lucide governed through platform asset wrappers until route-critical replacements exist',
  iconStrokeWidth: 1.75,
  opticalSize: '16px compact, 20px navigation, 24px route badge, 32px report mark',
  metricRule: 'numeric readouts must state source, confidence, status, or next action',
  statusLabelRule: 'status labels must connect to evidence state and not appear as generic dashboard decoration',
  textureRule: 'texture is limited to trace grid, matte paper, instrument hairline, and report watermark roles',
} as const;

export const PLATFORM_BRAND_APPLICATION_EVIDENCE: PlatformBrandApplicationEvidenceEntry[] = [
  {
    surface: 'navigation',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'role cockpit'],
  },
  {
    surface: 'learner-record',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'learner provenance'],
  },
  {
    surface: 'mission-workspace',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'local tools'],
  },
  {
    surface: 'knowledge-data-map',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'relationship trace'],
  },
  {
    surface: 'operations-console',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'operator workflow'],
  },
  {
    surface: 'report-ledger',
    lightEvidence: 'artifacts/commercial-ui/brand-kit-light-1440.png',
    darkEvidence: 'artifacts/commercial-ui/brand-kit-dark-1440.png',
    requiredBrandRoles: ['route identity', 'evidence state', 'report watermark'],
  },
] as const;
