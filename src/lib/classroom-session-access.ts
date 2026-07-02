export interface ClassroomSessionAccessRecord {
  teacherId: string;
  classId?: string | null;
}

export interface ClassroomSessionAccessUser {
  id?: string | null;
  role?: unknown;
  profile?: {
    classId?: string | null;
  } | null;
}

export function normalizeClassroomActorRole(role: unknown): 'teacher' | 'student' {
  const value = String(role ?? '').toLowerCase();
  if (value.includes('teacher') || value.includes('admin') || value.includes('教师') || value.includes('管理员')) {
    return 'teacher';
  }
  return 'student';
}

export function isClassroomAdmin(role: unknown) {
  return String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').includes('管理员');
}

export function isClassroomTeacherOrAdmin(role: unknown) {
  const value = String(role ?? '').toUpperCase();
  return value === 'TEACHER' || value === 'ADMIN' || String(role ?? '').includes('教师') || String(role ?? '').includes('管理员');
}

export function canManageClassroomSession(
  sessionRecord: ClassroomSessionAccessRecord | null | undefined,
  user: ClassroomSessionAccessUser,
) {
  return Boolean(
    sessionRecord
    && (sessionRecord.teacherId === user.id || isClassroomAdmin(user.role)),
  );
}

export function canAccessClassroomSession(
  sessionRecord: ClassroomSessionAccessRecord | null | undefined,
  user: ClassroomSessionAccessUser,
) {
  if (!sessionRecord || !user.id) return false;
  if (canManageClassroomSession(sessionRecord, user)) return true;
  if (!sessionRecord.classId) return true;
  return user.profile?.classId === sessionRecord.classId;
}

