'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialLoginForm } from '@/components/shared/credential-login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCardFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Card className="w-full border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-xl text-white">账号登录</CardTitle>
      </CardHeader>
      <CardContent>
        <CredentialLoginForm
          callbackUrl={searchParams.get('callbackUrl')}
          onSuccess={({ redirectPath }) => router.push(redirectPath)}
        />
      </CardContent>
    </Card>
  );
}

function LoginCardFallback() {
  return (
    <Card className="w-full border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-xl text-white">账号登录</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">正在加载登录表单...</p>
      </CardContent>
    </Card>
  );
}
