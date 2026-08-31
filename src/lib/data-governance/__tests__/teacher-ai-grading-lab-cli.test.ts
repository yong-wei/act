import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { runTeacherAiGradingLabCli } from '../../../../scripts/data-governance/teacher-ai-grading-lab-cli';
import type { TeacherAiGradingLabCore } from '../teacher-ai-grading-lab-core';

const COMMANDS = [
  ['validate-package', 'validate-package'],
  ['import', 'import-package'],
  ['create-split', 'create-split'],
  ['freeze', 'freeze-configuration'],
  ['freeze-controlled-visual-experiment', 'freeze-controlled-visual-experiment'],
  ['run', 'run-evaluation'],
  ['resume', 'resume-evaluation'],
  ['reveal-hidden-acceptance', 'reveal-hidden-acceptance'],
  ['record-judgment', 'record-human-judgment'],
  ['report', 'build-report'],
  ['report-controlled-visual-experiment', 'build-controlled-visual-experiment-report'],
  ['export-pdf-verification-checklist', 'export-pdf-verification-checklist'],
] as const;

describe('runTeacherAiGradingLabCli', () => {
  for (const [command, operationKind] of COMMANDS) {
    it(`maps ${command} to ${operationKind}`, async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), 'grading-lab-cli-'));
      const packageFile = path.join(cwd, 'package.zip');
      await writeFile(packageFile, 'package-bytes');
      const input = command === 'validate-package' || command === 'import'
        ? { packageFile: 'package.zip', config: { dataRoot: 'controlled' } }
        : { marker: command };
      await writeFile(path.join(cwd, 'input.json'), JSON.stringify(input));
      const execute = vi.fn(async (_operation: unknown) => ({ reference: operationKind }));
      const disconnect = vi.fn(async () => undefined);

      const result = await runTeacherAiGradingLabCli(
        [command, '--input', 'input.json'],
        {
          createCore: async () => ({
            core: { execute } as unknown as TeacherAiGradingLabCore,
            disconnect,
          }),
        },
        cwd,
        { NODE_ENV: 'test' },
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({
        ok: true,
        command,
        operation: operationKind,
      });
      expect(execute).toHaveBeenCalledOnce();
      const operation = execute.mock.calls[0]?.[0] as { kind: string; input: Record<string, unknown> };
      expect(operation.kind).toBe(operationKind);
      if (command === 'validate-package' || command === 'import') {
        expect(operation.input).not.toHaveProperty('packageFile');
        expect(operation.input.packageBytes).toEqual(Buffer.from('package-bytes'));
      } else {
        expect(operation.input).toEqual(input);
      }
      expect(disconnect).toHaveBeenCalledOnce();
    });
  }

  it('does not create a core for argument or JSON parsing errors', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'grading-lab-cli-'));
    await writeFile(path.join(cwd, 'invalid.json'), '{private student text');
    const createCore = vi.fn();

    const argumentResult = await runTeacherAiGradingLabCli([], { createCore }, cwd);
    const inputResult = await runTeacherAiGradingLabCli(
      ['report', '--input', 'invalid.json'],
      { createCore },
      cwd,
    );

    expect(argumentResult.exitCode).toBe(1);
    expect(JSON.parse(argumentResult.output)).toEqual({
      ok: false,
      error: { code: 'CLI_INVALID_ARGUMENTS', message: 'Invalid command arguments.' },
    });
    expect(inputResult.exitCode).toBe(1);
    expect(JSON.parse(inputResult.output)).toEqual({
      ok: false,
      error: { code: 'CLI_INVALID_INPUT', message: 'The command input is invalid.' },
    });
    expect(createCore).not.toHaveBeenCalled();
  });

  it('projects core failures without leaking sensitive details', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'grading-lab-cli-'));
    await writeFile(path.join(cwd, 'input.json'), JSON.stringify({ marker: 'safe' }));
    const sensitive = `${path.join(cwd, 'student.docx')} credential=secret original submission`;

    const result = await runTeacherAiGradingLabCli(
      ['report', '--input', 'input.json'],
      {
        createCore: async () => ({
          core: {
            execute: async () => {
              throw new Error(sensitive);
            },
          } as TeacherAiGradingLabCore,
        }),
      },
      cwd,
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      error: { code: 'CLI_OPERATION_FAILED', message: 'The grading lab operation failed.' },
    });
    expect(result.output).not.toContain(sensitive);
    expect(result.output).not.toContain(cwd);
  });
});
