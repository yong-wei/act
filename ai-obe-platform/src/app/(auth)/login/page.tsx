'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email: account,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setError('Invalid email or password.');
      return;
    }

    const session = await getSession();
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <Card className="w-full border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-xl text-white">学生登录</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Input
            type="text"
            name="account"
            placeholder="账号/邮箱"
            autoComplete="username"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            required
          />
          <Input
            type="password"
            name="password"
            placeholder="密码"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="rounded-md border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-200">
            <div className="font-semibold text-slate-100">演示账号</div>
            <div className="mt-1">账号：demo</div>
            <div>密码：123456</div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '正在登录...' : '登录'}
          </Button>
          <Link className="text-sm text-slate-300 hover:text-white" href="/register">
            创建新账号
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
