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
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import type { AdminOperationLedgerEntry, PiiMinimizedFailedImportRow } from '@/lib/admin-operation-ledger';
import { createAuditedActionState } from '@/lib/action-status-contract';
import type { AdminUsersQueryContract } from '@/lib/api-ui-contracts';
import { toCsv } from '@/lib/csv-export';

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
  initialUsersQuery?: AdminUsersQueryContract;
};

type ImportErrorItem = {
  row: number;
  accountFingerprint?: string | null;
  reason: string;
};

type ImportResult = {
  batchId?: string;
  mode?: 'preview' | 'commit';
  preview?: boolean;
  created: number;
  updated: number;
  failed: number;
  skippedEmpty?: number;
  totalRows?: number;
  errors?: ImportErrorItem[];
  failedRows?: PiiMinimizedFailedImportRow[];
  failedRowArtifact?: {
    id: string;
    label: string;
    downloadUrl?: string;
    rowCount?: number;
    expiresAt?: string;
    revocable: boolean;
    piiMinimized: boolean;
  } | null;
  operationLedger?: AdminOperationLedgerEntry;
  auditRecord?: {
    actorId: string;
    action: string;
    batchId: string;
    outcome: string;
    rollbackAvailable: boolean;
    rollbackRationale?: string;
    operationId?: string;
    idempotencyKey?: string;
    retentionPolicy?: string;
    recordedAt: string;
  };
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

const DIALOG_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getDialogFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR))
    .filter((item) => !item.hasAttribute('disabled') && item.offsetParent !== null);
}

export function AdminDashboard({ currentUser, initialUsersQuery }: AdminDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const resetDialogRef = useRef<HTMLDivElement>(null);
  const createDialogOpenerRef = useRef<HTMLElement | null>(null);
  const resetDialogOpenerRef = useRef<HTMLElement | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(initialUsersQuery?.page ?? 1);
  const [search, setSearch] = useState(initialUsersQuery?.search ?? '');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>(initialUsersQuery?.role ?? 'ALL');
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
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [templateDownloadState, setTemplateDownloadState] = useState<ReturnType<typeof createAuditedActionState> | null>(null);
  const [usersExportState, setUsersExportState] = useState<ReturnType<typeof createAuditedActionState> | null>(null);
  const [creating, setCreating] = useState(false);
  const [usersQueryTouched, setUsersQueryTouched] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'STUDENT' as UserRole,
    studentNumber: '',
    employeeNumber: '',
    className: '',
    password: '',
  });

  const pageSize = initialUsersQuery?.pageSize ?? 12;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalUsers / pageSize)),
    [pageSize, totalUsers]
  );

  const formattedNow = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
    []
  );

  const routeActionState = useMemo(() => {
    const action = initialUsersQuery?.action;
    if (!action) return null;
    if (action === 'export') {
      if (!initialUsersQuery.source.roleSupported) {
        return createAuditedActionState({
          identity: {
            id: 'admin-users-route-action:export',
            category: 'export',
            label: '账号导出',
            sourceRoute: '/admin/users',
            targetId: initialUsersQuery.targetId,
            requestedAction: action,
          },
          status: 'blocked',
          message: '账号导出参数包含无效角色筛选，已阻止生成文件。',
          recoveryAction: '清空无效角色参数后重新导出',
          httpStatus: 400,
        });
      }
      return createAuditedActionState({
        identity: {
          id: 'admin-users-route-action:export',
          category: 'export',
          label: '账号导出',
          sourceRoute: '/admin/users',
          targetId: initialUsersQuery.targetId,
          requestedAction: action,
        },
        status: 'pending',
        message: '账号导出深链已保留当前筛选条件，请使用页面内导出按钮生成文件。',
        nextAction: '按当前筛选集导出账号清单',
      });
    }
    if (action === 'reset') {
      return createAuditedActionState({
        identity: {
          id: 'admin-users-route-action:reset',
          category: 'unsupported-action',
          label: '账号重置',
          sourceRoute: '/admin/users',
          targetId: initialUsersQuery.targetId,
          requestedAction: action,
        },
        status: 'unsupported',
        message: '账号重置不能通过 URL 参数直接执行。',
        recoveryAction: '在目标账号行内打开改密确认流程',
      });
    }
    return createAuditedActionState({
      identity: {
        id: `admin-users-route-action:${action}`,
        category: 'unsupported-action',
        label: '账号路由动作',
        sourceRoute: '/admin/users',
        targetId: initialUsersQuery.targetId,
        requestedAction: action,
      },
      status: 'unsupported',
      message: `账号管理不支持动作参数 ${action}。`,
      recoveryAction: '返回账号列表默认状态',
    });
  }, [initialUsersQuery]);

  const invalidQueryState = useMemo(() => {
    const query = initialUsersQuery;
    if (!query || !shouldBlockInvalidAdminUsersQuery(query, usersQueryTouched)) return null;
    const invalidParts = [
      query.source.roleSupported ? null : '角色筛选',
      query.source.pageValid ? null : '分页参数',
      query.source.pageSizeValid ? null : '分页大小',
    ].filter((part): part is string => Boolean(part));
    if (invalidParts.length === 0) return null;
    return createAuditedActionState({
      identity: {
        id: 'admin-users-query:invalid',
        category: 'filter',
        label: '账号筛选参数',
        sourceRoute: '/admin/users',
      },
      status: 'blocked',
      message: `账号筛选参数无效：${invalidParts.join('、')}。`,
      recoveryAction: '清空无效参数后重新筛选',
      httpStatus: 400,
    });
  }, [initialUsersQuery, usersQueryTouched]);

  const usersListStatus = useMemo(() => {
    if (invalidQueryState) return '账号筛选参数无效，账号列表已暂停更新。';
    if (loadingUsers) return '正在加载账号列表。';
    if (users.length === 0) {
      return search.trim() || roleFilter !== 'ALL'
        ? '当前筛选条件下没有匹配账号。'
        : '账号列表暂无数据。';
    }
    return `账号列表已更新，共 ${totalUsers} 条，当前第 ${page} 页显示 ${users.length} 条。`;
  }, [invalidQueryState, loadingUsers, page, roleFilter, search, totalUsers, users.length]);

  const showNotice = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const rememberDialogOpener = useCallback((targetRef: MutableRefObject<HTMLElement | null>) => {
    const activeElement = document.activeElement;
    targetRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  }, []);

  const restoreDialogOpener = useCallback((targetRef: MutableRefObject<HTMLElement | null>) => {
    window.requestAnimationFrame(() => {
      const opener = targetRef.current;
      if (opener?.isConnected && opener.offsetParent !== null) {
        opener.focus();
      }
    });
  }, []);

  const openCreateDialog = useCallback(() => {
    rememberDialogOpener(createDialogOpenerRef);
    setCreateOpen(true);
  }, [rememberDialogOpener]);

  const closeCreateDialog = useCallback(() => {
    setCreateOpen(false);
    restoreDialogOpener(createDialogOpenerRef);
  }, [restoreDialogOpener]);

  const closeResetDialog = useCallback(() => {
    setResetOpen(false);
    restoreDialogOpener(resetDialogOpenerRef);
  }, [restoreDialogOpener]);

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
    if (invalidQueryState) {
      setUsers([]);
      setTotalUsers(0);
      return;
    }
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
  }, [invalidQueryState, page, pageSize, roleFilter, search, showNotice]);

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

      closeCreateDialog();
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
    rememberDialogOpener(resetDialogOpenerRef);
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

      closeResetDialog();
      showNotice('success', '密码已更新');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '修改密码失败');
    }
  };

  useEffect(() => {
    if (!createOpen) return;
    const dialog = createDialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCreateDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getDialogFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.requestAnimationFrame(() => {
      getDialogFocusableElements(dialog)[0]?.focus() ?? dialog.focus();
    });
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [closeCreateDialog, createOpen]);

  useEffect(() => {
    if (!resetOpen) return;
    const dialog = resetDialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeResetDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getDialogFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.requestAnimationFrame(() => {
      getDialogFocusableElements(dialog)[0]?.focus() ?? dialog.focus();
    });
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [closeResetDialog, resetOpen]);

  const handleDownloadTemplate = async () => {
    setTemplateDownloadState(createAuditedActionState({
      identity: {
        id: 'admin-users-template-download',
        category: 'download',
        label: '导入模板下载',
        sourceRoute: '/admin/users',
        requestedAction: 'download-template',
      },
      status: 'pending',
      message: '正在生成用户批量导入模板。',
      nextAction: '等待浏览器下载模板文件',
    }));
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
      const operationId = res.headers.get('x-admin-operation-id');
      setTemplateDownloadState(createAuditedActionState({
        identity: {
          id: operationId ?? 'admin-users-template-download',
          category: 'download',
          label: '导入模板下载',
          sourceRoute: '/admin/users',
          requestedAction: 'download-template',
        },
        status: 'succeeded',
        message: '用户批量导入模板已生成，下载记录已写入操作账本。',
        nextAction: '填写模板后预览导入',
        displayReference: operationId ?? undefined,
        downloadFilename: 'users-template.xlsx',
      }));
    } catch (error) {
      setTemplateDownloadState(createAuditedActionState({
        identity: {
          id: 'admin-users-template-download',
          category: 'download',
          label: '导入模板下载',
          sourceRoute: '/admin/users',
          requestedAction: 'download-template',
        },
        status: 'failed',
        message: error instanceof Error ? error.message : '下载模板失败',
        recoveryAction: '刷新页面后重新下载模板',
        httpStatus: 500,
      }));
      showNotice('error', error instanceof Error ? error.message : '下载模板失败');
    }
  };

  const handleExportUsers = async () => {
    if (invalidQueryState) {
      setUsersExportState(createAuditedActionState({
        identity: {
          id: 'admin-users-filtered-export',
          category: 'export',
          label: '账号筛选导出',
          sourceRoute: '/admin/users',
          requestedAction: 'export',
        },
        status: 'blocked',
        message: '当前账号筛选参数无效，已阻止导出。',
        recoveryAction: '清空无效参数后重新筛选',
        httpStatus: 400,
      }));
      return;
    }
    setExportingUsers(true);
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('q', search.trim());
    }
    if (roleFilter !== 'ALL') {
      params.set('role', roleFilter);
    }
    try {
      const res = await fetch(`/api/admin/users/export?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || '导出账号失败');
      }
      const blob = await res.blob();
      const filename = res.headers.get('x-export-filename')
        ?? `admin-users-${roleFilter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      const exportCount = Number(res.headers.get('x-export-count') ?? 0);
      const exportTotal = Number(res.headers.get('x-export-total') ?? exportCount);
      const operationId = res.headers.get('x-admin-operation-id');
      const idempotencyKey = res.headers.get('x-admin-operation-idempotency-key');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      setUsersExportState(createAuditedActionState({
        identity: {
          id: 'admin-users-filtered-export',
          category: 'export',
          label: '账号筛选导出',
          sourceRoute: '/admin/users',
          requestedAction: 'export',
        },
        status: 'succeeded',
        message: `已按当前筛选条件导出 ${exportCount} 条账号，筛选总数 ${exportTotal}。操作账本已记录 operation id 与导出范围。`,
        nextAction: exportCount === 0 ? '调整筛选条件后重新导出' : '检查下载文件',
        displayReference: operationId ?? idempotencyKey ?? undefined,
        downloadFilename: filename,
      }));
    } catch (error) {
      setUsersExportState(createAuditedActionState({
        identity: {
          id: 'admin-users-filtered-export',
          category: 'export',
          label: '账号筛选导出',
          sourceRoute: '/admin/users',
          requestedAction: 'export',
        },
        status: 'failed',
        message: error instanceof Error ? error.message : '导出账号失败',
        recoveryAction: '刷新账号列表后重试',
        httpStatus: 500,
      }));
    } finally {
      setExportingUsers(false);
    }
  };

  const downloadFailedImportRows = () => {
    if (importResult?.failedRowArtifact?.downloadUrl) {
      const link = document.createElement('a');
      link.href = importResult.failedRowArtifact.downloadUrl;
      link.download = `${importResult.batchId ?? 'admin-user-import'}-failed-rows.csv`;
      link.click();
      return;
    }
    const failedRows = importResult?.failedRows ?? [];
    const errors = importResult?.errors ?? [];
    const csv = [
      ['row', 'accountFingerprint', 'reason'],
      ...(failedRows.length > 0
        ? failedRows.map((item) => [item.row, item.accountFingerprint ?? '', item.reason])
        : errors.map((item) => [item.row, '', item.reason])),
    ];
    const filename = `${importResult?.batchId ?? 'admin-user-import'}-failed-rows.csv`;
    const blob = new Blob([toCsv(csv)], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File, mode: 'preview' | 'commit' = 'preview') => {
    setImporting(true);
    if (mode === 'preview') {
      setPendingImportFile(file);
      setImportResult(null);
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
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
        mode === 'preview'
          ? `导入预览完成：预计新增 ${result.created ?? 0}，更新 ${result.updated ?? 0}，失败 ${result.failed ?? 0}`
          : `导入完成：新增 ${result.created ?? 0}，更新 ${result.updated ?? 0}，失败 ${result.failed ?? 0}`
      );
      if (mode === 'commit') {
        setPendingImportFile(null);
        fetchUsers();
        fetchOverview();
      }
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
    <div
      className="admin-console-shell"
      data-commercial-operations-workspace="admin-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={loadingUsers || loadingOverview ? 'loading' : 'role-filtered'}
    >
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
          <button type="button" onClick={handleRefresh} className="admin-console-button" aria-label="刷新用户管理数据">
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
            <div className="mt-4 space-y-3" data-admin-operation-zone="users-import-export">
              <button type="button"
                onClick={openCreateDialog}
                className="admin-console-button-primary w-full justify-between"
              >
                新建账号
                <Plus className="h-4 w-4" />
              </button>
              <button type="button"
                onClick={handleDownloadTemplate}
                className="admin-console-button w-full justify-between"
                aria-label="下载用户批量导入模板"
              >
                下载模板
                <Download className="h-4 w-4" />
              </button>
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="admin-console-button w-full justify-between"
                aria-label="选择用户 Excel 文件并预览批量导入"
              >
                批量导入
                <UploadCloud className="h-4 w-4" />
              </button>
              <button type="button"
                onClick={handleExportUsers}
                disabled={exportingUsers || Boolean(invalidQueryState)}
                className="admin-console-button w-full justify-between disabled:opacity-50"
                aria-label="导出当前账号筛选结果"
              >
                {exportingUsers ? '正在导出' : '导出当前筛选'}
                <Download className="h-4 w-4" />
              </button>
              <Link href="/admin/config" className="admin-console-nav-item">
                <Settings className="h-4 w-4" />
                打开系统配置
              </Link>
              <input aria-label="批量导入用户 Excel 文件"
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
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
            <div className="admin-console-surface-soft" data-admin-operation-ledger-state="user-import">
              <span className="admin-console-kicker">导入结果</span>
              <div className="admin-console-muted mt-3 space-y-2 text-sm">
                {importResult.batchId && <p>批次：{importResult.batchId}</p>}
                {importResult.operationLedger ? (
                  <p className="break-all">
                    操作：{importResult.operationLedger.operationId} · 去重键：{importResult.operationLedger.idempotencyKey}
                  </p>
                ) : null}
                <p>
                  {importResult.preview ? '预计' : ''}
                  新增 {importResult.created ?? 0}，更新 {importResult.updated ?? 0}，失败 {importResult.failed ?? 0}
                </p>
                {typeof importResult.totalRows === 'number' && (
                  <p>
                    数据行数 {importResult.totalRows}，空行跳过 {importResult.skippedEmpty ?? 0}
                  </p>
                )}
                {(importResult.errors?.length ?? 0) > 0 && (
                  <div className="admin-console-notice admin-console-notice-danger mt-3 max-h-40 overflow-y-auto text-xs">
                    {importResult.errors?.map((item, index) => {
                      const accountFingerprint = item.accountFingerprint ?? importResult.failedRows?.[index]?.accountFingerprint;
                      return (
                        <p key={`${item.row}-${index}`}>
                          第 {item.row} 行
                          {accountFingerprint ? `（账号指纹 ${accountFingerprint}）` : ''}
                          ：{item.reason}
                        </p>
                      );
                    })}
                  </div>
                )}
                {(importResult.errors?.length ?? 0) > 0 && (
                  <button type="button" onClick={downloadFailedImportRows} className="admin-console-button mt-2 px-3 py-1.5 text-xs">
                    下载 PII 最小化失败行
                  </button>
                )}
                {importResult.failedRowArtifact ? (
                  <p className="text-xs">
                    失败行 artifact：{importResult.failedRowArtifact.label} · 行数 {importResult.failedRowArtifact.rowCount ?? 0} ·
                    {importResult.failedRowArtifact.piiMinimized ? ' 已最小化个人信息' : ' 未最小化'} ·
                    {importResult.failedRowArtifact.expiresAt ? ` 过期 ${importResult.failedRowArtifact.expiresAt}` : ' 可撤销'}
                  </p>
                ) : null}
                {importResult.preview && pendingImportFile && (importResult.errors?.length ?? 0) === 0 && (
                  <button
                    type="button"
                    onClick={() => handleImport(pendingImportFile, 'commit')}
                    className="admin-console-button-primary mt-2 px-3 py-1.5 text-xs"
                  >
                    确认导入
                  </button>
                )}
                {importResult.auditRecord && (
                  <p className="text-xs">
                    审计：{importResult.auditRecord.outcome} · 模式 {importResult.mode ?? 'commit'} · 操作者 {importResult.auditRecord.actorId} ·
                    {importResult.auditRecord.rollbackAvailable ? ' 可按批次自动回滚' : ` ${importResult.auditRecord.rollbackRationale ?? '自动回滚未启用'}`}
                  </p>
                )}
                {importResult.operationLedger ? (
                  <p className="text-xs">
                    保留策略：{importResult.operationLedger.retentionPolicy.policy} · 恢复：{importResult.operationLedger.recoveryState.action}
                  </p>
                ) : null}
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
              role={notice.type === 'error' ? 'alert' : 'status'}
              aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="relative w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 admin-console-muted" />
                  <input aria-label="搜索姓名/账号/学号"
                    value={search}
                    onChange={(event) => {
                      setUsersQueryTouched(true);
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜索姓名/账号/学号"
                    className="admin-console-input w-full pl-9 sm:w-64"
                  />
                </div>
                <select
                  aria-label="按角色筛选账号"
                  value={roleFilter}
                  onChange={(event) => {
                    setUsersQueryTouched(true);
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
                <button type="button"
                  onClick={openCreateDialog}
                  className="admin-console-button-primary"
                  aria-label="新建用户账号"
                >
                  <Plus className="h-4 w-4" />
                  新建账号
                </button>
              </div>
            </div>

            {routeActionState ? (
              <ActionStatusPanel state={routeActionState} className="mt-4" />
            ) : null}
            {templateDownloadState ? (
              <ActionStatusPanel state={templateDownloadState} className="mt-4" />
            ) : null}
            {invalidQueryState ? (
              <ActionStatusPanel state={invalidQueryState} className="mt-4" />
            ) : null}
            {usersExportState ? (
              <ActionStatusPanel state={usersExportState} className="mt-4" />
            ) : null}

            <div
              className="sr-only"
              role="status"
              aria-live="polite"
              data-admin-users-list-status
            >
              {usersListStatus}
            </div>

            <div className="admin-console-table-shell mt-6">
              <table className="admin-console-table" data-admin-mobile-cards="true" aria-label="账号列表">
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
                  ) : invalidQueryState ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                        账号筛选参数无效，请清空无效参数后重新筛选。
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                        {search.trim() || roleFilter !== 'ALL'
                          ? `没有找到匹配的账号。当前条件：${search.trim() || '全部关键词'} / ${roleFilter === 'ALL' ? '全部角色' : ROLE_LABELS[roleFilter]}。`
                          : '暂无账号数据'}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3" data-label="账号信息">
                          <div className="admin-console-title font-medium">{user.name || '未命名'}</div>
                          <div className="admin-console-table-subtle mt-1 text-xs">
                            {user.email || user.employeeNumber || user.profile?.studentNumber || '未绑定账号'}
                          </div>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle" data-label="学号/工号">
                          {user.profile?.studentNumber || user.employeeNumber || '-'}
                        </td>
                        <td className="px-4 py-3" data-label="角色">
                          <span className={ROLE_STYLES[user.role]}>{ROLE_LABELS[user.role]}</span>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle" data-label="创建时间">
                          {new Intl.DateTimeFormat('zh-CN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(user.createdAt))}
                        </td>
                        <td className="px-4 py-3" data-label="操作">
                          <div className="flex justify-end gap-2">
                            <button type="button"
                              onClick={() => setSelectedUser(user)}
                              className="admin-console-button px-3 py-1.5 text-xs"
                              aria-label={`查看账号 ${user.name || user.email || user.id}`}
                            >
                              查看
                            </button>
                            <button type="button"
                              onClick={() => openReset(user)}
                              className="admin-console-button px-3 py-1.5 text-xs"
                              aria-label={`修改账号 ${user.name || user.email || user.id} 的密码`}
                            >
                              改密
                            </button>
                            <button type="button"
                              onClick={() => handleDelete(user)}
                              className="admin-console-button admin-console-tone-danger px-3 py-1.5 text-xs"
                              aria-label={`删除账号 ${user.name || user.email || user.id}`}
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
                <button type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setUsersQueryTouched(true);
                    setPage((prev) => Math.max(1, prev - 1));
                  }}
                  className="admin-console-button px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="查看上一页账号"
                >
                  上一页
                </button>
                <button type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setUsersQueryTouched(true);
                    setPage((prev) => Math.min(totalPages, prev + 1));
                  }}
                  className="admin-console-button px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="查看下一页账号"
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
                  <button type="button"
                    onClick={() => openReset(selectedUser)}
                    className="admin-console-button flex-1 justify-center"
                  >
                    修改密码
                  </button>
                  <button type="button"
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
          <div ref={createDialogRef} className="admin-console-modal admin-console-modal-lg" role="dialog" aria-modal="true" aria-labelledby="admin-create-user-title" tabIndex={-1}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p id="admin-create-user-title" className="admin-console-title text-xl font-semibold">新建账号</p>
                <p className="admin-console-muted mt-1 text-sm">支持创建学生、教师、管理员账号</p>
              </div>
              <button type="button"
                onClick={closeCreateDialog}
                className="admin-console-button px-3 py-1.5 text-xs"
                aria-label="关闭新建账号对话框"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <input aria-label="姓名 *"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="姓名 *"
                className="admin-console-input"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  aria-label="选择账号角色"
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
                <input aria-label="账号邮箱（可选）"
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
                  <input aria-label="学号 *"
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
                  <input aria-label="班级（可选）"
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
                <input aria-label="工号 *"
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
              <input aria-label="初始密码（默认 123456）"
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
              <button type="button" onClick={closeCreateDialog} className="admin-console-button">
                取消
              </button>
              <button type="button"
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
          <div ref={resetDialogRef} className="admin-console-modal admin-console-modal-sm" role="dialog" aria-modal="true" aria-labelledby="admin-reset-password-title" tabIndex={-1}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p id="admin-reset-password-title" className="admin-console-title text-xl font-semibold">修改密码</p>
                <p className="admin-console-muted mt-1 text-sm">
                  {resetTarget?.name || '账号'} · {resetTarget?.email || resetTarget?.profile?.studentNumber || ''}
                </p>
              </div>
              <button type="button"
                onClick={closeResetDialog}
                className="admin-console-button px-3 py-1.5 text-xs"
                aria-label="关闭修改密码对话框"
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
                <input aria-label="输入新密码"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="输入新密码"
                  type="password"
                  className="admin-console-input w-full"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closeResetDialog} className="admin-console-button">
                取消
              </button>
              <button type="button" onClick={handleResetPassword} className="admin-console-button-primary">
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="admin-console-overlay">
          <div className="admin-console-surface admin-console-title text-sm font-medium" role="status" aria-live="polite">
            正在导入，请稍候…
          </div>
        </div>
      )}
    </div>
  );
}

export function shouldBlockInvalidAdminUsersQuery(
  initialUsersQuery: AdminUsersQueryContract | undefined,
  usersQueryTouched: boolean,
) {
  if (!initialUsersQuery || usersQueryTouched) return false;
  return !initialUsersQuery.source.roleSupported
    || !initialUsersQuery.source.pageValid
    || !initialUsersQuery.source.pageSizeValid;
}
