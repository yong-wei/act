import { prisma } from '@/lib/prisma';

export const TEACHER_CLASS_BINDING_ENFORCEMENT_SETTING = 'teacher_class_binding_enforcement';

export interface TeacherClassBindingEnforcementReceipt {
  version: 1;
  enabled: true;
  invariantVerifiedAt: string;
  producerInventoryVerifiedAt: string;
}

type TeacherClassBindingEnforcementDb = Pick<typeof prisma, 'platformSetting'>;

export function isTeacherClassBindingEnforcementReceipt(
  value: unknown,
): value is TeacherClassBindingEnforcementReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  return receipt.version === 1
    && receipt.enabled === true
    && typeof receipt.invariantVerifiedAt === 'string'
    && typeof receipt.producerInventoryVerifiedAt === 'string';
}

export async function isTeacherClassBindingEnforced(
  db: TeacherClassBindingEnforcementDb = prisma,
): Promise<boolean> {
  try {
    const setting = await db.platformSetting.findUnique({
      where: { key: TEACHER_CLASS_BINDING_ENFORCEMENT_SETTING },
      select: { value: true },
    });
    return isTeacherClassBindingEnforcementReceipt(setting?.value);
  } catch {
    return true;
  }
}
