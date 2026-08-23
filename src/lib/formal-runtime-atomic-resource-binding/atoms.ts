import {
  FORMAL_RESOURCE_ATOM_CONTRACT,
  MEDIA_TIME_RULE_VERSION,
  type FormalQualificationReceipt,
  type FormalResourceAtom,
  type FormalResourceCandidate,
} from './contracts';
import { FormalResourceError, atomId, projectionDigest } from './hash';
import { assertParagraphsMatchFrozenAsr } from './media-pipelines';

export function deriveMediaEnds(input: {
  starts: readonly number[];
  durationSeconds: number;
}): number[] {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new FormalResourceError('invalid-timing', 'media duration must be a positive finite number');
  }
  const starts = [...input.starts];
  if (starts.length === 0) {
    throw new FormalResourceError('invalid-timing', 'media resource has no paragraph starts');
  }
  const seen = new Set<number>();
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (!Number.isFinite(start) || start < 0 || start >= input.durationSeconds) {
      throw new FormalResourceError('invalid-timing', `paragraph start out of range: ${start}`);
    }
    if (seen.has(start)) {
      throw new FormalResourceError('invalid-timing', `duplicate paragraph start: ${start}`);
    }
    seen.add(start);
    if (index > 0 && start <= starts[index - 1]) {
      throw new FormalResourceError('invalid-timing', 'paragraph starts must be strictly increasing');
    }
  }
  return starts.map((start, index) => (
    index + 1 < starts.length ? starts[index + 1] : input.durationSeconds
  ));
}

export function assertAtomIntegrity(atom: FormalResourceAtom): void {
  if (atom.contract !== FORMAL_RESOURCE_ATOM_CONTRACT) {
    throw new FormalResourceError('identity-drift', 'atom contract is not the formal atom contract');
  }
  const stableKey = atom.anchor.paragraphId ?? atom.anchor.questionId;
  if (!stableKey) {
    throw new FormalResourceError('identity-drift', 'atom is missing a stable paragraph or question key');
  }
  const expected = atomId({
    resourceId: atom.resourceId,
    kind: atom.anchor.kind,
    stableKey,
    contentSha256: atom.contentSha256,
  });
  if (atom.atomId !== expected) {
    throw new FormalResourceError('identity-drift', 'atomId does not match resource/kind/stable key/content');
  }
}

export function buildMediaAtoms(input: {
  resource: FormalResourceCandidate;
  scriptId: string;
  scriptHash: string;
  durationSeconds: number;
  paragraphs: readonly { paragraphId: string; body: string; startSeconds: number }[];
  asr?: {
    asrReceipt: FormalQualificationReceipt;
    segmentationReceipt: FormalQualificationReceipt;
    alignmentReceipt: FormalQualificationReceipt;
    versions: { asr: string; segmentation: string; alignment: string };
    configs: { asr: string; segmentation: string; alignment: string };
  };
}): FormalResourceAtom[] {
  if (input.asr) {
    assertParagraphsMatchFrozenAsr({
      paragraphs: input.paragraphs,
      asrReceipt: input.asr.asrReceipt,
      segmentationReceipt: input.asr.segmentationReceipt,
      alignmentReceipt: input.asr.alignmentReceipt,
      versions: input.asr.versions,
      configs: input.asr.configs,
    });
  }
  const ends = deriveMediaEnds({
    starts: input.paragraphs.map((row) => row.startSeconds),
    durationSeconds: input.durationSeconds,
  });
  return input.paragraphs.map((row, index) => {
    const contentSha256 = projectionDigest({
      body: row.body,
      paragraphId: row.paragraphId,
      scriptId: input.scriptId,
      scriptHash: input.scriptHash,
      rule: MEDIA_TIME_RULE_VERSION,
    });
    return {
      contract: FORMAL_RESOURCE_ATOM_CONTRACT,
      atomId: atomId({
        resourceId: input.resource.resourceId,
        kind: 'media-paragraph',
        stableKey: row.paragraphId,
        contentSha256,
      }),
      resourceId: input.resource.resourceId,
      subtype: input.resource.subtype,
      contentSha256,
      source: input.resource.source,
      courseScopeId: input.resource.courseScopeId,
      anchor: {
        kind: 'media-paragraph',
        startSeconds: row.startSeconds,
        endSeconds: ends[index],
        durationSeconds: input.durationSeconds,
        paragraphId: row.paragraphId,
      },
      disposition: 'UNRESOLVED',
      evidenceRefs: [`script:${input.scriptId}`],
    };
  });
}

export function buildTextAtoms(input: {
  resource: FormalResourceCandidate;
  paragraphs: readonly { paragraphId: string; body: string }[];
}): FormalResourceAtom[] {
  return input.paragraphs.map((row) => {
    const contentSha256 = projectionDigest({ paragraphId: row.paragraphId, body: row.body });
    return {
      contract: FORMAL_RESOURCE_ATOM_CONTRACT,
      atomId: atomId({
        resourceId: input.resource.resourceId,
        kind: 'text-paragraph',
        stableKey: row.paragraphId,
        contentSha256,
      }),
      resourceId: input.resource.resourceId,
      subtype: input.resource.subtype,
      contentSha256,
      source: input.resource.source,
      courseScopeId: input.resource.courseScopeId,
      anchor: { kind: 'text-paragraph', paragraphId: row.paragraphId },
      disposition: 'UNRESOLVED',
      evidenceRefs: [`text:${row.paragraphId}`],
    };
  });
}

export function buildQuestionAtom(input: {
  resource: FormalResourceCandidate;
  questionId: string;
  stem: string;
  options: readonly string[];
  answer: string;
  explanation: string;
}): FormalResourceAtom {
  const contentSha256 = projectionDigest({
    questionId: input.questionId,
    stem: input.stem,
    options: [...input.options],
    answer: input.answer,
    explanation: input.explanation,
  });
  return {
    contract: FORMAL_RESOURCE_ATOM_CONTRACT,
    atomId: atomId({
      resourceId: input.resource.resourceId,
      kind: 'question-item',
      stableKey: input.questionId,
      contentSha256,
    }),
    resourceId: input.resource.resourceId,
    subtype: input.resource.subtype,
    contentSha256,
    source: input.resource.source,
    courseScopeId: input.resource.courseScopeId,
    anchor: { kind: 'question-item', questionId: input.questionId },
    disposition: 'UNRESOLVED',
    evidenceRefs: [`question:${input.questionId}`],
  };
}

export function retainUnchangedTextAtoms(
  previous: readonly FormalResourceAtom[],
  next: readonly FormalResourceAtom[],
): FormalResourceAtom[] {
  const prior = new Map(previous.map((row) => [row.anchor.paragraphId, row]));
  return next.map((row) => {
    const matched = prior.get(row.anchor.paragraphId);
    if (matched && matched.contentSha256 === row.contentSha256) {
      return matched;
    }
    return { ...row, disposition: 'UNRESOLVED' };
  });
}
