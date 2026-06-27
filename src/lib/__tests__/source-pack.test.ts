import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runSourcePackCli } from '../../../scripts/source-pack/source-pack-cli';
import {
  buildSourcePack,
  safeValidateSourcePack,
  serializeSourcePackJson,
  serializeSourcePackMarkdown,
  validateSourcePack,
  type SourcePackItem,
} from '../source-pack';

const sampleItem: SourcePackItem = {
  id: 'item:textbook:ch08:chunk-001',
  title: 'PID 参数整定示例',
  sourceKind: 'textbook',
  modality: 'text',
  excerpt: 'PID 参数整定需要同时观察超调、稳态误差和调节时间。',
  inclusionRationale: '该片段直接支撑 PID 参数整定的概念解释。',
  resourceNodeId: 'resource:textbook:dorf-modern-control-systems',
  planningUnitId: 'planning:unit-4-1',
  retrievalChunkId: 'chunk:dorf:ch08:001',
  citationTargetId: 'citation:textbook:dorf:ch08:001',
  scores: {
    relevance: 0.91,
    graphAlignment: 0.82,
    authority: 0.95,
    eligibility: 0.9,
    freshness: 0.8,
    final: 0.88,
  },
  access: {
    visibility: 'student',
    license: 'course-use',
    aiUseAllowed: true,
    policyRef: 'policy:course-runtime',
  },
  citation: {
    citationTargetId: 'citation:textbook:dorf:ch08:001',
    sourceId: 'textbook:dorf-modern-control-systems',
    displayTitle: 'Modern Control Systems Chapter 8',
    href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-sec01.md',
    resolver: 'course-runtime',
    verified: true,
  },
};

describe('source pack contract', () => {
  it('preserves stable ids in JSON and Markdown serializers', () => {
    const pack = buildSourcePack({
      query: '解释 PID 参数整定',
      profile: 'lesson-authoring',
      topK: 3,
      items: [sampleItem],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(validateSourcePack(pack).packId).toMatch(/^source-pack:/);
    expect(pack.audit.citationTargetIds).toEqual(['citation:textbook:dorf:ch08:001']);
    expect(pack.audit.retrievalChunkIds).toEqual(['chunk:dorf:ch08:001']);

    const json = serializeSourcePackJson(pack);
    const markdown = serializeSourcePackMarkdown(pack);

    expect(json).toContain('citation:textbook:dorf:ch08:001');
    expect(json).toContain('chunk:dorf:ch08:001');
    expect(markdown).toContain('Citation target: citation:textbook:dorf:ch08:001');
    expect(markdown).toContain('Retrieval chunk: chunk:dorf:ch08:001');
    expect(markdown).toContain('Citation source: textbook:dorf-modern-control-systems');
    expect(markdown).toContain('Citation resolver: course-runtime');
    expect(markdown).toContain('Citation href: /course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-sec01.md');
    expect(markdown).toContain('Citation verified: yes');
    expect(markdown).toContain('Relevance score: 0.91');
    expect(markdown).toContain('Graph alignment score: 0.82');
    expect(markdown).toContain('Authority score: 0.95');
    expect(markdown).toContain('Eligibility score: 0.90');
    expect(markdown).toContain('Freshness score: 0.80');
    expect(markdown).toContain('License: course-use');
    expect(markdown).toContain('Access policy: policy:course-runtime');
    expect(markdown).toContain('Eligible items: 1');
    expect(markdown).toContain('Omitted items: 2');
    expect(markdown).not.toContain('#L42');
  });

  it('rejects items without stable governed identifiers or with raw citation fields', () => {
    const invalidItem = {
      ...sampleItem,
      resourceNodeId: undefined,
      planningUnitId: undefined,
      retrievalChunkId: undefined,
      citationTargetId: undefined,
      citation: {
        ...sampleItem.citation,
        rawLineNumber: 42,
      },
    };
    const pack = buildSourcePack({
      query: 'invalid fixture',
      profile: 'generic',
      items: [sampleItem],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });
    const result = safeValidateSourcePack({
      ...pack,
      items: [invalidItem],
      coverage: {
        ...pack.coverage,
        returnedItems: 1,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects raw authoring line targets and model-authored URLs as verified citations', () => {
    const pack = buildSourcePack({
      query: 'raw citation fixture',
      profile: 'generic',
      items: [sampleItem],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citationTargetId: 'citation:course-content/authoring/foo.md#L42',
        citation: {
          ...sampleItem.citation,
          citationTargetId: 'citation:course-content/authoring/foo.md#L42',
        },
      }],
      audit: {
        ...pack.audit,
        citationTargetIds: ['citation:course-content/authoring/foo.md#L42'],
      },
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citation: {
          ...sampleItem.citation,
          href: 'https://model.example/raw.md',
          resolver: undefined,
        },
      }],
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citation: {
          ...sampleItem.citation,
          href: 'https://model.example/raw.md',
          resolver: 'course-runtime',
        },
      }],
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citation: {
          ...sampleItem.citation,
          href: 'https://model.example/raw.md#L42',
        },
      }],
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citation: {
          ...sampleItem.citation,
          href: 'course-content/authoring/unit-1/raw.md',
        },
      }],
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citation: {
          ...sampleItem.citation,
          href: 'https://doi.org/10.1000/source-pack-reference',
          resolver: 'verified-external-reference',
        },
      }],
    }).success).toBe(true);

    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...sampleItem,
        citationTargetId: 'citation:https://model.example/raw.md',
        citation: {
          ...sampleItem.citation,
          citationTargetId: 'citation:https://model.example/raw.md',
          sourceId: 'textbook:https://model.example/raw.md',
        },
      }],
      audit: {
        ...pack.audit,
        citationTargetIds: ['citation:https://model.example/raw.md'],
      },
    }).success).toBe(false);
  });

  it('requires governed resolvers for verified URI-scheme citation hrefs', () => {
    const pack = buildSourcePack({
      query: 'external scheme fixture',
      profile: 'generic',
      items: [sampleItem],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    for (const [href, resolver] of [
      ['javascript:alert(1)', undefined],
      ['javascript:alert(1)', 'course-runtime'],
      ['javascript:alert(1)', 'verified-external-reference'],
      ['data:text/html,<script>alert(1)</script>', undefined],
      ['data:text/html,<script>alert(1)</script>', 'official-reference'],
      ['mailto:test@example.com', undefined],
      ['mailto:test@example.com', 'course-runtime'],
      ['mailto:test@example.com', 'doi'],
      ['//model.example/raw.md', undefined],
      ['//model.example/raw.md', 'verified-external-reference'],
    ] as const) {
      expect(safeValidateSourcePack({
        ...pack,
        items: [{
          ...sampleItem,
          citation: {
            ...sampleItem.citation,
            href,
            resolver,
          },
        }],
      }).success).toBe(false);
    }

    for (const [href, resolver] of [
      ['https://doi.org/10.1000/source-pack-reference', 'verified-external-reference'],
      ['/resources/source-pack/item', 'course-runtime'],
      ['#local-anchor', 'course-runtime'],
    ] as const) {
      expect(safeValidateSourcePack({
        ...pack,
        items: [{
          ...sampleItem,
          citation: {
            ...sampleItem.citation,
            href,
            resolver,
          },
        }],
      }).success).toBe(true);
    }
  });

  it('accepts existing knowledge-card governed identifiers without allowing raw targets', () => {
    const pack = buildSourcePack({
      query: 'knowledge card fixture',
      profile: 'generic',
      items: [{
        ...sampleItem,
        sourceKind: 'knowledge-card',
        resourceNodeId: 'knowledge-card:Bode首轮骨架_5_1e07d9da',
        retrievalChunkId: 'chunk:knowledge-card:Bode首轮骨架_5_1e07d9da',
        citationTargetId: 'citation:knowledge-card:Bode首轮骨架_5_1e07d9da',
        citation: {
          ...sampleItem.citation,
          citationTargetId: 'citation:knowledge-card:Bode首轮骨架_5_1e07d9da',
          sourceId: 'knowledge-card:Bode首轮骨架_5_1e07d9da',
        },
      }],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(validateSourcePack(pack).items[0].resourceNodeId).toBe('knowledge-card:Bode首轮骨架_5_1e07d9da');
    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...pack.items[0],
        resourceNodeId: 'knowledge-card:https://model.example/raw',
      }],
    }).success).toBe(false);
  });

  it('accepts existing bare ResourceNode ids without allowing raw targets', () => {
    const pack = buildSourcePack({
      query: 'resource node fixture',
      profile: 'generic',
      items: [{
        ...sampleItem,
        resourceNodeId: 'frequency-precheck',
        planningUnitId: 'planning-unit:frequency-precheck',
        retrievalChunkId: undefined,
        citationTargetId: undefined,
        citation: undefined,
      }],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(validateSourcePack(pack).items[0].resourceNodeId).toBe('frequency-precheck');
    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...pack.items[0],
        resourceNodeId: 'course-content/authoring/unit-1/raw.md',
      }],
    }).success).toBe(false);
    expect(safeValidateSourcePack({
      ...pack,
      items: [{
        ...pack.items[0],
        resourceNodeId: 'https://model.example/raw',
      }],
    }).success).toBe(false);
  });

  it('requires audit id arrays to match item ids', () => {
    const pack = buildSourcePack({
      query: 'audit consistency fixture',
      profile: 'generic',
      items: [sampleItem],
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(safeValidateSourcePack({
      ...pack,
      audit: {
        ...pack.audit,
        citationTargetIds: [],
      },
    }).success).toBe(false);

    expect(safeValidateSourcePack({
      ...pack,
      audit: {
        ...pack.audit,
        retrievalChunkIds: ['chunk:other'],
      },
    }).success).toBe(false);
  });

  it('returns a valid limitation pack when no governed adapter is available', () => {
    const pack = buildSourcePack({
      query: 'source pack shell',
      profile: 'konling',
      topK: 2,
      now: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(pack.items).toEqual([]);
    expect(pack.limitations).toEqual([
      expect.objectContaining({
        code: 'adapter-unavailable',
        recoverable: true,
      }),
    ]);
    expect(validateSourcePack(pack).coverage.returnedItems).toBe(0);
  });

  it('writes JSON, Markdown, and audit files through the CLI shell', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'source-pack-cli-'));
    try {
      const result = await runSourcePackCli([
        'build',
        '--query',
        '解释 PID 参数整定',
        '--profile',
        'lesson-authoring',
        '--out',
        'pack',
        '--format',
        'both',
        '--top-k',
        '2',
      ], cwd);

      expect(result.ok).toBe(true);
      expect(result.files?.map((file) => path.basename(file)).sort()).toEqual([
        'source-pack.audit.json',
        'source-pack.json',
        'source-pack.md',
      ]);
      const json = JSON.parse(readFileSync(path.join(cwd, 'pack/source-pack.json'), 'utf-8'));
      expect(validateSourcePack(json).limitations[0].code).toBe('adapter-unavailable');
      const markdown = readFileSync(path.join(cwd, 'pack/source-pack.md'), 'utf-8');
      expect(markdown).toContain('No governed Source Pack items were returned.');
      expect(markdown).toContain('Source: source-pack.builder.shell');
      expect(markdown).toContain('Recoverable: yes');
      expect(JSON.parse(readFileSync(path.join(cwd, 'pack/source-pack.audit.json'), 'utf-8'))).toMatchObject({
        itemCount: 0,
        limitationCount: 1,
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
