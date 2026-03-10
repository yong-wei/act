'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignOut = async () => {
    setIsSubmitting(true);
    await signOut({ callbackUrl: '/login' });
    setIsSubmitting(false);
  };

  return (
    <Button variant="outline" onClick={handleSignOut} disabled={isSubmitting}>
      {isSubmitting ? 'Signing out...' : 'Sign Out'}
    </Button>
  );
}
