import { createPrismaClient } from '../lib/prisma-client.mjs';
import bcrypt from 'bcryptjs';

import { ensureVerifiedTestAccounts } from './verified-test-accounts.mjs';

const prisma = createPrismaClient();

const PERSONAL_TARGETS = [
  {
    label: 'teacher-201300000012',
    where: { employeeNumber: '201300000012' },
    password: 'zyw1983@Just',
  },
];

async function main() {
  const verified = await ensureVerifiedTestAccounts(prisma, {
    hashPassword: (password) => bcrypt.hash(password, 10),
  });
  for (const row of verified) {
    console.log(`[${row.role}] ${row.loginId} 已写入验证密码`);
  }

  for (const target of PERSONAL_TARGETS) {
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
