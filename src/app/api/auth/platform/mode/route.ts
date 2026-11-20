import { NextResponse } from 'next/server';
import { platformOidcConfig } from '@/lib/platform-oidc';

export function GET() {
  return NextResponse.json({ enabled: Boolean(platformOidcConfig()) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
