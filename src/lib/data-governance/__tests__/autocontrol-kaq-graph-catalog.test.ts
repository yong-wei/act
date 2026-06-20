import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_OBJECTIVE_CATALOG,
  AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE,
  validateAutocontrolKaqGraphCatalog,
} from '../autocontrol-kaq-graph-catalog';
import type { KaqGraphNode } from '../kaq-graph-schema';
import type { KaqObjective } from '../kaq-objective-taxonomy';
import { PORTRAIT_V2_DIMENSION_IDS } from '../kaq-objective-taxonomy';

type RuntimeKnowledgeNode = {
  id: string;
  name: string;
  metadata?: {
    infograph?: {
      path?: string;
      nodeId?: string;
      sourceNodeId?: string;
    } | null;
  };
};

const runtimeNodes = JSON.parse(
  readFileSync(join(process.cwd(), 'course-content/runtime/knowledge/graph/nodes.json'), 'utf8'),
) as RuntimeKnowledgeNode[];

const runtimeNodeIds = new Set(runtimeNodes.map((node) => node.id));
const runtimeNodeById = new Map(runtimeNodes.map((node) => [node.id, node]));

const knowledgeNodes = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.filter((node) => node.domain === 'knowledge');
const capabilityNodes = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.filter((node) => node.domain === 'capability');
const qualityNodes = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.filter((node) => node.domain === 'quality');

function objectives(): KaqObjective[] {
  return [
    ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.knowledge,
    ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.capability,
    ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.quality,
  ];
}

describe('autocontrol K/A/Q graph catalog', () => {
  it('validates the objective taxonomy and graph schema together', () => {
    const report = validateAutocontrolKaqGraphCatalog();

    expect(report.objectiveValidation).toEqual({ valid: true, issues: [] });
    expect(report.graphValidation).toEqual({ valid: true, issues: [] });
  });

  it('covers every portrait v2 dimension with active capability nodes', () => {
    const coveredDimensions = new Set(
      capabilityNodes
        .filter((node) => node.status === 'active')
        .flatMap((node) => node.portraitDimensions),
    );

    expect([...coveredDimensions].sort()).toEqual([...PORTRAIT_V2_DIMENSION_IDS].sort());
  });

  it('binds every knowledge graph node to current runtime knowledge ids', () => {
    const boundRefs = knowledgeNodes.flatMap((node) => node.knowledgeRefs.map((ref) => ({ ref, nodeId: node.id })));
    const missingRefs = boundRefs.filter(({ ref }) => !runtimeNodeIds.has(ref));

    expect(missingRefs).toEqual([]);
  });

  it('marks canonical runtime refs without infograph assets as partial coverage', () => {
    const coverageByNode = new Map(
      AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE.map((coverage) => [coverage.graphNodeId, coverage]),
    );

    for (const node of knowledgeNodes) {
      const coverage = coverageByNode.get(node.id);

      expect(coverage).toBeDefined();
      expect(coverage?.runtimeKnowledgeRefs).toEqual(node.knowledgeRefs);
      if (coverage?.coverageState === 'runtime-bound') {
        for (const ref of coverage.runtimeKnowledgeRefs) {
          const infographPath = runtimeNodeById.get(ref)?.metadata?.infograph?.path;

          expect(infographPath).toBe(`course-content/runtime/knowledge/infographs/nodes/${ref}.png`);
          expect(existsSync(join(process.cwd(), infographPath ?? 'missing'))).toBe(true);
        }
      } else {
        expect(coverage?.limitation?.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses canonical runtime ids instead of known duplicate mirror ids', () => {
    const allRefs = new Set(knowledgeNodes.flatMap((node) => node.knowledgeRefs));

    expect(allRefs).toContain('传递函数_2_2c5e2589');
    expect(allRefs).toContain('根轨迹法_2_e3f6c0c1');
    expect(allRefs).toContain('Bode首轮骨架_5_1e07d9da');
    expect(allRefs).toContain('相角裕度_5_5a74b451');
    expect(allRefs).toContain('幅值裕度_5_73af26a5');
    expect(allRefs).toContain('船舶航向控制对象_2_21004');
    expect(allRefs).not.toContain('传递函数_1_1');
    expect(allRefs).not.toContain('传递函数_1_2');
    expect(allRefs).not.toContain('根轨迹_1_1');
    expect(allRefs).not.toContain('Bode图_1_1');
  });

  it('records partial runtime coverage where precise runtime nodes are unavailable or ambiguous', () => {
    const coverageByNode = new Map(
      AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE.map((coverage) => [coverage.graphNodeId, coverage]),
    );

    expect([...coverageByNode.keys()].sort()).toEqual(knowledgeNodes.map((node) => node.id).sort());
    expect(coverageByNode.get('kn:autocontrol:controller-correction')).toMatchObject({
      coverageState: 'partial',
    });
    expect(coverageByNode.get('kn:autocontrol:simulation-validation')).toMatchObject({
      coverageState: 'partial',
    });
    expect(coverageByNode.get('kn:autocontrol:modern-transfer')).toMatchObject({
      coverageState: 'partial',
    });
    expect(
      AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE
        .filter((coverage) => coverage.coverageState === 'partial')
        .every((coverage) => typeof coverage.limitation === 'string' && coverage.limitation.length > 0),
    ).toBe(true);
  });

  it('keeps active quality nodes scenario, behavior, rubric, and evidence rich', () => {
    for (const node of qualityNodes) {
      expect(node.status).toBe('active');
      expect(node.scenario.length).toBeGreaterThan(20);
      expect(node.observableBehaviors.length).toBeGreaterThanOrEqual(2);
      expect(node.rubricLevels.length).toBeGreaterThanOrEqual(3);
      expect(node.evidenceSources.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('declares the required graph relation families and system-tradeoff quality node', () => {
    const relations = new Set(AUTOCONTROL_KAQ_GRAPH_CATALOG.edges.map((edge) => edge.relation));
    const objectiveIds = new Set([
      ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.knowledge.map((objective) => objective.id),
      ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.capability.map((objective) => objective.id),
      ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.quality.map((objective) => objective.id),
    ]);

    expect([...relations]).toEqual(expect.arrayContaining(['supports', 'depends-on', 'assesses', 'transfers-to', 'constrains']));
    expect(objectiveIds).toContain('quality:autocontrol:system-tradeoff');
  });

  it('keeps objective graph bindings synchronized with graph node objective ids', () => {
    const graphNodeById = new Map<string, KaqGraphNode>(
      AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) => [node.id, node]),
    );
    const objectiveById = new Map(objectives().map((objective) => [objective.id, objective]));

    for (const objective of objectiveById.values()) {
      expect(objective.graphBinding?.required).toBe(true);
      for (const bindingRef of objective.graphBinding?.bindingRefs ?? []) {
        const graphNode = graphNodeById.get(bindingRef);

        expect(graphNode).toBeDefined();
        expect(graphNode?.domain).toBe(objective.domain);
        expect(objective.graphBinding?.nodeKinds).toContain(graphNode?.domain);
        if (objective.level !== 'overall') {
          expect(graphNode?.objectiveIds).toContain(objective.id);
        }
      }
    }

    for (const graphNode of graphNodeById.values()) {
      for (const objectiveId of graphNode.objectiveIds) {
        const objective = objectiveById.get(objectiveId);

        expect(objective).toBeDefined();
        expect(objective?.domain).toBe(graphNode.domain);
        expect(objective?.graphBinding?.bindingRefs).toContain(graphNode.id);
      }
    }
  });
});
