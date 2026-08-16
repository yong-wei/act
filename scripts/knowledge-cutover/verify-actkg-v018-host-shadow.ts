#!/usr/bin/env tsx

/**
 * Collect production v0.9 + staged v0.18 host-shadow evidence for #1411.
 * Does not write any current selector.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  evaluateV018HostShadow,
  type HostShadowObservation,
} from '../../src/lib/teaching-projection/publish/v018-host-shadow';
import { asRecord, writeCanonical } from '../../src/lib/teaching-projection/qualify/v018-shared';

const DEFAULT_PUBLIC_URL = 'https://act.adapt-learn.online';
const DEFAULT_SSH = 'root@121.40.124.135';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function ssh(target: string, script: string): string {
  return execFileSync('ssh', [target, script], { encoding: 'utf8' }).trim();
}

function readActiveGraphFromContainer(sshTarget: string): {
  releaseId?: string;
  snapshotId?: string;
} {
  const raw = ssh(
    sshTarget,
    "podman exec act-obe-app ./node_modules/.bin/tsx -e 'import { resolveAuthorityStorePaths } from \"./src/lib/authoritative-knowledge/authority-store.ts\"; import { resolveActiveEngineeringGraphAuthority } from \"./src/lib/authoritative-knowledge/engineering-authority-consumers.ts\"; const resolved = resolveActiveEngineeringGraphAuthority(resolveAuthorityStorePaths(process.env.ACT_AUTHORITY_STORE_ROOT || \"/app/course-content/authoring/knowledge/authority\")); console.log(JSON.stringify({ status: resolved.status, releaseId: resolved.releaseId ?? null, snapshotId: resolved.snapshotId ?? null }));'",
  );
  const parsed = asRecord(JSON.parse(raw));
  if (parsed.status !== 'ready') return {};
  return {
    releaseId: typeof parsed.releaseId === 'string' ? parsed.releaseId : undefined,
    snapshotId: typeof parsed.snapshotId === 'string' ? parsed.snapshotId : undefined,
  };
}

export async function verifyActKgV018HostShadow(argv: readonly string[] = process.argv.slice(2)): Promise<{
  status: 'READY' | 'BLOCKED';
  blockers: string[];
  reportPath: string;
}> {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const sshTarget = option(argv, '--ssh-target') ?? DEFAULT_SSH;
  const publicUrl = option(argv, '--public-url') ?? DEFAULT_PUBLIC_URL;
  const outputPath = option(argv, '--output') ?? path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18/host-shadow-verification.json',
  );
  const remote = JSON.parse(ssh(sshTarget, [
    'python3 - <<\'PY\'',
    'import hashlib, json, os, subprocess',
    'from pathlib import Path',
    'def sha(p):',
    '    path = Path(p)',
    '    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None',
    'def load(p):',
    '    path = Path(p)',
    '    return json.loads(path.read_text()) if path.exists() else {}',
    'def inspect(name, fmt):',
    '    return subprocess.check_output(["podman","inspect",name,"--format",fmt], universal_newlines=True).strip()',
    'def cexec(path):',
    '    data = subprocess.check_output(["podman","exec","act-obe-app","cat",path])',
    '    return {"sha256": hashlib.sha256(data).hexdigest(), "obj": json.loads(data)}',
    'auth = load("/home/projects/act/course-content/authoring/knowledge/authority/current.json")',
    'projection = cexec("/app/course-content/runtime/knowledge/projection/current.json")',
    'prerequisite = cexec("/app/course-content/runtime/knowledge/prerequisites/current.json")',
    'activation = cexec("/app/course-content/runtime/knowledge/consumer-activation/current.json")',
    'print(json.dumps({',
    '  "appImage": inspect("act-obe-app", "{{.ImageName}}"),',
    '  "workerImage": inspect("act-obe-worker", "{{.ImageName}}"),',
    '  "workerHealth": inspect("act-obe-worker", "{{.State.Health.Status}}"),',
    '  "authorityReleaseId": auth.get("releaseId"),',
    '  "authoritySnapshotId": auth.get("snapshotId"),',
    '  "projectionId": projection["obj"].get("projectionId"),',
    '  "projectionSha256": projection["sha256"],',
    '  "prerequisitePublicationId": prerequisite["obj"].get("publicationId"),',
    '  "prerequisiteSha256": prerequisite["sha256"],',
    '  "activationId": activation["obj"].get("activationId"),',
    '  "activationSha256": activation["sha256"],',
    '  "shardCurrentPresent": subprocess.call(["podman","exec","act-obe-app","test","-e","/app/course-content/runtime/knowledge/authority-domain-shards/current.json"]) == 0,',
    '  "stagedAuthorityReceiptSha256": sha("/home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/authority/candidate-receipt.json"),',
    '  "stagedQualificationSha256": sha("/home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/qualification/qualification-readiness.json"),',
    '}))',
    'PY',
  ].join('\n'))) as HostShadowObservation;
  const readyz = asRecord(JSON.parse(ssh(sshTarget, 'curl -sS -m 15 http://127.0.0.1:8084/api/readyz')));
  const publicReadyz = await fetch(`${publicUrl}/api/readyz`);
  const qualification = asRecord(JSON.parse(readFileSync(path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
  ), 'utf8')));
  const consumers = Array.isArray(qualification.consumerResults)
    ? qualification.consumerResults.map((row) => {
        const rec = asRecord(row);
        return { consumerId: String(rec.consumerId ?? ''), status: String(rec.status ?? '') };
      })
    : [];
  const active = readActiveGraphFromContainer(sshTarget);
  const observation: HostShadowObservation = {
    ...remote,
    readyz: {
      app: readyz.app === true,
      db: readyz.db === true,
      redis: readyz.redis === true,
    },
    publicReadyzStatus: publicReadyz.status,
    activeGraphReleaseId: active.releaseId,
    activeGraphSnapshotId: active.snapshotId,
    consumerStatuses: consumers,
    pointersUnchangedAfterStage: remote.authorityReleaseId === 'ctr:release:control-theory-engineering-v0.9',
  };
  const evaluated = evaluateV018HostShadow(observation);
  const report = {
    contract: 'actkg-v018-host-shadow/v1',
    status: evaluated.status,
    blockers: evaluated.blockers,
    observation,
  };
  writeCanonical(outputPath, report);
  process.stdout.write(`${JSON.stringify({ ...evaluated, reportPath: path.relative(repoRoot, outputPath) }, null, 2)}\n`);
  return { ...evaluated, reportPath: path.relative(repoRoot, outputPath) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  verifyActKgV018HostShadow().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
