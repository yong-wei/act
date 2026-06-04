'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialLoginForm } from '@/components/shared/credential-login-form';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCommercialFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const entryIntents = getCommercialStudentEntryIntentGroups();
  const profileIntent = callbackUrl === '/profile' ? '保留目标：登录后进入个人中心与证据复盘。' : '登录后回到原始学习路径。';

  return (
    <div
      className="surface-page px-4 py-8 sm:px-6"
      data-commercial-workspace="auth-entry"
      data-commercial-student-entry-route="/login"
      data-commercial-entry-intent="account-profile"
      data-auth-callback-target={callbackUrl ?? 'role-cockpit'}
    >
      <main className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[1fr_380px]">
        <section className="surface-card p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">商业入口 · 账号与画像</p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">账号登录</h1>
          <p className="mt-2 text-sm leading-6 text-subtle">{profileIntent}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-subtle">
            <Link href="/login?callbackUrl=%2Fprofile" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              个人中心回调
            </Link>
            <Link href="/" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              返回产品地图
            </Link>
            <Link href="/interactive-learning" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              浏览互动学习
            </Link>
          </div>
        </section>

        <Card className="surface-card w-full">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">登录继续</CardTitle>
          </CardHeader>
          <CardContent>
            <CredentialLoginForm
              callbackUrl={callbackUrl}
              onSuccess={({ redirectPath }) => router.push(redirectPath)}
            />
          </CardContent>
        </Card>

        <section className="surface-card-soft p-4 lg:col-span-2" data-commercial-entry-intent-map="account-profile">
          <div className="grid gap-2 text-xs text-subtle md:grid-cols-3">
            {entryIntents.slice(0, 6).map((intent) => (
              <Link key={intent.intent} href={intent.hrefs[0] ?? '/'} className="rounded-lg border border-border px-3 py-2 hover:border-primary">
                <span className="font-medium text-foreground">{intent.label}</span>
                <span className="mt-1 block text-subtle">{intent.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginCommercialFallback() {
  return (
    <div
      className="surface-page px-4 py-8 sm:px-6"
      data-commercial-workspace="auth-entry"
      data-commercial-student-entry-route="/login"
      data-commercial-entry-intent="account-profile"
      data-auth-callback-target="pending-callback"
    >
      <main className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[1fr_380px]">
        <section className="surface-card p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">商业入口 · 账号与画像</p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">账号登录</h1>
          <p className="mt-2 text-sm leading-6 text-subtle">正在解析登录后目标，完成加载后会保留原始学习路径。</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-subtle">
            <Link href="/login?callbackUrl=%2Fprofile" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              个人中心回调
            </Link>
            <Link href="/" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              返回产品地图
            </Link>
            <Link href="/interactive-learning" className="rounded-full border border-border px-3 py-1 hover:border-primary">
              浏览互动学习
            </Link>
          </div>
        </section>

        <Card className="surface-card w-full">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">登录继续</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-subtle">正在加载安全登录入口...</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
