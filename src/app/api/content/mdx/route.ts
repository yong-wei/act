import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path');

    if (!rawPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const sanitizedPath = rawPath.replace(/^\/+/, '');
    if (!sanitizedPath.endsWith('.mdx')) {
      return NextResponse.json({ error: 'Only MDX files are supported' }, { status: 400 });
    }

    const baseDir = path.resolve(process.cwd(), 'content');
    const resolvedPath = path.resolve(process.cwd(), sanitizedPath);

    if (!resolvedPath.startsWith(baseDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const content = await fs.readFile(resolvedPath, 'utf8');
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Failed to load MDX content:', error);
    return NextResponse.json({ error: 'Failed to load MDX content' }, { status: 500 });
  }
}
