import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIProviderConfig } from '@/lib/ai/provider-config';

const openAIMockState = vi.hoisted(() => ({
  createOpenAIOptions: undefined as
    | { fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }
    | undefined,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((options) => {
    openAIMockState.createOpenAIOptions = options;
    return {
      chat: vi.fn((modelId: string) => ({ modelId })),
    };
  }),
}));

const siliconflowSource = readFileSync(
  join(process.cwd(), 'src/lib/ai/providers/siliconflow.ts'),
  'utf8',
);
const providerTypesSource = readFileSync(
  join(process.cwd(), 'src/lib/ai/providers/types.ts'),
  'utf8',
);
const providerRegistrySource = readFileSync(
  join(process.cwd(), 'src/lib/ai/provider-registry.ts'),
  'utf8',
);

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!existsSync(filePath)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('SiliconFlow AI SDK provider adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    openAIMockState.createOpenAIOptions = undefined;
  });

  it('keeps OpenAI-compatible providers on chat completions instead of the Responses API', () => {
    expect(siliconflowSource).toContain('return siliconflow.chat(modelId || config.model)');
    expect(siliconflowSource).not.toContain('return siliconflow(modelId || config.model)');
    expect(providerTypesSource).toContain("ReturnType<OpenAICompatibleProvider['chat']>");
    expect(providerRegistrySource).toContain("config.providerKind === 'openai-compatible'");
    expect(providerRegistrySource).toContain('requires a native adapter before runtime use');
  });

  it('sends generic SiliconFlow chat requests without stream_options', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    const { createSiliconFlowAdapter } = await import(
      '@/lib/ai/providers/siliconflow'
    );
    const config: AIProviderConfig = {
      provider: 'siliconflow',
      providerKind: 'openai-compatible',
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: 'test-key',
      authMode: 'bearer-api-key',
      secretRef: 'env:SILICONFLOW_API_KEY',
      model: 'Qwen/Qwen3.5-35B-A3B',
      enabled: true,
      priority: 100,
      health: 'unknown',
      capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
    };

    createSiliconFlowAdapter(config);
    const providerFetch = openAIMockState.createOpenAIOptions?.fetch;
    expect(providerFetch).toBeDefined();

    await providerFetch?.('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'Qwen/Qwen3.5-35B-A3B',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    const forwardedBody = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string
    ) as Record<string, unknown>;
    expect(forwardedBody).not.toHaveProperty('stream_options');
    expect(forwardedBody).toMatchObject({
      model: 'Qwen/Qwen3.5-35B-A3B',
      stream: true,
      enable_thinking: false,
    });
  });

  it('does not add Qwen thinking defaults to non-Qwen generic SiliconFlow requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    const { createSiliconFlowAdapter } = await import(
      '@/lib/ai/providers/siliconflow'
    );
    const config: AIProviderConfig = {
      provider: 'siliconflow',
      providerKind: 'openai-compatible',
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: 'test-key',
      authMode: 'bearer-api-key',
      secretRef: 'env:SILICONFLOW_API_KEY',
      model: 'Vendor/Model',
      enabled: true,
      priority: 100,
      health: 'unknown',
      capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
    };

    createSiliconFlowAdapter(config);
    await openAIMockState.createOpenAIOptions?.fetch?.(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'Vendor/Model',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
          stream_options: { include_usage: true },
        }),
      }
    );

    const forwardedBody = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string
    ) as Record<string, unknown>;
    expect(forwardedBody).not.toHaveProperty('stream_options');
    expect(forwardedBody).not.toHaveProperty('enable_thinking');
  });

  it('terminates the DeepSeek curl process when the request signal aborts', async () => {
    const fakeBin = mkdtempSync(join(tmpdir(), 'siliconflow-curl-abort-'));
    const fakeCurl = join(fakeBin, 'curl');
    const startedFile = join(fakeBin, 'started');
    const terminatedFile = join(fakeBin, 'terminated');
    writeFileSync(fakeCurl, `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.SILICONFLOW_ABORT_TEST_STARTED, 'started');
process.on('SIGTERM', () => {
  fs.writeFileSync(process.env.SILICONFLOW_ABORT_TEST_TERMINATED, 'terminated');
  process.exit(0);
});
setInterval(() => undefined, 1000);
`);
    chmodSync(fakeCurl, 0o755);

    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}:${previousPath ?? ''}`;
    process.env.SILICONFLOW_ABORT_TEST_STARTED = startedFile;
    process.env.SILICONFLOW_ABORT_TEST_TERMINATED = terminatedFile;
    const controller = new AbortController();

    try {
      const { createSiliconFlowAdapter } = await import(
        '@/lib/ai/providers/siliconflow'
      );
      const config: AIProviderConfig = {
        provider: 'siliconflow',
        providerKind: 'openai-compatible',
        baseURL: 'https://api.siliconflow.cn/v1',
        apiKey: 'test-secret-key',
        authMode: 'bearer-api-key',
        secretRef: 'env:SILICONFLOW_API_KEY',
        model: 'deepseek-ai/DeepSeek-V4-Flash',
        enabled: true,
        priority: 100,
        health: 'unknown',
        capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
      };

      createSiliconFlowAdapter(config);
      const request = openAIMockState.createOpenAIOptions?.fetch?.(
        'https://api.siliconflow.cn/v1/chat/completions',
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            model: 'deepseek-ai/DeepSeek-V4-Flash',
            messages: [{ role: 'user', content: 'private-plan-content' }],
          }),
        },
      );
      expect(request).toBeDefined();
      await waitForFile(startedFile);
      controller.abort();

      const error = await request?.then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(error).toMatchObject({
        name: 'AbortError',
        message: 'SiliconFlow DeepSeek request was aborted.',
      });
      expect(String(error)).not.toContain('test-secret-key');
      expect(String(error)).not.toContain('private-plan-content');
      await waitForFile(terminatedFile);
    } finally {
      controller.abort();
      process.env.PATH = previousPath;
      delete process.env.SILICONFLOW_ABORT_TEST_STARTED;
      delete process.env.SILICONFLOW_ABORT_TEST_TERMINATED;
      rmSync(fakeBin, { recursive: true, force: true });
    }
  });
});
