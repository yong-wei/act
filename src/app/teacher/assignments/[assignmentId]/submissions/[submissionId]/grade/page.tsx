import { TeacherAssignmentGradeWorkspace } from '@/features/assignments/teacher-assignment-grade-workspace';

export default async function TeacherAssignmentGradePage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string; submissionId: string }>;
  searchParams: Promise<{ snapshotId?: string; confirmationId?: string }>;
}) {
  const [{ assignmentId, submissionId }, { snapshotId, confirmationId }] = await Promise.all([params, searchParams]);
  return <TeacherAssignmentGradeWorkspace assignmentId={assignmentId} submissionId={submissionId} snapshotId={snapshotId ?? ''} initialConfirmationId={confirmationId ?? null} />;
}
