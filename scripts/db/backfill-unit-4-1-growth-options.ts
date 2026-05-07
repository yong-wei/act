export const DEFAULT_UNIT_41_SESSION_ID = 'cmotfl8jz000ulndce351rym9';

export interface Unit41BackfillOptions {
  sessionId: string;
  dryRun: boolean;
  forceSnapshots: boolean;
  skipGrowthEvaluations: boolean;
}

function getArgValue(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const inline = argv.find((item) => item.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1] ?? null;
  }

  return null;
}

export function parseUnit41BackfillOptions(argv = process.argv): Unit41BackfillOptions {
  return {
    sessionId: getArgValue(argv, '--session-id') ?? DEFAULT_UNIT_41_SESSION_ID,
    dryRun: argv.includes('--dry-run'),
    forceSnapshots: argv.includes('--force-snapshots'),
    skipGrowthEvaluations: argv.includes('--skip-growth-evaluations'),
  };
}
