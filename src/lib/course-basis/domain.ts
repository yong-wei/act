export type CourseBasisActor = {
  id: string;
  role: 'TEACHER' | 'ADMIN';
};

export type CourseBasisSource = {
  sourceType: 'MARKDOWN' | 'PLAIN_TEXT' | 'PASTED_TEXT' | 'SEARCHABLE_PDF';
  sourceName: string;
  mimeType: string;
  content: Uint8Array | string;
};

export type ExtractedCourseBasisSegment = {
  orderIndex: number;
  stableAnchor: string;
  headingPath: string[];
  pageNumber: number | null;
  paragraphNumber: number;
  text: string;
  contentHash: string;
};

export class CourseBasisError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: string[] = [],
  ) {
    super(code);
    this.name = 'CourseBasisError';
  }
}

