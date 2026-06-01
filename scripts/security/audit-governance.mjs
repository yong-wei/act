#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function parseArgs(argv) {
  const args = {
    auditJsonPath: null,
    allowlistPath: 'docs/security/dependency-audit-allowlist.json',
    lockfilePath: 'package-lock.json',
    packageJsonPath: 'package.json',
    threshold: 'moderate',
    today: localDateString(new Date()),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--audit-json') {
      args.auditJsonPath = argv[++index];
    } else if (arg === '--allowlist') {
      args.allowlistPath = argv[++index];
    } else if (arg === '--lockfile') {
      args.lockfilePath = argv[++index];
    } else if (arg === '--package-json') {
      args.packageJsonPath = argv[++index];
    } else if (arg === '--threshold') {
      args.threshold = argv[++index];
    } else if (arg === '--today') {
      args.today = argv[++index];
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!(args.threshold in severityRank)) {
    throw new Error(`Unsupported threshold: ${args.threshold}`);
  }

  return args;
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function printHelp() {
  console.log(`Usage: node scripts/security/audit-governance.mjs [options]

Options:
  --audit-json <path>     Read an existing npm audit JSON report instead of running npm audit.
  --allowlist <path>      Read allowlist JSON. Defaults to docs/security/dependency-audit-allowlist.json.
  --threshold <severity>  Fail unallowlisted findings at or above this severity. Defaults to moderate.
  --today <YYYY-MM-DD>    Evaluation date for expiry checks. Defaults to today.
`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readAuditJson(path) {
  if (path) {
    return readJson(path);
  }

  const result = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!result.stdout.trim()) {
    throw new Error(result.stderr.trim() || 'npm audit did not return JSON output.');
  }

  return JSON.parse(result.stdout);
}

function validateAuditReport(audit) {
  if (!audit || typeof audit !== 'object') {
    throw new Error('npm audit did not return a JSON object.');
  }
  if (!('auditReportVersion' in audit)) {
    throw new Error('npm audit JSON is not a valid audit report: missing auditReportVersion.');
  }
  if (!audit.metadata?.vulnerabilities || typeof audit.metadata.vulnerabilities !== 'object') {
    throw new Error('npm audit JSON is not a valid audit report: missing metadata.vulnerabilities.');
  }
  if (!audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    throw new Error('npm audit JSON is not a valid audit report: missing vulnerabilities.');
  }
}

function directPackageFromNode(nodePath) {
  const normalized = nodePath.replace(/^node_modules\//, '');
  const segments = normalized.split('/');
  if (segments[0]?.startsWith('@')) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

function classifyRuntimeRelevance(vulnerability, packageJson, lockfile) {
  const nodes = vulnerability.nodes || [];
  const packageNames = new Set(nodes.map(directPackageFromNode));
  if (vulnerability.isDirect) {
    packageNames.add(vulnerability.name);
  }

  const hasProd = [...packageNames].some((name) => packageJson.dependencies?.[name]);
  const hasDev = [...packageNames].some((name) => packageJson.devDependencies?.[name]);
  const nodeHasDevFlag = nodes.some((node) => lockfile.packages?.[node]?.dev === true);

  if (hasProd) {
    return 'production-runtime';
  }
  if (hasDev || nodeHasDevFlag) {
    return 'dev-tooling';
  }
  return 'transitive-runtime-unknown';
}

function normalizeAdvisories(vulnerability) {
  const advisories = [];
  for (const item of vulnerability.via || []) {
    if (typeof item === 'string') {
      advisories.push(item);
      continue;
    }
    if (item.url) {
      advisories.push(item.url.split('/').pop());
    }
    if (item.source) {
      advisories.push(String(item.source));
    }
    if (item.name) {
      advisories.push(item.name);
    }
  }
  return [...new Set(advisories)].filter(Boolean);
}

function toFindings(audit, packageJson, lockfile) {
  return Object.values(audit.vulnerabilities || {}).map((vulnerability) => ({
    packageName: vulnerability.name,
    severity: vulnerability.severity,
    isDirect: Boolean(vulnerability.isDirect),
    advisoryIds: normalizeAdvisories(vulnerability),
    dependencyPaths: vulnerability.nodes || [],
    range: vulnerability.range || '',
    fixAvailable: vulnerability.fixAvailable || null,
    runtimeRelevance: classifyRuntimeRelevance(vulnerability, packageJson, lockfile),
    via: vulnerability.via || [],
    effects: vulnerability.effects || [],
  }));
}

function packageNameFromLockPath(packagePath) {
  const segments = packagePath.split('node_modules/');
  const packageSegments = (segments.at(-1) || packagePath).split('/');
  if (packageSegments[0]?.startsWith('@')) {
    return `${packageSegments[0]}/${packageSegments[1]}`;
  }
  return packageSegments[0];
}

function packageKey(name, version) {
  return `${name}@${version}`;
}

function deprecatedPackagesFromLockfile(lockfile) {
  return Object.entries(lockfile.packages || {})
    .filter(([, pkg]) => pkg?.deprecated)
    .map(([path, pkg]) => ({
      path,
      name: packageNameFromLockPath(path),
      version: pkg.version || '',
      packageKey: packageKey(packageNameFromLockPath(path), pkg.version || ''),
      message: pkg.deprecated,
    }));
}

function validateAllowlistEntry(entry, today) {
  const required = [
    'id',
    'packageName',
    'dependencyPath',
    'severity',
    'reason',
    'ownerIssue',
    'reviewDate',
    'expiresOn',
    'removalCondition',
  ];
  const missing = required.filter((field) => !entry[field]);
  if (missing.length > 0) {
    return `Allowlist entry ${entry.id || '<missing id>'} is missing: ${missing.join(', ')}`;
  }
  if (!Array.isArray(entry.advisoryIds) || entry.advisoryIds.length === 0) {
    return `Allowlist entry ${entry.id} must include at least one advisory ID.`;
  }
  if (!(entry.severity in severityRank)) {
    return `Allowlist entry ${entry.id} has unsupported severity: ${entry.severity}`;
  }
  if (entry.expiresOn < today) {
    return `Allowlist entry ${entry.id} expired on ${entry.expiresOn}.`;
  }
  if (!/^#\d+$|^https:\/\/github\.com\/.+\/issues\/\d+$/.test(entry.ownerIssue)) {
    return `Allowlist entry ${entry.id} ownerIssue must be a GitHub issue URL or #number.`;
  }
  return null;
}

function validateDeprecationResidual(entry, today) {
  const required = [
    'id',
    'dependencyPath',
    'ownerLane',
    'ownerIssue',
    'reviewDate',
    'expiresOn',
    'removalCondition',
  ];
  const missing = required.filter((field) => !entry[field]);
  if (missing.length > 0) {
    return `Deprecation residual ${entry.id || '<missing id>'} is missing: ${missing.join(', ')}`;
  }
  if (!Array.isArray(entry.packages) || entry.packages.length === 0) {
    return `Deprecation residual ${entry.id} must include at least one package.`;
  }
  if (typeof entry.releaseBlocking !== 'boolean') {
    return `Deprecation residual ${entry.id} must set releaseBlocking to true or false.`;
  }
  if (entry.expiresOn < today) {
    return `Deprecation residual ${entry.id} expired on ${entry.expiresOn}.`;
  }
  if (!/^#\d+$|^https:\/\/github\.com\/.+\/issues\/\d+$/.test(entry.ownerIssue)) {
    return `Deprecation residual ${entry.id} ownerIssue must be a GitHub issue URL or #number.`;
  }
  return null;
}

function evaluateDeprecationResiduals(deprecationResiduals, lockfile) {
  const deprecatedPackages = deprecatedPackagesFromLockfile(lockfile);
  const deprecatedKeys = new Set(deprecatedPackages.map((pkg) => pkg.packageKey));
  const ownedKeys = new Set(deprecationResiduals.flatMap((entry) => entry.packages));
  const unownedDeprecations = deprecatedPackages.filter((pkg) => !ownedKeys.has(pkg.packageKey));
  const staleDeprecationResiduals = [];

  for (const entry of deprecationResiduals) {
    if (!Array.isArray(entry.packages)) {
      continue;
    }
    const missingPackages = entry.packages.filter((pkg) => !deprecatedKeys.has(pkg));
    if (missingPackages.length > 0) {
      staleDeprecationResiduals.push({
        ...entry,
        missingPackages,
      });
    }
  }

  return {
    deprecatedPackages,
    unownedDeprecations,
    staleDeprecationResiduals,
  };
}

function entryMatchesFinding(entry, finding) {
  if (entry.packageName !== finding.packageName) {
    return false;
  }
  if (entry.severity !== finding.severity) {
    return false;
  }
  if (!finding.dependencyPaths.includes(entry.dependencyPath)) {
    return false;
  }

  const findingAdvisories = new Set(finding.advisoryIds);
  return entry.advisoryIds.some((advisory) => findingAdvisories.has(advisory));
}

function findAllowlistCoverage(finding, allowlistEntries) {
  const matchingEntries = allowlistEntries.filter((entry) => entryMatchesFinding(entry, finding));
  const coveredAdvisories = new Set();

  for (const entry of matchingEntries) {
    for (const advisory of entry.advisoryIds) {
      if (finding.advisoryIds.includes(advisory)) {
        coveredAdvisories.add(advisory);
      }
    }
  }

  return {
    matchingEntries,
    coveredAdvisories,
    uncoveredAdvisoryIds: finding.advisoryIds.filter((advisory) => !coveredAdvisories.has(advisory)),
  };
}

function evaluateGovernance({ audit, allowlist, packageJson, lockfile, threshold, today }) {
  validateAuditReport(audit);

  const thresholdRank = severityRank[threshold];
  const deprecationResiduals = Array.isArray(allowlist.deprecationResiduals)
    ? allowlist.deprecationResiduals
    : [];
  const validationErrors = allowlist.entries
    .map((entry) => validateAllowlistEntry(entry, today))
    .concat(deprecationResiduals.map((entry) => validateDeprecationResidual(entry, today)))
    .filter(Boolean);

  const findings = toFindings(audit, packageJson, lockfile);
  const trackedFindings = findings.filter((finding) => severityRank[finding.severity] >= thresholdRank);
  const usedAllowlistIds = new Set();
  const unallowlisted = [];
  const allowed = [];

  for (const finding of trackedFindings) {
    const coverage = findAllowlistCoverage(finding, allowlist.entries);
    const isFullyCovered =
      finding.advisoryIds.length > 0 &&
      coverage.uncoveredAdvisoryIds.length === 0 &&
      coverage.matchingEntries.length > 0;

    if (isFullyCovered) {
      for (const entry of coverage.matchingEntries) {
        usedAllowlistIds.add(entry.id);
      }
      allowed.push({ finding, entries: coverage.matchingEntries });
    } else {
      unallowlisted.push({
        ...finding,
        uncoveredAdvisoryIds:
          finding.advisoryIds.length > 0 ? coverage.uncoveredAdvisoryIds : ['<missing-advisory-id>'],
      });
    }
  }

  const unusedAllowlist = allowlist.entries.filter((entry) => !usedAllowlistIds.has(entry.id));
  const deprecationState = evaluateDeprecationResiduals(deprecationResiduals, lockfile);

  return {
    threshold,
    today,
    metadata: audit.metadata || {},
    findings,
    trackedFindings,
    allowed,
    unallowlisted,
    unusedAllowlist,
    deprecationResiduals,
    deprecatedPackages: deprecationState.deprecatedPackages,
    unownedDeprecations: deprecationState.unownedDeprecations,
    staleDeprecationResiduals: deprecationState.staleDeprecationResiduals,
    validationErrors,
    pass:
      validationErrors.length === 0 &&
      unallowlisted.length === 0 &&
      unusedAllowlist.length === 0 &&
      deprecationState.unownedDeprecations.length === 0 &&
      deprecationState.staleDeprecationResiduals.length === 0,
  };
}

function formatFinding(finding) {
  const directness = finding.isDirect ? 'direct' : 'transitive';
  const advisories = finding.advisoryIds.length > 0 ? finding.advisoryIds.join(', ') : 'n/a';
  const paths = finding.dependencyPaths.join(', ') || 'n/a';
  return `${finding.packageName} (${finding.severity}, ${directness}, ${finding.runtimeRelevance}) advisories=${advisories} paths=${paths}`;
}

function formatPackageList(packages) {
  return Array.isArray(packages) ? packages.join(', ') : '<invalid packages>';
}

function printReport(result) {
  const counts = result.metadata.vulnerabilities || {};
  console.log('# Dependency Audit Governance Report');
  console.log(`threshold: ${result.threshold}`);
  console.log(`date: ${result.today}`);
  console.log(
    `npm audit counts: critical=${counts.critical || 0} high=${counts.high || 0} moderate=${counts.moderate || 0} total=${counts.total || 0}`,
  );
  console.log(`tracked findings: ${result.trackedFindings.length}`);
  console.log(`allowed findings: ${result.allowed.length}`);
  console.log(`unallowlisted findings: ${result.unallowlisted.length}`);
  console.log(`unused allowlist entries: ${result.unusedAllowlist.length}`);
  console.log(`deprecated packages in lockfile: ${result.deprecatedPackages.length}`);
  console.log(`owned deprecation residuals: ${result.deprecationResiduals.length}`);
  console.log(`unowned deprecation warnings: ${result.unownedDeprecations.length}`);
  console.log(`stale deprecation residuals: ${result.staleDeprecationResiduals.length}`);

  if (result.allowed.length > 0) {
    console.log('\nAllowed residual findings:');
    for (const { finding, entries } of result.allowed) {
      const owners = [...new Set(entries.map((entry) => entry.ownerIssue))].join(', ');
      const expiry = entries.map((entry) => entry.expiresOn).sort()[0];
      console.log(`- ${formatFinding(finding)} owner=${owners} expiresOn=${expiry}`);
      for (const entry of entries) {
        console.log(`  removalCondition=${entry.removalCondition}`);
      }
    }
  }

  if (result.unallowlisted.length > 0) {
    console.log('\nUnallowlisted findings:');
    for (const finding of result.unallowlisted) {
      console.log(`- ${formatFinding(finding)}`);
      console.log(`  uncoveredAdvisories=${finding.uncoveredAdvisoryIds.join(', ')}`);
    }
  }

  if (result.unusedAllowlist.length > 0) {
    console.log('\nUnused allowlist entries:');
    for (const entry of result.unusedAllowlist) {
      console.log(`- ${entry.id} (${entry.packageName} ${entry.dependencyPath})`);
    }
  }

  if (result.deprecationResiduals.length > 0) {
    console.log('\nOwned deprecation residuals:');
    for (const residual of result.deprecationResiduals) {
      console.log(`- ${residual.id} lane=${residual.ownerLane} releaseBlocking=${residual.releaseBlocking}`);
      console.log(`  packages=${formatPackageList(residual.packages)}`);
      console.log(`  path=${residual.dependencyPath}`);
      console.log(`  owner=${residual.ownerIssue} expiresOn=${residual.expiresOn}`);
      console.log(`  removalCondition=${residual.removalCondition}`);
    }
  }

  if (result.unownedDeprecations.length > 0) {
    console.log('\nUnowned deprecation warnings:');
    for (const warning of result.unownedDeprecations) {
      console.log(`- ${warning.packageKey} path=${warning.path}`);
      console.log(`  message=${warning.message}`);
    }
  }

  if (result.staleDeprecationResiduals.length > 0) {
    console.log('\nStale deprecation residuals:');
    for (const residual of result.staleDeprecationResiduals) {
      console.log(`- ${residual.id} missingPackages=${residual.missingPackages.join(', ')}`);
    }
  }

  if (result.validationErrors.length > 0) {
    console.log('\nAllowlist validation errors:');
    for (const error of result.validationErrors) {
      console.log(`- ${error}`);
    }
  }
}

export {
  evaluateGovernance,
  parseArgs,
  printReport,
  readAuditJson,
  toFindings,
  validateAuditReport,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const audit = readAuditJson(args.auditJsonPath);
    const allowlist = readJson(args.allowlistPath);
    const packageJson = readJson(args.packageJsonPath);
    const lockfile = readJson(args.lockfilePath);
    const result = evaluateGovernance({
      audit,
      allowlist,
      packageJson,
      lockfile,
      threshold: args.threshold,
      today: args.today,
    });
    printReport(result);
    process.exit(result.pass ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
