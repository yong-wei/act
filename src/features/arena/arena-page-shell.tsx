import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Bell,
  Bot,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  Home,
  LineChart,
  Map,
  Trophy,
  User,
} from 'lucide-react';

interface ArenaBreadcrumb {
  label: string;
  href: string;
}

interface ArenaPageShellProps {
  breadcrumbs: ArenaBreadcrumb[];
  activePath: string;
  children: ReactNode;
}

const projectEntries = [
  { label: '竞技场首页', href: '/arena', icon: Home },
  { label: '我的工作台', href: '/interactive-learning', icon: FlaskConical },
  { label: '我的方案', href: '/missions', icon: ClipboardList },
  { label: '课程资源', href: '/interactive-learning/courses', icon: GraduationCap },
  { label: '学习路线', href: '/knowledge', icon: Map },
  { label: '通知消息', href: '/classroom', icon: Bell },
  { label: 'AI 助教', href: '/ai/copilot', icon: Bot },
  { label: '成绩与统计', href: '/assessment', icon: LineChart },
  { label: '个人中心', href: '/profile', icon: User },
];

export function ArenaPageShell({ breadcrumbs, activePath, children }: ArenaPageShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f9ff] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="hidden bg-[#061b3c] text-white shadow-2xl shadow-blue-950/30 lg:flex lg:flex-col">
          <div className="flex h-[70px] items-center gap-3 rounded-br-xl bg-[#06142d] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="text-base font-semibold">智慧控制教学平台</div>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-5">
            {projectEntries.map((entry) => {
              const Icon = entry.icon;
              const active = activePath === entry.href || (entry.href !== '/arena' && activePath.startsWith(entry.href));
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-blue-100/84 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{entry.label}</span>
                  {active ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="px-5 py-5">
            <Link
              href="/support"
              className="flex items-center gap-3 rounded-lg bg-white/8 px-4 py-3 text-sm text-blue-50 hover:bg-white/12"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-200/70 text-xs">?</span>
              帮助与反馈
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/92 backdrop-blur">
            <div className="flex h-[70px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <nav className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <span key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-2">
                      {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                      {isLast ? (
                        <span className="truncate font-semibold text-slate-950">{item.label}</span>
                      ) : (
                        <Link href={item.href} className="truncate hover:text-blue-700">
                          {item.label}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </nav>
              <div className="hidden items-center gap-3 text-sm text-slate-700 sm:flex">
                <span className="rounded-full border border-blue-100 px-3 py-1">课程：自动控制原理</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <User className="h-4 w-4" />
                </span>
              </div>
            </div>
          </header>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
