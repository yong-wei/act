# runtime-traffic-cost-observability Specification

## Purpose
为 ACT Runtime 与浏览器资产路径提供 revision-bound、分母闭合且隐私安全的只读流量与成本归因。OSS、ESA、Nginx、Publisher 和开发机挂载各自平衡，不得把不兼容的供应商网络边界加总；缺失源必须留在分母中。本能力不改变 DNS、云资源、路由、发布或生产状态。
## Requirements
### Requirement: Traffic observation freezes a complete captured denominator
The observation system SHALL bind one full Git commit and tree, observation
window, timezone, environment, route taxonomy, expected evidence sources, tool
versions, and source-export identities. It SHALL enumerate browser public
assets, direct Runtime files, manifest-bound Runtime media redirects,
production Blob mounts, developer public OSS reads, and Publisher operations
without silently omitting an unavailable source.

#### Scenario: Baseline is captured from complete compatible inputs
- **WHEN** every declared source covers the fixed window and route taxonomy
- **THEN** the system SHALL seal their identities and denominator counts in one immutable observation envelope

#### Scenario: One source or time window is missing
- **WHEN** a declared log, metric, billing export, revision, timezone, or window cannot be proved
- **THEN** the observation SHALL remain incomplete and SHALL preserve the missing source in its denominator

### Requirement: Each accounting source balances independently
The observation system SHALL normalize OSS, ESA, Nginx, Publisher, and
developer-mount records into source-specific ledgers. Each ledger SHALL balance
observed, excluded, duplicate, delayed, and unattributed counts and bytes to its
own denominator and SHALL NOT sum incompatible vendor network boundaries into
one traffic total.

#### Scenario: One client transfer appears in ESA and OSS records
- **WHEN** ESA records edge delivery and OSS records the corresponding origin fetch
- **THEN** the system SHALL balance the records in separate source ledgers and SHALL NOT count them as two additive client transfers

#### Scenario: A normalized row cannot be attributed
- **WHEN** available evidence does not prove a route or operation class
- **THEN** its bytes SHALL remain in the source ledger as unattributed instead of disappearing or receiving a guessed class

### Requirement: Attribution records evidence-backed route and operation classes
Every attributed row SHALL identify network direction, endpoint class, route
class, object-prefix class, operation class, byte/count value, source evidence,
and qualification state. Publisher evidence SHALL distinguish upload,
metadata-only reuse, and legacy body readback; OSS evidence SHALL distinguish
public `NetworkOut`, recognized CDN/ESA origin traffic, and non-public endpoint
classes where the source provides them.

#### Scenario: Publisher reuses a metadata-complete object
- **WHEN** Publisher metrics prove a HEAD-only metadata reuse with no body read
- **THEN** the observation SHALL record metadata reuse and zero legacy body-readback bytes for that operation

#### Scenario: Route identity conflicts across sources
- **WHEN** records with similar names resolve to different route, prefix, or endpoint classes
- **THEN** the system SHALL preserve distinct observations and mark the conflict unresolved

### Requirement: Portable observations exclude protected data
Repository-stored observations SHALL contain only allowlisted aggregates,
portable relative identities, hashes, bounded status values, and sanitized
diagnostics. They MUST NOT contain credentials, authorization headers, signed
query strings, raw user events, user identifiers, client IP addresses, or local
absolute paths.

#### Scenario: Raw export contains a signed URL or client identifier
- **WHEN** normalization encounters a protected field or an unsanitized bounded example
- **THEN** publication SHALL fail before the repository artifact is written

#### Scenario: Portable receipt is inspected on another workstation
- **WHEN** a reviewer validates the observation outside the capture machine
- **THEN** every referenced input SHALL resolve by content identity or declared external evidence identity without a local path

### Requirement: Observation and comparison remain read-only and revisioned
Collectors SHALL inspect existing evidence only and SHALL NOT mutate DNS,
Buckets, IAM, cache rules, application routes, publication, selectors,
deployments, or production data. A later comparison SHALL create a new
observation revision, require compatible taxonomies and windows, and report
billing delay rather than rewriting prior evidence.

#### Scenario: Baseline collection runs
- **WHEN** an operator executes the observation workflow
- **THEN** no cloud, application, release, selector, or DNS state SHALL change

#### Scenario: Delayed billing data arrives
- **WHEN** a vendor export becomes complete after the original capture
- **THEN** the system SHALL create a new evidence-bound observation revision and preserve the original result unchanged

