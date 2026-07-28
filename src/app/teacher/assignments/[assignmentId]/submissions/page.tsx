import { TeacherReviewQueue } from "@/features/assignments/teacher-review-queue";

export default async function TeacherAssignmentSubmissionsPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <TeacherReviewQueue assignmentId={assignmentId} />;
}
