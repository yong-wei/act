import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  TeacherAiGradingLabCore,
  TeacherAiGradingLabCoreOperation,
} from '../../src/lib/data-governance/teacher-ai-grading-lab-core';

const COMMAND_TO_OPERATION = {
  'validate-package': 'validate-package',
  import: 'import-package',
  'create-split': 'create-split',
  freeze: 'freeze-configuration',
  'freeze-controlled-visual-experiment': 'freeze-controlled-visual-experiment',
  run: 'run-evaluation',
  resume: 'resume-evaluation',
  'reveal-hidden-acceptance': 'reveal-hidden-acceptance',
  'record-judgment': 'record-human-judgment',
  report: 'build-report',
  'report-controlled-visual-experiment': 'build-controlled-visual-experiment-report',
  'export-pdf-verification-checklist': 'export-pdf-verification-checklist',
} as const;

type CliCommand = keyof typeof COMMAND_TO_OPERATION;

export interface TeacherAiGradingLabCliRuntime {
  core: TeacherAiGradingLabCore;
  disconnect?(): Promise<void>;
}

export interface TeacherAiGradingLabCliDependencies {
  createCore(context: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  }): Promise<TeacherAiGradingLabCliRuntime>;
  readFile?(file: string): Promise<Buffer>;
}

export interface TeacherAiGradingLabCliResult {
  exitCode: 0 | 1;
  output: string;
}

interface CliSuccess {
  ok: true;
  command: CliCommand;
  operation: string;
  result: unknown;
}

interface CliFailure {
  ok: false;
  error: {
    code: 'CLI_INVALID_ARGUMENTS' | 'CLI_INVALID_INPUT' | 'CLI_OPERATION_FAILED';
    message: string;
  };
}

const FAILURE_MESSAGES = {
  CLI_INVALID_ARGUMENTS: 'Invalid command arguments.',
  CLI_INVALID_INPUT: 'The command input is invalid.',
  CLI_OPERATION_FAILED: 'The grading lab operation failed.',
} as const;

export async function runTeacherAiGradingLabCli(
  argv: string[],
  dependencies: TeacherAiGradingLabCliDependencies,
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<TeacherAiGradingLabCliResult> {
  let parsed: { command: CliCommand; inputFile: string };
  try {
    parsed = parseArguments(argv);
  } catch {
    return failure('CLI_INVALID_ARGUMENTS');
  }

  let input: Record<string, unknown>;
  try {
    input = await readOperationInput(parsed.command, parsed.inputFile, dependencies, cwd);
  } catch {
    return failure('CLI_INVALID_INPUT');
  }

  let runtime: TeacherAiGradingLabCliRuntime | undefined;
  try {
    runtime = await dependencies.createCore({ cwd, env });
    const kind = COMMAND_TO_OPERATION[parsed.command];
    const operation = { kind, input } as unknown as TeacherAiGradingLabCoreOperation;
    const result = await runtime.core.execute(operation);
    return success({
      ok: true,
      command: parsed.command,
      operation: kind,
      result,
    });
  } catch {
    return failure('CLI_OPERATION_FAILED');
  } finally {
    if (runtime?.disconnect) {
      await runtime.disconnect().catch(() => undefined);
    }
  }
}

function parseArguments(argv: string[]): { command: CliCommand; inputFile: string } {
  const [command, ...options] = argv;
  if (!isCliCommand(command) || options.length !== 2 || options[0] !== '--input') {
    throw new Error('invalid-arguments');
  }
  const inputFile = options[1];
  if (!inputFile || inputFile.startsWith('--')) {
    throw new Error('invalid-input-option');
  }
  return { command, inputFile };
}

function isCliCommand(value: string | undefined): value is CliCommand {
  return value !== undefined && Object.hasOwn(COMMAND_TO_OPERATION, value);
}

async function readOperationInput(
  command: CliCommand,
  inputFile: string,
  dependencies: TeacherAiGradingLabCliDependencies,
  cwd: string,
): Promise<Record<string, unknown>> {
  const loadFile = dependencies.readFile ?? readFile;
  const inputPath = path.resolve(cwd, inputFile);
  const parsed = JSON.parse((await loadFile(inputPath)).toString('utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('input-must-be-object');
  }
  if (command !== 'validate-package' && command !== 'import') {
    return parsed;
  }
  const packageFile = parsed.packageFile;
  if (typeof packageFile !== 'string' || packageFile.length === 0) {
    throw new Error('package-file-required');
  }
  const { packageFile: _packageFile, ...input } = parsed;
  void _packageFile;
  return {
    ...input,
    packageBytes: await loadFile(path.resolve(cwd, packageFile)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function success(payload: CliSuccess): TeacherAiGradingLabCliResult {
  return {
    exitCode: 0,
    output: `${JSON.stringify(payload)}\n`,
  };
}

function failure(code: CliFailure['error']['code']): TeacherAiGradingLabCliResult {
  const payload: CliFailure = {
    ok: false,
    error: {
      code,
      message: FAILURE_MESSAGES[code],
    },
  };
  return {
    exitCode: 1,
    output: `${JSON.stringify(payload)}\n`,
  };
}

async function createProductionRuntime(context: {
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<TeacherAiGradingLabCliRuntime> {
  const [contractsModule, coreModule] = await Promise.all([
    import('../../src/lib/data-governance/teacher-ai-grading-lab-contracts'),
    import('../../src/lib/data-governance/teacher-ai-grading-lab-core'),
  ]);
  const config = contractsModule.readTeacherAiGradingLabConfig(context.env, context.cwd);
  return coreModule.createProductionTeacherAiGradingLabCore({ config });
}

if (require.main === module) {
  runTeacherAiGradingLabCli(process.argv.slice(2), {
    createCore: createProductionRuntime,
  })
    .then((result) => {
      process.stdout.write(result.output);
      process.exitCode = result.exitCode;
    })
    .catch(() => {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        error: {
          code: 'CLI_OPERATION_FAILED',
          message: FAILURE_MESSAGES.CLI_OPERATION_FAILED,
        },
      })}\n`);
      process.exitCode = 1;
    });
}
