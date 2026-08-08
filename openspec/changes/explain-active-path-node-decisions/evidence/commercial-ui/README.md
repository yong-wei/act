# Commercial UI Evidence

## Representative route

- `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&nodeDecisionFixture=locked`
- Legacy limitation state: `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&provenanceFixture=legacy`
- Completed and skipped history state: `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution`

## Captures

### Desktop 1440 × 1000

![Desktop activity-node decision details](./desktop-1440.png)

### Mobile 320 × 900

![320px activity-node decision details](./mobile-320.png)

## Acceptance record

- The first viewport contains the active-route workspace and the current node at both 1440px and 320px.
- Current-node actions remain reachable after expanding node details.
- “入选依据”, “最近调整”, and the governed “当前锁定原因” are separate and readable.
- The locked explanation uses current readiness; the skipped fixture does not retain a stale lock section.
- The legacy fixture states that node-level historical selection evidence was not recorded and does not reconstruct it from current learner state.
- Completed and skipped nodes retain their historical decision section.
- Automated geometry checks found no document-level horizontal overflow, clipped decision block, or incoherent text wrapping at 1440px or 320px.
- Existing focus-visible classes remain on the unchanged node selector and action controls. This change introduces no new control, motion, color, gradient, shell frame, status term, or module chrome.

## Automated browser command

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3003'
$env:NODE_OPTIONS='--max-old-space-size=8192'
npx playwright test tests/adaptive-path-node-decision-visual-acceptance.spec.ts --workers=1
```

Result: 3 tests passed, covering desktop, 320px, recorded selection, dynamic lock, legacy limitation, completed history, skipped history, primary actions, and horizontal-overflow geometry.
