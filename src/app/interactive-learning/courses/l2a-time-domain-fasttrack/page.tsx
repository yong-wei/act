import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { L2ACourseEntryPage } from '@/features/interactive/l2a-time-domain/entry-page';

export const dynamic = 'force-dynamic';

export default async function L2ATimeDomainFastTrackEntryRoute() {
  const session = await getServerSession(authOptions);
  return <L2ACourseEntryPage initialRole={session?.user?.role} />;
}
