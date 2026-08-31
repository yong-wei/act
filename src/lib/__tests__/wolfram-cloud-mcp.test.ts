import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCalcWlsCloudProgram,
  evaluateWolframLanguage,
  unwrapWolframEvaluatorText,
} from '@/lib/wolfram-cloud-mcp';

describe('Wolfram Cloud MCP helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps Out[n] JSON strings from WolframLanguageEvaluator', () => {
    const inner = JSON.stringify({ status: 'ok', result: 'x+1' });
    const text = `Out[1]= ${JSON.stringify(inner)}`;
    expect(unwrapWolframEvaluatorText(text)).toBe(inner);
  });

  it('unwraps During-evaluation JSON with trailing kernel messages', () => {
    const inner = JSON.stringify({ status: 'ok', result: '\\frac{1}{s}' });
    const text = `During evaluation of In[1]:= ${inner}\nGeneral::quit: The kernel quit unexpectedly during evaluation with exit code 0.`;
    expect(unwrapWolframEvaluatorText(text)).toBe(inner);
  });

  it('unwraps quoted JSON followed by trailing kernel messages', () => {
    const inner = JSON.stringify({ status: 'ok', result: 'x+1' });
    const text = `Out[1]= ${JSON.stringify(inner)}\nGeneral::quit: The kernel quit unexpectedly during evaluation with exit code 0.`;
    expect(unwrapWolframEvaluatorText(text)).toBe(inner);
  });

  it('retries evaluate once when the Cloud MCP tools/call connection drops', async () => {
    const initializeResult = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'Wolfram', version: 'test' },
      },
    };
    const callResult = {
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: 'Out[1]= 2' }] },
    };
    let calls = 0;

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (body?.method === 'initialize') {
        return new Response(JSON.stringify(initializeResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'mcp-session-id': `session-${calls}` },
        });
      }
      if (body?.method === 'notifications/initialized') {
        return new Response('', { status: 202 });
      }
      if (calls === 3) {
        throw new TypeError('fetch failed');
      }
      return new Response(JSON.stringify(callResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await expect(
      evaluateWolframLanguage('1+1', { timeoutMs: 30_000, timeConstraintSeconds: 30 }),
    ).resolves.toBe('Out[1]= 2');
    expect(calls).toBe(6);
  });

  it('stops immediately on a pre-cancelled signal without contacting the evaluator', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(
      evaluateWolframLanguage('1+1', { timeoutMs: 5_000, signal: controller.signal }),
    ).rejects.toThrow('公式计算超时');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not retry the evaluator after the caller cancels mid-evaluation', async () => {
    const initializeResult = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'Wolfram', version: 'test' },
      },
    };
    const controller = new AbortController();
    let calls = 0;

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (body?.method === 'initialize') {
        return new Response(JSON.stringify(initializeResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'mcp-session-id': `session-${calls}` },
        });
      }
      if (body?.method === 'notifications/initialized') {
        return new Response('', { status: 202 });
      }
      controller.abort();
      throw new TypeError('fetch failed');
    }));

    await expect(
      evaluateWolframLanguage('1+1', { timeoutMs: 30_000, signal: controller.signal }),
    ).rejects.toThrow('公式计算超时');
    expect(calls).toBe(3);
  });

  it('injects calc.wls and the JSON payload into a Cloud MCP program', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'math-calc', 'calc.wls'), 'utf8');
    const payload = JSON.stringify({ expression: '1', operation: 'laplace', variable: 't' });
    const program = buildCalcWlsCloudProgram(script, payload);

    expect(program).toContain('rawInput = mathCalcPayload;');
    expect(program).not.toContain('Last[$ScriptCommandLine]');
    expect(program).toContain('Throw[$mathCalcJson, "mathCalcDone"]');
    expect(program).not.toContain('Exit[0]');
    expect(program).toContain('FromCharacterCode[');
    for (const code of Buffer.from(payload, 'utf8')) {
      expect(program).toContain(String(code));
    }
  });

  it('normalizes CRLF calc.wls before Cloud MCP injection', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'math-calc', 'calc.wls'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '\r\n');
    const payload = JSON.stringify({ expression: '1', operation: 'laplace', variable: 't' });
    const program = buildCalcWlsCloudProgram(script, payload);

    expect(program).toContain('rawInput = mathCalcPayload;');
    expect(program).toContain('Throw[$mathCalcJson, "mathCalcDone"]');
    expect(program).not.toContain('Exit[0]');
    expect(program).toContain('writeResponse[payload_Association] := ($mathCalcJson');
  });
});
