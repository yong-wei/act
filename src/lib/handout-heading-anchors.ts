/**
 * Stable heading ids for runtime handouts.
 *
 * Mirrors `scripts/knowledge/resource-bindings/build_resource_anchors.py::slugify_heading`
 * exactly: the anchored resource binding release refers to handout sections by these ids,
 * so the print page must derive the same id from the same markdown.
 *
 *   headingId = `h<n>-<slug>`  where n is the 1-based ordinal among `##`/`###` headings
 */

export interface HandoutHeadingAnchor {
  headingId: string;
  order: number;
  level: number;
  title: string;
  /** 1-based line number of the heading in the markdown source. */
  line: number;
}

const HEADING_PATTERN = /^(#{2,3})\s+(.+?)\s*$/u;
const CJK_ORDINAL_PREFIX = /^[一二三四五六七八九十]+、\s*/u;
const NUMERIC_PREFIX = /^\d+(\.\d+)*\s*/u;
const SEPARATORS = /[\s:：、，,。.（）()《》「」【】[\]—–\-/]+/gu;

export function slugifyHandoutHeading(title: string): string {
  let text = title.replace(CJK_ORDINAL_PREFIX, '');
  text = text.replace(NUMERIC_PREFIX, '');
  text = text.replace(SEPARATORS, '-').replace(/^-+|-+$/gu, '');
  const clipped = Array.from(text).slice(0, 32).join('');
  return clipped || 'section';
}

export function buildHandoutHeadingAnchors(markdown: string): HandoutHeadingAnchor[] {
  const anchors: HandoutHeadingAnchor[] = [];
  const lines = markdown.split(/\r?\n/u);
  lines.forEach((line, index) => {
    const match = HEADING_PATTERN.exec(line);
    if (!match) return;
    const order = anchors.length + 1;
    const title = match[2].trim();
    anchors.push({
      headingId: `h${order}-${slugifyHandoutHeading(title)}`,
      order,
      level: match[1].length,
      title,
      line: index + 1,
    });
  });
  return anchors;
}

export function handoutHeadingIdByLine(markdown: string): Map<number, string> {
  return new Map(buildHandoutHeadingAnchors(markdown).map((anchor) => [anchor.line, anchor.headingId]));
}
