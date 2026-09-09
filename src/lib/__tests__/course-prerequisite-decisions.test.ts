import { describe, expect, it } from 'vitest';
import { COURSE_UNIT_ORDER } from '../teaching-projection/domain-fragments/adopt-engineering-prerequisites';
import {
  courseOrderSemanticDigest,
  validateCourseOrderDecisions,
  type CourseOrderInputs,
  type CourseOrderObject,
} from '../teaching-projection/domain-fragments/course-prerequisite-decisions';

const evidence = 'course-content/syllabus-refactor/unit-design-details/module2.md';
const objects: CourseOrderObject[] = [
  { id: 'natural-frequency', type: 'DomainConcept', name: '自然频率', definition: '无阻尼固有频率' },
  { id: 'peak-time', type: 'DomainConcept', name: '峰值时间', definition: '首次峰值时刻' },
];

function input(): CourseOrderInputs {
  return {
    manifest: {
      contract: 'act-course-prerequisite-decisions/v1',
      authority: { snapshotId: 'snapshot', snapshotHash: 'a'.repeat(64), releaseId: 'release', releaseSetId: 'set' },
      coverageScope: 'available-authority', fullCourseCoverage: false,
      acceptedAuthorityGapPolicy: 'Keep missing Authority subjects explicitly deferred.',
      requiredUnits: [...COURSE_UNIT_ORDER], requiredTopics: ['frequency', 'peak'], acceptedGapTopics: [],
      sourceFiles: [{ path: evidence, sha256: 'b'.repeat(64) }], retainedSources: [],
    },
    units: COURSE_UNIT_ORDER.map((unitId) => ({ unitId, topicKeys: ['frequency', 'peak'], evidenceRefs: [evidence] })),
    topics: objects.map((object, i) => ({
      key: i === 0 ? 'frequency' : 'peak', label: object.name, status: 'mapped', canonicalIds: [object.id],
      units: [...COURSE_UNIT_ORDER], evidenceRefs: [evidence], rationale: 'Use the stated standard second-order meaning.',
      authorityEvidence: [{ canonicalId: object.id, semanticDigest: courseOrderSemanticDigest(object) }],
    })),
    decisions: [{ decisionId: 'frequency-before-peak', sourceTopic: 'frequency', targetTopic: 'peak',
      strength: 'RECOMMENDED', rationale: 'Use the oscillation time scale before calculating the first peak.', evidenceRefs: [evidence] }],
  };
}

describe('explicit full-syllabus prerequisite decisions', () => {
  it('covers an unbound course concept without reading any resource binding denominator', () => {
    const result = validateCourseOrderDecisions(input(), objects);
    expect(result.report.mappedCanonicalCount).toBe(2);
    expect(result.report.unitCount).toBe(31);
    expect(result.report.isolatedCanonicalIds).toEqual([]);
    expect(result.edges[0]).toMatchObject({ sourceId: 'natural-frequency', targetId: 'peak-time' });
  });

  it('rejects a silently narrowed topic or unit denominator', () => {
    const subject = input();
    subject.topics.pop();
    expect(() => validateCourseOrderDecisions(subject, objects)).toThrow('topic denominator');
    const missingUnit = input();
    missingUnit.units.pop();
    expect(() => validateCourseOrderDecisions(missingUnit, objects)).toThrow('unit coverage');
  });

  it('does not replace missing evidence with unit order or arbitrary connectivity', () => {
    const missing = input();
    missing.decisions[0].evidenceRefs = [];
    expect(() => validateCourseOrderDecisions(missing, objects)).toThrow('unsealed evidence');
    const isolated = input();
    isolated.decisions = [];
    expect(() => validateCourseOrderDecisions(isolated, objects)).toThrow('isolated');
  });

  it('rejects changed Authority semantics even when the canonical id is unchanged', () => {
    const changed = objects.map((object) => ({ ...object, definition: 'Another definition' }));
    expect(() => validateCourseOrderDecisions(input(), changed)).toThrow('Authority semantic mismatch');
  });

  it('rejects REQUIRED cycles instead of automatically downgrading an edge', () => {
    const subject = input();
    subject.decisions[0].strength = 'REQUIRED';
    subject.decisions.push({ ...subject.decisions[0], decisionId: 'reverse', sourceTopic: 'peak', targetTopic: 'frequency' });
    expect(() => validateCourseOrderDecisions(subject, objects)).toThrow('REQUIRED cycle');
  });

  it('keeps accepted missing subjects without claiming full-course completeness', () => {
    const subject = input();
    subject.manifest.requiredTopics.push('rl');
    subject.manifest.acceptedGapTopics.push('rl');
    subject.units[0].topicKeys.push('rl');
    subject.topics.push({ key: 'rl', label: '强化学习', status: 'authority-gap', canonicalIds: [],
      authorityEvidence: [], units: [COURSE_UNIT_ORDER[0]], evidenceRefs: [evidence], rationale: 'No corresponding Authority object.' });
    const result = validateCourseOrderDecisions(subject, objects);
    expect(result.report.authorityGaps[0].key).toBe('rl');
    expect(result.report.fullCourseCoverage).toBe(false);
    expect(result.report.mappedCanonicalCount).toBe(2);
  });

  it('rejects hiding a known mapped concept as an unaccepted gap', () => {
    const subject = input();
    subject.topics[0] = { ...subject.topics[0], status: 'authority-gap', canonicalIds: [], authorityEvidence: [] };
    expect(() => validateCourseOrderDecisions(subject, objects)).toThrow('unaccepted or fabricated gap');
  });
});
