import { spawnSync } from 'node:child_process';

const reactDoctorCommand = [
  'npx',
  '--yes',
  'react-doctor@0.5.1',
  '--no-score',
  '--no-telemetry',
  '--no-warnings',
  '--json',
  '.',
];

if (process.env.RUN_REACT_DOCTOR !== '1') {
  console.log([
    'React Doctor commercial UI gate is local-only.',
    'Run with RUN_REACT_DOCTOR=1 npm run test:react-doctor:commercial-ui to execute:',
    reactDoctorCommand.join(' '),
  ].join('\n'));
  process.exit(0);
}

const result = spawnSync(reactDoctorCommand[0], reactDoctorCommand.slice(1), {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('React Doctor commercial UI gate completed.');
