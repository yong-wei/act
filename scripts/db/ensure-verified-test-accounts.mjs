#!/usr/bin/env node

import bcrypt from 'bcryptjs';

import { createPrismaClient } from '../lib/prisma-client.mjs';
import {
  VERIFIED_TEST_ACCOUNTS,
  ensureVerifiedTestAccounts,
} from './verified-test-accounts.mjs';

const prisma = createPrismaClient();

async function main() {
  const results = await ensureVerifiedTestAccounts(prisma, {
    hashPassword: (password) => bcrypt.hash(password, 10),
  });
  for (const row of results) {
    process.stdout.write(`[${row.role}] ${row.loginId} ready (${row.id})\n`);
  }
  process.stdout.write('\nVerified three-role accounts:\n');
  for (const account of VERIFIED_TEST_ACCOUNTS) {
    process.stdout.write(`  ${account.role}  login=${account.loginId}  password=${account.password}\n`);
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
