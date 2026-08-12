import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/execute-production-runtime-cutover.sh');
const temporary = fs.mkdtempSync(path.join(root, 'scripts/tests/.runtime-stream-gzip-capacity-'));
const bin = path.join(temporary, 'bin');
const sourceRevision = 'a'.repeat(40);
const treeSha256 = 'b'.repeat(64);
const integrationRevision = 'd'.repeat(40);
const releaseId = `runtime-${createHash('sha256').update(JSON.stringify({ sourceRevision, treeSha256 })).digest('hex').slice(0, 55)}`;
const imageReference = 'localhost/test:latest';
const layerBytes = 3 * 1024 * 1024;

function executable(name, body) {
  const target = path.join(bin, name);
  fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(target, 0o755);
}

try {
  fs.mkdirSync(bin, { recursive: true });
  const imageTar = path.join(temporary, 'image.tar');
  const config = JSON.stringify({ config: { Labels: { 'org.opencontainers.image.revision': integrationRevision } } });
  const configDigest = createHash('sha256').update(config).digest('hex');
  const configPath = `blobs/sha256/${configDigest}`;
  const layerDigest = 'c'.repeat(64);
  const layerPath = `blobs/sha256/${layerDigest}`;
  execFileSync('python3', ['-c', `
import gzip, io, json, tarfile
archive, config_path, layer_path, config_text, image_reference, layer_bytes = __import__('sys').argv[1:]
payload = gzip.compress(b'x' * int(layer_bytes))
with tarfile.open(archive, 'w') as output:
    for name, content in ((config_path, config_text.encode('utf-8')), (layer_path, payload), ('manifest.json', json.dumps([{'Config': config_path, 'RepoTags': [image_reference], 'Layers': [layer_path]}], separators=(',', ':')).encode('utf-8'))):
        info = tarfile.TarInfo(name)
        info.size = len(content)
        output.addfile(info, io.BytesIO(content))
`, imageTar, configPath, layerPath, config, imageReference, String(layerBytes)]);
  const provenance = `${imageTar}.provenance.json`;
  fs.writeFileSync(provenance, '{}\n');
  const verification = path.join(temporary, 'verification.json');
  const locator = path.join(temporary, 'locator.json');
  const closure = path.join(temporary, 'closure.json');
  fs.writeFileSync(verification, `${JSON.stringify({ releaseId, manifestSha256: 'e'.repeat(64), treeSha256 })}\n`);
  fs.writeFileSync(locator, `${JSON.stringify({ releaseId, sourceRevision, treeSha256, manifestSha256: 'e'.repeat(64) })}\n`);
  fs.writeFileSync(closure, `${JSON.stringify({ releaseId, sourceRevision, treeSha256, manifestSha256: 'e'.repeat(64), ready: true, failures: [] })}\n`);
  const knownHosts = path.join(temporary, 'known_hosts');
  const identity = path.join(temporary, 'identity');
  const sshLog = path.join(temporary, 'ssh.log');
  fs.writeFileSync(knownHosts, 'fixture\n');
  fs.writeFileSync(identity, 'fixture\n');
  executable('git', `
case "$1" in
  fetch|status|ls-files|diff|merge-base) exit 0 ;;
  rev-parse) printf '%s\\n' '${integrationRevision}'; exit 0 ;;
  *) echo "unexpected git invocation: $*" >&2; exit 99 ;;
esac`);
  executable('node', 'exit 0');
  executable('scp', 'exit 0');
  executable('ssh', `printf '%s\\n' "$*" >> ${JSON.stringify(sshLog)}; cat >/dev/null; exit 0`);

  const result = spawnSync('bash', [script,
    '--release-id', releaseId,
    '--verification-receipt', verification,
    '--release-locator', locator,
    '--media-closure', closure,
    '--image-tar', imageTar,
    '--image-reference', imageReference,
    '--image-transfer', 'stream',
    '--ssh-target', 'fixture.invalid',
    '--known-hosts', knownHosts,
    '--identity-file', identity,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr);
  const compressedBytes = fs.statSync(imageTar).size;
  const expectedMinimum = layerBytes + 1024 * 1024 * 1024;
  assert.ok(compressedBytes < layerBytes, 'fixture must prove a gzip layer is materially smaller than its unpacked bytes');
  assert.match(fs.readFileSync(sshLog, 'utf8'), new RegExp(`--minimum-available-bytes '${expectedMinimum}'`), 'stream handoff must use decompressed layer bytes plus the fixed safety margin');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('runtime production cutover gzip-capacity contract passed');
