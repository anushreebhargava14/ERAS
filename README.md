# 🚨 ERAS — Emergency Resource Allocation System

> A full-stack web platform that solves the **optimal disaster relief resource allocation problem** using Greedy heuristics and 0/1 Knapsack dynamic programming — then compares them in real time.

## 📋 Table of Contents

- [What is ERAS?](#-what-is-eras)
- [The Problem It Solves](#-the-problem-it-solves)
- [How the Algorithms Work](#-how-the-algorithms-work)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Running the App](#-running-the-app)
- [Pages & Usage Guide](#-pages--usage-guide)
- [REST API Reference](#-rest-api-reference)
- [Algorithm Deep Dive](#-algorithm-deep-dive)
- [Test Cases](#-test-cases)
- [Tech Stack](#-tech-stack)

---

## 🧠 What is ERAS?

ERAS is a decision-support tool for emergency coordinators. Given a **fixed pool of rescue resources** and **multiple affected zones**, it determines the optimal allocation strategy — which zones to help, in what priority, to maximise total humanitarian impact.

It runs two algorithms simultaneously and compares their output:

| Algorithm | Speed | Accuracy | Approach |
|-----------|-------|----------|----------|
| **Greedy** | O(n log n) | Near-optimal | Picks highest efficiency zone first |
| **0/1 Knapsack DP** | O(n × W) | Always optimal | Evaluates every possible combination |

---

## 🌍 The Problem It Solves

Imagine you're coordinating disaster relief after a major earthquake. You have **60 rescue units** and three affected zones:

| Zone | People Affected | Severity (1–10) | Resources Needed |
|------|----------------|-----------------|-----------------|
| Zone Alpha | 8,000 | 9 | 40 units |
| Zone Bravo | 5,000 | 7 | 30 units |
| Zone Charlie | 3,000 | 6 | 20 units |

You can't help everyone — the total needed (90 units) exceeds your supply (60). **Which combination maximises total humanitarian impact?**

This is the question ERAS answers. Each zone's impact is scored as:

```
Impact Score = (Population × Severity) ÷ 1000
```

Zone Alpha = (8000 × 9) ÷ 1000 = **72.0**  
Zone Bravo = (5000 × 7) ÷ 1000 = **35.0**  
Zone Charlie = (3000 × 6) ÷ 1000 = **18.0**

ERAS finds which subset of zones maximises total impact without exceeding your resource budget.

---

## ⚙️ How the Algorithms Work

### ⚡ Greedy Algorithm

Sorts zones by **efficiency** (impact per resource unit) and allocates top-down until the budget runs out.

```
Efficiency = Impact ÷ Resources Required
```

**Weakness:** Greedy makes the locally optimal choice at each step. It can fail when the most efficient zone is awkwardly sized — it fits in the budget but leaves a gap too small for anything else.

**Example of failure:**
- Budget = 10, Zone X (impact 7, cost 6), Zone Y (impact 5, cost 5), Zone Z (impact 5, cost 5)
- Greedy picks X (best efficiency) → 4 units left → Y and Z both need 5 → **stuck at 7 pts**
- Optimal is Y+Z → **10 pts**

### 🔬 0/1 Knapsack — Dynamic Programming

Builds a 2D table `dp[i][w]` where each cell represents the maximum impact achievable using the first `i` zones with budget `w`.

```
dp[i][w] = max(
  dp[i-1][w],                              // skip zone i
  dp[i-1][w - resource[i]] + impact[i]     // include zone i
)
```

Backtracks through the completed table to find which exact zones were selected. **Guaranteed optimal — no combination is left unchecked.**

**The "0/1" means:** each zone is either fully funded (1) or fully skipped (0). No partial allocations — you can't send half a rescue team.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Allocation Engine** | Runs Greedy and Knapsack simultaneously on your regions |
| **Side-by-Side Comparison** | Impact scores, selected zones, resource utilisation bars |
| **Impact Chart** | Live Chart.js bar chart updated after every run |
| **Region Details Table** | Per-zone breakdown with impact score, efficiency, and algorithm selection status |
| **Edit Regions** | Modal editor — update any zone without losing others |
| **Allocation History** | Every run persisted to SQLite with full details |
| **Expandable History Rows** | Click any run to see which zones were selected |
| **CSV Export** | Download complete allocation history as a spreadsheet |
| **Analytics Dashboard** | Win rate donut chart, impact-over-time line chart, region comparison chart |
| **Preset Scenarios** | One-click earthquake, flood, and wildfire scenarios |
| **Persistent Storage** | SQLite database survives server restarts |
| **REST API** | Full JSON API at `/api/*` for all operations |

---

## 📁 Project Structure

```
emergency-resource-system/
│
├── server.js               ← Express backend + all API routes
├── package.json            ← Dependencies
├── eras.db                 ← SQLite database (auto-created on first run)
│
└── public/                 ← All frontend files (served statically)
    ├── home.html           ← Landing page
    ├── dashboard.html      ← Main allocation interface
    ├── scenarios.html      ← Preset disaster scenarios
    ├── history.html        ← Allocation run history + CSV export
    ├── analytics.html      ← Charts and performance analytics
    ├── how.html            ← Documentation and API reference
    ├── style.css           ← Full design system (light theme)
    └── app.js              ← All frontend logic (API calls, charts, UI)
```

---

## 🛠 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Steps

**1. Clone or download the project**

```bash
git clone <your-repo-url>
cd emergency-resource-system
```

**2. Install dependencies**

```bash
npm install
```

This installs: `express`, `cors`, `sqlite3`

---

## 🚀 Running the App

```bash
node server.js
```

You should see:

```
🚨  ERAS v2 running →  http://localhost:3000

   Open: http://localhost:3000/home.html
✅  SQLite connected → eras.db
```

Open your browser and go to:

```
http://localhost:3000/home.html
```

> ⚠️ **Keep the terminal open** while using the app. Closing it stops the server.

> ⚠️ **Always use `localhost:3000`** — opening the HTML files directly from your file system (double-clicking them) won't work because the backend won't be running.

---

## 📖 Pages & Usage Guide

### 🏠 Home (`/home.html`)
Landing page with feature overview. Click **"Launch Dashboard"** to start.

---

### ⚡ Dashboard (`/dashboard.html`)

The main interface. Everything happens here.

**Step 1 — Set your budget**
Enter the total resource units available in the large red input at the top of the sidebar. Example: `60`

**Step 2 — Add regions**
Fill in all four fields and click **+ Add Region**:

| Field | What to enter | Example |
|-------|--------------|---------|
| Zone / Region Name | A label for the area | `Zone Alpha` |
| Affected Population | Number of people impacted | `8000` |
| Severity Level | How critical (1 = minor, 10 = catastrophic) | `9` |
| Resources Required | Units this zone needs | `40` |

Repeat for each affected zone. You'll see them appear in the sidebar list with colour-coded severity badges.

**Step 3 — Run allocation**
Click **⚡ Run Allocation**. Results appear instantly:
- KPI row updates (greedy impact, knapsack impact, improvement)
- Algorithm boxes show which zones each algorithm selected
- Resource utilisation bars show how efficiently the budget was used
- Bar chart renders the comparison
- Region Details table shows per-zone algorithm decisions

**Other controls:**
- **✏️ pencil icon** on any region → opens edit modal
- **× button** on any region → deletes it
- **Reset All** → clears all regions and results

---

### 🗺️ Scenarios (`/scenarios.html`)

Three pre-configured disaster scenarios. Click any card to instantly populate the dashboard:

| Scenario | Zones | Max Severity | Suggested Budget |
|----------|-------|-------------|-----------------|
| 🏚️ Earthquake Response | 3 urban zones | 9/10 | 60 units |
| 🌊 Flood Relief | 3 rural villages | 8/10 | 40 units |
| 🔥 Wildfire Emergency | 3 sectors | 8/10 | 50 units |

> Loading a scenario clears any existing region data.

---

### 🕐 History (`/history.html`)

Log of every allocation run. Features:
- **KPI row** — total runs, Knapsack wins, Greedy wins, average improvement
- **Run table** — timestamp, budget, impact scores, winner badge
- **Details button** — expands a row to show selected/skipped zones for that run
- **Export CSV** — downloads full history as `eras-history.csv`
- **Clear History** — wipes all historical records

---

### 📈 Analytics (`/analytics.html`)

Three charts built from historical run data:

| Chart | What it shows |
|-------|--------------|
| **Win Rate Donut** | Percentage of runs won by Knapsack vs Greedy vs Tie |
| **Impact Over Time** | Line chart of Greedy vs Knapsack scores across last 15 runs |
| **Region Comparison** | Bar chart of current regions — impact score vs resources required |

> Analytics requires at least one allocation run to display charts.

---

### 📖 Docs (`/how.html`)

Full documentation including algorithm explanations, the impact formula, and the complete REST API reference.

---

## 🔌 REST API Reference

Base URL: `http://localhost:3000`

### Regions

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `GET` | `/api/regions` | Get all regions | — |
| `POST` | `/api/regions` | Add a region | `{ name, population, severity, resource }` |
| `PUT` | `/api/regions/:id` | Update a region | `{ name, population, severity, resource }` |
| `DELETE` | `/api/regions/:id` | Delete one region | — |
| `DELETE` | `/api/regions` | Delete all regions | — |

### Allocation

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/api/allocate` | Run both algorithms | `{ capacity: number }` |

**Response:**
```json
{
  "greedy": {
    "totalImpact": 90.0,
    "selected": ["Zone Alpha", "Zone Charlie"],
    "usedResources": 60
  },
  "knapsack": {
    "totalImpact": 90.0,
    "selected": ["Zone Charlie", "Zone Alpha"],
    "usedResources": 60
  },
  "capacity": 60,
  "regions": [ ...full region objects with impact scores ]
}
```

### History & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/history` | All allocation history (add `?limit=N` to restrict) |
| `DELETE` | `/api/history` | Clear all history |
| `GET` | `/api/stats` | Aggregate stats (win rates, averages, totals) |
| `GET` | `/api/history/export` | Download history as CSV file |

---

## 🧪 Test Cases

### Test 1: Basic Allocation (algorithms agree)

Budget: `60`

| Zone | Population | Severity | Resources |
|------|-----------|----------|-----------|
| Zone Alpha | 8000 | 9 | 40 |
| Zone Bravo | 5000 | 7 | 30 |
| Zone Charlie | 3000 | 6 | 20 |

**Expected:** Both select Alpha + Charlie = **90.0 pts**, improvement = **0.0** (Greedy happened to find optimal)

---

### Test 2: Knapsack Beats Greedy ⭐

Budget: `10`

| Zone | Population | Severity | Resources |
|------|-----------|----------|-----------|
| Zone X | 7000 | 1 | 6 |
| Zone Y | 5000 | 1 | 5 |
| Zone Z | 5000 | 1 | 5 |

**Expected:**
- Greedy picks Zone X only = **7.0 pts** (best efficiency but leaves 4 units stranded)
- Knapsack picks Zone Y + Zone Z = **10.0 pts**
- Improvement = **+3.0 pts** ✅

This is the canonical case where Greedy fails — Zone X has the best efficiency ratio but its awkward size prevents any other zone from fitting.

---

### Test 3: Verify History Persistence

1. Run allocation with Test 1 data
2. Close the browser tab entirely
3. Reopen `http://localhost:3000/history.html`
4. **Expected:** The run still appears — data is persisted in `eras.db`

---

### Test 4: CSV Export

1. Run allocation 3+ times
2. Go to History page
3. Click **Export CSV**
4. **Expected:** Browser downloads `eras-history.csv` with one row per run

---

### Test 5: Edit Region

1. Add any region to the dashboard
2. Click the ✏️ pencil icon
3. Change the severity to `10`, click Save
4. **Expected:** Region updates instantly in the sidebar with new severity badge

---

## 🏗 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js + Express | REST API server |
| **Database** | SQLite3 | Persistent storage for regions and history |
| **Frontend** | Vanilla HTML/CSS/JS | All 6 pages |
| **Charts** | Chart.js | Bar, line, and donut charts |
| **Icons** | Lucide Icons | Navigation and UI icons |
| **Fonts** | Google Fonts (Outfit, DM Sans, DM Mono) | Typography |

---

## 🗄 Database Schema

```sql
-- Active regions entered by the user
CREATE TABLE Regions (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL,
    population INTEGER  NOT NULL,
    severity   INTEGER  NOT NULL CHECK(severity BETWEEN 1 AND 10),
    resource   INTEGER  NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Every allocation run — persisted for History and Analytics
CREATE TABLE AllocationHistory (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    capacity          INTEGER  NOT NULL,
    regions_count     INTEGER  NOT NULL,
    greedy_impact     REAL     NOT NULL,
    knapsack_impact   REAL     NOT NULL,
    greedy_selected   TEXT     NOT NULL,  -- JSON array of zone names
    knapsack_selected TEXT     NOT NULL,  -- JSON array of zone names
    resources_used_g  INTEGER  NOT NULL DEFAULT 0,
    resources_used_k  INTEGER  NOT NULL DEFAULT 0,
    timestamp         DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## ❓ Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Cannot GET /home.html` | Server not running | Run `node server.js` first |
| Page loads but API calls fail | Opening file directly | Use `http://localhost:3000`, not the file path |
| `Error: Cannot find module 'express'` | Dependencies not installed | Run `npm install` |
| Port 3000 already in use | Another process using it | Kill it: `npx kill-port 3000` or change PORT in `server.js` |
| Charts don't appear on Analytics | No runs yet | Run at least one allocation from Dashboard |
| `eras.db` not found | First run — normal | It's auto-created when the server starts |
| Regions disappear on refresh | Normal behaviour | Region data is stored in the DB — it persists as long as you didn't Reset All |

---

## 📄 License

ISC — free to use, modify, and distribute.

---

<div align="center">
  <strong>ERAS v2.0</strong> — Built with Node.js · Express · SQLite · Chart.js
</div>
