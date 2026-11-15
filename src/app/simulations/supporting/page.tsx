import Link from 'next/link';
import { AppShell } from '@/components/platform/app-shell';
import { VESSEL_COURSES, VESSEL_GUIDE_EDITION, VESSEL_TEACHING_CARDS } from '@/resources/simulations/experiments/course-catalog';
import guideManifest from '../../../../public/supporting/teaching-guides.json';

interface SupportingMaterial {
  title: string;
  note: string;
  href?: string;
  fileLabel?: string;
}

function guideFileLabel(name: string) {
  const file = guideManifest.files.find((entry) => entry.name === name);
  return file ? `PDF · ${file.pages} 页 · ${(file.bytes / 1_000_000).toFixed(1)} MB` : 'PDF';
}

const materials: SupportingMaterial[] = [
  {
    title: '实验指导书汇编',
    note: '七份课程卡与二十步指导书，包含本人模型、独立对照、操作条件、评分和版本迁移。',
    href: '/supporting/experiment-guide-compilation.pdf',
    fileLabel: guideFileLabel('experiment-guide-compilation.pdf'),
  },
  {
    title: '平台功能与操作说明',
    note: '原场景操作、量测与预测、账号与断点恢复、控灵和报告复核说明。',
    href: '/supporting/platform-operation-manual.pdf',
    fileLabel: guideFileLabel('platform-operation-manual.pdf'),
  },
  {
    title: '产业对接证明材料',
    note: '上海外高桥造船有限公司出具并盖章，佐证本虚拟仿真实验项目的产业需求对接与产教融合。',
    href: '/supporting/industry-partnership-certificates.pdf',
    fileLabel: 'PDF · 1.2 MB',
  },
  {
    title: '软件著作权申请表',
    note: '本虚拟仿真实验平台的软件著作权登记申请表，个人证件信息已隐去。',
    href: '/supporting/software-copyright-application.pdf',
    fileLabel: 'PDF · 1.5 MB',
  },
];

const experimentGuides = Object.values(VESSEL_COURSES).map((course) => ({
  name: `实验${VESSEL_TEACHING_CARDS[course.key].number} · ${course.title}`,
  description: VESSEL_TEACHING_CARDS[course.key].mechanism,
  href: `/supporting/${course.guideFile}`,
  fileLabel: guideFileLabel(course.guideFile),
}));

export default function SimulationSupportingPage() {
  return (
    <AppShell
      viewerRole="student"
      activeHref="/simulations"
      sidebarMode="collapsible"
      title="支撑材料"
      subtitle="虚拟仿真实验的说明和申报材料"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '虚拟仿真', href: '/simulations' },
        { label: '支撑材料' },
      ]}
    >
      <main className="mx-auto max-w-5xl space-y-6">
        <p className="text-sm leading-6 text-subtle">
          指导书版本为 {VESSEL_GUIDE_EDITION}，包含七个实验各二十步及相应评分要求。产业与著作权材料可在此查阅。
        </p>
        <ul className="grid gap-3">
          {materials.map((item) => (
            <li
              key={item.title}
              className="surface-card rounded-lg p-4"
              {...(item.href
                ? { 'data-supporting-material': item.title }
                : { 'data-supporting-placeholder': item.title })}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm text-subtle">{item.note}</p>
                </div>
                {item.href ? (
                  <div className="flex shrink-0 items-center gap-3">
                    {item.fileLabel ? <span className="text-xs text-subtle">{item.fileLabel}</span> : null}
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      data-supporting-material-open={item.title}
                    >
                      查看材料
                    </a>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <section aria-label="各实验单独指导书" data-supporting-experiment-guides="seven-experiments">
          <h2 className="text-lg font-semibold">各实验单独指导书</h2>
          <p className="mt-1 text-sm text-subtle">按实验拆分的指导书，可在进入对应实验前单独阅读；每个实验页面内也提供同样的入口。</p>
          <ul className="mt-3 grid gap-2">
            {experimentGuides.map((guide) => (
              <li
                key={guide.href}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                data-supporting-experiment-guide={guide.name}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{guide.name}</p>
                  <p className="mt-0.5 text-xs text-subtle">{guide.description}</p>
                  <p className="mt-1 text-xs text-subtle">{guide.fileLabel}</p>
                </div>
                <a
                  href={guide.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:border-primary/50"
                  data-supporting-experiment-guide-open={guide.name}
                >
                  查看指导书
                </a>
              </li>
            ))}
          </ul>
        </section>

        <Link href="/simulations" className="inline-flex text-sm text-primary">返回仿真目录</Link>
      </main>
    </AppShell>
  );
}
