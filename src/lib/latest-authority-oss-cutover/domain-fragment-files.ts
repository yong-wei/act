/**
 * Carry and reopen the actual domain-fragment files bound by a composed-manifest.
 * The candidate identity remains the refs digest; these files are the reopen set.
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  assertComposedManifestFragmentsReopened,
  DOMAIN_TEACHING_FRAGMENT_CONTRACT,
  type DomainTeachingComposedManifest,
  type DomainTeachingFragment,
} from '@/lib/teaching-projection';

export const DOMAIN_FRAGMENT_CANDIDATE_DIR = 'domain-fragments' as const;
export const DEFAULT_DOMAIN_FRAGMENT_SEARCH_ROOT =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments';

const FRAGMENT_ID = /^dtf-[a-f0-9]{64}$/u;

export function domainFragmentCandidateRelativePath(fragmentId: string): string {
  if (!FRAGMENT_ID.test(fragmentId)) {
    throw new Error(`invalid domain fragment identity: ${fragmentId}`);
  }
  return `${DOMAIN_FRAGMENT_CANDIDATE_DIR}/${fragmentId}.json`;
}

function walkPublishedFragmentPaths(searchRoot: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(searchRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'schemas' || nameIsHidden(entry.name)) continue;
    const full = path.join(searchRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPublishedFragmentPaths(full));
      continue;
    }
    if (
      !entry.isFile()
      || !entry.name.endsWith('.json')
      || entry.name.endsWith('.authoring.json')
      || entry.name === 'composed-manifest.json'
    ) continue;
    files.push(full);
  }
  return files;
}

function nameIsHidden(name: string): boolean {
  return name.startsWith('.');
}

export function loadReferencedDomainFragments(
  manifest: DomainTeachingComposedManifest,
  searchRoot: string,
): DomainTeachingFragment[] {
  const byId = new Map<string, DomainTeachingFragment>();
  for (const filePath of walkPublishedFragmentPaths(searchRoot)) {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<DomainTeachingFragment>;
    if (parsed.contract !== DOMAIN_TEACHING_FRAGMENT_CONTRACT || typeof parsed.fragmentId !== 'string') {
      continue;
    }
    const existing = byId.get(parsed.fragmentId);
    if (existing && existing.fragmentDigest !== parsed.fragmentDigest) {
      throw new Error(`duplicate domain fragment identity with different digest: ${parsed.fragmentId}`);
    }
    byId.set(parsed.fragmentId, parsed as DomainTeachingFragment);
  }
  const ordered = manifest.fragments.map((ref) => {
    const fragment = byId.get(ref.fragmentId);
    if (!fragment) {
      throw new Error(`referenced domain fragment is not present: ${ref.fragmentId}`);
    }
    return fragment;
  });
  assertComposedManifestFragmentsReopened(manifest, ordered);
  return ordered;
}

export function loadCandidateDomainFragments(
  candidateDir: string,
  manifest: DomainTeachingComposedManifest,
): DomainTeachingFragment[] {
  const ordered = manifest.fragments.map((ref) => {
    const relative = domainFragmentCandidateRelativePath(ref.fragmentId);
    const filePath = path.join(candidateDir, relative);
    const stat = existsSync(filePath) ? lstatSync(filePath) : null;
    if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`referenced domain fragment is not present: ${ref.fragmentId}`);
    }
    return JSON.parse(readFileSync(filePath, 'utf8')) as DomainTeachingFragment;
  });
  assertComposedManifestFragmentsReopened(manifest, ordered);
  return ordered;
}

export function writeDomainFragmentsToCandidate(
  candidateDir: string,
  fragments: readonly DomainTeachingFragment[],
  options?: { overwrite?: boolean },
): void {
  for (const fragment of fragments) {
    const relative = domainFragmentCandidateRelativePath(fragment.fragmentId);
    const target = path.join(candidateDir, relative);
    const bytes = Buffer.from(`${JSON.stringify(fragment, null, 2)}\n`);
    mkdirSync(path.dirname(target), { recursive: true });
    if (existsSync(target) && !readFileSync(target).equals(bytes)) {
      if (!options?.overwrite) {
        throw new Error(`refusing to overwrite ${relative}`);
      }
    }
    writeFileSync(target, bytes);
  }
}
