import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';
import { buildAdminModelProviderRuntimeStates } from '@/lib/ai/model-provider-compatibility';
import {
  getAIProviderSettings,
  normalizeAIProviderSettings,
  setAIProviderSettings,
  validateAIProviderSettings,
  validateAIProviderSettingsInput,
} from '@/lib/ai/provider-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getAIProviderSettings();
  return NextResponse.json({
    ...settings,
    runtimeStates: buildAdminModelProviderRuntimeStates(settings),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const inputIssues = validateAIProviderSettingsInput(payload);
  if (inputIssues.length > 0) {
    return NextResponse.json(
      { error: 'Invalid AI provider settings', issues: inputIssues },
      { status: 400 }
    );
  }
  const settings = normalizeAIProviderSettings(payload);
  const issues = validateAIProviderSettings(settings);
  if (issues.length > 0) {
    return NextResponse.json(
      { error: 'Invalid AI provider settings', issues },
      { status: 400 }
    );
  }
  const saved = await setAIProviderSettings(settings);
  return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
}
