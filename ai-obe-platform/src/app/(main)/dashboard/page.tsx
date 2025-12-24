import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/shared/sign-out-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthSession } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Control Theory Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-300">
            <p>Welcome back, {session.user.name ?? session.user.email ?? 'Student'}.</p>
            <p>This space will host your simulation sessions and learning progress.</p>
          </CardContent>
        </Card>
        <SignOutButton />
      </div>
    </div>
  );
}
