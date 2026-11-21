import 'server-only';
import { cache } from 'react';
import { getServerAuthSession } from '@/lib/auth';

// React owns the lifetime of this result for one server render, including an in-flight check.
export const getRenderAuthSession = cache(getServerAuthSession);
