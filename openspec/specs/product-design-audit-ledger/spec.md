# product-design-audit-ledger Specification

## Purpose
TBD - created by archiving change audit-report-closure-ledger-cleanup. Update Purpose after archive.
## Requirements
### Requirement: Audit findings shall keep trusted closure mappings
The audit ledger SHALL distinguish implementation-open findings from findings already covered by archived OpenSpec remediation evidence.

#### Scenario: an archived remediation change explicitly covers an audit finding and cites verification evidence
- **WHEN** an archived remediation change explicitly covers an audit finding and cites verification evidence
- **THEN** the audit report SHALL mark that finding as closed or mapping-cleaned rather than leaving it in the unmarked backlog.

#### Scenario: a finding is moved out of the unmarked backlog for mapping reasons
- **WHEN** a finding is moved out of the unmarked backlog for mapping reasons
- **THEN** the report SHALL cite the archived change id, evidence path, and date without re-auditing the trusted evidence.
