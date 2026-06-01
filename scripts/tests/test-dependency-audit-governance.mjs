#!/usr/bin/env node

import assert from 'node:assert/strict';
import { evaluateGovernance } from '../security/audit-governance.mjs';

const packageJson = {
  dependencies: {
    next: '^15.5.18',
  },
  devDependencies: {
    eslint: '^8.0.0',
  },
};

const lockfile = {
  packages: {
    'node_modules/next': {},
    'node_modules/next/node_modules/postcss': {},
    'node_modules/eslint': { dev: true },
  },
};

const allowlist = {
  entries: [
    {
      id: 'NEXT-POSTCSS-DIRECT',
      packageName: 'next',
      dependencyPath: 'node_modules/next',
      advisoryIds: ['postcss'],
      severity: 'moderate',
      reason: 'Residual framework-owned finding.',
      ownerIssue: 'https://github.com/yong-wei/act/issues/244',
      reviewDate: '2026-06-01',
      expiresOn: '2026-09-01',
      removalCondition: 'Remove when Next no longer reports the finding.',
    },
  ],
};

const allowedAudit = {
  vulnerabilities: {
    next: {
      name: 'next',
      severity: 'moderate',
      isDirect: true,
      via: ['postcss'],
      nodes: ['node_modules/next'],
    },
  },
  metadata: {
    vulnerabilities: { moderate: 1, high: 0, critical: 0, total: 1 },
  },
};

const newHighAudit = {
  vulnerabilities: {
    next: allowedAudit.vulnerabilities.next,
    eslint: {
      name: 'eslint',
      severity: 'high',
      isDirect: true,
      via: [
        {
          source: 123,
          name: 'eslint',
          url: 'https://github.com/advisories/GHSA-new-risk',
        },
      ],
      nodes: ['node_modules/eslint'],
    },
  },
  metadata: {
    vulnerabilities: { moderate: 1, high: 1, critical: 0, total: 2 },
  },
};

const newModerateAudit = {
  vulnerabilities: {
    minimatch: {
      name: 'minimatch',
      severity: 'moderate',
      isDirect: false,
      via: [
        {
          source: 456,
          name: 'minimatch',
          url: 'https://github.com/advisories/GHSA-new-moderate',
        },
      ],
      nodes: ['node_modules/eslint/node_modules/minimatch'],
    },
  },
  metadata: {
    vulnerabilities: { moderate: 1, high: 0, critical: 0, total: 1 },
  },
};

const mixedAdvisoryAudit = {
  vulnerabilities: {
    next: {
      name: 'next',
      severity: 'moderate',
      isDirect: true,
      via: [
        'postcss',
        {
          source: 789,
          name: 'next',
          url: 'https://github.com/advisories/GHSA-hidden-new',
        },
      ],
      nodes: ['node_modules/next'],
    },
  },
  metadata: {
    vulnerabilities: { moderate: 1, high: 0, critical: 0, total: 1 },
  },
};

const allowedResult = evaluateGovernance({
  audit: allowedAudit,
  allowlist,
  packageJson,
  lockfile,
  threshold: 'moderate',
  today: '2026-06-01',
});

assert.equal(allowedResult.pass, true);
assert.equal(allowedResult.allowed.length, 1);
assert.equal(allowedResult.unallowlisted.length, 0);
assert.equal(allowedResult.allowed[0].finding.runtimeRelevance, 'production-runtime');

const newHighResult = evaluateGovernance({
  audit: newHighAudit,
  allowlist,
  packageJson,
  lockfile,
  threshold: 'moderate',
  today: '2026-06-01',
});

assert.equal(newHighResult.pass, false);
assert.equal(newHighResult.unallowlisted.length, 1);
assert.equal(newHighResult.unallowlisted[0].packageName, 'eslint');
assert.equal(newHighResult.unallowlisted[0].runtimeRelevance, 'dev-tooling');

const newModerateResult = evaluateGovernance({
  audit: newModerateAudit,
  allowlist,
  packageJson,
  lockfile,
  threshold: 'moderate',
  today: '2026-06-01',
});

assert.equal(newModerateResult.pass, false);
assert.equal(newModerateResult.unallowlisted.length, 1);
assert.equal(newModerateResult.unallowlisted[0].packageName, 'minimatch');
assert.deepEqual(newModerateResult.unallowlisted[0].uncoveredAdvisoryIds, ['GHSA-new-moderate', '456', 'minimatch']);

const mixedAdvisoryResult = evaluateGovernance({
  audit: mixedAdvisoryAudit,
  allowlist,
  packageJson,
  lockfile,
  threshold: 'moderate',
  today: '2026-06-01',
});

assert.equal(mixedAdvisoryResult.pass, false);
assert.equal(mixedAdvisoryResult.unallowlisted.length, 1);
assert.equal(mixedAdvisoryResult.unallowlisted[0].packageName, 'next');
assert.deepEqual(mixedAdvisoryResult.unallowlisted[0].uncoveredAdvisoryIds, ['GHSA-hidden-new', '789', 'next']);

const expiredResult = evaluateGovernance({
  audit: allowedAudit,
  allowlist,
  packageJson,
  lockfile,
  threshold: 'moderate',
  today: '2026-09-02',
});

assert.equal(expiredResult.pass, false);
assert.match(expiredResult.validationErrors[0], /expired/);

console.log('dependency audit governance tests passed');
