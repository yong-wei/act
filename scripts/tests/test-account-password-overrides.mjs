import { PrismaClient } from '@prisma/client';
import bcryptModule from 'bcryptjs';

const bcrypt = bcryptModule.default ?? bcryptModule;

const prisma = new PrismaClient();

const CASES = [
  {
    label: 'teacher-test_teacher',
    where: { employeeNumber: 'test_teacher' },
    expectedPassword: 'TestTeacher@Just2026!',
  },
  {
    label: 'student-demo',
    where: {
      OR: [
        { name: { equals: 'demo', mode: 'insensitive' } },
        { email: { equals: 'demo@example.com', mode: 'insensitive' } },
      ],
    },
    expectedPassword: 'DemoStudent@Just2026!',
  },
  {
    label: 'teacher-201300000012',
    where: { employeeNumber: '201300000012' },
    expectedPassword: 'zyw1983@Just',
  },
  {
    label: 'admin',
    where: { employeeNumber: 'admin' },
    expectedPassword: 'admin@Just',
  },
];

async function main() {
  for (const item of CASES) {
    const user = await prisma.user.findFirst({
      where: item.where,
      select: {
        id: true,
        employeeNumber: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      throw new Error(`[${item.label}] 用户不存在或没有密码哈希`);
    }

    const ok = await bcrypt.compare(item.expectedPassword, user.passwordHash);
    if (!ok) {
      throw new Error(`[${item.label}] 密码不匹配预期值`);
    }
  }

  console.log('account password override test passed');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
