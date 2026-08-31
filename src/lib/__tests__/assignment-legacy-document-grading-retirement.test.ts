import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifyLegacyDocumentGradingDraft,
  historicalAdapterMayWriteLearningFact,
} from '@/lib/assignments/legacy-document-grading-historical-adapter';

const ROOT = process.cwd();

describe('assignment legacy document-grading retirement', () => {
  it('classifies drafts without writing LearningFact', () => {
    expect(historicalAdapterMayWriteLearningFact()).toBe(false);
    expect(classifyLegacyDocumentGradingDraft({
      draftId: 'draft-1',
      sourceType: 'document_rubric_grading',
      approvalSnapshotId: 'snapshot-1',
      factIds: ['fact-1'],
      sourceEventIds: ['event-1'],
    })).toMatchObject({
      disposition: 'map-to-snapshot',
      authorityKind: 'TeacherAssignmentApprovalSnapshot',
    });
    expect(classifyLegacyDocumentGradingDraft({
      draftId: 'draft-2',
      sourceType: 'other',
    }).disposition).toBe('blocked-unparseable');
  });

  it('retires draft writebacks on approve, preview, and submissions', () => {
    const approve = readFileSync(join(ROOT, 'src/app/api/teacher/document-grading/approve/route.ts'), 'utf8');
    const preview = readFileSync(join(ROOT, 'src/app/api/teacher/document-grading/writeback-preview/route.ts'), 'utf8');
    const submissions = readFileSync(join(ROOT, 'src/app/api/teacher/document-grading/submissions/route.ts'), 'utf8');
    expect(approve).toContain('legacyDocumentRubricDraftRetiredResponse');
    expect(approve).not.toContain('writeApprovedGradingEvidence');
    expect(preview).toContain('legacyDocumentRubricDraftRetiredResponse');
    expect(submissions).toContain('legacy-document-grading-route-disabled');
  });

  it('keeps a named read-only historical adapter and does not write LearningFact from it', () => {
    const adapter = readFileSync(join(ROOT, 'src/lib/assignments/legacy-document-grading-historical-adapter.ts'), 'utf8');
    expect(existsSync(join(ROOT, 'src/lib/assignments/legacy-document-grading-historical-adapter.ts'))).toBe(true);
    expect(adapter).toContain('historicalAdapterMayWriteLearningFact');
    expect(adapter).not.toContain('learningFact.create');
  });
});
