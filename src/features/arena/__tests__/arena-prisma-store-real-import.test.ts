import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('prismaArenaSubmissionStore real import fallback', () => {
  it('returns an empty list without importing a configured DATABASE_URL', () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    env.DOTENV_CONFIG_PATH = '/tmp/act-nonexistent-env';
    env.NODE_ENV = 'development';

    const output = execFileSync(
      path.join(process.cwd(), 'node_modules', '.bin', 'tsx'),
      [
        '-e',
        [
          "import('./src/features/arena/submissions/prisma-store.ts')",
          '  .then(async (mod) => {',
          '    const rows = await mod.prismaArenaSubmissionStore.listSubmissions();',
          '    console.log(JSON.stringify(rows));',
          '  })',
          '  .catch((error) => {',
          '    console.error(error?.stack || error);',
          '    process.exit(1);',
          '  });',
        ].join('\n'),
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env,
      },
    );

    expect(output.trim()).toBe('[]');
  });

  it('does not fail while importing Arena entrypoints without DATABASE_URL', () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    env.DOTENV_CONFIG_PATH = '/tmp/act-nonexistent-env';
    env.NODE_ENV = 'development';

    const output = execFileSync(
      path.join(process.cwd(), 'node_modules', '.bin', 'tsx'),
      [
        '-e',
        [
          '(async () => {',
          "  await import('./src/lib/prisma.ts');",
          "  await import('./src/app/arena/page.tsx');",
          "  await import('./src/app/api/arena/submissions/route.ts');",
          "  console.log('ok');",
          '})().catch((error) => {',
          '  console.error(error?.stack || error);',
          '  process.exit(1);',
          '});',
        ].join('\n'),
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env,
      },
    );

    expect(output.trim()).toBe('ok');
  });
});
