import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const source = readFileSync(
  join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'),
  'utf8',
);

describe('adaptive path candidate comparison UI contract', () => {
  it('restores only complete comparison identities from the URL', () => {
    expect(source).toContain("const requestedCompareLeft = searchParams.get('compareLeft');");
    expect(source).toContain("const requestedCompareRight = searchParams.get('compareRight');");
    expect(source).toContain("const requestedCompareVersion = searchParams.get('compareVersion');");
    expect(source).toContain('requestedCompareVersion === candidateBatchComparisonVersion');
    expect(source).toContain("nextUrl.searchParams.delete('compareLeft');");
    expect(source).toContain("nextUrl.searchParams.delete('compareRight');");
    expect(source).toContain("nextUrl.searchParams.delete('compareVersion');");
  });

  it('drops late comparison responses when the batch, version, or pair changes', () => {
    expect(source).toContain('buildAdaptivePathComparisonKey({');
    expect(source).toContain('pathVersion: savedPathVersionRef.current');
    expect(source).toContain('const savedPathVersion = activePathRound?.updatedAt');
    expect(source).toContain('activeComparisonRequestKeyRef.current !== explanationRequestVersionKey');
    expect(source).toContain("setPathGenerationPending((current) => current === 'explain' ? null : current);");
    expect(source).toContain('differenceExplanation.comparisonKey !== explanationRequestVersionKey');
    expect(source).toContain('setPathDifferenceExplanations({});');
  });

  it('requires an explicit pair and keeps every three-candidate pair selectable', () => {
    expect(source).toContain('enumerateAdaptivePathComparisonPairs(comparisonOptionIds)');
    expect(source).toContain('disabled={!draftPair || pending}');
    expect(source).toContain('draft.leftOptionId === draft.rightOptionId');
    expect(source).toContain('data-learning-path-confirm-comparison');
    expect(source).not.toContain("pathOptions.find((item) => item.optionId !== option.writeOption?.optionId)");
  });

  it('uses named native controls and a narrow-screen-safe layout', () => {
    expect(source).toContain('htmlFor="learning-path-comparison-left"');
    expect(source).toContain('htmlFor="learning-path-comparison-right"');
    expect(source).toContain('id="learning-path-comparison-left"');
    expect(source).toContain('id="learning-path-comparison-right"');
    expect(source).toContain('className="grid min-w-0 gap-3 sm:grid-cols-2"');
    expect(source).toContain('className="inline-flex w-full items-center justify-center');
  });

  it('shows every fixed factual dimension and preserves missing-data semantics', () => {
    expect(source).toContain('路径节点数：');
    expect(source).toContain('锁定节点：');
    expect(source).toContain('终点验证：');
    expect(source).toContain('summaryFactAvailability');
    expect(source).toContain("Array.isArray(option.checkpointNodeIds)");
    expect(source).toContain("Array.isArray(option.terminalValidationNodeIds)");
    expect(source).toContain("'数据不足'");
    expect(source).toContain('候选在当前维度无差异');
    expect(source).toContain("noDifferenceLabel('terminalValidation')");
  });
});
