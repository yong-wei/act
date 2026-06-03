import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const logDir = path.join(root, '.logs');
const logPath = path.join(logDir, 'next-build.log');

const warningPatterns = [
  /dynamic[^.\n]*(?:filesystem|fs|file system)[^.\n]*trac/i,
  /turbopack[^.\n]*(?:filesystem|fs|file system)[^.\n]*trac/i,
  /trac[^.\n]*(?:filesystem|fs|file system)[^.\n]*dynamic/i,
];

function runNodeScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        process.stdout.write(chunk);
        output += chunk.toString('utf8');
      });
    }

    child.on('close', (code) => {
      resolve({ code, output });
    });
  });
}

function containsTracingWarning(output) {
  return warningPatterns.some((pattern) => pattern.test(output));
}

function runNextBuild() {
  fs.mkdirSync(logDir, { recursive: true });
  const nextBin = path.join(root, 'node_modules', '.bin', 'next');
  const child = spawn(nextBin, ['build'], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const logStream = fs.createWriteStream(logPath, { encoding: 'utf8' });

  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString('utf8');
      logStream.write(chunk);
    });
  }

  return new Promise((resolve) => {
    child.on('close', (code, signal) => {
      logStream.end();
      resolve({ code, signal, output });
    });
  });
}

const result = await runNextBuild();

if (result.code !== 0) {
  process.exitCode = result.code ?? 1;
} else if (containsTracingWarning(result.output)) {
  console.error(`Turbopack dynamic filesystem tracing warning detected. See ${logPath}`);
  process.exitCode = 1;
} else {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pruneResult = await runNodeScript(path.join(scriptDir, 'prune-next-trace-boundary.mjs'));
  if (pruneResult.code !== 0) {
    process.exitCode = pruneResult.code ?? 1;
  }
}
