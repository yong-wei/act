import { describe, expect, it } from 'vitest';
import { buildGraphCenterPayload } from '../graph-center';

describe('graph center payload service', () => {
  it('builds a knowledge-domain payload with objectives, portrait dimensions, and selected node detail', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.activeDomain).toBe('knowledge');
    expect(payload.domains.map((domain) => domain.id)).toEqual(['knowledge', 'capability', 'quality']);
    expect(payload.graph.nodes.every((node) => node.domain === 'knowledge')).toBe(true);
    expect(payload.graph.edges.every((edge) => edge.domain === 'knowledge')).toBe(true);
    expect(payload.objectives.some((objective) => objective.id === 'knowledge:autocontrol:controller-correction')).toBe(true);
    expect(payload.portraitDimensions.some((dimension) => dimension.id === 'controllerDesignSynthesis')).toBe(true);
    expect(payload.selectedNode?.node.id).toBe('kn:autocontrol:controller-correction');
    expect(payload.selectedNode?.objectives.map((objective) => objective.id)).toContain('knowledge:autocontrol:controller-correction');
    expect(payload.selectedNode?.boundResourceRefs).toEqual(expect.arrayContaining([
      'PID控制器_6_656b8b52',
      '串联校正_6_fede5751',
    ]));
    expect(payload.validation.objectiveValidation.valid).toBe(true);
    expect(payload.validation.graphValidation.valid).toBe(true);
  });

  it('filters by objective and portrait dimension while keeping selected-node details consistent', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      portraitDimension: 'simulationValidationEvidence',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
    });

    expect(payload.activeDomain).toBe('capability');
    expect(payload.objectiveId).toBe('capability:autocontrol:validate-with-simulation-evidence');
    expect(payload.portraitDimension).toBe('simulationValidationEvidence');
    expect(payload.graph.nodes.map((node) => node.id)).toEqual(['cap:autocontrol:validate-with-simulation-evidence']);
    expect(payload.selectedNode?.node.id).toBe('cap:autocontrol:validate-with-simulation-evidence');
    expect(payload.selectedNode?.node.objectiveIds).toContain(payload.objectiveId);
    expect(payload.selectedNode?.node.portraitDimensions).toContain(payload.portraitDimension);
    expect(payload.selectedNode?.boundResourceRefs).toEqual(expect.arrayContaining([
      'cap:autocontrol:validate-with-simulation-evidence',
      'kn:autocontrol:simulation-validation',
    ]));
  });

  it('drops invalid filters instead of leaking nodes across domains', () => {
    const payload = buildGraphCenterPayload({
      domain: 'quality',
      objectiveId: 'knowledge:autocontrol:controller-correction',
      portraitDimension: 'controllerDesignSynthesis',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.activeDomain).toBe('quality');
    expect(payload.objectiveId).toBeNull();
    expect(payload.selectedNode).toBeNull();
    expect(payload.graph.nodes.every((node) => node.domain === 'quality')).toBe(true);
  });

  it('surfaces seed-coverage limitations and keeps overlay placeholders separate from graph body nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'partial-seed-coverage',
      'learner-overlay-unavailable',
      'class-overlay-unavailable',
      'resource-coverage-overlay-unavailable',
    ]));
    expect(payload.overlays).toEqual({
      learner: 'unavailable',
      class: 'unavailable',
      resourceCoverage: 'unavailable',
    });
    for (const node of payload.graph.nodes) {
      expect(Object.hasOwn(node, 'learner')).toBe(false);
      expect(Object.hasOwn(node, 'class')).toBe(false);
      expect(Object.hasOwn(node, 'resourceCoverage')).toBe(false);
      expect(Object.hasOwn(node, 'coveredResourceIds')).toBe(false);
    }
  });
});
