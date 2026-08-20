import { describe, expect, it } from 'vitest';

import {
  captureRevisionSourceFiles,
  type CaptureRevisionProof,
} from '@/lib/commercial-ui-capture-revision';
import { assertDiagnosisDeliveryCaptureProofMatches } from '@/lib/diagnosis-report-delivery-evidence';

const proof: CaptureRevisionProof = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceFingerprint: 'c'.repeat(64),
  clean: true,
};

describe('diagnosis report delivery commercial UI evidence', () => {
  it('uses the dedicated runtime source profile', () => {
    const files = captureRevisionSourceFiles('diagnosis-report-delivery');
    expect(files).toContain('src/features/teacher/diagnosis-report-delivery-view.tsx');
    expect(files).toContain('tests/diagnosis-report-delivery-evidence.spec.ts');
    expect(files.some((file) => file.startsWith('artifacts/commercial-ui/diagnosis-report-delivery-1440/'))).toBe(false);
  });

  it('fails closed when the target port serves another commit', () => {
    expect(() => assertDiagnosisDeliveryCaptureProofMatches(proof, {
      ...proof,
      commitSha: 'd'.repeat(40),
    }, 'capture start')).toThrow(/commitSha mismatch/u);
  });
});
