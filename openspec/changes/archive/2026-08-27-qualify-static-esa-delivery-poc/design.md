## Context

ACT currently has no `static.adapt-learn.online` application route, Delivery
Bucket publisher, ESA readiness check, cache rule, or ESA/OSS billing evidence.
The existing `act-course-assets` Bucket contains Runtime blobs, manifests,
receipts, and governed knowledge/course resources, so making it an ESA origin
would expose an unnecessarily broad object namespace. ESA private OSS origin
authorization can also create an account-wide read role and must be accepted as
an explicit security decision.

## Goals / Non-Goals

**Goals:**

- Prove one isolated, content-addressed GLB can be delivered through the exact
  static hostname with HTTPS, Range, cache, CORS, and correct cost evidence.
- Preserve a complete pre-change record and bounded DNS rollback.
- Demonstrate that the static hostname cannot serve Authority Bucket objects.

**Non-Goals:**

- Referencing the PoC URL from ACT code or migrating a production asset.
- Changing the ACT main hostname, Runtime Authority, media resolver, selectors,
  active/rollback state, or application readiness.
- Treating private origin authorization as viewer authorization.

## Decisions

### Use a separate private Delivery Bucket

`act-course-delivery` contains only explicitly projected browser bytes. The PoC
copies one verified public GLB; it never moves or deletes its source. Public ACL
and broad object listing remain disabled. Using `act-course-assets` was rejected
because an origin hostname could reach Runtime and governance namespaces.

### Gate ESA service-role authorization before configuration

The operator records the actual ESA service role and policy scope. If the role
has broader same-account Bucket read access than the owner accepts, the PoC
stops before origin authorization or DNS. The receipt records the decision and
policy identity without credentials. This gate cannot be replaced by assuming
the Delivery Bucket alone limits the account-level role.

### Match the cache rule with a content-addressed test path

The only test URL is
`/assets/<lowercase-sha256>/destroyer.glb`, which matches `/assets/*`.
The object binds source SHA-256, uploaded SHA-256, size, media type, ETag, and a
copy-only receipt. The initially conservative explicit edge and browser TTL is
30 days; the production GLB change may use one-year immutable caching only after
content-addressed publication is proven.

### Stage cloud configuration before exact DNS cutover

The order is CNAME-mode site, exact static hostname, OSS-type private origin,
certificate, cache/Range/CORS rules, object verification, pre-cutover evidence,
and finally the authoritative `static` CNAME. The root domain and ACT hostname
are not delegated or changed. Configuration uncertainty blocks the DNS step.

### Verify transport, cache, isolation, and both cost planes

Acceptance requires the exact certificate, full-object hash, `206` with correct
`Content-Range`, repeated-request cache MISS then HIT, CORS for the ACT origin,
negative path/object tests, ESA access/origin evidence, OSS `CdnOut` versus
`NetworkOut`, and ESA package usage. Cost is reported as shifted accounting,
not eliminated traffic.

## Risks / Trade-offs

- **ESA role has account-wide OSS read scope** → require explicit owner
  acceptance or stop before enabling private origin authorization.
- **Range increases origin request count** → measure origin requests and cache
  behavior rather than enabling it without evidence.
- **Certificate auto-renewal has no SLA** → record exact certificate state and
  an operator renewal-failure response.
- **DNS rollback is not instantaneous** → preserve the previous record and TTL,
  keep the PoC unreferenced, and wait through the observation window.
- **Private Bucket is mistaken for viewer authorization** → admit only public,
  rights-cleared test bytes and exclude all private media/PDFs.

## Migration Plan

1. Capture current DNS, Bucket, ESA plan/quota, service-role, and certificate
   state; stop on unresolved ownership or permission scope.
2. Create/configure the isolated origin and upload the immutable test object.
3. Validate all non-DNS configuration and preserve redacted receipts.
4. Change only the exact `static` CNAME and run transport/cache/CORS/log checks.
5. Observe delayed OSS and ESA accounting, then qualify or block the PoC.
6. Roll back by restoring/removing the `static` CNAME; keep the site, Bucket,
   object, and logs until the retention window expires.

## Open Questions

- Actual ESA plan/quota, Delivery Bucket region, DNS provider/TTL, service-role
  policy, and certificate state are required preflight observations. None is
  inferred from repository configuration.
