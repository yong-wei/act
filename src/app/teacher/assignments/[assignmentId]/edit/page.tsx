import { AssignmentEditorWorkspace } from '@/features/assignment-authoring/assignment-editor-workspace';

export default async function EditTeacherAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) { const { assignmentId } = await params; return <AssignmentEditorWorkspace assignmentId={assignmentId} />; }
