/**
 * Anchored resource binding release CLI.
 *
 *   tsx tools/resource-bindings/cli.ts check              build in memory, print gate + audit summary
 *   tsx tools/resource-bindings/cli.ts write [--revision N] [--activate]
 *                                                          stage releases/<id>/ (immutable); --activate moves current.json
 *   tsx tools/resource-bindings/cli.ts qualify [id]       verify a staged release (hashes, gate, pointer)
 *
 * Never publishes to OSS or touches production selectors.
 */

import {
  authorityRevisionLabel,
  buildResourceBindingRelease,
  loadCurrentResourceBindingRelease,
  loadResourceBindingRelease,
  loadResourceBindingSources,
  nextBindingRevision,
  readResourceBindingCurrentPointer,
  resourceBindingRuntimeDir,
  writeResourceBindingCurrentPointer,
  writeResourceBindingRelease,
  type BuiltResourceBindingRelease,
} from '@/lib/resource-binding-release';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const args = process.argv.slice(3);

function flag(name: string): boolean {
  return args.includes(name);
}

function option(name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function summarize(built: BuiltResourceBindingRelease): void {
  const { manifest, gate, audit } = built;
  process.stdout.write(`release      ${manifest.bindingReleaseId}\n`);
  process.stdout.write(`hash         ${manifest.bindingHash}\n`);
  process.stdout.write(`authority    ${manifest.authorityReleaseId} / ${manifest.authoritySnapshotId}\n`);
  process.stdout.write(`runtime      ${manifest.activeRuntimeReleaseId ?? '(no active media index)'}\n`);
  process.stdout.write(`carry-fwd    ${manifest.carryForwardProjectionId}\n`);
  process.stdout.write(`resources    ${manifest.resourceCount}   bindings ${manifest.bindingCount}   canonical ${manifest.canonicalCount}   units ${manifest.unitCount}\n`);
  process.stdout.write(`appearance   ${JSON.stringify(manifest.appearanceCounts)}\n`);
  process.stdout.write(`anchors      ${JSON.stringify(manifest.anchorKindCounts)}\n`);
  process.stdout.write(`roles        ${JSON.stringify(audit.roleCounts)}\n`);
  process.stdout.write(`provenance   ${JSON.stringify(audit.provenanceCounts)}\n`);
  process.stdout.write(`per-node     ${JSON.stringify(audit.perNodeBindingCount)}\n`);
  process.stdout.write(`baseline     ${JSON.stringify(audit.baseline)}\n`);
  process.stdout.write(`gate         ${gate.status}\n`);
  const bySeverity = { error: 0, warning: 0, info: 0 };
  for (const finding of gate.findings) bySeverity[finding.severity] += 1;
  process.stdout.write(`findings     ${JSON.stringify(bySeverity)}\n`);
  for (const finding of gate.findings.filter((f) => f.severity === 'error').slice(0, 30)) {
    process.stdout.write(`  ERROR ${finding.code} ${finding.resourceId ?? finding.bindingId ?? ''} ${finding.message}\n`);
  }
  for (const finding of gate.findings.filter((f) => f.severity === 'warning').slice(0, 30)) {
    process.stdout.write(`  WARN  ${finding.code} ${finding.resourceId ?? ''}\n`);
  }
  process.stdout.write(`no-anchor    ${gate.noAnchorResourceIds.length}   unmapped-course-nodes ${gate.unmappedCourseNodes.length}   drifted-media ${gate.driftedMediaIds.length}\n`);
}

function build(): BuiltResourceBindingRelease {
  const sources = loadResourceBindingSources(cwd);
  const label = authorityRevisionLabel(sources.authority.releaseId, sources.authority.releaseSetId);
  const explicit = option('--revision');
  const revision = explicit ? Number(explicit) : nextBindingRevision(resourceBindingRuntimeDir(cwd), label);
  return buildResourceBindingRelease(sources, { bindingRevision: revision });
}

switch (command) {
  case 'check': {
    const built = build();
    summarize(built);
    process.exitCode = built.gate.passed ? 0 : 1;
    break;
  }
  case 'write': {
    const built = build();
    summarize(built);
    if (!built.gate.passed) {
      process.stderr.write('gate failed; release not written\n');
      process.exitCode = 1;
      break;
    }
    const dir = writeResourceBindingRelease(cwd, built);
    process.stdout.write(`staged       ${dir}\n`);
    if (flag('--activate')) {
      const pointer = writeResourceBindingCurrentPointer(cwd, built.manifest);
      process.stdout.write(`current      ${pointer.bindingReleaseId} (${pointer.activatedAt})\n`);
    }
    break;
  }
  case 'qualify': {
    const id = args[0] && !args[0].startsWith('--') ? args[0] : readResourceBindingCurrentPointer(cwd)?.bindingReleaseId;
    if (!id) {
      process.stderr.write('no release id given and no current pointer\n');
      process.exitCode = 2;
      break;
    }
    const loaded = loadResourceBindingRelease(cwd, id);
    const current = loadCurrentResourceBindingRelease(cwd);
    process.stdout.write(`release      ${loaded.manifest.bindingReleaseId} gate=${loaded.gate.status} bindings=${loaded.bindings.length}\n`);
    process.stdout.write(`current      ${current?.manifest.bindingReleaseId ?? '(none)'}\n`);
    process.exitCode = loaded.gate.passed ? 0 : 1;
    break;
  }
  default:
    process.stderr.write(`unknown command ${command}\n`);
    process.exitCode = 2;
}
