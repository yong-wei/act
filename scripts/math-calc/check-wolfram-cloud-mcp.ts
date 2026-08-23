import { runMathCalculate } from '../../src/lib/math-calc';
import { probeWolframCloudMcp } from '../../src/lib/wolfram-cloud-mcp';

async function main() {
  await probeWolframCloudMcp();
  const smoke = await runMathCalculate({
    expression: '1',
    operation: 'laplace',
    variable: 't',
  });
  if (smoke.status !== 'ok' || smoke.steps.length < 1) {
    console.error('[wolfram-ready] ERROR: Wolfram Cloud MCP 无法执行 calc.wls smoke。');
    process.exit(1);
  }
  console.log('[wolfram-ready] Wolfram Cloud MCP 公式计算运行时可用。');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '公式计算运行时不可用';
  console.error(`[wolfram-ready] ERROR: ${message}`);
  process.exit(1);
});
