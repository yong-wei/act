import { retrieveSourcePack, type RetrieveSourcePackInput } from './hybrid-retriever';

export interface SourcePackEvaluationCase {
  id: string;
  input: RetrieveSourcePackInput;
  minItems?: number;
  requiredLimitationCodes?: readonly string[];
  requiredCitationReady?: boolean;
  requiredDiversity?: boolean;
}

export interface SourcePackEvaluationResult {
  id: string;
  passed: boolean;
  itemCount: number;
  limitationCodes: string[];
  failures: string[];
}

export const sourcePackEvaluationFixtures = [
  'root locus',
  'phase margin',
  'PID integral action',
  'simple feedback system',
  'controlled object',
] as const;

export function evaluateSourcePackRetrieval(testCase: SourcePackEvaluationCase): SourcePackEvaluationResult {
  const result = retrieveSourcePack(testCase.input);
  const limitationCodes = result.pack.limitations.map((limitation) => limitation.code);
  const failures: string[] = [];
  if (result.pack.items.length < (testCase.minItems ?? 1)) {
    failures.push(`expected at least ${testCase.minItems ?? 1} item(s)`);
  }
  for (const code of testCase.requiredLimitationCodes ?? []) {
    if (!limitationCodes.includes(code)) failures.push(`missing limitation ${code}`);
  }
  if (testCase.requiredCitationReady && result.pack.items.some((item) => !item.citationTargetId && !item.citation?.citationTargetId)) {
    failures.push('expected every selected item to be citation-ready');
  }
  if (testCase.requiredDiversity) {
    const sourceKinds = new Set(result.pack.items.map((item) => item.sourceKind));
    const modalities = new Set(result.pack.items.map((item) => item.modality));
    if (result.pack.items.length > 1 && sourceKinds.size < 2 && modalities.size < 2) {
      failures.push('expected source or modality diversity');
    }
  }
  return {
    id: testCase.id,
    passed: failures.length === 0,
    itemCount: result.pack.items.length,
    limitationCodes,
    failures,
  };
}
