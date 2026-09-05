import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  buildTextbookReaderHref,
  loadTextbookCitationUnits,
} from '@/lib/textbook-reader';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

export interface CompanionResourceVerifyResult {
  status: 'available' | 'unavailable';
  reason?: 'not-found' | 'hash-drift' | 'unauthorized';
  href?: string;
  mediaUrl?: string;
  mediaKind?: 'video' | 'audio';
}

function verifyTextbookUnitHref(bookId: string, edition: string, structuralPath: string[]): string {
  return buildTextbookReaderHref({ bookId, edition, unitPath: structuralPath });
}

/** 从复合 unitId（textbook-unit:{bookId}@{edition}/{path}）解析 bookId。 */
function parseTextbookBookId(resourceId: string): string | null {
  if (!resourceId.startsWith('textbook-unit:')) return null;
  const rest = resourceId.slice('textbook-unit:'.length);
  const atIndex = rest.indexOf('@');
  if (atIndex <= 0) return null;
  return rest.slice(0, atIndex);
}

async function verifyTextbookUnit(resourceId: string, versionHash: string): Promise<CompanionResourceVerifyResult> {
  const bookId = parseTextbookBookId(resourceId);
  if (!bookId) return { status: 'unavailable', reason: 'not-found' };
  try {
    const units = await loadTextbookCitationUnits({ requests: [{ bookId, unitIds: [resourceId] }] });
    const unit = units[0];
    if (!unit) return { status: 'unavailable', reason: 'not-found' };
    if (hashTextbookMarkdown(unit.markdown) !== versionHash) {
      return { status: 'unavailable', reason: 'hash-drift' };
    }
    return {
      status: 'available',
      href: verifyTextbookUnitHref(unit.bookId, unit.edition, unit.structuralPath),
    };
  } catch {
    return { status: 'unavailable', reason: 'not-found' };
  }
}

async function verifyInteractiveResource(resourceId: string, versionHash: string): Promise<CompanionResourceVerifyResult> {
  const resource = await prisma.teachingResource.findUnique({
    where: { id: resourceId },
    select: { teacherOnly: true, updatedAt: true, type: true, content: true },
  });
  if (!resource || resource.teacherOnly) {
    return { status: 'unavailable', reason: 'not-found' };
  }
  if (new Date(resource.updatedAt).toISOString() !== versionHash) {
    return { status: 'unavailable', reason: 'hash-drift' };
  }
  const content = resource.content ?? '';
  if (resource.type === 'STATIC_MEDIA' && content) {
    if (content.endsWith('.mp4')) {
      return { status: 'available', mediaUrl: content, mediaKind: 'video' };
    }
    if (AUDIO_EXTENSIONS.some((extension) => content.endsWith(extension))) {
      return { status: 'available', mediaUrl: content, mediaKind: 'audio' };
    }
  }
  return { status: 'available', href: `/interactive-learning/resources/${resourceId}` };
}

/** 会话内资源卡打开/恢复校验：按 resourceId + versionHash 重查权限与版本，失效仅降级对应卡片。 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (process.env.KONLING_COMPANION_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Companion disabled' }, { status: 404 });
    }

    const params = request.nextUrl.searchParams;
    const resourceId = params.get('resourceId')?.slice(0, 256) ?? '';
    const versionHash = params.get('versionHash')?.slice(0, 128) ?? '';
    const kind = params.get('kind') ?? '';
    if (!resourceId || !versionHash) {
      return NextResponse.json({ error: 'Invalid verify request' }, { status: 400 });
    }

    const result = kind === 'textbook-unit'
      ? await verifyTextbookUnit(resourceId, versionHash)
      : await verifyInteractiveResource(resourceId, versionHash);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('companion resource verify failed', error);
    return NextResponse.json({ error: 'Companion resource verify failed' }, { status: 500 });
  }
}
