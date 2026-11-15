import { NextResponse } from 'next/server';

import {
  applyIlabGrantCookie,
  clearIlabGrantCookie,
  readIlabGrantFromRequest,
  toPublicGrantView,
  type IlabGrantPayload,
} from '@/features/ilab/grant-cookie';
import {
  applyIlabNextAuthSessionCookie,
  ensureIlabPlatformUser,
  ensureIlabUserFromGrant,
  type IlabAuthUserSummary,
} from '@/features/ilab/adapters/ilab-account-service';
import { exchangeIlabTicket } from '@/features/ilab/ilab-client';
import { ilabConfig } from '@/features/ilab/session-shared';
import { getServerAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function exchangeGrantAndProvisionUser(ticket: string): Promise<{
  grant: IlabGrantPayload;
  user: IlabAuthUserSummary;
}> {
  const trimmed = ticket.trim();
  if (!trimmed) {
    throw new Error('缺少实验空间身份票据。');
  }
  const config = ilabConfig();
  const token = await exchangeIlabTicket({
    ticket: trimmed,
    appId: config.appId,
    secret: config.secret,
    baseUrl: config.baseUrl,
    devBypass: config.devBypass,
  });
  const effectiveAppId = token.bypass ? 'dev' : config.appId;
  const { user } = await ensureIlabPlatformUser({
    appId: effectiveAppId,
    token,
  });
  return {
    user,
    grant: {
      v: 1,
      appId: effectiveAppId,
      username: token.username,
      displayName: user.name || token.displayName,
      accessToken: token.accessToken,
      issuedAtMs: Date.now(),
      expiresAtMs: token.expiresAtMs,
      bypass: token.bypass,
      userId: user.id,
    },
  };
}

export async function GET(request: Request) {
  const grant = readIlabGrantFromRequest(request);
  if (!grant) {
    return NextResponse.json(toPublicGrantView(null));
  }
  try {
    const [{ user }, session] = await Promise.all([
      ensureIlabUserFromGrant(grant),
      getServerAuthSession().catch(() => null),
    ]);
    const updatedGrant: IlabGrantPayload = grant.userId === user.id ? grant : { ...grant, userId: user.id };
    const response = NextResponse.json({
      ...toPublicGrantView(updatedGrant),
      userId: user.id,
    });
    if (!grant.userId) {
      applyIlabGrantCookie(response, updatedGrant);
    }
    if (!session?.user?.id || session.user.id !== user.id) {
      await applyIlabNextAuthSessionCookie(response, user, request);
    }
    return response;
  } catch {
    return NextResponse.json(toPublicGrantView(grant));
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const { grant, user } = await exchangeGrantAndProvisionUser(ticket);
    const response = NextResponse.json({
      ...toPublicGrantView(grant),
      userId: user.id,
    });
    applyIlabGrantCookie(response, grant);
    await applyIlabNextAuthSessionCookie(response, user, request);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '实验空间票据校验失败。';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json(toPublicGrantView(null));
  return clearIlabGrantCookie(response);
}
