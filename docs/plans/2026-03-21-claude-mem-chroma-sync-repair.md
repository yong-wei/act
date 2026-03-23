# Claude-mem Chroma Sync Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore claude-mem vector sync so OpenCode session history is both stored in the local memory database and indexed into Chroma.

**Architecture:** First reproduce the Chroma connectivity failure with direct evidence from worker logs and HTTP probes, then isolate whether the break is in process startup, storage path mismatch, or HTTP endpoint compatibility. After that, apply the smallest configuration or runtime fix, verify with a failing-then-passing end-to-end ingestion check, and confirm logs no longer emit `CHROMA_SYNC` errors.

**Tech Stack:** OpenCode, claude-mem 10.2.3, Bun worker service, Chroma local server, Python 3, SQLite, shell diagnostics.

---

### Task 1: Reproduce the failure precisely

**Files:**
- Inspect: `~/.claude-mem/logs/claude-mem-2026-03-21.log`
- Inspect: `~/.claude-mem/settings.json`
- Inspect: `~/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/scripts/worker-service.cjs`

**Step 1: Write the failing verification**
Create a minimal reproducible probe: trigger a session init or direct health check that should produce successful Chroma sync.

**Step 2: Run it to verify it fails**
Run the probe and confirm `CHROMA_SYNC Failed to connect to Chroma HTTP server` appears, or the expected Chroma HTTP request fails.

**Step 3: Identify the exact boundary**
Determine whether failure is at process startup, host/port reachability, API path compatibility, or data directory mismatch.

### Task 2: Apply the minimal repair

**Files:**
- Modify only if necessary: relevant local claude-mem config/runtime file under `~/.claude-mem/` or plugin cache runtime script under `~/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/`

**Step 1: Make one minimal change**
Fix only the confirmed root cause.

**Step 2: Re-run the same failing verification**
Confirm the previously failing probe now succeeds.

**Step 3: Restart affected services cleanly**
Ensure worker and Chroma are both running with the corrected setup.

### Task 3: End-to-end verify session ingestion

**Files:**
- Inspect: `~/.claude-mem/opencode-sync-state.json`
- Inspect: `~/.claude-mem/logs/claude-mem-2026-03-21.log`

**Step 1: Trigger a fresh minimal ingest**
Use a test session or a manual `/api/sessions/init` call.

**Step 2: Verify storage and vector sync**
Confirm both `DB STORED` and successful Chroma sync behavior in logs.

**Step 3: Regression-check basic health**
Run worker/Chroma verification and confirm no new startup failures.
