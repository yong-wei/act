'use client';

/**
 * 我的学习档案页面
 *
 * 展示学生代表性作品、高质量提示词、仿真设计等
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserMenu } from '@/components/shared/user-menu';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import { buildAiAuditTaskState, buildPortfolioReflectionDraft } from '@/lib/ai-task-boundary-contracts';
import {
  buildFeedbackTaskContext,
  buildPortfolioFeedbackDraft,
  shouldRenderPortfolioFeedbackTask,
  type PortfolioFeedbackDraft,
} from '@/lib/student-feedback-task-contract';

interface PortfolioData {
  // Representative works from classroom sessions
  classWorks: Array<{
    id: string;
    title: string;
    type: string;
    content: string;
    createdAt: string;
    sessionName?: string;
  }>;
  // Quality prompt designs
  promptDesigns: Array<{
    id: string;
    prompt: string;
    score: number;
    feedback: string;
    createdAt: string;
  }>;
  // Simulation designs
  simulationDesigns: Array<{
    id: string;
    name: string;
    score: number;
    parameters: Record<string, number>;
    createdAt: string;
  }>;
  // Ethics remediation cases
  ethicsCases: Array<{
    id: string;
    violationType: string;
    description: string;
    remediationAction: string;
    createdAt: string;
  }>;
  // AI collaboration reflections
  reflections: Array<{
    id: string;
    content: string;
    category: string;
    createdAt: string;
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
  const reflectionDraft = reflectionIntent === 'create'
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
  const feedbackPortfolioDraft = feedbackContext
    ? buildPortfolioFeedbackDraft(feedbackContext)
    : null;
  const hasLocalPortfolioTask = Boolean(reflectionDraft || feedbackPortfolioDraft);
  const [activeTab, setActiveTab] = useState<'works' | 'prompts' | 'simulations' | 'ethics' | 'reflections'>(
    hasLocalPortfolioTask ? 'reflections' : 'works',
  );

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      // For now, generate mock data from existing data sources
      // In production, this would be a dedicated API endpoint
      const mockData: PortfolioData = {
        classWorks: [],
        promptDesigns: [],
        simulationDesigns: [],
        ethicsCases: [],
        reflections: [],
      };

      // Fetch simulation logs for designs
      const simResponse = await fetch('/api/simulation/cruise-summary-insight');
      if (simResponse.ok) {
        const simData = await simResponse.json();
        if (simData.designs) {
          mockData.simulationDesigns = simData.designs.slice(0, 5);
        }
      }

      // Fetch prompt assessments
      const promptResponse = await fetch('/api/evaluation/prompt-history/' + session?.user?.id);
      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        if (promptData.prompts) {
          mockData.promptDesigns = promptData.prompts
            .filter((p: { score: number }) => p.score >= 70)
            .slice(0, 5);
        }
      }

      // Fetch ethics logs
      const ethicsResponse = await fetch('/api/ethics/violation');
      if (ethicsResponse.ok) {
        const ethicsData = await ethicsResponse.json();
        if (ethicsData.violations) {
          mockData.ethicsCases = ethicsData.violations
            .filter((v: { isResolved: boolean }) => v.isResolved)
            .slice(0, 5);
        }
      }

      setPortfolio(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (session.user.role !== 'STUDENT') {
        router.replace('/dashboard');
        return;
      }
      void fetchPortfolio();
    }
  }, [status, session, router, fetchPortfolio]);

  useEffect(() => {
    if (searchParams.get('category') === 'reflection' || feedbackPortfolioDraft) {
      setActiveTab('reflections');
    }
  }, [feedbackPortfolioDraft, searchParams]);

  if (status === 'authenticated' && session?.user?.role !== 'STUDENT') {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="learner-record">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">正在返回教师工作台...</p>
        </div>
      </div>
    );
  }

  if (status === 'loading' || (loading && !hasLocalPortfolioTask)) {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="learner-record">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载档案数据...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="learner-record">
        <div className="text-center">
          <p className="text-xl text-subtle">请先登录</p>
          <Link href="/login" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="learner-record">
        <div className="text-center">
          <p className="text-xl text-red-500">{error}</p>
          <button type="button" onClick={fetchPortfolio} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
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
    <div
      className="surface-page"
      data-commercial-workspace="learner-record"
      data-ai-local-task-surface={reflectionDraft || feedbackPortfolioDraft ? 'portfolio-reflection' : undefined}
      data-ai-task-focus-mode={reflectionDraft || feedbackPortfolioDraft ? 'local-first' : undefined}
      data-task-workspace-archetype={reflectionDraft || feedbackPortfolioDraft ? 'ai-local-task' : undefined}
    >
      {/* Header */}
      <header className="surface-topbar px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-subtle transition hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-foreground">我的学习档案</h1>
          </div>
          <UserMenu user={{ name: session?.user?.name, email: session?.user?.email, role: session?.user?.role }} />
        </div>
      </header>

      <main className="px-6 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] pt-8 md:pb-8">
        <StudentFeedbackTaskPanel context={feedbackContext} surface="portfolio" className="mb-6" />
        {/* Introduction Card */}
        <div className="surface-card mb-8 bg-gradient-to-br from-card via-card to-violet-500/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20 text-violet-500">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">学习成长档案</h2>
              <p className="mt-1 text-subtle">
                记录你的学习历程，展示优秀作品，见证成长轨迹
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white'
                  : 'surface-card-soft text-subtle hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'works' && <ClassWorksTab works={portfolio?.classWorks || []} />}
          {activeTab === 'prompts' && <PromptDesignsTab designs={portfolio?.promptDesigns || []} />}
          {activeTab === 'simulations' && <SimulationDesignsTab designs={portfolio?.simulationDesigns || []} />}
          {activeTab === 'ethics' && <EthicsCasesTab cases={portfolio?.ethicsCases || []} />}
          {activeTab === 'reflections' && (
            <ReflectionsTab
              reflections={portfolio?.reflections || []}
              draft={reflectionDraft}
              feedbackDraft={feedbackPortfolioDraft}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ClassWorksTab({ works }: { works: PortfolioData['classWorks'] }) {
  if (works.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="暂无课堂作品"
        description="参与互动课程后，你的优秀作品将在这里展示"
        action={{ label: '进入互动课程', href: '/interactive-learning' }}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {works.map((work) => (
        <div key={work.id} className="surface-card-soft p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-500">
                {work.type}
              </span>
              {work.sessionName && (
                <span className="text-xs text-subtle">{work.sessionName}</span>
              )}
            </div>
            <span className="text-xs text-subtle">
              {new Date(work.createdAt).toLocaleDateString('zh-CN')}
            </span>
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
        action={{ label: '练习提示词设计', href: '/evaluation/prompt-assessment' }}
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
            <span className="text-xs text-subtle">
              {new Date(design.createdAt).toLocaleDateString('zh-CN')}
            </span>
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

function SimulationDesignsTab({ designs }: { designs: PortfolioData['simulationDesigns'] }) {
  if (designs.length === 0) {
    return (
      <EmptyState
        icon="🚢"
        title="暂无仿真设计记录"
        description="完成仿真任务后，你的设计方案将在这里展示"
        action={{ label: '开始仿真', href: '/simulations/destroyer' }}
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
              <span className="text-lg font-bold text-emerald-500">{design.score}</span>
              <span className="text-xs text-subtle">分</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(design.parameters || {}).slice(0, 4).map(([key, value]) => (
              <div key={key} className="rounded bg-accent/50 px-3 py-2">
                <p className="text-xs text-subtle">{key}</p>
                <p className="font-mono text-sm text-foreground">{typeof value === 'number' ? value.toFixed(2) : value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">
            {new Date(design.createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
      ))}
    </div>
  );
}

function EthicsCasesTab({ cases }: { cases: PortfolioData['ethicsCases'] }) {
  if (cases.length === 0) {
    return (
      <EmptyState
        icon="⚖️"
        title="暂无伦理整改记录"
        description="良好的工程伦理意识是优秀工程师的基础，继续保持！"
        action={{ label: '了解工程伦理', href: '/ethics' }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((item) => (
        <div key={item.id} className="surface-card-soft border-l-4 border-green-500 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-500">
                已整改
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
            <span className="text-xs text-subtle">
              {new Date(item.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
          <p className="mt-2 text-sm text-subtle">{item.description}</p>
          {item.remediationAction && (
            <div className="mt-3 flex items-start gap-2 rounded bg-green-500/5 p-3">
              <svg className="mt-0.5 h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
}: {
  reflections: PortfolioData['reflections'];
  draft?: ReturnType<typeof buildPortfolioReflectionDraft> | null;
  feedbackDraft?: PortfolioFeedbackDraft | null;
}) {
  const [draftDisposition, setDraftDisposition] = useState<'candidate' | 'saved-draft' | 'discarded'>('candidate');

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
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {feedbackDraft.status}
            </span>
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
    const isSavedDraft = draftDisposition === 'saved-draft';
    const isDiscarded = draftDisposition === 'discarded';
    const state = buildAiAuditTaskState({
      taskType: 'portfolio-reflection',
      status: isDiscarded ? 'blocked' : isSavedDraft ? 'succeeded' : 'pending',
      message: isDiscarded
        ? '作品集反思草稿候选已丢弃，未写入学习档案。'
        : isSavedDraft
          ? '作品集反思已标记为本页草稿，本页尚未发布到学习档案。'
          : '作品集反思草稿候选已创建，本页尚未保存到学习档案。',
      nextAction: isDiscarded
        ? '重新生成候选或返回反思页'
        : isSavedDraft
          ? '继续整理后再执行正式保存或发布'
          : '返回反思页继续整理、标记本页草稿或丢弃候选',
      targetId: draft.id,
    });
    return (
      <div className="space-y-4">
        <ActionStatusPanel state={state} />
        <div className="surface-card-soft p-5" data-ai-task-boundary="portfolio-reflection-draft" data-task-workspace-zone="local-primary-input">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {draftDisposition === 'candidate' ? draft.status : draftDisposition}
            </span>
            <span className="text-xs text-subtle">来源：{draft.source}</span>
          </div>
          <h3 className="mt-3 font-medium text-foreground">{draft.title}</h3>
          <p className="mt-2 text-sm text-subtle">{draft.detail}</p>
          <div className="mt-3 rounded border border-border/70 bg-background/70 px-3 py-2 text-xs text-subtle">
            任务：{draft.assignment ?? 'portfolio-reflection'} · 意图：{draft.intent} · 输出：{draft.outputTarget} · 晋升策略：{draft.promotionPolicy}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraftDisposition('saved-draft')}
              className="btn-ghost-themed rounded px-4 py-2 text-sm"
              data-primary-task-input="portfolio-reflection-draft"
            >
              标记本页草稿
            </button>
            <button type="button" onClick={() => setDraftDisposition('discarded')} className="btn-ghost-themed rounded px-4 py-2 text-sm">
              丢弃候选
            </button>
            <Link href="/profile/portfolio?category=reflection" className="btn-ghost-themed rounded px-4 py-2 text-sm">
              返回反思页
            </Link>
            <Link href="/ai/copilot?context=portfolio-reflection&source=portfolio" className="btn-ghost-themed rounded px-4 py-2 text-sm">
              重新生成候选
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (reflections.length === 0) {
    return (
      <EmptyState
        icon="🤔"
        title="暂无AI协作反思"
        description="记录你与AI助手的协作反思，持续优化使用策略"
        action={{ label: '开始反思', href: '/ai/copilot?context=portfolio-reflection&source=portfolio' }}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reflections.map((reflection) => (
        <div key={reflection.id} className="surface-card-soft p-5">
          <div className="flex items-center justify-between">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {reflection.category}
            </span>
            <span className="text-xs text-subtle">
              {new Date(reflection.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
          <p className="mt-3 text-foreground">{reflection.content}</p>
        </div>
      ))}
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
