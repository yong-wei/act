# Verification Evidence

## Runner OS cold/hot cache acceptance

- Revision: `904a6987aa361c47a95ecf4d4e95883276c913f6`
- Builder: `act-local-build-cache` (`docker-container`, BuildKit v0.32.2)
- Platform: `linux/amd64`
- Isolated cache and logs: `/tmp/act-runner-os-acceptance.aW6j6A`
- Cold result: the `runner-os` package-install step completed in 112.5 seconds and exported a mode-max local cache.
- Hot result: the identical `runner-os` package-install step was reported as `#6 CACHED`; no application image was published or deployed.

The acceptance used an isolated cache root so the hot result depends only on the cache produced by the immediately preceding cold build.
