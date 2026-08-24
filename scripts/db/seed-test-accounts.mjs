import { createPrismaClient } from '../lib/prisma-client.mjs';
import bcrypt from 'bcryptjs'

import {
  VERIFIED_TEST_ACCOUNTS,
  ensureVerifiedTestAccounts,
} from './verified-test-accounts.mjs'

const prisma = createPrismaClient()

async function main() {
  const results = await ensureVerifiedTestAccounts(prisma, {
    hashPassword: (password) => bcrypt.hash(password, 10),
  })
  for (const row of results) {
    console.log(`[${row.role}] ${row.loginId} ready`)
  }
  console.log('\nTest accounts ready:')
  for (const account of VERIFIED_TEST_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.loginId} / ${account.password}`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed test accounts:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
