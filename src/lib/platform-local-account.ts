import { platformAccountId } from '@/lib/platform-access';

export async function resolveLocalPlatformUser(input: {
  issuer: string;
  subject: string;
  personId: string;
}) {
  const { prisma } = await import('@/lib/prisma');
  const account = await prisma.account.findFirst({
    where: {
      provider: 'platform',
      OR: [
        { providerAccountId: platformAccountId(input.issuer, input.subject) },
        { providerAccountId: input.subject },
      ],
    },
    select: { id: true, userId: true, session_state: true },
  });
  if (!account || (account.session_state && account.session_state !== input.personId)) return null;
  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!user) return null;
  await prisma.account.update({
    where: { id: account.id },
    data: {
      providerAccountId: platformAccountId(input.issuer, input.subject),
      session_state: input.personId,
    },
  });
  return user;
}
