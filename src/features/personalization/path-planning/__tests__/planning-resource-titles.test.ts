import { describe, expect, it } from 'vitest';

import {
  collapseDuplicatePlanningTitle,
  composePlanningNodeTitle,
  entityIdFromInternalTitle,
  isAssertionLikeKnowledgeLabel,
  isInternalPlanningTitle,
  loadPlanningAssertionKnowledgeIds,
  loadPlanningKnowledgeLabels,
  planningAuthorityReleaseStatus,
  resetPlanningKnowledgeLabelsForTest,
  resolvePlanningAuthoringReleaseDir,
  resolvePlanningResourceTitle,
} from '@/features/personalization/path-planning/planning-resource-titles';

describe('planning resource titles', () => {
  it('rewrites internal identifiers with authoritative Chinese labels', () => {
    const labels = new Map([
      ['ctc:modeling-865eb1c8824e157c2f05a903', '传递函数'],
      ['ctc:v11g-5845390ded447e37f06ea222', '根轨迹'],
    ]);
    expect(isInternalPlanningTitle('ctc modeling-865eb1c8824e157c2f05a903')).toBe(true);
    expect(entityIdFromInternalTitle('ctc modeling-865eb1c8824e157c2f05a903'))
      .toBe('ctc:modeling-865eb1c8824e157c2f05a903');
    expect(resolvePlanningResourceTitle('ctc modeling-865eb1c8824e157c2f05a903', { labels }))
      .toBe('传递函数');
    expect(resolvePlanningResourceTitle('根轨迹分析', { labels })).toBe('根轨迹分析');
    expect(resolvePlanningResourceTitle('lesson02-root-locus-lesson02-root-locus 仿真', { labels }))
      .toBe('root locus仿真');
    expect(isInternalPlanningTitle('lesson06-judge-bench-cmkax0s1s0005ence448uv49j 仿真')).toBe(true);
    expect(resolvePlanningResourceTitle('lesson06-judge-bench-cmkax0s1s0005ence448uv49j 仿真', {
      labels,
      canonicalIds: ['ctc:v11g-5845390ded447e37f06ea222'],
    })).toBe('根轨迹仿真');
    expect(resolvePlanningResourceTitle('THE LAPLACE TRANSFORM · THE LAPLACE TRANSFORM', {
      labels,
      canonicalIds: ['ctc:modeling-865eb1c8824e157c2f05a903'],
    })).toBe('传递函数（教材）');
    expect(composePlanningNodeTitle(
      '系统状态空间描述常用的基本概念',
      '系统状态空间描述常用的基本概念',
    )).toBe('系统状态空间描述常用的基本概念');
    expect(composePlanningNodeTitle('反馈与校正——从开环到闭环', '第 9 步')).toBe('反馈与校正——从开环到闭环');
    expect(collapseDuplicatePlanningTitle('Poles and Zeros · Poles and Zeros')).toBe('Poles and Zeros');
    expect(resolvePlanningResourceTitle('在例2－2中已求得电枢控制直流电动机简化后的微分方程为', { labels }))
      .toBe('教材节');
    expect(resolvePlanningResourceTitle('ctc unknown-id', {
      labels,
      canonicalIds: ['ctc:v11g-5845390ded447e37f06ea222'],
    })).toBe('根轨迹');
  });

  it('loads live multilingual labels for spaced card titles', () => {
    resetPlanningKnowledgeLabelsForTest();
    const labels = loadPlanningKnowledgeLabels();
    expect(labels.size).toBeGreaterThan(1000);
    expect(resolvePlanningResourceTitle('ctc modeling-865eb1c8824e157c2f05a903')).toBe('传递函数');
    expect(resolvePlanningResourceTitle('ctc modeling-8aa475ed6514adc11f9b5c8d')).toBe('动态控制系统');
    expect(resolvePlanningResourceTitle('ctc modeling-47e8eb68c1aa5cd068c72e54')).toBe('负反馈回路');
  });

  it('recognizes assertion-like knowledge labels and live statement ids', () => {
    expect(isAssertionLikeKnowledgeLabel('属性断言：The zeros correspond to blocking.')).toBe(true);
    expect(isAssertionLikeKnowledgeLabel('知识命题：The locus of the roots begins at the poles.')).toBe(true);
    expect(isAssertionLikeKnowledgeLabel('The zeros correspond to the signal transmission-blocking properties of a linear system.')).toBe(true);
    expect(isAssertionLikeKnowledgeLabel('根轨迹')).toBe(false);
    expect(isAssertionLikeKnowledgeLabel('灵敏度互补关系')).toBe(false);

    resetPlanningKnowledgeLabelsForTest();
    const assertionIds = loadPlanningAssertionKnowledgeIds();
    expect(assertionIds.size).toBeGreaterThan(100);
    expect([...assertionIds].some((id) => id.includes('knowledgestatement'))).toBe(true);
  });

  it('resolves labels from the live authority release set instead of a hardcoded r6 path', () => {
    resetPlanningKnowledgeLabelsForTest();
    const live = resolvePlanningAuthoringReleaseDir();
    expect(live).toMatch(/control-theory-engineering-v0\.48$/u);
    expect(loadPlanningKnowledgeLabels(process.cwd(), {
      authorityReleaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v9.99-r1',
    }).size).toBe(0);
    expect(resolvePlanningAuthoringReleaseDir(process.cwd(), {
      authorityReleaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v9.99-r1',
    })).toBeNull();
    expect(planningAuthorityReleaseStatus(process.cwd(), {
      authorityReleaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v9.99-r1',
    })).toMatchObject({
      status: 'missing-release',
      setId: 'actkg-authoritative-candidate-control-theory-engineering-v9.99-r1',
    });
  });
});
