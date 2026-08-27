import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  retrieveTextbookSourcePackV2,
  retrieveTextbookSourcePackV2Progressive,
} from '@/lib/source-pack/textbook-v2-adapter';

const canonicalIndexRoot = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbook-hybrid-retrieval',
  'bge-m3',
);
const canonicalRuntimeBookManifest = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbooks-v2',
  'hu-shousong-auto-control-8th',
  'manifest.json',
);
const canonicalRuntimeAvailable = (
  existsSync(path.join(canonicalIndexRoot, 'manifest.json'))
  && existsSync(canonicalRuntimeBookManifest)
);

describe.skipIf(!canonicalRuntimeAvailable)(
  'real canonical textbook retrieval index smoke',
  () => {
    it('returns non-empty candidate text for normal and progressive retrieval', async () => {
      const query = '单位阶跃响应';

      const normal = await retrieveTextbookSourcePackV2({
        query,
        externalQuery: null,
        indexRoot: canonicalIndexRoot,
      });
      expect(normal.candidates.length).toBeGreaterThan(0);
      expect(normal.candidates[0].text.trim()).not.toBe('');

      const progressive = await retrieveTextbookSourcePackV2Progressive({
        query,
        externalQuery: null,
        indexRoot: canonicalIndexRoot,
      });
      expect(progressive.foreground.candidates.length).toBeGreaterThan(0);
      expect(progressive.foreground.candidates[0].text.trim()).not.toBe('');
    }, 120_000);
  },
);
