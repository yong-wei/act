import { createPrismaClient } from '../lib/prisma-client.mjs';
import bcryptModule from 'bcryptjs';

import { VERIFIED_TEST_ACCOUNTS } from '../db/verified-test-accounts.mjs';

const bcrypt = bcryptModule.default ?? bcryptModule;

const prisma = createPrismaClient();

const CASES = [
  ...VERIFIED_TEST_ACCOUNTS.map((account) => ({
    label: `${account.role}-${account.loginId}`,
    where: account.employeeNumber
      ? { employeeNumber: account.employeeNumber }
      : { email: { equals: account.email, mode: 'insensitive' } },
    expectedPassword: account.password,
  })),
  {
    label: 'teacher-201300000012',
    where: { employeeNumber: '201300000012' },
    expectedPassword: 'zyw1983@Just',
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
