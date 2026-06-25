import { describe, expect, it } from 'vitest';

import {
  canAccessClassroomSession,
  canManageClassroomSession,
  normalizeClassroomActorRole,
} from '@/lib/classroom-session-access';

describe('classroom session access', () => {
  const classBoundSession = { teacherId: 'teacher-1', classId: 'class-1' };

  it('allows session owner teachers and admins to manage classroom sessions', () => {
    expect(canManageClassroomSession(classBoundSession, { id: 'teacher-1', role: 'TEACHER' })).toBe(true);
    expect(canManageClassroomSession(classBoundSession, { id: 'admin-1', role: 'ADMIN' })).toBe(true);
    expect(canManageClassroomSession(classBoundSession, { id: 'teacher-2', role: 'TEACHER' })).toBe(false);
  });

  it('requires same-class student membership for class-bound sessions', () => {
    expect(canAccessClassroomSession(classBoundSession, {
      id: 'student-1',
      role: 'STUDENT',
      profile: { classId: 'class-1' },
    })).toBe(true);
    expect(canAccessClassroomSession(classBoundSession, {
      id: 'student-2',
      role: 'STUDENT',
      profile: { classId: 'class-2' },
    })).toBe(false);
  });

  it('keeps temporary classrooms open to authenticated participants', () => {
    expect(canAccessClassroomSession({ teacherId: 'teacher-1', classId: null }, {
      id: 'student-1',
      role: 'STUDENT',
    })).toBe(true);
  });

  it('normalizes trusted server roles for lifecycle evidence', () => {
    expect(normalizeClassroomActorRole('ADMIN')).toBe('teacher');
    expect(normalizeClassroomActorRole('TEACHER')).toBe('teacher');
    expect(normalizeClassroomActorRole('STUDENT')).toBe('student');
  });
});

