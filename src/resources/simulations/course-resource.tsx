'use client';

import Link from 'next/link';
import { CheckCircle2, ExternalLink, PlayCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { ResourceRendererLaunchContext } from '@/features/lesson-engine/resource-renderer-config';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';
import {
  buildSimulationCourseEvidencePayload,
  buildSimulationCourseLaunchHref,
  getSimulationCourseCompletionEventType,
  getSimulationCourseLaunchEventType,
  requiresPersistedSimulationRun,
  resolveSimulationCourseResourceConfig,
} from './course-resource-config';

interface SimulationCourseResourceProps extends Record<string, unknown> {
  launchContext?: ResourceRendererLaunchContext;
}

function fallbackLaunchContext(props: SimulationCourseResourceProps): ResourceRendererLaunchContext {
  const resourceId = typeof props.resourceId === 'string' ? props.resourceId : 'standalone-simulation-resource';
  const registryId = typeof props.registryId === 'string' ? props.registryId : null;

  return {
    provenance: 'standalone',
    contextState: 'context-limited',
    resourceId,
    registryId,
    sessionId: null,
    lessonItemId: null,
    lessonPlanId: null,
    classId: null,
    stage: null,
  };
}

export function SimulationCourseResource(props: SimulationCourseResourceProps) {
  const interactive = useOptionalInteractiveContext();
  const config = useMemo(() => resolveSimulationCourseResourceConfig(props), [props]);
  const persistedRunRequired = requiresPersistedSimulationRun(config);
  const launchContext = props.launchContext ?? fallbackLaunchContext(props);
  const [completionChannelId, setCompletionChannelId] = useState<string | null>(null);
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);
  useEffect(() => {
    if (config.resourceKind === 'simulation-scene') {
      setCompletionChannelId(crypto.randomUUID());
    }
  }, [config.resourceKind]);
  const href = useMemo(
    () => buildSimulationCourseLaunchHref(config, launchContext, completionChannelId ?? undefined),
    [completionChannelId, config, launchContext],
  );
  const evidencePayload = useMemo(
    () => buildSimulationCourseEvidencePayload(config, launchContext),
    [config, launchContext],
  );
  useEffect(() => {
    if (
      config.resourceKind !== 'simulation-scene'
      || !completionChannelId
      || typeof BroadcastChannel === 'undefined'
    ) {
      return undefined;
    }
    const channel = new BroadcastChannel(`simulation-run:${completionChannelId}`);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data && typeof event.data === 'object'
        ? event.data as Record<string, unknown>
        : {};
      if (
        data.type === 'simulation-run-persisted'
        && data.sceneId === config.sceneId
        && typeof data.simulationRunId === 'string'
      ) {
        setSimulationRunId(data.simulationRunId);
      }
    };
    return () => channel.close();
  }, [completionChannelId, config.resourceKind, config.sceneId]);
  const title = config.resourceKind === 'arena-workbench'
    ? 'Arena 挑战工作台'
    : config.scene?.label ?? '虚拟仿真资源';
  const description = config.resourceKind === 'arena-workbench'
    ? '从课程环节进入 Arena 挑战，保留课堂、班级与发布上下文。'
    : '从课程环节进入虚拟仿真场景，保留课堂、班级与资源上下文。';

  const recordLaunch = () => {
    interactive?.tracking.emit('interact', {
      eventType: getSimulationCourseLaunchEventType(config),
      ...evidencePayload,
    });
    if (interactive && interactive.progress.current < 30) {
      interactive.progress.setProgress(30);
    }
  };

  const completionResult = {
    success: true,
    score: 100,
    data: {
      eventType: getSimulationCourseCompletionEventType(config),
      ...evidencePayload,
      simulationRunId,
      score: 100,
    },
  };

  return (
    <section className="flex min-h-full items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-cyan-500/10 p-3 text-cyan-300">
            <PlayCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-cyan-300">
              {config.telemetryPolicy}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-slate-950/70 p-3">
                <dt className="text-slate-500">资源上下文</dt>
                <dd className="mt-1 font-mono text-slate-200">{launchContext.provenance}</dd>
              </div>
              <div className="rounded-md bg-slate-950/70 p-3">
                <dt className="text-slate-500">上下文状态</dt>
                <dd className="mt-1 font-mono text-slate-200">{launchContext.contextState}</dd>
              </div>
              <div className="rounded-md bg-slate-950/70 p-3">
                <dt className="text-slate-500">场景</dt>
                <dd className="mt-1 font-mono text-slate-200">{config.sceneId ?? 'arena'}</dd>
              </div>
              <div className="rounded-md bg-slate-950/70 p-3">
                <dt className="text-slate-500">任务</dt>
                <dd className="mt-1 font-mono text-slate-200">{config.arenaTaskId ?? 'none'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {config.resourceKind === 'simulation-scene' && !completionChannelId ? (
            <Button disabled>
              <ExternalLink className="mr-2 h-4 w-4" />
              正在准备资源
            </Button>
          ) : (
            <Button asChild>
              <Link href={href} target="_blank" rel="noreferrer" onClick={recordLaunch}>
                <ExternalLink className="mr-2 h-4 w-4" />
                打开资源
              </Link>
            </Button>
          )}
          {persistedRunRequired && !simulationRunId ? (
            <Button type="button" variant="outline" disabled>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              完成仿真后记录
            </Button>
          ) : (
            <PathResourceContinueAction enabled result={completionResult} />
          )}
        </div>
      </div>
    </section>
  );
}
