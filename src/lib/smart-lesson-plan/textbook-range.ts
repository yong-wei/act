import { z } from 'zod';

export const confirmedTextbookRangeSchema = z.object({
  bookId: z.string().trim().min(1).max(100),
  level: z.enum(['BOOK', 'CHAPTER', 'SECTION']),
  unitId: z.string().trim().min(1).max(200).nullable(),
  structuralPath: z.array(z.string().trim().min(1).max(200)).max(20),
}).strict().superRefine((range, context) => {
  if (range.level === 'BOOK' && (range.unitId !== null || range.structuralPath.length > 0)) {
    context.addIssue({ code: 'custom', message: 'book-range-must-not-have-unit' });
  }
  if (range.level !== 'BOOK' && (!range.unitId || range.structuralPath.length === 0)) {
    context.addIssue({ code: 'custom', message: 'structural-range-requires-unit' });
  }
});

export type ConfirmedTextbookRange = z.infer<typeof confirmedTextbookRangeSchema>;
