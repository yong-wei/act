import Link from 'next/link';

import { AdminConsoleHeader } from './admin-console-header';
import { ADMIN_CONSOLE_ENTRIES, type AdminConsoleUser } from './admin-console-config';

type AdminConsoleHomeProps = {
  currentUser: AdminConsoleUser;
};

export function AdminConsoleHome({ currentUser }: AdminConsoleHomeProps) {
  return (
    <div className="admin-console-shell">
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin"
        eyebrow="管理总台"
        title="管理员后台"
        description="将后台操作分为四条明确通道：用户管理、系统使用量统计、数据治理、系统配置。入口统一放在这里，避免页面间跳转分散、权限职责混杂。"
      />

      <main className="admin-console-container py-8">
        <section className="grid gap-5 lg:grid-cols-4">
          {ADMIN_CONSOLE_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link key={entry.href} href={entry.href} className="admin-console-link-card group">
                <div className="flex items-center justify-between">
                  <span className="admin-console-kicker">{entry.eyebrow}</span>
                  <span className="admin-console-icon-badge">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-8 space-y-3">
                  <h2 className="admin-console-title text-xl font-semibold">{entry.title}</h2>
                  <p className="admin-console-muted text-sm leading-6">{entry.description}</p>
                </div>
                <div className="mt-8 flex items-center justify-between text-sm">
                  <span className="admin-console-chip">进入页面</span>
                  <span className="admin-console-link-text transition group-hover:translate-x-1">
                    打开
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
