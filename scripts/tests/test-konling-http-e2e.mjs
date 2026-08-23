import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = requiredEnv('KONLING_E2E_BASE_URL');
const authCookie = requiredEnv('KONLING_E2E_AUTH_COOKIE');
const question = process.env.KONLING_E2E_QUESTION
  ?? '求 (s+3)/((s^2+2*s+5)*(s+1)) 的拉普拉斯逆变换';
const evidencePath = process.env.KONLING_E2E_EVIDENCE_PATH
  ?? path.join(process.cwd(), 'artifacts', 'konling-math-http-e2e.json');
const timeoutMs = Number(process.env.KONLING_E2E_TIMEOUT_MS ?? 120_000);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function collectStream(response) {
  const reader = response.body?.getReader();
  assert.ok(reader, 'response body must be a readable stream');
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function assembleAssistantText(streamText) {
  const chunks = [];
  for (const block of streamText.split('\n\n')) {
    const line = block.split('\n').find((entry) => entry.startsWith('data: '));
    if (!line) continue;
    const raw = line.slice('data: '.length).trim();
    if (!raw || raw === '[DONE]') continue;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      continue;
    }
    if (payload?.type === 'text-delta' && typeof payload.delta === 'string') {
      chunks.push(payload.delta);
    }
  }
  return chunks.join('');
}

async function main() {
  const startedAt = new Date();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        messages: [{
          id: `e2e-user-${randomUUID()}`,
          role: 'user',
          content: question,
        }],
      }),
      signal: controller.signal,
    });
    assert.equal(response.status, 200, `chat endpoint returned ${response.status}`);
    const streamText = await collectStream(response);
    const assistantText = assembleAssistantText(streamText);
    const elapsedMs = Date.now() - startedAt.getTime();
    const assertions = {
      noCalculateToolCall: !/toolName"\s*:\s*"calculate"|"name"\s*:\s*"calculate"/.test(streamText),
      hasWolframStatement: /结果与关键中间式已由 Wolfram Engine 计算或验证/.test(assistantText),
      hasApproachSection: assistantText.includes('## 解题思路'),
      hasDetailedSection: assistantText.includes('## 详细过程'),
      hasFinalAnswerSection: assistantText.includes('## 最终答案'),
      hasVerificationSection: assistantText.includes('## 验算'),
    };

    const evidence = {
      evidenceVersion: 'konling-math-http-e2e.v1',
      generatedAt: startedAt.toISOString(),
      baseUrl,
      question,
      status: 'passed',
      elapsedMs,
      assertions,
      privacy: {
        containsAuthCookie: false,
        containsUserIdentifiers: false,
      },
      responseSnippet: assistantText.slice(0, 4000),
    };

    try {
      assert.deepEqual(
        Object.values(assertions).filter((value) => value === false),
        [],
        JSON.stringify(assertions),
      );
    } catch (error) {
      evidence.status = 'failed';
      throw error;
    } finally {
      await mkdir(path.dirname(evidencePath), { recursive: true });
      await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }

    console.log('konling math HTTP E2E passed');
    console.log(`evidence: ${evidencePath}`);
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
