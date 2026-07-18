# SkillOpt-Sleep Buddy Auto Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Install SkillOpt-Sleep in the ACT project and configure a validation-gated, project-local workflow that learns from Codex sessions to improve the externally sourced `openspec-buddy-auto` skill.

**Architecture:** Keep the Python runtime and SkillOpt state under the ignored ACT-local `.skillopt-sleep/` directory. Expose a tracked shell wrapper and a project-local `skillopt-sleep` skill. The wrapper points SkillOpt at `.agents/skills/openspec-buddy-auto/SKILL.md`, which currently resolves to the separate `OpenSpec-buddy` repository; runs stage proposals by default and never auto-adopt them.

**Tech Stack:** Python 3.10+, pinned PyPI package `skillopt==0.2.0`, Bash, JSON, Codex project skills, Node-based repository tests.

## Global Constraints

- Keep `evolve_memory` false; this task optimizes Buddy skill text only.
- Keep `gate_mode` on, `gate_metric` mixed, and `auto_adopt` false.
- Default backend is `mock`; real Codex-budget runs require an explicit `--backend codex`.
- Do not modify or overwrite the existing dirty `OpenSpec-buddy` worktree during installation or dry-run validation.
- Do not persist raw transcripts, credentials, or generated runtime state in Git.

---

### Task 1: Define the project-local runtime contract

**Files:**
- Create: `tools/skillopt-sleep/requirements.txt`
- Create: `tools/skillopt-sleep/config.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the pinned dependency and safe configuration**

`requirements.txt` contains exactly `skillopt==0.2.0`. `config.json` sets `backend` to `mock`, `gate_mode` to `on`, `gate_metric` to `mixed`, `evolve_skill` to `true`, `evolve_memory` to `false`, `auto_adopt` to `false`, `target_task_filter` to `true`, a 72-hour lookback, a 12-task nightly cap, and Buddy-specific preferences that preserve controller-first execution, remote-truth gates, and no direct helper composition.

- [ ] **Step 2: Ignore only generated SkillOpt runtime state**

Add `/.skillopt-sleep/` to `.gitignore`. Tracked source configuration remains under `tools/skillopt-sleep/`; venv, state, staging, reports, and backups remain local-only.

- [ ] **Step 3: Verify the contract before runtime installation**

Run:

```bash
rtk python3 -m json.tool tools/skillopt-sleep/config.json
rtk rg -n '^skillopt==0\.2\.0$' tools/skillopt-sleep/requirements.txt
rtk git diff --check
```

Expected: JSON parses, the pinned requirement is found, and `git diff --check` emits no diagnostics.

### Task 2: Add the project-local installation and execution wrappers

**Files:**
- Create: `scripts/skillopt-sleep-install.sh`
- Create: `scripts/skillopt-sleep.sh`
- Test: `scripts/tests/test-skillopt-sleep.mjs`

- [ ] **Step 1: Write the failing wrapper contract test**

The test must assert that both wrappers exist and are executable, the installer references the pinned requirements file and local venv, the runner passes the ACT project and Buddy target skill path, and the config disables memory evolution and auto-adoption.

- [ ] **Step 2: Run the contract test and observe the expected failure**

Run:

```bash
rtk node scripts/tests/test-skillopt-sleep.mjs
```

Expected: FAIL because the new wrappers and config do not exist yet.

- [ ] **Step 3: Implement the installer**

The installer must create `.skillopt-sleep/venv` with the available `python3`, install `tools/skillopt-sleep/requirements.txt`, copy the tracked config into the isolated runtime home, and verify `import skillopt_sleep` plus version `0.2.0`. It must not write to `~/.agents`, `~/.codex`, or the external Buddy repository.

- [ ] **Step 4: Implement the runner**

The runner must default to `status`, resolve the ACT project root from its own location, isolate SkillOpt's config/state through an ACT-local `HOME`, preserve the real `~/.codex` and `~/.claude` paths through explicit flags, set `--source codex`, and set `--target-skill-path .agents/skills/openspec-buddy-auto/SKILL.md`. It must fail with the exact installer command when the local venv is absent and pass through user flags such as `--backend codex`, `--max-tasks`, and `--progress`.

- [ ] **Step 5: Run the contract test and shell syntax checks**

Run:

```bash
rtk node scripts/tests/test-skillopt-sleep.mjs
rtk bash -n scripts/skillopt-sleep-install.sh scripts/skillopt-sleep.sh
```

Expected: PASS and no Bash syntax errors.

### Task 3: Register the project skill and document the safe optimization flow

**Files:**
- Create: `.agents/skills/skillopt-sleep/SKILL.md`
- Modify: `.agents/skills/README.md`
- Modify: `.agents/skills/manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Add the project-local Codex skill**

Document the source as Microsoft SkillOpt v0.2.0, use `scripts/skillopt-sleep.sh` as the only project entrypoint, set the default target to `openspec-buddy-auto`, require `dry-run` before `run`, require reading `report.md` before any adoption, and state that adoption through the symlink can modify the external `OpenSpec-buddy` worktree.

- [ ] **Step 2: Register the skill in both project indexes**

Add the skill to the human-readable README and machine-readable manifest with the path `.agents/skills/skillopt-sleep/SKILL.md`.

- [ ] **Step 3: Add a discoverable project test command**

Add `test:skillopt-sleep` to `package.json`, pointing to `node ./scripts/tests/test-skillopt-sleep.mjs`.

- [ ] **Step 4: Run registration checks**

Run:

```bash
rtk node scripts/tests/test-skillopt-sleep.mjs
rtk python3 -m json.tool .agents/skills/manifest.json
rtk python3 -m json.tool tools/skillopt-sleep/config.json
```

Expected: PASS, valid JSON, and the skill appears in both indexes.

### Task 4: Install and smoke-test without changing the Buddy skill

- [ ] **Step 1: Install the pinned local runtime**

Run `rtk bash scripts/skillopt-sleep-install.sh`. Verify that the package imports from `.skillopt-sleep/venv` and that no files outside ACT's ignored runtime directory changed.

- [ ] **Step 2: Run deterministic status and dry-run checks**

Run:

```bash
rtk bash scripts/skillopt-sleep.sh status --json
rtk bash scripts/skillopt-sleep.sh dry-run --backend mock --max-sessions 2 --max-tasks 2 --progress --json
```

Expected: the commands exit successfully, identify the ACT project and Buddy target, use the mock backend, and create no live skill changes. If no eligible archived sessions are found, the report must say so rather than fabricate a proposal.

- [ ] **Step 3: Verify external-worktree preservation**

Run `rtk git -C /Users/YW/Documents/Project/OpenSpec-buddy status --short` and compare it with the pre-install snapshot. Expected: the same pre-existing files remain modified; no Buddy source file is adopted or overwritten.

- [ ] **Step 4: Run the repository-level targeted verification**

Run:

```bash
rtk npm run test:skillopt-sleep
rtk git diff --check
rtk git status --short --branch
```

Expected: the new contract test passes, no whitespace errors exist, and only the intended ACT files are changed; `.skillopt-sleep/` remains ignored.
