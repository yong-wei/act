export type TeacherStudentPortraitAccess =
  | {
      ok: true;
      classData: { id: string; name: string; teacherId: string };
      studentProfile: {
        userId: string;
        studentNumber: string | null;
        user: { id: string; name: string | null; email: string | null };
      };
    }
  | { ok: false; status: 404; error: '班级不存在' | '学生不在该班级中' }
  | { ok: false; status: 403; error: '权限不足' };

export async function resolveTeacherStudentPortraitAccess(
  database: unknown,
  input: {
    actorId: string;
    actorRole: string;
    classId: string;
    studentId: string;
  },
): Promise<TeacherStudentPortraitAccess> {
  const db = database as {
    class: { findUnique(args: Record<string, unknown>): Promise<any | null> };
    studentProfile: { findFirst(args: Record<string, unknown>): Promise<any | null> };
  };
  if (input.actorRole !== 'TEACHER' && input.actorRole !== 'ADMIN') {
    return { ok: false, status: 403, error: '权限不足' };
  }
  const classData = await db.class.findUnique({
    where: { id: input.classId },
    select: { id: true, name: true, teacherId: true },
  });
  if (!classData) return { ok: false, status: 404, error: '班级不存在' };
  if (classData.teacherId !== input.actorId && input.actorRole !== 'ADMIN') {
    return { ok: false, status: 403, error: '权限不足' };
  }
  const studentProfile = await db.studentProfile.findFirst({
    where: { classId: input.classId, userId: input.studentId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!studentProfile) {
    return { ok: false, status: 404, error: '学生不在该班级中' };
  }
  return { ok: true, classData, studentProfile };
}

export async function hasOnlyEmptyJsonPayload(request: Request): Promise<boolean> {
  const text = await request.text();
  if (text.trim() === '') return true;
  try {
    const value = JSON.parse(text);
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0,
    );
  } catch {
    return false;
  }
}
