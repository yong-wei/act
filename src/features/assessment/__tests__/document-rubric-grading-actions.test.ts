import { describe, expect, it } from 'vitest';

import {
  selectDocumentGradingLevel,
  selectModifiedDocumentGradingEdits,
} from '../document-rubric-grading-actions';

describe('document rubric grading approval edits', () => {
  it('does not submit untouched legacy criteria as teacher edits', () => {
    const criteria = [{
      criterionId: 'criterion-1',
      label: '建模过程',
      selectedLevelId: 'level-2',
      editableScore: 8,
    }];

    expect(selectModifiedDocumentGradingEdits(criteria, [{
      criterionId: 'criterion-1',
      levelId: 'level-2',
      score: 8,
      comment: '',
    }])).toEqual([]);
  });

  it('submits only criteria whose final teacher value changed', () => {
    const criteria = [
      { criterionId: 'criterion-1', label: '建模过程', selectedLevelId: 'level-2', editableScore: 8, teacherComment: null },
      { criterionId: 'criterion-2', label: '结果分析', selectedLevelId: 'level-1', editableScore: 5, teacherComment: '原评语' },
    ];
    const changed = { criterionId: 'criterion-2', levelId: 'level-1', score: 6, comment: '原评语' };

    expect(selectModifiedDocumentGradingEdits(criteria, [
      { criterionId: 'criterion-1', levelId: 'level-2', score: 8, comment: '' },
      changed,
    ])).toEqual([changed]);
  });

  it('clamps the score into the newly selected level range', () => {
    const edit = { criterionId: 'criterion-1', levelId: 'level-1', score: 3, comment: '' };
    const levels = [
      { id: 'level-1', label: '基础', minPoints: 0, maxPoints: 4 },
      { id: 'level-2', label: '熟练', minPoints: 6, maxPoints: 8 },
    ];

    expect(selectDocumentGradingLevel(edit, levels, 'level-2')).toEqual({
      ...edit,
      levelId: 'level-2',
      score: 6,
    });
    expect(selectDocumentGradingLevel({ ...edit, score: 7 }, levels, 'level-2').score).toBe(7);
  });
});
