import Link from 'next/link';
import { AppShell } from '@/components/platform/app-shell';

interface SupportingMaterial {
  title: string;
  note: string;
  href?: string;
  fileLabel?: string;
}

const materials: SupportingMaterial[] = [
  { title: '实验指导书', note: '占位。正式稿接入后替换。' },
  { title: '操作说明', note: '占位。正式稿接入后替换。' },
  {
    title: '产业对接证明材料',
    note: '上海外高桥造船有限公司出具并盖章，佐证本虚拟仿真实验项目的产业需求对接与产教融合。',
    href: '/supporting/industry-partnership-certificates.pdf',
    fileLabel: 'PDF · 1.2 MB',
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
      <main className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm leading-6 text-subtle">
          这里集中放置七个仿真实验的支撑材料。产业对接证明材料已接入正式文件，其余条目仍在占位，正式文件接入后替换。
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
        <Link href="/simulations" className="inline-flex text-sm text-primary">返回仿真目录</Link>
      </main>
    </AppShell>
  );
}
