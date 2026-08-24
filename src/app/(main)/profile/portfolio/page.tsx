'use client';

/**
 * 我的学习档案页面
 *
 * 展示学生代表性作品、高质量提示词、仿真设计等
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/platform/app-shell';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { UserMenu } from '@/components/shared/user-menu';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import { buildAiAuditTaskState, buildPortfolioReflectionDraft } from '@/lib/ai-task-boundary-contracts';
import {
  buildFeedbackTaskContext,
  buildPortfolioFeedbackDraft,
  shouldRenderPortfolioFeedbackTask,
  type PortfolioFeedbackDraft,
} from '@/lib/student-feedback-task-contract';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';
import type {
  PortfolioEvidenceSourceState,
  ClassroomPortfolioWork,
  EthicsPortfolioCase,
  SimulationPortfolioDesign,
} from '@/lib/data-governance/profile-portfolio-evidence';

interface PortfolioData {
  classWorks: ClassroomPortfolioWork[];
  // Quality prompt designs
  promptDesigns: Array<{
    id: string;
    prompt: string;
    score: number;
    feedback: string;
    createdAt: string;
  }>;
  // Simulation designs
  simulationDesigns: SimulationPortfolioDesign[];
  // Ethics remediation cases
  ethicsCases: EthicsPortfolioCase[];
  evidenceStates: {
    classroom: PortfolioEvidenceSourceState;
    simulations: PortfolioEvidenceSourceState;
    ethics: PortfolioEvidenceSourceState;
  };
  // AI collaboration reflections
  reflections: Array<{
    id: string;
    source: string;
    assignment: string | null;
    intent: string;
    title: string;
    content: string;
    status: 'DRAFT';
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reflectionIntent = searchParams.get('category') === 'reflection' ? searchParams.get('intent') : null;
  const reflectionTaskIntent = searchParams.get('taskIntent') ?? searchParams.get('intent') ?? undefined;
  const reflectionDraft =
    reflectionIntent === 'create'
      ? buildPortfolioReflectionDraft(searchParams.get('source') ?? 'portfolio', {
          assignment: searchParams.get('assignment') ?? undefined,
          intent: reflectionTaskIntent,
        })
      : null;
  const feedbackQuery = {
    assignment: searchParams.get('assignment'),
    criterion: searchParams.get('criterion'),
    source: searchParams.get('source'),
    feedbackSource: searchParams.get('feedbackSource'),
    status: searchParams.get('status'),
    action: searchParams.get('action'),
    returnTo: searchParams.get('returnTo'),
    intent: searchParams.get('intent'),
    teacherInterventionId: searchParams.get('teacherInterventionId'),
  };
  const localFeedbackContext = shouldRenderPortfolioFeedbackTask(feedbackQuery)
    ? buildFeedbackTaskContext(feedbackQuery)
    : null;
  const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams);
  const feedbackPortfolioDraft = feedbackContext ? buildPortfolioFeedbackDraft(feedbackContext) : null;
  const selectedReflectionId = searchParams.get('draftId');
  const hasLocalPortfolioTask = Boolean(reflectionDraft || feedbackPortfolioDraft || selectedReflectionId);
  const [activeTab, setActiveTab] = useState<'works' | 'prompts' | 'simulations' | 'ethics' | 'reflections'>(
    hasLocalPortfolioTask ? 'reflections' : 'works',
  );

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const [reflectionResponse, evidenceResponse] = await Promise.all([
        fetch('/api/profile/portfolio-reflection-drafts'),
        fetch('/api/profile/portfolio-evidence'),
      ]);
      if (!reflectionResponse.ok) {
        throw new Error('加载反思草稿失败');
      }
      const reflectionData = (await reflectionResponse.json()) as { drafts: PortfolioData['reflections'] };
      const evidenceData = evidenceResponse.ok
        ? await evidenceResponse.json() as {
            classroom: { state: PortfolioEvidenceSourceState; items: ClassroomPortfolioWork[] };
            simulations: { state: PortfolioEvidenceSourceState; items: SimulationPortfolioDesign[] };
            ethics: { state: PortfolioEvidenceSourceState; items: EthicsPortfolioCase[] };
          }
        : null;

      setPortfolio({
        classWorks: evidenceData?.classroom.items ?? [],
        promptDesigns: [],
        simulationDesigns: evidenceData?.simulations.items ?? [],
        ethicsCases: evidenceData?.ethics.items ?? [],
        evidenceStates: {
          classroom: evidenceData?.classroom.state ?? 'unavailable',
          simulations: evidenceData?.simulations.state ?? 'unavailable',
          ethics: evidenceData?.ethics.state ?? 'unavailable',
        },
        reflections: reflectionData.drafts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedReflection = portfolio?.reflections.find((reflection) => reflection.id === selectedReflectionId) ?? null;
  const openReflectionDraft = useCallback((draftId: string) => {
    router.replace(`/profile/portfolio?category=reflection&draftId=${encodeURIComponent(draftId)}`);
  }, [router]);
  const handleDraftSaved = useCallback((draftId: string) => {
    openReflectionDraft(draftId);
    void fetchPortfolio();
  }, [fetchPortfolio, openReflectionDraft]);
  const handleDraftDiscarded = useCallback(() => {
    router.replace('/profile/portfolio?category=reflection');
    void fetchPortfolio();
  }, [fetchPortfolio, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (session.user.role !== 'STUDENT') {
        router.replace(getPlatformCockpitHref(session.user.role));
        return;
      }
      void fetchPortfolio();
    }
  }, [status, session, router, fetchPortfolio]);

  useEffect(() => {
    if (searchParams.get('category') === 'reflection' || feedbackPortfolioDraft || selectedReflectionId) {
      setActiveTab('reflections');
    }
  }, [feedbackPortfolioDraft, searchParams, selectedReflectionId]);

  if (status === 'authenticated' && session?.user?.role !== 'STUDENT') {
    return (
      <PortfolioAppShell>
        <section className="flex min-h-[40vh] items-center justify-center" data-commercial-workspace="learner-record">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <p className="text-subtle">正在返回教师工作台...</p>
          </div>
        </section>
      </PortfolioAppShell>
    );
  }

  if (status === 'loading' || (loading && !hasLocalPortfolioTask)) {
    return (
      <PortfolioAppShell>
        <section className="flex min-h-[40vh] items-center justify-center" data-commercial-workspace="learner-record">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <p className="text-subtle">加载档案数据...</p>
          </div>
        </section>
      </PortfolioAppShell>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <PortfolioAppShell>
        <section className="flex min-h-[40vh] items-center justify-center" data-commercial-workspace="learner-record">
          <div className="text-center">
            <p className="text-xl text-subtle">请先登录</p>
            <Link href="/login" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
              前往登录
            </Link>
          </div>
        </section>
      </PortfolioAppShell>
    );
  }

  if (error) {
    return (
      <PortfolioAppShell>
        <section className="flex min-h-[40vh] items-center justify-center" data-commercial-workspace="learner-record">
          <div className="text-center">
            <p className="text-xl text-red-500">{error}</p>
            <button type="button" onClick={fetchPortfolio} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
              重试
            </button>
          </div>
        </section>
      </PortfolioAppShell>
    );
  }

  const tabs = [
    { id: 'works', label: '课堂作品', icon: '📝' },
    { id: 'prompts', label: '提示词设计', icon: '💬' },
    { id: 'simulations', label: '仿真设计', icon: '🚢' },
    { id: 'ethics', label: '伦理整改', icon: '⚖️' },
    { id: 'reflections', label: '学习反思', icon: '🤔' },
  ] as const;

  return (
    <PortfolioAppShell
      data-commercial-workspace="learner-record"
      data-ai-local-task-surface={reflectionDraft || feedbackPortfolioDraft ? 'portfolio-reflection' : undefined}
      data-ai-task-focus-mode={reflectionDraft || feedbackPortfolioDraft ? 'local-first' : undefined}
      data-task-workspace-archetype={reflectionDraft || feedbackPortfolioDraft ? 'ai-local-task' : undefined}
    >
      <section className="pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] md:pb-8">
        <StudentFeedbackTaskPanel context={feedbackContext} surface="portfolio" className="mb-6" />
        {/* Introduction Card */}
        <div className="surface-card mb-8 bg-gradient-to-br from-card via-card to-violet-500/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20 text-violet-500">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">学习成长档案</h2>
              <p className="mt-1 text-subtle">记录你的学习历程，展示优秀作品，见证成长轨迹</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
                activeTab === tab.id ? 'bg-amber-500 text-white' : 'surface-card-soft text-subtle hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'works' && (
            <ClassWorksTab works={portfolio?.classWorks || []} sourceState={portfolio?.evidenceStates.classroom ?? 'unavailable'} />
          )}
          {activeTab === 'prompts' && <PromptDesignsTab designs={portfolio?.promptDesigns || []} />}
          {activeTab === 'simulations' && (
            <SimulationDesignsTab designs={portfolio?.simulationDesigns || []} sourceState={portfolio?.evidenceStates.simulations ?? 'unavailable'} />
          )}
          {activeTab === 'ethics' && (
            <EthicsCasesTab cases={portfolio?.ethicsCases || []} sourceState={portfolio?.evidenceStates.ethics ?? 'unavailable'} />
          )}
          {activeTab === 'reflections' && (
            <ReflectionsTab
              key={reflectionDraft?.id ?? selectedReflection?.id ?? 'reflection-list'}
              reflections={portfolio?.reflections || []}
              draft={reflectionDraft}
              feedbackDraft={feedbackPortfolioDraft}
              selectedDraft={selectedReflection}
              onDraftSaved={handleDraftSaved}
              onDraftDiscarded={handleDraftDiscarded}
              onOpenDraft={openReflectionDraft}
            />
          )}
        </div>
      </section>
    </PortfolioAppShell>
  );
}

function PortfolioAppShell({
  children,
  ...props
}: {
  children: ReactNode;
  [key: `data-${string}`]: string | undefined;
}) {
  const { data: shellSession } = useSession();

  return (
    <AppShell
      viewerRole="student"
      activeHref="/profile/portfolio"
      title="学习档案"
      subtitle="整理课堂作品、提示词、仿真设计和 AI 协作反思。"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '个人中心', href: '/profile' }, { label: '学习档案' }]}
      userMenu={shellSession?.user ? <UserMenu user={{ name: shellSession.user.name, email: shellSession.user.email, role: shellSession.user.role }} /> : undefined}
      className="surface-page"
    >
      <div {...props}>{children}</div>
    </AppShell>
  );
}

function ClassWorksTab({
  works,
  sourceState,
}: {
  works: PortfolioData['classWorks'];
  sourceState: PortfolioEvidenceSourceState;
}) {
  if (works.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title={sourceState === 'unavailable' ? '课堂作品暂不可用' : '暂无课堂作品'}
        description={sourceState === 'unavailable' ? '课堂证据来源暂时无法读取，请稍后重试。' : '参与互动课程后，你的课堂提交将在这里展示'}
        action={sourceState === 'empty' ? { label: '进入互动课程', href: '/interactive-learning' } : undefined}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {works.map((work) => (
        <div key={work.id} className="surface-card-soft p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-500">{work.type}</span>
              {work.sessionName && <span className="text-xs text-subtle">{work.sessionName}</span>}
            </div>
            <span className="text-xs text-subtle">{new Date(work.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <h3 className="mt-3 font-medium text-foreground">{work.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-subtle">{work.content}</p>
        </div>
      ))}
    </div>
  );
}

function PromptDesignsTab({ designs }: { designs: PortfolioData['promptDesigns'] }) {
  if (designs.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="暂无高质量提示词"
        description="在提示词结构评估中获得70分以上，即可收录到你的档案"
        action={{
          label: '练习提示词设计',
          href: '/evaluation/prompt-assessment',
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {designs.map((design, index) => (
        <div key={design.id} className="surface-card-soft p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-amber-500">{design.score}</span>
                <span className="text-sm text-subtle">分</span>
              </div>
            </div>
            <span className="text-xs text-subtle">{new Date(design.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="mt-4 rounded-lg bg-accent/50 p-4">
            <p className="text-sm text-foreground">{design.prompt}</p>
          </div>
          {design.feedback && (
            <div className="mt-3 flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-subtle">{design.feedback}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SimulationDesignsTab({
  designs,
  sourceState,
}: {
  designs: PortfolioData['simulationDesigns'];
  sourceState: PortfolioEvidenceSourceState;
}) {
  if (designs.length === 0) {
    return (
      <EmptyState
        icon="🚢"
        title={sourceState === 'unavailable' ? '仿真记录暂不可用' : '暂无仿真设计记录'}
        description={sourceState === 'unavailable' ? '仿真证据来源暂时无法读取，请稍后重试。' : '完成仿真任务后，你的设计方案将在这里展示'}
        action={sourceState === 'empty' ? { label: '开始仿真', href: '/simulations/destroyer' } : undefined}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {designs.map((design) => (
        <div key={design.id} className="surface-card-soft p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">{design.name || '未命名设计'}</h3>
            <div className="flex items-center gap-1">
               <span className="text-lg font-bold text-emerald-500">{design.score ?? '未评分'}</span>
              <span className="text-xs text-subtle">分</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(design.parameters || {})
              .slice(0, 4)
              .map(([key, value]) => (
                <div key={key} className="rounded bg-accent/50 px-3 py-2">
                  <p className="text-xs text-subtle">{key}</p>
                  <p className="font-mono text-sm text-foreground">
                    {typeof value === 'number' ? value.toFixed(2) : value}
                  </p>
                </div>
              ))}
          </div>
          <p className="mt-3 text-xs text-subtle">{new Date(design.createdAt).toLocaleDateString('zh-CN')}</p>
        </div>
      ))}
    </div>
  );
}

function EthicsCasesTab({
  cases,
  sourceState,
}: {
  cases: PortfolioData['ethicsCases'];
  sourceState: PortfolioEvidenceSourceState;
}) {
  if (cases.length === 0) {
    return (
      <EmptyState
        icon="⚖️"
        title={sourceState === 'unavailable' ? '伦理记录暂不可用' : '暂无伦理整改记录'}
        description={sourceState === 'unavailable' ? '伦理证据来源暂时无法读取，请稍后重试。' : '良好的工程伦理意识是优秀工程师的基础，继续保持！'}
        action={sourceState === 'empty' ? { label: '了解工程伦理', href: '/ethics' } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((item) => (
        <div key={item.id} className="surface-card-soft border-l-4 border-green-500 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className={`rounded px-2 py-0.5 text-xs ${item.isResolved ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                {item.isResolved ? '已整改' : '待整改'}
              </span>
              <h3 className="mt-2 font-medium text-foreground">
                {item.violationType === 'EXCESSIVE_RUDDER_RATE'
                  ? '舵角速度违规'
                  : item.violationType === 'EXCESSIVE_ROLL_ANGLE'
                    ? '横摇角违规'
                    : item.violationType === 'COLLISION_RISK'
                      ? '碰撞风险'
                      : item.violationType === 'ENVIRONMENTAL_HAZARD'
                        ? '环境危害'
                        : item.violationType === 'SAFETY_VIOLATION'
                          ? '安全违规'
                          : '其他违规'}
              </h3>
            </div>
            <span className="text-xs text-subtle">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <p className="mt-2 text-sm text-subtle">{item.description}</p>
          {item.isResolved && item.remediationAction && (
            <div className="mt-3 flex items-start gap-2 rounded bg-green-500/5 p-3">
              <svg className="mt-0.5 h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-foreground">{item.remediationAction}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReflectionsTab({
  reflections,
  draft,
  feedbackDraft,
  selectedDraft,
  onDraftSaved,
  onDraftDiscarded,
  onOpenDraft,
}: {
  reflections: PortfolioData['reflections'];
  draft?: ReturnType<typeof buildPortfolioReflectionDraft> | null;
  feedbackDraft?: PortfolioFeedbackDraft | null;
  selectedDraft?: PortfolioData['reflections'][number] | null;
  onDraftSaved: (draftId: string) => void;
  onDraftDiscarded: () => void;
  onOpenDraft: (draftId: string) => void;
}) {
  if (feedbackDraft) {
    const state = buildAiAuditTaskState({
      taskType: 'portfolio-reflection',
      status: 'pending',
      message: '报告反馈收录候选已创建，本页尚未保存到学习档案。',
      nextAction: '确认候选内容后再保存到学习档案',
      targetId: feedbackDraft.id,
    });
    return (
      <div className="space-y-4">
        <ActionStatusPanel state={state} />
        <div className="surface-card-soft p-5" data-student-feedback-task-surface="portfolio-candidate">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{feedbackDraft.status}</span>
            <span className="text-xs text-subtle">来源：{feedbackDraft.source ?? '报告反馈'}</span>
          </div>
          <h3 className="mt-3 font-medium text-foreground">{feedbackDraft.title}</h3>
          <p className="mt-2 text-sm text-subtle">{feedbackDraft.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={feedbackDraft.returnHref} className="btn-ghost-themed rounded px-4 py-2 text-sm">
              返回报告反馈
            </Link>
            <Link href="/profile/portfolio?category=reflection" className="btn-ghost-themed rounded px-4 py-2 text-sm">
              查看反思页
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (draft) {
    return <PortfolioReflectionCandidate draft={draft} onDraftSaved={onDraftSaved} />;
  }
  if (selectedDraft) {
    return <SavedReflectionDraft draft={selectedDraft} onDraftSaved={onDraftSaved} onDraftDiscarded={onDraftDiscarded} />;
  }
  if (reflections.length === 0) {
    return (
      <EmptyState
        icon="🤔"
        title="暂无AI协作反思"
        description="记录你与AI助手的协作反思，持续优化使用策略"
        action={{
          label: '开始反思',
          href: '/ai/copilot?context=portfolio-reflection&source=portfolio',
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reflections.map((reflection) => (
        <div key={reflection.id} className="surface-card-soft p-5">
          <div className="flex items-center justify-between">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">已保存草稿</span>
            <span className="text-xs text-subtle">{new Date(reflection.updatedAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <h3 className="mt-3 font-medium text-foreground">{reflection.title}</h3>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-subtle">{reflection.content}</p>
          <button
            type="button"
            onClick={() => onOpenDraft(reflection.id)}
            className="btn-ghost-themed mt-4 rounded px-4 py-2 text-sm"
          >
            继续编辑
          </button>
        </div>
      ))}
    </div>
  );
}

function PortfolioReflectionCandidate({
  draft,
  onDraftSaved,
}: {
  draft: ReturnType<typeof buildPortfolioReflectionDraft>;
  onDraftSaved: (draftId: string) => void;
}) {
  const [content, setContent] = useState(draft.detail);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const state = buildAiAuditTaskState({
    taskType: 'portfolio-reflection',
    status: isDiscarded ? 'blocked' : 'pending',
    message: isDiscarded
      ? '作品集反思草稿候选已丢弃，未写入学习档案。'
      : '作品集反思草稿候选已创建，确认内容后保存到学习档案。',
    nextAction: isDiscarded ? '重新生成候选或返回反思页' : '编辑候选内容后保存草稿，或丢弃候选。',
    targetId: draft.id,
  });

  const saveDraft = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      const response = await fetch('/api/profile/portfolio-reflection-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: draft.source,
          assignment: draft.assignment,
          intent: draft.intent,
          title: draft.title,
          content,
          idempotencyKey,
        }),
      });
      const payload = (await response.json()) as { draft?: { id: string }; error?: string };
      if (!response.ok || !payload.draft?.id) {
        throw new Error(payload.error ?? '保存草稿失败');
      }
      onDraftSaved(payload.draft.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存草稿失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ActionStatusPanel state={state} />
      <div
        className="surface-card-soft p-5"
        data-ai-task-boundary="portfolio-reflection-draft"
        data-task-workspace-zone="local-primary-input"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{isDiscarded ? 'discarded' : draft.status}</span>
          <span className="text-xs text-subtle">来源：{draft.source}</span>
        </div>
        <h3 className="mt-3 font-medium text-foreground">{draft.title}</h3>
        <div className="mt-3 rounded border border-border/70 bg-background/70 px-3 py-2 text-xs text-subtle">
          任务：{draft.assignment ?? 'portfolio-reflection'} · 意图：
          {draft.intent} · 输出：{draft.outputTarget} · 晋升策略：
          {draft.promotionPolicy}
        </div>
        <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="portfolio-reflection-content">
          反思内容
        </label>
        <textarea
          id="portfolio-reflection-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={7}
          disabled={isDiscarded || isSaving}
          className="mt-2 w-full resize-y rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          data-portfolio-reflection-draft-editor
        />
        {saveError && <p className="mt-2 text-sm text-destructive" role="alert">{saveError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={isDiscarded || isSaving}
            className="btn-ghost-themed rounded px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            data-primary-task-input="portfolio-reflection-draft"
          >
            {isSaving ? '保存中...' : '保存草稿'}
          </button>
          <button
            type="button"
            onClick={() => setIsDiscarded(true)}
            disabled={isSaving || isDiscarded}
            className="btn-ghost-themed rounded px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            丢弃候选
          </button>
          <Link href="/profile/portfolio?category=reflection" className="btn-ghost-themed rounded px-4 py-2 text-sm">
            返回反思页
          </Link>
          <Link
            href="/ai/copilot?context=portfolio-reflection&source=portfolio"
            className="btn-ghost-themed rounded px-4 py-2 text-sm"
          >
            重新生成候选
          </Link>
        </div>
      </div>
    </div>
  );
}

function SavedReflectionDraft({
  draft,
  onDraftSaved,
  onDraftDiscarded,
}: {
  draft: PortfolioData['reflections'][number];
  onDraftSaved: (draftId: string) => void;
  onDraftDiscarded: () => void;
}) {
  const [content, setContent] = useState(draft.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const state = buildAiAuditTaskState({
    taskType: 'portfolio-reflection',
    status: 'succeeded',
    message: '作品集反思已保存为个人草稿，尚未发布到正式学习档案。',
    nextAction: '继续编辑、保留草稿或丢弃草稿。',
    targetId: draft.id,
  });

  const updateDraft = async () => {
    try {
      setIsSaving(true);
      setActionError(null);
      const response = await fetch(`/api/profile/portfolio-reflection-drafts/${encodeURIComponent(draft.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
        }),
      });
      const payload = (await response.json()) as { draft?: { id: string }; error?: string };
      if (!response.ok || !payload.draft?.id) {
        throw new Error(payload.error ?? '更新草稿失败');
      }
      onDraftSaved(payload.draft.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '更新草稿失败');
    } finally {
      setIsSaving(false);
    }
  };

  const discardDraft = async () => {
    try {
      setIsDiscarding(true);
      setActionError(null);
      const response = await fetch(`/api/profile/portfolio-reflection-drafts/${encodeURIComponent(draft.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? '丢弃草稿失败');
      }
      onDraftDiscarded();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '丢弃草稿失败');
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <div className="space-y-4">
      <ActionStatusPanel state={state} />
      <div className="surface-card-soft p-5" data-ai-task-boundary="portfolio-reflection-draft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">已保存草稿</span>
          <span className="text-xs text-subtle">来源：{draft.source}</span>
        </div>
        <h3 className="mt-3 font-medium text-foreground">{draft.title}</h3>
        <div className="mt-3 rounded border border-border/70 bg-background/70 px-3 py-2 text-xs text-subtle">
          任务：{draft.assignment ?? 'portfolio-reflection'} · 意图：{draft.intent}
        </div>
        <label className="mt-4 block text-sm font-medium text-foreground" htmlFor={`portfolio-reflection-content-${draft.id}`}>
          反思内容
        </label>
        <textarea
          id={`portfolio-reflection-content-${draft.id}`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={7}
          disabled={isSaving || isDiscarding}
          className="mt-2 w-full resize-y rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          data-portfolio-reflection-draft-editor
        />
        {actionError && <p className="mt-2 text-sm text-destructive" role="alert">{actionError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={updateDraft}
            disabled={isSaving || isDiscarding}
            className="btn-ghost-themed rounded px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中...' : '保存修改'}
          </button>
          <button
            type="button"
            onClick={discardDraft}
            disabled={isSaving || isDiscarding}
            className="btn-ghost-themed rounded px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDiscarding ? '丢弃中...' : '丢弃草稿'}
          </button>
          <Link href="/profile/portfolio?category=reflection" className="btn-ghost-themed rounded px-4 py-2 text-sm">
            返回草稿列表
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="surface-card-soft flex flex-col items-center justify-center py-16">
      <span className="text-6xl">{icon}</span>
      <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-center text-subtle">{description}</p>
      {action && (
        <Link href={action.href} className="cta-primary mt-6 rounded-lg px-6 py-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}
