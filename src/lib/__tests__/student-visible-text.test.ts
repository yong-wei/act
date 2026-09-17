import { describe, expect, it } from 'vitest';

import {
  looksLikeInternalSystemToken,
  presentCollectedLearningEvidence,
  presentStudentVisibleEvidenceSource,
  presentStudentVisibleEvidenceTitle,
  presentStudentVisibleFactType,
  presentStudentVisibleText,
} from '@/lib/student-visible-text';

describe('student-visible text', () => {
  it('rejects canonical, resource, fixture, and event-type identities', () => {
    expect(looksLikeInternalSystemToken('ctc:v11g-21fba199a9fdef15887d600f')).toBe(true);
    expect(looksLikeInternalSystemToken('act:card:ctc_v11g-21fba199a9fdef15887d600f')).toBe(true);
    expect(looksLikeInternalSystemToken('yangfan-diagnostic-fixture')).toBe(true);
    expect(looksLikeInternalSystemToken('control_correction_path.selection_recorded')).toBe(true);
    expect(looksLikeInternalSystemToken('AdaptiveAssessmentAnswer')).toBe(true);
    expect(looksLikeInternalSystemToken('unit-5-2-phase-plane-disturbance-boundary')).toBe(true);
    expect(looksLikeInternalSystemToken('step-09')).toBe(true);
    expect(looksLikeInternalSystemToken('滞后补偿')).toBe(false);
    expect(looksLikeInternalSystemToken('Arena')).toBe(false);
  });

  it('maps evidence types and titles to Chinese without echoing internal tokens', () => {
    expect(presentStudentVisibleFactType('control_correction_path.selection_recorded')).toBe('路径方案选择记录');
    expect(presentStudentVisibleFactType('yangfan-diagnostic-fixture')).toBe('诊断练习记录');
    expect(presentStudentVisibleEvidenceTitle({
      factType: 'control_correction_path.selection_recorded',
    })).toBe('路径方案选择记录');
    expect(presentStudentVisibleEvidenceTitle({
      evidenceTitle: 'ctc:v11g-21fba199a9fdef15887d600f',
      factType: 'question',
    })).toBe('课堂作答记录');
    expect(presentStudentVisibleEvidenceSource('AdaptiveAssessmentAnswer')).toBe('自适应练习作答记录');
    expect(presentStudentVisibleText('ctc:v11g-21fba199a9fdef15887d600f', '知识卡学习记录'))
      .toBe('知识卡学习记录');
  });

  it('describes collected path evidence with the node title instead of canonical ids', () => {
    expect(presentCollectedLearningEvidence({
      title: '滞后补偿',
      resourceLabel: '知识卡',
      knowledgeCoverage: ['ctc:v11g-21fba199a9fdef15887d600f'],
    })).toBe('滞后补偿学习记录');
    expect(presentCollectedLearningEvidence({
      title: 'ctc:v11g-21fba199a9fdef15887d600f',
      resourceLabel: '知识卡',
      knowledgeCoverage: ['ctc:v11g-21fba199a9fdef15887d600f'],
    })).toBe('知识卡完成记录');
  });
});
