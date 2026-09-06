import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ALLOCATION_CANDIDATES_PER_SECTION,
  buildEvidenceRequiredUnitSourcePlan,
  evidenceAllocationRetrievalBudget,
  evidenceUnitCitationMappings,
  repairUncoveredEvidenceUnits,
  type KonlingEvidenceAllocationCandidate,
} from '@/lib/konling-evidence-allocation';
import {
  buildKonlingFairExperimentCitationAssembly,
} from '@/lib/konling-fair-experiment/evidence-pool';
import {
  buildKonlingFairExperimentPromptContext,
  buildKonlingFairExperimentSystemPrompt,
} from '@/lib/konling-fair-experiment/prompts';
import { KONLING_FAIR_EXPERIMENT_BANK_V2 } from '@/lib/konling-fair-experiment';
import type { KonlingFairExperimentBankItem } from '@/lib/konling-fair-experiment';
import type { KonlingFairExperimentCitationSnapshot } from '@/lib/konling-fair-experiment';

function candidate(input: Partial<KonlingEvidenceAllocationCandidate> & Pick<KonlingEvidenceAllocationCandidate, 'id'>): KonlingEvidenceAllocationCandidate {
  return {
    displayTitle: input.id,
    citationTargetId: `target:${input.id}`,
    verified: true,
    href: `https://act.example/${input.id}`,
    answerRelevanceBasis: 'query-lexical',
    identity: { kind: 'content', sourceType: 'content', contentId: input.id, sourceRevision: 'rev-a' },
    matchText: input.displayTitle ?? input.id,
    ...input,
  };
}

const codeItem = KONLING_FAIR_EXPERIMENT_BANK_V2.items.find((item) => item.itemId === 'code-antiwindup')!;

function snapshotOf(citations: readonly { id: string; verified: boolean; href: string | null; answerRelevanceBasis?: string | null; displayNumber: number | null; citationTargetId: string | null }[]): KonlingFairExperimentCitationSnapshot[] {
  return citations.map((citation) => ({
    id: citation.id,
    citationTargetId: citation.citationTargetId,
    verified: citation.verified,
    displayNumber: citation.displayNumber,
    sourceType: 'content',
    href: citation.href,
    answerRelevanceBasis: citation.answerRelevanceBasis ?? null,
  }));
}

describe('evidence-required per-unit source allocation (#2039)', () => {
  it('allocates a distinct primary source to every required section with display numbers and alternates', () => {
    const sections = ['fix', 'verify'] as const;
    void sections;
    const plan = buildEvidenceRequiredUnitSourcePlan({
      intent: codeItem.intent,
      candidates: [
        candidate({ id: 'src-locate', matchText: '故障定位 现象' }),
        candidate({ id: 'src-fix', matchText: '最小修复 修复建议 抗饱和' }),
        candidate({ id: 'src-verify', matchText: '验证方法 如何验证 仿真' }),
        candidate({ id: 'src-fix-alt', matchText: '最小修复 改法 备选' }),
      ],
      queryText: codeItem.question,
    });
    expect(plan.unassignedSectionIds).toEqual([]);
    const fix = plan.assignments.find((assignment) => assignment.sectionId === 'fix')!;
    expect(fix.primaryDisplayNumber).not.toBeNull();
    expect(fix.alternateDisplayNumbers.length).toBeGreaterThan(0);
    const numbers = plan.assignedCitations.map((citation) => citation.displayNumber);
    expect(numbers).toEqual([...new Set(numbers)]);
    expect(numbers[0]).toBe(1);
  });

  it('lets one source back multiple required sections only when the pool is thin, with per-unit judgment preserved', () => {
    const single = candidate({ id: 'src-fix', matchText: '最小修复 验证方法' });
    const plan = buildEvidenceRequiredUnitSourcePlan({
      intent: codeItem.intent,
      candidates: [single],
      queryText: codeItem.question,
    });
    const fix = plan.assignments.find((assignment) => assignment.sectionId === 'fix')!;
    expect(fix.primaryDisplayNumber).toBe(1);
    expect(plan.assignedCitations).toHaveLength(1);
  });

  it('returns empty assignments and unassigned sections when retrieval is empty or non-direct-support only', () => {
    const empty = buildEvidenceRequiredUnitSourcePlan({ intent: codeItem.intent, candidates: [] });
    expect(empty.assignments.every((assignment) => assignment.primaryDisplayNumber === null)).toBe(true);
    expect(empty.unassignedSectionIds).toEqual(['fix']);

    const semanticOnly = buildEvidenceRequiredUnitSourcePlan({
      intent: codeItem.intent,
      candidates: [candidate({ id: 'src-semantic', answerRelevanceBasis: 'semantic-score' })],
    });
    expect(semanticOnly.assignments.every((assignment) => assignment.primaryDisplayNumber === null)).toBe(true);
    expect(semanticOnly.unassignedSectionIds).toEqual(['fix']);
    expect(evidenceAllocationRetrievalBudget(1)).toBe(ALLOCATION_CANDIDATES_PER_SECTION);
  });

  it('scales the retrieval budget with required-section count without touching global profile defaults', () => {
    const normative = KONLING_FAIR_EXPERIMENT_BANK_V2.items.find((item) => item.intent === 'normative-content')!;
    const plan = buildEvidenceRequiredUnitSourcePlan({ intent: normative.intent, candidates: [] });
    // normative-content 有三个 evidence-required 章节，预算 = 3 × 3。
    expect(plan.retrievalBudget).toBe(9);
    expect(plan.unassignedSectionIds).toHaveLength(3);
  });

  it('treats different source revisions as distinct citations (no silent revision drift)', () => {
    const base = candidate({ id: 'src-fix', matchText: '最小修复' });
    const drifted = candidate({
      id: 'src-fix-r2',
      matchText: '最小修复',
      identity: { kind: 'content', sourceType: 'content', contentId: 'src-fix', sourceRevision: 'rev-b' },
    });
    const plan = buildEvidenceRequiredUnitSourcePlan({
      intent: codeItem.intent,
      candidates: [base, drifted],
    });
    expect(plan.assignedCitations).toHaveLength(2);
    const keys = plan.assignedCitations.map((citation) => citation.canonicalKey);
    expect(new Set(keys).size).toBe(2);
    expect(plan.assignedCitations.every((citation) => citation.identity.sourceRevision)).toBe(true);
  });

  it('performs one bounded repair pass appending allocated numbers to unbound required units', () => {
    const plan = buildEvidenceRequiredUnitSourcePlan({
      intent: codeItem.intent,
      candidates: [candidate({ id: 'src-fix', matchText: '最小修复 修复建议' })],
    });
    const citations = snapshotOf(plan.assignedCitations.map((citation) => {
      const source = citation.id === 'src-fix' ? candidate({ id: citation.id, matchText: '最小修复' }) : null;
      return {
        id: citation.id,
        verified: true,
        href: source?.href ?? null,
        answerRelevanceBasis: 'query-lexical',
        displayNumber: citation.displayNumber,
        citationTargetId: `target:${citation.id}`,
      };
    }));
    const answer = [
      '## 故障定位',
      '按现象观察输出饱和。',
      '## 原因',
      '积分累积导致。',
      '## 最小修复',
      '加入抗积分饱和 clamp。',
      '## 验证方法',
      '仿真验证超调下降。',
    ].join('\n');
    const repair = repairUncoveredEvidenceUnits({ answer, intent: codeItem.intent, citations, plan });
    expect(repair.repairedUnitCount).toBe(1);
    expect(repair.body).toContain('加入抗积分饱和 clamp。 [1]');
    expect(repair.body).not.toContain('按现象观察输出饱和。 [');
  });

  it('keeps fail-closed semantics when no source can be allocated (repair does not fabricate markers)', () => {
    const plan = buildEvidenceRequiredUnitSourcePlan({ intent: codeItem.intent, candidates: [] });
    const citations = snapshotOf([]);
    const answer = '## 最小修复\n加入抗积分饱和 clamp。';
    const repair = repairUncoveredEvidenceUnits({ answer, intent: codeItem.intent, citations, plan });
    expect(repair.repairedUnitCount).toBe(0);
    expect(repair.body).toBe(answer);
  });
});

describe('fair experiment evidence assembly parity (#2039)', () => {
  it('assembles multi-source citations from reference fragments through the production allocation module', () => {
    const assembly = buildKonlingFairExperimentCitationAssembly({
      item: codeItem,
      bankVersion: 'fair-experiment-v2',
      sourceRevision: 'rev-test',
    });
    expect(assembly.citations.length).toBeGreaterThan(1);
    expect(assembly.citations.every((citation) => citation.displayNumber !== null)).toBe(true);
    expect(assembly.citations.every((citation) => citation.citationTargetId !== null)).toBe(true);
    const fix = assembly.plan.assignments.find((assignment) => assignment.sectionId === 'fix');
    expect(fix?.primaryDisplayNumber).not.toBeNull();
    const primary = assembly.citations.find((citation) => citation.displayNumber === fix?.primaryDisplayNumber);
    expect(primary?.verified).toBe(true);
    expect(['query-exact', 'query-lexical']).toContain(primary?.answerRelevanceBasis);
  });

  it('renders per-unit mapping lines for full-feature and keeps baselines citation-free', () => {
    const context = buildKonlingFairExperimentPromptContext();
    const full = buildKonlingFairExperimentSystemPrompt({
      arm: 'full-feature',
      item: codeItem,
      context,
      evidence: { bankVersion: 'fair-experiment-v2', sourceRevision: 'rev-test' },
    });
    expect(full.systemPrompt).toContain('逐单元引用映射（章节 → 分配编号');
    expect(full.systemPrompt).toContain('「最小修复」→ 使用编号');
    expect(full.systemPrompt).toContain('引用协议');
    expect(full.citationAssembly?.citations.length).toBeGreaterThan(1);

    const plain = buildKonlingFairExperimentSystemPrompt({ arm: 'plain-baseline', item: codeItem, context });
    const enhanced = buildKonlingFairExperimentSystemPrompt({ arm: 'enhanced-baseline', item: codeItem, context });
    for (const prompt of [plain.systemPrompt, enhanced.systemPrompt]) {
      expect(prompt).not.toContain('引用协议');
      expect(prompt).not.toContain('逐单元引用映射');
      expect(prompt).not.toContain('[1]');
    }
    expect(plain.citationAssembly).toBeUndefined();
    expect(enhanced.citationAssembly).toBeUndefined();
  });

  it('keeps normative verification-required guidance regardless of verified allocated sources', () => {
    const normative = KONLING_FAIR_EXPERIMENT_BANK_V2.items.find((item) => item.intent === 'normative-content')!;
    const full = buildKonlingFairExperimentSystemPrompt({
      arm: 'full-feature',
      item: normative,
      context: buildKonlingFairExperimentPromptContext(),
      evidence: { bankVersion: 'fair-experiment-v2', sourceRevision: 'rev-test' },
    });
    expect(full.systemPrompt).toContain('需核验');
    expect(full.systemPrompt).toContain('验证权威来源');
  });

  it('exports unit mappings for prompt rendering and skips unassigned sections', () => {
    const assembly = buildKonlingFairExperimentCitationAssembly({
      item: codeItem,
      bankVersion: 'fair-experiment-v2',
      sourceRevision: 'rev-test',
    });
    const mappings = evidenceUnitCitationMappings(assembly.plan);
    expect(mappings.length).toBe(assembly.plan.assignments.length - assembly.plan.unassignedSectionIds.length);
    for (const mapping of mappings) {
      expect(mapping.displayNumbers[0]).toBeGreaterThan(0);
    }
  });
});
