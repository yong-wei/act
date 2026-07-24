import { Prisma } from '@prisma/client';

export async function lockClassSessionBinding(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  classId: string,
) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${`class-session-binding:${classId}`}))
  `);
}
