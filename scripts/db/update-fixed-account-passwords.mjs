import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TARGETS = [
  {
    label: 'teacher-test_teacher',
    where: { employeeNumber: 'test_teacher' },
    password: 'TestTeacher@Just2026!',
  },
  {
    label: 'student-demo',
    where: {
      OR: [
        { name: { equals: 'demo', mode: 'insensitive' } },
        { email: { equals: 'demo@example.com', mode: 'insensitive' } },
      ],
    },
    password: 'DemoStudent@Just2026!',
  },
  {
    label: 'teacher-201300000012',
    where: { employeeNumber: '201300000012' },
    password: 'zyw1983@Just',
  },
  {
    label: 'admin',
    where: { employeeNumber: 'admin' },
    password: 'admin@Just',
  },
];

async function main() {
  for (const target of TARGETS) {
    const user = await prisma.user.findFirst({
      where: target.where,
      select: { id: true, employeeNumber: true },
    });

    if (!user) {
      throw new Error(`[${target.label}] 未找到目标账号`);
    }

    const passwordHash = await bcrypt.hash(target.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`[${target.label}] 密码已更新`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
