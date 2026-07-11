import { StudentAssignmentWorkspace } from '@/features/assignments/student-assignment-workspace';

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <StudentAssignmentWorkspace assignmentId={assignmentId} />;
}
