import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const script = join(root, 'scripts', 'math-calc', 'calc.wls');
const wolframscript = process.env.MATH_CALC_WOLFRAMSCRIPT ?? 'wolframscript';

assert.ok(existsSync(script), `missing calculator script: ${script}`);

function run(expression, operation, variable) {
  const child = spawnSync(
    wolframscript,
    ['-file', script, JSON.stringify({ expression, operation, ...(variable ? { variable } : {}) })],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(typeof child.stdout, 'string');
  assert.notEqual(child.stdout.trim(), '', `calculator returned no JSON for ${expression}`);
  return {
    code: child.status,
    payload: JSON.parse(child.stdout),
  };
}

function compact(value) {
  return value.replace(/\s+/g, '');
}

function assertSuccessful(result, expression) {
  assert.equal(
    result.code,
    0,
    `${expression} should exit successfully: ${JSON.stringify(result.payload)}`,
  );
  assert.equal(result.payload.status, 'ok', JSON.stringify(result.payload));
  assert.ok(Array.isArray(result.payload.steps));
  assert.ok(result.payload.steps.length > 0);
  for (const step of result.payload.steps) {
    assert.deepEqual(Object.keys(step).sort(), ['description', 'input', 'operation', 'output', 'step']);
  }
}

function operations(result) {
  return result.payload.steps.map((step) => step.operation);
}

function assertHasVerification(result) {
  assert.ok(
    operations(result).some((operation) => operation.startsWith('verify_')),
    `expected a verification step, got ${JSON.stringify(result.payload.steps)}`,
  );
}

const simplified = run('(x^2-1)/(x-1)', 'simplify', 'x');
assertSuccessful(simplified, 'simplify');
assert.match(compact(simplified.payload.result), /x\+1/);
assertHasVerification(simplified);
assert.ok(operations(simplified).includes('domain_restriction'));

const expanded = run('(x+1)^3', 'expand', 'x');
assertSuccessful(expanded, 'expand');
assertHasVerification(expanded);

const factored = run('x^2-1', 'factor', 'x');
assertSuccessful(factored, 'factor');
assertHasVerification(factored);

const apart = run('(2*s+5)/((s+1)*(s+2))', 'apart', 's');
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
assert.match(compact(substitutedApartStep.output), /3.*s\+1/);
assert.match(compact(substitutedApartStep.output), /1.*s\+2/);

const differentiated = run('(x^2+1)*exp(x)', 'diff', 'x');
assertSuccessful(differentiated, 'differentiate');
assertHasVerification(differentiated);
assert.ok(operations(differentiated).includes('differentiate_factors'));
assert.ok(operations(differentiated).includes('apply_product_rule'));

const integrated = run('x*exp(x^2)', 'integrate', 'x');
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

const laplace = run('t*exp(-2*t)', 'laplace', 't');
assertSuccessful(laplace, 'Laplace');
assertHasVerification(laplace);

const inverseLaplace = run('(s+3)/((s^2+2*s+5)*(s+1))', 'inverse_laplace', 's');
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
assert.match(compact(standardFormStep.output), /u/);
assert.match(compact(standardFormStep.output), /u\^2\+4|u\^2.*4/);
const standardPairStep = inverseLaplace.payload.steps.find(
  (step) => step.operation === 'standard_transform_pair',
);
assert.match(standardPairStep.output, /\\mathcal\{L\}/);
assert.doesNotMatch(standardPairStep.output, /Use linearity/);
assert.match(standardPairStep.output, /\\sin|\\cos/);
assert.doesNotMatch(standardPairStep.output, /\bi\b/);

const malformed = run('x -', 'simplify', 'x');
assert.notEqual(malformed.code, 0);
assert.equal(malformed.payload.status, 'error');

const unsafe = run('Run[1]', 'simplify', 'x');
assert.notEqual(unsafe.code, 0);
assert.equal(unsafe.payload.status, 'error');

console.log('math-calc Wolfram real-script regression tests passed');
