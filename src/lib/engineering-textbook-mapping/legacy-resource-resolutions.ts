import { TEXTBOOK_ID_ALIASES } from './aliases';

interface Resolution {
  sourceDocumentId: string;
  structuralPath: readonly string[];
  title: string;
}

const dorf: Resolution = {
  sourceDocumentId: 'dorf-modern-control-systems-14th',
  structuralPath: ['chapter-chapter-07'],
  title: '根轨迹法（Dorf，第 7 章）',
};
const franklin: Resolution = {
  sourceDocumentId: 'franklin-feedback-control-7th',
  structuralPath: ['chapter-chapter-05', 'section-5.1'],
  title: '基本反馈系统的根轨迹（Franklin，第 5.1 节）',
};
const huConcept: Resolution = {
  sourceDocumentId: 'hu-shousong-auto-control-8th',
  structuralPath: ['chapter-chapter-04', 'chapter-4', 'section-4.1'],
  title: '根轨迹法的基本概念（胡寿松，第 4.1 节）',
};
const huParameter: Resolution = {
  sourceDocumentId: 'hu-shousong-auto-control-8th',
  structuralPath: ['chapter-chapter-04', 'chapter-4', 'section-4.3', 'item-1'],
  title: '参数根轨迹与等效单位反馈（胡寿松，第 4.3 节）',
};

/** Explicit repairs of the eight published v0.12 placeholders; unknown references remain unresolved. */
export const LEGACY_TEXTBOOK_RESOURCE_RESOLUTIONS: Readonly<Record<string, Resolution>> = {
  'act:textbook-chapter:dorf-modern-control-systems-14th:ch-root-locus-01': dorf,
  'act:textbook-section:cts.section-082ff03f08f5ef0cbcdddbde': dorf,
  'act:textbook-chapter:franklin-feedback-control-7th:ch-root-locus-01': franklin,
  'act:textbook-section:cts.section-8922c1151790adeca58b9b6f': franklin,
  'act:textbook-chapter:hu-shousong-auto-control-8th:ch-root-locus-01': huConcept,
  'act:textbook-section:cts.section-23e6c826033a1643c31a4d18': huConcept,
  'act:textbook-chapter:hu-shousong-auto-control-8th:ch-root-locus-02': huParameter,
  'act:textbook-section:cts.section-2c207617c85c277595e1ae1a': huParameter,
};

export function resolveLegacyTextbookResource(resourceId: string) {
  const target = LEGACY_TEXTBOOK_RESOURCE_RESOLUTIONS[resourceId];
  if (!target) return null;
  const alias = TEXTBOOK_ID_ALIASES.find((item) => item.sourceDocumentId === target.sourceDocumentId);
  return alias ? { ...target, bookId: alias.readerBookId, edition: alias.edition } : null;
}
