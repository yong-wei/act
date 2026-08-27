## 1. Capture external-state preflight

- [x] 1.1 Record the current `static` DNS record/TTL, DNS provider, ESA site/plan/quota, exact hostname, certificate, Delivery Bucket, origin, cache/Range/CORS rules, and rollback state before any mutation.
- [x] 1.2 Resolve the actual ESA service role and effective OSS read policy, record a credential-free policy identity, and obtain explicit owner acceptance or stop blocked.
- [x] 1.3 Verify Bucket ownership, region, private ACL/public-access blocking, logging, lifecycle, and absence of Runtime/knowledge/assessment data.
- [x] 1.4 Define redacted configuration, object-publication, DNS-change, qualification, and rollback receipt schemas plus an operator runbook.

## 2. Prepare the isolated PoC origin

- [x] 2.1 Create or reconcile the private `act-course-delivery` Bucket without changing or granting ESA access to `act-course-assets`.
- [x] 2.2 Configure `adapt-learn.online` in ESA CNAME mode and only the exact `static.adapt-learn.online` hostname with OSS-type private origin authorization.
- [x] 2.3 Configure and verify the exact hostname certificate, `/assets/*` cache rule, Range origin behavior, and CORS for `https://act.adapt-learn.online` GET/HEAD.
- [x] 2.4 Preserve export/screenshot or API evidence for every setting without storing credentials or authorization values.

## 3. Publish the single immutable test object

- [x] 3.1 Select a rights-cleared public `destroyer.glb`, compute source SHA-256 and size, and copy it conditionally to `assets/<sha256>/destroyer.glb`.
- [x] 3.2 Verify object SHA-256, size, media type, ETag, immutable key, private ACL, and upload receipt; fail without overwrite on any mismatch.
- [x] 3.3 Prove the Delivery Bucket contains only the declared PoC set and that known Authority/non-projected paths cannot be served through the static origin.

## 4. Cut only the static DNS record

- [x] 4.1 Revalidate service-role acceptance, origin, certificate, matching cache rule, Range, CORS, object identity, prior DNS value, and rollback command immediately before cutover.
- [x] 4.2 Point only `static.adapt-learn.online` to the ESA-assigned CNAME and verify authoritative/recursive DNS without changing root or ACT application records.
- [x] 4.3 Verify TLS, full-object hash, `206`/`Content-Range`, cache MISS-to-HIT, CORS, negative keys, and real Three.js/GLTFLoader loading.
- [x] 4.4 Observe ESA access/origin logs, OSS `CdnOut`/`NetworkOut`, ESA usage, and declared vendor reporting delay; do not describe shifted traffic as free.

## 5. Qualify or roll back

- [x] 5.1 Emit a qualification receipt only when every transport, cache, isolation, permission, cost, and denominator check passes.
- [x] 5.2 On any blocking failure, restore/remove only the exact static CNAME and verify existing ACT and Runtime paths remain unchanged.
- [x] 5.3 Retain the ESA site, Delivery Bucket, immutable object, prior DNS evidence, logs, and rollback receipt through the audit window.
- [x] 5.4 Run local receipt/schema fixtures and strict OpenSpec validation; confirm no ACT code URL, production selector, main-domain DNS, deployment, or pull-request CI changed.
