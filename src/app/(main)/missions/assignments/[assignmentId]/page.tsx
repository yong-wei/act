import { StudentAssignmentWorkspace } from '@/features/assignments/student-assignment-workspace';

export default async function StudentAssignmentPage({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ revisionId?: string }> }) {
  const { assignmentId } = await params;
  const { revisionId } = await searchParams;
  return <StudentAssignmentWorkspace assignmentId={assignmentId} revisionId={revisionId} />;
}
