import { describe, expect, it } from 'vitest';

import {
  authorizeClassroomSessionAccess,
  canAccessClassroomSession,
  canManageClassroomSession,
  normalizeClassroomActorRole,
} from '@/features/classroom/session';

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

  it('centralizes manage and read access decisions', () => {
    expect(authorizeClassroomSessionAccess({
      session: classBoundSession,
      actor: { id: 'teacher-1', role: 'TEACHER' },
      operation: 'manage',
    }).allowed).toBe(true);
    expect(authorizeClassroomSessionAccess({
      session: classBoundSession,
      actor: { id: 'student-2', role: 'STUDENT', profile: { classId: 'class-2' } },
      operation: 'read',
    }).allowed).toBe(false);
  });

  it('normalizes trusted server roles for lifecycle evidence', () => {
    expect(normalizeClassroomActorRole('ADMIN')).toBe('teacher');
    expect(normalizeClassroomActorRole('TEACHER')).toBe('teacher');
    expect(normalizeClassroomActorRole('STUDENT')).toBe('student');
  });
});

