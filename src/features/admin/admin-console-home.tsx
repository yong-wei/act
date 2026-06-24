import Link from 'next/link';

import { AdminConsoleHeader } from './admin-console-header';
import { ADMIN_CONSOLE_ENTRIES, type AdminConsoleUser } from './admin-console-config';
import { ADMIN_OPERATIONS_CONSOLE_DOMAINS } from './teacher-admin-governance-workspaces';

type AdminConsoleHomeProps = {
  currentUser: AdminConsoleUser;
};

export function AdminConsoleHome({ currentUser }: AdminConsoleHomeProps) {
  const futureDomains = ADMIN_OPERATIONS_CONSOLE_DOMAINS.filter((domain) => domain.state === 'future');
  const availableDomains = ADMIN_OPERATIONS_CONSOLE_DOMAINS.filter((domain) => domain.state === 'available');
  const riskActions = [
    {
      id: 'governance-source-repair',
      label: '治理源检查',
      state: '需要持续刷新',
      description: '检查学习事实、快照队列、来源覆盖和隐私范围。',
      href: '/admin/data-governance',
      action: '查看治理风险',
    },
    {
      id: 'user-role-review',
      label: '用户与角色',
      state: '导入/权限待确认',
      description: '处理账号导入、角色调整、密码重置和权限边界。',
      href: '/admin/users',
      action: '进入用户管理',
    },
    {
      id: 'system-config-review',
      label: '系统配置',
      state: '保存前需校验',
      description: '核对基础参数、AI 供应商、模型配置和测试结果。',
      href: '/admin/config',
      action: '检查配置',
    },
    {
      id: 'usage-state-review',
      label: '使用态势',
      state: '关注新鲜度',
      description: '观察访问量、互动分布、仿真活跃度和月度趋势。',
      href: '/admin/states',
      action: '查看使用态势',
    },
  ] as const;

  return (
    <div
      className="admin-console-shell"
      data-commercial-operations-workspace="admin-operations"
      data-commercial-workspace-zone="context-strip"
      data-operations-status-semantics="ready"
    >
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin"
        eyebrow="管理总台"
        title="管理员后台"
        description="将后台操作分为四条明确通道：用户管理、系统使用量统计、数据治理、系统配置。入口统一放在这里，避免页面间跳转分散、权限职责混杂。"
      >
        <div
          data-operations-first-viewport="admin-risk-actions"
          data-admin-operations-risk-queue
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="admin-console-kicker">运营判断</p>
              <h2 className="admin-console-title mt-2 text-2xl font-semibold">先处理风险、配置和治理修复</h2>
              <p className="admin-console-muted mt-2 max-w-3xl text-sm leading-6">
                管理首页先呈现需要关注的对象、下一步动作和治理归宿；目录入口保留在下方作为稳定导航。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableDomains.slice(1, 4).map((domain) => (
                <Link key={domain.id} href={domain.href} className="admin-console-chip">
                  {domain.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {riskActions.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-lg border border-[var(--admin-console-border)] bg-[var(--admin-console-muted)] p-4 transition hover:border-[var(--admin-console-accent)]"
                data-admin-operations-pending-action={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="admin-console-kicker">{item.label}</p>
                    <h3 className="admin-console-title mt-2 text-lg font-semibold">{item.state}</h3>
                  </div>
                  <span className="admin-console-chip">action</span>
                </div>
                <p className="admin-console-muted mt-3 min-h-[72px] text-sm leading-6">{item.description}</p>
                <span className="admin-console-link-text mt-4 inline-flex text-sm">
                  {item.action}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </AdminConsoleHeader>

      <main className="admin-console-container py-8">
        <section className="mt-6 grid gap-5 lg:grid-cols-4" aria-label="管理通道目录">
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

        {futureDomains.length > 0 && (
          <section className="mt-6 grid gap-5 lg:grid-cols-2" data-admin-operations-future-domains>
            {futureDomains.map((domain) => (
              <div
                key={domain.id}
                className="admin-console-surface p-5"
                data-operations-unavailable-slot={domain.id}
                data-operations-unavailable-state="feature-flagged"
                data-operations-fabricates-metrics="false"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="admin-console-kicker">未来管理域</p>
                    <h2 className="admin-console-title mt-2 text-lg font-semibold">{domain.label}</h2>
                  </div>
                  <span className="admin-console-chip">feature-flagged</span>
                </div>
                <p className="admin-console-muted mt-3 text-sm leading-6">
                  该管理域尚未开放，仅保留控制台位置和相邻操作，不展示模型或系统健康占位指标。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {domain.actions.map((action) => (
                    <span key={action} className="admin-console-chip">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
