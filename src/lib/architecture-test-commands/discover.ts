import { REQUIRED_BASELINE } from '@/lib/architecture-charter';

import {
  COMMAND_CONTRACTS,
  DECLARED_ROOTS,
  EXCLUSION_RULES,
  NAMING_RULES,
  classifyLayer,
  isUnitExcluded,
  matchDeclaredRoot,
  matchesAnyGlob,
  matchesTestNamingConvention,
} from './conventions';
import type {
  DenominatorTotals,
  DiscoveryCore,
  ExclusionRecord,
  TestMember,
  UnresolvedRecord,
} from './types';
import { REQUIRED_CHARTER, TEST_COMMAND_CORE_SCHEMA_VERSION } from './types';

export interface DiscoverInput {
  readonly paths: readonly string[];
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly charterSha256?: string;
  readonly baseline?: DiscoveryCore['baseline'];
}

function compareIdentity(left: string, right: string): number {
  return left.localeCompare(right);
}

export function enumerateUniverse(paths: readonly string[]): string[] {
  return [...new Set(paths.filter(matchesTestNamingConvention))].sort(compareIdentity);
}

export function discoverTests(input: DiscoverInput): DiscoveryCore {
  const universe = enumerateUniverse(input.paths);
  const exclusions: ExclusionRecord[] = [];
  const included: string[] = [];
  for (const path of universe) {
    const rule = EXCLUSION_RULES.find((item) => item.match(path));
    if (rule) {
      exclusions.push({
        identity: path,
        ruleId: rule.id,
        owner: rule.owner,
        reason: rule.reason,
        removalCondition: rule.removalCondition,
      });
      continue;
    }
    included.push(path);
  }

  const members: TestMember[] = [];
  const unresolved: UnresolvedRecord[] = [];
  const rootedIds = new Set<string>();

  for (const path of included) {
    const root = matchDeclaredRoot(path);
    if (!root) {
      unresolved.push({
        identity: path,
        code: 'missing-root',
        detail: 'version-controlled-test-outside-declared-roots',
      });
      continue;
    }
    rootedIds.add(root.id);
    const classified = classifyLayer(path);
    if (!classified) {
      unresolved.push({
        identity: path,
        code: 'missing-classification',
        detail: 'no-layer-or-owner',
      });
      continue;
    }
    members.push({
      identity: path,
      layer: classified.layer,
      owner: classified.owner,
      rootId: root.id,
      classificationRule: classified.rule,
    });
  }

  for (const root of DECLARED_ROOTS) {
    if (!rootedIds.has(root.id) && !members.some((member) => member.rootId === root.id)) {
      unresolved.push({
        identity: root.prefix,
        code: 'unmatched-root',
        detail: `declared-root-has-no-members:${root.id}`,
      });
    }
  }

  for (const command of COMMAND_CONTRACTS) {
    if (command.remainderExecution) continue;
    const selected = members.filter((member) => (
      command.layers.includes(member.layer) || command.extraIdentities.includes(member.identity)
    ));
    for (const member of selected) {
      if (command.id === 'test:unit' && isUnitExcluded(member.identity)) {
        unresolved.push({
          identity: member.identity,
          code: 'execution-gap',
          detail: 'unit-classified-but-excluded-by-execution-constraint',
        });
        continue;
      }
      const covered = (
        matchesAnyGlob(member.identity, command.executionGlobs)
        || command.executionIdentities.includes(member.identity)
      );
      if (!covered && command.executionGlobs.length + command.executionIdentities.length > 0) {
        unresolved.push({
          identity: member.identity,
          code: 'execution-gap',
          detail: `not-covered-by-${command.id}-execution-constraint`,
        });
      }
    }
  }

  members.sort((left, right) => compareIdentity(left.identity, right.identity));
  exclusions.sort((left, right) => compareIdentity(left.identity, right.identity));
  unresolved.sort((left, right) => compareIdentity(left.identity, right.identity) || left.code.localeCompare(right.code));

  const uniqueUnresolved: UnresolvedRecord[] = [];
  const seen = new Set<string>();
  for (const item of unresolved) {
    const key = `${item.code}:${item.identity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueUnresolved.push(item);
  }

  const totals: DenominatorTotals = {
    discovered: universe.length,
    classified: members.length,
    excluded: exclusions.length,
    unresolved: uniqueUnresolved.length,
  };

  return {
    schemaVersion: TEST_COMMAND_CORE_SCHEMA_VERSION,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    baseline: input.baseline ?? {
      schemaVersion: REQUIRED_BASELINE.schemaVersion,
      sourceCommit: REQUIRED_BASELINE.sourceCommit,
      sourceTree: REQUIRED_BASELINE.sourceTree,
      censusCoreSha256: REQUIRED_BASELINE.censusCoreSha256,
    },
    charter: {
      schemaVersion: REQUIRED_CHARTER.schemaVersion,
      sha256: input.charterSha256 ?? REQUIRED_CHARTER.sha256,
    },
    commands: COMMAND_CONTRACTS,
    roots: DECLARED_ROOTS,
    includeRules: [...NAMING_RULES],
    excludeRules: EXCLUSION_RULES.map((rule) => rule.id),
    totals,
    members,
    exclusions,
    unresolved: uniqueUnresolved,
  };
}
