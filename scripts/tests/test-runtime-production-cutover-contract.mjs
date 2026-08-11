import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const local = fs.readFileSync(path.join(root, 'scripts/runtime-release/execute-production-runtime-cutover.sh'), 'utf8');
const remote = fs.readFileSync(path.join(root, 'scripts/runtime-release/perform-production-runtime-cutover.sh'), 'utf8');

assert.match(local, /git fetch origin integration/, 'cutover must resolve the live integration revision');
assert.match(local, /local checkout must exactly match origin\/integration/, 'cutover must reject a merely descendant topic branch');
assert.match(local, /head_revision.*integration_revision/, 'cutover must use the exact integration revision for every staged script');
assert.match(local, /release locator must be tracked by integration/, 'cutover must only stage a locator committed to integration');
assert.match(local, /git merge-base --is-ancestor "\$release_source_revision" "\$integration_revision"/, 'runtime release source must be an integration ancestor, not necessarily the image revision');
assert.match(local, /release locator source revision and tree digest do not bind --release-id/, 'cutover must derive the immutable release identity from the locator');
assert.match(local, /closure\.get\('sourceRevision'\) != source_revision/, 'media closure must bind the release source revision');
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
assert.match(remote, /release locator does not bind the immutable runtime release/, 'remote cutover must rederive the immutable release identity');
assert.doesNotMatch(remote, /release\.get\('sourceRevision'\) != revision/, 'runtime source revision must remain independent from the integration image revision');
assert.doesNotMatch(remote, /remote-deploy\.sh|--all|--db-only|seed|migrat/i, 'remote cutover must not invoke database deployment operations');

console.log('runtime production cutover contract passed');
