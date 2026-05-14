'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Download,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminConsoleHeader } from './admin-console-header';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

type OverviewResponse = {
  totals: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    missions: number;
    simulations: number;
    llmSessions: number;
    ethicalLogs: number;
  };
  activity: {
    newUsers7d: number;
    activeSessions: number;
    simulations7d: number;
    violations7d: number;
  };
  recentViolations: Array<{
    id: string;
    violationType: string;
    createdAt: string;
    isResolved: boolean;
    student: {
      id: string;
      name: string | null;
      email: string | null;
      studentNumber: string | null;
    };
  }>;
};

type UserItem = {
  id: string;
  name: string | null;
  email: string | null;
  employeeNumber?: string | null;
  role: UserRole;
  createdAt: string;
  profile?: {
    studentNumber: string | null;
    className: string | null;
  } | null;
};

type AdminDashboardProps = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: 'ADMIN';
  };
};

type ImportErrorItem = {
  row: number;
  account?: string;
  reason: string;
};

type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  skippedEmpty?: number;
  totalRows?: number;
  errors?: ImportErrorItem[];
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  STUDENT: '学生',
};

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: 'admin-console-pill admin-console-pill-admin',
  TEACHER: 'admin-console-pill admin-console-pill-teacher',
  STUDENT: 'admin-console-pill admin-console-pill-student',
};

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetToDefault, setResetToDefault] = useState(true);
  const [resetPassword, setResetPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'STUDENT' as UserRole,
    studentNumber: '',
    employeeNumber: '',
    className: '',
    password: '',
  });

  const pageSize = 12;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalUsers / pageSize)),
    [totalUsers]
  );

  const formattedNow = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
    []
  );

  const showNotice = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('获取总览信息失败');
      }
      const data = (await res.json()) as OverviewResponse;
      setOverview(data);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '获取总览信息失败');
    } finally {
      setLoadingOverview(false);
    }
  }, [showNotice]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (roleFilter !== 'ALL') {
        params.set('role', roleFilter);
      }
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('获取账号列表失败');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotalUsers(data.total ?? 0);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '获取账号列表失败');
    } finally {
      setLoadingUsers(false);
    }
  }, [page, roleFilter, search, showNotice]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = () => {
    fetchOverview();
    fetchUsers();
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error?.formErrors?.[0] || error?.error || '创建账号失败');
      }

      setCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        role: 'STUDENT',
        studentNumber: '',
        employeeNumber: '',
        className: '',
        password: '',
      });
      showNotice('success', '账号已创建');
      fetchUsers();
      fetchOverview();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '创建账号失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (!confirm(`确认删除账号 ${user.name ?? '未命名'}？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payloadText = await res.text();
        let message = '删除失败';
        if (payloadText) {
          try {
            const payload = JSON.parse(payloadText);
            message = payload?.error || message;
          } catch {
            message = payloadText;
          }
        }
        throw new Error(message);
      }
      showNotice('success', '账号已删除');
      fetchUsers();
      fetchOverview();
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '删除失败');
    }
  };

  const openReset = (user: UserItem) => {
    setResetTarget(user);
    setResetToDefault(true);
    setResetPassword('');
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;

    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToDefault,
          password: resetToDefault ? undefined : resetPassword,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || '修改密码失败');
      }

      setResetOpen(false);
      showNotice('success', '密码已更新');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '修改密码失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/users/template');
      if (!res.ok) {
        throw new Error('下载模板失败');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'users-template.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '下载模板失败');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || '导入失败');
      }
      const result = (await res.json()) as ImportResult;
      setImportResult(result);
      showNotice(
        'success',
        `导入完成：新增 ${result.created ?? 0}，更新 ${result.updated ?? 0}，失败 ${result.failed ?? 0}`
      );
      fetchUsers();
      fetchOverview();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const overviewCards = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: '用户资产总览',
        value: overview.totals.users,
        meta: `学生 ${overview.totals.students} · 教师 ${overview.totals.teachers}`,
        icon: Users,
      },
      {
        title: '活跃会话',
        value: overview.activity.activeSessions,
        meta: `近7天新增 ${overview.activity.newUsers7d}`,
        icon: Activity,
      },
      {
        title: '伦理风险',
        value: overview.totals.ethicalLogs,
        meta: `7日违规 ${overview.activity.violations7d}`,
        icon: AlertTriangle,
      },
    ];
  }, [overview]);

  return (
    <div className="admin-console-shell">
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin/users"
        backHref="/admin"
        eyebrow="账号体系"
        title="用户管理"
        description="账号资产、角色权限、密码重置和批量导入统一放在这里处理。页面颜色由全局后台样式控制，浅色模式不再回退到深色填充。"
        chips={
          <>
            <span className="admin-console-chip">
              当前登录：{currentUser.name || currentUser.email || '管理员'}
            </span>
            <span className="admin-console-chip">{formattedNow}</span>
          </>
        }
        actions={
          <button onClick={handleRefresh} className="admin-console-button">
            <RefreshCcw className="h-4 w-4" />
            刷新数据
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="admin-console-metric-card">
                <div className="flex items-center justify-between">
                  <span className="admin-console-kicker">{card.title}</span>
                  <span className="admin-console-icon-badge">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-6">
                  <p className="admin-console-title text-3xl font-semibold">
                    {loadingOverview ? '...' : card.value}
                  </p>
                  <p className="admin-console-muted mt-2 text-sm">{card.meta}</p>
                </div>
              </div>
            );
          })}
        </div>
      </AdminConsoleHeader>

      <main className="admin-console-container grid gap-6 py-8 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-4">
          <div className="admin-console-surface">
            <span className="admin-console-kicker">操作区</span>
            <div className="mt-4 space-y-3">
              <button
                onClick={() => setCreateOpen(true)}
                className="admin-console-button-primary w-full justify-between"
              >
                新建账号
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="admin-console-button w-full justify-between"
              >
                下载模板
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="admin-console-button w-full justify-between"
              >
                批量导入
                <UploadCloud className="h-4 w-4" />
              </button>
              <Link href="/admin/config" className="admin-console-nav-item">
                <Settings className="h-4 w-4" />
                打开系统配置
              </Link>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleImport(file);
                  }
                  event.target.value = '';
                }}
              />
            </div>
            <p className="admin-console-muted mt-4 text-xs leading-5">
              模板前三列必填：账号、姓名、角色。其余字段按角色选填。
            </p>
          </div>

          {importResult && (
            <div className="admin-console-surface-soft">
              <span className="admin-console-kicker">导入结果</span>
              <div className="admin-console-muted mt-3 space-y-2 text-sm">
                <p>
                  新增 {importResult.created ?? 0}，更新 {importResult.updated ?? 0}，失败 {importResult.failed ?? 0}
                </p>
                {typeof importResult.totalRows === 'number' && (
                  <p>
                    数据行数 {importResult.totalRows}，空行跳过 {importResult.skippedEmpty ?? 0}
                  </p>
                )}
                {(importResult.errors?.length ?? 0) > 0 && (
                  <div className="admin-console-notice admin-console-notice-danger mt-3 max-h-40 overflow-y-auto text-xs">
                    {importResult.errors?.map((item, index) => (
                      <p key={`${item.row}-${index}`}>
                        第 {item.row} 行{item.account ? `（${item.account}）` : ''}：{item.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="admin-console-surface-soft">
            <span className="admin-console-kicker">当前页面</span>
            <div className="mt-3 space-y-2">
              <div className="admin-console-nav-item admin-console-nav-item-active">用户管理</div>
              <div className="admin-console-muted text-xs leading-5">
                其他后台入口已收口至管理后台首页，避免在业务页里分散入口。
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {notice && (
            <div
              className={`admin-console-notice ${
                notice.type === 'success'
                  ? 'admin-console-notice-success'
                  : 'admin-console-notice-danger'
              }`}
            >
              {notice.message}
            </div>
          )}

          <div className="admin-console-surface">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="admin-console-kicker">账号视图</span>
                <h2 className="admin-console-title mt-2 text-2xl font-semibold">账号列表</h2>
                <p className="admin-console-muted mt-2 text-sm">
                  按角色、姓名、账号或学号筛选，并在右侧查看详情与执行敏感操作。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 admin-console-muted" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜索姓名/账号/学号"
                    className="admin-console-input w-64 pl-9"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(event) => {
                    setRoleFilter(event.target.value as UserRole | 'ALL');
                    setPage(1);
                  }}
                  className="admin-console-select"
                >
                  <option value="ALL">全部角色</option>
                  <option value="ADMIN">管理员</option>
                  <option value="TEACHER">教师</option>
                  <option value="STUDENT">学生</option>
                </select>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="admin-console-button-primary"
                >
                  <Plus className="h-4 w-4" />
                  新建账号
                </button>
              </div>
            </div>

            <div className="admin-console-table-shell mt-6">
              <table className="admin-console-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3">账号信息</th>
                    <th className="px-4 py-3">学号/工号</th>
                    <th className="px-4 py-3">角色</th>
                    <th className="px-4 py-3">创建时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                        正在加载账号列表…
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                        暂无账号数据
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <div className="admin-console-title font-medium">{user.name || '未命名'}</div>
                          <div className="admin-console-table-subtle mt-1 text-xs">
                            {user.email || user.employeeNumber || user.profile?.studentNumber || '未绑定账号'}
                          </div>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle">
                          {user.profile?.studentNumber || user.employeeNumber || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={ROLE_STYLES[user.role]}>{ROLE_LABELS[user.role]}</span>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle">
                          {new Intl.DateTimeFormat('zh-CN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(user.createdAt))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="admin-console-button px-3 py-1.5 text-xs"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => openReset(user)}
                              className="admin-console-button px-3 py-1.5 text-xs"
                            >
                              改密
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="admin-console-button admin-console-tone-danger px-3 py-1.5 text-xs"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="admin-console-muted text-sm">
                共 {totalUsers} 条 · 第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="admin-console-button px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="admin-console-button px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="admin-console-surface">
            <span className="admin-console-kicker">风险提示</span>
            <div className="mt-4 space-y-3">
              {overview?.recentViolations.length ? (
                overview.recentViolations.map((violation) => (
                  <div key={violation.id} className="admin-console-surface-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="admin-console-title text-sm font-semibold">
                          {violation.student.name || '未命名学生'}
                        </p>
                        <p className="admin-console-muted mt-1 text-xs">{violation.violationType}</p>
                      </div>
                      <span
                        className={`admin-console-chip ${
                          violation.isResolved ? 'admin-console-tone-success' : 'admin-console-tone-danger'
                        }`}
                      >
                        {violation.isResolved ? '已处理' : '待处理'}
                      </span>
                    </div>
                    <p className="admin-console-muted mt-3 text-xs">
                      {new Intl.DateTimeFormat('zh-CN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(violation.createdAt))}
                    </p>
                  </div>
                ))
              ) : (
                <div className="admin-console-surface-soft admin-console-muted text-sm">
                  暂无违规记录
                </div>
              )}
            </div>
          </div>

          <div className="admin-console-surface">
            <span className="admin-console-kicker">账号详情</span>
            {selectedUser ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="admin-console-title text-xl font-semibold">
                    {selectedUser.name || '未命名'}
                  </p>
                  <p className="admin-console-muted mt-1 text-sm">
                    {selectedUser.email || selectedUser.employeeNumber || '-'}
                  </p>
                </div>
                <div className="admin-console-surface-soft grid gap-2 text-sm">
                  <div>角色：{ROLE_LABELS[selectedUser.role]}</div>
                  <div>学号：{selectedUser.profile?.studentNumber || '-'}</div>
                  <div>班级：{selectedUser.profile?.className || '-'}</div>
                  <div>工号：{selectedUser.employeeNumber || '-'}</div>
                  <div>
                    创建时间：
                    {new Intl.DateTimeFormat('zh-CN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(selectedUser.createdAt))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReset(selectedUser)}
                    className="admin-console-button flex-1 justify-center"
                  >
                    修改密码
                  </button>
                  <button
                    onClick={() => handleDelete(selectedUser)}
                    className="admin-console-button admin-console-tone-danger flex-1 justify-center"
                  >
                    删除账号
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-console-surface-soft admin-console-muted mt-4 text-sm">
                选择账号后，可在这里查看详情并执行敏感操作。
              </div>
            )}
          </div>
        </aside>
      </main>

      {createOpen && (
        <div className="admin-console-overlay">
          <div className="admin-console-modal admin-console-modal-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="admin-console-title text-xl font-semibold">新建账号</p>
                <p className="admin-console-muted mt-1 text-sm">支持创建学生、教师、管理员账号</p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="admin-console-button px-3 py-1.5 text-xs"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <input
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="姓名 *"
                className="admin-console-input"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: event.target.value as UserRole,
                    }))
                  }
                  className="admin-console-select"
                >
                  <option value="STUDENT">学生</option>
                  <option value="TEACHER">教师</option>
                  <option value="ADMIN">管理员</option>
                </select>
                <input
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="账号邮箱（可选）"
                  className="admin-console-input"
                />
              </div>
              {createForm.role === 'STUDENT' && (
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={createForm.studentNumber}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        studentNumber: event.target.value,
                      }))
                    }
                    placeholder="学号 *"
                    className="admin-console-input"
                  />
                  <input
                    value={createForm.className}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        className: event.target.value,
                      }))
                    }
                    placeholder="班级（可选）"
                    className="admin-console-input"
                  />
                </div>
              )}
              {createForm.role === 'TEACHER' && (
                <input
                  value={createForm.employeeNumber}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      employeeNumber: event.target.value,
                    }))
                  }
                  placeholder="工号 *"
                  className="admin-console-input"
                />
              )}
              <input
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="初始密码（默认 123456）"
                type="password"
                className="admin-console-input"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="admin-console-button">
                取消
              </button>
              <button
                disabled={creating}
                onClick={handleCreate}
                className="admin-console-button-primary disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? '提交中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="admin-console-overlay">
          <div className="admin-console-modal admin-console-modal-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="admin-console-title text-xl font-semibold">修改密码</p>
                <p className="admin-console-muted mt-1 text-sm">
                  {resetTarget?.name || '账号'} · {resetTarget?.email || resetTarget?.profile?.studentNumber || ''}
                </p>
              </div>
              <button
                onClick={() => setResetOpen(false)}
                className="admin-console-button px-3 py-1.5 text-xs"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resetToDefault}
                  onChange={(event) => setResetToDefault(event.target.checked)}
                  className="h-4 w-4"
                />
                <span className="admin-console-muted">重置为默认密码 123456</span>
              </label>
              {!resetToDefault && (
                <input
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="输入新密码"
                  type="password"
                  className="admin-console-input w-full"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setResetOpen(false)} className="admin-console-button">
                取消
              </button>
              <button onClick={handleResetPassword} className="admin-console-button-primary">
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="admin-console-overlay">
          <div className="admin-console-surface admin-console-title text-sm font-medium">
            正在导入，请稍候…
          </div>
        </div>
      )}
    </div>
  );
}
