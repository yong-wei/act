import { CruiseCourseEntryPage } from '@/features/interactive/cruise-classroom/entry-page';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CruiseComfortBopppsEntryRoute() {
  const session = await getServerSession(authOptions);
  return <CruiseCourseEntryPage initialRole={session?.user?.role} />;
}
