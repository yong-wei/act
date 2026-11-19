const endpoint = '/api/ilab/course-save-admission';

function pendingSaveKey(scopeKey: string, roundRef: string) {
  return `${scopeKey}:pending-platform-save:${roundRef}`;
}

export function hasPendingVesselCourseSave(scopeKey: string, roundRef: string) {
  try { return sessionStorage.getItem(pendingSaveKey(scopeKey, roundRef)) === '1'; }
  catch { return false; }
}

export async function withVesselCourseSaveAdmission<T>(roundRef: string, onWaiting: (message: string) => void,
  save: (checkLease: () => void, finish: () => Promise<void>) => Promise<T>, scopeKey: string, signal?: AbortSignal): Promise<T> {
  const pendingKey = pendingSaveKey(scopeKey, roundRef);
  try { sessionStorage.setItem(pendingKey, '1'); }
  catch { /* The original evidence is still available in IndexedDB. */ }
  const worker = crypto.randomUUID();
  const request = async (action: 'reserve' | 'renew' | 'release') => {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roundRef, worker, action }),
      signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal && action !== 'release' ? [signal] : [])]),
    });
    if (!response.ok && response.status !== 429 && response.status !== 503) {
      throw new Error('平台保存许可暂不可用，本机记录已保留。');
    }
    return response.json() as Promise<{ admitted: boolean; retryAfterMs: number }>;
  };

  for (;;) {
    signal?.throwIfAborted();
    const receipt = await request('reserve');
    if (receipt.admitted) break;
    onWaiting('正在排队保存。本机记录已保留，请等待。');
    await new Promise(resolve => setTimeout(resolve, receipt.retryAfterMs + Math.random() * 400));
  }

  let renewedAt = performance.now();
  let heartbeat: Promise<void> | undefined;
  const checkLease = () => {
    signal?.throwIfAborted();
    if (performance.now() - renewedAt >= 25_000) {
      throw new Error('平台保存许可已过期，本机记录已保留，请再次点击保存。');
    }
  };
  const timer = setInterval(() => {
    if (heartbeat) return;
    const startedAt = performance.now();
    heartbeat = request('renew').then(receipt => {
      if (receipt.admitted) renewedAt = startedAt;
    }).catch(() => { /* A temporary network interruption can recover on the next renewal. */ })
      .finally(() => { heartbeat = undefined; });
  }, 8000);
  let released: Promise<void> | undefined;
  const release = () => released ??= (async () => {
    clearInterval(timer);
    await heartbeat;
    await request('release').catch(() => { /* The lease expires after an interrupted release. */ });
  })();
  try {
    onWaiting('正在保存到平台。');
    return await save(checkLease, async () => {
      try { sessionStorage.removeItem(pendingKey); }
      catch { /* Repeating a confirmed save reuses its evidence receipts. */ }
      await release();
    });
  } finally {
    await release();
  }
}
