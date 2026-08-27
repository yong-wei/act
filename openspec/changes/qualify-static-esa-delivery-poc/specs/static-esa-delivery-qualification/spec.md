## ADDED Requirements

### Requirement: PoC uses an isolated private Delivery origin
The PoC SHALL use a separate private `act-course-delivery` Bucket configured as
an ESA OSS-type origin for only `static.adapt-learn.online`. It MUST NOT use
`act-course-assets`, a Runtime Blob/manifest/receipt prefix, a knowledge or
assessment namespace, a public Bucket ACL, or a broad domain/S3-compatible
origin.

#### Scenario: Operator selects the origin Bucket
- **WHEN** the ESA origin is configured
- **THEN** its exact Bucket identity SHALL be `act-course-delivery` and the recorded origin type SHALL be OSS

#### Scenario: Authority Bucket is proposed as the origin
- **WHEN** configuration resolves to `act-course-assets` or another mixed authority namespace
- **THEN** qualification SHALL stop before origin authorization or DNS change

### Requirement: Private-origin permission scope is an explicit gate
The qualification receipt SHALL bind the actual ESA service-role and policy
identity, record its effective Bucket-read scope, and require explicit owner
acceptance before private-origin authorization. It SHALL contain no credential
value. A private origin SHALL NOT be represented as end-user authorization.

#### Scenario: Service role scope is accepted
- **WHEN** the operator verifies and accepts the recorded effective read scope
- **THEN** origin authorization MAY proceed for the isolated Delivery Bucket

#### Scenario: Service role scope is unknown or rejected
- **WHEN** the effective policy cannot be proved or its account-wide scope is not accepted
- **THEN** the PoC SHALL remain blocked and SHALL NOT change DNS

### Requirement: PoC object is immutable, public-eligible, and content-addressed
The PoC SHALL copy one rights-cleared public `destroyer.glb` to
`assets/<lowercase-sha256>/destroyer.glb`, bind source and object SHA-256, exact
size, media type, ETag and upload receipt, and reject overwrite or unlisted
objects. It SHALL NOT move or delete the source.

#### Scenario: Test object is uploaded
- **WHEN** its source identity, public eligibility, SHA-256, size and path all validate
- **THEN** the copy SHALL use the derived immutable key and the receipt SHALL prove the stored bytes

#### Scenario: Existing key differs
- **WHEN** a pre-existing object at the derived key has different bytes, size, media type or required metadata
- **THEN** qualification SHALL fail without overwrite, delete or alternate mutable key

### Requirement: Exact static hostname is configured before DNS cutover
The operator SHALL configure a CNAME-mode ESA site, the exact
`static.adapt-learn.online` hostname, its valid hostname certificate, private OSS
origin authorization, a matching `/assets/*` cache rule, Range origin behavior,
and CORS for `https://act.adapt-learn.online` GET/HEAD before changing the exact
authoritative `static` CNAME. The root and ACT application DNS records SHALL
remain unchanged.

#### Scenario: Pre-DNS configuration is complete
- **WHEN** every hostname, origin, certificate, cache, Range, CORS and permission check passes
- **THEN** the operator MAY point only the `static` record to the ESA-assigned CNAME

#### Scenario: Test URL does not match the cache rule
- **WHEN** the object is outside `/assets/*` or a required rule is missing
- **THEN** DNS cutover and qualification SHALL remain blocked

### Requirement: Qualification proves transport, cache, isolation, and cost
The final PoC receipt SHALL bind current DNS/TTL, certificate evidence,
full-object hash, `206` and correct `Content-Range`, repeated-request cache
MISS-to-HIT evidence, CORS, negative object/path tests, ESA access/origin logs,
OSS `CdnOut` and `NetworkOut` observations, ESA usage, observation times, and
vendor reporting delay. It SHALL report shifted cost classes rather than claim
that ESA traffic is free.

#### Scenario: All PoC checks pass after DNS cutover
- **WHEN** HTTPS, hash, Range, cache, CORS, isolation and both billing planes are proven
- **THEN** the receipt SHALL qualify only the unreferenced static delivery PoC and its one immutable object

#### Scenario: Static hostname can retrieve an Authority object
- **WHEN** a known Authority namespace or non-projected key succeeds through the static hostname
- **THEN** the PoC SHALL fail and the operator SHALL roll back the exact static DNS record

### Requirement: PoC remains unreferenced and reversibly scoped
ACT application code, Runtime selectors, private media routes, and main-domain
DNS SHALL NOT reference or depend on the PoC. Rollback SHALL restore or remove
only the exact `static` CNAME first and retain the ESA site, Delivery Bucket,
test object, prior DNS evidence, and logs through the audit retention window.

#### Scenario: ESA becomes unavailable during PoC
- **WHEN** no production ACT asset references the static hostname
- **THEN** existing ACT pages and Runtime delivery SHALL remain unchanged

#### Scenario: Operator rolls back the PoC
- **WHEN** a blocking check fails after DNS cutover
- **THEN** the operator SHALL restore the prior static DNS state without deleting immutable evidence or unrelated cloud resources
