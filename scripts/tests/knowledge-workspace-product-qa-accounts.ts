import bcryptModule from 'bcryptjs';

import { createPrismaClient } from '../lib/prisma-client.mjs';
import {
  accountByKey,
  ensureVerifiedTestAccounts,
} from '../db/verified-test-accounts.mjs';

const bcrypt = bcryptModule.default ?? bcryptModule;

export const KNOWLEDGE_WORKSPACE_QA_ROLES = ['student', 'teacher', 'admin'] as const;

export type KnowledgeWorkspaceQaRole = typeof KNOWLEDGE_WORKSPACE_QA_ROLES[number];

export type KnowledgeWorkspaceQaCredentials = {
  email: string;
  password: string;
  expectedRole: 'STUDENT' | 'TEACHER' | 'ADMIN';
};

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

function isLoopbackUrl(value: string) {
  try {
    return loopbackHosts.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isLocalKnowledgeWorkspaceQaTarget(baseUrl: string) {
  return isLoopbackUrl(baseUrl);
}

export function managedKnowledgeWorkspaceQaCredentials(): Record<KnowledgeWorkspaceQaRole, KnowledgeWorkspaceQaCredentials> {
  return Object.fromEntries(KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => {
    const account = accountByKey(role);
    return [role, {
      email: account.loginId,
      password: account.password,
      expectedRole: account.role as KnowledgeWorkspaceQaCredentials['expectedRole'],
    }];
  })) as Record<KnowledgeWorkspaceQaRole, KnowledgeWorkspaceQaCredentials>;
}

export async function provisionLocalKnowledgeWorkspaceQaAccounts(baseUrl: string) {
  if (!isLocalKnowledgeWorkspaceQaTarget(baseUrl)) return null;
  if (!isLoopbackUrl(process.env.DATABASE_URL ?? '')) {
    throw new Error('managed knowledge workspace QA accounts require a loopback DATABASE_URL');
  }

  const prisma = createPrismaClient();
  try {
    await ensureVerifiedTestAccounts(prisma, {
      hashPassword: (password: string) => bcrypt.hash(password, 10),
    });
    return managedKnowledgeWorkspaceQaCredentials();
  } finally {
    await prisma.$disconnect();
  }
}
