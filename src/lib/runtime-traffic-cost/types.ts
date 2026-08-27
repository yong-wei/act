export const OBSERVATION_SCHEMA_VERSION = 'act-runtime-traffic-observation/v1' as const;
export const LEDGER_SCHEMA_VERSION = 'act-runtime-traffic-source-ledger/v1' as const;
export const SOURCE_EXPORT_SCHEMA_VERSION = 'act-runtime-traffic-source-export/v1' as const;
export const TOOL_VERSION = 'runtime-traffic-cost/1';

export const SOURCE_TYPES = ['oss', 'esa', 'nginx', 'publisher', 'developer-mount'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ROUTE_CLASSES = [
  'public-assets',
  'course-runtime',
  'runtime-media-redirect',
  'runtime-blob-view',
  'runtime-blob-public-read',
  'publisher-public-upload',
  'publisher-metadata-check',
  'publisher-legacy-body-readback',
] as const;
export type RouteClass = (typeof ROUTE_CLASSES)[number];

export const ENDPOINT_CLASSES = [
  'public-network-out',
  'cdn-origin',
  'non-public',
  'edge',
  'origin-fetch',
  'ecs-nginx',
  'oss-public-read',
  'publisher-api',
] as const;
export type EndpointClass = (typeof ENDPOINT_CLASSES)[number];

export const DIRECTIONS = ['outbound', 'inbound', 'origin-fetch', 'edge-delivery', 'metadata', 'upload', 'readback'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const QUALIFICATIONS = ['observed', 'excluded', 'duplicate', 'delayed', 'unattributed'] as const;
export type Qualification = (typeof QUALIFICATIONS)[number];

export const OBSERVATION_STATUSES = ['qualified', 'incomplete', 'blocked'] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

export interface ObservationWindow {
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
}

export interface SourceExportRow {
  readonly metering?: string;
  readonly endpoint?: string;
  readonly host?: string;
  readonly path?: string;
  readonly prefix?: string;
  readonly operation?: string;
  readonly bytes: number;
  readonly count?: number;
  readonly cacheHit?: boolean;
  readonly routeClass?: string;
  readonly endpointClass?: string;
  readonly objectPrefixClass?: string;
  readonly direction?: string;
  readonly qualification?: string;
  readonly evidenceId?: string;
}

export interface SourceExport {
  readonly schemaVersion: typeof SOURCE_EXPORT_SCHEMA_VERSION;
  readonly sourceType: SourceType;
  readonly window: ObservationWindow;
  readonly exporterVersion: string;
  readonly reportingDelayHours: number | null;
  readonly rows: readonly SourceExportRow[];
}

export interface AttributedRow {
  readonly sourceType: SourceType;
  readonly direction: Direction;
  readonly endpointClass: EndpointClass;
  readonly routeClass: RouteClass | 'unattributed';
  readonly objectPrefixClass: string;
  readonly operationClass: string;
  readonly bytes: number;
  readonly count: number;
  readonly qualification: Qualification;
  readonly evidenceId: string;
  readonly confidence: 'proved' | 'unresolved';
}

export interface SourceLedger {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly sourceType: SourceType;
  readonly window: ObservationWindow;
  readonly exporterVersion: string;
  readonly inputHash: string;
  readonly reportingDelayHours: number | null;
  readonly status: ObservationStatus;
  readonly rows: readonly AttributedRow[];
  readonly totals: Record<Qualification, { readonly bytes: number; readonly count: number }>;
  readonly denominatorBytes: number;
  readonly denominatorCount: number;
  readonly denominatorHash: string;
  readonly missingReason: string | null;
  readonly conflicts: readonly string[];
}

export interface ObservationEnvelope {
  readonly schemaVersion: typeof OBSERVATION_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly environment: string;
  readonly window: ObservationWindow;
  readonly timezone: string;
  readonly toolVersion: typeof TOOL_VERSION;
  readonly capturedAt: string;
  readonly status: ObservationStatus;
  readonly routeTaxonomy: readonly RouteClass[];
  readonly expectedSources: readonly SourceType[];
  readonly ledgers: readonly SourceLedger[];
  readonly missingSources: readonly { readonly sourceType: SourceType; readonly reason: string }[];
  readonly conflicts: readonly string[];
}

export interface InventoryEntry {
  readonly routeClass: RouteClass;
  readonly ownerPath: string;
  readonly description: string;
}
