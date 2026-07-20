import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { canonicalJson, compareCodePoints, taggedDigest } from '../../input-inventory/normalize';
import { makeAnchor } from '../../input-inventory/records';
import { buildIdentityCandidateManifest } from '../manifest';
import type { IdentityCandidateInput, InventoryManifest, Json } from '../types';

const fixturePath = path.join(import.meta.dirname, '..', 'fixtures', 'synthetic-cases.json');
const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const syntheticConcepts = [
  { source_concept_id: 'concept-a', identity_namespace: 'runtime-node', normalized_name: '稳定性', source_locator: 'runtime:a' },
  { source_concept_id: 'concept-b', identity_namespace: 'legacy-node', normalized_name: '稳定性', source_locator: 'legacy:b' },
  { source_concept_id: 'concept-c', identity_namespace: 'resource-concept', normalized_name: '系统稳定', source_locator: 'resource:c' },
  { source_concept_id: 'concept-d', identity_namespace: 'runtime-node', normalized_name: '稳定边界', source_locator: 'runtime:d' },
];

function syntheticAuthoritativeSet() {
  const records = syntheticConcepts.map((concept) => {
    const body = { concept_key: `${concept.identity_namespace}:${concept.source_concept_id}`, ...concept };
    return { ...body, record_digest: taggedDigest('knowledge-identity-candidate-record/v1', canonicalJson(body as unknown as Json)) };
  }).sort((a, b) => compareCodePoints(a.concept_key, b.concept_key));
  return { records, count: records.length, set_digest: taggedDigest('knowledge-identity-candidate-record-set/v1', canonicalJson(records as unknown as Json)) };
}

function readyInventory(): InventoryManifest {
  const anchor = makeAnchor({
    anchor_scope: 'lesson', anchor_type: 'formal_objective', course_id: 'course-1', module_id: 'module-1', lesson_id: 'lesson-1', source_locator: 'fixture.md#line:1', text_digest: digest('e'),
  });
  const base = {
    schema_version: 'course-knowledge-input-inventory/v1',
    normalization_profile: 'utf8-nfc-lf-codepoint-order/v1',
    source_digests: [{ source_id: 'synthetic', source_locator: 'fixture.json', item_kind: 'concept', identity_namespace: 'synthetic-concept', schema_version: 'synthetic/v1', digest: digest('b'), item_count: 4 }],
    database_source_digests: [],
    governance_contract_digest: digest('c'),
    source_snapshot_digest: digest('d'),
    readiness: true,
    anchors: { records: [anchor] },
    identity_candidate_records: syntheticAuthoritativeSet(),
    snapshot_digest: '',
  };
  return {
    ...base,
    snapshot_digest: taggedDigest('course-knowledge-input-inventory/v1', canonicalJson({ ...base, snapshot_digest: null } as unknown as Json)),
  };
}

function rehashInventory(inventory: InventoryManifest): InventoryManifest {
  return {
    ...inventory,
    snapshot_digest: taggedDigest('course-knowledge-input-inventory/v1', canonicalJson({ ...inventory, snapshot_digest: null } as unknown as Json)),
  };
}

async function fixture(inventory: InventoryManifest): Promise<IdentityCandidateInput> {
  const value = JSON.parse(await readFile(fixturePath, 'utf8')) as IdentityCandidateInput;
  value.expected_inventory_digest = inventory.snapshot_digest;
  value.anchor_bindings = [{ source_concept_id: 'concept-a', anchor_id: inventory.anchors.records[0]!.anchor_id }];
  return value;
}

function build(inventory: InventoryManifest, input: IdentityCandidateInput): Record<string, Json> {
  return buildIdentityCandidateManifest({ inventory, input, inventoryFileDigest: digest('9') });
}

function reverseInput(input: IdentityCandidateInput): IdentityCandidateInput {
  return {
    ...input,
    concepts: [...input.concepts].reverse(),
    reviewed_aliases: [...input.reviewed_aliases].reverse().map((item) => ({ ...item, left: item.right, right: item.left })),
    near_similar: [...input.near_similar].reverse().map((item) => ({ ...item, left: item.right, right: item.left })),
    pending_splits: [...input.pending_splits].reverse().map((item) => ({ ...item, alternatives: [...item.alternatives].reverse().map((alternative) => ({ ...alternative, proposed_member_ids: [...alternative.proposed_member_ids].reverse() })) })),
    history_ambiguities: [...input.history_ambiguities].reverse().map((item) => ({ ...item, candidate_alternative_ids: [...item.candidate_alternative_ids].reverse() })),
    anchor_bindings: [...input.anchor_bindings].reverse(),
  };
}

async function fileState(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory)) {
      const absolute = path.join(directory, entry);
      const metadata = await stat(absolute);
      if (metadata.isDirectory()) await walk(absolute);
      else result[path.relative(root, absolute)] = taggedDigest('no-write-fixture/v1', await readFile(absolute));
    }
  }
  await walk(root);
  return result;
}

describe('identity candidate manifest', () => {
  it('forms one globally closed exact/ACCEPT-alias component with stable identity and no owner', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    const manifest = build(inventory, input);
    expect(manifest.readiness).toBe(true);
    const current = manifest.current as { components: Array<Record<string, unknown>>; near_similar_review_edges: Array<Record<string, unknown>> };
    expect(current.components).toHaveLength(2);
    const closed = current.components.find((component) => (component.members as string[]).includes('concept-a'))!;
    expect(closed.members).toEqual(['concept-a', 'concept-b', 'concept-c']);
    expect(closed.indivisible).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('owner_block');
    expect(closed.pending_splits).toHaveLength(1);
    expect(closed.history_ambiguities).toHaveLength(1);
    expect(closed.scope_anchor_evidence).toEqual({ status: 'resolved', anchor_ids: [inventory.anchors.records[0]!.anchor_id] });
    const missing = current.components.find((component) => (component.members as string[]).includes('concept-d'))!;
    expect(missing.scope_anchor_evidence).toEqual({ status: 'missing', finding: 'SCOPE_ANCHOR_EVIDENCE_MISSING' });
    expect(current.near_similar_review_edges).toHaveLength(1);
    expect(current.near_similar_review_edges[0]!.left_component_id).not.toBe(current.near_similar_review_edges[0]!.right_component_id);
  });

  it('is input-order independent and byte-identical across repeated runs', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    const first = canonicalJson(build(inventory, input) as Json);
    const repeated = canonicalJson(build(inventory, input) as Json);
    const reordered = canonicalJson(build(inventory, reverseInput(input)) as Json);
    expect(repeated).toBe(first);
    expect(reordered).toBe(first);
  });

  it('keeps component IDs stable when unrelated upstream snapshot evidence changes', async () => {
    const firstInventory = readyInventory();
    const firstInput = await fixture(firstInventory);
    const first = build(firstInventory, firstInput).current as { components: Array<{ component_id: string; members: string[] }> };
    const secondInventory = rehashInventory({
      ...firstInventory,
      source_snapshot_digest: digest('f'),
      source_digests: [{ ...firstInventory.source_digests[0] as Record<string, Json>, digest: digest('7') }],
    });
    const secondInput = await fixture(secondInventory);
    const second = build(secondInventory, secondInput).current as { components: Array<{ component_id: string; members: string[] }> };
    const ids = (value: typeof first): Record<string, string> => Object.fromEntries(value.components.map((component) => [component.members.join(','), component.component_id]));
    expect(firstInventory.snapshot_digest).not.toBe(secondInventory.snapshot_digest);
    expect(ids(second)).toEqual(ids(first));
  });

  it('fails closed before serializing current components when upstream is not ready or digest-bound', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    const notReady = build({ ...inventory, readiness: false }, input);
    expect(notReady.readiness).toBe(false);
    expect(notReady.current).toBeNull();
    const mismatched = build(inventory, { ...input, expected_inventory_digest: digest('0') });
    expect(mismatched.readiness).toBe(false);
    expect(mismatched.current).toBeNull();
  });

  it('requires an upstream authoritative set and exact input concept closure', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    const assertBlocked = (candidateInventory: InventoryManifest, candidateInput: IdentityCandidateInput, code: string): void => {
      const manifest = build(candidateInventory, candidateInput);
      expect(manifest.readiness).toBe(false);
      expect(manifest.current).toBeNull();
      expect(manifest.drift).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    };
    const withoutSet = rehashInventory({ ...inventory, identity_candidate_records: undefined });
    assertBlocked(withoutSet, { ...input, expected_inventory_digest: withoutSet.snapshot_digest }, 'AUTHORITATIVE_IDENTITY_CANDIDATE_SET_MISSING');

    const malformedSet = structuredClone(inventory.identity_candidate_records!);
    malformedSet.records[0]!.record_digest = digest('0');
    const malformedInventory = rehashInventory({ ...inventory, identity_candidate_records: malformedSet });
    assertBlocked(malformedInventory, { ...input, expected_inventory_digest: malformedInventory.snapshot_digest }, 'AUTHORITATIVE_IDENTITY_CANDIDATE_RECORD_INVALID');

    const wrongCountSet = { ...inventory.identity_candidate_records!, count: inventory.identity_candidate_records!.count - 1 };
    const wrongCountInventory = rehashInventory({ ...inventory, identity_candidate_records: wrongCountSet });
    assertBlocked(wrongCountInventory, { ...input, expected_inventory_digest: wrongCountInventory.snapshot_digest }, 'AUTHORITATIVE_IDENTITY_CANDIDATE_COUNT_MISMATCH');
    const wrongDigestSet = { ...inventory.identity_candidate_records!, set_digest: digest('0') };
    const wrongDigestInventory = rehashInventory({ ...inventory, identity_candidate_records: wrongDigestSet });
    assertBlocked(wrongDigestInventory, { ...input, expected_inventory_digest: wrongDigestInventory.snapshot_digest }, 'AUTHORITATIVE_IDENTITY_CANDIDATE_SET_DIGEST_MISMATCH');

    const cases: IdentityCandidateInput[] = [
      { ...input, concepts: [] },
      { ...input, concepts: input.concepts.slice(1) },
      { ...input, concepts: [...input.concepts, { source_concept_id: 'extra', identity_namespace: 'runtime-node', normalized_name: '额外', source_locator: 'runtime:extra' }] },
      { ...input, concepts: input.concepts.map((concept, index) => index === 0 ? { ...concept, normalized_name: '更名' } : concept) },
      { ...input, concepts: input.concepts.map((concept, index) => index === 0 ? { ...concept, identity_namespace: 'other' } : concept) },
      { ...input, concepts: input.concepts.map((concept, index) => index === 0 ? { ...concept, source_locator: 'runtime:changed' } : concept) },
    ];
    for (const candidate of cases) assertBlocked(inventory, candidate, 'IDENTITY_INPUT_NOT_EXHAUSTIVE');
    expect(build(inventory, { ...input, expected: { concept_count: 0, reviewed_alias_count: 0, near_similar_count: 0 } }).readiness).toBe(true);
  });

  it('rejects near-similar merges, external pending splits, and invalid anchor evidence', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    expect(() => build(inventory, { ...input, near_similar: [{ ...input.near_similar[0]!, right: 'concept-a' }] })).toThrow('distinct components');
    expect(() => build(inventory, { ...input, pending_splits: [{ ...input.pending_splits[0]!, alternatives: [{ alternative_id: 'outside', proposed_member_ids: ['concept-d'] }] }], history_ambiguities: [] })).toThrow('internal');
    const assertBadAnchor = (anchor: Record<string, unknown>, message: string): void => {
      const badInventory = rehashInventory({ ...inventory, anchors: { records: [anchor as never] } });
      const rebound = { ...input, expected_inventory_digest: badInventory.snapshot_digest, anchor_bindings: [] };
      expect(() => build(badInventory, rebound)).toThrow(message);
    };
    assertBadAnchor({ ...inventory.anchors.records[0]!, anchor_scope: 'unknown' }, 'unknown anchor_scope');
    assertBadAnchor({ ...inventory.anchors.records[0]!, anchor_type: 'unknown' }, 'unknown anchor_type');
    assertBadAnchor({ ...inventory.anchors.records[0]!, anchor_id: digest('a') }, 'anchor_id does not match');
  });

  it('schema rejects open evidence shapes and inconsistent readiness/current states', async () => {
    const inventory = readyInventory();
    const input = await fixture(inventory);
    const valid = build(inventory, input);
    const schema = JSON.parse(await readFile(path.join(import.meta.dirname, '..', 'manifest.schema.json'), 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);

    const mutations: Array<(value: Record<string, any>) => void> = [
      (value) => { value.source_digests[0].unexpected = true; },
      (value) => { value.upstream_manifest_digests[0].unexpected = true; },
      (value) => { value.current.components[0].exact_name_evidence[0].unexpected = true; },
      (value) => { value.current.components.find((component: { pending_splits: unknown[] }) => component.pending_splits.length > 0).pending_splits[0].unexpected = true; },
      (value) => { value.current.components.find((component: { history_ambiguities: unknown[] }) => component.history_ambiguities.length > 0).history_ambiguities[0].unexpected = true; },
      (value) => { value.current.components.find((component: { reviewed_alias_evidence: unknown[] }) => component.reviewed_alias_evidence.length > 0).reviewed_alias_evidence[0].unexpected = true; },
      (value) => { value.current = null; },
      (value) => { value.drift = [{ code: 'UNEXPECTED', scope: 'fixture' }]; },
      (value) => { value.readiness = false; },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(valid) as Record<string, any>;
      mutate(candidate);
      expect(validate(candidate), JSON.stringify(validate.errors)).toBe(false);
    }

    const blocked = build({ ...inventory, readiness: false }, input);
    expect(validate(blocked), JSON.stringify(validate.errors)).toBe(true);
    const blockedWithOpenDrift = structuredClone(blocked) as Record<string, any>;
    blockedWithOpenDrift.drift[0].unexpected = true;
    expect(validate(blockedWithOpenDrift), JSON.stringify(validate.errors)).toBe(false);
    const falseWithCurrent = structuredClone(blocked) as Record<string, any>;
    falseWithCurrent.current = valid.current;
    expect(validate(falseWithCurrent), JSON.stringify(validate.errors)).toBe(false);
  });

  it('CLI is read-only over all governed fixture files', async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'identity-candidate-no-write-'));
    const inventory = readyInventory();
    const input = await fixture(inventory);
    await writeFile(path.join(temporary, 'inventory.json'), canonicalJson(inventory as unknown as Json));
    await writeFile(path.join(temporary, 'input.json'), canonicalJson(input as unknown as Json));
    const before = await fileState(temporary);
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(import.meta.dirname, '..', 'cli.ts'), '--inventory', path.join(temporary, 'inventory.json'), '--input', path.join(temporary, 'input.json')], { cwd: process.cwd(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).readiness).toBe(true);
    expect(await fileState(temporary)).toEqual(before);
  });
});
