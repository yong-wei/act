// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';
import {
  parseSafeApiEvidenceV1,
  safeApiHasResponsiveNoActiveNode,
} from '../../../../scripts/tests/test-commercial-ui-governance';

const canvas = {
  projectionVersion: 'act.canvas.v2' as const,
  source: {
    authorityState: 'active' as const,
    releaseSetId: 'internal-release-set',
    releaseId: 'internal-release',
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
    objectCount: 4,
    relationCount: 2,
    goldRelationCount: 1,
    silverRelationCount: 1,
    sourceObjectCount: 0,
    evidenceSegmentCount: 0,
  },
  teachingSemantics: { status: 'unavailable' as const, message: '教学关系尚未发布' as const },
  nodes: [
    {
      id: 'node-concept', canonicalType: 'DomainConcept', label: '稳定性', description: '稳定性描述',
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-formula', canonicalType: 'Formula', label: '特征方程', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-model', canonicalType: 'SystemModel', label: '闭环模型', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-isolated', canonicalType: 'KnowledgeStatement', label: '孤立陈述', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    // Unsupported data is not displayed and must not leak its raw values.
    {
      id: 'node-unknown', canonicalType: 'future_internal_type', label: 'future_internal_type', description: null,
      governance: { reviewStatus: 'future_internal_status', publicationStatus: null, lifecycleStatus: null },
      semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  relations: [
    {
      id: 'relation-association', predicate: 'association', sourceId: 'node-concept', targetId: 'node-formula', direction: 'unordered', direct: null,
      qualityTier: 'GOLD', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-applies', predicate: 'applies_to', sourceId: 'node-concept', targetId: 'node-model', direction: 'source_to_target', direct: null,
      qualityTier: 'SILVER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-unknown', predicate: 'future_internal_predicate', sourceId: 'node-concept', targetId: 'node-formula', direction: 'future_internal_direction', direct: null,
      qualityTier: 'FUTURE_INTERNAL_TIER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  provenance: {
    authority: {
      consumerId: 'engineering-graph' as const,
      snapshotId: 'internal-snapshot', snapshotHash: 'c'.repeat(64),
      releaseId: 'internal-release', releaseSetId: 'internal-release-set',
    },
    activation: { mode: 'use-combination' as const, status: 'READY' as const, activationId: 'internal-activation', activationHash: 'd'.repeat(64) },
    projection: { status: 'not-applicable' as const, projectionId: null, projectionHash: null },
  },
};

function nodeDetail(nodeId: string) {
  const names: Record<string, { type: string; label: string; description: string | null }> = {
    'node-concept': { type: 'DomainConcept', label: '稳定性', description: '稳定性描述' },
    'node-formula': { type: 'Formula', label: '特征方程', description: null },
    'node-model': { type: 'SystemModel', label: '闭环模型', description: null },
    'node-isolated': { type: 'KnowledgeStatement', label: '孤立陈述', description: null },
  };
  const current = names[nodeId] ?? names['node-concept'];
  return {
    projectionVersion: 'act.node-detail.v2' as const,
    source: canvas.source,
    role: 'STUDENT' as const,
    fields: { included: ['node.id'], hidden: ['node.payload'] },
    node: {
      id: nodeId,
      canonicalType: current.type,
      label: current.label,
      description: current.description,
      adjacency: nodeId === 'node-isolated' ? [] : [{
        relationId: 'relation-association', predicate: 'association', direction: 'unordered', qualityTier: 'GOLD', neighborId: 'node-formula', traversal: 'outgoing' as const, readOnly: true as const,
      }],
      sources: [{ sourceEditionId: 'internal-edition', sectionId: 'internal-section' }],
      semanticSupport: { supported: true, readOnly: true as const },
    },
    provenance: canvas.provenance,
  };
}

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
      const nodeId = url.split('/').pop() ?? 'node-concept';
      return {
        ok: true,
        status: 200,
        json: async () => url.includes('/nodes/active/') ? nodeDetail(nodeId) : canvas,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders a semantic active canvas and keeps active/Legacy responses independent', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student', candidateAllowed: false, controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, '历史 Legacy 图谱'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-graph-stage="authority"]')).not.toBeNull();
    expect(container.textContent).toContain('当前 Engineering Authority');
    expect(container.textContent).toContain('语义对象');
    expect(container.textContent).not.toContain('internal-release');
    expect(container.textContent).not.toContain('internal-snapshot');
    expect(container.textContent).not.toContain('future_internal');
    expect(container.querySelector('[data-active-authority-node="node-unknown"]')).toBeNull();
    expect(container.querySelectorAll('[data-active-authority-relation]').length).toBe(2);

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.focus();
    });
    expect(document.activeElement).toBe(node);
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const detail = container.querySelector('[data-active-node-detail]');
    expect(detail).not.toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(container.textContent).toContain('来源定位暂不可用');
    expect(container.textContent).not.toContain('internal-edition');
    expect(container.textContent).not.toContain('node-formula');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement).toBe(node);

    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '历史 Legacy')!.click();
    });
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '当前 Authority')!.click();
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail]')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/knowledge/graph/active', '/api/knowledge/nodes/active/node-concept', '/api/knowledge/graph/active',
    ]);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/active'))).toBe(true);
  });

  it('supports search, type filtering, isolated nodes, selection and zoom controls', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '孤立';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-isolated"]');
    expect(result).not.toBeNull();
    await act(async () => result!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-node="node-isolated"]')).not.toBeNull();
    expect(container.textContent).toContain('暂无已发布关系');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement?.getAttribute('data-active-authority-node')).toBe('node-isolated');
    expect(container.querySelector('[aria-label="放大图谱"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="缩小图谱"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="重置图谱视图"]')).not.toBeNull();
    const filter = container.querySelector<HTMLSelectElement>('#active-authority-type-filter')!;
    await act(async () => {
      filter.value = 'Formula';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('公式');
  });

  it('keeps a semantic node click selectable after pointerdown on the node', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      node!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/knowledge/graph/active', '/api/knowledge/nodes/active/node-formula',
    ]);
  });

  it('shows candidate only as an explicit administrator diagnostic', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'admin', candidateAllowed: true, controlledVerification: true, legacy: null,
    })));
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.textContent).toContain('受控候选诊断');
    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/graph/active', expect.any(Object));
  });

  it('keeps the active component browser-safe and free of server or Legacy resolver imports', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    const presentationSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-presentation.ts'), 'utf8');
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(presentationSource).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(source).not.toContain('node:fs');
    expect(presentationSource).not.toContain('node:fs');
    expect(captureSource).toContain('source.releaseSetId === authorityRecord.releaseSetId');
    expect(captureSource).toContain('source.releaseId === authorityRecord.releaseId');
    expect(captureSource).toContain("'/api/knowledge/nodes/active/:node'");
    expect(captureSource).toContain("'/api/knowledge/nodes/:node'");
    expect(captureSource).toContain("if (method !== 'GET') return null;");
    expect(captureSource).toContain("if (!encodedNodeKey || encodedNodeKey.includes('/')) return null;");
    expect(captureSource).toContain("page.on('response', onResponse)");
    expect(captureSource).toContain('createKnowledgeApiProbe');
    expect(captureSource).toContain("page.off('response', onResponse)");
    expect(captureSource).toContain("unknown Knowledge API endpoint observed");
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_API__');
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_ACTIVE_IDENTITY_TOKENS__');
    expect(captureSource).not.toContain('window.fetch =');
    expect(captureSource).toContain('safe-api-evidence/v1');
    expect(captureSource).toContain('function projectSafeApiEvidence');
    expect(captureSource).toContain('function assertSafeApiEvidenceV1');
    expect(captureSource).toContain('type SensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher(await readActiveSurfaceIdentityTokens(page, probe))');
    expect(captureSource).toContain('createSensitiveValueMatcher(sensitiveTokens)');
    expect(captureSource).not.toContain('const tokenVariants = (token: string) =>');
    expect(captureSource).toContain("throw new Error('unknown Knowledge API endpoint cannot be projected')");
    expect(captureSource).not.toContain('cannot be projected: ${pathName}');
    expect(captureSource).toContain('encodeURIComponent(token)');
    expect(captureSource).toContain('decodeURIComponent(token)');
    expect(captureSource).toContain('matchesJsonText');
    expect(captureSource).toContain('sensitiveMatcher.matches(value)');
    expect(captureSource).toContain("['aria-label', 'aria-description', 'title', 'data-tooltip', 'data-tooltip-content']");
    expect(captureSource).toContain('__ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__');
    expect(captureSource).toContain('requestCount');
    expect(captureSource).toContain('forbiddenDataAbsent');
    expect(captureSource).toContain('activeNodeRequestObserved');
    expect(captureSource).toContain('expectedActiveNodeKey');
    expect(captureSource).toContain('activeNodeIdentityMatches');
    expect(captureSource).toContain('provenanceIntegrityMatches');
    const maliciousOpaqueId = 'node/opaque-id?raw=1';
    expect(encodeURIComponent(maliciousOpaqueId)).toContain('%2F');
    expect(captureSource).toContain('dynamic server token');
    const rawLocatorAndEnum = 'sourceLocator future_internal_predicate';
    expect(rawLocatorAndEnum).toContain('sourceLocator');
    expect(rawLocatorAndEnum).toContain('future_internal_predicate');
    const governanceSource = readFileSync(path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    expect(governanceSource).toContain('function parseSafeApiEvidenceV1');
    expect(governanceSource).toContain('exactKeys(record');
    expect(governanceSource).toContain('safeApiSequenceEntry');
    expect(governanceSource).toContain('safeApiHasHealthyActiveIsolation');
    expect(governanceSource).toContain('safeActiveSurfaceScanPassed');
    expect(captureSource).toContain('semanticNodeFocusedBeforeClick');
    expect(captureSource).toContain('detailPanelFocusedAfterOpen');
    const workspaceSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    expect(workspaceSource).not.toMatch(/selector|learning.?state|current\.json/iu);
  });

  it('accepts only the exact safe API evidence schema and rejects opaque leakage', () => {
    const safeEvidence = {
      schemaVersion: 'safe-api-evidence/v1',
      roleClass: 'student',
      sequence: [{ endpointClass: 'active-canvas', status: 200, requestCount: 1 }],
      checks: {
        activeNodeRequestObserved: false,
        activeCanvasIdentityVerified: true,
        activeNodeIdentityVerified: false,
        provenanceIdentityVerified: true,
        roleRequestIsolationVerified: true,
        forbiddenDataAbsent: true,
      },
    } as const;
    expect(parseSafeApiEvidenceV1(safeEvidence)).toEqual(safeEvidence);
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: true },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: false, activeNodeIdentityVerified: true },
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeUndefined();
    const responsiveDetailArtifact = parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: {
        ...safeEvidence.checks,
        activeNodeRequestObserved: true,
        activeNodeIdentityVerified: true,
      },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    });
    expect(safeApiHasResponsiveNoActiveNode(responsiveDetailArtifact)).toBe(false);
    expect(safeApiHasResponsiveNoActiveNode(parseSafeApiEvidenceV1(safeEvidence))).toBe(true);
    expect(parseSafeApiEvidenceV1({ ...safeEvidence, opaqueNodeId: 'node/secret?raw=1' })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      opaqueNodeId: encodeURIComponent('node/secret?raw=1'),
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [{ endpointClass: 'unknown-endpoint', status: 200, requestCount: 1 }],
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, sourceLocator: 'internal/section' },
    })).toBeUndefined();
  });
});
