import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { balanceLedger } from './ledger';
import { assertPortable } from './privacy';
import {
  objectPrefixClass,
  ossEndpointClass,
  publisherRoute,
  routeClassFromPath,
  routeClassFromPrefix,
} from './taxonomy';
import {
  DIRECTIONS,
  ENDPOINT_CLASSES,
  QUALIFICATIONS,
  ROUTE_CLASSES,
  SOURCE_EXPORT_SCHEMA_VERSION,
  SOURCE_TYPES,
  type AttributedRow,
  type Direction,
  type EndpointClass,
  type Qualification,
  type RouteClass,
  type SourceExport,
  type SourceExportRow,
  type SourceLedger,
  type SourceType,
} from './types';

function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

function parseExport(raw: unknown): SourceExport {
  if (!raw || typeof raw !== 'object') throw new Error('source-export-invalid');
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== SOURCE_EXPORT_SCHEMA_VERSION) throw new Error('source-export-schema');
  if (typeof record.sourceType !== 'string' || !isSourceType(record.sourceType)) throw new Error('source-export-type');
  const window = record.window as SourceExport['window'];
  if (!window?.start || !window.end || !window.timezone) throw new Error('source-export-window');
  if (typeof record.exporterVersion !== 'string' || !record.exporterVersion) throw new Error('source-export-exporter');
  if (!Array.isArray(record.rows)) throw new Error('source-export-rows');
  return {
    schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
    sourceType: record.sourceType,
    window,
    exporterVersion: record.exporterVersion,
    reportingDelayHours: record.reportingDelayHours === null || typeof record.reportingDelayHours === 'number'
      ? record.reportingDelayHours as number | null
      : null,
    rows: record.rows as SourceExportRow[],
  };
}

function asQualification(value: string | undefined, fallback: Qualification): Qualification {
  return value && (QUALIFICATIONS as readonly string[]).includes(value) ? value as Qualification : fallback;
}

function asDirection(value: string | undefined, fallback: Direction): Direction {
  return value && (DIRECTIONS as readonly string[]).includes(value) ? value as Direction : fallback;
}

function asEndpoint(value: string | undefined, fallback: EndpointClass): EndpointClass {
  return value && (ENDPOINT_CLASSES as readonly string[]).includes(value) ? value as EndpointClass : fallback;
}

function rowIdentity(sourceType: SourceType, index: number, row: SourceExportRow): string {
  return row.evidenceId ?? sha256Text(serializeDeterministic({ sourceType, index, row }));
}

function attributeRow(sourceType: SourceType, index: number, row: SourceExportRow, seen: Map<string, string>): AttributedRow {
  if (!Number.isFinite(row.bytes) || row.bytes < 0) throw new Error('source-export-bytes');
  const count = row.count ?? 1;
  const evidenceId = rowIdentity(sourceType, index, row);
  const prior = seen.get(evidenceId);
  let qualification = asQualification(row.qualification, 'observed');
  if (prior) qualification = 'duplicate';
  else seen.set(evidenceId, evidenceId);

  let routeClass: RouteClass | 'unattributed' = 'unattributed';
  let operationClass = row.operation ?? 'unknown';
  let direction = asDirection(row.direction, 'outbound');
  let endpointClass = asEndpoint(row.endpointClass, 'public-network-out');
  let prefixClass = row.objectPrefixClass ?? objectPrefixClass(row.prefix ?? row.path);

  if (row.routeClass && (ROUTE_CLASSES as readonly string[]).includes(row.routeClass)) {
    routeClass = row.routeClass as RouteClass;
  } else if (sourceType === 'oss') {
    routeClass = routeClassFromPrefix(row.prefix);
    endpointClass = ossEndpointClass(row.endpoint, row.metering);
    operationClass = row.operation ?? row.metering ?? 'get-object';
    if (row.metering === 'CdnOut') direction = 'origin-fetch';
  } else if (sourceType === 'esa') {
    routeClass = routeClassFromPath(row.path) === 'unattributed' ? routeClassFromPrefix(row.prefix) : routeClassFromPath(row.path);
    endpointClass = row.metering === 'origin-fetch' ? 'origin-fetch' : 'edge';
    direction = endpointClass === 'origin-fetch' ? 'origin-fetch' : 'edge-delivery';
    operationClass = row.operation ?? 'edge-delivery';
  } else if (sourceType === 'nginx') {
    routeClass = routeClassFromPath(row.path);
    endpointClass = 'ecs-nginx';
    operationClass = row.operation ?? 'http-get';
  } else if (sourceType === 'publisher') {
    const mapped = publisherRoute(row.operation);
    routeClass = mapped.routeClass;
    operationClass = mapped.operationClass;
    qualification = prior ? 'duplicate' : mapped.qualification;
    endpointClass = 'publisher-api';
    direction = mapped.routeClass === 'publisher-public-upload' ? 'upload'
      : mapped.routeClass === 'publisher-legacy-body-readback' ? 'readback'
        : 'metadata';
  } else if (sourceType === 'developer-mount') {
    routeClass = 'runtime-blob-public-read';
    endpointClass = 'oss-public-read';
    operationClass = row.operation ?? (row.cacheHit ? 'cache-hit' : 'blob-read');
    if (row.cacheHit) qualification = prior ? 'duplicate' : 'excluded';
  }

  if (routeClass === 'unattributed' && qualification === 'observed') qualification = 'unattributed';
  if (row.qualification === 'delayed') qualification = 'delayed';
  if (row.qualification === 'excluded') qualification = 'excluded';

  return {
    sourceType,
    direction,
    endpointClass,
    routeClass,
    objectPrefixClass: prefixClass,
    operationClass,
    bytes: row.bytes,
    count,
    qualification,
    evidenceId,
    confidence: routeClass === 'unattributed' ? 'unresolved' : 'proved',
  };
}

export function normalizeSourceExport(raw: unknown): SourceLedger {
  const serialized = serializeDeterministic(raw);
  assertPortable(serialized, 'source-export');
  const source = parseExport(raw);
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  const attributed = source.rows.map((row, index) => attributeRow(source.sourceType, index, row, seen));
  const names = new Map<string, string>();
  for (const [index, raw] of source.rows.entries()) {
    const attributedRow = attributed[index];
    const name = raw.path ?? raw.prefix ?? raw.evidenceId ?? attributedRow.evidenceId;
    const key = `${source.sourceType}:${name}`;
    const prior = names.get(key);
    if (prior && prior !== attributedRow.routeClass) conflicts.push(`${key}:${prior}!=${attributedRow.routeClass}`);
    else names.set(key, String(attributedRow.routeClass));
  }
  return balanceLedger({
    sourceType: source.sourceType,
    window: source.window,
    exporterVersion: source.exporterVersion,
    inputHash: sha256Text(serialized),
    reportingDelayHours: source.reportingDelayHours,
    rows: attributed,
    conflicts,
  });
}
