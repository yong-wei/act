import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';
import { getAIProviderSettings, normalizeAIProviderSettings, setAIProviderSettings } from '@/lib/ai/provider-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getAIProviderSettings();
  return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const settings = normalizeAIProviderSettings(payload);
  const saved = await setAIProviderSettings(settings);
  return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
}
