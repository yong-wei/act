import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphCenterClient } from '@/features/graph-center/graph-center-client';
import { buildGraphCenterPayload } from '../graph-center';

describe('graph center client surface', () => {
  it('renders domain switching, filters, list fallback, and selected-node detail', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      portraitDimension: 'simulationValidationEvidence',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-surface="read-only"');
    expect(html).toContain('data-graph-center-domain="capability"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="graph-center-objective"');
    expect(html).toContain('id="graph-center-portrait"');
    expect(html).toContain('data-graph-center-list-fallback="true"');
    expect(html).toContain('data-graph-center-detail="true"');
    expect(html).toContain('用仿真证据验证方案');
    expect(html).toContain('资源绑定');
    expect(html).toContain('kn:autocontrol:simulation-validation');
    expect(html).toContain('校验');
    expect(html).toContain('通过');
    expect(html).toContain('data-graph-center-knowledge-compatibility-link="true"');
    expect(html).toContain('href="/knowledge"');
  });

  it('renders overlay and seed-coverage limitations outside graph body nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-limitations="true"');
    expect(html).toContain('学习者掌握度 overlay 尚未接入');
    expect(html).toContain('Runtime content');
    expect(html).not.toContain('coveredResourceIds');
  });
});
