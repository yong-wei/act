'use client';

type Difference = { path: string; local: string; server: string };

export function PreparationConflictComparison({
  local,
  server,
  onKeepLocal,
  onUseServer,
}: {
  local: unknown;
  server: unknown;
  onKeepLocal: () => void;
  onUseServer: () => void;
}) {
  const differences = collectDifferences(local, server).slice(0, 100);
  return (
    <section className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" aria-label="本地与服务器版本比较">
      <h2 className="font-medium">本地修改与服务器版本比较</h2>
      <p className="mt-1 text-sm text-muted-foreground">选择保留本地内容时，将以当前服务器修订作为新的保存基线；选择服务器版本会明确丢弃本地修改。</p>
      <div className="mt-3 max-h-80 overflow-auto rounded border border-border bg-background">
        {differences.length ? differences.map((difference) => (
          <div key={difference.path} className="grid gap-2 border-b border-border p-3 text-sm last:border-b-0 md:grid-cols-[12rem_1fr_1fr]">
            <strong className="break-words">{difference.path}</strong>
            <div><span className="text-xs text-muted-foreground">本地</span><p className="whitespace-pre-wrap break-words">{difference.local}</p></div>
            <div><span className="text-xs text-muted-foreground">服务器</span><p className="whitespace-pre-wrap break-words">{difference.server}</p></div>
          </div>
        )) : <p className="p-3 text-sm text-muted-foreground">两份内容没有可见差异。</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onKeepLocal} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">保留本地内容并使用服务器基线</button>
        <button type="button" onClick={onUseServer} className="rounded border border-border px-3 py-1.5 text-sm">采用服务器版本</button>
      </div>
    </section>
  );
}

function collectDifferences(local: unknown, server: unknown, path = '正文'): Difference[] {
  if (Object.is(local, server)) return [];
  if (isRecord(local) && isRecord(server)) {
    return [...new Set([...Object.keys(local), ...Object.keys(server)])]
      .flatMap((key) => collectDifferences(local[key], server[key], path === '正文' ? key : `${path}.${key}`));
  }
  if (Array.isArray(local) && Array.isArray(server)) {
    return Array.from({ length: Math.max(local.length, server.length) }, (_, index) => (
      collectDifferences(local[index], server[index], `${path}[${index + 1}]`)
    )).flat();
  }
  return [{ path, local: displayValue(local), server: displayValue(server) }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function displayValue(value: unknown) {
  if (value === undefined) return '（不存在）';
  if (value === null) return '（空）';
  if (typeof value === 'string') return value || '（空字符串）';
  return String(value);
}
