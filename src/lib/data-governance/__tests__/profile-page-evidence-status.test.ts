import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('student profile evidence status page wiring', () => {
  it('renders compact evidence status and low-confidence recommendation labels', () => {
    const pageSource = readFileSync(
      join(process.cwd(), 'src/app/(main)/profile/page.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('evidenceStatus');
    expect(pageSource).toContain('证据状态');
    expect(pageSource).toContain('formatEvidenceStatusSummary');
    expect(pageSource).toContain('recommendationConfidenceLabel');
    expect(pageSource).toContain('证据置信度低');
    expect(pageSource).toContain('证据待刷新');
  });
});
