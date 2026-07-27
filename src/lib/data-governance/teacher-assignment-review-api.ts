import { NextResponse } from 'next/server';

import { TeacherAssignmentReviewError } from './teacher-assignment-review';

export function teacherAssignmentReviewErrorResponse(error: unknown) {
  if (error instanceof TeacherAssignmentReviewError) {
    return NextResponse.json({ error: error.code, details: error.details }, { status: error.status });
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues ?? [];
    return NextResponse.json({ error: 'invalid-teacher-review-payload', details: issues.map((issue) => issue.message).filter(Boolean) }, { status: 400 });
  }
  return NextResponse.json({ error: 'teacher-review-operation-failed' }, { status: 500 });
}
