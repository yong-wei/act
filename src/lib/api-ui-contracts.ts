import type { UserRole } from '@prisma/client';

export type AdminUsersRoleFilter = 'ALL' | UserRole;
export type ApiUiContractStateKind =
  | 'no-match'
  | 'bad-object'
  | 'unauthorized'
  | 'unsupported-method'
  | 'invalid-parameter';

export interface ApiUiContractRecoveryState {
  kind: ApiUiContractStateKind;
  title: string;
  message: string;
  recoveryAction: string;
  returnTo: string | null;
  sourceRoute: string;
  targetId?: string | null;
}

export interface AdminUsersQueryContract {
  search: string;
  role: AdminUsersRoleFilter;
  page: number;
  pageSize: number;
  action: string | null;
  targetId: string | null;
  source: {
    searchParam: 'q' | 'search' | null;
    roleSupported: boolean;
    pageValid: boolean;
    pageSizeValid: boolean;
  };
}

const USER_ROLES: readonly UserRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

export function normalizeAdminUsersQueryContract(input: {
  q?: string | string[] | null;
  search?: string | string[] | null;
  role?: string | string[] | null;
  page?: string | string[] | number | null;
  pageSize?: string | string[] | number | null;
  action?: string | string[] | null;
  targetId?: string | string[] | null;
  userId?: string | string[] | null;
}): AdminUsersQueryContract {
  const q = firstQueryValue(input.q)?.trim() ?? '';
  const search = firstQueryValue(input.search)?.trim() ?? '';
  const role = firstQueryValue(input.role);
  const rawPage = firstQueryValue(input.page);
  const rawPageSize = firstQueryValue(input.pageSize);
  const page = positiveInteger(firstQueryValue(input.page), 1);
  const pageSize = clamp(positiveInteger(firstQueryValue(input.pageSize), 12), 1, 50);
  const roleSupported = !role || role === 'ALL' || USER_ROLES.includes(role as UserRole);
  const pageValid = isPositiveInteger(rawPage) || rawPage === null;
  const pageSizeValid = rawPageSize === null || (isPositiveInteger(rawPageSize) && Number(rawPageSize) <= 50);

  return {
    search: q || search,
    role: roleSupported && role && role !== 'ALL' ? role as UserRole : 'ALL',
    page,
    pageSize,
    action: firstQueryValue(input.action),
    targetId: firstQueryValue(input.targetId) ?? firstQueryValue(input.userId),
    source: {
      searchParam: q ? 'q' : search ? 'search' : null,
      roleSupported,
      pageValid,
      pageSizeValid,
    },
  };
}

export function buildApiUiRecoveryState(input: {
  kind: ApiUiContractStateKind;
  sourceRoute: string;
  targetLabel: string;
  targetId?: string | null;
  returnTo?: string | null;
  method?: string | null;
}): ApiUiContractRecoveryState {
  const returnTo = normalizeReturnTo(input.returnTo);
  const base = {
    kind: input.kind,
    returnTo,
    sourceRoute: input.sourceRoute,
    targetId: input.targetId ?? null,
  };
  if (input.kind === 'bad-object') {
    return {
      ...base,
      title: `${input.targetLabel}不存在`,
      message: input.targetId
        ? `未找到 ${input.targetLabel} ${input.targetId}，它可能已被删除或当前账号不可见。`
        : `未找到目标${input.targetLabel}。`,
      recoveryAction: returnTo ? '返回来源页面并刷新上下文' : '返回列表并刷新数据',
    };
  }
  if (input.kind === 'unauthorized') {
    return {
      ...base,
      title: '没有访问权限',
      message: `当前账号不能访问该${input.targetLabel}。`,
      recoveryAction: '切换有权限账号或返回工作台',
    };
  }
  if (input.kind === 'unsupported-method') {
    return {
      ...base,
      title: '当前操作方式不受支持',
      message: `${input.method ?? '当前请求'} 不能用于该${input.targetLabel}。`,
      recoveryAction: '使用页面提供的操作入口重试',
    };
  }
  if (input.kind === 'invalid-parameter') {
    return {
      ...base,
      title: '参数无效',
      message: `${input.targetLabel}参数无法识别。`,
      recoveryAction: '检查链接或回到来源页面重新进入',
    };
  }
  return {
    ...base,
    title: '没有匹配结果',
    message: `当前筛选条件下没有匹配的${input.targetLabel}。`,
    recoveryAction: '调整筛选条件或清空搜索',
  };
}

function firstQueryValue(value: string | string[] | number | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'number') return String(value);
  return value ?? null;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isPositiveInteger(value: string | null): boolean {
  if (value === null) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null;
  const parsed = new URL(value, 'https://act.local');
  if (parsed.origin !== 'https://act.local') return null;
  return value;
}
