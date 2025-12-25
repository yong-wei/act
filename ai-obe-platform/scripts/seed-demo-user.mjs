import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_ACCOUNT = {
  name: 'demo',
  email: 'demo@student.local',
  password: '123456',
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_ACCOUNT.password, 10)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { equals: DEMO_ACCOUNT.name, mode: 'insensitive' } },
        { email: { equals: DEMO_ACCOUNT.email, mode: 'insensitive' } },
      ],
    },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: DEMO_ACCOUNT.name,
        email: existing.email ?? DEMO_ACCOUNT.email,
        passwordHash,
        role: UserRole.STUDENT,
      },
    })
    console.log('Demo user updated.')
    return
  }

  const user = await prisma.user.create({
    data: {
      name: DEMO_ACCOUNT.name,
      email: DEMO_ACCOUNT.email,
      passwordHash,
      role: UserRole.STUDENT,
    },
  })

  console.log(`Demo user created: ${user.id}`)
}

main()
  .catch((error) => {
    console.error('Failed to seed demo user.', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
