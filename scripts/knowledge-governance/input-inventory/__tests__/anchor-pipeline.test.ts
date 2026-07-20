import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { ANCHOR_ARTIFACT_VERSION, extractAuthoritativeAnchorCandidates, makeAnchorReviewArtifact, makeAnchorReviewDecision, verifyAnchorReviewAttestation, verifyAndAdmitAnchors } from '../anchors';
import { canonicalJson } from '../normalize';
import type { Json } from '../types';
import { repositoryRevision } from '../manifest';
import { enumerateRepository, type Registry } from '../registry';

const root = path.resolve(import.meta.dirname, '../../../..');
const authoritativeMarkdownPaths = [
  'course-content/syllabus-refactor/blueprint.md',
  'course-content/syllabus-refactor/main.md',
  'course-content/syllabus-refactor/module-skeletons.md',
  ...[1, 2, 3, 4, 5].map((module) => `course-content/syllabus-refactor/unit-design-details/module${module}.md`),
];

async function syntheticRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'anchor-pipeline-'));
  for (const logicalPath of authoritativeMarkdownPaths) {
    await mkdir(path.join(directory, path.dirname(logicalPath)), { recursive: true });
    const source = logicalPath.endsWith('/blueprint.md')
      ? path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/anchor-selector-synthetic.md')
      : path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/anchor-empty-synthetic.md');
    await cp(source, path.join(directory, logicalPath));
  }
  const git = (...args: string[]) => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 'anchors@example.invalid'); git('config', 'user.name', 'Anchor Test'); git('add', '.'); git('commit', '-qm', 'fixture');
  return directory;
}

describe('authoritative anchor pipeline', () => {
  it('closes extraction and verification over a custom registry when documents are added or removed', async () => {
    const directory = await syntheticRoot();
    const addedPath = 'course-content/syllabus-refactor/unit-design-details/module6-custom.md';
    try {
      await writeFile(path.join(directory, addedPath), '# 模块 5\n\n- 模块 5 拓展：新增 registry 文档。\n');
      spawnSync('git', ['add', '.'], { cwd: directory });
      spawnSync('git', ['commit', '-qm', 'add custom registered anchor source'], { cwd: directory });
      const registry = (paths: string[]): Registry => ({
        schema_version: 'test/v1', registry_id: 'anchor-test', normalization_profile: 'test', algorithm_version: 'test',
        anchor_record_contract: {}, instructional_source_role_matrix: {}, repository_codec_contract: { unknown_codec: 'invalid', codecs: [] },
        repository_sources: [{ id: 'formal-course-basis', item_kind: 'course_objective_source', identity_namespace: 'repository_path', include: paths, exclude: [], missing: 'fail' }],
        database_snapshot: {}, database_sources: [], evidence_deduplication_contract: {}, decoder_common_contract: {}, decoder_contracts: {}, field_decoders: [], closed_namespaces: [],
      });
      const registeredPaths = async (paths: string[]) => {
        const repository = await enumerateRepository(directory, registry(paths), []);
        return repository.sources.find((source) => source.id === 'formal-course-basis')!.physical_paths as string[];
      };
      const withAdded = await registeredPaths([...authoritativeMarkdownPaths, addedPath]);
      const sourceRevision = await repositoryRevision(directory);
      const candidates = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'custom-registry', authoritativeMarkdownPaths: withAdded });
      expect(candidates.candidates.some((candidate) => candidate.source.logical_path === addedPath)).toBe(true);

      const withoutAdded = await registeredPaths(authoritativeMarkdownPaths);
      const review = makeAnchorReviewArtifact('custom-registry-review', []);
      expect(() => verifyAndAdmitAnchors(candidates, review, withoutAdded)).toThrow(/outside the authoritative registry/u);
      const closedCandidates = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'custom-registry', authoritativeMarkdownPaths: withoutAdded });
      expect(closedCandidates.candidates.some((candidate) => candidate.source.logical_path === addedPath)).toBe(false);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('rejects an unknown source revision and ignores dirty authority bytes outside the committed revision', async () => {
    const directory = await syntheticRoot();
    try {
      await expect(extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: 'f'.repeat(40), extractionRun: 'invalid-revision', authoritativeMarkdownPaths })).rejects.toThrow(/revision does not exist/u);
      const sourceRevision = await repositoryRevision(directory);
      const committed = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'revision-owned', authoritativeMarkdownPaths });
      await writeFile(path.join(directory, authoritativeMarkdownPaths[0]!), '# dirty replacement\n');
      const dirty = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'revision-owned', authoritativeMarkdownPaths });
      expect(dirty).toEqual(committed);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('uses only the closed Markdown selectors and derives every identity', async () => {
    const directory = await syntheticRoot();
    try {
      const sourceRevision = await repositoryRevision(directory);
      const artifact = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'extract-1', authoritativeMarkdownPaths });
      expect(artifact.schema_version).toBe(ANCHOR_ARTIFACT_VERSION);
      expect(artifact.candidates.map((item) => item.anchor_type).sort()).toEqual(['explicit_extension', 'explicit_extension', 'formal_objective', 'necessary_prerequisite']);
      expect(artifact.candidates.every((item) => item.course_id.startsWith('sha256:'))).toBe(true);
      expect(artifact.candidates.find((item) => item.anchor_scope === 'module')?.module_id).toMatch(/^sha256:/u);
      expect(artifact.candidates.find((item) => item.anchor_scope === 'lesson')?.lesson_id).toMatch(/^sha256:/u);
      const referencedLesson = artifact.candidates.find((item) => item.source.quote_normalized.includes('覆盖 `3-8`'))!;
      expect(referencedLesson.identity_basis.lesson_number).toBe('2-3');
      expect(artifact.candidates.some((item) => item.source.quote_normalized.includes('连续频率'))).toBe(false);
      expect(canonicalJson(artifact as unknown as Json)).toBe(canonicalJson(await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'extract-1', authoritativeMarkdownPaths }) as unknown as Json));
    } finally { await rm(directory, { recursive: true }); }
  });

  it('never admits pending/rejected candidates and rejects same-run review', async () => {
    const directory = await syntheticRoot();
    try {
      const candidates = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: await repositoryRevision(directory), extractionRun: 'extract-2', authoritativeMarkdownPaths });
      const [accepted, rejected] = candidates.candidates;
      expect(() => makeAnchorReviewDecision(accepted!, { decision: 'ACCEPT', evidence: { provenance: 'p', type: 't', scope: 's', fidelity: 'f' }, reason: 'r', reviewRun: 'extract-2' })).toThrow(/independent/u);
      const acceptedDecision = makeAnchorReviewDecision(accepted!, { decision: 'ACCEPT', evidence: { provenance: 'source digest checked', type: 'selector checked', scope: 'course checked', fidelity: 'quote checked' }, reason: 'independently verified', reviewRun: 'review-2' });
      const rejectedDecision = makeAnchorReviewDecision(rejected!, { decision: 'REJECT', evidence: { provenance: 'source checked', type: 'selector checked', scope: 'scope checked', fidelity: 'quote checked' }, reason: 'synthetic rejection', reviewRun: 'review-2' });
      const admitted = verifyAndAdmitAnchors(candidates, makeAnchorReviewArtifact('review-2', [acceptedDecision, rejectedDecision]), authoritativeMarkdownPaths);
      expect(admitted.admitted).toHaveLength(1);
      expect(admitted.rejected_candidate_digests).toEqual([rejected!.candidate_digest]);
      expect(admitted.pending_candidate_digests).toHaveLength(candidates.candidates.length - 2);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('fails closed on tampering and unknown review candidates', async () => {
    const directory = await syntheticRoot();
    try {
      const candidates = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: await repositoryRevision(directory), extractionRun: 'extract-3', authoritativeMarkdownPaths });
      const decision = makeAnchorReviewDecision(candidates.candidates[0]!, { decision: 'REJECT', evidence: { provenance: 'p', type: 't', scope: 's', fidelity: 'f' }, reason: 'r', reviewRun: 'review-3' });
      const review = makeAnchorReviewArtifact('review-3', [decision]);
      await expect(Promise.resolve().then(() => verifyAndAdmitAnchors({ ...candidates, artifact_digest: 'sha256:bad' }, review, authoritativeMarkdownPaths))).rejects.toThrow(/digest mismatch/u);
      const unknown = makeAnchorReviewDecision({ ...candidates.candidates[0]!, candidate_digest: `sha256:${'f'.repeat(64)}` }, { decision: 'REJECT', evidence: { provenance: 'p', type: 't', scope: 's', fidelity: 'f' }, reason: 'r', reviewRun: 'review-3' });
      await expect(Promise.resolve().then(() => verifyAndAdmitAnchors(candidates, makeAnchorReviewArtifact('review-3', [unknown]), authoritativeMarkdownPaths))).rejects.toThrow(/unknown candidate/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('extracts deterministic candidates from exactly eight real registered Markdown files without admitting them', async () => {
    const before = await Promise.all(authoritativeMarkdownPaths.map((item) => readFile(path.join(root, item))));
    const sourceRevision = await repositoryRevision(root);
    const first = await extractAuthoritativeAnchorCandidates({ root, repositoryRevision: sourceRevision, extractionRun: 'real-extraction', authoritativeMarkdownPaths });
    const second = await extractAuthoritativeAnchorCandidates({ root, repositoryRevision: sourceRevision, extractionRun: 'real-extraction', authoritativeMarkdownPaths });
    expect(authoritativeMarkdownPaths).toHaveLength(8);
    expect(first.candidates.filter((item) => item.anchor_type === 'formal_objective')).toHaveLength(11);
    expect(first.candidates.filter((item) => item.anchor_type === 'necessary_prerequisite')).toHaveLength(1);
    expect(first.candidates.length).toBeGreaterThan(12);
    const byLocator = new Map(first.candidates.map((item) => [`${item.source.logical_path}:${item.source.row_locator}`, item]));
    expect(byLocator.get('course-content/syllabus-refactor/blueprint.md:line:408;selector:explicit-extension')?.identity_basis.lesson_number).toBe('4-4');
    expect(byLocator.get('course-content/syllabus-refactor/unit-design-details/module2.md:line:572;selector:explicit-extension')?.identity_basis.lesson_number).toBe('2-2');
    expect(byLocator.get('course-content/syllabus-refactor/unit-design-details/module2.md:line:827;selector:explicit-extension')?.identity_basis.lesson_number).toBe('2-3');
    expect(byLocator.get('course-content/syllabus-refactor/unit-design-details/module2.md:line:971;selector:explicit-extension')?.identity_basis.lesson_number).toBe('2-4');
    expect(byLocator.has('course-content/syllabus-refactor/unit-design-details/module2.md:line:793;selector:explicit-extension')).toBe(false);
    expect(canonicalJson(first as unknown as Json)).toBe(canonicalJson(second as unknown as Json));
    expect(await Promise.all(authoritativeMarkdownPaths.map((item) => readFile(path.join(root, item))))).toEqual(before);
  });

  it('reconstructs the independently reviewed artifacts exactly and rejects a changed accepted set', async () => {
    const verified = await verifyAnchorReviewAttestation(root, 'scripts/knowledge-governance/input-inventory/fixtures/anchor-review-attestation.json', authoritativeMarkdownPaths);
    expect(verified.candidates.artifact_digest).toBe('sha256:523ce88e050b4eb7de9af279b290bed503caf51363cf617e0e754cb7ee757e85');
    expect(verified.review.artifact_digest).toBe('sha256:de57075b69ccc3634041eb1058ef42ad784c77dcbe6cd3bc4c75c0e6af0c58e6');
    expect(verified.admitted.artifact_digest).toBe('sha256:592773c45df8b24e6e97d0ba3a2f660ca2a8715a6c55c3347809ab4fea05610e');
    expect(verified.admitted.admitted).toHaveLength(32);
    await expect(verifyAnchorReviewAttestation(root, 'scripts/knowledge-governance/input-inventory/fixtures/anchor-review-attestation.json', authoritativeMarkdownPaths, await repositoryRevision(root))).rejects.toThrow(/does not match current repository revision/u);
    const directory = await mkdtemp(path.join(os.tmpdir(), 'anchor-attestation-'));
    try {
      const cloneRoot = path.join(directory, 'repo');
      const cloned = spawnSync('git', ['clone', '-q', '--no-checkout', root, cloneRoot], { encoding: 'utf8' });
      if (cloned.status !== 0) throw new Error(cloned.stderr);
      const attestation = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/anchor-review-attestation.json'), 'utf8')) as { accepted_candidate_digests: string[] };
      attestation.accepted_candidate_digests.pop();
      await writeFile(path.join(cloneRoot, 'changed.json'), JSON.stringify(attestation));
      await expect(verifyAnchorReviewAttestation(cloneRoot, 'changed.json', authoritativeMarkdownPaths)).rejects.toThrow(/decision coverage/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('reconstructs a complete manifest with both accepted and rejected candidate decisions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'anchor-attestation-reject-'));
    try {
      for (const logicalPath of authoritativeMarkdownPaths) {
        await mkdir(path.join(directory, path.dirname(logicalPath)), { recursive: true });
        await cp(path.join(root, logicalPath), path.join(directory, logicalPath));
      }
      const git = (...args: string[]) => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      git('init', '-q'); git('config', 'user.email', 'anchors@example.invalid'); git('config', 'user.name', 'Anchor Test'); git('add', '.'); git('commit', '-qm', 'fixture');
      const sourceRevision = await repositoryRevision(directory);
      const candidates = await extractAuthoritativeAnchorCandidates({ root: directory, repositoryRevision: sourceRevision, extractionRun: 'extract-reject', authoritativeMarkdownPaths });
      const evidence = { provenance: 'checked', type: 'checked', scope: 'checked', fidelity: 'checked' };
      const decisions = candidates.candidates.map((candidate, index) => makeAnchorReviewDecision(candidate, { decision: index === 0 ? 'REJECT' : 'ACCEPT', evidence, reason: 'reviewed independently', reviewRun: 'review-reject' }));
      const review = makeAnchorReviewArtifact('review-reject', decisions);
      const admitted = verifyAndAdmitAnchors(candidates, review, authoritativeMarkdownPaths);
      const rejected = [candidates.candidates[0]!.candidate_digest];
      const accepted = candidates.candidates.slice(1).map((candidate) => candidate.candidate_digest);
      await writeFile(path.join(directory, 'attestation.json'), JSON.stringify({
        schema_version: 'course-scope-anchor-review-attestation/v1', source_revision: sourceRevision,
        extraction_run: 'extract-reject', review_run: 'review-reject', candidate_artifact_digest: candidates.artifact_digest,
        review_artifact_digest: review.artifact_digest, admitted_artifact_digest: admitted.artifact_digest,
        accepted_candidate_digests: accepted, rejected_candidate_digests: rejected, evidence, reason: 'reviewed independently',
      }));
      const verified = await verifyAnchorReviewAttestation(directory, 'attestation.json', authoritativeMarkdownPaths, sourceRevision);
      expect(verified.admitted.rejected_candidate_digests).toEqual(rejected);
      expect(verified.admitted.pending_candidate_digests).toEqual([]);
    } finally { await rm(directory, { recursive: true }); }
  });
});
