/**
 * Student Recommendations API
 *
 * Returns personalized learning recommendations for the current student.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import {
  PersonalizationPolicyScopeError,
  recommendLearning,
  type RecommendationRationale,
  type RecommendationType,
} from '@/features/personalization/recommendations/public-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export interface RecommendationsResponse {
  recommendations: Array<{
    id: string;
    type: RecommendationType;
    title: string;
    description: string;
    reason: string;
    actionUrl: string;
    actionLabel: string;
    priority: number;
    estimatedTime?: string;
    tags: string[];
    rationale: RecommendationRationale;
  }>;
  total: number;
  byType: Record<RecommendationType, number>;
  generatedAt: string;
  policyRevision: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const typeFilter = searchParams.get('type') as RecommendationType | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    // Generate recommendations
    const { recommendations: allRecommendations, policyRevision } = await recommendLearning({
      actorUserId: userId,
      subjectUserId: userId,
      role: session.user.role,
    });

    // Filter by type if specified
    let filteredRecommendations = allRecommendations;
    if (typeFilter) {
      filteredRecommendations = allRecommendations.filter(r => r.type === typeFilter);
    }

    // Calculate pagination
    const total = filteredRecommendations.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRecommendations = filteredRecommendations.slice(startIndex, endIndex);

    // Count by type
    const byType = {
      immediate: allRecommendations.filter(r => r.type === 'immediate').length,
      weekly: allRecommendations.filter(r => r.type === 'weekly').length,
      challenge: allRecommendations.filter(r => r.type === 'challenge').length,
    };

    const response: RecommendationsResponse = {
      recommendations: paginatedRecommendations.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        reason: r.reason,
        actionUrl: r.actionUrl,
        actionLabel: r.actionLabel,
        priority: r.priority,
        estimatedTime: r.estimatedTime,
        tags: r.tags,
        rationale: r.rationale,
      })),
      total,
      byType,
      generatedAt: new Date().toISOString(),
      policyRevision,
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof PersonalizationPolicyScopeError) {
      return NextResponse.json({ error: '未授权' }, { status: 403 });
    }
    console.error('[RecommendationsAPI] Error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
