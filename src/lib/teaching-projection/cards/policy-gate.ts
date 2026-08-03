/**
 * Card policy gate (#1271).
 *
 * Only core nodes with cardPolicy REQUIRED gate on an active card.
 * Optional card absence is diagnostic and never blocks a node/path.
 * Duplicate ACTIVE cards fail closed.
 */

import type {
  CardPolicyGateFinding,
  CardPolicyGateInput,
  CanonicalCardIndexEntry,
} from './contracts';
import type { TeachingCardIndexEntry } from '../contracts';

function isActive(
  card: TeachingCardIndexEntry | CanonicalCardIndexEntry,
): boolean {
  if ('active' in card) return card.active === true;
  return false;
}

function cardIdOf(
  card: TeachingCardIndexEntry | CanonicalCardIndexEntry,
): string {
  return card.cardId;
}

function canonicalIdOf(
  card: TeachingCardIndexEntry | CanonicalCardIndexEntry,
): string {
  return card.canonicalId;
}

/**
 * Evaluate card-policy findings for core nodes + card index.
 */
export function evaluateCardPolicyGate(
  input: CardPolicyGateInput,
): CardPolicyGateFinding[] {
  const findings: CardPolicyGateFinding[] = [];
  const activeByCanonical = new Map<string, string[]>();

  for (const card of input.cards) {
    if (!isActive(card)) continue;
    const canonicalId = canonicalIdOf(card);
    const list = activeByCanonical.get(canonicalId) ?? [];
    list.push(cardIdOf(card));
    activeByCanonical.set(canonicalId, list);
  }

  for (const [canonicalId, cardIds] of activeByCanonical) {
    if (cardIds.length > 1) {
      findings.push({
        code: 'duplicate-active-cards',
        severity: 'error',
        message: `Canonical ID ${canonicalId} has multiple active cards: ${cardIds.join(', ')}`,
        canonicalId,
      });
    }
  }

  for (const core of input.coreNodes) {
    if (core.cardPolicy !== 'required') {
      // Optional / none: absence does not block.
      if (core.cardPolicy === 'optional') {
        const actives = activeByCanonical.get(core.canonicalId) ?? [];
        if (actives.length === 0) {
          findings.push({
            code: 'optional-card-absent',
            severity: 'info',
            message: `optional card absent for core node ${core.canonicalId}`,
            canonicalId: core.canonicalId,
          });
        }
      }
      continue;
    }

    const actives = activeByCanonical.get(core.canonicalId) ?? [];
    if (actives.length === 0) {
      findings.push({
        code: 'required-core-card-missing',
        severity: 'error',
        message: `core node ${core.canonicalId} has cardPolicy REQUIRED but no active card`,
        canonicalId: core.canonicalId,
      });
    }
  }

  // Individual required flags on card rows (TeachingCardIndexEntry.required).
  for (const card of input.cards) {
    const required =
      'required' in card ? card.required === true : false;
    if (!required) continue;
    if (!isActive(card)) {
      findings.push({
        code: 'required-card-inactive',
        severity: 'error',
        message: `required card ${cardIdOf(card)} is not active`,
        cardId: cardIdOf(card),
        canonicalId: canonicalIdOf(card),
      });
    }
  }

  return findings;
}

/**
 * True when optional card absence must not block the consumer.
 */
export function optionalCardAbsenceBlocks(): false {
  return false;
}

/**
 * True only for REQUIRED core / card policy violations.
 */
export function isRequiredCardGateError(finding: CardPolicyGateFinding): boolean {
  return (
    finding.severity === 'error'
    && (finding.code === 'required-core-card-missing'
      || finding.code === 'required-card-inactive'
      || finding.code === 'duplicate-active-cards')
  );
}
