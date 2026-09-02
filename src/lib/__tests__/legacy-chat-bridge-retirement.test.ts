import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const RETAINED_SURFACES = [
  'src/app/ai/copilot/page.tsx',
  'src/features/ai/copilot-panel.tsx',
  'src/components/ai/global-ai-sidebar.tsx',
];

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('legacy chat bridge retirement', () => {
  it('keeps the ingress adapter free of conversation store, provider, and business authority', () => {
    const hookSource = source('src/hooks/useLegacyChat.ts');
    expect(hookSource).toContain('Bounded ingress adapter');
    for (const forbidden of ['localStorage', 'indexedDB', '@/lib/prisma', '@/features/', 'provider-registry', 'provider-runtime']) {
      expect(hookSource).not.toContain(forbidden);
    }
  });

  it('routes every retained chat surface through the single canonical chat route', () => {
    for (const path of RETAINED_SURFACES) {
      const surface = source(path);
      expect(surface, path).toContain("api: '/api/ai/chat'");
      // 会话内容只能由服务端 conversation 合同持有；localStorage 里允许的
      // 只有服务端会话 id 指针（resume 用），不允许本地消息缓存 hook。
      expect(surface, path).not.toContain('useLocalKonlingSession');
      expect(surface, path).not.toContain('indexedDB');
    }
  });

  it('does not reintroduce a second client conversation store hook', () => {
    const sessionHook = source('src/hooks/useKonlingSession.ts');
    expect(sessionHook).not.toContain('export function useKonlingSession(');
    expect(sessionHook).not.toContain('useSWR');
  });

  it('keeps interactive AI off direct provider selection and provider parsing', () => {
    for (const path of ['src/hooks/useInteractiveAI.ts', 'src/features/interactive/hooks/useInteractiveAI.ts']) {
      const hook = source(path);
      expect(hook, path).not.toContain('provider-registry');
      expect(hook, path).not.toContain('provider-runtime');
      expect(hook, path).not.toContain('provider-settings');
    }
  });
});
