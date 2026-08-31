## Why

Enabling an ESA plan does not prove that ACT's intended static hostname, private
OSS origin, HTTPS, Range handling, cache rules, CORS, or billing classification
work together. A deliberately unreferenced single-object PoC is required before
any ACT page routes production assets through ESA.

## What Changes

- Qualify `adapt-learn.online` in ESA CNAME mode without transferring the root
  zone or changing the ACT application hostname.
- Use a separate private Delivery Bucket, `act-course-delivery`, as an ESA OSS
  origin; explicitly prohibit using the Runtime Authority Bucket
  `act-course-assets` as that origin.
- Configure only `static.adapt-learn.online`, its exact HTTPS certificate,
  private OSS origin authorization, `/assets/*` cache rule, Range behavior, and
  CORS for `https://act.adapt-learn.online` GET/HEAD requests.
- Copy and verify one public test model at
  `/assets/<sha256>/destroyer.glb`; the PoC object is not referenced by ACT code.
- Record pre-cutover configuration, DNS/TTL, object identity, ESA service-role
  permission scope, TLS, `206` Range, MISS-to-HIT cache evidence, CORS, OSS
  `CdnOut` versus `NetworkOut`, ESA usage, negative access tests, and rollback.
- Change only the exact `static` CNAME after all other checks pass; rollback by
  restoring/removing that DNS record while retaining evidence and immutable
  test bytes for the audit window.

## Capabilities

### New Capabilities

- `static-esa-delivery-qualification`: Operator-controlled qualification and
  evidence contract for the isolated ESA/OSS browser-delivery origin.

### Modified Capabilities

None.

## Impact

- **Cloud scope during implementation:** one Delivery Bucket, one ESA static
  hostname/origin, one certificate, bounded cache/Range/CORS rules, one test
  object, and one exact DNS CNAME.
- **Repository:** runbook, validators, redacted configuration/evidence schemas,
  and fixtures; no application asset URL changes.
- **Security:** the ESA service-role permission surface is an explicit go/no-go
  gate; private Bucket origin authorization is not treated as end-user access
  control.
- **Non-goals:** no ACT main-domain cutover, Runtime selector change, private
  media migration, Authority object exposure, or deletion of existing objects.
- **Verification:** external curl/browser/log/billing evidence and local strict
  validation; no GitHub PR CI is added.
