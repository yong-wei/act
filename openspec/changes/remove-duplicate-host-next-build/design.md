# Design

## Decision

The release image's Linux Docker builder remains the only authority for complete `npm run build`. The host performs a bounded preflight before acquiring the shared cache lock:

1. validate the clean committed revision and CourseCoverage input;
2. validate runtime provenance when the selected build scope requires it;
3. validate optimized model assets and their optimizer provenance;
4. validate Prisma configuration/schema and generate the client needed by host validators;
5. run the repository production TypeScript gate without producing `.next`;
6. re-check the visible worktree before Docker execution.

The Docker builder continues to run the unchanged `npm run build`, including Prisma generation, optimized-model validation, TypeScript checking, and the production Next compilation. The final image, revision label, tar digest, provenance, and shared cache generation are published only after that container build succeeds.

## Rationale

Host and container full builds are not independent because they consume the same source and package graph, while only the Linux container output is shipped. Explicit host validations retain early, inexpensive failures and protect immutable inputs. Removing host `.next` generation also prevents its trace output from competing for local disk and memory before the actual release build.

## Failure behavior

- Any host input gate fails before Docker execution.
- Any container build failure prevents image/provenance/cache publication.
- A host validator that changes tracked or visible untracked files is detected by the existing post-preflight clean-worktree check.
- No validation result may substitute for the container's complete Next build.

## Verification

- Contract tests inspect ordering and prohibit host `npm run build`/Next generation.
- Existing Docker migration, runtime externalization, runtime blob, remote deploy, optimized-model, and cache tests remain green.
- One real app-only release build proves the container build, OCI label, tar digest, provenance, Chromium, and LibreOffice remain valid.
