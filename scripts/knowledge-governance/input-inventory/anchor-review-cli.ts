import { readFile } from 'node:fs/promises';
import { canonicalJson } from './normalize';
import { verifyAndAdmitAnchors, type AnchorCandidateArtifact, type AnchorReviewArtifact } from './anchors';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const candidates = JSON.parse(await readFile(argument('--candidates'), 'utf8')) as AnchorCandidateArtifact;
  const reviews = JSON.parse(await readFile(argument('--reviews'), 'utf8')) as AnchorReviewArtifact;
  const authoritativeMarkdownPaths = JSON.parse(await readFile(argument('--authoritative-paths'), 'utf8')) as unknown;
  if (!Array.isArray(authoritativeMarkdownPaths) || authoritativeMarkdownPaths.some((item) => typeof item !== 'string')) throw new Error('--authoritative-paths must contain a JSON string array');
  process.stdout.write(canonicalJson(verifyAndAdmitAnchors(candidates, reviews, authoritativeMarkdownPaths) as unknown as import('./types').Json));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
