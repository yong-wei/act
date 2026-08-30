import { AUTHORITY_INPUT_IDS, REQUIRED_TERMINAL_STAGE_IDS } from './types';
import type { AuthorityInputId, ClosureInputReceipt, ClosureManifest, TerminalStageId } from './types';

export const CANONICAL_CLOSURE_COMMAND = 'verify:architecture-closure';
export const CANONICAL_CLOSURE_SCRIPT = 'scripts/architecture-closure.ts';
export const CANONICAL_CLOSURE_MODULE = 'src/lib/architecture-closure';
export const CLOSURE_OWNER = 'platform';

export const UPSTREAM_AUTHORITY_COMMANDS = [
  'census:architecture',
  'charter:architecture',
  'fitness:architecture',
  'fitness:architecture:write',
  'fitness:architecture:write-ledger',
  'quality-gates:validate',
  'quality-gates:run',
  'qa-evidence:check',
  'toolchain:boundary:check',
] as const;

export function isTerminalStageId(value: string): value is TerminalStageId {
  return (REQUIRED_TERMINAL_STAGE_IDS as readonly string[]).includes(value);
}

export function isAuthorityInputId(value: string): value is AuthorityInputId {
  return (AUTHORITY_INPUT_IDS as readonly string[]).includes(value);
}

export function allInputReceipts(manifest: ClosureManifest): ClosureInputReceipt[] {
  return [
    ...AUTHORITY_INPUT_IDS.map((id) => manifest.inputs[id]),
    ...manifest.terminals,
  ].filter(Boolean);
}

export function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
