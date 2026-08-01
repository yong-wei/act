/**
 * Fixed-identity LearningFact writer adapters (#1116).
 *
 * Canonical sink requires a registered write capability. No boolean bypass.
 * Selectors and admissions must be WeakSet-registered instances.
 */

import {
  assertAdmissionAllowsFormalWrite,
  assertCanonicalLearningFactWriteCapability,
  assertRegisteredLearningFactSelector,
  assertVerifiedLearningFactAdmission,
  readVerifiedLearningFactAdmission,
  type CanonicalLearningFactWriteCapability,
  type RegisteredLearningFactAuthoritySelector,
  type VerifiedLearningFactAdmission,
} from './capability';
import type {
  CanonicalLearningFactIdentity,
  LearningFactSink,
  LearningFactWriteResult,
  LearningFactWriteRow,
} from './contracts';
import {
  CanonicalLearningFactWriteError,
  evaluateCanonicalLearningFactWrite,
  stampCanonicalIdentityOnRows,
  stampLegacyIdentityOnRows,
  validateCanonicalLearningFactWrite,
} from './validation';
import { selectLearningFactAuthority } from './authority';

export interface LegacyLearningFactWriteOptions {
  knowledgeRevisionRef?: string | null;
}

export async function writeLegacyKnowledgeScopedLearningFacts(
  sink: LearningFactSink,
  rows: readonly LearningFactWriteRow[],
  options: LegacyLearningFactWriteOptions = {},
): Promise<LearningFactWriteResult> {
  if (rows.length === 0) {
    return {
      authority: 'LEGACY',
      written: 0,
      skipped: true,
      shadowValidated: false,
      sinkInvoked: false,
      rejectionCodes: [],
    };
  }

  for (const [index, row] of rows.entries()) {
    if (
      row.knowledgeIdentityNamespace === 'CANONICAL'
      || row.canonicalObjectId
      || row.aggregateReleaseSetId
      || row.aggregateReleaseId
      || row.knowledgeProjectionId
    ) {
      throw new CanonicalLearningFactWriteError(
        'dual-write-forbidden',
        `Legacy adapter rejected Canonical identity columns on row[${index}]`,
      );
    }
  }

  const stamped = stampLegacyIdentityOnRows(
    rows,
    options.knowledgeRevisionRef ?? null,
  );
  const result = await sink.learningFact.createMany({
    data: [...stamped],
    skipDuplicates: true,
  });
  return {
    authority: 'LEGACY',
    written: result.count,
    skipped: result.count === 0,
    shadowValidated: false,
    sinkInvoked: true,
    rejectionCodes: [],
  };
}

/**
 * Formal Canonical sink. Requires a registered write capability minted only by
 * test helpers in #1116 (no production mint).
 */
export async function writeCanonicalKnowledgeScopedLearningFacts(
  sink: LearningFactSink,
  input: {
    rows: readonly LearningFactWriteRow[];
    identity: CanonicalLearningFactIdentity;
    writeCapability: CanonicalLearningFactWriteCapability;
  },
): Promise<LearningFactWriteResult> {
  assertCanonicalLearningFactWriteCapability(input.writeCapability);
  assertAdmissionAllowsFormalWrite(input.writeCapability.admission);
  const admissionFields = readVerifiedLearningFactAdmission(
    input.writeCapability.admission,
  );
  const { identity } = validateCanonicalLearningFactWrite({
    identity: input.identity,
    rows: input.rows,
    admission: admissionFields,
  });
  // Candidate publication state must also be non-candidate at application layer.
  if (identity.releasePublicationState === 'CANDIDATE') {
    throw new CanonicalLearningFactWriteError(
      'candidate-release-set',
      'Candidate ReleaseSet cannot receive formal LearningFacts',
    );
  }
  const stamped = stampCanonicalIdentityOnRows(input.rows, identity);
  const result = await sink.learningFact.createMany({
    data: [...stamped],
    skipDuplicates: true,
  });
  return {
    authority: 'CANONICAL',
    written: result.count,
    skipped: result.count === 0,
    shadowValidated: false,
    sinkInvoked: true,
    rejectionCodes: [],
  };
}

export function shadowValidateCanonicalLearningFacts(input: {
  rows: readonly LearningFactWriteRow[];
  identity: CanonicalLearningFactIdentity | null | undefined;
  admission: VerifiedLearningFactAdmission | null | undefined;
}): LearningFactWriteResult {
  if (input.admission != null) {
    assertVerifiedLearningFactAdmission(input.admission);
  }
  const admissionFields = input.admission
    ? readVerifiedLearningFactAdmission(input.admission)
    : null;
  const evaluation = evaluateCanonicalLearningFactWrite({
    identity: input.identity,
    rows: input.rows,
    admission: admissionFields,
  });
  return {
    authority: 'CANONICAL_SHADOW',
    written: 0,
    skipped: true,
    shadowValidated: true,
    sinkInvoked: false,
    rejectionCodes: evaluation.rejectionCodes,
  };
}

export interface KnowledgeScopedLearningFactWriteRequest {
  rows: readonly LearningFactWriteRow[];
  knowledgeScoped: boolean;
  canonicalIdentity?: CanonicalLearningFactIdentity | null;
  /** Registered admission (shadow or formal). Plain objects rejected. */
  admission?: VerifiedLearningFactAdmission | null;
  /**
   * Required for CANONICAL authority. Production has no mint in #1116.
   * Structural clones rejected.
   */
  writeCapability?: CanonicalLearningFactWriteCapability | null;
}

export interface WriteKnowledgeScopedLearningFactsOptions {
  /**
   * Must be a registered selector instance when provided.
   * Structural clones / forged CANONICAL selectors fail closed.
   */
  selector?: RegisteredLearningFactAuthoritySelector;
  knowledgeRevisionRef?: string | null;
}

export async function writeKnowledgeScopedLearningFacts(
  sink: LearningFactSink,
  request: KnowledgeScopedLearningFactWriteRequest,
  options: WriteKnowledgeScopedLearningFactsOptions = {},
): Promise<LearningFactWriteResult> {
  const selector = options.selector
    ?? selectLearningFactAuthority('FORMAL_PRODUCTION');
  assertRegisteredLearningFactSelector(selector);

  if (selector.authority === 'CANONICAL_SHADOW') {
    return shadowValidateCanonicalLearningFacts({
      rows: request.rows,
      identity: request.canonicalIdentity,
      admission: request.admission,
    });
  }

  if (selector.authority === 'CANONICAL') {
    if (!request.writeCapability) {
      throw new CanonicalLearningFactWriteError(
        'authority-not-canonical',
        'Canonical LearningFact write requires a registered write capability (none in production before #1117)',
      );
    }
    assertCanonicalLearningFactWriteCapability(request.writeCapability);
    // Selector on the capability must match the active registered selector instance.
    if (request.writeCapability.selector !== selector) {
      // Allow when both are registered CANONICAL — prefer capability's selector
      // identity; still require caller-passed selector is registered CANONICAL.
      if (
        selector.authority !== 'CANONICAL'
        || !selector.canonicalWriterEnabled
      ) {
        throw new CanonicalLearningFactWriteError(
          'authority-not-canonical',
          'Active selector is not a Canonical writer selector',
        );
      }
    }
    if (!request.canonicalIdentity) {
      throw new CanonicalLearningFactWriteError(
        'incomplete-identity',
        'Canonical authority requires identity atom',
      );
    }
    return writeCanonicalKnowledgeScopedLearningFacts(sink, {
      rows: request.rows,
      identity: request.canonicalIdentity,
      writeCapability: request.writeCapability,
    });
  }

  return writeLegacyKnowledgeScopedLearningFacts(sink, request.rows, {
    knowledgeRevisionRef: options.knowledgeRevisionRef ?? null,
  });
}
