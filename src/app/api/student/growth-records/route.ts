/**
 * Canonical cumulative student growth records API.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { PORTRAIT_V2_DIMENSION_IDS } from '@/lib/data-governance/kaq-objective-taxonomy';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export interface GrowthRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  metadata: Record<string, unknown>;
  icon: string;
}

export interface GrowthRecordsResponse {
  records: GrowthRecord[];
  total: number;
  hasMore: boolean;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = positiveInteger(searchParams.get('page'), 1);
    const limit = Math.min(positiveInteger(searchParams.get('limit'), 20), 50);
    const where = {
      userId: session.user.id,
      invalidations: { none: {} },
    };
    const [records, total] = await Promise.all([
      prisma.growthRecord.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.growthRecord.count({ where }),
    ]);

    const response: GrowthRecordsResponse = {
      records: records.map((record) => ({
        id: record.id,
        type: record.recordType,
        title: record.title,
        description: record.description,
        date: record.occurredAt.toISOString(),
        metadata: publicGrowthMetadata(record.evidenceJson),
        icon: getIconForType(record.recordType),
      })),
      total,
      hasMore: page * limit < total,
    };
    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[GrowthRecordsAPI] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function publicGrowthMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const metadata: Record<string, unknown> = {};
  copyFiniteNumber(value, metadata, 'overallScore');
  copyFiniteNumber(value, metadata, 'confidence');
  copyEnum(value, metadata, 'trend', ['up', 'stable', 'down', 'not-comparable']);
  copyEnum(value, metadata, 'riskType', ['constraint', 'stagnation', 'cross_domain']);
  copyEnum(value, metadata, 'severity', ['low', 'medium', 'high']);
  copyDimensionIds(value, metadata, 'evidencedDimensionIds');
  copyDimensionIds(value, metadata, 'missingDimensionIds');
  return metadata;
}

function copyFiniteNumber(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
) {
  if (typeof source[key] === 'number' && Number.isFinite(source[key])) {
    target[key] = source[key];
  }
}

function copyEnum(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
) {
  if (typeof source[key] === 'string' && allowed.includes(source[key])) {
    target[key] = source[key];
  }
}

function copyDimensionIds(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
) {
  if (!Array.isArray(source[key])) return;
  const allowed = new Set<string>(PORTRAIT_V2_DIMENSION_IDS);
  target[key] = source[key].filter(
    (item): item is string => typeof item === 'string' && allowed.has(item),
  );
}

function positiveInteger(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getIconForType(type: string): string {
  const icons: Record<string, string> = {
    milestone: 'Flag',
    simulation: 'Ship',
    risk_resolved: 'ShieldCheck',
    excellent_design: 'Award',
    achievement: 'Trophy',
    competency_evaluation: 'Sparkles',
    'portrait-state-change': 'LineChart',
    'strength-change': 'TrendingUp',
    'risk-state-change': 'ShieldAlert',
  };
  return icons[type] ?? 'Star';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
