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
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">商业入口 · 账号与画像</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">账号登录</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{profileIntent}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <Link href="/login?callbackUrl=%2Fprofile" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            个人中心回调
          </Link>
          <Link href="/" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            返回产品地图
          </Link>
          <Link href="/interactive-learning" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            浏览互动学习
          </Link>
        </div>
      </section>

      <Card className="w-full border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-xl text-white">登录继续</CardTitle>
        </CardHeader>
        <CardContent>
          <CredentialLoginForm
            callbackUrl={callbackUrl}
            onSuccess={({ redirectPath }) => router.push(redirectPath)}
          />
        </CardContent>
      </Card>

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 lg:col-span-2">
        <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-3">
          {entryIntents.slice(0, 6).map((intent) => (
            <Link key={intent.intent} href={intent.hrefs[0] ?? '/'} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-cyan-400">
              <span className="font-medium text-slate-100">{intent.label}</span>
              <span className="mt-1 block text-slate-400">{intent.summary}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoginCommercialFallback() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">商业入口 · 账号与画像</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">账号登录</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">保留目标：登录后进入个人中心与证据复盘。</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <Link href="/login?callbackUrl=%2Fprofile" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            个人中心回调
          </Link>
          <Link href="/" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            返回产品地图
          </Link>
          <Link href="/interactive-learning" className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400">
            浏览互动学习
          </Link>
        </div>
      </section>

      <Card className="w-full border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-xl text-white">登录继续</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">正在加载安全登录入口...</p>
        </CardContent>
      </Card>
    </div>
  );
}
