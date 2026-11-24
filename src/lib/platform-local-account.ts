import { confirmActLocalAccount, platformAccountId, type ActProvisioning } from '@/lib/platform-access';

const PROVIDER = 'platform';
const LOCAL_USER = { id: true, role: true, email: true, name: true, platformRoleVersion: true } as const;

export async function resolveLocalPlatformUser(input: {
  issuer: string;
  subject: string;
  personId: string;
  sessionVersion: number;
  provisioning?: ActProvisioning;
}) {
  const { prisma } = await import('@/lib/prisma');
  const { issuer, subject, personId, sessionVersion, provisioning } = input;
  const providerAccountId = platformAccountId(issuer, subject);
  const localUserId = provisioning?.localUserId;
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`act:platform-account:${personId}`}))`;
    const accounts = await tx.account.findMany({
      where: {
        provider: PROVIDER,
        OR: [
          { providerAccountId: { in: [providerAccountId, subject] } },
          { session_state: personId },
          ...(localUserId ? [{ userId: localUserId }] : []),
        ],
      },
      select: { id: true, userId: true, providerAccountId: true, session_state: true },
    });
    const mappedUserId = localUserId ?? accounts[0]?.userId;
    if (accounts.some((account) => account.userId !== mappedUserId
      || (account.session_state
        ? account.session_state !== personId
        : ![providerAccountId, subject].includes(account.providerAccountId)))) return null;

    let local = mappedUserId
      ? await tx.user.findUnique({ where: { id: mappedUserId }, select: LOCAL_USER })
      : null;
    const override = provisioning?.overrideRole;
    if (!local) {
      if (mappedUserId || !provisioning) return null;
      const legacyUser = await tx.user.findFirst({
        where: {
          OR: [
            { employeeNumber: { in: provisioning.staffNumbers } },
            { profile: { is: { studentNumber: { in: provisioning.studentNumbers } } } },
          ],
        },
        select: { id: true },
      });
      if (legacyUser) return null;
      const role = override ?? provisioning.initialRole;
      local = await tx.user.create({
        data: {
          name: provisioning.displayName,
          role,
          platformRoleVersion: override ? sessionVersion : null,
          ...(role === 'TEACHER' && provisioning.rosterKind === 'teacher' && provisioning.staffNumbers.length === 1
            ? { employeeNumber: provisioning.staffNumbers[0] } : {}),
          ...(role === 'STUDENT' ? { profile: { create: {
            studentNumber: provisioning.rosterKind === 'student' && provisioning.studentNumbers.length === 1
              ? provisioning.studentNumbers[0] : null,
          } } } : {}),
        },
        select: LOCAL_USER,
      });
    } else if (local.role !== 'ADMIN' && override) {
      if ((local.platformRoleVersion ?? -1) > sessionVersion) return null;
      if (local.role !== override || local.platformRoleVersion !== sessionVersion) {
        local = await tx.user.update({
          where: { id: local.id },
          data: {
            role: override,
            platformRoleVersion: sessionVersion,
            ...(override === 'STUDENT' ? { profile: { upsert: { create: {}, update: {} } } } : {}),
          },
          select: LOCAL_USER,
        });
      }
    }

    const existing = accounts.find((account) => account.providerAccountId === providerAccountId)
      ?? accounts.find((account) => account.providerAccountId === subject);
    if (existing) {
      if (existing.providerAccountId !== providerAccountId || existing.session_state !== personId) {
        await tx.account.update({
          where: { id: existing.id },
          data: { providerAccountId, session_state: personId },
        });
      }
    } else {
      await tx.account.create({
        data: { provider: PROVIDER, type: 'oauth', userId: local.id, providerAccountId, session_state: personId },
      });
    }
    return local;
  });
  if (user && provisioning && !localUserId) {
    const confirmed = await confirmActLocalAccount({ issuer, subject, sessionVersion }, user.id);
    if (!confirmed) return null;
  }
  return user;
}
