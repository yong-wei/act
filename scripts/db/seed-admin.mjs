import { createPrismaClient } from '../lib/prisma-client.mjs';
import bcrypt from 'bcryptjs'

import { accountByKey, ensureVerifiedTestAccounts } from './verified-test-accounts.mjs'

const prisma = createPrismaClient()

async function main() {
  const results = await ensureVerifiedTestAccounts(prisma, {
    hashPassword: (password) => bcrypt.hash(password, 10),
  })
  const adminRow = results.find((row) => row.key === 'admin')
  const admin = accountByKey('admin')
  console.log(`Admin user updated: ${admin.email} (${adminRow?.id ?? 'unknown'})`)
}

main()
  .catch((error) => {
    console.error('Failed to seed admin user.', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
