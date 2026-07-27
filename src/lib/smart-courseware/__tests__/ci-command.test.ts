import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('smart courseware required test command', () => {
  it('runs the focused library, API route, and editor suites from the CI test entrypoint', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const command = packageJson.scripts['test:smart-courseware'];

    expect(packageJson.scripts.test).toContain('npm run test:smart-courseware');
    expect(workflow).toContain('run: npm run test');
    expect(command).toContain('vitest run --config src/lib/smart-courseware/vitest.config.ts');
    expect(command).toContain('src/app/api/teacher/smart-courseware/__tests__/route.test.ts');
    expect(command).toContain('src/features/teacher/__tests__/smart-courseware-editor.test.tsx');
    expect(command).toContain('src/features/teacher/__tests__/smart-courseware-editor-interaction.test.tsx');
    expect(command).not.toMatch(/(?:^|&&\s*)vitest run\s*(?:$|&&)/);
  });
});
