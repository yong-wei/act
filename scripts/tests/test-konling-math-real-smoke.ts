import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { runMathCalculate } from '../../src/lib/math-calc';
import {
  buildMathPrecomputeContext,
  precomputeMathAnswer,
} from '../../src/lib/konling-math-precompute';

async function main() {
  const wolframCheck = spawnSync('wolframscript', ['--version'], {
    encoding: 'utf8',
  });
  assert.equal(wolframCheck.status, 0, 'wolframscript 必须可用');

  const apiPath = await runMathCalculate({
    expression: '1',
    operation: 'laplace',
    variable: 't',
  });
  assert.equal(apiPath.status, 'ok', JSON.stringify(apiPath));
  assert.ok(apiPath.steps.length > 0, 'Laplace smoke 必须返回有序步骤');

  const precompute = await precomputeMathAnswer(
    '求 (s+3)/((s^2+2*s+5)*(s+1)) 的拉普拉斯逆变换',
  );
  assert.ok(precompute, '代表性控灵逆拉普拉斯问题必须触发服务端预计算');
  assert.equal(precompute.operation, 'inverse_laplace');

  const context = buildMathPrecomputeContext(precompute);
  assert.match(context, /结果与关键中间式已由 Wolfram Engine 计算或验证/);
  assert.match(context, /第 1 步/);
  assert.doesNotMatch(context, /calculate/);

  console.log('konling math real smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
