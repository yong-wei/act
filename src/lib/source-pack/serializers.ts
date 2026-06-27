import { validateSourcePack } from './schema';
import type { SourcePack } from './types';

export interface SourcePackAuditOutput {
  packId: string;
  schemaVersion: string;
  profile: string;
  queryId: string;
  queryHash: string;
  itemCount: number;
  limitationCount: number;
  citationTargetIds: string[];
  retrievalChunkIds: string[];
  corpusVersion?: string;
  graphVersion?: string;
  projectionVersion?: string;
  generatedAt: string;
}

export function serializeSourcePackJson(pack: SourcePack): string {
  return `${JSON.stringify(validateSourcePack(pack), null, 2)}\n`;
}

export function serializeSourcePackMarkdown(pack: SourcePack): string {
  const validPack = validateSourcePack(pack);
  const lines = [
    `# Source Pack ${validPack.packId}`,
    '',
    `- Profile: ${validPack.profile}`,
    `- Query: ${validPack.query.text}`,
    `- Query ID: ${validPack.query.queryId}`,
    `- Items: ${validPack.items.length}`,
    `- Limitations: ${validPack.limitations.length}`,
    '',
    '## Coverage',
    '',
    `- Requested top K: ${validPack.coverage.requestedTopK}`,
    `- Returned items: ${validPack.coverage.returnedItems}`,
  ];

  if (typeof validPack.coverage.coverageRatio === 'number') {
    lines.push(`- Coverage ratio: ${validPack.coverage.coverageRatio.toFixed(2)}`);
  }
  if (typeof validPack.coverage.eligibleItems === 'number') {
    lines.push(`- Eligible items: ${validPack.coverage.eligibleItems}`);
  }
  if (typeof validPack.coverage.omittedItems === 'number') {
    lines.push(`- Omitted items: ${validPack.coverage.omittedItems}`);
  }
  for (const note of validPack.coverage.notes ?? []) {
    lines.push(`- Note: ${note}`);
  }

  lines.push('', '## Items', '');
  if (validPack.items.length === 0) {
    lines.push('No governed Source Pack items were returned.', '');
  }
  for (const item of validPack.items) {
    lines.push(
      `### ${item.title}`,
      '',
      `- Item ID: ${item.id}`,
      `- Source kind: ${item.sourceKind}`,
      `- Modality: ${item.modality}`,
      `- Final score: ${item.scores.final.toFixed(2)}`,
      `- Relevance score: ${item.scores.relevance.toFixed(2)}`,
      `- Access: ${item.access.visibility}; AI use allowed: ${item.access.aiUseAllowed ? 'yes' : 'no'}`,
    );
    if (typeof item.scores.graphAlignment === 'number') lines.push(`- Graph alignment score: ${item.scores.graphAlignment.toFixed(2)}`);
    if (typeof item.scores.authority === 'number') lines.push(`- Authority score: ${item.scores.authority.toFixed(2)}`);
    if (typeof item.scores.eligibility === 'number') lines.push(`- Eligibility score: ${item.scores.eligibility.toFixed(2)}`);
    if (typeof item.scores.freshness === 'number') lines.push(`- Freshness score: ${item.scores.freshness.toFixed(2)}`);
    if (item.access.license) lines.push(`- License: ${item.access.license}`);
    if (item.access.policyRef) lines.push(`- Access policy: ${item.access.policyRef}`);
    if (item.resourceNodeId) lines.push(`- Resource node: ${item.resourceNodeId}`);
    if (item.planningUnitId) lines.push(`- Planning unit: ${item.planningUnitId}`);
    if (item.retrievalChunkId) lines.push(`- Retrieval chunk: ${item.retrievalChunkId}`);
    if (item.citationTargetId) lines.push(`- Citation target: ${item.citationTargetId}`);
    if (item.citation) {
      lines.push(`- Citation: ${item.citation.displayTitle} (${item.citation.citationTargetId})`);
      lines.push(`- Citation source: ${item.citation.sourceId}`);
      if (item.citation.resolver) lines.push(`- Citation resolver: ${item.citation.resolver}`);
      if (item.citation.href) lines.push(`- Citation href: ${item.citation.href}`);
      lines.push(`- Citation verified: ${item.citation.verified ? 'yes' : 'no'}`);
    }
    lines.push('', item.excerpt, '', `Rationale: ${item.inclusionRationale}`, '');
  }

  lines.push('## Limitations', '');
  if (validPack.limitations.length === 0) {
    lines.push('No limitations reported.', '');
  }
  for (const limitation of validPack.limitations) {
    lines.push(`- ${limitation.severity}: ${limitation.code} - ${limitation.message}`);
    if (limitation.source) lines.push(`  - Source: ${limitation.source}`);
    lines.push(`  - Recoverable: ${limitation.recoverable ? 'yes' : 'no'}`);
  }
  lines.push('', '## Audit', '', `- Schema: ${validPack.audit.schemaVersion}`, `- Created: ${validPack.audit.createdAt}`);
  if (validPack.indexRefs.corpusVersion) lines.push(`- Corpus version: ${validPack.indexRefs.corpusVersion}`);
  if (validPack.indexRefs.graphVersion) lines.push(`- Graph version: ${validPack.indexRefs.graphVersion}`);
  if (validPack.indexRefs.projectionVersion) lines.push(`- Projection version: ${validPack.indexRefs.projectionVersion}`);

  return `${lines.join('\n').trimEnd()}\n`;
}

export function buildSourcePackAuditOutput(pack: SourcePack): SourcePackAuditOutput {
  const validPack = validateSourcePack(pack);
  return {
    packId: validPack.packId,
    schemaVersion: validPack.audit.schemaVersion,
    profile: validPack.profile,
    queryId: validPack.query.queryId,
    queryHash: validPack.audit.queryHash,
    itemCount: validPack.audit.itemCount,
    limitationCount: validPack.audit.limitationCount,
    citationTargetIds: validPack.audit.citationTargetIds,
    retrievalChunkIds: validPack.audit.retrievalChunkIds,
    corpusVersion: validPack.indexRefs.corpusVersion,
    graphVersion: validPack.indexRefs.graphVersion,
    projectionVersion: validPack.indexRefs.projectionVersion,
    generatedAt: validPack.indexRefs.generatedAt,
  };
}

export function serializeSourcePackAudit(pack: SourcePack): string {
  return `${JSON.stringify(buildSourcePackAuditOutput(pack), null, 2)}\n`;
}
