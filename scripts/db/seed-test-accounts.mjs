import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEST_ACCOUNTS = [
  {
    name: 'demo',
    email: 'demo@example.com',
    password: 'DemoStudent@Just2026!',
    role: UserRole.STUDENT,
  },
  {
    name: 'test_teacher',
    email: 'test_teacher@example.com',
    employeeNumber: 'test_teacher',
    password: 'TestTeacher@Just2026!',
    role: UserRole.TEACHER,
  },
]

async function main() {
  for (const account of TEST_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10)

    const whereClause = account.employeeNumber
      ? {
          OR: [
            { name: { equals: account.name, mode: 'insensitive' } },
            { email: { equals: account.email, mode: 'insensitive' } },
            { employeeNumber: { equals: account.employeeNumber, mode: 'insensitive' } },
          ],
        }
      : {
          OR: [
            { name: { equals: account.name, mode: 'insensitive' } },
            { email: { equals: account.email, mode: 'insensitive' } },
          ],
        }

    const existing = await prisma.user.findFirst({ where: whereClause })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: account.name,
          email: account.email,
          passwordHash,
          role: account.role,
          ...(account.employeeNumber && { employeeNumber: account.employeeNumber }),
        },
      })
      console.log(`[${account.role}] ${account.name} updated`)
    } else {
      const user = await prisma.user.create({
        data: {
          name: account.name,
          email: account.email,
          passwordHash,
          role: account.role,
          ...(account.employeeNumber && { employeeNumber: account.employeeNumber }),
        },
      })
      console.log(`[${account.role}] ${account.name} created: ${user.id}`)
    }
  }

  console.log('\nTest accounts ready:')
  console.log('  Student: demo / DemoStudent@Just2026!')
  console.log('  Teacher: test_teacher / TestTeacher@Just2026!')
}

main()
  .catch((error) => {
    console.error('Failed to seed test accounts:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
