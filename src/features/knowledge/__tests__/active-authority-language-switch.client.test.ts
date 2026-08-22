// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';
import {
  createEmptyAuthorityShardWorkspace,
  mergeAuthorityShard,
} from '../active-authority-shard-store';
import type {
  AuthorityShardPublicEnvelope,
  PublicAuthorityDomainDefaultShard,
  PublicAuthorityRootShard,
} from '@/lib/authority-domain-shards/contracts';
import { GRAPH_INTERFACE_CATALOG, GRAPH_INTERFACE_KEYS } from '@/lib/authority-locale-readiness/graph-interface-catalog';
import { createGraphLanguageState, selectGraphLanguage } from '@/lib/authority-locale-readiness/presentation-state';

const shardEnvelope: AuthorityShardPublicEnvelope = {
  contract: 'act-authority-shard-envelope/v1',
  authorityCatalogVersion: 'acv-locale-switch',
  teachingVersion: null,
  localeProfileVersion: 'alp-test-historical-zh-CN',
  match: { authority: true, catalog: true, teaching: null },
};

const rootShard: PublicAuthorityRootShard = {
  shardClass: 'root',
  envelope: shardEnvelope,
  localeCapability: {
    availableLocales: ['zh-CN'],
    bilingualReady: false,
    englishUnavailableReason: '当前发布尚未通过完整英文资格，暂不能切换到 English。',
    mode: 'historical',
    languageComponentDigest: null,
  },
  root: {
    kind: 'presentation-root-catalog',
    domains: [{
      kind: 'presentation-domain',
      order: 1,
      displayName: '系统建模',
      summary: '从对象到系统模型',
      presentationRole: 'domain',
      visualRole: 'modeling',
      memberCount: 1,
    }],
    aggregate: {
      kind: 'presentation-aggregate',
      order: 0,
      displayName: '控制理论综合',
      summary: '汇总入口',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
      domainCount: 1,
    },
  },
};

function mockResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe('active authority language switch', () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input).split('?')[0] ?? '';
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to Chinese and keeps English unavailable without writing learner state', async () => {
    act(() => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: false,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }),
      }));
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const graph = container.querySelector('[data-active-authority-graph="true"]');
    expect(graph?.getAttribute('data-graph-locale')).toBe('zh-CN');
    const english = container.querySelector('[data-graph-language="en"]') as HTMLButtonElement | null;
    expect(english?.disabled).toBe(true);
    expect(container.querySelector('[data-graph-language-unavailable="en"]')?.textContent).toContain('English');
    expect(container.textContent).toContain('中文');
    expect(container.textContent).not.toContain('Transfer function');
    english?.click();
    await act(async () => { await Promise.resolve(); });
    expect(graph?.getAttribute('data-graph-locale')).toBe('zh-CN');
  });

  it('replaces display records on locale refresh without dropping topology or selection', () => {
    const established = mergeAuthorityShard(createEmptyAuthorityShardWorkspace(), rootShard);
    const withDomain = mergeAuthorityShard(established, {
      shardClass: 'domain-default',
      envelope: shardEnvelope,
      visualRole: 'modeling',
      domainId: 'system-modeling',
      objects: [{
        id: 'node-concept',
        canonicalType: 'DomainConcept',
        label: '传递函数',
        aliases: [],
        description: '中文说明',
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
        semanticSupport: { supported: true, readOnly: true },
        memberships: [{ domainId: 'system-modeling', visualRole: 'modeling', preferred: true }],
      }],
      teachingRelations: [],
      teachingCoverage: {
        status: 'available',
        domainId: 'system-modeling',
        relationCount: 0,
        coreNodeCount: 0,
        uncoveredCoreNodeCount: 0,
        note: '教学关系可用',
      },
    } as PublicAuthorityDomainDefaultShard);
    const positioned = {
      ...withDomain,
      selectedCanonicalId: 'node-concept',
      inspectorOpen: true,
      positionsByCanonicalId: { 'node-concept': { x: 12, y: 24 } },
      enabledFamilies: ['association' as const],
    };
    const englishEnvelope = {
      ...shardEnvelope,
      localeProfileVersion: 'alp-test-complete-en',
    };
    const switched = mergeAuthorityShard(positioned, {
      shardClass: 'domain-default',
      envelope: englishEnvelope,
      visualRole: 'modeling',
      domainId: 'system-modeling',
      objects: [{
        id: 'node-concept',
        canonicalType: 'DomainConcept',
        label: 'Transfer function',
        aliases: ['TF'],
        description: 'English explanation',
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
        semanticSupport: { supported: true, readOnly: true },
        memberships: [{ domainId: 'system-modeling', visualRole: 'modeling', preferred: true }],
      }],
      teachingRelations: [],
      teachingCoverage: {
        status: 'available',
        domainId: 'system-modeling',
        relationCount: 0,
        coreNodeCount: 0,
        uncoveredCoreNodeCount: 0,
        note: 'Teaching relations available',
      },
    } as PublicAuthorityDomainDefaultShard);
    expect(switched.selectedCanonicalId).toBe('node-concept');
    expect(switched.positionsByCanonicalId['node-concept']).toEqual({ x: 12, y: 24 });
    expect(switched.enabledFamilies).toEqual(['association']);
    expect(switched.objectsByCanonicalId['node-concept']?.label).toBe('Transfer function');
    expect(switched.envelope?.localeProfileVersion).toBe('alp-test-complete-en');
    expect(switched.envelope?.authorityCatalogVersion).toBe(shardEnvelope.authorityCatalogVersion);
  });

  it('scans registered interface keys for one locale without raw identifiers', () => {
    const bilingual = createGraphLanguageState({
      availableLocales: ['zh-CN', 'en'],
      bilingualReady: true,
      englishUnavailableReason: null,
      mode: 'complete-locale',
      languageComponentDigest: 'a'.repeat(64),
    });
    const english = selectGraphLanguage(bilingual, 'en');
    expect(english.selectedLocale).toBe('en');
    for (const key of GRAPH_INTERFACE_KEYS) {
      const value = GRAPH_INTERFACE_CATALOG[key].en;
      expect(value).toBeTruthy();
      expect(value).not.toMatch(/ctr:release|snap-|course-content\//u);
    }
  });
});
