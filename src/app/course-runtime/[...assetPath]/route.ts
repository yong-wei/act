import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

import { NextResponse } from 'next/server';

const RUNTIME_ROOT = join(process.cwd(), 'course-content', 'runtime');

const CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mdx': 'text/markdown; charset=utf-8',
};

export async function GET(
  _request: Request,
  { params }: { params: { assetPath: string[] } },
) {
  const segments = params.assetPath ?? [];
  if (!segments.length) {
    return NextResponse.json({ error: 'Missing asset path' }, { status: 400 });
  }

  const relativePath = normalize(segments.join('/')).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolutePath = join(RUNTIME_ROOT, relativePath);

  if (!absolutePath.startsWith(RUNTIME_ROOT)) {
    return NextResponse.json({ error: 'Invalid asset path' }, { status: 400 });
  }

  try {
    const buffer = await readFile(absolutePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': CONTENT_TYPES[extname(absolutePath).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
