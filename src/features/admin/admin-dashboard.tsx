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
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { UserMenu } from '@/components/shared/user-menu';

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
    role: UserRole;
  };
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  STUDENT: '学生',
};

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: 'border-amber-400/50 text-amber-300 bg-amber-400/10',
  TEACHER: 'border-sky-400/50 text-sky-200 bg-sky-400/10',
  STUDENT: 'border-emerald-400/50 text-emerald-200 bg-emerald-400/10',
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
      link.download = 'students-template.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '下载模板失败');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
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
      const result = await res.json();
      showNotice(
        'success',
        `导入完成：新增 ${result.created ?? 0}，跳过 ${result.skipped ?? 0}`
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-cyan-500/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/60">
                Admin Command Deck
              </p>
              <h1 className="text-2xl font-semibold text-white">管理员后台</h1>
              <p className="mt-2 text-sm text-slate-400">
                当前登录：{currentUser.name || currentUser.email || '管理员'} · {formattedNow}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              >
                <RefreshCcw className="h-4 w-4" />
                刷新数据
              </button>
              <UserMenu user={currentUser} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="flex min-h-[120px] flex-col justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 shadow-[0_0_40px_rgba(34,211,238,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-cyan-200/70">{card.title}</p>
                    <span className="rounded-full bg-cyan-500/10 p-2 text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-semibold text-white">
                      {loadingOverview ? '...' : card.value}
                    </p>
                    <p className="text-xs text-slate-400">{card.meta}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-6 py-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_320px]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              导航
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="rounded-lg bg-cyan-500/10 px-3 py-2 text-cyan-100">
                总览面板
              </div>
              <div className="rounded-lg px-3 py-2 transition hover:bg-slate-800/70">
                账号管理
              </div>
              <Link href="/admin/config">
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-800/70 cursor-pointer">
                   <Settings className="h-4 w-4" />
                   系统配置
                </div>
              </Link>
              <div className="rounded-lg px-3 py-2 transition hover:bg-slate-800/70">
                批量导入
              </div>
              <div className="rounded-lg px-3 py-2 transition hover:bg-slate-800/70">
                风险监测
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              系统指令
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <button
                onClick={() => setCreateOpen(true)}
                className="flex w-full items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-100 transition hover:border-cyan-400"
              >
                新建账号
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-slate-200 transition hover:border-slate-500"
              >
                下载模板
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-slate-200 transition hover:border-slate-500"
              >
                批量导入
                <UploadCloud className="h-4 w-4" />
              </button>
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
              <p className="text-xs text-slate-500">
                导入模板需包含学号、姓名两列
              </p>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {notice && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              }`}
            >
              {notice.message}
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-[linear-gradient(0deg,rgba(15,23,42,0.6),rgba(15,23,42,0.9))] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">账号管理</p>
                <p className="text-xs text-slate-400">
                  全局账号、权限与密码管理
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜索姓名/账号/学号"
                    className="w-56 rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(event) => {
                    setRoleFilter(event.target.value as UserRole | 'ALL');
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  <option value="ALL">全部角色</option>
                  <option value="ADMIN">管理员</option>
                  <option value="TEACHER">教师</option>
                  <option value="STUDENT">学生</option>
                </select>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400"
                >
                  <Plus className="h-4 w-4" />
                  新建账号
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-900/80 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3">账号信息</th>
                    <th className="px-4 py-3">学号/工号</th>
                    <th className="px-4 py-3">角色</th>
                    <th className="px-4 py-3">创建时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        正在加载账号列表...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        暂无账号数据
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">
                            {user.name || '未命名'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {user.email ||
                              user.employeeNumber ||
                              user.profile?.studentNumber ||
                              '未绑定账号'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {user.profile?.studentNumber || user.employeeNumber || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs ${ROLE_STYLES[user.role]}`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Intl.DateTimeFormat('zh-CN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(user.createdAt))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => openReset(user)}
                              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                            >
                              改密
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="rounded-lg border border-rose-500/40 px-2 py-1 text-xs text-rose-300 transition hover:border-rose-400"
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

            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                共 {totalUsers} 条 · 第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              预警动态
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {!overview?.recentViolations?.length && (
                <div className="text-xs text-slate-500">暂无违规记录</div>
              )}
              {overview?.recentViolations?.map((violation) => (
                <div
                  key={violation.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                >
                  <div className="font-medium">
                    {violation.student.name || '未命名'} ·{' '}
                    {violation.student.studentNumber || '未知学号'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-rose-200/70">
                    <span>{violation.violationType}</span>
                    <span>{violation.isResolved ? '已整改' : '待整改'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              账号详情
            </p>
            {selectedUser ? (
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="text-lg font-semibold text-white">
                  {selectedUser.name || '未命名'}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedUser.email ||
                    selectedUser.employeeNumber ||
                    selectedUser.profile?.studentNumber ||
                    '未绑定账号'}
                </div>
                <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                  <div>角色：{ROLE_LABELS[selectedUser.role]}</div>
                  <div>学号：{selectedUser.profile?.studentNumber || '-'}</div>
                  <div>工号：{selectedUser.employeeNumber || '-'}</div>
                  <div>班级：{selectedUser.profile?.className || '-'}</div>
                  <div>
                    创建时间：
                    {new Intl.DateTimeFormat('zh-CN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(selectedUser.createdAt))}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openReset(selectedUser)}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500"
                  >
                    修改密码
                  </button>
                  <button
                    onClick={() => handleDelete(selectedUser)}
                    className="flex-1 rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 transition hover:border-rose-400"
                  >
                    删除账号
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-slate-500">
                选择账号查看详情
              </div>
            )}
          </div>
        </aside>
      </main>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">新建账号</p>
                <p className="text-xs text-slate-500">
                  支持创建学生、教师、管理员账号
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="姓名 *"
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
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
                  className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none"
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
                  className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
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
                    className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
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
                    className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
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
                  className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
                />
              )}
              <input
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="初始密码（默认 123456）"
                type="password"
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
              >
                取消
              </button>
              <button
                disabled={creating}
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? '提交中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">修改密码</p>
                <p className="text-xs text-slate-500">
                  {resetTarget?.name || '账号'} · {resetTarget?.email || resetTarget?.profile?.studentNumber || ''}
                </p>
              </div>
              <button
                onClick={() => setResetOpen(false)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={resetToDefault}
                  onChange={(event) => setResetToDefault(event.target.checked)}
                  className="h-4 w-4"
                />
                重置为默认密码 123456
              </label>
              {!resetToDefault && (
                <input
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="输入新密码"
                  type="password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setResetOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 text-sm text-cyan-100">
          正在导入，请稍候...
        </div>
      )}
    </div>
  );
}
