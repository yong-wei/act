/**
 * Markdown semantic-section segmentation primitives (#1515, tasks 5.3/5.5).
 *
 * Authoring Markdown is semantic truth for handouts, lectures, and cards.
 * Segmentation walks heading-delimited sections and emits stable semantic
 * paragraphs whose identities derive from the heading path and content, so
 * re-running over unchanged bytes reproduces identical paragraph ids.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

export interface SemanticParagraph {
  readonly paragraphId: string;
  readonly headingPath: readonly string[];
  readonly text: string;
  readonly contentSha256: string;
}

export interface SemanticSection {
  readonly sectionId: string;
  readonly headingPath: readonly string[];
  readonly paragraphs: readonly SemanticParagraph[];
}

export interface MarkdownSegmentation {
  readonly sections: readonly SemanticSection[];
  readonly paragraphCount: number;
  readonly segmentationHash: string;
}

const HEADING = /^(#{1,6})\s+(.*)$/u;
const FRONTMATTER_DELIMITER = '---';

/**
 * Segment one Markdown document. Frontmatter (YAML between leading `---`
 * fences) is captured separately and never becomes a semantic paragraph.
 */
export function segmentMarkdown(source: string, options: { resourceId: string }): {
  segmentation: MarkdownSegmentation;
  frontmatter: string | null;
} {
  const lines = source.split('\n');
  let index = 0;
  let frontmatter: string | null = null;
  if (lines[0]?.trim() === FRONTMATTER_DELIMITER) {
    const buffer: string[] = [];
    index = 1;
    while (index < lines.length && lines[index].trim() !== FRONTMATTER_DELIMITER) {
      buffer.push(lines[index]);
      index += 1;
    }
    if (index < lines.length) index += 1;
    frontmatter = buffer.join('\n');
  }
  const sections: SemanticSection[] = [];
  let headingPath: string[] = [];
  let paragraphBuffer: string[] = [];
  const flushParagraph = () => {
    const text = paragraphBuffer.join('\n').trim();
    paragraphBuffer = [];
    if (text.length === 0) return;
    const contentSha256 = projectionDigest(text);
    const paragraphId = `p-${projectionDigest({ resourceId: options.resourceId, headingPath, contentSha256 }).slice(0, 24)}`;
    const section = sections[sections.length - 1];
    const paragraph: SemanticParagraph = { paragraphId, headingPath: [...headingPath], text, contentSha256 };
    if (section) {
      (section.paragraphs as SemanticParagraph[]).push(paragraph);
    } else {
      sections.push({
        sectionId: `s-${projectionDigest({ resourceId: options.resourceId, headingPath: [] }).slice(0, 24)}`,
        headingPath: [],
        paragraphs: [paragraph],
      });
    }
  };
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const title = heading[2].trim();
      headingPath = [...headingPath.slice(0, level - 1), title];
      sections.push({
        sectionId: `s-${projectionDigest({ resourceId: options.resourceId, headingPath }).slice(0, 24)}`,
        headingPath: [...headingPath],
        paragraphs: [],
      });
      continue;
    }
    if (line.trim().length === 0) {
      flushParagraph();
      continue;
    }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  const nonEmpty = sections.filter((section) => section.paragraphs.length > 0);
  const paragraphCount = nonEmpty.reduce((total, section) => total + section.paragraphs.length, 0);
  const segmentationHash = projectionDigest(
    nonEmpty.map((section) => ({
      sectionId: section.sectionId,
      paragraphIds: section.paragraphs.map((paragraph) => paragraph.paragraphId),
    })),
  );
  return {
    segmentation: { sections: nonEmpty, paragraphCount, segmentationHash },
    frontmatter,
  };
}

/** Parse card-style YAML frontmatter into a flat string record (no eval). */
export function parseFrontmatterRecord(frontmatter: string | null): Readonly<Record<string, string>> {
  if (!frontmatter) return {};
  const record: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/u.exec(line);
    if (match) {
      record[match[1]] = match[2].trim();
    }
  }
  return record;
}
