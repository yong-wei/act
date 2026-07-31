/**
 * Pre-activation shadow validation for Canonical LearningFact writes (#1116).
 */

import {
  assertShadowCannotActivateLearningFactCutover,
  assertShadowWriteResultHasZeroSink,
  selectLearningFactAuthority,
} from './authority';
import type { VerifiedLearningFactAdmission } from './capability';
import type {
  CanonicalLearningFactIdentity,
  LearningFactWriteResult,
  LearningFactWriteRow,
} from './contracts';
import {
  shadowValidateCanonicalLearningFacts,
  writeKnowledgeScopedLearningFacts,
} from './writer';

export interface CanonicalLearningFactShadowValidationInput {
  rows: readonly LearningFactWriteRow[];
  identity: CanonicalLearningFactIdentity | null | undefined;
  admission: VerifiedLearningFactAdmission | null | undefined;
  cutoverReceiptId?: string | null;
}

export interface CanonicalLearningFactShadowValidationReport {
  schemaVersion: 'canonical-learning-fact-shadow/v1';
  ready: boolean;
  result: LearningFactWriteResult;
  sinkInvoked: false;
  written: 0;
  productionAuthority: 'LEGACY';
  rejectionCodes: LearningFactWriteResult['rejectionCodes'];
}

function toReport(result: LearningFactWriteResult): CanonicalLearningFactShadowValidationReport {
  assertShadowWriteResultHasZeroSink(result);
  return {
    schemaVersion: 'canonical-learning-fact-shadow/v1',
    ready: result.rejectionCodes.length === 0,
    result,
    sinkInvoked: false,
    written: 0,
    productionAuthority: 'LEGACY',
    rejectionCodes: result.rejectionCodes,
  };
}

export function runCanonicalLearningFactShadowValidation(
  input: CanonicalLearningFactShadowValidationInput,
): CanonicalLearningFactShadowValidationReport {
  const result = shadowValidateCanonicalLearningFacts({
    rows: input.rows,
    identity: input.identity,
    admission: input.admission,
  });
  assertShadowCannotActivateLearningFactCutover({
    shadowSucceeded: result.rejectionCodes.length === 0,
    cutoverReceiptId: input.cutoverReceiptId,
    admissionReady: result.rejectionCodes.length === 0,
    identityComplete: result.rejectionCodes.length === 0,
  });
  return toReport(result);
}

export async function runCanonicalLearningFactShadowValidationAsync(
  input: CanonicalLearningFactShadowValidationInput,
): Promise<CanonicalLearningFactShadowValidationReport> {
  const selector = selectLearningFactAuthority('SHADOW_VALIDATION', {
    cutoverReceiptId: input.cutoverReceiptId,
  });
  let sinkCalls = 0;
  const trapSink = {
    learningFact: {
      createMany: async () => {
        sinkCalls += 1;
        throw new Error(
          'LearningFact shadow validation must not invoke LearningFact sink',
        );
      },
    },
  };

  const result = await writeKnowledgeScopedLearningFacts(
    trapSink,
    {
      rows: input.rows,
      knowledgeScoped: true,
      canonicalIdentity: input.identity,
      admission: input.admission,
    },
    { selector },
  );

  if (sinkCalls !== 0 || result.sinkInvoked || result.written !== 0) {
    throw new Error(
      `LearningFact shadow validation invoked sink (calls=${sinkCalls}, written=${result.written})`,
    );
  }

  assertShadowCannotActivateLearningFactCutover({
    shadowSucceeded: result.rejectionCodes.length === 0,
    cutoverReceiptId: input.cutoverReceiptId,
    admissionReady: result.rejectionCodes.length === 0,
    identityComplete: result.rejectionCodes.length === 0,
  });
  return toReport(result);
}
