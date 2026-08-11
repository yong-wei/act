import { describe, expect, it } from 'vitest';

import {
  createRuntimeReleaseActiveReceipt,
  createRuntimeReleaseSelection,
  parseRuntimeReleaseActiveReceipt,
  parseRuntimeReleaseSelection,
  serializeRuntimeReleaseActiveReceipt,
  serializeRuntimeReleaseSelection,
} from '../runtime-release-selection';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('runtime release host selection', () => {
  it('fences stale active expectations and creates monotonic generations', () => {
    const first = createRuntimeReleaseSelection({
      previousSelection: null,
      activeReceipt: null,
      expectedActiveReleaseId: null,
      releaseId: 'runtime-a',
      manifestSha256: a,
      treeSha256: b,
    });
    const second = createRuntimeReleaseSelection({
      previousSelection: first,
      activeReceipt: createRuntimeReleaseActiveReceipt(first),
      expectedActiveReleaseId: 'runtime-a',
      releaseId: 'runtime-b',
      manifestSha256: b,
      treeSha256: a,
    });
    expect(first.generation).toBe(1);
    expect(second.generation).toBe(2);
    expect(() => createRuntimeReleaseSelection({
      previousSelection: second,
      activeReceipt: createRuntimeReleaseActiveReceipt(first),
      expectedActiveReleaseId: 'runtime-c',
      releaseId: 'runtime-c',
      manifestSha256: a,
      treeSha256: b,
    })).toThrow(/Expected active release does not match/);
  });

  it('preserves actual active state across a failed desired candidate', () => {
    const selection = createRuntimeReleaseSelection({
      previousSelection: null,
      activeReceipt: null,
      expectedActiveReleaseId: null,
      releaseId: 'runtime-a',
      manifestSha256: a,
      treeSha256: b,
    });
    const receipt = createRuntimeReleaseActiveReceipt(selection);
    const failedCandidate = createRuntimeReleaseSelection({
      previousSelection: selection,
      activeReceipt: receipt,
      expectedActiveReleaseId: 'runtime-a',
      releaseId: 'runtime-b',
      manifestSha256: b,
      treeSha256: a,
    });
    const rollback = createRuntimeReleaseSelection({
      previousSelection: failedCandidate,
      activeReceipt: receipt,
      expectedActiveReleaseId: 'runtime-a',
      releaseId: 'runtime-a',
      manifestSha256: a,
      treeSha256: b,
    });
    expect(rollback.generation).toBe(3);
    expect(parseRuntimeReleaseSelection(JSON.parse(serializeRuntimeReleaseSelection(selection)))).toEqual(selection);
    expect(parseRuntimeReleaseActiveReceipt(JSON.parse(serializeRuntimeReleaseActiveReceipt(receipt)))).toEqual(receipt);
    expect(() => parseRuntimeReleaseActiveReceipt({ schemaVersion: 'runtime-release-active-receipt.v1', selection }))
      .toThrow(/Runtime active receipt is invalid/);
  });
});
