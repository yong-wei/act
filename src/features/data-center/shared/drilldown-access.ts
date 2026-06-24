import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export function canAccessDrilldown(currentRole: PlatformRole, allowedRoles: PlatformRole[]): boolean {
  return allowedRoles.includes(currentRole);
}
