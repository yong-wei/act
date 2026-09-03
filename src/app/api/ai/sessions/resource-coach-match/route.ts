import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { canonicalizeTextbookCoachIdentity } from '@/lib/textbook-resource-coach/identity';
import { isExactResourceCoachMatch } from '@/lib/textbook-resource-coach/conversation-match';
import { loadTextbookCoachContext } from '@/lib/textbook-resource-coach/loader';

export const dynamic = 'force-dynamic';

const MATCH_CANDIDATE_LIMIT = 50;

interface BindingProjectionRow {
  id: string;
  title: string;
  lastActivityAt: Date;
  binding: unknown;
}

/**
 * 资源辅导会话匹配：以服务端持久化并重新验证的完整资源身份，
 * 在当前用户的会话库中查找精确匹配的既有会话。
 * 客户端 sessionStorage 不作为恢复真源。
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const declared = Object.fromEntries(new URL(request.url).searchParams.entries());
    const identity = canonicalizeTextbookCoachIdentity(declared);
    if (!identity) {
      return NextResponse.json({ error: 'Invalid resource-coach identity' }, { status: 400 });
    }

    // 重新授权并验证钉住版本当前仍可读；不可读时显式报告而不是伪装成新会话
    const loaded = await loadTextbookCoachContext({
      actorUserId: session.user.id,
      declared,
    });
    if (loaded.status !== 'ready') {
      return NextResponse.json({ status: 'unavailable', reason: loaded.reason });
    }

    const now = new Date();
    // 先在数据库侧按完整 pinned 绑定过滤，再对命中集限界；
    // 候选截断只影响同一身份的并列匹配（取最近者），不会漏掉历史匹配
    const candidates = await prisma.$queryRaw<BindingProjectionRow[]>`
      SELECT s.id, s.title, s."lastActivityAt",
        (
          SELECT entry.message -> 'metadata' -> 'konlingAssistantBindingEvent'
          FROM jsonb_array_elements(s.messages) WITH ORDINALITY AS entry(message, position)
          WHERE entry.message -> 'metadata' ? 'konlingAssistantBindingEvent'
          ORDER BY position DESC
          LIMIT 1
        ) AS binding
      FROM "KonlingSession" s
      WHERE s."userId" = ${session.user.id}
        AND s."libraryVisible" = true
        AND (s."expiresAt" IS NULL OR s."expiresAt" > ${now})
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(s.messages) AS bound(message)
          WHERE bound.message -> 'metadata' -> 'konlingAssistantBindingEvent' ->> 'teachingAssistantModeId' = 'resource-coach'
            AND bound.message -> 'metadata' -> 'konlingAssistantBindingEvent' -> 'pinnedTextbookResourceIdentity' ->> 'unitId' = ${identity.unitId}
            AND bound.message -> 'metadata' -> 'konlingAssistantBindingEvent' -> 'pinnedTextbookResourceIdentity' ->> 'sourceRevision' = ${identity.sourceRevision}
            AND bound.message -> 'metadata' -> 'konlingAssistantBindingEvent' -> 'pinnedTextbookResourceIdentity' ->> 'contentHash' = ${identity.contentHash}
            AND COALESCE(bound.message -> 'metadata' -> 'konlingAssistantBindingEvent' -> 'pinnedTextbookResourceIdentity' ->> 'anchorId', '') = ${identity.anchorId ?? ''}
        )
      ORDER BY s."lastActivityAt" DESC
      LIMIT ${MATCH_CANDIDATE_LIMIT}
    `;
    const match = candidates.find((candidate) => isExactResourceCoachMatch(candidate.binding, identity));
    if (!match) {
      return NextResponse.json({ status: 'blank' });
    }
    return NextResponse.json({
      status: 'matched',
      conversation: {
        id: match.id,
        title: match.title,
        lastActivityAt: match.lastActivityAt,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in GET /api/ai/sessions/resource-coach-match:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
