import { prisma } from '@/lib/prisma';
import { rebuildStudentEvidenceFeatureCache } from '@/lib/data-governance/student-evidence-feature-cache';

async function main() {
  const result = await rebuildStudentEvidenceFeatureCache(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('[rebuild-student-evidence-feature-cache] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
