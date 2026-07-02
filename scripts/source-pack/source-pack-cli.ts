import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  retrieveSourcePack,
  buildSourcePack,
  serializeSourcePackAudit,
  serializeSourcePackJson,
  serializeSourcePackMarkdown,
  validateSourcePack,
  type SourcePackItem,
  type SourcePackProfile,
} from '../../src/lib/source-pack';

type SourcePackFormat = 'json' | 'markdown' | 'both';

interface CliResult {
  ok: boolean;
  message: string;
  files?: string[];
}

interface BuildArgs {
  query: string;
  profile: SourcePackProfile;
  outDir: string;
  format: SourcePackFormat;
  topK: number;
  candidatesFile?: string;
}

export async function runSourcePackCli(argv: string[], cwd = process.cwd()): Promise<CliResult> {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return {
      ok: true,
      message: usage(),
    };
  }
  if (command === 'build') {
    return buildCommand(parseBuildArgs(rest), cwd);
  }
  if (command === 'show') {
    return showCommand(rest);
  }
  if (command === 'index') {
    return indexCommand(rest);
  }
  return {
    ok: false,
    message: `Unknown source:pack command: ${command}\n\n${usage()}`,
  };
}

async function buildCommand(args: BuildArgs, cwd: string): Promise<CliResult> {
  const candidates = args.candidatesFile
    ? await readCandidatesFile(path.resolve(cwd, args.candidatesFile))
    : [];
  const pack = candidates.length > 0
    ? retrieveSourcePack({
        query: args.query,
        profile: args.profile,
        role: args.profile === 'konling-answer' || args.profile === 'konling' ? 'student' : 'teacher',
        topK: args.topK,
        caller: 'source-pack-cli',
        candidates,
      }).pack
    : buildSourcePack({
        query: args.query,
        profile: args.profile,
        topK: args.topK,
        caller: 'source-pack-cli',
      });
  const outDir = path.resolve(cwd, args.outDir);
  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  if (args.format === 'json' || args.format === 'both') {
    const file = path.join(outDir, 'source-pack.json');
    await writeFile(file, serializeSourcePackJson(pack), 'utf-8');
    files.push(file);
  }
  if (args.format === 'markdown' || args.format === 'both') {
    const file = path.join(outDir, 'source-pack.md');
    await writeFile(file, serializeSourcePackMarkdown(pack), 'utf-8');
    files.push(file);
  }
  const auditFile = path.join(outDir, 'source-pack.audit.json');
  await writeFile(auditFile, serializeSourcePackAudit(pack), 'utf-8');
  files.push(auditFile);
  return {
    ok: true,
    message: `Source Pack shell wrote ${files.length} file(s) to ${outDir}`,
    files,
  };
}

function showCommand(argv: string[]): CliResult {
  const citationTarget = readOption(argv, '--citation-target');
  if (!citationTarget) {
    return {
      ok: false,
      message: 'show requires --citation-target <id>.',
    };
  }
  const pack = buildSourcePack({
    query: {
      queryId: `citation-target:${citationTarget}`,
      text: `Show citation target ${citationTarget}`,
      profile: 'generic',
      topK: 1,
    },
    limitations: [{
      code: 'citation-target-lookup-unavailable',
      severity: 'warning',
      message: 'Citation target lookup is not implemented in this Source Pack contract-shell change.',
      source: citationTarget,
      recoverable: true,
    }],
  });
  return {
    ok: true,
    message: serializeSourcePackJson(pack),
  };
}

function indexCommand(argv: string[]): CliResult {
  if (argv[0] !== 'status') {
    return {
      ok: false,
      message: 'index supports only: index status',
    };
  }
  return {
    ok: true,
    message: `${JSON.stringify({
      status: 'unavailable',
      reason: 'No governed Source Pack index adapter is implemented in this contract-shell change.',
      limitations: ['adapter-unavailable'],
    }, null, 2)}\n`,
  };
}

function parseBuildArgs(argv: string[]): BuildArgs {
  const query = readOption(argv, '--query');
  const outDir = readOption(argv, '--out') ?? 'artifacts/source-pack';
  const profile = parseProfile(readOption(argv, '--profile') ?? 'generic');
  const format = parseFormat(readOption(argv, '--format') ?? 'both');
  const topK = Number(readOption(argv, '--top-k') ?? '5');
  const candidatesFile = readOption(argv, '--candidates');
  if (!query) throw new Error('build requires --query <text>.');
  if (!Number.isInteger(topK) || topK <= 0) throw new Error('--top-k must be a positive integer.');
  return {
    query,
    profile,
    outDir,
    format,
    topK,
    candidatesFile,
  };
}

async function readCandidatesFile(file: string): Promise<SourcePackItem[]> {
  const value = JSON.parse(await readFile(file, 'utf-8')) as unknown;
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray((value as { items?: unknown })?.items)
      ? (value as { items: unknown[] }).items
      : null;
  if (!candidates) throw new Error('--candidates must point to a JSON array or an object with an items array.');
  return validateSourcePack(buildSourcePack({
    query: 'candidate validation',
    profile: 'generic',
    items: candidates as SourcePackItem[],
  })).items;
}

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

function parseFormat(value: string): SourcePackFormat {
  if (value === 'json' || value === 'markdown' || value === 'both') return value;
  throw new Error('--format must be json, markdown, or both.');
}

function parseProfile(value: string): SourcePackProfile {
  if (
    value === 'handout-authoring' ||
    value === 'assessment-item' ||
    value === 'konling-answer' ||
    value === 'lesson-authoring' ||
    value === 'lesson-design' ||
    value === 'homework-authoring' ||
    value === 'konling' ||
    value === 'path-planning' ||
    value === 'generic'
  ) {
    return value;
  }
  throw new Error('--profile is not a supported Source Pack profile.');
}

function usage(): string {
  return [
    'Usage:',
    '  source:pack build --query <text> --profile <profile> --out <dir> --format json|markdown|both --top-k <n> [--candidates <source-pack-items.json>]',
    '  supported profiles: handout-authoring, assessment-item, konling-answer, lesson-design, lesson-authoring, homework-authoring, konling, path-planning, generic',
    '  source:pack show --citation-target <id>',
    '  source:pack index status',
  ].join('\n');
}

if (require.main === module) {
  runSourcePackCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(result.message.endsWith('\n') ? result.message : `${result.message}\n`);
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
