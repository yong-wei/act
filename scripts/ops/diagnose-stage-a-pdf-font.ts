import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createPrismaClient } from '../../src/lib/prisma-client';
import fontkit from '@pdf-lib/fontkit';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const rows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id },
    select: { id: true, annotationSnapshot: true, overallComment: true },
  });
  const directory = dirname(require.resolve('@fontsource-variable/noto-sans-sc/files/noto-sans-sc-100-wght-normal.woff2'));
  const files = require('node:fs').readdirSync(directory).filter((name: string) => /^noto-sans-sc-\d+-wght-normal\.woff2$/.test(name));
  const fonts = files.map((name: string) => fontkit.create(readFileSync(join(directory, name))));
  for (const row of rows) {
    const values = [row.overallComment ?? '', ...(Array.isArray(row.annotationSnapshot) ? row.annotationSnapshot.flatMap((item: any) => [item?.comment ?? '', item?.contents ?? '']) : [])];
    const codePoints = [...new Set(values.flatMap((value) => [...String(value)].map((character) => character.codePointAt(0) ?? 0)).filter((codePoint) => codePoint > 127))];
    const unsupported = codePoints.filter((codePoint) => !fonts.some((font: any) => font.hasGlyphForCodePoint(codePoint)));
    if (unsupported.length > 0) console.log(JSON.stringify({ approvalId: row.id, unsupported: unsupported.map((codePoint) => `U+${codePoint.toString(16).toUpperCase()}`) }));
  }
}

void main().finally(() => prisma.$disconnect());
