# ChatGPT Project Context Entry

状态: active
最后更新: 2026-06-12
摘要: 面向网页版 ChatGPT GitHub 连接器的项目上下文入口，说明递归读取顺序、记忆契约和主干文件树；当前最近摘要已覆盖统一平台壳层、1-1 标准互动课、React Doctor、UI 治理和智能助教实现阶段。
上游:
- [00-index.md](00-index.md)
下游:
- [02-recent-summary.md](02-recent-summary.md)
- [01-reading-map.md](01-reading-map.md)
相关:
- [README.md](README.md)

This is the project context entry for ChatGPT conversations that use the GitHub connector. Give ChatGPT this file path first, then let it recursively read the linked memory files as needed.

## Read Order

1. Start here: `docs/memory/CHATGPT_CONTEXT.md`
2. Project memory root: `docs/memory/00-index.md`
3. Recent high-value context: `docs/memory/02-recent-summary.md`
4. Task routing map: `docs/memory/01-reading-map.md`
5. Follow the most relevant topic index under `docs/memory/`

## Memory Contract

- `docs/memory` is the only formal project memory root.
- Memory links use repository-relative or Markdown-relative paths so local agents and ChatGPT can resolve the same files from Git.
- Do not read every memory file by default. Use `01-reading-map.md` to choose the smallest relevant path.
- Stable facts belong in leaf files. Root files are navigation surfaces.

## Main Project Tree

The following tree is generated from tracked and unignored repository files, with archives, build output, temporary files, and bulky binary assets excluded.

```text
course-content/
  scripts/
    canonical_nodes.py
    export-runtime.sh
    export_runtime.py
    extract_slides_ref_resources.py
    kg_add.py
    kg_query.py
    lesson_artifacts.py
    lesson_id_map.py
    migrate_lesson_path_references.py
    pillow_font_fallback.py
    python_media_formula.py
    review_lesson_content.py
    runtime_media_index.py
  syllabus-refactor/
    unit-design-details/
      ...
    AGENTS.override.md
    blueprint.md
    decisions.md
    homework-framework.md
    main.md
    module-skeletons.md
    unit-design-details.md
docs/
  memory/
    10-project/
      ...
    20-architecture/
      ...
    30-operations/
      ...
    40-domain/
      ...
    50-decisions/
      ...
    60-incidents/
      ...
    70-workflows/
      ...
    90-archive/
      ...
    00-index.md
    01-reading-map.md
    02-recent-summary.md
    CHATGPT_CONTEXT.md
    README.md
  ProjectDescription.md
  README.md
prisma/
  schema.prisma
scripts/
  analysis/
    analyze-cruise-controls.ts
  claude-mem/
    import_opencode_session_to_claude_mem.py
  db/
    backfill-class-session-attribution.ts
    backfill-course-evidence-and-reporting.ts
    backfill-growth-evaluations.ts
    backfill-learning-facts-from-event-batches.ts
    backfill-learning-facts-from-interaction-logs.ts
    backfill-unit-4-1-growth-governance.ts
    backfill-unit-4-1-growth-options.ts
    backfill-unit-4-4-governance.ts
    course-evidence-backfill-options.ts
    materialize-historical-learning-facts.ts
    migrate-showcase-to-qihang.mjs
    migrate.sh
    rebuild-student-evidence-feature-cache.ts
    recompute-interactive-evidence-scoring-history.ts
    recompute-interactive-evidence-scoring-options.ts
    repair-unit-4-4-incomplete-backfill.ts
    report-evidence-source-coverage.ts
    report-session-data-quality.ts
    schedule_calendar_sync.py
    seed-admin.mjs
    seed-all-knowledge.mjs
    seed-demo-resources.mjs
    seed-demo-user.mjs
    seed-extracurricular-showcase.mjs
    seed-interactive-resources.ts
    seed-knowledge.mjs
    seed-knowledge.ts
    seed-legacy-content.mjs
    seed-lesson02-complete.mjs
    seed-lesson13-knowledge.mjs
    seed-missions.mjs
    seed-semester-usage-for-test-students.mjs
    seed-test-accounts.mjs
    session-data-quality-report-options.ts
    sync-remote-db-to-local.sh
    update-fixed-account-passwords.mjs
  dev/
    openwolf-source-stamp.mjs
    sync-local-worktree-config.sh
  figures/
    control_diagrams_matplotlib.py
    generate_control_plots.py
    generate_l2b_runtime_media.py
    generate_schemdraw_diagrams.py
    generate_schemdraw_diagrams_v2.py
    generate_schemdraw_final.py
  lib/
    prisma-client.mjs
  migrations/
    001-seed-event-dictionary.ts
    002-migrate-to-learning-facts.ts
    003-backfill-snapshots.ts
  ops/
    clear-logs.mjs
    start.sh
    stop.sh
    sync-codex-mcp-env.py
  security/
    audit-governance.mjs
  wasm/
    build-control-engine.mjs
  workers/
    data-governance-worker.ts
    scheduler.ts
    types.ts
  README.md
  build-next-with-trace-check.mjs
  build.sh
  prune-next-trace-boundary.mjs
  remote-deploy.sh
src/
  app/
    (auth)/
      ...
    (main)/
      ...
    __tests__/
      ...
    actions/
      ...
    admin/
      ...
    ai/
      ...
    api/
      ...
    arena/
      ...
    assessment/
      ...
    classroom/
      ...
    course-runtime/
      ...
    data-center/
      ...
    ethics/
      ...
    evaluation/
      ...
    interactive-learning/
      ...
    knowledge/
      ...
    playlists/
      ...
    review/
      ...
    simulations/
      ...
    teacher/
      ...
    virtual-lab/
      ...
    globals.css
    layout.tsx
    page-simple-working.tsx
    page.tsx
  features/
    adaptive/
      ...
    admin/
      ...
    ai/
      ...
    arena/
      ...
    assessment/
      ...
    control-workbench/
      ...
    dashboard/
      ...
    data-center/
      ...
    data-governance/
      ...
    ethics/
      ...
    evaluation/
      ...
    interactive/
      ...
    knowledge/
      ...
    lesson-engine/
      ...
    mission/
      ...
    simulation-arena-workbench/
      ...
    teacher/
      ...
  lib/
    __tests__/
      ...
    ai/
      ...
    classroom-analytics/
      ...
    constants/
      ...
    data-governance/
      ...
    page-extractors/
      ...
    simulation/
      ...
    adaptive-learning-optimization-experiments.ts
    adaptive-learning-path-planner.ts
    admin.ts
    ai-branding.ts
    ai-client.ts
    ai-context-resolver.ts
    ai-message-compat.ts
    ai-prompt-builder.ts
    ai-stream-compat.ts
    ai-theme-styles.ts
    ai-tools.ts
    auth-redirect.ts
    auth.ts
    classroom-observability.ts
    classroom-session-end.ts
    classroom-session-route.ts
    classroom-session-statistics.ts
    commercial-ui-governance.ts
    competency.ts
    control-correction-resource-seed.ts
    course-ai-contexts.ts
    course-runtime.ts
    cruise-ai-contexts.ts
    cruise-course.ts
    event-queue.ts
    extracurricular-analytics.ts
    handout-pdf-export.ts
    handout-pdf.ts
    homepage-theme.ts
    interactive-lesson-identity.ts
    interactive-lesson-manifest.ts
    interactive-response-contracts.ts
    interactive-session-access.ts
    join-code.ts
    knowledge-graph-source.ts
    knowledge-labels.ts
    konling-agent-runtime.ts
    konling-intervention-client-payload.ts
    lesson-artifact-names.ts
    lesson-plan-delete-policy.ts
    llm-client.ts
    lru-cache.ts
    manifest-objective-scoring.ts
    model-render-policy.ts
    nextjs-dynamic-error.ts
    platform-role-navigation.ts
    platform-settings.ts
    prisma-client.ts
    prisma.ts
    rate-limiter.ts
    redis-client.ts
    resource-node-registry.ts
    resource-registry-metadata.ts
    resource-registry.tsx
    runtime-content-path.ts
    runtime-media.ts
    server-spreadsheet.ts
    service-availability.ts
    session-lesson-snapshot.ts
    simulation-ai-contexts.ts
    system-resource-ids.ts
    teacher-resource-node-data.ts
    teacher-resource-node-management.ts
    theme-config.ts
    unit-2-1-ai-contexts.ts
    unit-2-1-course.ts
    unit-2-2-ai-contexts.ts
    unit-2-2-course.ts
    unit-2-3-ai-contexts.ts
    unit-2-3-course.ts
    unit-2-4-ai-contexts.ts
    unit-2-4-course.ts
    unit-3-1-ai-contexts.ts
    unit-3-1-course.ts
    unit-3-2-ai-contexts.ts
    unit-3-2-course.ts
    unit-3-3-ai-contexts.ts
    unit-3-3-course.ts
    unit-3-4-ai-contexts.ts
    unit-3-4-course.ts
    unit-3-5-ai-contexts.ts
    unit-3-5-course.ts
    unit-3-6-ai-contexts.ts
    unit-3-6-course.ts
    unit-3-7-ai-contexts.ts
    unit-3-7-course.ts
    unit-3-8-ai-contexts.ts
    unit-3-8-course.ts
    unit-3-9-ai-contexts.ts
    unit-3-9-course.ts
    unit-4-1-ai-contexts.ts
    unit-4-1-course.ts
    unit-4-2-ai-contexts.ts
    unit-4-2-course.ts
    unit-4-3-ai-contexts.ts
    unit-4-3-course.ts
    unit-4-4-ai-contexts.ts
    unit-4-4-course.ts
    unit-4-5-ai-contexts.ts
    unit-4-5-course.ts
    unit-4-6-ai-contexts.ts
    unit-4-6-course.ts
    unit-4-7-ai-contexts.ts
    unit-4-7-course.ts
    unit-5-1-ai-contexts.ts
    unit-5-1-course.ts
    unit-5-2-ai-contexts.ts
    unit-5-2-course.ts
    unit-5-3-ai-contexts.ts
    unit-5-3-course.ts
    unit-5-4-ai-contexts.ts
    unit-5-4-course.ts
    unit-5-5-ai-contexts.ts
    unit-5-5-course.ts
    unit-5-6-ai-contexts.ts
    unit-5-6-course.ts
    user-sync.ts
    utils.ts
  resources/
    control-system/
      ...
    interactive-learning/
      ...
    simulations/
      ...
    widgets/
      ...
AGENTS.md
CLAUDE.md
package.json
```

## Update Command

Run this after notable structure changes:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/scripts/update_chatgpt_context.py"
```

Check whether the entry is current:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/scripts/update_chatgpt_context.py" --check
```
