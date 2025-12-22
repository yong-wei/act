# Role
You are a Senior Frontend Architect and Creative Technologist.

# Task
Build an "Interactive Control Theory Atlas" (SPA) based on the provided concept.
The goal is to visualize the landscape of Control Systems Engineering (from Classical to AI-based) as an interactive graph, where each node contains playable simulations.

# Tech Stack Requirements
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript
- **State Management**: Zustand (for managing simulation states and user preferences)
- **Visualization**: 
  - `react-flow` (for the main topology map)
  - `p5.js` or `react-p5` (for the physics simulations inside the sidebar)
  - `recharts` (for plotting time-domain response charts)
  - `katex` (for rendering mathematical formulas)
- **Styling**: Tailwind CSS (Dark mode, Sci-fi dashboard aesthetic)

# Architecture & Features

## 1. Data Structure (`/src/data/nodes.ts`)
Create a robust JSON-like structure defining the map.
Interface Node:
  - id: string
  - label: string
  - category: 'analysis' | 'modeling' | 'linear' | 'nonlinear' | 'intelligent'
  - position: { x, y }
  - data:
    - description: string (Markdown support)
    - formula: string (LaTeX)
    - simulationType: 'PID' | 'ROOT_LOCUS' | 'PENDULUM' | 'KALMAN_1D' | null
    - prerequisites: string[] (Node IDs)

## 2. Layouts
- **MainCanvas**: Full-screen interactive graph. Use smooth transitions.
- **Sidebar**: A sliding panel on the right (Glassmorphism UI).
  - Header: Title + Category Badge.
  - Section 1: Concept (Text + Formula).
  - Section 2: " The Playground" (The specific simulation component based on `simulationType`).
  - Section 3: "Next Steps" (Links to connected nodes).

## 3. Simulation Components (`/src/components/simulations/`)
Implement at least two distinct simulations for the prototype:
- **PIDController**:
  - Visuals: A block chasing a setpoint or a Water Tank Level control.
  - Controls: Sliders for Kp, Ki, Kd.
  - Charts: Live line chart of Setpoint vs. Measured Value.
- **InvertedPendulum** (Advanced):
  - Visuals: Cart and Pole physics.
  - Controls: Disturbance buttons (push the cart).

## 4. Visual Style Guide
- Background: Deep space blue/black (#0f172a).
- Accents: Neon Cyan (Linear), Magenta (Non-linear), Green (Analysis).
- Typography: Inter (UI), KaTeX (Math), JetBrains Mono (Code).

# Implementation Steps
1. Initialize Vite project with Tailwind.
2. Setup the `react-flow` component with a predefined set of nodes (start with the Brian Douglas map structure).
3. Create the `Sidebar` component with a dynamic render slot for simulations.
4. Implement the `PIDSimulation` using a simple discrete-time physics loop (`requestAnimationFrame`).
5. Ensure responsive design (sidebar collapses on mobile).

# Immediate Deliverable
Please generate the project structure and the code for the `App.tsx`, the `NodeData.ts`, and the `PIDSimulation.tsx` component.