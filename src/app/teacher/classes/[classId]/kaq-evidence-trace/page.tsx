import Link from 'next/link';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/platform/app-shell';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { KaqSarCandidateReview } from '@/features/teacher/kaq-sar-candidate-review';
import { getServerAuthSession } from '@/lib/auth';
import {
  loadTeacherKaqEvidenceTracePayloadForUser,
  TeacherKaqEvidenceTraceRequestError,
} from '@/lib/data-governance/teacher-kaq-evidence-trace-server';
import type { TeacherKaqEvidenceTracePayload } from '@/lib/data-governance/teacher-kaq-evidence-trace';

export const dynamic = 'force-dynamic';

interface TeacherKaqEvidenceTracePageProps {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function resolveShellRole(role: string | undefined): PlatformRole {
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  return 'student';
}

export default async function TeacherKaqEvidenceTracePage(props: TeacherKaqEvidenceTracePageProps) {
  const [params, searchParams, session] = await Promise.all([
    props.params,
    props.searchParams,
    getServerAuthSession(),
  ]);
  const activeHref = `/teacher/classes/${params.classId}/kaq-evidence-trace`;

  if (!session?.user?.id) {
    return (
      <TraceShell role={resolveShellRole(undefined)} activeHref={activeHref}>
        <TraceError status={401} message="未登录" />
      </TraceShell>
    );
  }

  try {
    const payload = await loadTeacherKaqEvidenceTracePayloadForUser({
      sessionUser: {
        id: session.user.id,
        role: session.user.role,
      },
      classId: params.classId,
      searchParams: toURLSearchParams(searchParams),
    });

    return (
      <TraceShell role={resolveShellRole(session.user.role)} activeHref={activeHref}>
        <TeacherKaqEvidenceTraceSurface payload={payload} />
      </TraceShell>
    );
  } catch (error) {
    if (error instanceof TeacherKaqEvidenceTraceRequestError) {
      return (
        <TraceShell role={resolveShellRole(session.user.role)} activeHref={activeHref}>
          <TraceError status={error.status} message={error.message} />
        </TraceShell>
      );
    }
    throw error;
  }
}

function TraceShell({
  role,
  activeHref,
  children,
}: {
  role: PlatformRole;
  activeHref: string;
  children: ReactNode;
}) {
  return (
    <AppShell
      viewerRole={role}
      title="K/A/Q 证据追踪"
      subtitle="班级图谱节点、SAR 关联证据与资源缺口"
      activeHref={activeHref}
      sidebarMode="collapsible"
      className="surface-page"
    >
      {children}
    </AppShell>
  );
}

function TeacherKaqEvidenceTraceSurface({ payload }: { payload: TeacherKaqEvidenceTracePayload }) {
  return (
    <section
      className="space-y-6 px-6 py-6"
      data-teacher-kaq-evidence-trace="surface"
      data-teacher-kaq-evidence-node-state={payload.selection.nodeFound ? 'selected' : 'missing'}
      data-teacher-kaq-evidence-sar-status={payload.sarTrace.status}
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-subtle">
          <Link href={`/teacher/classes/${payload.classInfo.id}/analytics-v2`} className="transition hover:text-foreground">
            {payload.classInfo.name}
          </Link>
          {payload.student ? (
            <span data-teacher-kaq-evidence-student-scope="true">学生：{payload.student.name}</span>
          ) : (
            <span data-teacher-kaq-evidence-class-scope="true">班级范围</span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {payload.node?.title ?? '未找到请求的 K/A/Q 节点'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
            {payload.node?.description ?? '请从图谱中心或班级学情入口重新选择节点。'}
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <TracePanel title="SAR 关联证据" marker="sar-summary">
            <div className="grid gap-3 sm:grid-cols-4">
              <TraceMetric label="事件" value={payload.sarTrace.eventCount} />
              <TraceMetric label="选中引用" value={payload.sarTrace.selectedRefCount} />
              <TraceMetric label="拒绝引用" value={payload.sarTrace.rejectedRefCount} />
              <TraceMetric label="扩展跳数" value={payload.sarTrace.expansionHopCount} />
            </div>
            {payload.sarTrace.topEvents.length > 0 ? (
              <div className="mt-4 space-y-2" data-teacher-kaq-evidence-safe-events="true">
                {payload.sarTrace.topEvents.map((event) => (
                  <article key={event.id} className="rounded-md border border-border bg-card/70 p-3">
                    <div className="text-sm font-medium text-foreground">{event.title}</div>
                    <p className="mt-1 text-sm leading-6 text-subtle">{event.safeSummary}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{event.authorityLevel}</span>
                      <span>{event.privacyScope}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-subtle">当前节点没有可向教师展示的 SAR 关联证据。</p>
            )}
          </TracePanel>

          <TracePanel title="资源缺口与候选" marker="resource-gaps">
            {payload.resourceGaps.length > 0 ? (
              <div className="flex flex-wrap gap-2" data-teacher-kaq-evidence-resource-gaps="true">
                {payload.resourceGaps.map((gap) => (
                  <span key={gap.type} className="rounded-md border border-border bg-card px-2.5 py-1 text-sm text-foreground">
                    {gap.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">当前节点暂无资源覆盖缺口。</p>
            )}
            {payload.candidateResources.length > 0 && (
              <div className="mt-4 grid gap-2" data-teacher-kaq-evidence-candidates="true">
                {payload.candidateResources.map((candidate) => (
                  <article key={candidate.id} className="rounded-md border border-border bg-card/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{candidate.label}</span>
                      <span className="text-xs text-muted-foreground">{candidate.refType}</span>
                    </div>
                    <p className="mt-1 text-sm text-subtle">{candidate.reason}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{candidate.suggestedFor.join('、')}</p>
                    <KaqSarCandidateReview payload={payload} candidate={candidate} />
                  </article>
                ))}
              </div>
            )}
          </TracePanel>
        </div>

        <aside className="space-y-4">
          <TracePanel title="节点上下文" marker="node-context">
            <div className="space-y-3 text-sm text-subtle">
              <TraceKV label="Domain" value={payload.selection.domain} />
              <TraceKV label="Objective" value={payload.node?.objectives.map((objective) => objective.title).join('、') || '无'} />
              <TraceKV label="Portrait" value={payload.node?.portraitDimensions.join('、') || '无'} />
              <TraceKV label="候选引用" value={`${payload.sarTrace.candidateRefs.resourceNodeCount} ResourceNode / ${payload.sarTrace.candidateRefs.retrievalChunkCount} chunk`} />
            </div>
          </TracePanel>

          <TracePanel title="证据计数" marker="evidence-counts">
            <div className="grid grid-cols-2 gap-2">
              <TraceMetric label="班级分母" value={payload.evidenceCounts.classStudentCount ?? '无'} />
              <TraceMetric label="纳入" value={payload.evidenceCounts.classIncludedPopulation ?? '无'} />
              <TraceMetric label="排除" value={payload.evidenceCounts.classExcludedPopulation ?? '无'} />
              <TraceMetric label="学生证据" value={payload.evidenceCounts.studentEvidenceCount ?? '无'} />
            </div>
          </TracePanel>

          <TracePanel title="返回入口" marker="return-links">
            <div className="grid gap-2">
              {payload.returnLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                  data-teacher-kaq-evidence-return-link={link.id}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </TracePanel>

          {payload.limitations.length > 0 && (
            <TracePanel title="限制码" marker="limitations">
              <div className="flex flex-wrap gap-2">
                {payload.limitations.slice(0, 8).map((limitation) => (
                  <span key={limitation} className="rounded border border-border px-2 py-1 text-xs text-subtle">
                    {limitation}
                  </span>
                ))}
              </div>
            </TracePanel>
          )}
        </aside>
      </div>
    </section>
  );
}

function TracePanel({
  title,
  marker,
  children,
}: {
  title: string;
  marker: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4" data-teacher-kaq-evidence-panel={marker}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TraceMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function TraceKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/70 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function TraceError({ status, message }: { status: number; message: string }) {
  return (
    <section className="px-6 py-6" data-teacher-kaq-evidence-trace="error" data-teacher-kaq-evidence-error-status={status}>
      <div className="rounded-lg border border-border bg-card/70 p-5">
        <h1 className="text-lg font-semibold text-foreground">无法打开 K/A/Q 证据追踪</h1>
        <p className="mt-2 text-sm text-subtle">{message}</p>
      </div>
    </section>
  );
}

function toURLSearchParams(input: Record<string, string | string[] | undefined> | undefined): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}
