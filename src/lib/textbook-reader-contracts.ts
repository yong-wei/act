export const TEXTBOOK_COURSE_ID = 'automatic-control';

export interface TextbookCatalogEntry {
  bookId: string;
  edition: string;
  title: string;
  sourceRevision: string;
  structureUnitCount: number;
  fragmentAnchorCount: number;
}

export interface TextbookNavigationNode {
  id: string;
  title: string;
  kind: string;
  naturalNumber: string | null;
  structuralPath: string[];
  href: string;
  children: TextbookNavigationNode[];
}

export interface TextbookReaderLocation {
  id: string;
  title: string;
  href: string;
}

export interface TextbookFragment {
  id: string;
  kind: 'formula' | 'figure' | 'table';
  naturalNumber: string | null;
  ordinal: number;
}

export interface TextbookCitationUnit {
  id: string;
  bookId: string;
  edition: string;
  sourceRevision: string;
  title: string;
  kind: string;
  naturalNumber: string | null;
  structuralPath: string[];
  markdown: string;
  fragments: TextbookFragment[];
}

export interface TextbookReaderProjection {
  book: TextbookCatalogEntry;
  unit: {
    id: string;
    chapterId: string;
    title: string;
    kind: string;
    naturalNumber: string | null;
    structuralPath: string[];
    markdown: string;
    contentHash: string;
  };
  hierarchy: TextbookNavigationNode[];
  breadcrumbs: TextbookReaderLocation[];
  previous: TextbookReaderLocation | null;
  next: TextbookReaderLocation | null;
  fragments: TextbookFragment[];
}
