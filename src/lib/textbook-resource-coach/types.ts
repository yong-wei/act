export const STRUCTURED_TEXTBOOK_UNIT_KIND = 'structured-textbook-unit' as const;

export interface StructuredTextbookUnitIdentity {
  resourceKind: typeof STRUCTURED_TEXTBOOK_UNIT_KIND;
  resourceId: string;
  bookId: string;
  edition: string;
  sourceRevision: string;
  unitId: string;
  contentHash: string;
  anchorId?: string | null;
}

export interface TextbookCoachCitation {
  citationId: string;
  title: string;
  identity: StructuredTextbookUnitIdentity;
}

export interface TextbookCoachContext {
  status: 'ready';
  identity: StructuredTextbookUnitIdentity;
  title: string;
  unitMarkdown: string;
  fragmentMarkdown: string | null;
  selectionHint: string | null;
  citation: TextbookCoachCitation;
  structuralPath: string[];
}
