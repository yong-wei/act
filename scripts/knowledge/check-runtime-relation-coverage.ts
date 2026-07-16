import fs from 'node:fs';
import path from 'node:path';

import {
  inspectRuntimeKnowledgeRelationCoverage,
  RUNTIME_KNOWLEDGE_RELATION_CONTRACT_COVERAGE,
  type RuntimeKnowledgeRelationAuditInput,
} from '../../src/lib/knowledge-graph-relation-runtime';

const DEFAULT_RELATIONS_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'knowledge',
  'graph',
  'relations.jsonl'
);
const DEFAULT_NODES_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'knowledge',
  'graph',
  'nodes.json'
);
const DEFAULT_AUDIT_INPUT_PATH = path.join(
  process.cwd(),
  'course-content',
  'contracts',
  'knowledge-relation-coverage-audit.json'
);

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a file path.`);
  }
  return path.resolve(process.cwd(), value);
}

function readNodeIds(nodesPath: string): Set<string> {
  const parsed = JSON.parse(fs.readFileSync(nodesPath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Runtime knowledge nodes must be a JSON array.');
  const nodeIds = new Set<string>();
  parsed.forEach((node, index) => {
    const id = node && typeof node === 'object' ? (node as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !id || id.trim() !== id || id.length > 200) {
      throw new Error(`Runtime knowledge node at index ${index} has an invalid canonical id.`);
    }
    if (nodeIds.has(id)) throw new Error(`Runtime knowledge node id is duplicated: ${id}`);
    nodeIds.add(id);
  });
  return nodeIds;
}

function exactString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(`${field} must be a non-blank exact string.`);
  }
  return value;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return value.map((item, index) => exactString(item, `${field}[${index}]`));
}

function readAuditInput(auditPath: string): RuntimeKnowledgeRelationAuditInput {
  const value = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as Record<string, unknown>;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) {
    throw new Error('Relation coverage audit input must use schemaVersion 1.');
  }
  const orderSource = value.orderSource as Record<string, unknown> | undefined;
  const density = value.density as Record<string, unknown> | undefined;
  if (!orderSource || !density) throw new Error('Relation coverage audit input is missing required sections.');
  const readExpectations = (items: unknown, field: string) => {
    if (!Array.isArray(items)) throw new Error(`${field} must be an array.`);
    return items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`${field}[${index}] must be an object.`);
      }
      const row = item as Record<string, unknown>;
      return {
        relationId: exactString(row.relationId, `${field}[${index}].relationId`),
        sourceId: exactString(row.sourceId, `${field}[${index}].sourceId`),
        targetId: exactString(row.targetId, `${field}[${index}].targetId`),
        canonicalType: exactString(row.canonicalType, `${field}[${index}].canonicalType`),
      };
    });
  };
  const overlayItems = value.overlayTripleEligibility;
  if (!Array.isArray(overlayItems)) throw new Error('overlayTripleEligibility must be an array.');
  return {
    schemaVersion: 1,
    orderSource: { relationIds: readStringArray(orderSource.relationIds, 'orderSource.relationIds') },
    density: {
      selectedNodeId: exactString(density.selectedNodeId, 'density.selectedNodeId'),
      visibleAssociationRelationIds: readStringArray(
        density.visibleAssociationRelationIds,
        'density.visibleAssociationRelationIds'
      ),
    },
    provenance: readExpectations(value.provenance, 'provenance'),
    overlayTripleEligibility: overlayItems.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`overlayTripleEligibility[${index}] must be an object.`);
      }
      const row = item as Record<string, unknown>;
      return {
        relationId: exactString(row.relationId, `overlayTripleEligibility[${index}].relationId`),
        sourceId: exactString(row.sourceId, `overlayTripleEligibility[${index}].sourceId`),
        targetId: exactString(row.targetId, `overlayTripleEligibility[${index}].targetId`),
        normalizedType: exactString(row.normalizedType, `overlayTripleEligibility[${index}].normalizedType`),
      };
    }),
  };
}

try {
  const relationsPath = optionValue('--relations', DEFAULT_RELATIONS_PATH);
  const nodesPath = optionValue('--nodes', DEFAULT_NODES_PATH);
  const auditInputPath = optionValue('--audit-input', DEFAULT_AUDIT_INPUT_PATH);
  const result = inspectRuntimeKnowledgeRelationCoverage(
    fs.readFileSync(relationsPath, 'utf8'),
    { auditInput: readAuditInput(auditInputPath), nodeIds: readNodeIds(nodesPath) }
  );
  console.log(JSON.stringify(result.report, null, 2));
  if (!result.report.ok) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    contractCoverage: RUNTIME_KNOWLEDGE_RELATION_CONTRACT_COVERAGE,
    coverage: [],
    counts: {
      inputLines: 0,
      parsedRelations: 0,
      projectedRelations: 0,
      visualEdges: 0,
    },
    diagnostics: [{
      blocking: true,
      code: 'RELATION_COVERAGE_CHECKER_FAILURE',
      message: error instanceof Error ? error.message : String(error),
      relationIds: [],
      stage: 'loading',
    }],
    ok: false,
    stageAgreement: false,
  }, null, 2));
  process.exitCode = 1;
}
