import { describe, expect, it } from 'vitest';

import {
  addDetailedRubricLevel,
  applyRubricLevelShortcut,
  clampSuggestedScoreToLevel,
  createInitialDetailedLevel,
  deriveRubricLevelRanges,
  inferEditedRubricLevelIds,
  roundUpToOneDecimal,
  sortRubricLevels,
  teacherScoreIsValid,
} from '../assignments/assignment-rubric-contract';

describe('assignment rubric v2 decimal and level contract', () => {
  it.each([
    [9.01, 9.1],
    [9.1, 9.1],
    [0.01, 0.1],
  ])('rounds %s upward to %s', (input, expected) => {
    expect(roundUpToOneDecimal(input)).toBe(expected);
  });

  it('creates the first detailed level as a publishable full-range level', () => {
    expect(createInitialDetailedLevel('quality', 10)).toEqual({
      id: 'quality-level-1',
      label: '优秀',
      maxPoints: 10,
      guideline: '达到该评分项的完整要求。',
    });
    expect(deriveRubricLevelRanges([createInitialDetailedLevel('quality', 10)], 10))
      .toEqual([expect.objectContaining({ minPoints: 0, maxInclusivePoints: 10 })]);
  });

  it('adds the standard five levels using upward one-decimal percentages', () => {
    let levels = [createInitialDetailedLevel('quality', 7)];
    for (let index = 1; index < 5; index += 1) {
      const result = addDetailedRubricLevel({ criterionId: 'quality', criterionMaxPoints: 7, levels });
      expect(result.status).toBe('applied');
      if (result.status === 'applied') levels = result.levels;
    }
    expect(levels.map((level) => [level.label, level.maxPoints])).toEqual([
      ['优秀', 7],
      ['良好', 6.3],
      ['中等', 5.6],
      ['及格', 4.9],
      ['不及格', 4.2],
    ]);
  });

  it('uses the last-two ratio only for the sixth level and falls back by 0.1', () => {
    const result = addDetailedRubricLevel({
      criterionId: 'quality',
      criterionMaxPoints: 1,
      levels: [
        { id: '1', label: '优秀', maxPoints: 1, guideline: 'a' },
        { id: '2', label: '良好', maxPoints: 0.9, guideline: 'b' },
        { id: '3', label: '中等', maxPoints: 0.8, guideline: 'c' },
        { id: '4', label: '及格', maxPoints: 0.7, guideline: 'd' },
        { id: '5', label: '不及格', maxPoints: 0.6, guideline: 'e' },
      ],
    });
    expect(result).toEqual({
      status: 'applied',
      levels: expect.arrayContaining([
        expect.objectContaining({ label: '自定义', maxPoints: 0.5 }),
      ]),
    });
  });

  it('reuses an unoccupied stable id after deleting a non-trailing level', () => {
    const result = addDetailedRubricLevel({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [
        { id: 'quality-level-1', label: '优秀', maxPoints: 10, guideline: 'a' },
        { id: 'quality-level-2', label: '良好', maxPoints: 9, guideline: 'b' },
        { id: 'quality-level-4', label: '及格', maxPoints: 8, guideline: 'd' },
        { id: 'quality-level-5', label: '不及格', maxPoints: 7, guideline: 'e' },
      ],
    });

    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.levels.at(-1)?.id).toBe('quality-level-3');
      expect(new Set(result.levels.map((level) => level.id)).size).toBe(result.levels.length);
    }
  });

  it('sorts complete records and derives boundary ownership without gaps', () => {
    const levels = sortRubricLevels([
      { id: 'mid', label: '良好', maxPoints: 8, guideline: 'mid' },
      { id: 'high', label: '优秀', maxPoints: 9, guideline: 'high' },
      { id: 'low', label: '及格', maxPoints: 7, guideline: 'low' },
    ], 10);
    expect(levels.map((level) => level.id)).toEqual(['high', 'mid', 'low']);
    expect(deriveRubricLevelRanges(levels, 10)).toEqual([
      expect.objectContaining({ id: 'high', minPoints: 8, maxInclusivePoints: 10 }),
      expect.objectContaining({ id: 'mid', minPoints: 7, maxInclusivePoints: 7.9 }),
      expect.objectContaining({ id: 'low', minPoints: 0, maxInclusivePoints: 6.9 }),
    ]);
  });

  it('keeps level records strictly descending when the criterion maximum is lowered', () => {
    expect(sortRubricLevels([
      { id: 'high', label: '高档', maxPoints: 10, guideline: '高档准则' },
      { id: 'low', label: '低档', maxPoints: 9, guideline: '低档准则' },
    ], 8)).toEqual([
      expect.objectContaining({ id: 'high', maxPoints: 8 }),
      expect.objectContaining({ id: 'low', maxPoints: 7.9 }),
    ]);
  });

  it('clamps detailed AI scores but validates teacher scores only against item bounds', () => {
    const levels = [
      { id: 'high', label: '优秀', maxPoints: 10, guideline: 'high' },
      { id: 'mid', label: '良好', maxPoints: 8, guideline: 'mid' },
      { id: 'low', label: '及格', maxPoints: 6, guideline: 'low' },
    ];
    expect(clampSuggestedScoreToLevel({ score: 9, levelId: 'mid', levels, criterionMaxPoints: 10 })).toBe(7.9);
    expect(clampSuggestedScoreToLevel({ score: 5, levelId: 'mid', levels, criterionMaxPoints: 10 })).toBe(6);
    expect(teacherScoreIsValid(9.5, 10)).toBe(true);
    expect(teacherScoreIsValid(9.55, 10)).toBe(false);
  });

  it('preserves edited records and requires confirmation before trailing deletion', () => {
    const levels = [
      { id: '1', label: '教师优秀', maxPoints: 10, guideline: '教师准则' },
      { id: '2', label: '教师良好', maxPoints: 8, guideline: '教师准则' },
      { id: '3', label: '教师及格', maxPoints: 6, guideline: '教师准则' },
    ];
    expect(applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels,
      targetCount: 2,
      editedLevelIds: new Set(levels.map((level) => level.id)),
    })).toEqual({ status: 'confirmation-required', trailingLevels: [levels[2]] });
    const applied = applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels,
      targetCount: 2,
      editedLevelIds: new Set(['1', '2']),
      confirmTrailingDeletion: true,
    });
    expect(applied).toEqual({ status: 'applied', levels: levels.slice(0, 2) });
  });

  it('applies the unedited two-level shortcut at the 60% pass boundary', () => {
    const result = applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 7,
      levels: [createInitialDetailedLevel('quality', 7)],
      targetCount: 2,
      editedLevelIds: new Set(),
    });
    expect(result).toEqual({
      status: 'applied',
      levels: [
        expect.objectContaining({ label: '通过', maxPoints: 7 }),
        expect.objectContaining({ label: '不通过', maxPoints: 4.2 }),
      ],
    });
  });

  it('uses the two-level 60% fallback when only one edited level exists', () => {
    const result = applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [{
        id: 'teacher-high',
        label: '教师高档',
        maxPoints: 10,
        guideline: '教师自定义准则。',
      }],
      targetCount: 2,
      editedLevelIds: new Set(['teacher-high']),
    });
    expect(result).toEqual({
      status: 'applied',
      levels: [
        expect.objectContaining({
          id: 'teacher-high',
          label: '教师高档',
          maxPoints: 10,
          guideline: '教师自定义准则。',
        }),
        expect.objectContaining({ label: '不通过', maxPoints: 6 }),
      ],
    });
  });

  it('distinguishes persisted system defaults from teacher-edited level records', () => {
    const defaultLevel = createInitialDetailedLevel('quality', 10);
    const editedLevelIds = inferEditedRubricLevelIds({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [defaultLevel],
    });
    expect(editedLevelIds).toEqual(new Set());
    expect(applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [defaultLevel],
      targetCount: 5,
      editedLevelIds,
    })).toEqual({
      status: 'applied',
      levels: [
        expect.objectContaining({ label: '优秀', maxPoints: 10 }),
        expect.objectContaining({ label: '良好', maxPoints: 9 }),
        expect.objectContaining({ label: '中等', maxPoints: 8 }),
        expect.objectContaining({ label: '及格', maxPoints: 7 }),
        expect.objectContaining({ label: '不及格', maxPoints: 6 }),
      ],
    });
    expect(inferEditedRubricLevelIds({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [{ ...defaultLevel, label: '教师自定义优秀' }],
    })).toEqual(new Set([defaultLevel.id]));
  });

  it('extends edited shortcut content by the last-two ratio', () => {
    const result = applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [
        { id: 'teacher-high', label: '教师高档', maxPoints: 10, guideline: '高档准则。' },
        { id: 'teacher-mid', label: '教师中档', maxPoints: 7, guideline: '中档准则。' },
      ],
      targetCount: 5,
      editedLevelIds: new Set(['teacher-high', 'teacher-mid']),
    });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.levels.slice(0, 2)).toEqual([
        expect.objectContaining({ id: 'teacher-high', label: '教师高档', maxPoints: 10 }),
        expect.objectContaining({ id: 'teacher-mid', label: '教师中档', maxPoints: 7 }),
      ]);
      expect(result.levels[2]).toEqual(expect.objectContaining({ label: '自定义', maxPoints: 4.9 }));
    }
  });

  it('uses an unoccupied stable id when a shortcut fills a deleted middle level', () => {
    const result = applyRubricLevelShortcut({
      criterionId: 'quality',
      criterionMaxPoints: 10,
      levels: [
        { id: 'quality-level-1', label: '优秀', maxPoints: 10, guideline: '优秀准则。' },
        { id: 'quality-level-3', label: '中等', maxPoints: 8, guideline: '中等准则。' },
        { id: 'quality-level-4', label: '及格', maxPoints: 7, guideline: '及格准则。' },
        { id: 'quality-level-5', label: '不及格', maxPoints: 6, guideline: '不及格准则。' },
      ],
      targetCount: 5,
      editedLevelIds: new Set([
        'quality-level-1',
        'quality-level-3',
        'quality-level-4',
        'quality-level-5',
      ]),
    });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.levels.map((level) => level.id)).toEqual([
        'quality-level-1',
        'quality-level-3',
        'quality-level-4',
        'quality-level-5',
        'quality-level-2',
      ]);
    }
  });
});
