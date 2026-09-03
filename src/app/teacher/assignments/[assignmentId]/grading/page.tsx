import { TeacherAssignmentGradingConsole } from '@/features/assignments/teacher-assignment-grading-console';

export default async function TeacherAssignmentGradingPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <TeacherAssignmentGradingConsole assignmentId={assignmentId} />;
}
