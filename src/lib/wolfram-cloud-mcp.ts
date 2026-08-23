/**
 * Wolfram Cloud MCP 客户端。
 *
 * 生产公式计算走官方 Streamable HTTP 端点
 * `https://agenttools.wolfram.com/mcp`，调用 `WolframLanguageEvaluator`。
 * 不在本机或容器内安装 Wolfram Engine。
 */

export const WOLFRAM_CLOUD_MCP_DEFAULT_URL = 'https://agenttools.wolfram.com/mcp';
export const WOLFRAM_LANGUAGE_EVALUATOR_TOOL = 'WolframLanguageEvaluator';

const MCP_PROTOCOL_VERSION = '2025-03-26';
const CLIENT_INFO = { name: 'act-konling-math-calc', version: '1.0.0' } as const;

export class WolframCloudMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WolframCloudMcpError';
  }
}

export function getWolframCloudMcpUrl(): string {
  const configured = process.env.WOLFRAM_CLOUD_MCP_URL?.trim();
  return configured && configured.length > 0
    ? configured
    : WOLFRAM_CLOUD_MCP_DEFAULT_URL;
}

function getOptionalAuthHeader(): string | undefined {
  const token = process.env.WOLFRAM_CLOUD_MCP_TOKEN?.trim()
    || process.env.WOLFRAM_MCP_SERVICE_API_KEY?.trim();
  return token ? `Bearer ${token}` : undefined;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
}

interface JsonRpcFailure {
  jsonrpc: '2.0';
  id?: number | string;
  error: { code?: number; message?: string };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

function isJsonRpcFailure(value: JsonRpcResponse): value is JsonRpcFailure {
  return 'error' in value && value.error !== undefined;
}

function parseJsonRpcBody(body: string): JsonRpcResponse {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 返回空响应');
  }
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as JsonRpcResponse;
  }
  const dataLine = trimmed
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'));
  if (!dataLine) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 返回无法解析的响应');
  }
  return JSON.parse(dataLine.slice('data:'.length).trim()) as JsonRpcResponse;
}

async function postMcp(
  url: string,
  payload: Record<string, unknown>,
  sessionId: string | undefined,
  timeoutMs: number,
): Promise<{ json: JsonRpcResponse; sessionId: string | undefined; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const authorization = getOptionalAuthHeader();
  if (authorization) {
    headers.Authorization = authorization;
  }
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const nextSession = response.headers.get('mcp-session-id') ?? sessionId;
    const text = await response.text();
    if (payload.method === 'notifications/initialized') {
      return { json: { jsonrpc: '2.0', result: {} }, sessionId: nextSession, status: response.status };
    }
    if (!response.ok && !text.trim()) {
      throw new WolframCloudMcpError('Wolfram Cloud MCP 不可用');
    }
    const json = parseJsonRpcBody(text);
    if (isJsonRpcFailure(json)) {
      throw new WolframCloudMcpError('Wolfram Cloud MCP 不可用');
    }
    return { json, sessionId: nextSession, status: response.status };
  } catch (error) {
    if (error instanceof WolframCloudMcpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WolframCloudMcpError('公式计算超时');
    }
    throw new WolframCloudMcpError('Wolfram Cloud MCP 不可用');
  } finally {
    clearTimeout(timer);
  }
}

function extractToolText(result: unknown): string {
  if (!result || typeof result !== 'object') {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 返回无法解析的工具结果');
  }
  const record = result as { content?: unknown; isError?: unknown };
  if (record.isError === true) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 计算失败');
  }
  if (!Array.isArray(record.content)) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 返回无法解析的工具结果');
  }
  const texts = record.content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const entry = item as { type?: unknown; text?: unknown };
      return entry.type === 'text' && typeof entry.text === 'string' ? entry.text : '';
    })
    .filter((value) => value.length > 0);
  if (texts.length === 0) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 返回空计算结果');
  }
  return texts.join('\n');
}

/**
 * 把 `Out[1]= "{\"status\":...}"` 解成 JSON 文本。
 */
export function unwrapWolframEvaluatorText(output: string): string {
  const trimmed = output.trim();
  const withoutOut = trimmed.replace(/^Out\[\d+\]=\s*/, '').trim();
  if (withoutOut.startsWith('"')) {
    return JSON.parse(withoutOut) as string;
  }
  return withoutOut;
}

export async function evaluateWolframLanguage(
  code: string,
  options?: { timeoutMs?: number; timeConstraintSeconds?: number },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const startedAt = Date.now();
  const remainingMs = () => {
    const leftover = timeoutMs - (Date.now() - startedAt);
    if (leftover <= 0) {
      throw new WolframCloudMcpError('公式计算超时');
    }
    return leftover;
  };
  const timeConstraintSeconds = Math.max(
    1,
    Math.min(
      options?.timeConstraintSeconds ?? Math.ceil(timeoutMs / 1000),
      Math.ceil(timeoutMs / 1000),
    ),
  );
  const url = getWolframCloudMcpUrl();

  const initialized = await postMcp(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
  }, undefined, remainingMs());
  if (!initialized.sessionId) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 未返回会话');
  }

  await postMcp(url, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }, initialized.sessionId, remainingMs());

  const callBudgetMs = remainingMs();
  const evaluated = await postMcp(url, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: WOLFRAM_LANGUAGE_EVALUATOR_TOOL,
      arguments: {
        code,
        timeConstraint: Math.max(1, Math.min(timeConstraintSeconds, Math.ceil(callBudgetMs / 1000))),
      },
    },
  }, initialized.sessionId, callBudgetMs);

  if (isJsonRpcFailure(evaluated.json)) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 不可用');
  }
  return extractToolText(evaluated.json.result);
}

export function buildCalcWlsCloudProgram(scriptSource: string, payloadJson: string): string {
  let script = scriptSource;
  if (script.startsWith('#!')) {
    const newline = script.indexOf('\n');
    script = newline >= 0 ? script.slice(newline + 1) : '';
  }

  script = script.replace(
    'writeResponse[payload_Association] := Print[\n  ExportString[payload, "RawJSON", "Compact" -> True]\n];',
    'writeResponse[payload_Association] := ($mathCalcJson = ExportString[payload, "RawJSON", "Compact" -> True]; $mathCalcJson);',
  );
  script = script.replace(
    `fail[message_String, code_Integer : 2] := (
  writeResponse[<|
    "status" -> "error",
    "result" -> "",
    "steps" -> {},
    "error" -> message
  |>];
  Exit[code]
);`,
    `fail[message_String, code_Integer : 2] := (
  writeResponse[<|
    "status" -> "error",
    "result" -> "",
    "steps" -> {},
    "error" -> message
  |>];
  Throw[$mathCalcJson, "mathCalcDone"]
);`,
  );
  script = script.replace('writeResponse[response];\nExit[0];', 'writeResponse[response]');
  script = script.replace(
    'rawInput = Last[$ScriptCommandLine];',
    'rawInput = mathCalcPayload;',
  );

  if (!script.includes('rawInput = mathCalcPayload;')) {
    throw new WolframCloudMcpError('公式计算脚本缺少可注入的输入入口');
  }

  const codes = Buffer.from(payloadJson, 'utf8').join(',');
  return `$mathCalcJson = "";
Catch[
  mathCalcPayload = FromCharacterCode[{${codes}}, "UTF8"];
${script}
  ,
  "mathCalcDone"
]`;
}

export async function probeWolframCloudMcp(timeoutMs = 30_000): Promise<void> {
  const output = await evaluateWolframLanguage('1+1', {
    timeoutMs,
    timeConstraintSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
  });
  const unwrapped = unwrapWolframEvaluatorText(output).replace(/\s+/g, '');
  if (!unwrapped.includes('2')) {
    throw new WolframCloudMcpError('Wolfram Cloud MCP 探测失败');
  }
}
