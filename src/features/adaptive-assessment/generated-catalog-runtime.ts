import { buildAdaptiveAssessmentItemCatalog } from './adaptive-assessment-item-catalog';
import {
  isGeneratedRuntimeOverlayReady,
  replaceGeneratedRuntimeOverlay,
} from './adaptive-assessment-catalog-selector';
import {
  generatedQuestionsFromStore,
  generatedReviewDecisionsFromStore,
} from './generated-candidate-catalog';
import {
  loadGeneratedCandidateStore,
} from './generated-candidate-persistence';
import {
  currentPublishedReceipts,
  type GeneratedCandidateStore,
} from './generated-candidate-governance';

type GeneratedCandidatePersistenceDb = Parameters<typeof loadGeneratedCandidateStore>[0];

let inflightHydration: Promise<void> | null = null;

export function applyGeneratedCandidateStoreToRuntimeOverlay(store: GeneratedCandidateStore) {
  const catalog = buildAdaptiveAssessmentItemCatalog({
    generatedCandidateStore: store,
    generatedQuestions: generatedQuestionsFromStore(store),
    checkpointQuestions: [],
    presetQuestions: [],
  });
  const publishedItems = catalog.items.filter((item) => (
    item.sourceFamily === 'generated-adaptive-question' && item.eligibilityState === 'path-eligible'
  ));
  replaceGeneratedRuntimeOverlay({
    items: publishedItems,
    decisions: generatedReviewDecisionsFromStore(store),
  });
  return publishedItems;
}

export async function ensureGeneratedCatalogHydrated(db: unknown) {
  if (isGeneratedRuntimeOverlayReady()) return;
  if (!isGeneratedCandidatePersistenceDb(db)) return;
  inflightHydration ??= hydrateGeneratedCatalogFromPersistence(db).finally(() => {
    inflightHydration = null;
  });
  await inflightHydration;
}

async function hydrateGeneratedCatalogFromPersistence(db: GeneratedCandidatePersistenceDb) {
  const store = await loadGeneratedCandidateStore(db);
  if (hasTornPublicationLineage(store)) return;
  if (isGeneratedRuntimeOverlayReady()) return;
  applyGeneratedCandidateStoreToRuntimeOverlay(store);
}

function hasTornPublicationLineage(store: GeneratedCandidateStore) {
  return currentPublishedReceipts(store).some((receipt) => {
    const candidate = store.candidates.find((item) => item.candidateId === receipt.candidateId);
    const revision = store.revisions.find((item) => item.revisionId === receipt.revisionId);
    const review = store.reviews.find((item) => item.reviewId === receipt.reviewId);
    if (!candidate || !revision || !review) return true;
    const revisionHash = revision.envelope.contentHash;
    return receipt.contentHash !== revisionHash || review.contentHash !== revisionHash;
  });
}

function isGeneratedCandidatePersistenceDb(db: unknown): db is GeneratedCandidatePersistenceDb {
  if (!db || typeof db !== 'object') return false;
  const client = db as Record<string, { findMany?: unknown } | undefined>;
  return [
    'adaptiveAssessmentGeneratedCandidate',
    'adaptiveAssessmentGeneratedCandidateRevision',
    'adaptiveAssessmentGeneratedCandidateEvent',
    'adaptiveAssessmentGeneratedCandidateReview',
    'adaptiveAssessmentGeneratedPublicationReceipt',
  ].every((key) => typeof client[key]?.findMany === 'function');
}
