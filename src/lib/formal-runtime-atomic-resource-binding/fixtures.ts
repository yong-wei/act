import type { FormalReleaseEntry, FormalResourceCandidate } from './contracts';
import { freezeRef } from './hash';

export const FIXTURE_AUTHORITY = {
  releaseId: 'ctr:release:control-theory-engineering-v0.22',
  snapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
} as const;

export const FIXTURE_SOURCE = {
  kind: 'git-blob' as const,
  gitObjectId: 'a'.repeat(40),
  contentSha256: 'b'.repeat(64),
};

export function fixtureEntries(): FormalReleaseEntry[] {
  return [
    {
      entryId: 'video-1',
      path: 'lessons/1-1/media/intro.mp4',
      source: FIXTURE_SOURCE,
      classification: 'resource',
      subtype: 'video',
    },
    {
      entryId: 'card-1',
      path: 'cards/card-1.md',
      source: { ...FIXTURE_SOURCE, contentSha256: 'c'.repeat(64) },
      classification: 'resource',
      subtype: 'card',
    },
    {
      entryId: 'exercise-1',
      path: 'exercises/q1.json',
      source: { ...FIXTURE_SOURCE, contentSha256: 'd'.repeat(64) },
      classification: 'resource',
      subtype: 'exercise',
    },
    {
      entryId: 'license',
      path: 'LICENSE',
      source: { ...FIXTURE_SOURCE, contentSha256: 'e'.repeat(64) },
      classification: 'non-resource',
    },
  ];
}

export const FIXTURE_MAPPING_GOLD = [
  { id: 'map-bound', expected: 'admit' as const },
  { id: 'map-label', expected: 'exclude' as const },
];
export const FIXTURE_MAPPING_HOLDOUT = [
  { id: 'map-holdout', expected: 'admit' as const },
];

export const FIXTURE_EVIDENCE = [
  freezeRef('evidence:identity-crosswalk', 'governed identity selects ctc:a'),
];

export function asCandidate(partial: FormalResourceCandidate): FormalResourceCandidate {
  return partial;
}
