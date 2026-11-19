'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function StudentClassroomAdmission({ sessionId, entryHref, retryAfterMs }: {
  sessionId: string;
  entryHref: string;
  retryAfterMs: number;
}) {
  const router = useRouter();
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const lifetime = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    function schedule(delay: number) {
      timer = setTimeout(poll, delay + Math.random() * 350);
    }
    async function poll() {
      let delay = 2500;
      try {
        const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}?admission=only`, {
          cache: 'no-store',
          signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(7000)]),
        });
        if (lifetime.signal.aborted) return;
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setRejected(true);
          return;
        }
        if (response.ok) {
          const admission = await response.json();
          if (lifetime.signal.aborted) return;
          if (admission.admission === 'ready') {
            router.refresh();
            delay = 5000;
          } else if (typeof admission.retryAfterMs === 'number') {
            delay = Math.max(250, Math.min(10_000, admission.retryAfterMs));
          }
        }
      } catch {
        // A transient failure should keep the student in the classroom queue.
      }
      if (!lifetime.signal.aborted) schedule(delay);
    }
    schedule(retryAfterMs);
    return () => {
      lifetime.abort();
      clearTimeout(timer);
    };
  }, [retryAfterMs, router, sessionId]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-3 px-6"
      data-classroom-admission="waiting">
      <h1 className="text-xl font-semibold">进入互动课堂</h1>
      <p role="status" className="text-muted-foreground">
        {rejected ? '当前无法进入这间课堂，请返回课程入口。' : '正在连接课堂。入场繁忙时会依次进入，请保留当前页面。'}
      </p>
      {rejected ? <a href={entryHref} className="underline">返回课程入口</a> : null}
    </main>
  );
}
