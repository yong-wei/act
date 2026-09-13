import type { BindingAppearance } from '@/lib/resource-binding-release/contracts';

/** Revisit resources enter the pool only after this posterior and at least one evidence event. */
export const REVISIT_POSTERIOR_MASTERY = 0.5;

/** Skip the knowledge entirely once both thresholds are met. */
export const MASTERED_POSTERIOR_MASTERY = 0.85;
export const MASTERED_CONFIDENCE = 0.6;

export type KnowledgeMasteryTag = {
  posteriorMastery?: number;
  confidence?: number;
  evidenceCount?: number;
};

export type KnowledgeResourceAdmission = 'skip' | 'first-only' | 'first-and-revisit';

export function knowledgeResourceAdmission(tag: KnowledgeMasteryTag | null | undefined): KnowledgeResourceAdmission {
  const posterior = Number(tag?.posteriorMastery ?? 0);
  const confidence = Number(tag?.confidence ?? 0);
  const evidence = Number(tag?.evidenceCount ?? 0);
  if (Number.isFinite(posterior) && Number.isFinite(confidence)
    && posterior >= MASTERED_POSTERIOR_MASTERY && confidence >= MASTERED_CONFIDENCE) {
    return 'skip';
  }
  if (Number.isFinite(posterior) && posterior >= REVISIT_POSTERIOR_MASTERY && evidence > 0) {
    return 'first-and-revisit';
  }
  return 'first-only';
}

/** Reference material has no teaching-order slot and stays available at every admission level except skip. */
export function isAppearanceAdmissible(
  appearance: BindingAppearance | null | undefined,
  admission: KnowledgeResourceAdmission,
): boolean {
  if (admission === 'skip') return false;
  if (appearance === 'revisit') return admission === 'first-and-revisit';
  return true;
}

export function appearanceRank(appearance: BindingAppearance | null | undefined): number {
  if (appearance === 'first') return 0;
  if (appearance === 'revisit') return 1;
  return 2;
}

export function appearanceDisplayLabel(appearance: BindingAppearance | null | undefined): string | null {
  if (appearance === 'first') return '首次';
  if (appearance === 'revisit') return '复现';
  if (appearance === 'reference') return '参考';
  return null;
}

export function teachingOrderProximity(order: { unitIndex: number; stepIndex: number | null } | null | undefined): number {
  if (!order) return 1_000_000;
  return order.unitIndex * 1000 + (order.stepIndex ?? 500);
}
