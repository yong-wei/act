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
      setError('账号或密码错误');
      return;
    }

    const session = await getSession();
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin');
    } else if (session?.user?.role === 'TEACHER') {
      router.push('/teacher');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <Card className="w-full border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-xl text-white">账号登录</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Input
            type="text"
            name="account"
            placeholder="学号/工号"
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
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '正在登录...' : '登录'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
