import { TeacherClassroomWaitingRoute } from '@/features/interactive/shared/teacher-classroom-waiting-route';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function TeacherWaitingRoute({ params }: PageProps) {
  const { sessionId } = await params;

  return <TeacherClassroomWaitingRoute routeSegment="unit-2-3-frequency-response-bode-intro" sessionId={sessionId} />;
}
