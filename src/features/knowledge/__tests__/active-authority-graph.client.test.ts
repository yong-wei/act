// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';

const canvas = {
  projectionVersion: 'act.canvas.v2' as const,
  source: {
    authorityState: 'active' as const,
    releaseSetId: 'authority-engineering',
    releaseId: 'control-theory-engineering-v0.12',
    productionAuthoritative: false as const,
    historical: false as const,
    releaseHash: 'a'.repeat(64),
    schemaVersion: '0.2.0',
    projectionDigest: null,
    sourceDatasetHash: 'b'.repeat(64),
  },
  release: { label: 'Engineering Authority', version: 'v0.12', scope: 'engineering' },
  fields: { included: ['node.id'], hidden: ['node.payload'] },
  coverage: {
    status: 'partial' as const,
    objectCount: 1,
    relationCount: 0,
    goldRelationCount: 0,
    silverRelationCount: 0,
    sourceObjectCount: 0,
    evidenceSegmentCount: 0,
  },
  teachingSemantics: { status: 'unavailable' as const, message: '教学关系尚未发布' as const },
  nodes: [{
    id: 'node-a',
    canonicalType: 'DomainConcept',
    label: '稳定性',
    description: '稳定性描述',
    governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
    releaseTier: 'gold',
    semanticSupport: { supported: true, readOnly: true as const },
  }],
  relations: [],
  provenance: {
    authority: {
      consumerId: 'engineering-graph' as const,
      snapshotId: 'snap-active',
      snapshotHash: 'c'.repeat(64),
      releaseId: 'control-theory-engineering-v0.12',
      releaseSetId: 'authority-engineering',
    },
    activation: {
      mode: 'use-combination' as const,
      status: 'READY' as const,
      activationId: 'activation-active',
      activationHash: 'd'.repeat(64),
    },
    projection: { status: 'not-applicable' as const, projectionId: null, projectionHash: null },
  },
};

const detail = {
  projectionVersion: 'act.node-detail.v2' as const,
  source: canvas.source,
  role: 'STUDENT' as const,
  fields: { included: ['node.id'], hidden: ['node.payload'] },
  node: {
    id: 'node-a',
    canonicalType: 'DomainConcept',
    label: '稳定性',
    description: '稳定性描述',
    adjacency: [],
    sources: [{ sourceEditionId: 'edition-1', sectionId: 'section-1' }],
    semanticSupport: { supported: true, readOnly: true as const },
    releaseTier: 'gold',
  },
  provenance: canvas.provenance,
};

describe('active Authority knowledge workspace client boundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        json: async () => url.includes('/nodes/active/') ? detail : canvas,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('defaults to active Authority and keeps active/Legacy responses independent', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: false,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, '历史 Legacy 图谱'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.textContent).toContain('当前 Engineering Authority');
    expect(container.textContent).toContain('Projection：不适用（null）');
    const node = container.querySelector<HTMLButtonElement>('[data-active-authority-node="node-a"]');
    expect(node).not.toBeNull();
    await act(async () => node!.click());
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('edition-1 · section-1');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === '历史 Legacy')!
        .click();
    });
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === '当前 Authority')!
        .click();
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail]')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/knowledge/graph/active',
      '/api/knowledge/nodes/active/node-a',
      '/api/knowledge/graph/active',
    ]);
    expect(fetchMock.mock.calls.every(([url, init]) => (
      String(url).includes('/active')
      && (!init || typeof init !== 'object' || !('method' in init) || init.method === undefined || init.method === 'GET')
    ))).toBe(true);
  });

  it('shows candidate only as an explicit administrator diagnostic', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'admin',
        candidateAllowed: true,
        controlledVerification: true,
        legacy: createElement('div', { 'data-legacy': 'true' }, '历史 Legacy 图谱'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.textContent).toContain('受控候选诊断');
    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/graph/active', expect.any(Object));
  });

  it('keeps the active component browser-safe and free of server resolver imports', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver)/u);
    expect(source).not.toContain('node:fs');
    const workspaceSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'),
      'utf8',
    );
    expect(workspaceSource).not.toMatch(/selector|learning.?state|current\.json/iu);
  });
});
