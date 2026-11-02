# Intelligent Delivery Route Optimizer (IDRO)

An academic Artificial Intelligence and heuristic search project demonstrating, visualizing, and benchmarking AI search algorithms and local optimization techniques on a real-world road network (New Delhi, India).

Built for an undergraduate/postgraduate **Artificial Intelligence** course evaluation.

---

## 1. Project Overview

The **Intelligent Delivery Route Optimizer** demonstrates how classical and heuristic AI search algorithms behave when applied to real-world geospatial road graphs. The application provides an interactive map interface (inspired by BBBike.org) centered on New Delhi, India, allowing users to:

1. Select a starting warehouse location.
2. Add multiple intermediate delivery locations in arbitrary order.
3. Select a final destination (or return to warehouse).
4. Automatically sequence intermediate stops using **Hill Climbing with 2-Opt local search** (TSP formulation).
5. Compute road-level paths using three self-implemented AI search algorithms:
   - **A\* Search** ($f(n) = g(n) + h(n)$)
   - **Greedy Best-First Search** ($f(n) = h(n)$)
   - **Hill Climbing Local Search** (steepest descent on heuristic distance)
6. Introduce dynamic traffic conditions (Moderate, Heavy) or block roads entirely.
7. Observe how path cost, travel time, and node exploration change under traffic.
8. Compare all algorithms side-by-side under identical conditions on a unified performance benchmark.
9. Step through the search process using step-by-step frontier and explored node visualization.

---

## 2. Problem Statement & Motivation

In urban logistics, route planning involves two distinct layers of AI problem solving:

1. **High-Level Delivery Sequencing (NP-Hard TSP Variant):** Given a start depot $S$, destination $E$, and a set of delivery stops $\{D_1, D_2, \dots, D_k\}$, find a permutation $\pi$ that minimizes total travel cost:
   $$C(\pi) = d(S, \pi_1) + \sum_{i=1}^{k-1} d(\pi_i, \pi_{i+1}) + d(\pi_k, E)$$
2. **Low-Level Road Pathfinding (Graph State-Space Search):** Given two intersections $u, v$ in a directed road graph $G=(V, E)$, find a directed path $p = (u = n_0, n_1, \dots, n_m = v)$ minimizing total cost:
   $$\text{cost}(p) = \sum_{i=0}^{m-1} c(n_i, n_{i+1})$$

This project implements both layers from first principles in TypeScript without external routing or pathfinding libraries.

---

## 3. AI Concepts Implemented

- **State-Space Representation:** Directed, weighted multigraph with one-way streets, parallel edges, turn constraints, and dynamic edge weights.
- **Evaluation Functions:** $f(n) = g(n) + h(n)$ for A\*, $f(n) = h(n)$ for Greedy.
- **Admissible & Consistent Heuristics:** Haversine great-circle distance for shortest-distance mode; scaled straight-line travel time under the global maximum speed limit ($V_{\max}$) for fastest-time mode.
- **Priority Queue Frontier Management:** Custom binary min-heap for $O(\log |V|)$ frontier operations.
- **Node Reopening:** Updating closed set when lower $g(n)$ is discovered via alternative paths.
- **Local Search & Local Optima:** Genuine Hill Climbing implementation demonstrating plateau and local minimum trapping without falling back to uninformed search.
- **Combinatorial Optimization (TSP):** Nearest-Neighbor heuristic construction followed by iterative 2-opt neighborhood exploration.
- **Dynamic Search Environments:** Real-time modification of graph edge weights (traffic congestion, road blockages) and re-evaluation.

---

## 4. Technology Stack

- **Monorepo & Orchestration:** [Turborepo](https://turbo.build/) with [pnpm workspaces](https://pnpm.io/workspaces).
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, [MapLibre GL JS](https://maplibre.org/).
- **Backend API:** [Hono](https://hono.dev/) with Node.js runtime, REST architecture, Zod validation.
- **Database:** SQLite with Drizzle ORM and native `node:sqlite` engine.
- **Geospatial & Graph Preparation:** Python 3 with [OSMnx](https://osmnx.readthedocs.io/) and NetworkX for initial OpenStreetMap road network extraction.
- **Testing:** [Vitest](https://vitest.dev/) for unit testing of algorithms, graph utilities, heuristics, and optimizer.

---

## 5. System Architecture & Monorepo Structure

```text
StratRoute/
├── apps/
│   ├── web/                         # Next.js 15 frontend application
│   │   ├── src/
│   │   │   ├── app/                 # App Router (page.tsx, layout.tsx, globals.css)
│   │   │   └── components/          # MapComponent, RoutePanel, ComparisonModal, TrafficEditor
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                         # Hono REST API backend
│       ├── src/
│       │   ├── db.ts                # SQLite database service
│       │   ├── schema.ts            # Drizzle table schemas
│       │   ├── graph-loader.ts      # In-memory graph singleton loader
│       │   ├── route-service.ts     # Route calculation & comparison orchestrator
│       │   └── index.ts             # Hono HTTP server endpoints
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── algorithms/                  # AI Search implementations (zero external routing libs)
│   │   ├── src/
│   │   │   ├── priority-queue.ts    # Binary Min-Heap Priority Queue
│   │   │   ├── astar.ts             # A* Search algorithm
│   │   │   ├── greedy-best-first.ts # Greedy Best-First Search
│   │   │   ├── hill-climbing.ts     # Genuine Hill Climbing Local Search
│   │   │   ├── dijkstra.ts          # Exact Uniform-Cost Search (for distance matrix)
│   │   │   └── __tests__/           # Algorithm unit tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── graph/                       # Graph structures and spatial calculations
│   │   ├── src/
│   │   │   ├── haversine.ts         # Haversine distance & admissible heuristics
│   │   │   ├── spatial-index.ts     # Spatial Grid Hash for O(1) road node snapping
│   │   │   ├── road-graph.ts        # Adjacency list representation & traffic management
│   │   │   └── __tests__/           # Graph & heuristic unit tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── optimizer/                   # Delivery sequence optimizer
│   │   ├── src/
│   │   │   ├── delivery-optimizer.ts# Nearest-Neighbor + 2-Opt Hill Climbing TSP
│   │   │   └── __tests__/           # Optimization unit tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                      # Shared TypeScript types, schemas, and constants
│       ├── src/
│       │   ├── types.ts             # GraphNode, GraphEdge, SearchResult, RouteLeg, etc.
│       │   ├── constants.ts         # Speed limits, traffic multipliers, presets
│       │   └── schemas.ts           # Zod API validation schemas
│       ├── package.json
│       └── tsconfig.json
│
├── data/
│   ├── raw/                         # Raw OSM data / GraphML
│   └── processed/                   # Exported New Delhi road network JSON
│
├── scripts/
│   └── extract-road-network.py      # OSMnx extraction & New Delhi network builder
│
├── drizzle/
│   └── schema.ts                    # Root Drizzle schema definition
│
├── package.json                     # Monorepo root scripts
├── pnpm-workspace.yaml              # pnpm workspace definition
├── turbo.json                       # Turborepo task pipeline configuration
├── tsconfig.base.json               # Shared TypeScript compiler options
└── README.md
```

---

## 6. Heuristic Calculation & Mathematical Formulation

### Haversine Formula (Straight-Line Distance)

To compute the spherical distance between node coordinates $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$:

$$a = \sin^2\left(\frac{\phi_2 - \phi_1}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\lambda_2 - \lambda_1}{2}\right)$$
$$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1 - a})$$
$$D_{\text{Haversine}} = R \cdot c$$

Where $R = 6,371,000 \text{ meters}$.

### Optimization Metric 1: Shortest Distance

- **Edge Cost:** $c(e) = D_e \text{ (meters)}$
- **Heuristic:** $h(n) = D_{\text{Haversine}}(n, \text{goal})$
- **Admissibility Proof:** In Euclidean and spherical geometry, straight-line distance is the shortest path between two points (triangle inequality). Therefore, $h(n) \le h^*(n)$ for all $n$, guaranteeing that A\* never overestimates the remaining cost.

### Optimization Metric 2: Fastest Travel Time

- **Edge Travel Time:**
  $$T_e = \frac{D_e / 1000}{V_{\text{effective}}} \times 3600 \text{ seconds}$$
  Where $V_{\text{effective}} = V_{\text{base}} \times M_{\text{traffic}}$ (in km/h).
- **Heuristic:**
  $$h(n) = \frac{D_{\text{Haversine}}(n, \text{goal}) / 1000}{V_{\max}} \times 3600 \text{ seconds}$$
  Where $V_{\max}$ is the global upper bound on vehicle speed across all road types ($80 \text{ km/h}$).
- **Admissibility Proof:** Since no edge can have an effective speed exceeding $V_{\max}$, the minimum possible travel time across straight-line distance is strictly $\le$ the actual travel time across any real road sequence. Thus $h(n) \le h^*(n)$ is strictly maintained.

---

## 7. AI Search Algorithms Comparison

| Feature | A\* Search | Greedy Best-First | Hill Climbing |
| :--- | :--- | :--- | :--- |
| **Evaluation Function** | $f(n) = g(n) + h(n)$ | $f(n) = h(n)$ | $\min_{v \in \text{Neighbors}} h(v)$ |
| **Data Structure** | Min-Heap Priority Queue | Min-Heap Priority Queue | Single state pointer |
| **Optimality Guarantee** | **Yes** (with admissible $h$) | **No** (often suboptimal) | **No** (converges to local optimum) |
| **Completeness** | **Yes** (on finite graphs) | **Yes** (with loop checking) | **No** (fails on dead-ends/minima) |
| **Backtracking** | Explores alternative branches | Explores alternative branches | **None** (irreversible steps) |
| **Typical Use Case** | Guaranteed optimal delivery path | Fast rough trajectory | Local optimization & demonstration |

### Why A\* is Globally Optimal

A\* maintains the accumulated path cost $g(n)$ from the start node and uses an admissible heuristic $h(n)$. When a node is popped from the min-heap, its $f$-value is minimal. If $h$ is admissible and consistent, the first time the goal node is expanded, the path found is mathematically guaranteed to be minimal.

### Why Greedy Best-First Fails Optimality

Greedy Best-First considers only $h(n)$, greedily expanding nodes that appear geometrically closer to the destination. On road networks with detours, rivers, railway tracks, or one-way street loops, Greedy takes deceptive shortcuts that lead into expensive, circuitous roads.

### Why Hill Climbing Gets Stuck

Hill Climbing evaluates all traversable outgoing neighbors of the current node and steps to the neighbor with the lowest heuristic value $h$. If all outgoing neighbors have higher $h$ (due to a cul-de-sac, one-way street pointing away, or a blocked road), the algorithm encounters a **local minimum** and halts immediately, reporting failure.

---

## 8. Automatic Delivery Order Optimization (TSP)

When multiple intermediate delivery locations are supplied, IDRO automatically determines the visiting order using a two-phase optimization procedure:

1. **Pairwise Shortest-Path Matrix:** Computes exact road distances/travel times $d(u, v)$ between all waypoints using Dijkstra's algorithm. Pairwise costs are cached.
2. **Phase 1 — Nearest Neighbor Construction:** Starting at the warehouse, greedily visits the closest unvisited stop next until all stops are sequenced, ending at the final destination.
3. **Phase 2 — Hill Climbing with 2-Opt Moves:**
   - Evaluates neighboring sequences by reversing sub-segments $\pi[i..j]$ of intermediate stops ($1 \le i < j \le k$).
   - Accepts the move that yields the steepest improvement in total route cost:
     $$\Delta C = (d(\pi_{i-1}, \pi_j) + d(\pi_i, \pi_{j+1})) - (d(\pi_{i-1}, \pi_i) + d(\pi_j, \pi_{j+1}))$$
   - Continues iteratively until no 2-opt swap produces a cost reduction (local optimum reached).
   - Start and final destination remain strictly fixed throughout.

---

## 9. Simulated Traffic & Road Blocks

The application features a non-cosmetic, graph-level traffic simulation:

| Traffic Condition | Speed Multiplier | Edge Weight Effect | Visual Color |
| :--- | :---: | :--- | :--- |
| **Normal** | $1.0\times$ | Standard travel time based on road classification | Green (`#10b981`) |
| **Moderate** | $0.75\times$ | $+33\%$ travel time | Yellow (`#eab308`) |
| **Heavy** | $0.40\times$ | $+150\%$ travel time | Orange (`#f97316`) |
| **Blocked** | $0.0\times$ | Edge cost set to $\infty$; excluded from search | Red (`#ef4444`) |

Clicking any road segment on the interactive map opens the **Traffic Editor**, allowing instant modification of individual roads. Recalculating routes immediately reflects how algorithms avoid congested or blocked corridors.

---

## 10. Step-by-Step Search Visualization

The application includes an optional node-exploration trace visualizer:
- **Yellow nodes:** Frontier states currently present in the priority queue.
- **Blue nodes:** Explored/expanded states whose outgoing edges have been traversed.
- **Red node:** Stuck state where Hill Climbing terminated at a local minimum.
- **Interactive Slider:** Allows professors and evaluators to scrub through the expansion step-by-step.

---

## 11. Installation & Execution Guide

### Prerequisites

- **Node.js** $\ge 20$ (Node 22 or 26 recommended)
- **pnpm** $\ge 9$ (or `pnpm.cmd` on Windows)
- **Python 3** (for optional OSMnx data re-extraction)

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd StratRoute

# Install dependencies across all monorepo workspaces
pnpm install
```

### 2. Prepare Road Network (Already pre-generated)

The New Delhi road network dataset is pre-compiled at `data/processed/new-delhi-network.json`. To re-extract or regenerate:

```bash
python scripts/extract-road-network.py --force-fallback
```

### 3. Run Unit Tests

Execute the Vitest test suite across all packages:

```bash
pnpm test
```

Expected output:
```text
✓ packages/graph: 8 passed
✓ packages/algorithms: 7 passed
✓ packages/optimizer: 2 passed
Tasks: 7 successful, 7 total
```

### 4. Build the Monorepo

Compile all TypeScript libraries, Hono backend, and Next.js frontend:

```bash
pnpm run build
```

### 5. Start Development Servers

Start both frontend and backend concurrently via Turborepo:

```bash
pnpm dev
```

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **Backend REST API:** [http://localhost:4000](http://localhost:4000)
- **API Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 12. Evaluation & Demonstration Script

Follow this step-by-step procedure during course evaluation:

1. **Initial Route:** Open `http://localhost:3000`. The map displays Central New Delhi centered on Connaught Place.
2. **Inspect Start & Stops:** The warehouse is at Connaught Place, with stops at NDLS Station, Pragati Maidan, and Khan Market, ending at Lodhi Art District.
3. **Auto-Optimize Order:** Click **"Auto-Order (Hill Climbing)"**. Observe how the intermediate stops are resequenced to minimize total distance.
4. **Run A\* Search:** Click **"Calculate Road Route"**. Notice the optimal route rendered in blue, with exact statistics (total distance, duration, explored nodes, execution time in ms).
5. **Switch to Greedy Best-First:** Change the algorithm to **Greedy Best-First** and recalculate. Observe that Greedy explores fewer nodes but produces a longer total distance.
6. **Switch to Hill Climbing:** Change the algorithm to **Hill Climbing** and calculate. Observe local descent behavior.
7. **Benchmark Modal:** Click **"Compare All 3 Algorithms"**. Review the comprehensive comparison table showing distance, travel time, runtime, and optimality ratios side-by-side.
8. **Simulate Congestion / Road Block:** Click on a key road (e.g. *Barakhamba Road* or *Janpath*) on the map. In the Traffic Editor bar, select **"Heavy"** or **"Block Road"**.
9. **Observe Rerouting:** Recalculate A\*. Watch how the optimal route dynamically diverts around the congested or blocked segment.
10. **Enable Visualization:** Toggle **"Show Trace"** and drag the step slider to examine frontier expansion versus closed nodes.

---

## 13. Academic Integrity & Declarations

- **Zero External Pathfinding Libraries:** All graph models, priority queues, A\*, Greedy Best-First, Hill Climbing, Dijkstra, and 2-opt TSP algorithms were written from scratch in TypeScript.
- **Genuine Local Search:** Hill Climbing is not silently substituted with A\* or BFS when stuck; failure at local minima is an intentional academic demonstration.
- **Admissible Heuristics:** Haversine distance and $V_{\max}$-scaled travel time satisfy the admissibility condition $h(n) \le h^*(n)$.
- **Free & Offline:** Uses free OpenStreetMap data and tiles without mandatory paid API keys.

