import Link from 'next/link';
import { AppShell } from '@/components/platform/app-shell';

interface SupportingMaterial {
  title: string;
  note: string;
  href?: string;
  fileLabel?: string;
}

const materials: SupportingMaterial[] = [
  {
    title: '实验指导书汇编',
    note: '七个正式实验的完整指导书，覆盖实验目的、二十步操作步骤、读数方法、界面图解和注意事项。',
    href: '/supporting/experiment-guide-compilation.pdf',
    fileLabel: 'PDF · 7.7 MB',
  },
  {
    title: '平台功能与操作说明',
    note: '面向学生操作与评审查阅的平台说明，覆盖七个实验的通用二十步流程、真实界面与曲线读图。',
    href: '/supporting/platform-operation-manual.pdf',
    fileLabel: 'PDF · 8.4 MB',
  },
  {
    title: '产业对接证明材料',
    note: '上海外高桥造船有限公司出具并盖章，佐证本虚拟仿真实验项目的产业需求对接与产教融合。',
    href: '/supporting/industry-partnership-certificates.pdf',
    fileLabel: 'PDF · 1.2 MB',
  },
];

const experimentGuides: Array<{ name: string; description: string; href: string }> = [
  {
    name: '实验01 · 055 型驱逐舰航向控制',
    description: '直航、手操打舵、回中、小角度和直角转向，PID 参数观察。',
    href: '/supporting/guide-01-destroyer.pdf',
  },
  {
    name: '实验02 · 长恒号 LNG 大惯性操纵',
    description: '大惯性液化气船的直航、打舵、回中与靠泊低速。',
    href: '/supporting/guide-02-lng-carrier.pdf',
  },
  {
    name: '实验03 · MSC 集装箱船航速与准点',
    description: '高速与经济航速对比、空载横风扰动和准时到达。',
    href: '/supporting/guide-03-container.pdf',
  },
  {
    name: '实验04 · 爱达·魔都号邮轮舒适性操纵',
    description: '减摇鳍开关对比、横摇与不适指数读数、航向保持。',
    href: '/supporting/guide-04-cruise.pdf',
  },
  {
    name: '实验05 · 海洋石油981动力定位',
    description: '定点读数、解耦开关对比与重新守点。',
    href: '/supporting/guide-05-drilling-platform.pdf',
  },
  {
    name: '实验06 · 雪龙号吊舱与冰区控制',
    description: '吊舱角度读数、开阔水域与冰区操纵对比。',
    href: '/supporting/guide-06-icebreaker.pdf',
  },
  {
    name: '实验07 · 天鲸号挖泥船工况切换',
    description: '定位、疏浚作业与退出定位的船位保持。',
    href: '/supporting/guide-07-dredger.pdf',
  },
];

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
          这里集中放置七个仿真实验的支撑材料：实验指导书汇编、平台操作说明和各实验的单独指导书均已接入正式文件。
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
