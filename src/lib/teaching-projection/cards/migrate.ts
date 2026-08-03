/**
 * Knowledge card auto-migration and active index builder (#1271).
 *
 * Auto-migrates exact 1:1 cards; records author decisions for
 * duplicate / split / unmapped / course-specific cases. Builds
 * `canonicalId → active card` index and rejects duplicate ACTIVE.
 */

import { projectionDigest } from '../hash';
import type { TeachingCardAuthoring } from '../contracts';
import {
  CARD_ACTIVE_INDEX_CONTRACT,
  CARD_AUTHOR_DECISION_CONTRACT,
  CARD_MIGRATION_BUILDER_VERSION,
  CARD_MIGRATION_REPORT_CONTRACT,
  type CardAuthorDecision,
  type CardAuthorDecisionKind,
  type CardMigrationArtifacts,
  type CardMigrationBuildInput,
  type CardMigrationRecord,
  type CardMigrationReport,
  type CardPolicyGateFinding,
  type CardStatus,
  type CanonicalCardActiveIndex,
  type CanonicalCardIndexEntry,
  type KnowledgeCardInventoryEntry,
} from './contracts';
import {
  classifyCardAgainstCrosswalk,
  detectDuplicateCanonicalTargets,
} from './crosswalk';
import { evaluateCardPolicyGate } from './policy-gate';

export class CardMigrationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CardMigrationError';
    this.code = code;
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

function toAuthoritySet(
  value: CardMigrationBuildInput['authorityCanonicalIds'],
): Set<string> {
  if (value instanceof Set) return value;
  return new Set(value);
}

function decisionKey(subjectId: string, scopeId: string, inputDigest: string): string {
  return `${subjectId}\u001f${scopeId}\u001f${inputDigest}`;
}

export function computeCardDecisionInputDigest(input: {
  cardId: string;
  legacyNodeId: string;
  sourceHash: string;
  classification: string;
  canonicalIds: readonly string[];
}): string {
  return projectionDigest({
    cardId: input.cardId,
    legacyNodeId: input.legacyNodeId,
    sourceHash: input.sourceHash,
    classification: input.classification,
    canonicalIds: [...input.canonicalIds].sort(compareCodePoint),
  });
}

export function createCardAuthorDecision(input: {
  subjectId: string;
  scopeId: string;
  inputDigest: string;
  kind: CardAuthorDecisionKind;
  rationale: string;
  primaryCardId?: string | null;
  canonicalIds?: string[];
  decisionId?: string;
  decidedAt?: string | null;
}): CardAuthorDecision {
  if (!input.subjectId || !input.scopeId || !input.inputDigest) {
    throw new CardMigrationError(
      'schema-invalid',
      'subjectId, scopeId, and inputDigest are required',
    );
  }
  if (!input.rationale?.trim()) {
    throw new CardMigrationError('schema-invalid', 'rationale is required');
  }
  if (input.kind === 'SELECT_PRIMARY' && !input.primaryCardId) {
    throw new CardMigrationError(
      'schema-invalid',
      'SELECT_PRIMARY requires primaryCardId',
    );
  }
  if (input.kind === 'SPLIT_CONTENT' && !(input.canonicalIds?.length)) {
    throw new CardMigrationError(
      'schema-invalid',
      'SPLIT_CONTENT requires canonicalIds',
    );
  }

  const decisionId =
    input.decisionId
    ?? `card-decision:${projectionDigest({
      subjectId: input.subjectId,
      scopeId: input.scopeId,
      inputDigest: input.inputDigest,
      kind: input.kind,
    }).slice(0, 24)}`;

  return {
    contract: CARD_AUTHOR_DECISION_CONTRACT,
    decisionId,
    subjectId: input.subjectId,
    scopeId: input.scopeId,
    kind: input.kind,
    inputDigest: input.inputDigest,
    primaryCardId: input.primaryCardId ?? null,
    canonicalIds: input.canonicalIds ?? [],
    rationale: input.rationale.trim(),
    decidedAt: input.decidedAt ?? null,
  };
}

export function selectCardAuthorDecision(
  decisions: readonly CardAuthorDecision[],
  subjectId: string,
  scopeId: string,
  inputDigest: string,
): CardAuthorDecision | null {
  const key = decisionKey(subjectId, scopeId, inputDigest);
  const matches = decisions.filter(
    (d) => decisionKey(d.subjectId, d.scopeId, d.inputDigest) === key,
  );
  if (matches.length === 0) return null;
  // Deterministic: lowest decisionId wins if duplicates.
  return sortBy(matches, (d) => d.decisionId)[0] ?? null;
}

function initialStatus(
  card: KnowledgeCardInventoryEntry,
  classification: CardMigrationRecord['classification'],
  autoMigrated: boolean,
): CardStatus {
  if (classification === 'UNMAPPED') return 'LEGACY_FALLBACK';
  if (classification === 'COURSE_SPECIFIC') return 'INACTIVE';
  if (classification === 'SPLIT' || classification === 'DUPLICATE') {
    return autoMigrated ? 'ACTIVE' : 'INACTIVE';
  }
  if (card.reviewStatus === 'excluded') return 'INACTIVE';
  if (autoMigrated) return 'ACTIVE';
  return 'INACTIVE';
}

/**
 * Classify and migrate inventory cards; build the active Canonical index.
 */
export function buildCardMigration(
  input: CardMigrationBuildInput,
): CardMigrationArtifacts {
  const authority = toAuthoritySet(input.authorityCanonicalIds);
  const decisions = input.authorDecisions ?? [];
  const findings: CardPolicyGateFinding[] = [];

  // Pass 1: per-card classification (before duplicate set analysis).
  type Working = {
    card: KnowledgeCardInventoryEntry;
    classification: CardMigrationRecord['classification'];
    canonicalIds: string[];
    reason: string;
    inputDigest: string;
  };

  const working: Working[] = [];
  for (const card of sortBy(input.inventory.entries, (e) => e.cardId)) {
    const classified = classifyCardAgainstCrosswalk({
      card,
      crosswalk: input.crosswalk,
      authorityCanonicalIds: authority,
    });
    const inputDigest = computeCardDecisionInputDigest({
      cardId: card.cardId,
      legacyNodeId: card.legacyNodeId,
      sourceHash: card.sourceHash,
      classification: classified.classification,
      canonicalIds: classified.canonicalIds,
    });
    working.push({
      card,
      classification: classified.classification,
      canonicalIds: classified.canonicalIds,
      reason: classified.reason,
      inputDigest,
    });
  }

  // Pass 2: mark duplicates (many cards → one Canonical among ONE_TO_ONE).
  const oneToOnePairs = working
    .filter((w) => w.classification === 'ONE_TO_ONE' && w.canonicalIds[0])
    .map((w) => ({
      cardId: w.card.cardId,
      canonicalId: w.canonicalIds[0]!,
    }));
  const dups = detectDuplicateCanonicalTargets(oneToOnePairs);
  const dupCardIds = new Set(dups.flatMap((d) => d.cardIds));
  const dupCanonical = new Map(
    dups.map((d) => [d.canonicalId, d.cardIds] as const),
  );

  for (const w of working) {
    if (
      w.classification === 'ONE_TO_ONE'
      && w.canonicalIds[0]
      && dupCardIds.has(w.card.cardId)
    ) {
      w.classification = 'DUPLICATE';
      w.reason = `multiple cards claim Canonical ${w.canonicalIds[0]}: ${(
        dupCanonical.get(w.canonicalIds[0]) ?? []
      ).join(', ')}`;
      w.inputDigest = computeCardDecisionInputDigest({
        cardId: w.card.cardId,
        legacyNodeId: w.card.legacyNodeId,
        sourceHash: w.card.sourceHash,
        classification: w.classification,
        canonicalIds: w.canonicalIds,
      });
    }
  }

  // Pass 3: apply auto-migrate / author decisions.
  const records: CardMigrationRecord[] = [];
  const indexEntries: CanonicalCardIndexEntry[] = [];
  const teachingCards: TeachingCardAuthoring[] = [];

  // For SELECT_PRIMARY decisions keyed by canonical subject.
  const primaryByCanonical = new Map<string, string>();
  for (const d of decisions) {
    if (d.kind === 'SELECT_PRIMARY' && d.primaryCardId) {
      // subjectId may be canonicalId or cardId.
      primaryByCanonical.set(d.subjectId, d.primaryCardId);
    }
  }

  for (const w of working) {
    const card = w.card;
    let autoMigrated = false;
    let requiresAuthorDecision = false;
    let authorDecisionId: string | null = null;
    let canonicalId: string | null = w.canonicalIds[0] ?? null;
    let status: CardStatus = 'INACTIVE';
    let rationale = w.reason;

    const decision = selectCardAuthorDecision(
      decisions,
      // Prefer canonical-level decision for duplicates, else card-level.
      w.classification === 'DUPLICATE' && canonicalId
        ? canonicalId
        : card.cardId,
      input.scopeId,
      w.inputDigest,
    ) ?? selectCardAuthorDecision(
      decisions,
      card.cardId,
      input.scopeId,
      w.inputDigest,
    );

    if (w.classification === 'ONE_TO_ONE' && canonicalId) {
      autoMigrated = true;
      status = initialStatus(card, w.classification, true);
      rationale = `auto-migrated 1:1 → ${canonicalId}`;
    } else if (w.classification === 'DUPLICATE' && canonicalId) {
      const primary =
        decision?.kind === 'SELECT_PRIMARY'
          ? decision.primaryCardId
          : primaryByCanonical.get(canonicalId) ?? null;
      if (primary && primary === card.cardId) {
        autoMigrated = true;
        status = 'ACTIVE';
        authorDecisionId = decision?.decisionId ?? null;
        rationale = `author selected primary card for ${canonicalId}`;
      } else if (primary && primary !== card.cardId) {
        status = 'INACTIVE';
        authorDecisionId = decision?.decisionId ?? null;
        rationale = `not primary for ${canonicalId}; primary=${primary}`;
      } else {
        requiresAuthorDecision = true;
        status = 'INACTIVE';
        rationale = `duplicate active candidates require author decision for ${canonicalId}`;
        findings.push({
          code: 'duplicate-active-cards',
          severity: 'error',
          message: rationale,
          canonicalId,
          cardId: card.cardId,
        });
      }
    } else if (w.classification === 'SPLIT') {
      if (decision?.kind === 'SPLIT_CONTENT' && decision.canonicalIds?.length) {
        // Content split: this card keeps first assigned Canonical if listed.
        const assigned = decision.canonicalIds.find((id) =>
          w.canonicalIds.includes(id),
        );
        if (assigned) {
          canonicalId = assigned;
          autoMigrated = true;
          status = 'ACTIVE';
          authorDecisionId = decision.decisionId;
          rationale = `author split content; assigned ${assigned}`;
        } else {
          status = 'INACTIVE';
          authorDecisionId = decision.decisionId;
          rationale = 'author split content; card not assigned a Canonical';
        }
      } else if (decision?.kind === 'KEEP_LEGACY') {
        status = 'LEGACY_FALLBACK';
        authorDecisionId = decision.decisionId;
        rationale = 'author kept legacy fallback for split card';
      } else {
        requiresAuthorDecision = true;
        status = 'INACTIVE';
        rationale = 'split mapping requires author content decision';
      }
    } else if (w.classification === 'COURSE_SPECIFIC') {
      if (decision?.kind === 'COURSE_RESOURCE') {
        status = 'INACTIVE';
        authorDecisionId = decision.decisionId;
        rationale = 'moved to lesson/step resource bindings';
      } else {
        requiresAuthorDecision = true;
        status = 'INACTIVE';
        rationale = 'course-specific card must become a lesson/step resource';
      }
    } else {
      // UNMAPPED
      if (decision?.kind === 'KEEP_LEGACY') {
        status = 'LEGACY_FALLBACK';
        authorDecisionId = decision.decisionId;
        rationale = 'author retained legacy fallback for unmapped card';
      } else if (decision?.kind === 'EXPLICIT_NONE') {
        status = 'INACTIVE';
        authorDecisionId = decision.decisionId;
        rationale = 'author explicit none for unmapped card';
      } else {
        requiresAuthorDecision = true;
        status = 'LEGACY_FALLBACK';
        rationale = 'unmapped card retains legacy fallback until decided';
      }
    }

    const legacyAliases = [
      ...new Set(
        [card.legacyNodeId, card.cardId].filter(
          (id) => id && id !== canonicalId,
        ),
      ),
    ].sort(compareCodePoint);

    records.push({
      cardId: card.cardId,
      legacyNodeId: card.legacyNodeId,
      classification: w.classification,
      canonicalId,
      status,
      autoMigrated,
      requiresAuthorDecision,
      authorDecisionId,
      sourceHash: card.sourceHash,
      sourcePath: card.authoringPath ?? card.runtimePath,
      title: card.title,
      rationale,
      legacyAliases,
    });

    if (canonicalId && (status === 'ACTIVE' || status === 'LEGACY_FALLBACK' || status === 'INACTIVE')) {
      const required = (input.coreNodes ?? []).some(
        (core) =>
          core.canonicalId === canonicalId
          && core.cardPolicy === 'required',
      );
      indexEntries.push({
        cardId: card.cardId,
        resourceId: `act:card:${card.cardId}`,
        canonicalId,
        status,
        active: status === 'ACTIVE',
        required,
        sourceHash: card.sourceHash,
        sourcePath: card.authoringPath ?? card.runtimePath,
        title: card.title,
        cardVersion: card.cardVersion,
        projectionScope: input.scopeId,
        legacyAliases,
        legacyFallback: status === 'LEGACY_FALLBACK',
      });

      if (status === 'ACTIVE') {
        teachingCards.push({
          cardId: card.cardId,
          canonicalId,
          active: true,
          required,
          sourcePath: card.authoringPath ?? card.runtimePath ?? undefined,
          title: card.title ?? undefined,
        });
      }
    }
  }

  // Fail closed on residual duplicate actives in the index.
  const activePairs = indexEntries
    .filter((e) => e.active)
    .map((e) => ({ cardId: e.cardId, canonicalId: e.canonicalId }));
  for (const dup of detectDuplicateCanonicalTargets(activePairs)) {
    findings.push({
      code: 'duplicate-active-cards',
      severity: 'error',
      message: `Canonical ID ${dup.canonicalId} has multiple active cards: ${dup.cardIds.join(', ')}`,
      canonicalId: dup.canonicalId,
    });
    // Deactivate all but lexicographically first until author decision — fail closed for publication.
    const sorted = [...dup.cardIds].sort(compareCodePoint);
    for (const entry of indexEntries) {
      if (entry.canonicalId === dup.canonicalId && entry.cardId !== sorted[0]) {
        entry.active = false;
        if (entry.status === 'ACTIVE') entry.status = 'INACTIVE';
      }
    }
    // Remove non-primary from teachingCards.
    for (let i = teachingCards.length - 1; i >= 0; i -= 1) {
      const tc = teachingCards[i]!;
      if (tc.canonicalId === dup.canonicalId && tc.cardId !== sorted[0]) {
        teachingCards.splice(i, 1);
      }
    }
  }

  const sortedRecords = sortBy(records, (r) => r.cardId);
  const summary = {
    oneToOneCount: sortedRecords.filter((r) => r.classification === 'ONE_TO_ONE').length,
    duplicateCount: sortedRecords.filter((r) => r.classification === 'DUPLICATE').length,
    splitCount: sortedRecords.filter((r) => r.classification === 'SPLIT').length,
    unmappedCount: sortedRecords.filter((r) => r.classification === 'UNMAPPED').length,
    courseSpecificCount: sortedRecords.filter((r) => r.classification === 'COURSE_SPECIFIC').length,
    autoMigratedCount: sortedRecords.filter((r) => r.autoMigrated).length,
    authorDecisionRequiredCount: sortedRecords.filter((r) => r.requiresAuthorDecision).length,
  };

  const migrationBody = {
    contract: CARD_MIGRATION_REPORT_CONTRACT,
    builderVersion: CARD_MIGRATION_BUILDER_VERSION,
    authoringRevision: input.authoringRevision,
    inventoryDigest: input.inventory.inventoryDigest,
    records: sortedRecords,
    summary,
  };
  const migration: CardMigrationReport = {
    ...migrationBody,
    reportDigest: projectionDigest(migrationBody),
  };

  const sortedIndex = sortBy(indexEntries, (e) => `${e.canonicalId}\u001f${e.cardId}`);
  const activeByCanonical = sortedIndex
    .filter((e) => e.active)
    .map((e) => ({ canonicalId: e.canonicalId, cardId: e.cardId }));

  // Ensure unique active map (post deactivation).
  const activeMapCheck = new Map<string, string>();
  for (const row of activeByCanonical) {
    if (activeMapCheck.has(row.canonicalId)) {
      findings.push({
        code: 'duplicate-active-cards',
        severity: 'error',
        message: `index publication fail-closed: ${row.canonicalId}`,
        canonicalId: row.canonicalId,
      });
    } else {
      activeMapCheck.set(row.canonicalId, row.cardId);
    }
  }

  const indexBody = {
    contract: CARD_ACTIVE_INDEX_CONTRACT,
    builderVersion: CARD_MIGRATION_BUILDER_VERSION,
    projectionScope: input.scopeId,
    entries: sortedIndex,
    activeByCanonical: [...activeMapCheck.entries()]
      .map(([canonicalId, cardId]) => ({ canonicalId, cardId }))
      .sort((a, b) => compareCodePoint(a.canonicalId, b.canonicalId)),
  };
  const activeIndex: CanonicalCardActiveIndex = {
    ...indexBody,
    indexDigest: projectionDigest(indexBody),
  };

  // Required core-node card policy gate.
  const policyFindings = evaluateCardPolicyGate({
    coreNodes: input.coreNodes ?? [],
    cards: sortedIndex,
  });
  findings.push(...policyFindings);

  const hasErrors = findings.some((f) => f.severity === 'error');

  return {
    inventory: input.inventory,
    migration,
    activeIndex,
    teachingCards: sortBy(teachingCards, (c) => c.cardId),
    findings: sortBy(
      findings,
      (f) => `${f.severity}:${f.code}:${f.canonicalId ?? ''}:${f.cardId ?? ''}`,
    ),
    passed: !hasErrors,
  };
}

/**
 * Lookup active card by Canonical ID from the index.
 * Returns null when absent (optional) — never throws for absence.
 */
export function getActiveCardForCanonical(
  index: CanonicalCardActiveIndex,
  canonicalId: string,
): CanonicalCardIndexEntry | null {
  const active = index.activeByCanonical.find((r) => r.canonicalId === canonicalId);
  if (!active) return null;
  return (
    index.entries.find(
      (e) => e.cardId === active.cardId && e.canonicalId === canonicalId && e.active,
    ) ?? null
  );
}
