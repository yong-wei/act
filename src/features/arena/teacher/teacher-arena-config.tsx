'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, ClipboardList, Trophy } from 'lucide-react';

import {
  ARENA_CHALLENGE_TASKS,
  ARENA_LEADERBOARD_POLICIES,
  getArenaChallengeObject,
  type ControllerMethod,
} from '@/features/arena/domain';
import {
  ARENA_CHALLENGE_TEMPLATES,
  createArenaChallengePublication,
  deriveArenaHomeworkAssessment,
  type ArenaChallengePublication,
  type ArenaTelemetryLevel,
} from './configuration';

type ArenaPublicationStatus = 'draft' | 'active' | 'paused' | 'archived' | 'closed';
type PublishedArenaPublication = ArenaChallengePublication & {
  id: string;
  status: ArenaPublicationStatus;
};

const previewAssessment = deriveArenaHomeworkAssessment({
  validSubmission: true,
  score: 86.4,
  rank: 1,
  diagnosticWeakMetrics: ['controlEnergy'],
});

const initialTemplate = ARENA_CHALLENGE_TEMPLATES.find((template) => template.id === 'template-pid-tuning') ??
  ARENA_CHALLENGE_TEMPLATES[0];

export function TeacherArenaConfig() {
  const [templateId, setTemplateId] = useState(initialTemplate.id);
  const [taskId, setTaskId] = useState(initialTemplate.defaultTaskId);
  const [classId, setClassId] = useState('class-2026-control');
  const [visibility, setVisibility] = useState<'class' | 'course' | 'public'>(initialTemplate.defaultVisibility);
  const [deadline, setDeadline] = useState('2026-06-01T15:00');
  const [leaderboardPolicyId, setLeaderboardPolicyId] = useState(initialTemplate.defaultLeaderboardPolicyId);
  const [homeworkBinding, setHomeworkBinding] = useState(initialTemplate.gradeBinding);
  const [targetSignal, setTargetSignal] = useState(initialTemplate.targetSignal);
  const [disturbance, setDisturbance] = useState(initialTemplate.disturbance);
  const [initialCondition, setInitialCondition] = useState(initialTemplate.initialCondition);
  const [allowedMethods, setAllowedMethods] = useState<ControllerMethod[]>(initialTemplate.allowedMethods);
  const [hardConstraintsText, setHardConstraintsText] = useState(initialTemplate.hardConstraints.join(', '));
  const [scoringMetricWeightsText, setScoringMetricWeightsText] = useState(formatMetricWeights(initialTemplate.scoringMetricWeights));
  const [paretoEnabled, setParetoEnabled] = useState(initialTemplate.paretoEnabled);
  const [hiddenTestEnabled, setHiddenTestEnabled] = useState(initialTemplate.hiddenTestEnabled);
  const [publicLeaderboard, setPublicLeaderboard] = useState(initialTemplate.publicLeaderboard);
  const [telemetryLevel, setTelemetryLevel] = useState<ArenaTelemetryLevel>(initialTemplate.telemetryLevel);
  const [apiStatus, setApiStatus] = useState('尚未发送预览请求');
  const [publishedItems, setPublishedItems] = useState<PublishedArenaPublication[]>([]);
  const selectedTemplate = useMemo(
    () => ARENA_CHALLENGE_TEMPLATES.find((template) => template.id === templateId),
    [templateId],
  );
  const selectedTask = useMemo(
    () => ARENA_CHALLENGE_TASKS.find((task) => task.id === taskId),
    [taskId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPublishedItems() {
      try {
        const response = await fetch('/api/teacher/arena/publications', { cache: 'no-store' });
        const payload = await response.json() as { publications?: PublishedArenaPublication[] };
        if (!cancelled && response.ok && Array.isArray(payload.publications)) {
          setPublishedItems(payload.publications);
        }
      } catch {
        if (!cancelled) {
          setPublishedItems([]);
        }
      }
    }

    void loadPublishedItems();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewPublication = useMemo(() => {
    try {
      return createArenaChallengePublication({
        taskId,
        classId,
        visibility,
        deadline: new Date(deadline).toISOString(),
        leaderboardPolicyId,
        homeworkBinding,
        templateId,
        targetSignal,
        disturbance,
        initialCondition,
        allowedMethods,
        hardConstraints: parseListText(hardConstraintsText),
        scoringMetricWeights: parseMetricWeightsText(scoringMetricWeightsText),
        paretoEnabled,
        hiddenTestEnabled,
        publicLeaderboard,
        telemetryLevel,
      });
    } catch {
      return null;
    }
  }, [
    allowedMethods,
    classId,
    deadline,
    disturbance,
    hardConstraintsText,
    hiddenTestEnabled,
    homeworkBinding,
    initialCondition,
    leaderboardPolicyId,
    paretoEnabled,
    publicLeaderboard,
    scoringMetricWeightsText,
    targetSignal,
    taskId,
    telemetryLevel,
    templateId,
    visibility,
  ]);

  const applyTemplate = (nextTemplateId: string) => {
    const nextTemplate = ARENA_CHALLENGE_TEMPLATES.find((template) => template.id === nextTemplateId);
    setTemplateId(nextTemplateId);
    if (!nextTemplate) return;
    setTaskId(nextTemplate.defaultTaskId);
    setVisibility(nextTemplate.defaultVisibility);
    setLeaderboardPolicyId(nextTemplate.defaultLeaderboardPolicyId);
    setHomeworkBinding(nextTemplate.gradeBinding);
    setTargetSignal(nextTemplate.targetSignal);
    setDisturbance(nextTemplate.disturbance);
    setInitialCondition(nextTemplate.initialCondition);
    setAllowedMethods(nextTemplate.allowedMethods);
    setHardConstraintsText(nextTemplate.hardConstraints.join(', '));
    setScoringMetricWeightsText(formatMetricWeights(nextTemplate.scoringMetricWeights));
    setParetoEnabled(nextTemplate.paretoEnabled);
    setHiddenTestEnabled(nextTemplate.hiddenTestEnabled);
    setPublicLeaderboard(nextTemplate.publicLeaderboard);
    setTelemetryLevel(nextTemplate.telemetryLevel);
  };

  const toggleAllowedMethod = (method: ControllerMethod) => {
    setAllowedMethods((current) => (
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method]
    ));
  };

  const submitPreviewRequest = async () => {
    setApiStatus('正在生成预览');
    try {
      const response = await fetch('/api/teacher/arena/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          classId,
          visibility,
          deadline: new Date(deadline).toISOString(),
          leaderboardPolicyId,
          homeworkBinding,
          templateId,
          targetSignal,
          disturbance,
          initialCondition,
          allowedMethods,
          hardConstraints: parseListText(hardConstraintsText),
          scoringMetricWeights: parseMetricWeightsText(scoringMetricWeightsText),
          paretoEnabled,
          hiddenTestEnabled,
          publicLeaderboard,
          telemetryLevel,
        }),
      });
      const payload = await response.json() as { error?: string };
      setApiStatus(response.ok ? '预览请求已通过权限和配置校验' : payload.error ?? '预览请求未通过');
    } catch {
      setApiStatus('预览请求失败');
    }
  };

  const publicationPayload = () => ({
    taskId,
    classId,
    visibility,
    deadline: new Date(deadline).toISOString(),
    leaderboardPolicyId,
    homeworkBinding,
    gradingPolicy: {
      hideFullLeaderboardBeforeDeadline: homeworkBinding,
      allowLateSubmissions: false,
    },
    templateId,
    targetSignal,
    disturbance,
    initialCondition,
    allowedMethods,
    hardConstraints: parseListText(hardConstraintsText),
    scoringMetricWeights: parseMetricWeightsText(scoringMetricWeightsText),
    paretoEnabled,
    hiddenTestEnabled,
    publicLeaderboard,
    telemetryLevel,
  });

  const submitPublishRequest = async () => {
    setApiStatus('正在发布挑战');
    try {
      const response = await fetch('/api/teacher/arena/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publicationPayload()),
      });
      const payload = await response.json() as {
        error?: string;
        publication?: PublishedArenaPublication;
      };
      if (!response.ok || !payload.publication) {
        setApiStatus(payload.error ?? '发布失败');
        return;
      }
      setPublishedItems((items) => [payload.publication!, ...items.filter((item) => item.id !== payload.publication!.id)]);
      setApiStatus('挑战已发布');
    } catch {
      setApiStatus('发布请求失败');
    }
  };

  const updatePublicationStatus = async (publicationId: string, status: ArenaPublicationStatus) => {
    setApiStatus('正在更新发布状态');
    try {
      const response = await fetch(`/api/teacher/arena/publications/${publicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json() as {
        error?: string;
        publication?: PublishedArenaPublication;
      };
      if (!response.ok || !payload.publication) {
        setApiStatus(payload.error ?? '状态更新失败');
        return;
      }
      setPublishedItems((items) => items.map((item) => (
        item.id === publicationId ? payload.publication! : item
      )));
      setApiStatus('发布状态已更新');
    } catch {
      setApiStatus('状态更新请求失败');
    }
  };

  return (
    <main className="surface-page min-h-screen">
      <header className="surface-topbar">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <Link href="/teacher" className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            返回教师工作台
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            竞技场教师配置
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <h1 className="text-4xl font-semibold text-foreground">竞技场挑战配置</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-subtle">
              教师从已有挑战任务中选择对象、班级范围、截止时间和榜单策略。作业评价不等同排行榜名次，名次只作为比较反馈。
            </p>
          </div>

          <div className="surface-card grid gap-4 p-5">
            <label className="grid gap-1 text-sm text-subtle">
              配置模板
              <select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                {ARENA_CHALLENGE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-subtle">
              挑战任务
              <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                {ARENA_CHALLENGE_TASKS.map((task) => {
                  const object = getArenaChallengeObject(task.objectId);
                  return (
                    <option key={task.id} value={task.id}>
                      {task.title} · {object?.name ?? task.objectId}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-subtle">
                班级范围
                <input value={classId} onChange={(event) => setClassId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                可见性
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="class">班级</option>
                  <option value="course">课程</option>
                  <option value="public">公开</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                截止时间
                <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                榜单策略
                <select value={leaderboardPolicyId} onChange={(event) => setLeaderboardPolicyId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  {ARENA_LEADERBOARD_POLICIES.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-subtle">
              <input type="checkbox" checked={homeworkBinding} onChange={(event) => setHomeworkBinding(event.target.checked)} />
              绑定为作业挑战
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-subtle">
                目标信号
                <input value={targetSignal} onChange={(event) => setTargetSignal(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                扰动
                <input value={disturbance} onChange={(event) => setDisturbance(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                初始条件
                <input value={initialCondition} onChange={(event) => setInitialCondition(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                埋点级别
                <select value={telemetryLevel} onChange={(event) => setTelemetryLevel(event.target.value as ArenaTelemetryLevel)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="L0">L0</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/55 p-3">
              <p className="text-sm text-subtle">允许控制器类型</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-foreground">
                {(selectedTask?.allowedMethods ?? []).map((method) => (
                  <label key={method} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleAllowedMethod(method)} />
                    {method}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-subtle">
                硬约束
                <textarea value={hardConstraintsText} onChange={(event) => setHardConstraintsText(event.target.value)} rows={3} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                评分指标权重
                <textarea value={scoringMetricWeightsText} onChange={(event) => setScoringMetricWeightsText(event.target.value)} rows={3} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
            </div>
            <div className="grid gap-2 text-sm text-subtle md:grid-cols-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={paretoEnabled} onChange={(event) => setParetoEnabled(event.target.checked)} />
                启用 Pareto 榜
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={hiddenTestEnabled} onChange={(event) => setHiddenTestEnabled(event.target.checked)} />
                启用隐藏测试
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={publicLeaderboard} onChange={(event) => setPublicLeaderboard(event.target.checked)} />
                公开榜单
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={submitPreviewRequest} className="btn-ghost-themed inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm">
                生成发布预览
              </button>
              <button type="button" onClick={submitPublishRequest} className="cta-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm">
                正式发布挑战
              </button>
            </div>
            <div className="text-xs text-subtle">{apiStatus}</div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">发布预览</h2>
            </div>
            {previewPublication ? (
              <div className="mt-4 grid gap-3 text-sm">
                <PreviewRow label="班级" value={previewPublication.classId} />
                <PreviewRow label="任务" value={previewPublication.taskId} />
                <PreviewRow label="可见性" value={previewPublication.studentVisibility} />
                <PreviewRow label="截止时间" value={previewPublication.deadline} />
                <PreviewRow label="作业绑定" value={previewPublication.homeworkBinding ? '是' : '否'} />
                <PreviewRow label="目标信号" value={previewPublication.targetSignal} />
                <PreviewRow label="扰动设置" value={previewPublication.disturbance} />
                <PreviewRow label="初始条件" value={previewPublication.initialCondition} />
                <PreviewRow label="控制器类型" value={previewPublication.allowedMethods.join(', ')} />
                <PreviewRow label="硬约束" value={previewPublication.hardConstraints.join(', ')} />
                <PreviewRow label="指标权重" value={formatMetricWeights(previewPublication.scoringMetricWeights)} />
                <PreviewRow label="Pareto 榜" value={previewPublication.paretoEnabled ? '启用' : '关闭'} />
                <PreviewRow label="隐藏测试" value={previewPublication.hiddenTestEnabled ? '启用' : '关闭'} />
                <PreviewRow label="公开榜单" value={previewPublication.publicLeaderboard ? '启用' : '关闭'} />
                <PreviewRow label="埋点级别" value={previewPublication.telemetryLevel} />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                当前任务、可见性、榜单或作业绑定组合不兼容。
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">模板说明</h2>
            <p className="mt-3 text-sm leading-6 text-subtle">
              {selectedTemplate?.description ?? '当前模板不存在。'}
            </p>
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">作业评价边界</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-subtle">{previewAssessment.summary}</p>
            <div className="mt-4 grid gap-2 text-sm">
              <PreviewRow label="达标提交" value={`${previewAssessment.gradeComponents.completionScore}`} />
              <PreviewRow label="指标掌握" value={`${previewAssessment.gradeComponents.masteryScore}`} />
              <PreviewRow label="诊断表现" value={`${previewAssessment.gradeComponents.diagnosticScore}`} />
              <PreviewRow label="名次贡献" value={`${previewAssessment.gradeComponents.rankContribution}`} />
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">已发布挑战</h2>
            <div className="mt-4 grid gap-3">
              {publishedItems.length === 0 ? (
                <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-3 text-sm text-subtle">
                  暂无本页发布记录
                </div>
              ) : publishedItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 bg-card/55 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.taskId}</div>
                      <div className="mt-1 text-xs text-subtle">{item.classId} · {item.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/teacher/arena/publications/${item.id}`} className="btn-ghost-themed rounded-lg border px-2 py-1 text-xs">
                        查看报告
                      </Link>
                      <button type="button" onClick={() => updatePublicationStatus(item.id, 'paused')} className="btn-ghost-themed rounded-lg border px-2 py-1 text-xs">
                        暂停
                      </button>
                      <button type="button" onClick={() => updatePublicationStatus(item.id, 'active')} className="btn-ghost-themed rounded-lg border px-2 py-1 text-xs">
                        重开
                      </button>
                      <button type="button" onClick={() => updatePublicationStatus(item.id, 'archived')} className="btn-ghost-themed rounded-lg border px-2 py-1 text-xs">
                        归档
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatMetricWeights(weights: Record<string, number>) {
  return Object.entries(weights)
    .map(([metricId, weight]) => `${metricId}:${weight}`)
    .join(' / ');
}

function parseListText(value: string) {
  return value.split(/[,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMetricWeightsText(value: string) {
  const entries = value.split('/')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [metricId, rawWeight] = item.split(':').map((part) => part.trim());
      return [metricId, Number(rawWeight)] as const;
    })
    .filter(([metricId, weight]) => metricId && Number.isFinite(weight) && weight >= 0);

  return Object.fromEntries(entries);
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/55 px-3 py-2">
      <span className="text-subtle">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
