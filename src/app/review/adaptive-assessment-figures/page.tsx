import { Camera, ExternalLink, Layers } from 'lucide-react';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

type FigureEntry = {
  id: string;
  title: string;
  description: string;
  targetHref: string;
  screenshotName: string;
};

const figureEntries: FigureEntry[] = [
  {
    id: 'A',
    title: '图 A：题库稳定性与标准化评测',
    description: '展示能力诊断、薄弱点识别与经典题结构化展示，匹配“经典题保持 + 评测标准统一”。',
    targetHref: '/assessment/adaptive-practice?demo=1&scene=stable',
    screenshotName: 'adaptive-figure-a.png',
  },
  {
    id: 'B',
    title: '图 B：差异化生成与个性化训练',
    description: '展示 AI 现场生成题目、能力值 θ 与置信区间、补强建议，匹配“满足个性需求”。',
    targetHref: '/assessment/adaptive-practice?demo=1&scene=generate',
    screenshotName: 'adaptive-figure-b.png',
  },
  {
    id: 'C',
    title: '图 C：结构化评价常态化',
    description: '展示提示词质量仪表盘、一致性报告与趋势追踪，匹配“结构型能力 + 评价常态化”。',
    targetHref: '/evaluation/prompt-assessment?autodemo=1',
    screenshotName: 'adaptive-figure-c.png',
  },
];

export default function AdaptiveAssessmentFiguresPage() {
  return (
    <main className="surface-page">
      <FeaturePageNav title="自适应测评三图聚合预览" backHref="/review" backLabel="返回评审入口" />
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            <Layers className="h-3.5 w-3.5" />
            报告配图工作台
          </div>
          <h1 className="mt-3 text-2xl font-semibold">自适应测评三图聚合预览</h1>
          <p className="mt-2 text-sm text-slate-300">
            每个卡片均对应报告模板中的一个空白位。可直接在本页预览并按截图文件名导出。
          </p>
        </header>

        <section className="grid gap-5">
          {figureEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-white">{entry.title}</h2>
                  <p className="mt-1 text-sm text-slate-300">{entry.description}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={entry.targetHref}
                    className="inline-flex items-center gap-1 rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开原页面
                  </a>
                  <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                    <Camera className="h-3.5 w-3.5" />
                    {entry.screenshotName}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                <iframe
                  src={entry.targetHref}
                  className="h-[420px] w-full"
                  title={entry.title}
                  loading="lazy"
                />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
