import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FrontendLogPayload = {
  type?: string;
  content?: string;
  context?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const body = (await request.json().catch(() => null)) as FrontendLogPayload | null;

    if (!body || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid log payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = {
      ts: new Date().toISOString(),
      userId: session?.user?.id ?? null,
      type: body.type ?? 'frontend',
      content: body.content,
      context: body.context ?? null,
    };

    const logDir = path.join(process.cwd(), '.logs');
    await mkdir(logDir, { recursive: true });
    await appendFile(path.join(logDir, 'frontend.log'), `${JSON.stringify(entry)}\n`, 'utf8');

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
