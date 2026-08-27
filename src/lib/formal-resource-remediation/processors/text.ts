/**
 * Handout, lecture, Knowledge Card, and infograph processors
 * (#1515, tasks 5.3–5.8).
 *
 * Authoring Markdown is semantic truth; exported PDFs are launch derivatives
 * bound to the Markdown and page/paragraph locators. Cards segment governed
 * semantic sections while preserving Canonical-keyed identity from the
 * frontmatter. Infographs bind the accepted image hash together with its
 * governed description/caption atom and launch target. Every processor
 * emits real semantic-paragraph atoms with stable identities — filenames,
 * retrieval windows, review rows, and whole-file fallbacks are rejected.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  type RemediationAtomDisposition,
} from '../contracts';
import { parseFrontmatterRecord, segmentMarkdown, type SemanticParagraph } from './markdown';

export interface TextAtom {
  readonly atomId: string;
  readonly resourceId: string;
  readonly subtype: 'handout' | 'lecture' | 'card' | 'infograph';
  readonly paragraphId: string;
  readonly headingPath: readonly string[];
  readonly contentSha256: string;
  readonly canonicalKey: string | null;
  readonly disposition: RemediationAtomDisposition;
  readonly nonTeachingEvidenceRefs: readonly string[];
  readonly launchDescriptor: {
    readonly kind: 'markdown-paragraph' | 'card-section' | 'image-anchor';
    readonly paragraphId: string;
    readonly derivedPdfPath?: string;
  };
}

export interface HandoutProcessInput {
  readonly resourceId: string;
  readonly subtype: 'handout' | 'lecture';
  readonly markdown: string;
  readonly sourceContentSha256: string;
  readonly derivedPdfRelativePath: string | null;
}

const NON_TEACHING_HEADING_PATTERN = /封面|目录|版权|参考文献|致谢|封面漫画/u;

/** Process one handout/lecture resource from its authoring Markdown truth. */
export function processHandout(input: HandoutProcessInput): {
  atoms: readonly TextAtom[];
  segmentationHash: string;
} {
  const { segmentation } = segmentMarkdown(input.markdown, { resourceId: input.resourceId });
  const atoms = segmentation.sections.flatMap((section) =>
    section.paragraphs.map((paragraph) => emitAtom(input, paragraph, {
      kind: 'markdown-paragraph',
      paragraphId: paragraph.paragraphId,
      ...(input.derivedPdfRelativePath
        ? { derivedPdfPath: input.derivedPdfRelativePath }
        : {}),
    })),
  );
  if (atoms.length === 0) {
    throw new FormalResourceRemediationError(
      'processor-failure',
      `Handout ${input.resourceId} produced zero semantic paragraphs; a whole-file fallback is not a formal atom.`,
    );
  }
  return { atoms, segmentationHash: segmentation.segmentationHash };
}

export interface CardProcessInput {
  readonly resourceId: string;
  readonly markdown: string;
  readonly sourceContentSha256: string;
}

/** Process one Knowledge Card over governed Canonical-keyed sections. */
export function processCard(input: CardProcessInput): {
  atoms: readonly TextAtom[];
  canonicalKey: string | null;
  segmentationHash: string;
} {
  const { segmentation, frontmatter } = segmentMarkdown(input.markdown, { resourceId: input.resourceId });
  const record = parseFrontmatterRecord(frontmatter);
  const canonicalKey = record.node_id ?? null;
  if (!canonicalKey) {
    throw new FormalResourceRemediationError(
      'ambiguous-mapping',
      `Card ${input.resourceId} has no frontmatter node_id; its Canonical-keyed identity is mandatory.`,
    );
  }
  const atoms = segmentation.sections.flatMap((section) =>
    section.paragraphs.map((paragraph) => emitAtom(
      { ...input, subtype: 'card' },
      paragraph,
      { kind: 'card-section', paragraphId: paragraph.paragraphId },
      canonicalKey,
    )),
  );
  if (atoms.length === 0) {
    throw new FormalResourceRemediationError(
      'processor-failure',
      `Card ${input.resourceId} produced zero semantic sections.`,
    );
  }
  return { atoms, canonicalKey, segmentationHash: segmentation.segmentationHash };
}

export interface InfographProcessInput {
  readonly resourceId: string;
  readonly imageContentSha256: string;
  readonly descriptionMarkdown: string;
  readonly caption: string;
  readonly launchRelativePath: string;
}

/** Process one accepted infograph: image hash + governed caption/description atom. */
export function processInfograph(input: InfographProcessInput): {
  atoms: readonly TextAtom[];
} {
  if (!/^[a-f0-9]{64}$/u.test(input.imageContentSha256)) {
    throw new FormalResourceRemediationError(
      'hash-drift',
      `Infograph ${input.resourceId} lacks an accepted image hash.`,
    );
  }
  const captionSha = projectionDigest(input.caption);
  const captionParagraph: SemanticParagraph = {
    paragraphId: `p-${projectionDigest({ resourceId: input.resourceId, headingPath: ['caption'], contentSha256: captionSha }).slice(0, 24)}`,
    headingPath: ['caption'],
    text: input.caption,
    contentSha256: captionSha,
  };
  const { segmentation } = segmentMarkdown(input.descriptionMarkdown, { resourceId: input.resourceId });
  const descriptionAtoms = segmentation.sections.flatMap((section) =>
    section.paragraphs.map((paragraph) => emitAtom(
      { resourceId: input.resourceId, subtype: 'infograph', sourceContentSha256: input.imageContentSha256 },
      paragraph,
      { kind: 'image-anchor', paragraphId: paragraph.paragraphId },
    )),
  );
  const captionAtom = emitAtom(
    { resourceId: input.resourceId, subtype: 'infograph', sourceContentSha256: input.imageContentSha256 },
    captionParagraph,
    { kind: 'image-anchor', paragraphId: captionParagraph.paragraphId },
  );
  const atoms = [captionAtom, ...descriptionAtoms];
  if (atoms.length === 0) {
    throw new FormalResourceRemediationError(
      'processor-failure',
      `Infograph ${input.resourceId} produced zero governed semantics.`,
    );
  }
  return { atoms };
}

function emitAtom(
  input: { resourceId: string; subtype: TextAtom['subtype']; sourceContentSha256: string },
  paragraph: SemanticParagraph,
  launchDescriptor: TextAtom['launchDescriptor'],
  canonicalKey: string | null = null,
): TextAtom {
  const isNonTeaching = NON_TEACHING_HEADING_PATTERN.test(paragraph.headingPath.join(' / '));
  const atomId = `atom-${projectionDigest({
    resourceId: input.resourceId,
    kind: input.subtype,
    stableKey: paragraph.paragraphId,
    contentSha256: paragraph.contentSha256,
  }).slice(0, 24)}`;
  return {
    atomId,
    resourceId: input.resourceId,
    subtype: input.subtype,
    paragraphId: paragraph.paragraphId,
    headingPath: paragraph.headingPath,
    contentSha256: paragraph.contentSha256,
    canonicalKey,
    disposition: isNonTeaching ? 'NON_TEACHING' : 'BOUND',
    nonTeachingEvidenceRefs: isNonTeaching
      ? [`heading-pattern:${NON_TEACHING_HEADING_PATTERN.source}`]
      : [],
    launchDescriptor,
  };
}
