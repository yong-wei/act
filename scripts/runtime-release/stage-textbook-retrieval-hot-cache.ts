import { stageTextbookRetrievalHotCache } from '@/lib/runtime-textbook-retrieval-hot-cache';

function required(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

void stageTextbookRetrievalHotCache({
  runtimeRoot: required('--runtime-root'),
  cacheParent: required('--cache-parent'),
}).then((receipt) => {
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
