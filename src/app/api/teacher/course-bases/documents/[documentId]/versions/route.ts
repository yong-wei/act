import { NextResponse } from 'next/server';
import { z } from 'zod';

import { courseBasisErrorResponse, importCourseBasisVersion, requireCourseBasisActor } from '@/lib/course-basis';
import { normalizedUploadMimeType } from '@/lib/course-basis-upload';
import { prisma } from '@/lib/prisma';

const textSchema = z.object({
  sourceType: z.enum(['MARKDOWN', 'PLAIN_TEXT', 'PASTED_TEXT']),
  sourceName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  content: z.string(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { documentId } = await context.params;
    const contentType = request.headers.get('content-type') ?? '';
    const contentLengthHeader = request.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
    if (contentLength === null || !Number.isSafeInteger(contentLength) || contentLength < 0) {
      return NextResponse.json({ error: 'content-length-required' }, { status: 411 });
    }
    const transportLimit = contentType.includes('multipart/form-data')
      ? 10 * 1024 * 1024 + 64 * 1024
      : 64 * 1024 * 1024;
    if (contentLength > transportLimit) {
      return NextResponse.json({ error: 'source-too-large' }, { status: 413 });
    }
    let source;
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'file-required' }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'source-too-large' }, { status: 413 });
      const lowerName = file.name.toLowerCase();
      const sourceType = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
        ? 'SEARCHABLE_PDF' as const
        : file.type.includes('markdown') || lowerName.endsWith('.md') || lowerName.endsWith('.markdown')
          ? 'MARKDOWN' as const
          : 'PLAIN_TEXT' as const;
      source = {
        sourceType,
        sourceName: file.name,
        mimeType: normalizedUploadMimeType(file.type, sourceType),
        content: new Uint8Array(await file.arrayBuffer()),
      };
    } else {
      source = textSchema.parse(await request.json());
    }
    const version = await importCourseBasisVersion(prisma, { actor: auth.actor, documentId, source });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return courseBasisErrorResponse(error);
  }
}
