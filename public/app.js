/* ============================================================
   ERAS v2 – app.js
   Handles: Dashboard, History, Analytics, Scenarios pages
   ============================================================ */

// ── CHART INSTANCES ───────────────────────────────────────────
let impactChartInst, winRateChartInst, historyLineChartInst, regionsChartInst;

// ── CHART DEFAULTS ────────────────────────────────────────────
const CHART_DEFAULTS = {
    font:        { family: "'DM Sans', sans-serif" },
    color:       '#64748b',
    borderColor: '#e2e8f0',
    tickColor:   '#94a3b8'
};

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'default') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warn: '⚠️', default: 'ℹ️' };
    t.innerHTML = `<span>${icons[type] || icons.default}</span> ${msg}`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ── API HELPERS ───────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────

async function addRegion() {
    const name       = document.getElementById('name')?.value.trim();
    const population = parseInt(document.getElementById('population')?.value);
    const severity   = parseInt(document.getElementById('severity')?.value);
    const resource   = parseInt(document.getElementById('resource')?.value);

    const alertEl = document.getElementById('addAlert');
    const msgEl   = document.getElementById('addAlertMsg');

    if (!name || isNaN(population) || isNaN(severity) || isNaN(resource)) {
        msgEl.textContent = 'Please fill in all fields with valid values.';
        alertEl.style.display = 'flex';
        return;
    }
    if (severity < 1 || severity > 10) {
        msgEl.textContent = 'Severity must be between 1 and 10.';
        alertEl.style.display = 'flex';
        return;
    }

    alertEl.style.display = 'none';

    try {
        await api('POST', '/api/regions', { name, population, severity, resource });
        ['name','population','severity','resource'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        loadRegions();
        toast('Region added successfully', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function loadRegions() {
    const container = document.getElementById('regionList');
    if (!container) return;

    try {
        const data = await api('GET', '/api/regions');

        const countEl = document.getElementById('regionCount');
        if (countEl) countEl.textContent = `${data.length} region${data.length !== 1 ? 's' : ''}`;

        const kRegions = document.getElementById('k-regions');
        if (kRegions) kRegions.textContent = data.length;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:30px 10px;">
                    <span class="empty-icon" style="font-size:32px;">📍</span>
                    <p style="font-size:13px;">No regions yet.<br>Add one above or <a href="scenarios.html" style="color:var(--red);">load a scenario</a>.</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        data.forEach(region => {
            const impact = ((region.population * region.severity) / 1000).toFixed(1);
            const sev    = region.severity;
            const sevClass = `sev-${sev}`;
            const barColors = ['','#16a34a','#16a34a','#16a34a','#d97706','#d97706','#d97706','#ea580c','#ea580c','#dc2626','#dc2626'];

            const div = document.createElement('div');
            div.className = 'region-item';
            div.innerHTML = `
                <div class="region-sev-bar" style="background:${barColors[sev]||'#dc2626'}"></div>
                <div class="region-info">
                    <div class="region-name">${region.name}</div>
                    <div class="region-meta">
                        <span class="meta-item">Pop: <span>${region.population.toLocaleString()}</span></span>
                        <span class="meta-item">Res: <span>${region.resource}</span></span>
                        <span class="meta-item">Impact: <span>${impact}</span></span>
                    </div>
                </div>
                <span class="badge ${sevClass}" style="flex-shrink:0;">SEV ${sev}</span>
                <div class="region-actions">
                    <button class="btn-icon edit" onclick="openEdit(${region.id},'${escStr(region.name)}',${region.population},${region.severity},${region.resource})" title="Edit">✏️</button>
                    <button class="btn-icon del" onclick="deleteRegion(${region.id})" title="Delete">×</button>
                </div>
            `;
            container.appendChild(div);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<div class="alert alert-error">⚠ Cannot connect to server. Is it running on port 3000?</div>`;
    }
}

function escStr(s) { return s.replace(/'/g, "\\'"); }

async function deleteRegion(id) {
    try {
        await api('DELETE', `/api/regions/${id}`);
        loadRegions();
        toast('Region removed', 'default');
    } catch (e) {
        toast(e.message, 'error');
    }
}

function openEdit(id, name, population, severity, resource) {
    document.getElementById('editId').value       = id;
    document.getElementById('editName').value     = name;
    document.getElementById('editPopulation').value = population;
    document.getElementById('editSeverity').value = severity;
    document.getElementById('editResource').value = resource;
    document.getElementById('editModal').style.display = 'grid';
}

function closeModal(e) {
    if (!e || e.target.classList.contains('modal-backdrop')) {
        document.getElementById('editModal').style.display = 'none';
    }
}

async function saveEdit() {
    const id         = document.getElementById('editId').value;
    const name       = document.getElementById('editName').value.trim();
    const population = parseInt(document.getElementById('editPopulation').value);
    const severity   = parseInt(document.getElementById('editSeverity').value);
    const resource   = parseInt(document.getElementById('editResource').value);

    if (!name || isNaN(population) || isNaN(severity) || isNaN(resource)) {
        toast('Please fill all fields', 'warn'); return;
    }

    try {
        await api('PUT', `/api/regions/${id}`, { name, population, severity, resource });
        closeModal();
        loadRegions();
        toast('Region updated', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function runAllocation() {
    const capacity = parseInt(document.getElementById('totalResource')?.value);
    if (!capacity || capacity <= 0) {
        toast('Enter a valid resource budget first', 'warn'); return;
    }

    const runBtn = document.getElementById('runBtn');
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Running…'; }

    try {
        const data = await api('POST', '/api/allocate', { capacity });
        displayResults(data);
        toast('Allocation complete!', 'success');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        if (runBtn) { runBtn.disabled = false; runBtn.innerHTML = '⚡ Run Allocation'; }
    }
}

function displayResults(data) {
    const { greedy, knapsack, capacity, regions } = data;

    // KPIs
    setHTML('k-greedy',      greedy.totalImpact.toFixed(1));
    setHTML('k-knapsack',    knapsack.totalImpact.toFixed(1));
    const imp = knapsack.totalImpact - greedy.totalImpact;
    setHTML('k-improvement', imp > 0 ? `+${imp.toFixed(1)}` : imp.toFixed(1));

    // Impact numbers
    setHTML('greedyImpact',   `${greedy.totalImpact.toFixed(2)}<sub style="font-size:14px;color:var(--text-3);"> pts</sub>`);
    setHTML('knapsackImpact', `${knapsack.totalImpact.toFixed(2)}<sub style="font-size:14px;color:var(--text-3);"> pts</sub>`);

    // Chips
    renderChips('greedyChips',   greedy.selected);
    renderChips('knapsackChips', knapsack.selected);

    // Winner box
    const gBox = document.getElementById('greedyBox');
    const kBox = document.getElementById('knapsackBox');
    const badge = document.getElementById('resultBadge');
    const verdict = document.getElementById('verdict');
    const verdictText = document.getElementById('verdictText');

    [gBox, kBox].forEach(b => { if(b) { b.classList.remove('winner'); const t = b.querySelector('.winner-tag'); if(t) t.remove(); } });

    if (imp > 0) {
        kBox?.classList.add('winner');
        const tag = document.createElement('div');
        tag.className = 'winner-tag'; tag.textContent = 'OPTIMAL';
        kBox?.appendChild(tag);
        badge.className = 'badge badge-green'; badge.textContent = `Knapsack wins by +${imp.toFixed(2)} pts`;
        verdict.className = 'alert alert-success'; verdict.style.display = 'flex';
        verdictText.textContent = `✅ Knapsack outperforms Greedy by ${imp.toFixed(2)} impact points (${((imp / greedy.totalImpact) * 100).toFixed(1)}% improvement). More combinations were evaluated to find the globally optimal allocation.`;
    } else if (imp < 0) {
        gBox?.classList.add('winner');
        const tag = document.createElement('div');
        tag.className = 'winner-tag'; tag.textContent = 'WINNER';
        gBox?.appendChild(tag);
        badge.className = 'badge badge-amber'; badge.textContent = 'Greedy wins';
        verdict.className = 'alert alert-warn'; verdict.style.display = 'flex';
        verdictText.textContent = `⚡ Greedy outperforms Knapsack in this configuration. This is unusual — typically occurs with very tight resource budgets.`;
    } else {
        badge.className = 'badge badge-gray'; badge.textContent = 'Tied — both optimal';
        verdict.className = 'alert alert-info'; verdict.style.display = 'flex';
        verdictText.textContent = `🤝 Both algorithms produced identical results. Greedy found the globally optimal solution in this case — no improvement possible.`;
    }

    // Resource utilization bars
    ['greedy','knapsack'].forEach(algo => {
        const wrap = document.getElementById(`${algo}Res`);
        const bar  = document.getElementById(`${algo}ResBar`);
        const lbl  = document.getElementById(`${algo}ResLabel`);
        const used = data[algo].usedResources;
        if (wrap) wrap.style.display = 'block';
        if (bar)  { bar.style.width = `${Math.round((used/capacity)*100)}%`; }
        if (lbl)  lbl.textContent = `${used} / ${capacity} units`;
    });

    // Budget meter
    const maxUsed = Math.max(greedy.usedResources, knapsack.usedResources);
    const bMeter = document.getElementById('budgetMeter');
    const bBar   = document.getElementById('budgetBar');
    const bLbl   = document.getElementById('budgetUsedLabel');
    if (bMeter) bMeter.style.display = 'block';
    if (bBar)   bBar.style.width = `${Math.round((maxUsed/capacity)*100)}%`;
    if (bLbl)   bLbl.textContent = `${maxUsed} / ${capacity}`;

    // Region details table
    if (regions) buildRegionTable(regions, greedy.selected, knapsack.selected);

    // Impact comparison chart
    if (impactChartInst) impactChartInst.destroy();
    const ctx = document.getElementById('impactChart');
    if (ctx) {
        impactChartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Greedy Algorithm', '0/1 Knapsack DP'],
                datasets: [{
                    label: 'Impact Score',
                    data: [greedy.totalImpact, knapsack.totalImpact],
                    backgroundColor: ['rgba(234,88,12,.15)', 'rgba(22,163,74,.15)'],
                    borderColor:     ['#ea580c', '#16a34a'],
                    borderWidth: 2,
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { family: "'DM Sans'" },
                        bodyFont:  { family: "'DM Sans'" },
                        callbacks: { label: ctx => ` Impact: ${ctx.parsed.y.toFixed(2)} pts` }
                    }
                },
                scales: {
                    x: { ticks: { color: '#64748b', font: { family: "'DM Sans'" } }, grid: { color: '#f1f5f9' } },
                    y: { beginAtZero: true, ticks: { color: '#64748b', font: { family: "'DM Sans'" } }, grid: { color: '#f1f5f9' } }
                }
            }
        });
    }
}

function buildRegionTable(regions, greedySel, knapsackSel) {
    const card = document.getElementById('regionTableCard');
    const tbody = document.getElementById('regionTableBody');
    if (!card || !tbody) return;

    card.style.display = 'block';
    tbody.innerHTML = '';

    regions.forEach(r => {
        const impact = r.impact.toFixed(2);
        const eff    = (r.impact / r.resource).toFixed(3);
        const inG    = greedySel.includes(r.name);
        const inK    = knapsackSel.includes(r.name);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.name}</strong></td>
            <td class="td-mono">${r.population.toLocaleString()}</td>
            <td><span class="badge sev-${r.severity}">SEV ${r.severity}</span></td>
            <td class="td-mono">${r.resource}</td>
            <td class="td-mono">${impact}</td>
            <td class="td-mono">${eff}</td>
            <td>${inG ? '<span class="badge badge-orange">✓ Selected</span>' : '<span class="badge badge-gray">Skipped</span>'}</td>
            <td>${inK ? '<span class="badge badge-green">✓ Selected</span>' : '<span class="badge badge-gray">Skipped</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChips(containerId, names) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!names?.length) {
        el.innerHTML = '<span style="font-size:12px;color:var(--text-4);">No regions selected</span>';
        return;
    }
    el.innerHTML = names.map(n => `<span class="chip">${n}</span>`).join('');
}

async function resetAll() {
    if (!confirm('Clear all regions and results?')) return;
    try {
        await api('DELETE', '/api/regions');
        loadRegions();

        ['k-greedy','k-knapsack','k-improvement'].forEach(id => setHTML(id, '—'));

        setHTML('greedyImpact', '—');
        setHTML('knapsackImpact', '—');
        setHTML('greedyChips', '<span style="font-size:12px;color:var(--text-4);">Run allocation to see</span>');
        setHTML('knapsackChips', '<span style="font-size:12px;color:var(--text-4);">Run allocation to see</span>');

        const verdict = document.getElementById('verdict');
        if (verdict) verdict.style.display = 'none';

        const badge = document.getElementById('resultBadge');
        if (badge) { badge.className = 'badge badge-gray'; badge.textContent = 'Waiting for run'; }

        const regionTableCard = document.getElementById('regionTableCard');
        if (regionTableCard) regionTableCard.style.display = 'none';

        if (impactChartInst) { impactChartInst.destroy(); impactChartInst = null; }
        toast('All data cleared', 'default');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ──────────────────────────────────────────────────────────────
// HISTORY PAGE
// ──────────────────────────────────────────────────────────────

async function loadHistory() {
    const container = document.getElementById('historyBody');
    if (!container) return;

    try {
        const data = await api('GET', '/api/history');

        const countEl = document.getElementById('runCount');
        if (countEl) countEl.textContent = `${data.length} entries`;

        if (!data.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🕐</span>
                    <h3>No allocations yet</h3>
                    <p>Run an allocation from the <a href="dashboard.html" style="color:var(--red);">Dashboard</a> to see your history here.</p>
                </div>`;
            return;
        }

        const table = document.createElement('div');
        table.className = 'table-wrap';
        table.style.cssText = 'border:none;border-radius:0;';
        table.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Timestamp</th>
                        <th>Capacity</th>
                        <th>Regions</th>
                        <th>Greedy Impact</th>
                        <th>Knapsack Impact</th>
                        <th>Improvement</th>
                        <th>Winner</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="historyTableBody"></tbody>
            </table>`;
        container.innerHTML = '';
        container.appendChild(table);

        const tbody = document.getElementById('historyTableBody');
        data.forEach((run, idx) => {
            const imp = run.improvement;
            const winBadge = run.winner === 'knapsack'
                ? '<span class="badge badge-green">🔬 Knapsack</span>'
                : run.winner === 'greedy'
                ? '<span class="badge badge-orange">⚡ Greedy</span>'
                : '<span class="badge badge-gray">Tie</span>';

            const impBadge = imp > 0
                ? `<span class="badge badge-green">+${imp.toFixed(2)}</span>`
                : imp < 0
                ? `<span class="badge badge-red">${imp.toFixed(2)}</span>`
                : `<span class="badge badge-gray">0</span>`;

            const dt = new Date(run.timestamp).toLocaleString();

            // Main row
            const tr = document.createElement('tr');
            tr.id = `run-${run.id}`;
            tr.innerHTML = `
                <td class="td-mono" style="color:var(--text-3);">${data.length - idx}</td>
                <td style="font-size:12px;color:var(--text-3);">${dt}</td>
                <td class="td-mono">${run.capacity}</td>
                <td class="td-mono">${run.regions_count}</td>
                <td class="td-mono">${run.greedy_impact.toFixed(2)}</td>
                <td class="td-mono">${run.knapsack_impact.toFixed(2)}</td>
                <td>${impBadge}</td>
                <td>${winBadge}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="toggleRunDetail(${run.id})">Details</button></td>
            `;
            tbody.appendChild(tr);

            // Detail row
            const trDetail = document.createElement('tr');
            trDetail.id = `run-detail-${run.id}`;
            trDetail.style.display = 'none';
            trDetail.innerHTML = `
                <td colspan="9" style="background:var(--surface-alt);padding:16px 20px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;">
                        <div>
                            <strong style="color:var(--orange);">⚡ Greedy Selected:</strong>
                            <div class="regions-chips" style="margin-top:8px;">
                                ${run.greedy_selected.map(n => `<span class="chip">${n}</span>`).join('') || '<em style="color:var(--text-4)">None selected</em>'}
                            </div>
                        </div>
                        <div>
                            <strong style="color:var(--green);">🔬 Knapsack Selected:</strong>
                            <div class="regions-chips" style="margin-top:8px;">
                                ${run.knapsack_selected.map(n => `<span class="chip">${n}</span>`).join('') || '<em style="color:var(--text-4)">None selected</em>'}
                            </div>
                        </div>
                    </div>
                </td>`;
            tbody.appendChild(trDetail);
        });

    } catch (e) {
        container.innerHTML = `<div class="alert alert-error" style="margin:20px;">⚠ Cannot connect to server.</div>`;
    }
}

function toggleRunDetail(id) {
    const el = document.getElementById(`run-detail-${id}`);
    if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
}

async function loadHistoryKpis() {
    try {
        const stats = await api('GET', '/api/stats');
        setHTML('h-total', stats.total_runs || '0');
        setHTML('h-knapsack-wins', stats.knapsack_wins || '0');
        setHTML('h-greedy-wins', stats.greedy_wins || '0');
        setHTML('h-avg-improvement', stats.total_runs > 0 ? stats.avg_improvement.toFixed(2) : '—');
    } catch(e) {}
}

async function clearHistory() {
    if (!confirm('Delete all allocation history?')) return;
    try {
        await api('DELETE', '/api/history');
        loadHistory();
        loadHistoryKpis();
        toast('History cleared', 'default');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ──────────────────────────────────────────────────────────────
// ANALYTICS PAGE
// ──────────────────────────────────────────────────────────────

async function loadAnalytics() {
    try {
        const [stats, history, regions] = await Promise.all([
            api('GET', '/api/stats'),
            api('GET', '/api/history?limit=15'),
            api('GET', '/api/regions')
        ]);

        // KPIs
        setHTML('a-runs',       stats.total_runs || '0');
        setHTML('a-avg-impact', stats.total_runs > 0 ? stats.avg_knapsack_impact.toFixed(1) : '—');
        const wr = stats.total_runs > 0 ? Math.round((stats.knapsack_wins / stats.total_runs) * 100) : null;
        setHTML('a-win-rate',   wr !== null ? `${wr}%` : '—');
        setHTML('a-regions',    regions.length);

        const noData = document.getElementById('noDataNotice');
        if (stats.total_runs === 0) {
            if (noData) noData.style.display = 'flex';
        } else {
            if (noData) noData.style.display = 'none';
            buildWinRateChart(stats);
            buildImpactHistoryChart(history);
        }

        if (regions.length) buildRegionsChart(regions);

    } catch (e) {
        toast('Failed to load analytics. Is the server running?', 'error');
    }
}

function buildWinRateChart(stats) {
    const ctx = document.getElementById('winRateChart');
    if (!ctx) return;
    if (winRateChartInst) winRateChartInst.destroy();

    const kw = stats.knapsack_wins || 0;
    const gw = stats.greedy_wins  || 0;
    const t  = stats.ties         || 0;

    winRateChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Knapsack Wins', 'Greedy Wins', 'Ties'],
            datasets: [{
                data: [kw, gw, t],
                backgroundColor: ['rgba(22,163,74,.8)', 'rgba(234,88,12,.8)', 'rgba(148,163,184,.5)'],
                borderColor:     ['#16a34a', '#ea580c', '#94a3b8'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: "'DM Sans'" }, color: '#64748b', padding: 14, boxWidth: 12 } },
                tooltip: {
                    backgroundColor: '#0f172a',
                    bodyFont: { family: "'DM Sans'" },
                    callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} runs` }
                }
            }
        }
    });

    // Legend
    const legend = document.getElementById('winRateLegend');
    if (legend) {
        const total = kw + gw + t || 1;
        legend.innerHTML = `
            <span style="color:var(--green);">🔬 Knapsack: ${Math.round(kw/total*100)}%</span>
            <span style="color:var(--orange);">⚡ Greedy: ${Math.round(gw/total*100)}%</span>
            <span style="color:var(--text-3);">🤝 Tie: ${Math.round(t/total*100)}%</span>
        `;
    }
}

function buildImpactHistoryChart(history) {
    const ctx = document.getElementById('impactHistoryChart');
    if (!ctx || !history.length) return;
    if (historyLineChartInst) historyLineChartInst.destroy();

    const reversed = [...history].reverse();
    const labels   = reversed.map((_, i) => `Run ${i + 1}`);

    historyLineChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Greedy',
                    data: reversed.map(r => r.greedy_impact),
                    borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,.07)',
                    borderWidth: 2, pointRadius: 4, fill: true, tension: .3
                },
                {
                    label: 'Knapsack',
                    data: reversed.map(r => r.knapsack_impact),
                    borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.07)',
                    borderWidth: 2, pointRadius: 4, fill: true, tension: .3
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { font: { family: "'DM Sans'" }, color: '#64748b', boxWidth: 12 } },
                tooltip: { backgroundColor: '#0f172a', bodyFont: { family: "'DM Sans'" } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { family: "'DM Sans'", size: 11 } }, grid: { color: '#f1f5f9' } },
                y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: "'DM Sans'" } }, grid: { color: '#f1f5f9' } }
            }
        }
    });
}

function buildRegionsChart(regions) {
    const ctx = document.getElementById('regionsChart');
    if (!ctx || !regions.length) return;
    if (regionsChartInst) regionsChartInst.destroy();

    const names   = regions.map(r => r.name);
    const impacts = regions.map(r => ((r.population * r.severity) / 1000));
    const res     = regions.map(r => r.resource);

    regionsChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [
                {
                    label: 'Impact Score',
                    data: impacts,
                    backgroundColor: 'rgba(220,38,38,.12)',
                    borderColor: '#dc2626',
                    borderWidth: 2, borderRadius: 6, yAxisID: 'y'
                },
                {
                    label: 'Resources Required',
                    data: res,
                    backgroundColor: 'rgba(8,145,178,.12)',
                    borderColor: '#0891b2',
                    borderWidth: 2, borderRadius: 6, yAxisID: 'y2'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { family: "'DM Sans'" }, color: '#64748b', boxWidth: 12 } },
                tooltip: { backgroundColor: '#0f172a', bodyFont: { family: "'DM Sans'" } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { family: "'DM Sans'" } }, grid: { display: false } },
                y:  { beginAtZero: true, position: 'left',  ticks: { color: '#dc2626', font: { family: "'DM Sans'", size: 11 } }, grid: { color: '#f1f5f9' } },
                y2: { beginAtZero: true, position: 'right', ticks: { color: '#0891b2', font: { family: "'DM Sans'", size: 11 } }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// ──────────────────────────────────────────────────────────────
// SCENARIOS
// ──────────────────────────────────────────────────────────────

const SCENARIOS = {
    earthquake: {
        regions: [
            { name: 'Zone Alpha',   population: 8000, severity: 9, resource: 40 },
            { name: 'Zone Bravo',   population: 5000, severity: 7, resource: 30 },
            { name: 'Zone Charlie', population: 3000, severity: 6, resource: 20 }
        ],
        capacity: 60
    },
    flood: {
        regions: [
            { name: 'Village North', population: 4000, severity: 8, resource: 25 },
            { name: 'Village South', population: 3500, severity: 6, resource: 20 },
            { name: 'Village East',  population: 2000, severity: 5, resource: 15 }
        ],
        capacity: 40
    },
    wildfire: {
        regions: [
            { name: 'Sector X', population: 6000, severity: 8, resource: 35 },
            { name: 'Sector Y', population: 4500, severity: 7, resource: 25 },
            { name: 'Sector Z', population: 2500, severity: 5, resource: 15 }
        ],
        capacity: 50
    }
};

async function loadScenario(type) {
    const scenario = SCENARIOS[type];
    if (!scenario) return;

    try {
        // Clear existing
        await api('DELETE', '/api/regions');

        // Add all regions
        for (const r of scenario.regions) {
            await api('POST', '/api/regions', r);
        }

        // Store capacity suggestion
        localStorage.setItem('erasCapacity', scenario.capacity);

        toast(`${type.charAt(0).toUpperCase() + type.slice(1)} scenario loaded!`, 'success');
        window.location.href = 'dashboard.html';
    } catch (e) {
        toast('Could not load scenario. Is the server running?', 'error');
    }
}

// ──────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ── AUTO-INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // Dashboard init
    if (document.getElementById('regionList')) {
        loadRegions();

        // Restore capacity from scenario load
        const cap = localStorage.getItem('erasCapacity');
        if (cap) {
            const capEl = document.getElementById('totalResource');
            if (capEl) capEl.value = cap;
            localStorage.removeItem('erasCapacity');
        }

        // Enter key submits add region form
        ['name','population','severity','resource'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') addRegion(); });
        });
    }

    // Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
});