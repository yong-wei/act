## 1. Gateway contract and fixtures

- [ ] 1.1 Define the authenticated lease-issue and GET surface for identity, manifest, receipt and SHA Blob, including Range and constant-time token compare.
- [ ] 1.2 Add fixtures that bind a fake host active receipt to a v2 manifest allowlist and a Blob root containing both allowlisted and extra digests, plus a later active identity B.
- [ ] 1.3 Test: matching active identity issues a lease; valid token + lease + allowlisted digest returns exact bytes; extra digest, missing token, query-string token, non-active identity and receipt/manifest drift fail closed without revealing OSS existence.
- [ ] 1.4 Test: after A→B activation, a still-valid A lease can GET an uncached A-only digest; a new lease for A is refused; B-only digests are refused on the A lease.
- [ ] 1.5 Test: after A→B, an expired transport credential on a live A checkout renews without A being active and then reads an uncached A Blob; after checkout stop or token rotation, renewal and GET fail.

## 2. ECS gateway implementation

- [ ] 2.1 Implement the host-side gateway that issues pin-time leases for the current active identity and serves matching files from the local ossfs Blob root or materialized view using the lease allowlist.
- [ ] 2.2 Isolate the reverse-proxy path, rate limits and logs so gateway faults cannot unmount production ossfs or change selectors.
- [ ] 2.3 Add a credential-safe operator install path for the shared token file (`0600`) and a rotate/revoke check that rejects the previous token.
- [ ] 2.4 Test: gateway process down leaves production app/worker runtime binds available; student media signing does not require the developer token.

## 3. Developer adapter cutover

- [ ] 3.1 Replace the default `startup:oss-runtime` Blob transport with a read-only gateway-backed FUSE or equivalent adapter plus shared disk cache; keep the existing materializer and checkout bind.
- [ ] 3.2 Change credential install/preflight to accept only the gateway URL + shared token schema; reject OSS AccessKey, Publisher, SSH and public/internal OSS endpoints.
- [ ] 3.3 Fail closed when bootstrap would use `act-runtime-dev-read`, ossfs2 public Hangzhou Endpoint, or `ACT_RUNTIME_OSS_RAM_ROLE` on the workstation.
- [ ] 3.4 Test: first uncached Blob records one gateway body transfer; second worktree read is a cache hit; write to `course-content/runtime` is rejected.

## 4. Developer media path

- [ ] 4.1 Serve local lesson media from the materialized view / gateway cache instead of public OSS signed redirects.
- [ ] 4.2 Test: missing cache media triggers a gateway Range/body fetch; a development media resolver never emits `*.oss-cn-hangzhou.aliyuncs.com` signed URLs.

## 5. Documentation and revocation

- [ ] 5.1 Rewrite collaborator access docs to describe gateway token install, `startup:oss-runtime`, diagnostics and cleanup without any Secret, SSH key or AccessKey value.
- [ ] 5.2 Rewrite maintainer revoke steps: rotate gateway token first, prove new startups fail, then remove local credential files; do not instruct sharing SSH or OSS keys.
- [ ] 5.3 Document that deleting `act-runtime-dev-read` AccessKey is a follow-up operator action after the new default smoke passes.

生产 ECS 网关部署与真实 smoke 不在本 change 的 apply 清单内；合入后再按 `server-ops` 执行。
