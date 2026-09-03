import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createTeacherAiGradingLabSplit,
  stratifyTeacherAiGradingLabSamples,
  TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION,
  type TeacherAiGradingLabSplitSample,
} from '../teacher-ai-grading-lab-split';

function samples(): TeacherAiGradingLabSplitSample[] {
  return [
    ...makeStratum('low', 'algebra', 4),
    ...makeStratum('middle', 'reasoning', 3),
    ...makeStratum('high', 'diagram', 2),
    ...makeStratum('high', 'none', 1),
  ];
}

function makeStratum(scoreBand: string, primaryErrorType: string, count: number): TeacherAiGradingLabSplitSample[] {
  return Array.from({ length: count }, (_, index) => ({
    sampleId: `sample-${scoreBand}-${primaryErrorType}-${index + 1}`,
    scoreBand,
    primaryErrorType,
  }));
}

function splitInput(sampleSet = samples()) {
  return {
    datasetId: 'first-round-t1',
    datasetVersion: 'v1',
    randomSeed: 'seed-2026-07-27',
    tuningRatio: 0.7,
    samples: sampleSet,
  };
}

function createMemoryDb() {
  const splits: any[] = [];
  const members: any[] = [];
  const acceptances: any[] = [];
  const writes: string[] = [];
  const db: any = {
    splits,
    members,
    acceptances,
    writes,
    teacherAiGradingLabSplit: {
      findFirst: async ({ where }: any) => splits.find((row) => (
        row.datasetId === where.datasetId
        && row.datasetVersion === where.datasetVersion
        && row.contentHash === where.contentHash
      )) ?? null,
      findUnique: async ({ where }: any) => {
        const split = splits.find((row) => row.id === where.id);
        if (!split) return null;
        return {
          ...split,
          members: members.filter((row) => row.splitId === split.id).sort((left, right) => left.sampleId.localeCompare(right.sampleId)),
          hiddenAcceptance: acceptances.find((row) => row.splitId === split.id) ?? null,
        };
      },
      aggregate: async ({ where }: any) => ({
        _max: {
          version: Math.max(0, ...splits
            .filter((row) => row.datasetId === where.datasetId && row.datasetVersion === where.datasetVersion)
            .map((row) => row.version)),
        },
      }),
      create: async ({ data }: any) => {
        writes.push('split');
        splits.push({ ...data });
        return { ...data };
      },
    },
    teacherAiGradingLabSplitMember: {
      createMany: async ({ data }: any) => {
        writes.push('members');
        members.push(...data.map((row: any) => ({ ...row })));
        return { count: data.length };
      },
    },
    teacherAiGradingHiddenAcceptance: {
      create: async ({ data }: any) => {
        writes.push('acceptance');
        acceptances.push({ ...data });
        return { ...data };
      },
    },
  };
  return db;
}

describe('teacher AI grading lab split', () => {
  it('is input-order independent and uses deterministic largest remainders for small compound strata', () => {
    const forward = stratifyTeacherAiGradingLabSamples(splitInput());
    const reversed = stratifyTeacherAiGradingLabSamples(splitInput(samples().reverse()));

    expect(forward).toEqual(reversed);
    expect(forward.algorithmVersion).toBe(TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION);
    expect(forward).toMatchObject({ sampleCount: 10, tuningCount: 7, hiddenCount: 3 });

    const hiddenByStratum = Object.fromEntries([...new Set(forward.members.map((member) => member.stratumKey))]
      .map((stratumKey) => [
        stratumKey,
        forward.members.filter((member) => member.stratumKey === stratumKey && member.partition === 'HIDDEN').length,
      ]));
    expect(hiddenByStratum).toEqual({
      '["high","diagram"]': 1,
      '["high","none"]': 0,
      '["low","algebra"]': 1,
      '["middle","reasoning"]': 1,
    });
  });

  it('rejects missing compound labels and duplicate samples', () => {
    expect(() => stratifyTeacherAiGradingLabSamples(splitInput([
      { sampleId: 'sample-a', scoreBand: '', primaryErrorType: 'algebra' },
      { sampleId: 'sample-b', scoreBand: 'low', primaryErrorType: 'algebra' },
    ]))).toThrow('grading-lab-split-score-band-missing');
    expect(() => stratifyTeacherAiGradingLabSamples(splitInput([
      { sampleId: 'sample-a', scoreBand: 'low', primaryErrorType: 'algebra' },
      { sampleId: 'sample-a', scoreBand: 'high', primaryErrorType: 'diagram' },
    ]))).toThrow('grading-lab-split-sample-duplicate');
  });

  it('changes the content identity for seed, ratio, or label changes', () => {
    const original = stratifyTeacherAiGradingLabSamples(splitInput());
    const changedSeed = stratifyTeacherAiGradingLabSamples({ ...splitInput(), randomSeed: 'another-seed' });
    const changedRatio = stratifyTeacherAiGradingLabSamples({ ...splitInput(), tuningRatio: 0.6 });
    const relabeled = samples();
    relabeled[0] = { ...relabeled[0], primaryErrorType: 'new-error' };
    const changedLabel = stratifyTeacherAiGradingLabSamples(splitInput(relabeled));

    expect(new Set([original.contentHash, changedSeed.contentHash, changedRatio.contentHash, changedLabel.contentHash]).size).toBe(4);
  });

  it('replays identical immutable splits and allocates new versions for changed inputs', async () => {
    const db = createMemoryDb();
    const first = await createTeacherAiGradingLabSplit({ db, ...splitInput() });
    const replay = await createTeacherAiGradingLabSplit({ db, ...splitInput(samples().reverse()) });
    const changed = await createTeacherAiGradingLabSplit({ db, ...splitInput(), randomSeed: 'new-seed' });

    expect(replay.id).toBe(first.id);
    expect(replay.version).toBe(1);
    expect(first.hiddenState).toBe('SEALED');
    expect(first).not.toHaveProperty('members');
    expect(first).not.toHaveProperty('seed');
    expect(changed.version).toBe(2);
    expect(db.splits).toHaveLength(2);
    expect(db.members).toHaveLength(20);
    expect(db.acceptances.map((row: any) => row.state)).toEqual(['SEALED', 'SEALED']);
    expect(db.writes).toEqual([
      'split', 'members', 'acceptance',
      'split', 'members', 'acceptance',
    ]);
  });

  it('creates a preflight split without hidden members or acceptance', async () => {
    const db = createMemoryDb();
    const input = { ...splitInput(samples().slice(0, 2)), createHiddenAcceptance: false };
    const allocation = stratifyTeacherAiGradingLabSamples(input);
    const split = await createTeacherAiGradingLabSplit({ db, ...input });

    expect(allocation).toMatchObject({ sampleCount: 2, tuningCount: 2, hiddenCount: 0 });
    expect(allocation.members.every((member) => member.partition === 'TUNING')).toBe(true);
    expect(split.hiddenState).toBeNull();
    expect(split.preflight).toBe(true);
    expect(db.acceptances).toHaveLength(0);
  });

  it('freezes member inserts only after hidden acceptance is established', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'prisma/migrations/20260727143000_add_teacher_ai_grading_split_hidden_acceptance/migration.sql',
    ), 'utf8');

    expect(migration).toContain('CREATE TRIGGER "TeacherAiGradingLabSplitMember_freeze_after_acceptance"');
    expect(migration).toContain('BEFORE INSERT ON "TeacherAiGradingLabSplitMember"');
    expect(migration).toContain('FROM "TeacherAiGradingHiddenAcceptance"');
    expect(migration).toContain('WHERE "splitId" = NEW."splitId"');
    expect(migration).toContain('RETURN NEW;');
  });

  it('permits only the exact two-sample preflight split without hidden members', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'prisma/migrations/20260812115000_add_teacher_ai_grading_preflight_split/migration.sql',
    ), 'utf8');

    expect(migration).toContain('ADD COLUMN "preflight" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"preflight" = false');
    expect(migration).toContain('"hiddenCount" > 0');
    expect(migration).toContain('"preflight" = true');
    expect(migration).toContain('"sampleCount" = 2');
    expect(migration).toContain('"tuningCount" = 2');
    expect(migration).toContain('"hiddenCount" = 0');
  });
});
