const express = require("express");
const cors    = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path    = require("path");

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
// ✅ Serves from your existing "public" folder
app.use(express.static(path.join(__dirname, "public")));

// ── DATABASE ──────────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, "eras.db"), (err) => {
    if (err) console.error("DB error:", err.message);
    else     console.log("✅  SQLite connected → eras.db");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Regions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        population INTEGER NOT NULL,
        severity   INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 10),
        resource   INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS AllocationHistory (
        id                INTEGER  PRIMARY KEY AUTOINCREMENT,
        capacity          INTEGER  NOT NULL,
        regions_count     INTEGER  NOT NULL,
        greedy_impact     REAL     NOT NULL,
        knapsack_impact   REAL     NOT NULL,
        greedy_selected   TEXT     NOT NULL,
        knapsack_selected TEXT     NOT NULL,
        resources_used_g  INTEGER  NOT NULL DEFAULT 0,
        resources_used_k  INTEGER  NOT NULL DEFAULT 0,
        timestamp         DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ── HELPERS ───────────────────────────────────────────────────
const calcImpact = (population, severity) => (population * severity) / 1000;

function runGreedy(regions, capacity) {
    const sorted = [...regions].sort(
        (a, b) => (b.impact / b.resource) - (a.impact / a.resource)
    );
    let rem = capacity, impact = 0, selected = [], usedRes = 0;
    for (const r of sorted) {
        if (r.resource <= rem) {
            rem      -= r.resource;
            impact   += r.impact;
            usedRes  += r.resource;
            selected.push(r.name);
        }
    }
    return { impact, selected, usedRes };
}

function runKnapsack(regions, capacity) {
    const n  = regions.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let w = 0; w <= capacity; w++) {
            dp[i][w] = regions[i-1].resource <= w
                ? Math.max(dp[i-1][w], dp[i-1][w - regions[i-1].resource] + regions[i-1].impact)
                : dp[i-1][w];
        }
    }

    let w = capacity, selected = [], usedRes = 0;
    for (let i = n; i > 0 && w > 0; i--) {
        if (dp[i][w] !== dp[i-1][w]) {
            selected.push(regions[i-1].name);
            usedRes += regions[i-1].resource;
            w       -= regions[i-1].resource;
        }
    }
    return { impact: dp[n][capacity], selected, usedRes };
}

// ── REGIONS API ───────────────────────────────────────────────

app.get("/api/regions", (req, res) => {
    db.all("SELECT * FROM Regions ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post("/api/regions", (req, res) => {
    const { name, population, severity, resource } = req.body;
    if (!name?.trim() || !population || !severity || !resource)
        return res.status(400).json({ error: "All fields are required." });
    if (severity < 1 || severity > 10)
        return res.status(400).json({ error: "Severity must be 1–10." });

    db.run(
        "INSERT INTO Regions (name, population, severity, resource) VALUES (?, ?, ?, ?)",
        [name.trim(), +population, +severity, +resource],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get("SELECT * FROM Regions WHERE id=?", [this.lastID], (e, row) => res.json(row));
        }
    );
});

app.put("/api/regions/:id", (req, res) => {
    const { name, population, severity, resource } = req.body;
    db.run(
        "UPDATE Regions SET name=?, population=?, severity=?, resource=? WHERE id=?",
        [name, +population, +severity, +resource, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (!this.changes) return res.status(404).json({ error: "Region not found." });
            res.json({ success: true });
        }
    );
});

app.delete("/api/regions/:id", (req, res) => {
    db.run("DELETE FROM Regions WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete("/api/regions", (req, res) => {
    db.run("DELETE FROM Regions", [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// ── ALLOCATION API ────────────────────────────────────────────

app.post("/api/allocate", (req, res) => {
    const capacity = parseInt(req.body.capacity);
    if (!capacity || capacity <= 0)
        return res.status(400).json({ error: "Valid resource capacity required." });

    db.all("SELECT * FROM Regions", [], (err, rows) => {
        if (err)          return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(400).json({ error: "Add at least one region first." });

        const regions = rows.map(r => ({ ...r, impact: calcImpact(r.population, r.severity) }));

        const greedy   = runGreedy(regions, capacity);
        const knapsack = runKnapsack(regions, capacity);

        db.run(
            `INSERT INTO AllocationHistory
             (capacity, regions_count, greedy_impact, knapsack_impact,
              greedy_selected, knapsack_selected, resources_used_g, resources_used_k)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [capacity, rows.length,
             greedy.impact, knapsack.impact,
             JSON.stringify(greedy.selected), JSON.stringify(knapsack.selected),
             greedy.usedRes, knapsack.usedRes]
        );

        res.json({
            greedy:   { totalImpact: greedy.impact,   selected: greedy.selected,   usedResources: greedy.usedRes },
            knapsack: { totalImpact: knapsack.impact,  selected: knapsack.selected, usedResources: knapsack.usedRes },
            capacity,
            regions
        });
    });
});

// ── HISTORY API ───────────────────────────────────────────────

app.get("/api/history", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    db.all(
        "SELECT * FROM AllocationHistory ORDER BY timestamp DESC LIMIT ?",
        [limit],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const parsed = rows.map(r => ({
                ...r,
                greedy_selected:   JSON.parse(r.greedy_selected),
                knapsack_selected: JSON.parse(r.knapsack_selected),
                improvement:       r.knapsack_impact - r.greedy_impact,
                winner: r.knapsack_impact > r.greedy_impact ? "knapsack"
                      : r.greedy_impact   > r.knapsack_impact ? "greedy"
                      : "tie"
            }));
            res.json(parsed);
        }
    );
});

app.delete("/api/history", (req, res) => {
    db.run("DELETE FROM AllocationHistory", [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// ── STATS API ─────────────────────────────────────────────────

app.get("/api/stats", (req, res) => {
    db.get(`
        SELECT
            COUNT(*)                                                          AS total_runs,
            COALESCE(AVG(knapsack_impact - greedy_impact), 0)                 AS avg_improvement,
            COALESCE(MAX(knapsack_impact), 0)                                 AS max_impact,
            COALESCE(AVG(knapsack_impact), 0)                                 AS avg_knapsack_impact,
            SUM(CASE WHEN knapsack_impact > greedy_impact THEN 1 ELSE 0 END)  AS knapsack_wins,
            SUM(CASE WHEN greedy_impact > knapsack_impact THEN 1 ELSE 0 END)  AS greedy_wins,
            SUM(CASE WHEN greedy_impact = knapsack_impact  THEN 1 ELSE 0 END) AS ties
        FROM AllocationHistory
    `, [], (err, history) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get("SELECT COUNT(*) AS count, COALESCE(SUM(population),0) AS total_pop FROM Regions", [], (err, regions) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...history, total_regions: regions.count, total_population: regions.total_pop });
        });
    });
});

// ── CSV EXPORT ────────────────────────────────────────────────

app.get("/api/history/export", (req, res) => {
    db.all("SELECT * FROM AllocationHistory ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const header = "ID,Timestamp,Capacity,Regions,Greedy Impact,Knapsack Impact,Improvement,Winner,Greedy Selected,Knapsack Selected\n";
        const lines  = rows.map(r => {
            const imp = (r.knapsack_impact - r.greedy_impact).toFixed(2);
            const win = r.knapsack_impact > r.greedy_impact ? "Knapsack" : r.greedy_impact > r.knapsack_impact ? "Greedy" : "Tie";
            return `${r.id},"${r.timestamp}",${r.capacity},${r.regions_count},${r.greedy_impact.toFixed(2)},${r.knapsack_impact.toFixed(2)},${imp},${win},"${r.greedy_selected}","${r.knapsack_selected}"`;
        }).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=eras-history.csv");
        res.send(header + lines);
    });
});

// ── HOME REDIRECT ─────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/home.html"));

app.listen(PORT, () => {
    console.log(`\n🚨  ERAS v2 running →  http://localhost:${PORT}`);
    console.log(`\n   Open: http://localhost:${PORT}/home.html\n`);
}); 
