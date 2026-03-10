# Fix Report

## 2026-01-07: Ten Drops Game - Level Selector Scroll & Game Mechanics

### 1. Level Selector Scroll Issue
**Problem:** The level selection modal in the Ten Drops game was not scrolling correctly. On some devices/browsers, attempting to scroll the list would scroll the background page instead, or the list height was not calculated correctly, preventing access to bottom items.

**Attempts & Final Solution:**
1.  **Initial Attempt (Body Lock):** Tried simple `document.body.style.overflow = 'hidden'`.
    *   *Result:* Inconsistent. Some mobile browsers continue to scroll the "html" element or ignore the lock if the modal doesn't capture touch events properly.
2.  **Intermediate Attempt (CSS Classes):** Switched to Tailwind's `overflow-hidden` class.
    *   *Result:* Failed if Tailwind's base styles didn't prioritize correctly or if the dynamic class addition had timing issues. Reverted to inline styles for reliability.
3.  **Final Solution (Flexbox + Dual Lock):**
    *   **Layout Architecture:** Completely refactored the modal structure from a Block layout with `calc(80vh - 120px)` height to a **Flexbox Column** layout.
        *   Container: `flex flex-col max-h-[85vh]`
        *   Header: `flex-none`
        *   Scroll Area: `flex-1 min-h-0 overflow-y-auto`
        *   *Why:* This ensures the scrollable area automatically fills the available space without fragile magic number calculations. `min-h-0` is crucial in Flex items to allow scrolling.
    *   **Dual Scroll Locking:** Now locks both `document.body` and `document.documentElement` (html tag).
        *   *Why:* Covers differences in browser rendering engines (some scroll on body, some on html).
    *   **Overscroll Containment:** Added `overscroll-behavior: contain`.
        *   *Why:* Prevents "scroll chaining" where scrolling past the end of the modal triggers the background page scroll.

### 2. Game Mechanics & Visuals
*   **Visuals:** Replaced static droplet icons with a dynamic "Puddle" visualization (SVG + CSS border-radius morphing) for static states, and a directional "Teardrop" icon for flying projectiles.
*   **Animation:** Implemented a new `calculateChainSteps` logic to decouple calculation from rendering, allowing for a precise "Explode -> Fly -> Land" animation sequence.
*   **Resource System:** Shifted from a "Move Limit" system to a "Water Drop Resource" system (spend drops to play, earn drops from chain reactions), adding strategic depth.
