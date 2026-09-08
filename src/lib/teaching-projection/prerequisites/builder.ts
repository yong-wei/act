/**
 * Deterministic ACT teaching prerequisite publication builder (#1270).
 *
 * Fail closed: invalid input or capture drift rejects the publication and
 * preserves the prior valid artifact when provided.
 */

import { projectionDigest, projectionIdFromHashCompat } from './hash-compat';
import {
  ACT_TEACHING_PREREQUISITE_BUILDER_VERSION,
  ACT_TEACHING_PREREQUISITE_PUBLICATION_CONTRACT,
  type EngineeringLearningOrderReceipt,
  type PrerequisitePublicationArtifacts,
  type PrerequisitePublicationBuildInput,
  type PrerequisitePublicationGate,
  type PrerequisitePublicationManifest,
  type PrerequisiteDerivedViews,
  type PrerequisiteGateFinding,
} from './contracts';
import { normalizeCandidates } from './candidates';
import {
  assertEngineeringAdoptedReceipts,
  EngineeringLearningOrderReceiptError,
} from './adopt-engineering-learning-order';
import {
  publishCoreNodes,
  toProjectionCoreNodeAuthoring,
} from './core-nodes';
import {
  materializePrerequisiteEdges,
  requiredClosure,
  topologicalOrder,
  toProjectionPrerequisiteAuthoring,
  PrerequisiteEdgeError,
} from './edges';

export class PrerequisiteBuildError extends Error {
  readonly code: string;
  readonly findings: PrerequisiteGateFinding[];
  /** Prior artifact preserved on fail-closed rejection. */
  readonly priorArtifacts: PrerequisitePublicationArtifacts | null;

  constructor(
    code: string,
    message: string,
    options: {
      findings?: PrerequisiteGateFinding[];
      priorArtifacts?: PrerequisitePublicationArtifacts | null;
    } = {},
  ) {
    super(message);
    this.name = 'PrerequisiteBuildError';
    this.code = code;
    this.findings = options.findings ?? [];
    this.priorArtifacts = options.priorArtifacts ?? null;
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function buildDerivedViews(
  edges: readonly {
    sourceNodeId: string;
    targetNodeId: string;
    strength: string;
    status: string;
  }[],
): PrerequisiteDerivedViews {
  // Hard-dependency derived views only consume PUBLISHED REQUIRED edges.
  // CANDIDATE edges must never auto-enter teaching prerequisite closure/order.
  const requiredEdges = edges.filter(
    (e) =>
      e.strength === 'REQUIRED'
      && e.sourceNodeId !== e.targetNodeId
      && e.status === 'PUBLISHED',
  );
  // Advisory order may still include non-self-loop published/recommended edges.
  const allForAdvisory = edges.filter(
    (e) => e.sourceNodeId !== e.targetNodeId && e.status === 'PUBLISHED',
  );

  let requiredTopologicalOrder: string[] = [];
  try {
    requiredTopologicalOrder = topologicalOrder(requiredEdges);
  } catch (error) {
    if (error instanceof PrerequisiteEdgeError && error.code === 'required-cycle') {
      // Gate will already record the cycle; derived view stays empty.
      requiredTopologicalOrder = [];
    } else {
      throw error;
    }
  }

  let advisoryTopologicalOrder: string[] = [];
  try {
    advisoryTopologicalOrder = topologicalOrder(allForAdvisory);
  } catch {
    // Advisory may include cycles involving RECOMMENDED; fall back to required.
    advisoryTopologicalOrder = requiredTopologicalOrder;
  }

  return {
    requiredClosure: requiredClosure(requiredEdges),
    requiredTopologicalOrder,
    advisoryTopologicalOrder,
  };
}

function evaluateGate(input: {
  findings: PrerequisiteGateFinding[];
  edges: readonly { status: string }[];
  candidates: readonly unknown[];
  coreNodeCount: number;
}): PrerequisitePublicationGate {
  const hasErrors = input.findings.some((f) => f.severity === 'error');
  const publishedEdgeCount = input.edges.filter((e) => e.status === 'PUBLISHED').length;
  const candidateOnlyCount = input.candidates.length;
  const staleEdgeCount = input.edges.filter((e) => e.status === 'STALE').length;

  let status: PrerequisitePublicationGate['status'];
  if (hasErrors) {
    status = 'REVIEW_REQUIRED';
  } else if (
    input.coreNodeCount === 0
    && publishedEdgeCount === 0
    && candidateOnlyCount === 0
  ) {
    status = 'PUBLISHED';
  } else {
    status = 'PUBLISHED';
  }

  return {
    status,
    passed: !hasErrors,
    findings: sortBy(input.findings, (f) => `${f.code}:${f.edgeId ?? f.canonicalId ?? f.message}`),
    publishedEdgeCount,
    candidateOnlyCount,
    staleEdgeCount,
  };
}

function normalizeReceipts(
  receipts: readonly EngineeringLearningOrderReceipt[],
): EngineeringLearningOrderReceipt[] {
  return [...receipts].sort((a, b) => (
    compareCodePoint(a.relationId, b.relationId)
    || compareCodePoint(a.sourceId, b.sourceId)
    || compareCodePoint(a.targetId, b.targetId)
  ));
}

function buildManifest(input: {
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  coreNodes: unknown;
  edges: unknown;
  decisions: unknown;
  candidates: unknown;
  receipts?: unknown;
  gate: PrerequisitePublicationGate;
  coreNodeCount: number;
  publishedEdgeCount: number;
  candidateCount: number;
}): PrerequisitePublicationManifest {
  const hashedParts = {
    coreNodes: projectionDigest(input.coreNodes),
    edges: projectionDigest(input.edges),
    decisions: projectionDigest(input.decisions),
    candidates: projectionDigest(input.candidates),
    ...(input.receipts !== undefined
      ? { receipts: projectionDigest(input.receipts) }
      : {}),
  };
  const sourceHashes = {
    ...hashedParts,
    body: '',
  };
  const body = {
    contract: ACT_TEACHING_PREREQUISITE_PUBLICATION_CONTRACT,
    builderVersion: ACT_TEACHING_PREREQUISITE_BUILDER_VERSION,
    scopeId: input.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.authorityReleaseId,
    projectionCaptureId: input.projectionCaptureId,
    coreNodeCount: input.coreNodeCount,
    publishedEdgeCount: input.publishedEdgeCount,
    candidateCount: input.candidateCount,
    sourceHashes: hashedParts,
    gateStatus: input.gate.status,
    gatePassed: input.gate.passed,
  };
  sourceHashes.body = projectionDigest(body);
  const publicationHash = projectionDigest({
    ...body,
    sourceHashes,
  });
  return {
    ...body,
    sourceHashes,
    publicationId: projectionIdFromHashCompat(publicationHash),
    publicationHash,
  };
}

/**
 * Build a versioned prerequisite publication.
 *
 * On validation failure, throws PrerequisiteBuildError with priorArtifacts
 * preserved (caller must not replace the live artifact).
 */
export function buildPrerequisitePublication(
  input: PrerequisitePublicationBuildInput,
): PrerequisitePublicationArtifacts {
  const prior = input.priorArtifacts ?? null;
  const findings: PrerequisiteGateFinding[] = [];

  try {
    if (!input.scopeId || !input.authoringRevision || !input.authorityReleaseId) {
      throw new PrerequisiteBuildError(
        'schema-invalid',
        'scopeId, authoringRevision, and authorityReleaseId are required',
        { priorArtifacts: prior },
      );
    }

    const coreNodes = publishCoreNodes(input.coreNodes, {
      scopeId: input.scopeId,
      authorityNodes: input.authorityNodes,
    });
    const candidates = normalizeCandidates(input.candidates ?? []);
    const decisions = [...(input.decisions ?? [])].sort((a, b) =>
      compareCodePoint(a.decisionId, b.decisionId),
    );

    // Candidate origins never elevate to published edges automatically.
    for (const candidate of candidates) {
      if (candidate.publishable !== false) {
        findings.push({
          code: 'candidate-auto-publish-forbidden',
          severity: 'error',
          message: `candidate ${candidate.candidateId} must not be auto-publishable`,
          candidateId: candidate.candidateId,
        });
      }
    }

    const materialized = materializePrerequisiteEdges(input.edges, {
      scopeId: input.scopeId,
      coreNodes,
      authorityNodes: input.authorityNodes,
      decisions,
      authorityReleaseId: input.authorityReleaseId,
      projectionCaptureId: input.projectionCaptureId ?? null,
      authoringRevision: input.authoringRevision,
    });
    findings.push(...materialized.findings);

    const gate = evaluateGate({
      findings,
      edges: materialized.edges,
      candidates,
      coreNodeCount: coreNodes.length,
    });

    if (!gate.passed) {
      throw new PrerequisiteBuildError(
        'publication-rejected',
        `prerequisite publication rejected: ${
          gate.findings
            .filter((f) => f.severity === 'error')
            .map((f) => f.code)
            .join(', ') || 'validation failed'
        }`,
        { findings: gate.findings, priorArtifacts: prior },
      );
    }

    const derived = buildDerivedViews(materialized.edges);
    const publishedEdgeCount = materialized.edges.filter(
      (e) => e.status === 'PUBLISHED',
    ).length;

    const receipts = (input.receipts && input.receipts.length > 0)
      ? normalizeReceipts(input.receipts)
      : undefined;

    try {
      assertEngineeringAdoptedReceipts({
        edges: materialized.edges,
        receipts,
      });
    } catch (error) {
      if (error instanceof EngineeringLearningOrderReceiptError) {
        throw new PrerequisiteBuildError('hash-invalid', error.message, {
          priorArtifacts: prior,
        });
      }
      throw error;
    }

    const manifest = buildManifest({
      scopeId: input.scopeId,
      authoringRevision: input.authoringRevision,
      authorityReleaseId: input.authorityReleaseId,
      projectionCaptureId: input.projectionCaptureId ?? null,
      coreNodes,
      edges: materialized.edges,
      decisions,
      candidates,
      receipts,
      gate,
      coreNodeCount: coreNodes.length,
      publishedEdgeCount,
      candidateCount: candidates.length,
    });

    return {
      coreNodes,
      edges: materialized.edges,
      candidates,
      derived,
      gate,
      manifest,
      projectionCoreNodes: toProjectionCoreNodeAuthoring(coreNodes),
      projectionPrerequisites: toProjectionPrerequisiteAuthoring(
        materialized.edges,
      ),
      ...(receipts ? { receipts } : {}),
    };
  } catch (error) {
    if (error instanceof PrerequisiteBuildError) {
      // Ensure prior is always attached for fail-closed callers.
      if (!error.priorArtifacts && prior) {
        throw new PrerequisiteBuildError(error.code, error.message, {
          findings: error.findings,
          priorArtifacts: prior,
        });
      }
      throw error;
    }
    if (error instanceof Error) {
      throw new PrerequisiteBuildError('build-failed', error.message, {
        priorArtifacts: prior,
      });
    }
    throw new PrerequisiteBuildError('build-failed', 'unknown build failure', {
      priorArtifacts: prior,
    });
  }
}

/**
 * Attempt a build; on rejection return the prior artifact + diagnostics
 * without mutating it.
 */
export function buildPrerequisitePublicationFailClosed(
  input: PrerequisitePublicationBuildInput,
): {
  ok: boolean;
  artifacts: PrerequisitePublicationArtifacts | null;
  priorPreserved: boolean;
  findings: PrerequisiteGateFinding[];
  errorCode?: string;
  errorMessage?: string;
} {
  try {
    const artifacts = buildPrerequisitePublication(input);
    return {
      ok: true,
      artifacts,
      priorPreserved: false,
      findings: artifacts.gate.findings,
    };
  } catch (error) {
    if (error instanceof PrerequisiteBuildError) {
      return {
        ok: false,
        artifacts: error.priorArtifacts,
        priorPreserved: error.priorArtifacts != null,
        findings: error.findings,
        errorCode: error.code,
        errorMessage: error.message,
      };
    }
    return {
      ok: false,
      artifacts: input.priorArtifacts ?? null,
      priorPreserved: input.priorArtifacts != null,
      findings: [],
      errorCode: 'build-failed',
      errorMessage: error instanceof Error ? error.message : 'unknown failure',
    };
  }
}
