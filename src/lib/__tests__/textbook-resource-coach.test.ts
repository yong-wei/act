import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canonicalizeTextbookCoachIdentity,
  findLatestPinnedTextbookIdentity,
  hashTextbookMarkdown,
  hydrateTextbookCoachCitation,
  identitiesEqual,
  issueTextbookVersionBoundHandle,
  loadTextbookCoachContext,
  pinTextbookCoachIdentity,
  resolveTextbookCitationClick,
  verifyTextbookVersionBoundHandle,
  type StructuredTextbookUnitIdentity,
} from '@/lib/textbook-resource-coach';
import { boundTextbookCoachPrompt } from '@/lib/textbook-resource-coach/prompt';
import { shouldStartTextbookCoachConversation } from '@/lib/textbook-resource-coach/session-switch';
import { clearTextbookReaderCache } from '@/lib/textbook-reader';

const BOOK_ID = 'dorf-modern-control-systems';
const EDITION = '14th Global Edition';
const UNIT_ID = 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-01/section-final';

let runtimeRoot = '';

async function writeBook(options: {
  revision: string;
  markdown: string;
  includeFragments?: boolean;
}) {
  const bookRoot = path.join(runtimeRoot, BOOK_ID);
  await mkdir(bookRoot, { recursive: true });
  const parentId = 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-01';
  const units = [
    {
      id: parentId,
      bookId: BOOK_ID,
      edition: EDITION,
      chapterId: 'chapter-01',
      structuralPath: ['chapter-chapter-01'],
      parentId: null,
      ancestorIds: [],
      level: 1,
      kind: 'chapter',
      naturalNumber: '1',
      title: '第一章',
      markdown: '# 第一章\n',
      sourceSpan: {
        sourcePath: `textbooks/${BOOK_ID}/chapter-01/textbook.md`,
        startLine: 1,
        endLine: 1,
        startByte: 0,
        endByte: 8,
      },
      fragmentAnchorIds: [],
      recordType: 'structure-unit',
      schemaVersion: 'structured-textbook-runtime.v2',
    },
    {
      id: UNIT_ID,
      bookId: BOOK_ID,
      edition: EDITION,
      chapterId: 'chapter-01',
      structuralPath: ['chapter-chapter-01', 'section-final'],
      parentId,
      ancestorIds: [parentId],
      level: 2,
      kind: 'section',
      naturalNumber: '1.1',
      title: '传递函数',
      markdown: options.markdown,
      sourceSpan: {
        sourcePath: `textbooks/${BOOK_ID}/chapter-01/textbook.md`,
        startLine: 10,
        endLine: 20,
        startByte: 20,
        endByte: 80,
      },
      fragmentAnchorIds: options.includeFragments === false ? [] : ['formula-eq1', 'figure-fig1', 'table-tbl1'],
      recordType: 'structure-unit',
      schemaVersion: 'structured-textbook-runtime.v2',
    },
  ];
  const fragments = options.includeFragments === false ? [] : [
    fragment('formula-eq1', 'formula', 12),
    fragment('figure-fig1', 'figure', 14),
    fragment('table-tbl1', 'table', 16),
  ];
  await writeFile(path.join(bookRoot, 'manifest.json'), JSON.stringify({
    recordType: 'export-manifest',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId: BOOK_ID,
    edition: EDITION,
    sourceRevision: options.revision,
    sourceHashes: {},
    counts: {
      structureUnits: units.length,
      fragmentAnchors: fragments.length,
      retrievalWindows: 0,
      navigationEntries: units.length,
    },
  }));
  await writeFile(path.join(bookRoot, 'units.jsonl'), `${units.map((unit) => JSON.stringify(unit)).join('\n')}\n`);
  await writeFile(path.join(bookRoot, 'anchors.jsonl'), `${fragments.map((item) => JSON.stringify(item)).join('\n')}\n`);
  await writeFile(path.join(bookRoot, 'windows.jsonl'), '');
  await writeFile(path.join(bookRoot, 'navigation.json'), JSON.stringify({
    recordType: 'navigation-index',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId: BOOK_ID,
    entries: [
      { unitId: parentId, parentId: null, childIds: [UNIT_ID], previousUnitId: null, nextUnitId: UNIT_ID },
      { unitId: UNIT_ID, parentId, childIds: [], previousUnitId: parentId, nextUnitId: null },
    ],
  }));
}

function fragment(id: string, kind: 'formula' | 'figure' | 'table', startLine: number) {
  return {
    id: `${UNIT_ID}#${id}`,
    owningUnitId: UNIT_ID,
    kind,
    naturalNumber: null,
    ordinal: 1,
    sourceSpan: {
      sourcePath: `textbooks/${BOOK_ID}/chapter-01/textbook.md`,
      startLine,
      endLine: startLine,
      startByte: 0,
      endByte: 8,
    },
    recordType: 'fragment-anchor',
    schemaVersion: 'structured-textbook-runtime.v2',
  };
}

function identity(overrides: Partial<StructuredTextbookUnitIdentity> = {}): StructuredTextbookUnitIdentity {
  return {
    resourceKind: 'structured-textbook-unit',
    resourceId: UNIT_ID,
    bookId: BOOK_ID,
    edition: EDITION,
    sourceRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    unitId: UNIT_ID,
    contentHash: hashTextbookMarkdown('传递函数 $G(s)$ 如图所示。\n'),
    anchorId: null,
    ...overrides,
  };
}

describe('textbook resource coach', () => {
  beforeEach(async () => {
    runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'act-textbook-coach-'));
    process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = 'textbook-resource-coach-test-secret-value';
    clearTextbookReaderCache();
  });

  afterEach(async () => {
    clearTextbookReaderCache();
    await rm(runtimeRoot, { recursive: true, force: true });
  });

  it('canonicalizes unit identity and rejects untrusted body or URL fields as identity', () => {
    const canonical = canonicalizeTextbookCoachIdentity({
      resourceKind: 'structured-textbook-unit',
      resourceId: UNIT_ID,
      bookId: BOOK_ID,
      edition: EDITION,
      sourceRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      unitId: UNIT_ID,
      contentHash: hashTextbookMarkdown('body'),
      href: '/textbooks/other',
      body: 'forged',
    });
    expect(canonical?.unitId).toBe(UNIT_ID);
    expect(canonical && 'href' in canonical).toBe(false);
    expect(canonicalizeTextbookCoachIdentity({
      resourceKind: 'structured-textbook-unit',
      resourceId: 'other-unit',
      bookId: BOOK_ID,
      edition: EDITION,
      sourceRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      unitId: UNIT_ID,
      contentHash: hashTextbookMarkdown('body'),
    })).toBeNull();
  });

  it('loads unit-level context and registered formula/figure/table fragments', async () => {
    const markdown = '传递函数 $G(s)$ 如图所示。\n';
    await writeBook({ revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', markdown });
    const unit = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: identity(),
    });
    expect(unit.status).toBe('ready');
    if (unit.status !== 'ready') return;
    expect(unit.selectionHint).toBeNull();
    expect(unit.citation.citationId).toBe(`textbook-unit:${UNIT_ID}`);

    for (const anchorId of ['formula-eq1', 'figure-fig1', 'table-tbl1'] as const) {
      const fragmentContext = await loadTextbookCoachContext({
        actorUserId: 'user-1',
        runtimeRoot,
        declared: identity({ anchorId }),
        selectionHint: '传递函数 $G(s)$',
      });
      expect(fragmentContext.status).toBe('ready');
      if (fragmentContext.status !== 'ready') return;
      expect(fragmentContext.identity.anchorId).toBe(anchorId);
      expect(fragmentContext.selectionHint).toBe('传递函数 $G(s)$');
    }
  });

  it('keeps paragraph selections as hints and ignores DOM offsets or selected text as identity', async () => {
    const markdown = '传递函数 $G(s)$ 如图所示。\n';
    await writeBook({ revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', markdown });
    const loaded = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: {
        ...identity(),
        offset: 12,
        lineNumber: 4,
        selectedText: 'not-in-unit',
        url: '/textbooks/forged',
      },
      selectionHint: 'not-in-unit',
    });
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;
    expect(loaded.selectionHint).toBeNull();
    expect(loaded.identity.anchorId).toBeNull();
  });

  it('rejects tampered identity fields and unauthorized actors', async () => {
    await writeBook({
      revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      markdown: '传递函数 $G(s)$ 如图所示。\n',
    });
    const tamperedHash = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: identity({ contentHash: hashTextbookMarkdown('forged-body') }),
    });
    expect(tamperedHash).toEqual({ status: 'unavailable', reason: 'identity-tampered' });

    const unsupported = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: { resourceKind: 'knowledge-card', resourceId: 'card-1' },
    });
    expect(unsupported).toEqual({ status: 'unavailable', reason: 'unsupported-resource-type' });

    const unauthorized = await loadTextbookCoachContext({
      actorUserId: null,
      runtimeRoot,
      declared: identity(),
    });
    expect(unauthorized).toEqual({ status: 'unavailable', reason: 'unauthorized' });
  });

  it('pins the first verified identity and ignores later client replay', async () => {
    const markdown = '传递函数 $G(s)$ 如图所示。\n';
    await writeBook({ revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', markdown });
    const first = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: identity(),
    });
    expect(first.status).toBe('ready');
    if (first.status !== 'ready') return;
    const pin = pinTextbookCoachIdentity({ existingPin: null, verified: first.identity });
    const replay = pinTextbookCoachIdentity({
      existingPin: pin.identity,
      verified: identity({ sourceRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
    });
    expect(replay.replaced).toBe(true);
    expect(identitiesEqual(replay.identity, first.identity)).toBe(true);

    const next = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      pinned: pin.identity,
      declared: identity({ sourceRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
    });
    expect(next.status).toBe('ready');
    if (next.status !== 'ready') return;
    expect(next.identity.sourceRevision).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('does not upgrade a pinned R1 session after R2 becomes active', async () => {
    const r1Markdown = 'R1 body\n';
    await writeBook({ revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', markdown: r1Markdown });
    const r1 = identity({ contentHash: hashTextbookMarkdown(r1Markdown) });
    const pinned = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: r1,
    });
    expect(pinned.status).toBe('ready');

    await writeBook({ revision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', markdown: 'R2 body\n' });
    clearTextbookReaderCache();
    const after = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      pinned: r1,
      declared: identity({
        sourceRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        contentHash: hashTextbookMarkdown('R2 body\n'),
      }),
    });
    expect(after).toEqual({ status: 'unavailable', reason: 'revision-unavailable' });
  });

  it('fails closed on hash drift, missing revision, lost anchors, and permission revocation', async () => {
    await writeBook({
      revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      markdown: 'R1 body\n',
    });
    const r1 = identity({ contentHash: hashTextbookMarkdown('R1 body\n'), anchorId: 'formula-eq1' });
    expect((await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: r1,
    })).status).toBe('ready');

    await writeBook({
      revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      markdown: 'changed body\n',
      includeFragments: false,
    });
    clearTextbookReaderCache();
    expect(await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      pinned: r1,
    })).toEqual({ status: 'unavailable', reason: 'hash-drift' });

    expect(await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      pinned: identity({
        contentHash: hashTextbookMarkdown('changed body\n'),
        anchorId: 'formula-eq1',
      }),
    })).toEqual({ status: 'unavailable', reason: 'anchor-unavailable' });

    expect(await loadTextbookCoachContext({
      actorUserId: null,
      runtimeRoot,
      pinned: r1,
    })).toEqual({ status: 'unavailable', reason: 'unauthorized' });
  });

  it('hydrates only server-owned version-bound citations and rejects model URLs or tampered handles', async () => {
    const markdown = '传递函数 $G(s)$ 如图所示。\n';
    await writeBook({ revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', markdown });
    const loaded = await loadTextbookCoachContext({
      actorUserId: 'user-1',
      runtimeRoot,
      declared: identity(),
    });
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;

    const hydrated = hydrateTextbookCoachCitation(loaded);
    expect(hydrated.verified).toBe(true);
    expect(hydrated.href).toContain('vbh=');
    expect(hydrated.href).toContain('/textbooks/');

    const modelUrl = hydrateTextbookCoachCitation(loaded, { href: 'https://example.com/forged' });
    expect(modelUrl).toMatchObject({ verified: false, href: null, limitation: 'unverified-citation' });

    const click = resolveTextbookCitationClick({ href: hydrated.href, pinned: loaded.identity });
    expect(click.ok).toBe(true);

    const expired = issueTextbookVersionBoundHandle(loaded.identity, Date.now() - 9 * 60 * 60 * 1000);
    expect(verifyTextbookVersionBoundHandle(expired)).toBeNull();
    const tampered = `${hydrated.href}tamper`;
    expect(resolveTextbookCitationClick({ href: tampered, pinned: loaded.identity }).ok).toBe(false);
  });

  it('starts a new textbook coach conversation when the active binding is generic or another unit', () => {
    const requested = {
      mode: 'resource-coach' as const,
      serverContext: {
        resourceKind: 'structured-textbook-unit',
        unitId: UNIT_ID,
        sourceRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        contentHash: hashTextbookMarkdown('传递函数 $G(s)$ 如图所示。\n'),
      },
    };
    expect(shouldStartTextbookCoachConversation(requested, null)).toBe(true);
    expect(shouldStartTextbookCoachConversation(requested, {
      teachingAssistantModeId: 'generic-chat',
      modeClientContextHints: {},
    })).toBe(true);
    expect(shouldStartTextbookCoachConversation(requested, {
      teachingAssistantModeId: 'resource-coach',
      modeClientContextHints: {
        resourceKind: 'structured-textbook-unit',
        unitId: 'other-unit',
        sourceRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        contentHash: requested.serverContext.contentHash,
      },
    })).toBe(true);
    expect(shouldStartTextbookCoachConversation(requested, {
      teachingAssistantModeId: 'resource-coach',
      modeClientContextHints: requested.serverContext,
    })).toBe(false);
  });

  it('keeps a verified late selection hint when the unit body exceeds the prompt budget', () => {
    const hint = 'TARGET_HINT_TOKEN';
    const body = `${'前段'.repeat(2000)}${hint}${'后段'.repeat(2000)}`;
    const bounded = boundTextbookCoachPrompt(body, hint, 400);
    expect(bounded).toContain(hint);
    expect(bounded).toContain('选区提示：');
    expect(bounded.length).toBeLessThanOrEqual(400);
  });

  it('reads the pinned identity from conversation metadata rather than client hints', () => {
    const pinned = identity();
    const messages = [{
      id: '1',
      role: 'system' as const,
      content: 'binding',
      parts: [],
      metadata: {
        konlingAssistantBindingEvent: {
          version: 1,
          teachingAssistantModeId: 'resource-coach',
          modeClientContextHints: { resourceId: 'client-forged' },
          pinnedTextbookResourceIdentity: pinned,
        },
      },
    }];
    expect(findLatestPinnedTextbookIdentity(messages)).toEqual(pinned);
  });
});
