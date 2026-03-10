# Knowledge Graph Refactor V2: 2D/3D Hybrid System

## 1. Overview
This document outlines the design for the next generation of the Knowledge Graph feature. 
The goal is to transition from a pure 3D visualization (which has usability issues with large datasets) to a hybrid 2D/3D system.
The default view will be a high-performance **2D Force-Directed Graph** with a "Pre-computed Radial Layout", offering better readability and structure while retaining the visual appeal and interactive freedom.

## 2. Key Objectives
1.  **Readability**: Ensure all text labels are legible without camera rotation.
2.  **Structure**: Avoid the "hairball" effect using a structured radial layout.
3.  **Performance**: Support 1000+ nodes using Canvas rendering.
4.  **Hybrid Mode**: Allow users to toggle between the new 2D view and the existing 3D view.
5.  **Reuse**: Strictly reuse existing `KnowledgeCard`, `ResourcePanel`, and API logic.

## 3. Architecture

### 3.1 Component Structure
```text
src/features/knowledge/
├── graph/
│   ├── knowledge-graph-canvas.tsx      # (Existing) 3D Graph (React Three Fiber)
│   ├── knowledge-graph-2d.tsx          # (New) 2D Graph (react-force-graph-2d)
│   └── layout-engine.ts                # (New) Layout calculation logic (d3-hierarchy)
├── sidebar/
│   └── knowledge-sidebar.tsx           # (Existing) Left navigation
├── resource-panel/
│   └── resource-panel.tsx              # (Existing) Right inspector
└── knowledge-graph-system.tsx          # (Refactor) Main Container & State Manager
```

### 3.2 Main Container Logic (`knowledge-graph-system.tsx`)
The container needs to manage a new state `viewMode`:
```typescript
type ViewMode = '2D' | '3D';
const [viewMode, setViewMode] = useState<ViewMode>('2D');
```
It will conditionally render either the 2D or 3D component while keeping the `nodes`, `links`, and `selectedNode` state shared.

### 3.3 The 2D Graph Component (`knowledge-graph-2d.tsx`)
*   **Library**: `react-force-graph-2d`
*   **Rendering**: Custom `nodeCanvasObject` to draw glowing circles (Cyan/Blue theme).
*   **Interaction**:
    *   `onNodeClick`: Updates `selectedNode` in parent.
    *   `onNodeDrag`: Standard force graph dragging.
*   **Configuration**:
    *   `warmupTicks`: Low (10-20), relying on pre-layout.
    *   `cooldownTicks`: Low, to stabilize quickly.
    *   `d3AlphaDecay`: 0.02 (standard).
    *   `d3VelocityDecay`: 0.3.

### 3.4 Layout Algorithm (`layout-engine.ts`)
We will implement the "Pre-layout + Physics" strategy.
1.  **Input**: Raw `nodes` and `links` from API.
2.  **Process**:
    *   Convert graph to hierarchy using `d3.stratify` (handle orphans by attaching to a virtual root).
    *   Run `d3.tree` with `size: [2 * Math.PI, radius]`.
    *   Map polar coordinates `(angle, r)` to Cartesian `(x, y)`.
    *   Assign `x, y` to nodes.
3.  **Output**: Nodes with initial positions.

## 4. UI/UX Design

### 4.1 Left Sidebar (Navigation)
*   **Style**: Floating, semi-transparent glass-morphism (matching `ResourcePanel`).
*   **Content**: Search bar + Tree View.
*   **Interaction**: Clicking a tree item focuses the camera on the corresponding node in the graph.

### 4.2 Right Sidebar (Inspector)
*   **Component**: Reuse `ResourcePanel` as is.
*   **Behavior**: Slides in from right when a node is clicked.
*   **Content**: Title, Description, Related Nodes list, "View Card" button.

### 4.3 View Toggle
*   **Location**: Top-right absolute position.
*   **Style**: A segmented control (Toggle Group) "2D | 3D".

## 5. Implementation Plan
1.  **Install Dependencies**: `react-force-graph-2d`, `d3`.
2.  **Create Layout Engine**: Implement `src/features/knowledge/graph/layout-engine.ts`.
3.  **Create 2D Component**: Implement `src/features/knowledge/graph/knowledge-graph-2d.tsx`.
4.  **Refactor Main System**: Update `KnowledgeGraphSystem` to support the toggle and new component.
5.  **Refine Visuals**: Adjust glowing effects and colors to match the "Sci-Fi Maritime" aesthetic.

## 6. Migration Notes
*   **Data Compatibility**: The API `/api/knowledge/graph` returns standard node data. The new layout engine runs entirely on the client-side, so no backend changes are needed.
*   **3D Fallback**: The existing 3D view remains available for users who prefer immersion.
