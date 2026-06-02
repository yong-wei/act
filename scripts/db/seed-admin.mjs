import { createPrismaClient } from '../lib/prisma-client.mjs';
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = createPrismaClient()

const ADMIN_ACCOUNT = {
  name: 'admin',
  email: 'admin',
  employeeNumber: 'admin',
  password: 'admin@Just',
}

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_ACCOUNT.password, 10)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { equals: ADMIN_ACCOUNT.name, mode: 'insensitive' } },
        { email: { equals: ADMIN_ACCOUNT.email, mode: 'insensitive' } },
      ],
    },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: ADMIN_ACCOUNT.name,
        email: ADMIN_ACCOUNT.email,
        employeeNumber: ADMIN_ACCOUNT.employeeNumber,
        passwordHash,
        role: UserRole.ADMIN,
      },
    })
    console.log(`Admin user updated: ${ADMIN_ACCOUNT.email}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      name: ADMIN_ACCOUNT.name,
      email: ADMIN_ACCOUNT.email,
      employeeNumber: ADMIN_ACCOUNT.employeeNumber,
      passwordHash,
      role: UserRole.ADMIN,
    },
  })

  console.log(`Admin user created: ${user.id}`)
}

main()
  .catch((error) => {
    console.error('Failed to seed admin user.', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
