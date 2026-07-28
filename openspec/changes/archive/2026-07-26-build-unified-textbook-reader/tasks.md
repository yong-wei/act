## 1. Reader Data Boundary

- [x] 1.1 Implement server-side textbook catalog, navigation, structure-unit, and fragment-anchor loaders for the v2 runtime
- [x] 1.2 Enforce authentication and course-access authorization for every textbook route and loader
- [x] 1.3 Return not-found or forbidden responses without exposing textbook body content or runtime filesystem details

## 2. Unified Reading Interface

- [x] 2.1 Build the shared two-column reader with expandable full-book navigation and structure-unit body rendering
- [x] 2.2 Render formulas, figures, tables, and authoring descriptions from the structured runtime without duplicating descendant text
- [x] 2.3 Focus and visibly identify formula, figure, or table anchors while preserving surrounding unit context
- [x] 2.4 Support navigation to any authorized unit without requiring entry through a citation

## 3. Route and Modal Integration

- [x] 3.1 Implement stable `/textbooks/{bookId}/{edition}/{...unitPath}` routes and fragment anchors
- [x] 3.2 Add intercepting modal routes that update the URL and restore the originating page and URL when closed
- [x] 3.3 Render the same reader as a standalone full page for direct visits, refreshes, and shared links
- [x] 3.4 Make citation-link handling reusable by Konling and other platform source lists

## 4. Verification

- [x] 4.1 Add loader and authorization tests for valid, missing, unauthorized, and cross-course textbook requests
- [x] 4.2 Add browser tests for modal opening and closing, direct navigation, refresh, sharing, chapter navigation, and anchor focus
- [x] 4.3 Verify representative units and anchors across all six textbooks and the reference collection
