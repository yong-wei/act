import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const local = fs.readFileSync(path.join(root, 'scripts/runtime-release/execute-production-runtime-cutover.sh'), 'utf8');
const remote = fs.readFileSync(path.join(root, 'scripts/runtime-release/perform-production-runtime-cutover.sh'), 'utf8');

assert.match(local, /git fetch origin integration/, 'cutover must resolve the live integration revision');
assert.match(local, /git merge-base --is-ancestor/, 'cutover must build only an integration-aligned checkout');
assert.match(local, /verify-image --sidecar/, 'cutover must verify image-tar provenance before transfer');
assert.match(local, /published-media closure is not ready/, 'cutover must reject an incomplete published-media closure');
assert.match(local, /staged filename is invalid/, 'cutover must reject unsafe staging filenames');
assert.match(local, /chmod 0644 '\$stage_dir\/act-runtime-ossfs@\.service' '\$stage_dir\/container-start-wrapper\.sh'/, 'container startup wrapper must be readable in the replacement container');
assert.doesNotMatch(local, /remote-deploy\.sh/, 'cutover must not use the database-mutating remote deploy flow');
assert.match(remote, /act-runtime-oss-read/, 'remote cutover must require the read-only RAM role');
assert.match(remote, /podman load -i/, 'remote cutover may load only the verified local image tar');
assert.match(remote, /ACT_RUNTIME_DEPLOY_MODE='--runtime-cutover-app-only'/, 'remote cutover must use the fixed zero-database callback');
assert.match(remote, /ACT_RUNTIME_APP_REVISION/, 'active receipt must bind integration revision');
assert.match(remote, /ACT_RUNTIME_IMAGE_DIGEST/, 'active receipt must bind image digest');
assert.match(remote, /ACT_RUNTIME_RELEASE_LOCATOR_SHA256/, 'active receipt must bind release locator');
assert.doesNotMatch(remote, /remote-deploy\.sh|--all|--db-only|seed|migrat/i, 'remote cutover must not invoke database deployment operations');

console.log('runtime production cutover contract passed');
