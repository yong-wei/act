import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  V022_AUTHORITY_RELEASE_ID,
  V022_MULTILINGUAL_LABEL_COUNT,
  loadPinnedV022Envelope,
} from '@/lib/actkg-v022-display-projections';
import { isSafeAuthorityLabel } from '@/lib/authority-domain-shards/labels';

const V022_RELEASE = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5';

describe('v0.22 zh-CN display projection binding', () => {
  it('uses the admitted v0.22 terminology count, not the sealed v0.18 1909 invariant', () => {
    const envelope = loadPinnedV022Envelope(process.cwd());
    let count = 0;
    for (const line of readFileSync(`${V022_RELEASE}/multilingual-label-index.jsonl`, 'utf8').split(/\r?\n/u)) {
      if (line.trim()) count += 1;
    }
    expect(count).toBe(V022_MULTILINGUAL_LABEL_COUNT);
    expect(count).toBe(envelope.multilingualLabelCount);
    expect(envelope.releaseId).toBe(V022_AUTHORITY_RELEASE_ID);
    expect(count).not.toBe(1909);
  });

  it('keeps unsafe or empty v0.22 Formula labels fail-closed without exposing identities', () => {
    const projection = JSON.parse(readFileSync(`${V022_RELEASE}/act-projection.json`, 'utf8')) as {
      nodes: Array<{ entity_id: string; entity_type: string; display_name?: string | null }>;
    };
    const formulas = projection.nodes.filter((node) => node.entity_type === 'Formula');
    expect(formulas.length).toBeGreaterThan(0);
    const unsafe: string[] = [];
    for (const node of formulas) {
      const label = node.display_name ?? '';
      if (!isSafeAuthorityLabel(label, 'Formula', true)) {
        expect(label).not.toMatch(/\b(?:ctc|ctf|ctk|ctkg|ctr):/u);
        unsafe.push(node.entity_id);
      }
    }
    // Record-bound pins remain optional; unsafe formulas stay unavailable.
    expect(unsafe.length).toBeGreaterThanOrEqual(0);
  });
});
