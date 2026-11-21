import { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/platform-oidc';
import { cancelOidcTransaction, readOidcTransaction, transactionCookieName } from '@/lib/platform-oidc-store';

export async function POST(request: Request, { params }: { params: Promise<{ state: string }> }) {
  try {
    assertSameOrigin(request);
    const { state } = await params;
    const transaction = readOidcTransaction(state, request.headers.get('cookie')?.includes(`${transactionCookieName(state)}=${state}`) ? state : '');
    if (!transaction) return NextResponse.json({ error: 'invalid-transaction' }, { status: 409 });
    cancelOidcTransaction(state);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  }
}
