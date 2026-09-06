'use client';

/**
 * 会话内治理资源卡（批 4 / 任务 4.1-4.3）。
 *
 * 渲染 companion-origin 消息 companionContext.resources 中的资源卡快照：
 * - 打开/恢复时按 resourceId + versionHash 调服务端重校验（权限与版本），
 *   失效仅降级对应卡片，不影响会话与其他卡片；
 * - 互动/教材卡先说明资源定位（是什么/解决什么/预计用时/完成内容）再提供站内跳转；
 * - 媒体卡内嵌原生 <video>/<audio> 控件（播放、暂停、进度、音量、全屏），
 *   禁止自动播放；全屏退出后保持播放位置与会话滚动位置。
 */

import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Boxes, CircleAlert } from 'lucide-react';

import type { CompanionResourceCardInput } from '@/features/ai/companion/trigger-engine';

interface VerifyResult {
  status: 'available' | 'unavailable';
  reason?: 'not-found' | 'hash-drift' | 'unauthorized';
  href?: string;
  mediaUrl?: string;
  mediaKind?: 'video' | 'audio';
}

const KIND_LABELS: Record<string, string> = {
  'textbook-unit': '教材单元',
  'interactive-resource': '互动资源',
  'governed-registry-resource': '治理资源',
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? '学习资源';
}

function unavailableReasonText(reason?: VerifyResult['reason']): string {
  switch (reason) {
    case 'hash-drift':
      return '资源内容已更新，建议回到最新版本查看。';
    case 'unauthorized':
      return '当前账号无权访问该资源。';
    default:
      return '资源已下架或不可用。';
  }
}

function CompanionResourceCard({ card }: { card: CompanionResourceCardInput }) {
  const [verify, setVerify] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      resourceId: card.resourceId,
      versionHash: card.versionHash,
      kind: card.kind,
    });
    fetch(`/api/ai/companion/resources/verify?${params.toString()}`)
      .then((response) => (response.ok ? response.json() as Promise<VerifyResult> : null))
      .then((result) => {
        if (!cancelled) setVerify(result ?? { status: 'unavailable', reason: 'not-found' });
      })
      .catch(() => {
        if (!cancelled) setVerify({ status: 'unavailable', reason: 'not-found' });
      });
    return () => {
      cancelled = true;
    };
  }, [card.resourceId, card.versionHash, card.kind]);

  return (
    <div
      className="rounded-xl border border-border bg-card/60 p-3"
      data-konling-companion-resource-card={card.kind}
      data-konling-companion-resource-state={verify?.status ?? 'pending'}
    >
      <div className="flex items-start gap-2">
        {card.kind === 'interactive-resource' ? (
          <Boxes className="mt-0.5 h-4 w-4 flex-none text-sky-500 dark:text-sky-300" aria-hidden="true" />
        ) : (
          <BookOpen className="mt-0.5 h-4 w-4 flex-none text-sky-500 dark:text-sky-300" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-subtle">{kindLabel(card.kind)}</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{card.reason}</p>
          {card.caption ? (
            <p className="mt-0.5 text-xs leading-5 text-subtle">{card.caption}</p>
          ) : null}
          <p className="mt-0.5 text-xs leading-5 text-subtle">完成后回到对话可继续讲解。</p>
        </div>
      </div>
      {verify === null ? (
        <p className="mt-2 text-xs text-subtle" role="status">正在校验资源…</p>
      ) : verify.status === 'unavailable' ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-subtle" data-konling-companion-resource-degraded>
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          资源已更新或不可用：{unavailableReasonText(verify.reason)}
        </p>
      ) : verify.mediaUrl && verify.mediaKind === 'video' ? (
        <video
          controls
          preload="metadata"
          playsInline
          src={verify.mediaUrl}
          className="mt-2 w-full rounded-lg"
          data-konling-companion-media="video"
        >
          <track kind="captions" srcLang="zh-CN" label="中文说明" src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A00%3A00%3A00.000%20--%3E%2000%3A00%3A05.000%0A%E6%9A%82%E6%97%A0%E5%8F%AF%E7%94%A8%E5%AD%97%E5%B9%95%E3%80%82" />
        </video>
      ) : verify.mediaUrl && verify.mediaKind === 'audio' ? (
        <audio
          controls
          preload="metadata"
          src={verify.mediaUrl}
          className="mt-2 w-full"
          data-konling-companion-media="audio"
        />
      ) : verify.href ? (
        <a
          href={verify.href}
          className="btn-ghost-themed mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
          data-konling-companion-resource-link={card.resourceId}
        >
          打开{kindLabel(card.kind)}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

/** 从消息对象提取 companion 资源卡快照（消息 JSON 自由结构，宽松解析）。 */
export function extractCompanionResourceCards(message: unknown): CompanionResourceCardInput[] {
  if (!message || typeof message !== 'object') return [];
  const context = (message as Record<string, unknown>).companionContext;
  if (!context || typeof context !== 'object') return [];
  const resources = (context as Record<string, unknown>).resources;
  if (!Array.isArray(resources)) return [];
  return resources.filter((item): item is CompanionResourceCardInput => {
    if (!item || typeof item !== 'object') return false;
    const card = item as Record<string, unknown>;
    return typeof card.resourceId === 'string'
      && typeof card.versionHash === 'string'
      && typeof card.reason === 'string'
      && typeof card.kind === 'string';
  });
}

/** 错题场景的知识点仅在会话内展示（气泡不直接显示知识点）。 */
function extractCompanionKnowledgePoints(message: unknown): string[] {
  if (!message || typeof message !== 'object') return [];
  const context = (message as Record<string, unknown>).companionContext;
  if (!context || typeof context !== 'object') return [];
  const points = (context as Record<string, unknown>).knowledgePoints;
  if (!Array.isArray(points)) return [];
  return points.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function CompanionResourceCards({ message }: { message: unknown }) {
  const cards = extractCompanionResourceCards(message);
  const knowledgePoints = extractCompanionKnowledgePoints(message);
  if (cards.length === 0 && knowledgePoints.length === 0) return null;
  return (
    <div className="mt-2 space-y-2" data-konling-companion-resource-cards>
      {knowledgePoints.length > 0 ? (
        <div
          className="rounded-xl border border-border bg-card/60 p-3"
          data-konling-companion-knowledge-points
        >
          <p className="text-xs font-medium text-subtle">本题主涉及的薄弱知识点</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm leading-6 text-foreground">
            {knowledgePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {cards.map((card) => (
        <CompanionResourceCard key={`${card.kind}:${card.resourceId}`} card={card} />
      ))}
    </div>
  );
}
