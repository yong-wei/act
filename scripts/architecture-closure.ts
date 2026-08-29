#!/usr/bin/env tsx
import { runArchitectureClosureCommand } from '../src/lib/architecture-closure/command';

function main(): void {
  const result = runArchitectureClosureCommand({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
