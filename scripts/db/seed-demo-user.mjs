import { createPrismaClient } from '../lib/prisma-client.mjs';
import bcrypt from 'bcryptjs'

import { accountByKey, ensureVerifiedTestAccounts } from './verified-test-accounts.mjs'

const prisma = createPrismaClient()

async function main() {
  const results = await ensureVerifiedTestAccounts(prisma, {
    hashPassword: (password) => bcrypt.hash(password, 10),
  })
  const student = results.find((row) => row.key === 'student')
  const demo = accountByKey('student')
  console.log(`Demo user updated: ${demo.email} (${student?.id ?? 'unknown'})`)
}

main()
  .catch((error) => {
    console.error('Failed to seed demo user.', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
