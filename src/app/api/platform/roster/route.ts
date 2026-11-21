import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function authorized(header: string | null): boolean {
  const expected = process.env.ACT_ROSTER_EXPORT_TOKEN?.trim() ?? '';
  const presented = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!expected || !presented) return false;
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function identityOf(account: {
  providerAccountId: string;
  session_state: string | null;
}, fallbackIssuer: string) {
  const parts = account.providerAccountId.split('|');
  const issuer = parts.length === 2 ? parts[0] : fallbackIssuer;
  const subject = parts.at(-1) ?? '';
  if (!issuer || !subject || !account.session_state) return null;
  return { issuer, subject, personId: account.session_state };
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const requestedLimit = Number(params.get('limit') ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
  const cursor = params.get('cursor')?.trim() || null;
  const users = await prisma.user.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      role: true,
      employeeNumber: true,
      updatedAt: true,
      profile: { select: { studentNumber: true } },
      accounts: {
        where: { provider: 'platform' },
        select: { providerAccountId: true, session_state: true },
      },
    },
  });
  const hasMore = users.length > limit;
  const page = hasMore ? users.slice(0, limit) : users;
  const issuer = process.env.PLATFORM_OIDC_ISSUER?.trim() ?? '';
  const accounts = page.map((user) => {
    const employeeId = user.employeeNumber?.trim() || null;
    const studentId = user.profile?.studentNumber?.trim() || null;
    const identity = user.accounts[0] ? identityOf(user.accounts[0], issuer) : null;
    return {
      localUserId: user.id,
      employeeId,
      studentId,
      identifierType: employeeId ? 'employee_no' : studentId ? 'student_no' : null,
      status: 'active',
      eligible: true,
      roles: [user.role],
      displayName: user.name,
      exception: !employeeId && !studentId ? 'act-only' : null,
      identityLink: identity,
    };
  });
  const adminMappings = page.flatMap((user) => {
    if (user.role !== 'ADMIN' || !user.accounts[0]) return [];
    const identity = identityOf(user.accounts[0], issuer);
    return identity ? [{ personId: identity.personId, appId: 'act', localUserId: user.id }] : [];
  });
  const revision = page.reduce((maximum, user) => Math.max(maximum, user.updatedAt.getTime()), 0);
  return NextResponse.json({
    institution: process.env.ROSTER_INSTITUTION?.trim() || 'just',
    source: 'act',
    batchCursor: cursor ?? 'start',
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    hasMore,
    revision,
    teachers: [],
    students: [],
    apps: { act: { accounts } },
    adminMappings,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
