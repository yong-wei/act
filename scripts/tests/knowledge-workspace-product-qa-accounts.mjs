import bcryptModule from 'bcryptjs';

import { createPrismaClient } from '../lib/prisma-client.mjs';
import {
  accountByKey,
  ensureVerifiedTestAccounts,
} from '../db/verified-test-accounts.mjs';

const bcrypt = bcryptModule.default ?? bcryptModule;

export const KNOWLEDGE_WORKSPACE_QA_ROLES = ['student', 'teacher', 'admin'];

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

function isLoopbackUrl(value) {
  try {
    return loopbackHosts.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isLocalKnowledgeWorkspaceQaTarget(baseUrl) {
  return isLoopbackUrl(baseUrl);
}

export function managedKnowledgeWorkspaceQaCredentials() {
  return Object.fromEntries(KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => {
    const account = accountByKey(role);
    return [role, {
      email: account.loginId,
      password: account.password,
      expectedRole: account.role,
    }];
  }));
}

async function hasCurrentCredentials(prisma, role) {
  const account = accountByKey(role);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          profile: {
            is: {
              studentNumber: { equals: account.loginId, mode: 'insensitive' },
            },
          },
        },
        { employeeNumber: { equals: account.loginId, mode: 'insensitive' } },
      ],
    },
    select: {
      role: true,
      passwordHash: true,
    },
  });
  return user?.role === account.role
    && Boolean(user.passwordHash)
    && bcrypt.compare(account.password, user.passwordHash);
}

export async function provisionLocalKnowledgeWorkspaceQaAccounts(baseUrl) {
  if (!isLocalKnowledgeWorkspaceQaTarget(baseUrl)) return null;
  if (!isLoopbackUrl(process.env.DATABASE_URL ?? '')) {
    throw new Error('managed knowledge workspace QA accounts require a loopback DATABASE_URL');
  }

  const prisma = createPrismaClient();
  try {
    const fixtureReady = await Promise.all(
      KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => hasCurrentCredentials(prisma, role)),
    );
    if (!fixtureReady.every(Boolean)) {
      await ensureVerifiedTestAccounts(prisma, {
        hashPassword: (password) => bcrypt.hash(password, 10),
      });
    }
    return managedKnowledgeWorkspaceQaCredentials();
  } finally {
    await prisma.$disconnect();
  }
}
