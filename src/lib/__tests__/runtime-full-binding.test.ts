import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  overlayLiveTeachingPins,
} from '@/lib/teaching-projection/live-course-pointer';
import {
  classroomSimHasLessonUnit,
  encodeCardToken,
  evaluateLedgerQuotas,
  EXTRACTION_SOURCE_BOOKS,
  planRuntimeFullBinding,
  unitTokenFromResourceId,
} from '@/lib/teaching-projection/runtime-full-binding';

describe('runtime full binding planner', () => {
  it('extracts unit tokens and encodes card ids without colons', () => {
    expect(unitTokenFromResourceId('act:handout:1-2')).toBe('1-2');
    expect(unitTokenFromResourceId('act:exercise:handout-4-5')).toBe('4-5');
    expect(unitTokenFromResourceId('act:simulation:lesson07-routh-guide')).toBe('2-2');
    expect(unitTokenFromResourceId('act:simulation:lesson02-bridge-v1')).toBeNull();
    expect(encodeCardToken('ctc:modeling-abc')).toBe('ctc_modeling-abc');
    expect(classroomSimHasLessonUnit('act:simulation:lesson07-routh-guide')).toBe(true);
    expect(classroomSimHasLessonUnit('act:simulation:classroom-poll-classroom-poll')).toBe(false);
  });

  it('binds unit media to overlay cores and ledgers unmatched chinese cards', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.37',
      overlayCores: ['ctc:core-a', 'ctc:core-b'],
      nodeUnits: new Map([['ctc:core-a', '1-1']]),
      resources: [
        {
          resourceId: 'act:handout:1-1',
          resourceType: 'handout',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
        {
          resourceId: 'act:card:中文slug_1_abcd',
          resourceType: 'card',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
        {
          resourceId: 'act:simulation:classroom-poll-classroom-poll',
          resourceType: 'simulation',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
      ],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: ['ctc:core-b'],
      textbookLocators: [{
        sourceDocumentId: EXTRACTION_SOURCE_BOOKS[2],
        sourceAnchorId: 'cts:section-abc',
        chapterKey: 'ch-root-locus-01',
        canonicalIds: ['ctc:core-a'],
      }],
      taskSims: [{
        taskKey: 'arena:task-second-order-lead-pid',
        displayName: '二阶对象快速稳定挑战',
        source: 'arena',
        relatedNodeIds: ['ctc:core-a'],
      }],
    });

    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:handout:1-1' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:card:ctc_core-b')).toBe(true);
    expect(plan.authoring.resources.some((row) => row.resourceId === 'act:textbook:hu-shousong-auto-control-8th')).toBe(true);
    expect(plan.authoring.bindings.some((row) => row.resourceId.startsWith('act:textbook-chapter:') && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:simulation:arena-task-second-order-lead-pid')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:card:中文slug_1_abcd' && row.reason === 'no-exact-identity')).toBe(true);
    expect(plan.ledger.some((row) => row.reason === 'classroom-sim-without-unit')).toBe(true);
  });

  it('does not bind non-extraction-source textbooks', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [{
        sourceDocumentId: 'hu-shousong-exercise-analysis-3rd',
        sourceAnchorId: 'cts:section-zzz',
        chapterKey: 'ch-01',
        canonicalIds: ['ctc:core-a'],
      }],
      taskSims: [],
    });
    expect(plan.authoring.resources.some((row) => String(row.resourceId).includes('exercise-analysis'))).toBe(false);
  });

  it('does not publish textbook rows whose locators miss overlay cores', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [{
        sourceDocumentId: EXTRACTION_SOURCE_BOOKS[1],
        sourceAnchorId: 'cts:section-miss',
        chapterKey: 'ch-root-locus-01',
        canonicalIds: ['ctc:outside'],
      }],
      taskSims: [],
    });
    expect(plan.authoring.resources.some((row) => String(row.resourceId).includes('franklin'))).toBe(false);
    expect(plan.ledger.some((row) => row.reason === 'no-exact-identity' && row.detail === EXTRACTION_SOURCE_BOOKS[1])).toBe(true);
  });

  it('overlays live course projection only for teaching pins with matching authority', () => {
    const live = {
      projectionId: 'proj-live',
      projectionHash: 'h-live',
      authorityReleaseId: 'ctr:release:x',
    };
    expect(overlayLiveTeachingPins({
      projectionId: 'proj-old',
      projectionHash: 'h-old',
      authorityReleaseId: 'ctr:release:x',
    }, live).projectionId).toBe('proj-live');
    expect(overlayLiveTeachingPins({
      projectionId: null,
      projectionHash: null,
      authorityReleaseId: 'ctr:release:x',
    }, live).projectionId).toBeNull();
  });

  it('binds cards through the reviewed crosswalk and records listed exemptions explicitly (#2042)', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [
        {
          resourceId: 'act:card:Bode图_1_1',
          resourceType: 'card',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
        {
          resourceId: 'act:card:ANFIS_5_448b947a',
          resourceType: 'card',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
        {
          resourceId: 'act:card:未评审卡_2_abcdef',
          resourceType: 'card',
          projectionMode: 'OPTIONAL',
          scopeId: 'act-control-theory',
        },
      ],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [],
      taskSims: [],
      cardCrosswalk: [{ cardId: 'Bode图_1_1', canonicalId: 'ctc:core-a' }],
      cardExemptions: [{ cardId: 'ANFIS_5_448b947a', exemptionReason: 'no-overlay-equivalent' }],
    });

    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:card:Bode图_1_1' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.authoring.cards.some((card) => card.cardId === 'Bode图_1_1' && card.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:card:ANFIS_5_448b947a' && row.reason === 'explicit-exemption')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:card:未评审卡_2_abcdef' && row.reason === 'no-exact-identity')).toBe(true);
  });

  it('binds infographs by authority token and legacy crosswalk with ledger fallbacks (#2042)', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [],
      taskSims: [],
      cardCrosswalk: [{ cardId: 'Bode图_1_1', canonicalId: 'ctc:core-a' }],
      infographsAuthority: [
        { resourceId: 'act:infographic:ctc_core-a', canonicalId: 'ctc:core-a' },
        { resourceId: 'act:infographic:ctc_missing', canonicalId: 'ctc:missing' },
      ],
      infographsLegacy: [
        { resourceId: 'act:infographic:Bode图_1_1', cardId: 'Bode图_1_1' },
        { resourceId: 'act:infographic:未评审图_1_1', cardId: '未评审图_1_1' },
      ],
    });

    expect(plan.authoring.resources.filter((row) => row.resourceType === 'infographic').length).toBe(4);
    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:infographic:ctc_core-a' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:infographic:Bode图_1_1' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:infographic:ctc_missing' && row.reason === 'explicit-exemption' && row.detail === 'authority-infograph-outside-overlay')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:infographic:未评审图_1_1' && row.reason === 'no-exact-identity')).toBe(true);
  });

  it('feeds core nodes from the prerequisite publication and binds multi-unit cores via nodeUnitSets (#2042)', () => {
    const coreNodes = [{
      canonicalId: 'ctc:core-a',
      pathEligible: true,
      cardPolicy: 'optional',
      moduleId: null,
      scopeId: 'act-control-theory',
      rationale: null,
    }] as const;
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnitSets: new Map([['ctc:core-a', ['3-1', '3-9']]]),
      nodeUnits: new Map([['ctc:core-a', '3-1']]),
      resources: [
        { resourceId: 'act:handout:3-9', resourceType: 'handout', projectionMode: 'OPTIONAL', scopeId: 'act-control-theory' },
      ],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [],
      taskSims: [],
      coreNodes,
    });

    expect(plan.authoring.coreNodes?.length).toBe(1);
    expect(plan.authoring.coreNodes?.[0]?.canonicalId).toBe('ctc:core-a');
    // 3-9 keeps its own cores under nodeUnitSets instead of collapsing to the earliest unit.
    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:handout:3-9' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:handout:3-9')).toBe(false);
  });

  it('classifies declared and exempt classroom sims instead of ledgering them as without-unit (#2042)', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: 'ctr:release:x',
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [
        { resourceId: 'act:simulation:sim-pid-v1-sim-pid-v1', resourceType: 'simulation', projectionMode: 'OPTIONAL', scopeId: 'act-control-theory' },
        { resourceId: 'act:simulation:classroom-poll-classroom-poll', resourceType: 'simulation', projectionMode: 'OPTIONAL', scopeId: 'act-control-theory' },
      ],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      textbookLocators: [],
      taskSims: [],
      simCanonicalDeclarations: [{ resourceKey: 'sim-pid-v1', canonicalId: 'ctc:core-a' }],
      classroomSimExemptions: [{ resourceKey: 'classroom-poll-classroom-poll', exemptionReason: 'no-knowledge-anchor' }],
    });

    expect(plan.authoring.bindings.some((row) => row.resourceId === 'act:simulation:sim-pid-v1-sim-pid-v1' && row.canonicalId === 'ctc:core-a')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:simulation:classroom-poll-classroom-poll' && row.reason === 'explicit-exemption')).toBe(true);
    expect(plan.ledger.some((row) => row.resourceId === 'act:simulation:sim-pid-v1-sim-pid-v1')).toBe(false);
  });

  it('enforces per-reason ledger quotas (#2042)', () => {
    const ledger = [
      { resourceId: 'a', reason: 'no-exact-identity' },
      { resourceId: 'b', reason: 'no-exact-identity' },
      { resourceId: 'c', reason: 'explicit-exemption' },
    ] as const;
    expect(evaluateLedgerQuotas(ledger, { 'no-exact-identity': 2, 'explicit-exemption': 1 }).passed).toBe(true);
    const breached = evaluateLedgerQuotas(ledger, { 'no-exact-identity': 1 });
    expect(breached.passed).toBe(false);
    expect(breached.breaches).toEqual(['no-exact-identity: 2 > 1']);
    expect(evaluateLedgerQuotas(ledger, {}).countsByReason).toEqual({
      'explicit-exemption': 1,
      'no-exact-identity': 2,
    });
  });
});
