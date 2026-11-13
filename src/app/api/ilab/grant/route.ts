import { NextResponse } from 'next/server';

import {
  applyIlabGrantCookie,
  clearIlabGrantCookie,
  readIlabGrantFromRequest,
  toPublicGrantView,
  type IlabGrantPayload,
} from '@/features/ilab/grant-cookie';
import { exchangeIlabTicket } from '@/features/ilab/ilab-client';
import { ilabConfig } from '@/features/ilab/session-shared';

export const dynamic = 'force-dynamic';

async function exchangeGrantFromTicket(ticket: string): Promise<IlabGrantPayload> {
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
  return {
    v: 1,
    appId: token.bypass ? 'dev' : config.appId,
    username: token.username,
    displayName: token.displayName,
    accessToken: token.accessToken,
    issuedAtMs: Date.now(),
    expiresAtMs: token.expiresAtMs,
    bypass: token.bypass,
  };
}

export async function GET(request: Request) {
  const grant = readIlabGrantFromRequest(request);
  return NextResponse.json(toPublicGrantView(grant));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const grant = await exchangeGrantFromTicket(ticket);
    const response = NextResponse.json(toPublicGrantView(grant));
    return applyIlabGrantCookie(response, grant);
  } catch (error) {
    const message = error instanceof Error ? error.message : '实验空间票据校验失败。';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json(toPublicGrantView(null));
  return clearIlabGrantCookie(response);
}
