'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { normalizeRegistrationError } from '@/lib/register-error';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      setIsSubmitting(false);
      setError(normalizeRegistrationError(data?.error));
      return;
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      router.push('/login');
      return;
    }

    router.push('/profile');
  };

  return (
    <div className="w-full" data-commercial-workspace="auth">
      <Card className="mx-auto w-full max-w-md border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground">创建账号</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="账号（登录名）"
              autoComplete="username"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <Input
              type="email"
              name="email"
              placeholder="邮箱"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              name="password"
              placeholder="密码（至少8位）"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="text-sm text-destructive" role="alert" aria-live="assertive">{error}</p> : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '正在创建...' : '创建账号'}
            </Button>
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/login">
              已有账号？去登录
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
