/**
 * 画像 cutover fence 收敛验证（Issue #1984）。
 *
 * 证明 fence → APPLY COMPLETED → 学生画像可读 的收敛链路，用于发布验收：
 * `PORTRAIT_V2_CALCULATION_VERSION` 演进后，环境必须能从
 * `migration-in-progress` 收敛到画像可读；任何一步失败都以非零退出码报告。
 */
import { createPrismaClient } from '../../src/lib/prisma-client';
import { readCurrentCumulativePortrait } from '../../src/lib/data-governance/cumulative-portrait-read-model';
import { PORTRAIT_V2_CALCULATION_VERSION } from '../../src/lib/data-governance/portrait-v2-model';

interface VerificationReport {
  calculationVersion: { expected: string; fence: string | null; converged: boolean };
  fence: { exists: boolean; activeMigrationRunId: string | null };
  migrationRun: { exists: boolean; mode: string | null; status: string | null; sameGeneration: boolean } | null;
  sampleStudent: {
    userId: string | null;
    stateKind: string | null;
    availabilityReason: string | null;
    readable: boolean;
  };
  converged: boolean;
  blockers: string[];
}

async function main() {
  const prisma = createPrismaClient();
  const blockers: string[] = [];
  try {
    const fence = await prisma.cumulativePortraitCutoverFence.findUnique({
      where: { id: 'global' },
    });
    const calculationConverged = Boolean(
      fence && fence.calculationVersion === PORTRAIT_V2_CALCULATION_VERSION,
    );
    if (!fence) blockers.push('cumulative-portrait-cutover-fence 缺失（需要初始化迁移 run）');
    if (fence && !calculationConverged) {
      blockers.push(
        `fence calculationVersion=${fence.calculationVersion} 与代码版本 ${PORTRAIT_V2_CALCULATION_VERSION} 漂移（需要按新版本重跑迁移并收尾）`,
      );
    }
    if (fence && !fence.activeMigrationRunId) {
      blockers.push('fence.activeMigrationRunId 为空（需要指向 APPLY+COMPLETED run）');
    }

    let migrationRun: VerificationReport['migrationRun'] = null;
    if (fence?.activeMigrationRunId) {
      const run = await prisma.cumulativePortraitMigrationRun.findUnique({
        where: { id: fence.activeMigrationRunId },
      });
      const sameGeneration = Boolean(
        run
          && run.mode === 'APPLY'
          && run.status === 'COMPLETED'
          && run.calculationVersion === fence.calculationVersion
          && run.learnerGeneration === fence.learnerGeneration
          && run.queueGeneration === fence.queueGeneration
          && run.cutoverFence === fence.fence,
      );
      migrationRun = {
        exists: Boolean(run),
        mode: run?.mode ?? null,
        status: run?.status ?? null,
        sameGeneration,
      };
      if (!sameGeneration) {
        blockers.push(
          `activeMigrationRunId=${fence.activeMigrationRunId} 不满足 APPLY+COMPLETED+同代际（mode=${run?.mode ?? '缺失'} status=${run?.status ?? '缺失'}）`,
        );
      }
    }

    const sampleStudentUser = await prisma.user.findFirst({
      where: { role: 'STUDENT' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    let sampleStudent: VerificationReport['sampleStudent'] = {
      userId: sampleStudentUser?.id ?? null,
      stateKind: null,
      availabilityReason: null,
      readable: false,
    };
    if (sampleStudentUser) {
      const portrait = await readCurrentCumulativePortrait(
        prisma,
        sampleStudentUser.id,
        'student',
      );
      const readable = portrait.stateKind !== 'UNAVAILABLE';
      sampleStudent = {
        userId: sampleStudentUser.id,
        stateKind: portrait.stateKind,
        availabilityReason: portrait.availabilityReason,
        readable,
      };
      if (!readable) {
        blockers.push(
          `样本学生画像不可读：stateKind=${portrait.stateKind} reason=${portrait.availabilityReason}`,
        );
      }
    } else {
      blockers.push('数据库中没有 STUDENT 用户，无法抽样验证画像可读性');
    }

    const report: VerificationReport = {
      calculationVersion: {
        expected: PORTRAIT_V2_CALCULATION_VERSION,
        fence: fence?.calculationVersion ?? null,
        converged: calculationConverged,
      },
      fence: {
        exists: Boolean(fence),
        activeMigrationRunId: fence?.activeMigrationRunId ?? null,
      },
      migrationRun,
      sampleStudent,
      converged: blockers.length === 0,
      blockers,
    };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.converged ? 0 : 1;
  } catch (error) {
    console.error('fence 收敛验证执行失败:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
