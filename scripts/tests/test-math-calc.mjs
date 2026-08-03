import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const script = join(root, 'scripts', 'math-calc', 'calc.py');
const python = process.env.MATH_CALC_PYTHON ?? 'python3';

assert.ok(existsSync(script), `missing calculator script: ${script}`);

function run(expression, operation) {
  const child = spawnSync(
    python,
    [script],
    {
      cwd: root,
      input: JSON.stringify({ expression, operation }),
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
  assert.equal(result.code, 0, `${expression} should exit successfully`);
  assert.equal(result.payload.status, 'ok', JSON.stringify(result.payload));
  assert.ok(Array.isArray(result.payload.steps));
  assert.ok(result.payload.steps.length > 0);
  for (const step of result.payload.steps) {
    assert.deepEqual(Object.keys(step).sort(), ['description', 'input', 'operation', 'output', 'step']);
  }
}

const inverseLaplace = run('\\frac{1}{s+1}', 'inverse_laplace');
assertSuccessful(inverseLaplace, 'LaTeX inverse Laplace');
assert.match(compact(inverseLaplace.payload.result), /e\^{-t\}\\theta\\left\(t\\right\)/);

const exponentialLaplace = run('exp(t)', 'laplace');
assertSuccessful(exponentialLaplace, 'SymPy exp(t) Laplace');
assert.equal(compact(exponentialLaplace.payload.result), '\\frac{1}{s-1}');

const squareRoot = run('sqrt(x)', 'simplify');
assertSuccessful(squareRoot, 'SymPy sqrt(x)');
assert.equal(compact(squareRoot.payload.result), '\\sqrt{x}');

const apart = run('s/(s+1)', 'apart');
assertSuccessful(apart, 'SymPy apart');
assert.equal(compact(apart.payload.result), '1-\\frac{1}{s+1}');

const simplifiedPolynomial = run('s**2 + 2*s + 1', 'simplify');
assertSuccessful(simplifiedPolynomial, 'SymPy polynomial simplify');
assert.match(compact(simplifiedPolynomial.payload.result), /^s\^\{2\}\+2s\+1$/);

const trailingOperator = run('x -', 'simplify');
assert.equal(trailingOperator.code, 2);
assert.equal(trailingOperator.payload.status, 'error');

const illegalCharacters = run('x.__class__', 'simplify');
assert.equal(illegalCharacters.code, 2);
assert.equal(illegalCharacters.payload.status, 'error');
assert.equal(illegalCharacters.payload.error, '表达式包含不允许的字符');

console.log('math-calc real-script regression tests passed');
