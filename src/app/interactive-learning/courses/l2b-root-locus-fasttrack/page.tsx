import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { L2BCourseEntryPage } from '@/features/interactive/l2b-root-locus/entry-page';

export const dynamic = 'force-dynamic';

export default async function L2BRootLocusFastTrackEntryRoute() {
  const session = await getServerSession(authOptions);
  return <L2BCourseEntryPage initialRole={session?.user?.role} />;
}
