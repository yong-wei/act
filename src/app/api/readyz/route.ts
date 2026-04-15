import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const timestamp = new Date().toISOString();

  let db = false;
  let redis = false;

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    db = true;
  } catch (error) {
    console.error('[readyz] database probe failed', error);
  }

  try {
    const client = redisClient.getClient();
    if (client) {
      redis = (await client.ping()) === 'PONG';
    }
  } catch (error) {
    console.error('[readyz] redis probe failed', error);
  }

  const payload = {
    app: true,
    db,
    redis,
    timestamp,
    version: process.env.npm_package_version ?? 'unknown',
  };

  return NextResponse.json(payload, {
    status: db && redis ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
