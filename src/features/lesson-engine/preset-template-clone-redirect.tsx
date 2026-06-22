'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface PresetTemplateCloneRedirectProps {
  presetKey: string;
  presetTitle: string;
  editBaseHref: string;
  recoveryHref: string;
  returnTo: string;
}

interface ClonePayload {
  lessonPlanId: string;
}

const inFlightCloneRequests = new Map<string, Promise<ClonePayload>>();

function buildCloneKey(presetKey: string, editBaseHref: string, returnTo: string) {
  return `preset-template-clone:${editBaseHref}:${returnTo}:${presetKey}`;
}

function buildEditTarget(editBaseHref: string, lessonPlanId: string, returnTo: string) {
  return `${editBaseHref}/${encodeURIComponent(lessonPlanId)}/edit?returnTo=${encodeURIComponent(returnTo)}`;
}

function getOrCreateCloneRequest(key: string, presetKey: string) {
  const current = inFlightCloneRequests.get(key);
  if (current) return current;

  const request = fetch('/api/teacher/preset-lessons/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetKey }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null) as { lessonPlanId?: string; error?: string } | null;

      if (!response.ok || !payload?.lessonPlanId) {
        throw new Error(payload?.error ?? '模板克隆失败');
      }

      return { lessonPlanId: payload.lessonPlanId };
    })
    .finally(() => {
      if (inFlightCloneRequests.get(key) === request) {
        inFlightCloneRequests.delete(key);
      }
    });

  inFlightCloneRequests.set(key, request);
  return request;
}

export function PresetTemplateCloneRedirect({
  presetKey,
  presetTitle,
  editBaseHref,
  recoveryHref,
  returnTo,
}: PresetTemplateCloneRedirectProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cloneKey = buildCloneKey(presetKey, editBaseHref, returnTo);

    async function clonePreset() {
      try {
        const payload = await getOrCreateCloneRequest(cloneKey, presetKey);
        if (cancelled) return;

        const target = buildEditTarget(editBaseHref, payload.lessonPlanId, returnTo);
        window.location.replace(target);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '模板克隆失败');
        }
      }
    }

    clonePreset();
    return () => {
      cancelled = true;
    };
  }, [editBaseHref, presetKey, returnTo]);

  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center px-6 py-10 text-slate-100">
      <section className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900/80 p-8">
        <div className="flex items-start gap-3">
          {error ? null : <Loader2 className="mt-1 h-5 w-5 animate-spin text-cyan-300" />}
          <div>
            <h1 className="text-xl font-semibold text-white">正在使用模板创建教案</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {error
                ? `模板“${presetTitle}”未能创建：${error}`
                : `正在克隆模板“${presetTitle}”，完成后将进入教案编辑页。`}
            </p>
          </div>
        </div>
        {error ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={recoveryHref} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-500">
              重新选择模板
            </Link>
            <Link href={returnTo} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-500">
              返回教案列表
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
