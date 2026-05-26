import { describe, expect, it } from 'vitest';

import { scoreManifestObjectiveCard } from '../manifest-objective-scoring';

describe('scoreManifestObjectiveCard', () => {
  it('scores single choice and binary choice by normalized option value', () => {
    expect(scoreManifestObjectiveCard({
      id: 'q1',
      responseKind: 'single_choice',
      options: [
        { value: 'A', label: '保留模型阶次' },
        { value: 'B', label: '忽略模型阶次' },
      ],
      referenceAnswer: '选 A。',
    }, 'a')).toMatchObject({
      scoringVersion: 'manifest-objective-scoring/v1',
      answered: true,
      score: 1,
      isCorrect: true,
      normalizedSubmitted: 'A',
      normalizedReference: 'A',
    });

    expect(scoreManifestObjectiveCard({
      id: 'q2',
      responseKind: 'binary_choice',
      options: [
        { value: 'true', label: '正确' },
        { value: 'false', label: '错误' },
      ],
      referenceAnswer: 'false',
    }, '正确')).toMatchObject({
      score: 0,
      isCorrect: false,
      normalizedSubmitted: 'true',
      normalizedReference: 'false',
    });
  });

  it('scores multi-select answers with hit, missed, and extra detail', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q3',
      responseKind: 'multi_select',
      options: [
        { value: 'A', label: '航迹偏离' },
        { value: 'B', label: '舵角边界' },
        { value: 'C', label: '文件名' },
      ],
      referenceAnswer: '选 A、B。',
    }, 'a|c');

    expect(result).toMatchObject({
      answered: true,
      score: 1 / 3,
      isCorrect: false,
      normalizedSubmitted: ['A', 'C'],
      normalizedReference: ['A', 'B'],
      detail: {
        correctHits: ['A'],
        missedCorrectOptions: ['B'],
        extraWrongOptions: ['C'],
      },
    });
  });

  it('scores ordering answers with partial absolute-position credit', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q4',
      responseKind: 'drag_sort',
      options: [
        { value: 'model', label: '建模' },
        { value: 'validate', label: '验证' },
        { value: 'deploy', label: '发布' },
      ],
    }, 'model|deploy|validate');

    expect(result).toMatchObject({
      score: 1 / 3,
      isCorrect: false,
      normalizedSubmitted: ['model', 'deploy', 'validate'],
      normalizedReference: ['model', 'validate', 'deploy'],
      detail: {
        correctPositions: ['model'],
        misplacedItems: ['deploy', 'validate'],
      },
    });
  });

  it('scores matching answers by pair structure independent of submitted pair order', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q5',
      responseKind: 'drag_match',
      options: [],
      matchItems: [
        { value: '1', label: '感知' },
        { value: '2', label: '规划' },
        { value: '5', label: '监督' },
      ],
      matchOptions: [
        { value: '3', label: '状态估计' },
        { value: '4', label: '路径生成' },
        { value: '1', label: '安全接管' },
      ],
      referenceMatches: [
        { item: '1', option: '3' },
        { item: '2', option: '4' },
        { item: '5', option: '1' },
      ],
    }, '5-1,1-3,2-4');

    expect(result).toMatchObject({
      score: 1,
      isCorrect: true,
      normalizedSubmitted: { '1': '3', '2': '4', '5': '1' },
      normalizedReference: { '1': '3', '2': '4', '5': '1' },
      detail: {
        correctPairs: [
          { item: '1', option: '3' },
          { item: '2', option: '4' },
          { item: '5', option: '1' },
        ],
        incorrectPairs: [],
        missedItems: [],
      },
    });
  });

  it('keeps missing references explicit instead of emitting a zero score', () => {
    expect(scoreManifestObjectiveCard({
      id: 'q6',
      responseKind: 'single_choice',
      options: [
        { value: 'A', label: '选项 A' },
        { value: 'B', label: '选项 B' },
      ],
    }, 'A')).toMatchObject({
      answered: true,
      score: null,
      isCorrect: undefined,
      unsupportedReason: 'missing_reference',
    });
  });
});
