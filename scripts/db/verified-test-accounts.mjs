/** Canonical three-role fixture accounts for local and production. */

export const VERIFIED_TEST_ACCOUNTS = [
  {
    key: 'student',
    role: 'STUDENT',
    name: 'demo',
    email: 'demo@example.com',
    loginId: 'demo',
    studentNumber: 'demo',
    password: 'DemoStudent@Just2026!',
  },
  {
    key: 'teacher',
    role: 'TEACHER',
    name: 'test_teacher',
    email: 'test_teacher@example.com',
    loginId: 'test_teacher',
    employeeNumber: 'test_teacher',
    password: 'TestTeacher@Just2026!',
  },
  {
    key: 'admin',
    role: 'ADMIN',
    name: 'admin',
    email: 'admin',
    loginId: 'admin',
    employeeNumber: 'admin',
    password: 'admin@Just',
  },
];

export function accountByKey(key) {
  const account = VERIFIED_TEST_ACCOUNTS.find((row) => row.key === key);
  if (!account) throw new Error(`unknown verified test account: ${key}`);
  return account;
}

function candidateWhere(account) {
  const clauses = [
    { email: { equals: account.email, mode: 'insensitive' } },
  ];
  if (account.employeeNumber) {
    clauses.push({ employeeNumber: { equals: account.employeeNumber, mode: 'insensitive' } });
  }
  if (account.studentNumber) {
    clauses.push({
      profile: { is: { studentNumber: { equals: account.studentNumber, mode: 'insensitive' } } },
    });
  }
  return { OR: clauses };
}

function pickCanonical(candidates, account) {
  const emailMatch = candidates.find(
    (row) => row.email?.toLowerCase() === account.email.toLowerCase(),
  );
  if (emailMatch) return emailMatch;
  if (account.employeeNumber) {
    const employeeMatch = candidates.find(
      (row) => row.employeeNumber?.toLowerCase() === account.employeeNumber.toLowerCase()
        && row.email?.toLowerCase() === account.email.toLowerCase(),
    );
    if (employeeMatch) return employeeMatch;
  }
  return candidates[0] ?? null;
}

export async function ensureVerifiedTestAccounts(prisma, { hashPassword }) {
  const results = [];
  for (const account of VERIFIED_TEST_ACCOUNTS) {
    const passwordHash = await hashPassword(account.password);
    const candidates = await prisma.user.findMany({
      where: candidateWhere(account),
      include: { profile: true },
      orderBy: { createdAt: 'asc' },
    });
    let canonical = pickCanonical(candidates, account);
    const data = {
      name: account.name,
      email: account.email,
      role: account.role,
      passwordHash,
      ...(account.employeeNumber ? { employeeNumber: account.employeeNumber } : {}),
    };
    if (!canonical) {
      canonical = await prisma.user.create({
        data,
        include: { profile: true },
      });
    } else {
      canonical = await prisma.user.update({
        where: { id: canonical.id },
        data,
        include: { profile: true },
      });
    }

    if (account.studentNumber) {
      if (canonical.profile) {
        await prisma.studentProfile.update({
          where: { userId: canonical.id },
          data: { studentNumber: account.studentNumber },
        });
      } else {
        await prisma.studentProfile.create({
          data: {
            userId: canonical.id,
            studentNumber: account.studentNumber,
          },
        });
      }
    }

    for (const extra of candidates.filter((row) => row.id !== canonical.id)) {
      const extraData = {};
      if (
        account.employeeNumber
        && extra.employeeNumber?.toLowerCase() === account.employeeNumber.toLowerCase()
      ) {
        extraData.employeeNumber = null;
      }
      if (extra.email?.toLowerCase() === account.email.toLowerCase()) {
        extraData.email = null;
      }
      if (Object.keys(extraData).length > 0) {
        await prisma.user.update({
          where: { id: extra.id },
          data: extraData,
        });
      }
      if (
        account.studentNumber
        && extra.profile?.studentNumber?.toLowerCase() === account.studentNumber.toLowerCase()
      ) {
        await prisma.studentProfile.update({
          where: { userId: extra.id },
          data: { studentNumber: null },
        });
      }
    }

    results.push({
      key: account.key,
      id: canonical.id,
      loginId: account.loginId,
      role: account.role,
    });
  }
  return results;
}
