'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { classroomWaitFragment, studentEntryTarget } from '@/features/classroom/session/student-entry-target';
import { admissionRetryDelay } from '../session-framework/admission-retry-delay';

function subscribeToFragment(changed: () => void) {
  window.addEventListener('hashchange', changed);
  return () => window.removeEventListener('hashchange', changed);
}

function readWaitingHref() {
  const hash = window.location.hash;
  return hash.startsWith(classroomWaitFragment) ? hash.slice(classroomWaitFragment.length) : '';
}

export function useStudentClassroomEntry() {
  const router = useRouter();
  const href = useSyncExternalStore(subscribeToFragment, readWaitingHref, () => '');
  const target = studentEntryTarget(href);

  function enter(studentHref: string, waitAtEntry?: boolean) {
    if (waitAtEntry && studentEntryTarget(studentHref)) {
      window.location.hash = classroomWaitFragment + studentHref;
    } else {
      router.push(studentHref);
    }
  }

  const waiting = target && <StudentClassroomAdmission key={href} sessionId={target.sessionId}
    entryHref={target.entryHref} readyHref={target.href} retryAfterMs={0} />;
  return { enter, waiting };
}

export function StudentClassroomAdmission({ sessionId, entryHref, retryAfterMs, readyHref }: {
  sessionId: string;
  entryHref: string;
  retryAfterMs: number;
  readyHref?: string;
}) {
  const router = useRouter();
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const lifetime = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    function schedule(delay: number) {
      timer = setTimeout(poll, admissionRetryDelay(delay));
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
            if (readyHref) {
              if (readWaitingHref() !== readyHref) return;
              router.replace(admission.status === 'FINISHED' ? entryHref : readyHref);
            } else {
              router.refresh();
            }
            delay = 5000;
          } else if (Number.isFinite(admission.retryAfterMs)) {
            delay = admission.retryAfterMs;
          }
        }
      } catch {
        // A transient failure should keep the student in the classroom queue.
      }
      if (!lifetime.signal.aborted) schedule(delay);
    }
    // An entry click has no receipt yet. A server-rendered waiter already has one.
    if (readyHref) timer = setTimeout(poll, 0);
    else schedule(retryAfterMs);
    return () => {
      lifetime.abort();
      clearTimeout(timer);
    };
  }, [entryHref, readyHref, retryAfterMs, router, sessionId]);

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
