import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { IlabGrantPayload } from './grant-cookie';
import {
  exchangeIlabTicket,
  refreshIlabAccessToken,
  uploadIlabReport,
  uploadIlabScore,
  type IlabRemoteResult,
  type IlabTokenResult,
} from './ilab-client';
import type { IlabUploadBody } from './payload';
import { IlabServiceError } from './run-lock';

export function ilabConfig() {
  return {
    appId: process.env.ILAB_APP_ID?.trim() || '',
    secret: process.env.ILAB_SECRET?.trim() || '',
    baseUrl: process.env.ILAB_BASE_URL?.trim() || 'https://www.ilab-x.com',
    devBypass: process.env.ILAB_DEV_BYPASS === '1',
  };
}

export async function resolveSessionAuth(
  ticket: string,
  existingGrant: IlabGrantPayload | null,
): Promise<{ grant: IlabGrantPayload; freshlyExchanged: boolean; token?: IlabTokenResult } | null> {
  const trimmed = ticket.trim();
  if (trimmed) {
    const config = ilabConfig();
    const token = await exchangeIlabTicket({
      ticket: trimmed,
      appId: config.appId,
      secret: config.secret,
      baseUrl: config.baseUrl,
      devBypass: config.devBypass,
    }).catch((error: unknown) => {
      throw new IlabServiceError(error instanceof Error ? error.message : '票据校验失败。', 401);
    });
    return {
      grant: {
        v: 1,
        appId: token.bypass ? 'dev' : config.appId,
        username: token.username,
        displayName: token.displayName,
        accessToken: token.accessToken,
        issuedAtMs: Date.now(),
        expiresAtMs: token.expiresAtMs,
        bypass: token.bypass,
      },
      freshlyExchanged: true,
      token,
    };
  }
  if (existingGrant) {
    return { grant: existingGrant, freshlyExchanged: false };
  }
  return null;
}

export function buildSafeStepWindow(input: {
  startedAtMs: number;
  runStartTimeMs: bigint;
  existingSteps: Array<{ seq: number; startTime: number; endTime: number }>;
  seq: number;
  nowMs?: number;
}): { startTime: number; endTime: number; timeUsed: number } {
  const minStart = Number(input.runStartTimeMs);
  const now = Math.max(Math.floor(input.nowMs ?? Date.now()), minStart + 1000);
  const requested = Number.isFinite(input.startedAtMs) ? Math.floor(input.startedAtMs) : now - 1000;
  const clampedStart = Math.max(minStart, Math.min(requested, now - 1000));
  const timeUsed = Math.max(1, Math.floor((now - clampedStart) / 1000));
  let startTime = clampedStart;
  let endTime = clampedStart + timeUsed * 1000;

  const others = input.existingSteps.filter((step) => step.seq !== input.seq);
  const collides = (s: number, e: number) =>
    others.some((step) => step.startTime === s || step.endTime === e);

  if (collides(startTime, endTime)) {
    for (let offset = 1; offset <= 50; offset += 1) {
      if (endTime + offset <= now && !collides(startTime + offset, endTime + offset)) {
        startTime += offset;
        endTime += offset;
        break;
      }
      if (startTime - offset >= minStart && !collides(startTime - offset, endTime - offset)) {
        startTime -= offset;
        endTime -= offset;
        break;
      }
    }
  }
  return { startTime, endTime, timeUsed };
}

export interface UploadRunTarget {
  originId: string;
  appId: string;
  ilabUsername: string;
  displayName: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  uploadStatus: string;
}

export async function uploadWithAutoRefresh<TRun>(input: {
  run: UploadRunTarget;
  config: ReturnType<typeof ilabConfig>;
  upload: IlabUploadBody;
  reportFilename: string;
  reportTitle: string;
  reportHtml: string;
  scoreFetcher?: typeof fetch;
  reportFetcher?: typeof fetch;
  refreshFetcher?: typeof fetch;
}): Promise<{ saved: TRun; refreshedGrant: IlabGrantPayload | null }> {
  const { run, config, upload, reportFilename, reportTitle, reportHtml } = input;
  let currentAccessToken = run.accessToken;
  let currentExpiresAt = run.tokenExpiresAt;
  let refreshedGrant: IlabGrantPayload | null = null;

  const tryRefresh = async (): Promise<boolean> => {
    try {
      const refreshed = await refreshIlabAccessToken({
        accessToken: currentAccessToken,
        appId: run.appId === 'dev' ? config.appId : run.appId,
        secret: config.secret,
        baseUrl: config.baseUrl,
        devBypass: config.devBypass || currentAccessToken === 'dev-bypass-token',
        fetcher: input.refreshFetcher,
      });
      currentAccessToken = refreshed.accessToken;
      currentExpiresAt = refreshed.expiresAtMs ? new Date(refreshed.expiresAtMs) : null;
      await prisma.ilabExperimentRun.updateMany({
        where: {
          appId: run.appId,
          ilabUsername: run.ilabUsername,
          uploadStatus: { not: 'uploaded' },
        },
        data: {
          accessToken: currentAccessToken,
          tokenExpiresAt: currentExpiresAt,
        },
      });
      refreshedGrant = {
        v: 1,
        appId: run.appId,
        username: refreshed.username || run.ilabUsername,
        displayName: refreshed.displayName || run.displayName,
        accessToken: currentAccessToken,
        issuedAtMs: Date.now(),
        expiresAtMs: refreshed.expiresAtMs,
        bypass: refreshed.bypass,
      };
      return true;
    } catch {
      return false;
    }
  };

  if (currentExpiresAt && currentExpiresAt.getTime() <= Date.now() + 60_000) {
    await tryRefresh();
  }

  const scoreAlreadySent = run.uploadStatus === 'score-uploaded' || run.uploadStatus === 'uploaded';
  let scoreCode = 0;
  if (!scoreAlreadySent) {
    let scoreResult: IlabRemoteResult = await uploadIlabScore({
      baseUrl: config.baseUrl,
      accessToken: currentAccessToken,
      payload: upload,
      fetcher: input.scoreFetcher,
    });
    if ((scoreResult.code === 2 || scoreResult.code === 18) && await tryRefresh()) {
      scoreResult = await uploadIlabScore({
        baseUrl: config.baseUrl,
        accessToken: currentAccessToken,
        payload: upload,
        fetcher: input.scoreFetcher,
      });
    }
    if (scoreResult.code !== 0) {
      await prisma.ilabExperimentRun.update({
        where: { originId: run.originId },
        data: { reportHtml, uploadStatus: 'failed', uploadResult: scoreResult.body as Prisma.InputJsonValue },
      });
      throw new IlabServiceError(scoreResult.message || `成绩回传失败（code ${scoreResult.code}）。`, 502);
    }
    scoreCode = scoreResult.code;
    await prisma.ilabExperimentRun.update({
      where: { originId: run.originId },
      data: {
        score: upload.score,
        endTimeMs: BigInt(upload.endTime),
        timeUsedSeconds: upload.timeUsed,
        reportHtml,
        uploadStatus: 'score-uploaded',
        uploadResult: { code: scoreCode },
      },
    });
  }

  let reportResult: IlabRemoteResult = await uploadIlabReport({
    baseUrl: config.baseUrl,
    accessToken: currentAccessToken,
    appId: run.appId,
    originId: run.originId,
    filename: reportFilename,
    title: reportTitle,
    html: reportHtml,
    fetcher: input.reportFetcher,
  });
  if ((reportResult.code === 2 || reportResult.code === 3) && await tryRefresh()) {
    reportResult = await uploadIlabReport({
      baseUrl: config.baseUrl,
      accessToken: currentAccessToken,
      appId: run.appId,
      originId: run.originId,
      filename: reportFilename,
      title: reportTitle,
      html: reportHtml,
      fetcher: input.reportFetcher,
    });
  }
  if (reportResult.code !== 0) {
    await prisma.ilabExperimentRun.update({
      where: { originId: run.originId },
      data: {
        reportHtml,
        uploadStatus: 'score-uploaded',
        attachmentResult: reportResult.body as Prisma.InputJsonValue,
      },
    });
    throw new IlabServiceError(reportResult.message || `实验报告回传失败（code ${reportResult.code}）。成绩已回传，可再次提交以重试报告。`, 502);
  }
  const saved = await prisma.ilabExperimentRun.update({
    where: { originId: run.originId },
    data: {
      status: 1,
      score: upload.score,
      endTimeMs: BigInt(upload.endTime),
      timeUsedSeconds: upload.timeUsed,
      reportHtml,
      uploadStatus: 'uploaded',
      uploadResult: { code: scoreCode },
      attachmentResult: reportResult.body as Prisma.InputJsonValue,
    },
  });
  return { saved: saved as unknown as TRun, refreshedGrant };
}

export async function safeUploadWithAutoRefresh<TRun extends { uploadStatus: string }>(input: {
  run: UploadRunTarget;
  config: ReturnType<typeof ilabConfig>;
  upload: IlabUploadBody;
  reportFilename: string;
  reportTitle: string;
  reportHtml: string;
  scoreFetcher?: typeof fetch;
  reportFetcher?: typeof fetch;
  refreshFetcher?: typeof fetch;
}): Promise<
  | { ok: true; saved: TRun; refreshedGrant: IlabGrantPayload | null }
  | { ok: false; saved: TRun; refreshedGrant: null; errorMessage: string }
> {
  try {
    const result = await uploadWithAutoRefresh<TRun>(input);
    return { ok: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : '实验空间网络回传失败。';
    const latest = await prisma.ilabExperimentRun.findUnique({
      where: { originId: input.run.originId },
      select: { uploadStatus: true },
    });
    const nextUploadStatus = latest?.uploadStatus === 'score-uploaded' ? 'score-uploaded' : 'failed';
    const saved = await prisma.ilabExperimentRun.update({
      where: { originId: input.run.originId },
      data: {
        score: input.upload.score,
        endTimeMs: BigInt(input.upload.endTime),
        timeUsedSeconds: input.upload.timeUsed,
        reportHtml: input.reportHtml,
        uploadStatus: nextUploadStatus,
        ...(nextUploadStatus === 'score-uploaded'
          ? { attachmentResult: { error: message } as Prisma.InputJsonValue }
          : { uploadResult: { error: message } as Prisma.InputJsonValue }),
      },
    });
    return {
      ok: false,
      saved: saved as unknown as TRun,
      refreshedGrant: null,
      errorMessage: message,
    };
  }
}
