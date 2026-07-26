'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { TeachingResource } from '@prisma/client';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { ResourceRenderer } from '@/features/lesson-engine/resource-renderer';
import {
  buildAdaptivePathCompletionRequest,
  resolveAdaptivePathLaunchReturnContext,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import { publishAdaptivePathJourneyResponse } from '@/features/adaptive/adaptive-path-journey-control';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import { buildFeedbackTaskContext, buildFeedbackTaskHref } from '@/lib/student-feedback-task-contract';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';
import type { WidgetResult } from '@/resources/widgets/widget-props';
import { selectResourceCompletionHandler } from './completion-boundary';

export default function InteractiveResourcePage() {
  const params = useParams() as { id?: string } | null;
  const searchParams = useSearchParams();
  const resourceId = params?.id;
  const source = searchParams.get('source');
  const categorySlug = searchParams.get('category');
  const pathLaunchContext = resolveAdaptivePathLaunchReturnContext(searchParams);
  const localFeedbackContext = buildFeedbackTaskContext({
    assignment: searchParams.get('assignment'),
    criterion: searchParams.get('criterion'),
    source,
    feedbackSource: searchParams.get('feedbackSource'),
    status: searchParams.get('status'),
    action: searchParams.get('action'),
    returnTo: searchParams.get('returnTo'),
    intent: searchParams.get('intent'),
    teacherInterventionId: searchParams.get('teacherInterventionId'),
  });
  const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams);
  const [resource, setResource] = useState<TeachingResource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sourceContext = pathLaunchContext
    ? {
        label: '学习路径',
        href: pathLaunchContext.returnHref,
        family: 'adaptive-path-execution',
      }
    : source === 'cross-domain-exploration'
    ? {
        label: '跨域探索',
        href: '/interactive-learning/cross-domain-exploration',
        family: 'interactive-learning-cross-domain',
      }
    : source === 'chapter-components' && categorySlug
      ? {
          label: '章节组件',
          href: `/interactive-learning/chapter-components/${categorySlug}`,
          family: 'interactive-learning-chapter-components',
        }
      : {
          label: '互动学习',
          href: '/interactive-learning',
          family: 'interactive-learning',
      };
  const resourceErrorState = error
    ? buildPlatformRecoveryState({
        kind: 'missing-object',
        sourceRoute: '/interactive-learning/resources/[id]',
        targetLabel: '互动资源',
        displayReference: resourceId ?? null,
        message: error,
        recoveryAction: `返回${sourceContext.label}并重新选择资源`,
      })
    : null;

  useEffect(() => {
    if (!resourceId) return;

    const fetchResource = async () => {
      try {
        const res = await fetch(`/api/resources/${resourceId}`);
        if (!res.ok) {
          setError('资源不存在或无法访问');
          return;
        }
        const data = (await res.json()) as TeachingResource;
        setResource(data);
      } catch (err) {
        console.error('Failed to load resource', err);
        setError('资源加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResource();
  }, [resourceId]);

  const completePathResource = async (result?: WidgetResult) => {
    if (!pathLaunchContext && feedbackContext) {
      window.location.assign(buildFeedbackTaskHref(feedbackContext.returnHref, feedbackContext, {
        status: 'completed',
      }));
      return;
    }
    if (!pathLaunchContext) return;
    const request = buildAdaptivePathCompletionRequest({
      launchContext: pathLaunchContext,
      completedAt: new Date().toISOString(),
      completionResult: result && typeof result === 'object' ? result as unknown as Record<string, unknown> : undefined,
    });
    if (!request) return;

    const response = await fetch(request.href, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) {
      throw new Error(`Path resource completion rejected with status ${response.status}`);
    }
    publishAdaptivePathJourneyResponse(await response.json().catch(() => null));
  };

  const handlePathResourceComplete = async (result?: WidgetResult) => {
    try {
      await completePathResource(result);
    } catch (completionError) {
      console.error('Failed to write path resource completion', completionError);
    }
  };

  const resourceCompletionHandler = selectResourceCompletionHandler(
    resourceId,
    completePathResource,
    handlePathResourceComplete,
  );

  return (
    <InteractiveLearningShell
      activeHref={resourceId ? `/interactive-learning/resources/${resourceId}` : '/interactive-learning/resources/[id]'}
      title={resource?.title || '互动资源'}
      subtitle="Interactive resource workspace"
      breadcrumbs={[
        { label: '互动学习', href: '/interactive-learning' },
        { label: sourceContext.label, href: sourceContext.href },
        { label: resource?.title || '互动资源' },
      ]}
      actions={(
        <Link
          href={sourceContext.href}
          className="inline-flex items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-sm text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回{sourceContext.label}
        </Link>
      )}
    >
      <section
        className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[1440px] flex-col px-4 py-6"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/resources/[id]"
        data-route-family={sourceContext.family}
        data-route-source={sourceContext.href}
      >
        <StudentFeedbackTaskPanel context={feedbackContext} surface="resource" className="mb-4" />
        <div className="h-[calc(100vh-12rem)] min-h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-platform-border bg-platform-surface">
        {isLoading ? (
          <div className="flex h-full min-h-[20rem] items-center justify-center text-platform-fg-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-3">正在加载资源...</span>
          </div>
        ) : resourceErrorState ? (
          <div className="flex h-full min-h-[20rem] items-center justify-center p-6">
            <ActionStatusPanel
              state={resourceErrorState}
              action={(
                <Link
                  href={sourceContext.href}
                  className="inline-flex items-center rounded-md border border-platform-border px-3 py-2 text-xs text-platform-fg-secondary hover:text-platform-action-primary"
                >
                  返回{sourceContext.label}
                </Link>
              )}
            />
          </div>
        ) : resource ? (
          <ResourceRenderer resource={resource} onComplete={resourceCompletionHandler} />
        ) : (
          <div className="flex h-full min-h-[20rem] items-center justify-center text-platform-fg-secondary">
            资源未加载
          </div>
        )}
        </div>
      </section>
    </InteractiveLearningShell>
  );
}
