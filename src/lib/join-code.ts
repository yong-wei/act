import { Prisma } from '@prisma/client';

type JoinCodeClient = {
  classSession: {
    findUnique: (
      args: Prisma.ClassSessionFindUniqueArgs
    ) => Promise<{ id: string } | null>;
  };
};

export function generateJoinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateUniqueJoinCode(
  client: JoinCodeClient,
  maxAttempts = 10
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await client.classSession.findUnique({
      where: { joinCode },
      select: { id: true },
    });

    if (!existing) {
      return joinCode;
    }
  }

  throw new Error('Failed to generate unique join code');
}
