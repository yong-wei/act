import Link from 'next/link';
import { AppShell } from '@/components/platform/app-shell';

const materials = [
  { title: '实验指导书', note: '占位。正式稿接入后替换。' },
  { title: '操作说明', note: '占位。正式稿接入后替换。' },
  { title: '测试与申报材料', note: '占位。正式稿接入后替换。' },
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
          这里集中放置七个仿真实验的支撑材料。当前条目是占位，正式文件接入后替换。
        </p>
        <ul className="grid gap-3">
          {materials.map((item) => (
            <li key={item.title} className="surface-card rounded-lg p-4" data-supporting-placeholder={item.title}>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-subtle">{item.note}</p>
            </li>
          ))}
        </ul>
        <Link href="/simulations" className="inline-flex text-sm text-primary">返回仿真目录</Link>
      </main>
    </AppShell>
  );
}
