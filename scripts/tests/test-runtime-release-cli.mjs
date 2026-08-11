import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/act-runtime-release.ts');
const source = fs.readFileSync(script, 'utf8');

assert.match(source, /\['plan', 'publish', 'verify', 'inspect'\]/, 'CLI must expose plan, publish, verify and inspect commands');
assert.match(source, /roleName: required\('--role-name'\)/, 'CLI must require an ECS RAM role name');
assert.doesNotMatch(source, /ACCESS_KEY|accessKeySecret|--secret|--access-key/i, 'CLI must not accept static AccessKey or Secret input');
assert.match(source, /publishRuntimeRelease/, 'publish must use the immutable release publisher');
assert.match(source, /verifyPublishedRuntimeRelease/, 'verify must revalidate the published release');
assert.match(source, /inspectPublishedRuntimeRelease/, 'inspect must read the published manifest');
assert.match(source, /deriveRuntimeReleaseId/, 'plan and publish must derive the content-addressed release identity');

const result = spawnSync('npx', ['tsx', script, '--help'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /AccessKey or Secret/, 'help must state the credential boundary');

console.log('runtime release CLI contract passed');
