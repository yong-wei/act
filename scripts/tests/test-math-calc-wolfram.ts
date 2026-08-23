import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { runMathCalculate, type MathCalcOperation } from '../../src/lib/math-calc';

const root = process.cwd();
const script = join(root, 'scripts', 'math-calc', 'calc.wls');
assert.ok(existsSync(script), `missing calculator script: ${script}`);

async function run(expression: string, operation: MathCalcOperation, variable?: string) {
  const payload = await runMathCalculate({
    expression,
    operation,
    ...(variable ? { variable } : {}),
  });
  return {
    code: payload.status === 'ok' ? 0 : 2,
    payload,
  };
}

function compact(value: string) {
  return value.replace(/\s+/g, '');
}

function assertSuccessful(
  result: { code: number; payload: Awaited<ReturnType<typeof runMathCalculate>> },
  expression: string,
) {
  assert.equal(
    result.code,
    0,
    `${expression} should succeed: ${JSON.stringify(result.payload)}`,
  );
  assert.equal(result.payload.status, 'ok', JSON.stringify(result.payload));
  assert.ok(Array.isArray(result.payload.steps));
  assert.ok(result.payload.steps.length > 0);
  for (const step of result.payload.steps) {
    assert.deepEqual(Object.keys(step).sort(), ['description', 'input', 'operation', 'output', 'step']);
  }
}

function operations(result: { payload: Awaited<ReturnType<typeof runMathCalculate>> }) {
  return result.payload.steps.map((step) => step.operation);
}

function assertHasVerification(result: { payload: Awaited<ReturnType<typeof runMathCalculate>> }) {
  assert.ok(
    operations(result).some((operation) => operation.startsWith('verify_')),
    `expected a verification step, got ${JSON.stringify(result.payload.steps)}`,
  );
}

async function main() {
  const simplified = await run('(x^2-1)/(x-1)', 'simplify', 'x');
  assertSuccessful(simplified, 'simplify');
  assert.match(compact(simplified.payload.result), /x\+1/);
  assertHasVerification(simplified);
  assert.ok(operations(simplified).includes('domain_restriction'));

  const squareRoot = await run('sqrt(x)', 'simplify', 'x');
  assertSuccessful(squareRoot, 'sqrt');
  assertHasVerification(squareRoot);
  assert.match(compact(squareRoot.payload.result), /\\sqrt\{x\}/);

  const nestedSquareRoot = await run('sqrt((x+1)^2)', 'simplify', 'x');
  assertSuccessful(nestedSquareRoot, 'nested sqrt');
  assertHasVerification(nestedSquareRoot);

  const factorial = await run('factorial(3)', 'simplify', 'x');
  assertSuccessful(factorial, 'factorial');
  assert.match(compact(factorial.payload.result), /6/);

  const unknownFunction = await run('foo(x)', 'simplify', 'x');
  assert.notEqual(unknownFunction.code, 0);
  assert.equal(unknownFunction.payload.status, 'error');

  const expanded = await run('(x+1)^3', 'expand', 'x');
  assertSuccessful(expanded, 'expand');
  assertHasVerification(expanded);

  const factored = await run('x^2-1', 'factor', 'x');
  assertSuccessful(factored, 'factor');
  assertHasVerification(factored);

  const apart = await run('(2*s+5)/((s+1)*(s+2))', 'apart', 's');
  assertSuccessful(apart, 'apart');
  assertHasVerification(apart);
  for (const expectedOperation of [
    'partial_fraction_ansatz',
    'clear_denominators',
    'coefficient_equations',
    'solve_coefficients',
    'substitute_coefficients',
  ]) {
    assert.ok(
      operations(apart).includes(expectedOperation),
      `missing ${expectedOperation}: ${JSON.stringify(apart.payload.steps)}`,
    );
  }
  const substitutedApartStep = apart.payload.steps.find(
    (step) => step.operation === 'substitute_coefficients',
  );
  assert.ok(substitutedApartStep);
  assert.match(compact(substitutedApartStep.output), /3.*s\+1/);
  assert.match(compact(substitutedApartStep.output), /1.*s\+2/);

  const differentiated = await run('(x^2+1)*exp(x)', 'diff', 'x');
  assertSuccessful(differentiated, 'differentiate');
  assertHasVerification(differentiated);
  assert.ok(operations(differentiated).includes('differentiate_factors'));
  assert.ok(operations(differentiated).includes('apply_product_rule'));

  const integrated = await run('x*exp(x^2)', 'integrate', 'x');
  assertSuccessful(integrated, 'integrate');
  assertHasVerification(integrated);
  assert.ok(operations(integrated).includes('integration_constant'));
  for (const expectedOperation of [
    'substitution_choice',
    'substitution_differential',
    'rewrite_integral',
    'back_substitution',
  ]) {
    assert.ok(
      operations(integrated).includes(expectedOperation),
      `missing ${expectedOperation}: ${JSON.stringify(integrated.payload.steps)}`,
    );
  }
  assert.match(compact(integrated.payload.result), /C/);

  const laplace = await run('t*exp(-2*t)', 'laplace', 't');
  assertSuccessful(laplace, 'Laplace');
  assertHasVerification(laplace);

  const inverseLaplace = await run('(s+3)/((s^2+2*s+5)*(s+1))', 'inverse_laplace', 's');
  assertSuccessful(inverseLaplace, 'inverse Laplace');
  assert.match(compact(inverseLaplace.payload.result), /e/);
  assert.ok(inverseLaplace.payload.steps.length >= 10, JSON.stringify(inverseLaplace.payload.steps));
  assert.ok(inverseLaplace.payload.steps.length <= 18, JSON.stringify(inverseLaplace.payload.steps));
  for (const expectedOperation of [
    'factor_denominator',
    'partial_fraction_ansatz',
    'coefficient_equations',
    'solve_coefficients',
    'partial_fraction',
    'standard_form',
    'inverse_laplace_transform',
    'verify_laplace_round_trip',
  ]) {
    assert.ok(
      operations(inverseLaplace).includes(expectedOperation),
      `missing ${expectedOperation}: ${JSON.stringify(inverseLaplace.payload.steps)}`,
    );
  }
  const standardFormStep = inverseLaplace.payload.steps.find(
    (step) => step.operation === 'standard_form',
  );
  assert.ok(standardFormStep);
  assert.match(compact(standardFormStep.output), /u/);
  assert.match(compact(standardFormStep.output), /u\^2\+4|u\^2.*4/);
  const standardPairStep = inverseLaplace.payload.steps.find(
    (step) => step.operation === 'standard_transform_pair',
  );
  assert.ok(standardPairStep);
  assert.match(standardPairStep.output, /\\mathcal\{L\}/);
  assert.doesNotMatch(standardPairStep.output, /Use linearity/);
  assert.match(standardPairStep.output, /\\sin|\\cos/);
  assert.doesNotMatch(standardPairStep.output, /\bi\b/);

  const malformed = await run('x -', 'simplify', 'x');
  assert.notEqual(malformed.code, 0);
  assert.equal(malformed.payload.status, 'error');

  const unsafe = await run('Run[1]', 'simplify', 'x');
  assert.notEqual(unsafe.code, 0);
  assert.equal(unsafe.payload.status, 'error');

  console.log('math-calc Wolfram Cloud MCP regression tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
