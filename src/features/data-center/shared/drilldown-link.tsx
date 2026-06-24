import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import type { DataCenterDrilldownTarget } from './data-center-contracts';
import { canAccessDrilldown } from './drilldown-access';
import { cn } from '@/lib/utils';

interface DataCenterDrilldownLinkProps {
  label: string;
  href: string;
  target: DataCenterDrilldownTarget;
  currentRole: PlatformRole;
  allowedRoles: PlatformRole[];
  restricted?: boolean;
  restrictedReason?: string;
  className?: string;
}

const targetLabels: Record<DataCenterDrilldownTarget, string> = {
  'admin-governance': '管理治理',
  'teacher-governance': '教师治理',
  'evidence-browser': '证据浏览器',
};

export function DataCenterDrilldownLink({
  label,
  href,
  target,
  currentRole,
  allowedRoles,
  restricted = false,
  restrictedReason,
  className,
}: DataCenterDrilldownLinkProps) {
  const canAccess = canAccessDrilldown(currentRole, allowedRoles);

  if (!canAccess) return null;

  if (restricted) {
    return (
      <span
        className={cn(
          'inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-2 py-1 text-xs text-platform-fg-muted',
          className,
        )}
        title={restrictedReason ?? '当前角色无法访问此内容'}
      >
        <span className="h-1 w-1 rounded-full bg-platform-evidence-unsupported" />
        {label}
        <span className="rounded bg-platform-action-subtle px-1 py-px text-[10px] text-platform-fg-muted">
          {targetLabels[target]}
        </span>
      </span>
    );
  }

  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        'text-platform-action-primary hover:bg-platform-action-subtle transition-colors',
        className,
      )}
    >
      {label}
      <span className="rounded bg-platform-action-subtle px-1 py-px text-[10px] text-platform-action-primary">
        {targetLabels[target]}
      </span>
    </a>
  );
}
