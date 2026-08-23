import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildCalcWlsCloudProgram,
  unwrapWolframEvaluatorText,
} from '@/lib/wolfram-cloud-mcp';

describe('Wolfram Cloud MCP helpers', () => {
  it('unwraps Out[n] JSON strings from WolframLanguageEvaluator', () => {
    const inner = JSON.stringify({ status: 'ok', result: 'x+1' });
    const text = `Out[1]= ${JSON.stringify(inner)}`;
    expect(unwrapWolframEvaluatorText(text)).toBe(inner);
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
});
