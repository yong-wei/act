import { FormalResourceError, projectionDigest } from './hash';
import type { FormalQualificationReceipt } from './contracts';
import {
  assertQualified,
  frozenAlignmentStarts,
  frozenAsrParagraphs,
  frozenSegmentationParagraphIds,
} from './qualify';

export function resolveIntroTranscript(input: {
  mediaHash: string;
  scriptId: string;
  scriptHash: string;
  designSourceHash: string;
  verifiedMediaHash: string;
  asrOutput?: string;
}): { authority: 'production-script'; scriptId: string; scriptHash: string } {
  if (input.mediaHash !== input.verifiedMediaHash) {
    throw new FormalResourceError('source-drift', 'intro-video script is not verified against the final media hash');
  }
  if (!input.scriptId || !input.scriptHash || !input.designSourceHash) {
    throw new FormalResourceError('missing-script', 'intro-video requires production script and design source');
  }
  if (input.asrOutput) {
    // ASR may exist, but it cannot replace production script authority.
  }
  return { authority: 'production-script', scriptId: input.scriptId, scriptHash: input.scriptHash };
}

export function resolveCourseMediaTranscript(input: {
  hasProductionScript: boolean;
  asrReceipt: FormalQualificationReceipt;
  segmentationReceipt: FormalQualificationReceipt;
  alignmentReceipt: FormalQualificationReceipt;
  versions: { asr: string; segmentation: string; alignment: string };
  configs: { asr: string; segmentation: string; alignment: string };
}): 'asr' {
  if (input.hasProductionScript) {
    throw new FormalResourceError('script-authority', 'production script remains transcript authority');
  }
  assertQualified(input.asrReceipt, 'asr', input.versions.asr, input.configs.asr);
  assertQualified(input.segmentationReceipt, 'segmentation', input.versions.segmentation, input.configs.segmentation);
  assertQualified(input.alignmentReceipt, 'time-alignment', input.versions.alignment, input.configs.alignment);
  return 'asr';
}

export function assertParagraphsMatchFrozenAsr(input: {
  paragraphs: readonly { paragraphId: string; body: string; startSeconds: number }[];
  asrReceipt: FormalQualificationReceipt;
  segmentationReceipt: FormalQualificationReceipt;
  alignmentReceipt: FormalQualificationReceipt;
  versions: { asr: string; segmentation: string; alignment: string };
  configs: { asr: string; segmentation: string; alignment: string };
}): void {
  resolveCourseMediaTranscript({
    hasProductionScript: false,
    asrReceipt: input.asrReceipt,
    segmentationReceipt: input.segmentationReceipt,
    alignmentReceipt: input.alignmentReceipt,
    versions: input.versions,
    configs: input.configs,
  });
  const expected = frozenAsrParagraphs(input.versions.asr, input.configs.asr);
  const paragraphIds = frozenSegmentationParagraphIds(
    input.versions.segmentation,
    input.configs.segmentation,
  );
  const starts = frozenAlignmentStarts(input.versions.alignment, input.configs.alignment);
  if (
    projectionDigest(paragraphIds) !== projectionDigest(expected.map((row) => row.paragraphId))
    || projectionDigest(starts) !== projectionDigest(expected.map((row) => row.startSeconds))
  ) {
    throw new FormalResourceError(
      'pipeline-unqualified',
      'frozen ASR, segmentation, and time-alignment outputs are not aligned',
    );
  }
  const actual = input.paragraphs.map((row) => ({
    paragraphId: row.paragraphId,
    body: row.body,
    startSeconds: row.startSeconds,
  }));
  if (projectionDigest(actual) !== projectionDigest(expected)) {
    throw new FormalResourceError(
      'pipeline-unqualified',
      'media paragraphs drifted from the frozen ASR paragraph tuples',
    );
  }
}
