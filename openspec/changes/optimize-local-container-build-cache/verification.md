# Verification Evidence

## Runner OS cold/hot cache acceptance

- Revision: `904a6987aa361c47a95ecf4d4e95883276c913f6`
- Builder: `act-local-build-cache` (`docker-container`, BuildKit v0.32.2)
- Platform: `linux/amd64`
- Isolated cache and logs: `/tmp/act-runner-os-acceptance.aW6j6A`
- Cold result: the `runner-os` package-install step completed in 112.5 seconds and exported a mode-max local cache.
- Hot result: the identical `runner-os` package-install step was reported as `#6 CACHED`; no application image was published or deployed.

The acceptance used an isolated cache root so the hot result depends only on the cache produced by the immediately preceding cold build.

## Full app-only release image acceptance

- Revision: `58d244bb5d1ebfb7508a6a351adfd1db27d93bee`
- Output and log root: `/tmp/act-app-only-acceptance.Tjoq9T`
- Image tar SHA-256: `ad144b4d6a8c1f150890d140877d65ac234ee03382cae19f5245145e4f86e87e`
- Provenance: `act.textbook-runtime-release-provenance.v2`, `deploymentScope: app-only`, with the same revision and tar digest.
- OCI label: `org.opencontainers.image.revision=58d244bb5d1ebfb7508a6a351adfd1db27d93bee`.
- Container smoke: `Chromium 151.0.7922.173`, `LibreOffice 7.4.7.2 40(Build:2)`, and `/app/.app-revision` matched the committed revision.
- Deployment: not performed.

The first full attempt exposed that `.dockerignore` excluded the optimizer source consumed by `models:validate`. Revision `58d244b` admits only `tools/glb-model-optimizer/optimize-models.mjs` and adds a contract assertion; the successful acceptance ran after that correction.
