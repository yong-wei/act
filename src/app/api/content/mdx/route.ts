import { NextResponse } from 'next/server';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  isInvalidContentPathError,
  readReadableContentText,
  resolveReadableContentPath,
} from '@/lib/runtime-content-path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path');

    if (!rawPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const resolvedPath = resolveReadableContentPath(rawPath);

    if (!resolvedPath.projectPath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only Markdown files are supported' }, { status: 400 });
    }

    const content = await readReadableContentText(resolvedPath.projectPath);
    return NextResponse.json({ content });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isInvalidContentPathError(error)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    console.error('Failed to load MDX content:', error);
    return NextResponse.json({ error: 'Failed to load MDX content' }, { status: 500 });
  }
}
