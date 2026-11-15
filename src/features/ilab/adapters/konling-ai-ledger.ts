import type { Prisma } from '@prisma/client';

import { emptyAiLedger, isAiUsageLedger, recordAiCall, type IlabAiDeployment } from '@/features/ilab/ai-data';
import { prisma } from '@/lib/prisma';
import { resolveSimulationVesselIdForCourse } from '@/resources/simulations/experiments/simulation-ai-contexts';

import { ILAB_ACCOUNT_PROVIDER } from './ilab-account-service';

function inferAiDeployment(provider: string, endpoint?: string): IlabAiDeployment {
  const host = (endpoint || '').toLowerCase();
  const normalizedProvider = provider.toLowerCase();
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0')) {
    return '本地运行';
  }
  if (
    host.includes('.local')
    || host.includes('10.')
    || host.includes('192.168.')
    || host.includes('172.16.')
    || normalizedProvider.includes('ollama')
    || normalizedProvider.includes('vllm')
    || normalizedProvider.includes('local')
  ) {
    return '私有化部署';
  }
  return '公有云服务';
}

function parseProviderAccountId(providerAccountId: string): { appId: string; username: string } | null {
  const separator = providerAccountId.indexOf(':');
  if (separator <= 0) return null;
  const appId = providerAccountId.slice(0, separator).trim();
  const username = providerAccountId.slice(separator + 1).trim();
  if (!appId || !username) return null;
  return { appId, username };
}

/**
 * 将七船虚拟仿真实验中的控灵助教实时调用次数与真实 Token 用量记录到当前进行中的实验运行账本中，
 * 确保实验空间回传 ai_data 与真实模型消费一致且失败时绝不阻塞对话响应。
 */
export async function recordSimulationKonlingAiUsage(input: {
  userId: string;
  courseId: string;
  stepId?: string | null;
  model: string;
  provider: string;
  endpoint?: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const vesselId = resolveSimulationVesselIdForCourse(input.courseId);
  if (!vesselId || !input.userId.trim()) return;

  const modelName = input.model.trim() || 'configured-model';
  const providerName = input.provider.trim() || 'configured-provider';
  const deployment = inferAiDeployment(providerName, input.endpoint);
  const inputTokens = typeof input.inputTokens === 'number' && Number.isFinite(input.inputTokens)
    ? Math.max(0, Math.floor(input.inputTokens))
    : 0;
  const outputTokens = typeof input.outputTokens === 'number' && Number.isFinite(input.outputTokens)
    ? Math.max(0, Math.floor(input.outputTokens))
    : 0;
  const usageMissing = input.inputTokens === undefined && input.outputTokens === undefined;
  const scenario = '实验步骤实时答疑与控制机理引导';

  try {
    await prisma.$transaction(async (tx) => {
      let activeRun = await tx.ilabExperimentRun.findFirst({
        where: {
          userId: input.userId,
          vesselId,
          status: 2,
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          userId: true,
          aiLedger: true,
        },
      });

      if (!activeRun) {
        const ilabAccounts = await tx.account.findMany({
          where: {
            userId: input.userId,
            provider: ILAB_ACCOUNT_PROVIDER,
          },
          select: {
            providerAccountId: true,
          },
        });

        for (const account of ilabAccounts) {
          const parsed = parseProviderAccountId(account.providerAccountId);
          if (!parsed) continue;
          activeRun = await tx.ilabExperimentRun.findFirst({
            where: {
              appId: parsed.appId,
              ilabUsername: parsed.username,
              vesselId,
              status: 2,
            },
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              userId: true,
              aiLedger: true,
            },
          });
          if (activeRun) break;
        }
      }

      if (!activeRun) return;

      const currentLedger = isAiUsageLedger(activeRun.aiLedger)
        ? activeRun.aiLedger
        : emptyAiLedger();
      const nextLedger = recordAiCall(currentLedger, {
        scenario,
        model: modelName,
        provider: providerName,
        deployment,
        inputTokens,
        outputTokens,
        usageMissing,
      });

      await tx.ilabExperimentRun.update({
        where: { id: activeRun.id },
        data: {
          ...(activeRun.userId ? {} : { userId: input.userId }),
          aiLedger: nextLedger as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    console.warn('[ilab] 记录控灵实验 AI 用量失败（已忽略，不影响助教回复）:', error);
  }
}
