## Why

Administrators should see source coverage, session quality, feature cache health, and pipeline health from the UI instead of relying on SSH-only CLI reports.

## What Changes

- Add admin session-quality, source-coverage, and cache-health endpoints.
- Expose Evidence Sources, Session Quality, Feature Cache, and Pipeline tabs.
- Show eligible, context-only, excluded, stale, missing, low-confidence, and queue/pipeline state.
- Align UI metrics with existing CLI outputs.

## Capabilities

### New Capabilities

- `admin-data-governance-dashboard`

### Modified Capabilities

- None.

## Impact

- src/app/api/admin/data-governance/*
- admin data governance page
- source coverage and session quality services
