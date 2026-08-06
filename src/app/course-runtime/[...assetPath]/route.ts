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
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mdx': 'text/markdown; charset=utf-8',
};

function isPrivateRuntimeGovernancePath(relativePath: string) {
  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();
  const textbookAssetPath =
    /^resources\/textbooks\/[a-z0-9][a-z0-9-]{0,95}\/assets\/[^/]+\/[^/]+$/u;
  return normalizedPath === 'resource-governance'
    || normalizedPath.startsWith('resource-governance/')
    || normalizedPath === 'resources/textbooks-v2'
    || normalizedPath.startsWith('resources/textbooks-v2/')
    || normalizedPath === 'resources/textbook-hybrid-retrieval'
    || normalizedPath.startsWith('resources/textbook-hybrid-retrieval/')
    || (
      (
        normalizedPath === 'resources/textbooks'
        || normalizedPath.startsWith('resources/textbooks/')
      )
      && !textbookAssetPath.test(normalizedPath)
    );
}

export async function GET(_request: Request, props: { params: Promise<{ assetPath: string[] }> }) {
  const params = await props.params;
  const segments = params.assetPath ?? [];
  if (!segments.length) {
    return NextResponse.json({ error: 'Missing asset path' }, { status: 400 });
  }

  const relativePath = normalize(segments.join('/'))
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^[\\/]+/, '');
  const absolutePath = join(RUNTIME_ROOT, relativePath);

  if (isPrivateRuntimeGovernancePath(relativePath)) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

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
