import { describe, expect, it } from 'vitest';

import { isManifestObjectiveResponseKind, scoreManifestObjectiveCard } from '../manifest-objective-scoring';

describe('scoreManifestObjectiveCard', () => {
  it('scores canonical objective response kinds through the shared implementation', () => {
    expect(isManifestObjectiveResponseKind('choice.multi')).toBe(true);
    expect(isManifestObjectiveResponseKind('ordering.sequence')).toBe(true);
    expect(isManifestObjectiveResponseKind('matching.pairs')).toBe(true);

    expect(scoreManifestObjectiveCard({
      id: 'canonical-multi',
      responseKind: 'choice.multi',
      options: [
        { value: 'A', label: '航迹偏离' },
        { value: 'B', label: '舵角边界' },
        { value: 'C', label: '文件名' },
      ],
      referenceAnswer: '选 A、B。',
    }, 'A|C')).toMatchObject({
      kind: 'choice.multi',
      score: 1 / 3,
      detail: {
        correctHits: ['A'],
        missedCorrectOptions: ['B'],
        extraWrongOptions: ['C'],
      },
    });

    expect(scoreManifestObjectiveCard({
      id: 'canonical-ordering',
      responseKind: 'ordering.sequence',
      options: [
        { value: 'model', label: '建模' },
        { value: 'validate', label: '验证' },
        { value: 'deploy', label: '发布' },
      ],
    }, 'model|deploy|validate')).toMatchObject({
      kind: 'ordering.sequence',
      score: 1 / 3,
      detail: {
        correctPositions: ['model'],
        misplacedItems: ['deploy', 'validate'],
      },
    });

    expect(scoreManifestObjectiveCard({
      id: 'canonical-matching',
      responseKind: 'matching.pairs',
      options: [],
      matchItems: [
        { value: '1', label: '感知' },
        { value: '2', label: '规划' },
      ],
      matchOptions: [
        { value: '3', label: '状态估计' },
        { value: '4', label: '路径生成' },
      ],
      referenceMatches: [
        { item: '1', option: '3' },
        { item: '2', option: '4' },
      ],
    }, '2-4,1-3')).toMatchObject({
      kind: 'matching.pairs',
      score: 1,
      normalizedSubmitted: { '1': '3', '2': '4' },
    });
  });

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

  it('penalizes extra tokens in single choice instead of taking only the first answer', () => {
    expect(scoreManifestObjectiveCard({
      id: 'q1-extra',
      responseKind: 'single_choice',
      options: [
        { value: 'A', label: '保留模型阶次' },
        { value: 'B', label: '忽略模型阶次' },
      ],
      referenceAnswer: 'A',
    }, 'A|B')).toMatchObject({
      answered: true,
      score: 0,
      isCorrect: false,
      normalizedSubmitted: ['A', 'B'],
      normalizedReference: 'A',
      detail: {
        extraSubmittedOptions: ['B'],
      },
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

  it('preserves unmapped reference tokens instead of shortening multi-select answers', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q3-unmapped-reference',
      responseKind: 'multi_select',
      options: [
        { value: 'A', label: '航迹偏离' },
      ],
      referenceAnswer: '选 A、B。',
    }, 'A');

    expect(result).toMatchObject({
      score: 1 / 2,
      isCorrect: false,
      normalizedSubmitted: ['A'],
      normalizedReference: ['A', 'B'],
      detail: {
        correctHits: ['A'],
        missedCorrectOptions: ['B'],
        extraWrongOptions: [],
      },
    });
  });

  it('penalizes duplicated correct options in multi-select answers', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q3-duplicate',
      responseKind: 'multi_select',
      options: [
        { value: 'A', label: '航迹偏离' },
        { value: 'B', label: '舵角边界' },
      ],
      referenceAnswer: '选 A、B。',
    }, 'A|A|B');

    expect(result).toMatchObject({
      score: 2 / 3,
      isCorrect: false,
      normalizedSubmitted: ['A', 'A', 'B'],
      normalizedReference: ['A', 'B'],
      detail: {
        correctHits: ['A', 'B'],
        duplicateSubmittedOptions: ['A'],
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

  it('penalizes extra ordering tokens instead of deduplicating to full credit', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q4-extra',
      responseKind: 'drag_sort',
      options: [
        { value: 'A', label: '建模' },
        { value: 'B', label: '验证' },
        { value: 'C', label: '发布' },
      ],
    }, 'A|B|B|C');

    expect(result).toMatchObject({
      score: 0.5,
      isCorrect: false,
      normalizedSubmitted: ['A', 'B', 'B', 'C'],
      normalizedReference: ['A', 'B', 'C'],
      detail: {
        correctPositions: ['A', 'B'],
        misplacedItems: ['B'],
        extraItems: ['C'],
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

  it('penalizes extra pair-syntax entries in matching answers', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q5-extra-pair',
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
        { value: '9', label: '无关项' },
      ],
      referenceMatches: [
        { item: '1', option: '3' },
        { item: '2', option: '4' },
        { item: '5', option: '1' },
      ],
    }, '1-3,2-4,5-1,9-9');

    expect(result).toMatchObject({
      score: 3 / 4,
      isCorrect: false,
      normalizedSubmitted: { '1': '3', '2': '4', '5': '1', '9': '9' },
      normalizedReference: { '1': '3', '2': '4', '5': '1' },
      detail: {
        correctPairs: [
          { item: '1', option: '3' },
          { item: '2', option: '4' },
          { item: '5', option: '1' },
        ],
        extraItems: [
          { item: '9', option: '9' },
        ],
      },
    });
  });

  it('scores duplicate pair-syntax items independent of submitted pair order', () => {
    const card = {
      id: 'q5-duplicate-pair',
      responseKind: 'drag_match',
      options: [],
      matchItems: [
        { value: '1', label: '感知' },
      ],
      matchOptions: [
        { value: '3', label: '状态估计' },
        { value: '9', label: '无关项' },
      ],
      referenceMatches: [
        { item: '1', option: '3' },
      ],
    };
    const wrongThenCorrect = scoreManifestObjectiveCard(card, '1-9,1-3');
    const correctThenWrong = scoreManifestObjectiveCard(card, '1-3,1-9');

    expect(wrongThenCorrect.score).toBe(correctThenWrong.score);
    expect(wrongThenCorrect).toMatchObject({
      score: 0,
      isCorrect: false,
      detail: {
        correctPairs: [],
        duplicateItems: ['1'],
      },
    });
    expect(correctThenWrong).toMatchObject({
      score: 0,
      isCorrect: false,
      detail: {
        correctPairs: [],
        duplicateItems: ['1'],
      },
    });
  });

  it('allows hyphenated match item keys with explicit pair separators', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q5-hyphenated-items',
      responseKind: 'drag_match',
      options: [],
      matchItems: [
        { value: 'target-outline', label: '目标轮廓' },
        { value: 'target-speed', label: '目标速度' },
      ],
      matchOptions: [
        { value: 'planner', label: '规划器' },
        { value: 'controller', label: '控制器' },
      ],
      referenceMatches: [
        { item: 'target-outline', option: 'planner' },
        { item: 'target-speed', option: 'controller' },
      ],
    }, 'target-outline->planner,target-speed->controller');

    expect(result).toMatchObject({
      score: 1,
      isCorrect: true,
      normalizedSubmitted: {
        'target-outline': 'planner',
        'target-speed': 'controller',
      },
      detail: {
        correctPairs: [
          { item: 'target-outline', option: 'planner' },
          { item: 'target-speed', option: 'controller' },
        ],
        extraItems: [],
      },
    });
  });

  it('does not treat hyphenated option values as pair syntax', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q5-hyphenated-options',
      responseKind: 'drag_match',
      options: [],
      matchItems: [
        { value: 'errorPattern', label: '错误类型' },
        { value: 'ruleCoverage', label: '规则覆盖' },
      ],
      matchOptions: [
        { value: 'few-errors-insufficient', label: '错误样本不足' },
        { value: 'rules-hard-cover', label: '规则难以覆盖' },
      ],
      referenceMatches: [
        { item: 'errorPattern', option: 'few-errors-insufficient' },
        { item: 'ruleCoverage', option: 'rules-hard-cover' },
      ],
    }, 'few-errors-insufficient|rules-hard-cover');

    expect(result).toMatchObject({
      score: 1,
      isCorrect: true,
      normalizedSubmitted: {
        errorPattern: 'few-errors-insufficient',
        ruleCoverage: 'rules-hard-cover',
      },
      normalizedReference: {
        errorPattern: 'few-errors-insufficient',
        ruleCoverage: 'rules-hard-cover',
      },
      detail: {
        correctPairs: [
          { item: 'errorPattern', option: 'few-errors-insufficient' },
          { item: 'ruleCoverage', option: 'rules-hard-cover' },
        ],
        extraItems: [],
      },
    });
  });

  it('preserves legacy drag-match scoring when only options define slot order', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q6',
      responseKind: 'drag_match',
      options: [
        { value: 'flattened-output', label: '输出被压平 -> 比例关系近似成立' },
        { value: 'return-residual', label: '路径回程残差 -> 输入输出关系单值连续' },
        { value: 'protection-logic', label: '保护逻辑介入 -> 工作模式不发生突变' },
      ],
      referenceAnswer: '正确顺序为：输出被压平 -> 比例关系；路径回程残差 -> 单值连续；保护逻辑介入 -> 工作模式不突变。',
    }, 'flattened-output|return-residual|protection-logic');

    expect(result).toMatchObject({
      answered: true,
      score: 1,
      isCorrect: true,
      normalizedSubmitted: ['flattened-output', 'return-residual', 'protection-logic'],
      normalizedReference: ['flattened-output', 'return-residual', 'protection-logic'],
      detail: {
        fallback: 'legacy_slot_order',
      },
    });
  });

  it('keeps empty drag-match slots when calculating partial credit', () => {
    const result = scoreManifestObjectiveCard({
      id: 'q7',
      responseKind: 'drag_match',
      options: [
        { value: 'A', label: 'A -> 一阶对象' },
        { value: 'B', label: 'B -> 二阶对象' },
        { value: 'C', label: 'C -> 非线性对象' },
      ],
    }, 'A||C');

    expect(result).toMatchObject({
      answered: true,
      score: 2 / 3,
      isCorrect: false,
      normalizedSubmitted: ['A', '', 'C'],
      normalizedReference: ['A', 'B', 'C'],
      detail: {
        correctPositions: ['A', 'C'],
        missedPositions: [
          { index: 1, expected: 'B', submitted: '' },
        ],
        fallback: 'legacy_slot_order',
      },
    });
  });

  it('keeps missing references explicit instead of emitting a zero score', () => {
    expect(scoreManifestObjectiveCard({
      id: 'q8',
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
