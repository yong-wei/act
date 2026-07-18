import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY,
  REQUIRED_RUNTIME_FIRST_GATE_LESSONS,
  resolveCourseResponseProducingLessonInventoryItem,
} from '@/features/interactive/course-submission-gate-inventory';
import { COURSE_AI_CONTEXT_REGISTRY, isCourseAIContextRegistered } from '@/lib/course-ai-contexts';
import { COURSE_EVIDENCE_SPEC_OVERRIDES } from '@/lib/data-governance/course-evidence-specs';
import {
  listInteractiveLessonIdentityRecords,
  resolveInteractiveLessonIdentity,
  resolveInteractiveLessonRouteFromPlanTitle,
} from '../interactive-lesson-identity';

const repoRoot = process.cwd();

type LessonIdMapEntry = {
  canonical_id: string;
  request_ids?: string[];
  runtime_lesson_dir?: string;
  status?: string;
};

function readLessonIdMapEntries(): LessonIdMapEntry[] {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'course-content/authoring/shared/lesson-id-map.json'), 'utf8'),
  ) as { entries?: LessonIdMapEntry[] };
  return raw.entries ?? [];
}

describe('interactive lesson identity resolver', () => {
  it('resolves lesson 5-3 through every active alias family', () => {
    const aliases = [
      { kind: 'canonicalId' as const, value: '5-3' },
      { kind: 'routeSegment' as const, value: 'unit-5-3-mass-coordination-chain' },
      { kind: 'runtimeLessonDir' as const, value: '5-3' },
      { kind: 'lessonKey' as const, value: 'unit-5-3-mass-coordination-chain-v1' },
      { kind: 'presetKey' as const, value: 'unit-5-3-mass-coordination-chain-v1' },
      { kind: 'planTitleAlias' as const, value: '5-3：从单回路控制到复杂自主系统链路' },
      { kind: 'evidenceAlias' as const, value: 'unit-5-3-mass-coordination-chain' },
    ];

    for (const alias of aliases) {
      const resolved = resolveInteractiveLessonIdentity(alias);

      expect(resolved.status, alias.kind).toBe('resolved');
      if (resolved.status !== 'resolved') throw new Error(`${alias.kind} did not resolve`);
      expect(resolved.record).toMatchObject({
        canonicalId: '5-3',
        runtimeLessonDir: '5-3',
      });
      expect(resolved.record.routeSegments).toContain('unit-5-3-mass-coordination-chain');
      expect(resolved.record.lessonKeys).toContain('unit-5-3-mass-coordination-chain-v1');
      expect(resolved.matchedAlias.kind).toBe(alias.kind);
    }
  });

  it('classifies unknown and retired lesson identities explicitly', () => {
    expect(resolveInteractiveLessonIdentity('not-a-lesson')).toMatchObject({
      status: 'unsupported',
      reason: 'unknown',
      requested: 'not-a-lesson',
    });

    expect(resolveInteractiveLessonIdentity({ kind: 'runtimeLessonDir', value: 'legacy/L-sum' })).toMatchObject({
      status: 'unsupported',
      reason: 'unknown',
      requested: 'legacy/L-sum',
    });
  });

  it('resolves classroom plan titles through the same registry', () => {
    expect(resolveInteractiveLessonRouteFromPlanTitle('5-3：从单回路控制到复杂自主系统链路（副本）')).toEqual({
      routeSegment: 'unit-5-3-mass-coordination-chain',
      isPremiumCourse: true,
      canonicalId: '5-3',
    });

    expect(resolveInteractiveLessonRouteFromPlanTitle('普通课堂')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
      canonicalId: null,
    });
  });

  it('lets migrated inventory and AI context helpers accept canonical aliases', () => {
    for (const identity of [
      '5-3',
      'unit-5-3-mass-coordination-chain',
      'unit-5-3-mass-coordination-chain-v1',
    ]) {
      expect(resolveCourseResponseProducingLessonInventoryItem(identity)?.lessonId, identity).toBe('5-3');
      expect(isCourseAIContextRegistered(identity), identity).toBe(true);
    }
  });

  it('registers lesson 1-5 as a formal interactive unit', () => {
    const resolved = resolveInteractiveLessonIdentity({
      kind: 'routeSegment',
      value: 'unit-1-5-three-domain-gain-sweep',
    });

    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') throw new Error('1-5 route did not resolve');
    expect(resolved.record).toMatchObject({
      canonicalId: '1-5',
      runtimeLessonDir: '1-5',
      routeSegments: ['unit-1-5-three-domain-gain-sweep'],
      lessonKeys: ['unit-1-5-three-domain-gain-sweep-v1'],
      presetKeys: ['unit-1-5-three-domain-gain-sweep-v1'],
    });
  });

  it('registers lesson 1-4 as a formal interactive unit', () => {
    const resolved = resolveInteractiveLessonIdentity({
      kind: 'routeSegment',
      value: 'unit-1-4-time-frequency-views',
    });

    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') throw new Error('1-4 route did not resolve');
    expect(resolved.record).toMatchObject({
      canonicalId: '1-4',
      runtimeLessonDir: '1-4',
      routeSegments: ['unit-1-4-time-frequency-views'],
      lessonKeys: ['unit-1-4-time-frequency-views-v1'],
      presetKeys: ['unit-1-4-time-frequency-views-v1'],
    });
  });

  it('keeps the registry aligned with gate inventory, AI context, and lesson-id map surfaces', () => {
    const records = listInteractiveLessonIdentityRecords();
    const recordsById = new Map(records.map((record) => [record.canonicalId, record]));

    expect([...recordsById.keys()]).toEqual(expect.arrayContaining([...REQUIRED_RUNTIME_FIRST_GATE_LESSONS]));

    for (const inventoryItem of COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY) {
      const record = recordsById.get(inventoryItem.lessonId);
      expect(record, inventoryItem.lessonId).toBeDefined();
      expect(record?.routeSegments, inventoryItem.lessonId).toContain(inventoryItem.routeSegment);
      expect(`course-content/runtime/lessons/${record?.runtimeLessonDir}/interactive-manifest.json`).toBe(
        inventoryItem.manifestPath,
      );
    }

    for (const courseId of Object.keys(COURSE_AI_CONTEXT_REGISTRY)) {
      const resolved = resolveInteractiveLessonIdentity({ kind: 'lessonKey', value: courseId });
      expect(resolved.status, courseId).toBe('resolved');
    }

    expect(new Set(COURSE_EVIDENCE_SPEC_OVERRIDES.map((override) => override.lessonId))).toEqual(
      new Set(records.map((record) => record.canonicalId)),
    );
    for (const override of COURSE_EVIDENCE_SPEC_OVERRIDES) {
      const record = recordsById.get(override.lessonId);
      expect(record, override.lessonId).toBeDefined();
      if (!record) continue;
      if (override.lessonKey) {
        expect(record.lessonKeys, override.lessonId).toContain(override.lessonKey);
      }
      if (override.routeSegment) {
        expect(record.routeSegments, override.lessonId).toContain(override.routeSegment);
      }
    }

    for (const entry of readLessonIdMapEntries().filter((item) => item.status === 'mainline')) {
      const record = recordsById.get(entry.canonical_id);
      expect(record, entry.canonical_id).toBeDefined();
      expect(record?.runtimeLessonDir, entry.canonical_id).toBe(entry.runtime_lesson_dir);
      for (const requestId of entry.request_ids ?? []) {
        const resolved = resolveInteractiveLessonIdentity({ kind: 'canonicalId', value: requestId });
        expect(resolved.status, requestId).toBe('resolved');
      }
    }
  });
});
