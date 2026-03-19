import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ classId: string }>;
}

export default async function LegacyClassAnalyticsRedirect({ params }: PageProps) {
  const { classId } = await params;
  redirect(`/teacher/classes/${classId}/analytics-v2`);
}
