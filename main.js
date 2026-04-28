/* ============================================================
   PrintProfit — main.js
   ============================================================ */

"use strict";

// ── STATE ────────────────────────────────────────────────────
const STATE = {
  library: [],
  sales:   [],
  goals:   { revenue: 0, profit: 0, units: 0 },
  lastCalc: null,   // most recent calculation result
};

// ── PERSISTENCE ──────────────────────────────────────────────
function save() {
  localStorage.setItem("pp_library", JSON.stringify(STATE.library));
  localStorage.setItem("pp_sales",   JSON.stringify(STATE.sales));
  localStorage.setItem("pp_goals",   JSON.stringify(STATE.goals));
}
function load() {
  try {
    STATE.library = JSON.parse(localStorage.getItem("pp_library") || "[]");
    STATE.sales   = JSON.parse(localStorage.getItem("pp_sales")   || "[]");
    STATE.goals   = JSON.parse(localStorage.getItem("pp_goals")   || "{}");
    STATE.goals.revenue ??= 0;
    STATE.goals.profit  ??= 0;
    STATE.goals.units   ??= 0;
  } catch (e) {
    console.warn("Load error", e);
  }
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = "default") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

// ── TABS ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "dashboard") renderDashboard();
    });
  });
}

// ── RANGE LABELS ─────────────────────────────────────────────
function initRanges() {
  const failureRange = document.getElementById("failureRate");
  const failureLabel = document.getElementById("failureLabel");
  failureRange.addEventListener("input", () => failureLabel.textContent = failureRange.value + "%");

  const marginRange = document.getElementById("profitMargin");
  const marginLabel = document.getElementById("marginLabel");
  marginRange.addEventListener("input", () => marginLabel.textContent = marginRange.value + "%");
}

// ── CALCULATOR ───────────────────────────────────────────────
function calcPrice() {
  const filamentG     = parseFloat(document.getElementById("filamentGrams").value)     || 0;
  const filamentPerKg = parseFloat(document.getElementById("filamentCostPerKg").value) || 0;
  const hours         = parseFloat(document.getElementById("printHours").value)        || 0;
  const kwh           = parseFloat(document.getElementById("electricityRate").value)   || 0;
  const watts         = parseFloat(document.getElementById("printerWatts").value)      || 0;
  const postHours     = parseFloat(document.getElementById("postTime").value)          || 0;
  const laborRate     = parseFloat(document.getElementById("laborRate").value)         || 0;
  const otherCosts    = parseFloat(document.getElementById("otherCosts").value)        || 0;
  const failurePct    = parseFloat(document.getElementById("failureRate").value)       / 100;
  const marginPct     = parseFloat(document.getElementById("profitMargin").value)      / 100;
  const platformFee   = parseFloat(document.getElementById("platformFee").value)       / 100 || 0;

  const bFilament    = (filamentG / 1000) * filamentPerKg;
  const bElectricity = (watts / 1000) * hours * kwh;
  const bLabor       = (hours + postHours) * laborRate;
  const baseCost     = bFilament + bElectricity + bLabor + otherCosts;
  const bFailure     = baseCost * failurePct;
  const totalCost    = baseCost + bFailure;
  const bProfit      = totalCost * marginPct;
  const beforeFee    = totalCost + bProfit;
  const bPlatform    = beforeFee * platformFee;
  const recoPrice    = beforeFee + bPlatform;

  const result = {
    bFilament, bElectricity, bLabor, bFailure,
    bOther: otherCosts, totalCost, bProfit, bPlatform, recoPrice,
    name: document.getElementById("printName").value.trim() || "Untitled Print",
  };

  STATE.lastCalc = result;
  renderResult(result);
}

function fmt(n) { return "$" + (n || 0).toFixed(2); }

function renderResult(r) {
  document.getElementById("resultEmpty").classList.add("hidden");
  document.getElementById("resultContent").classList.remove("hidden");

  document.getElementById("recoPrice").textContent    = fmt(r.recoPrice);
  document.getElementById("bFilament").textContent    = fmt(r.bFilament);
  document.getElementById("bElectricity").textContent = fmt(r.bElectricity);
  document.getElementById("bLabor").textContent       = fmt(r.bLabor);
  document.getElementById("bFailure").textContent     = fmt(r.bFailure);
  document.getElementById("bOther").textContent       = fmt(r.bOther);
  document.getElementById("bTotal").textContent       = fmt(r.totalCost);
  document.getElementById("bProfit").textContent      = fmt(r.bProfit);
  document.getElementById("bPlatform").textContent    = fmt(r.bPlatform);

  document.getElementById("tierBudget").textContent   = fmt(r.totalCost);
  document.getElementById("tierStandard").textContent = fmt(r.recoPrice);
  document.getElementById("tierPremium").textContent  = fmt(r.recoPrice * 1.5);
}

function initCalculator() {
  document.getElementById("calcBtn").addEventListener("click", calcPrice);

  document.getElementById("saveToLibraryBtn").addEventListener("click", () => {
    if (!STATE.lastCalc) return;
    STATE.library.unshift({ ...STATE.lastCalc, id: Date.now() });
    save();
    renderLibrary();
    toast("Saved to library!", "success");
  });

  document.getElementById("logSaleBtn").addEventListener("click", () => {
    if (!STATE.lastCalc) return;
    // Pre-fill sales form
    document.getElementById("saleItem").value  = STATE.lastCalc.name;
    document.getElementById("salePrice").value = STATE.lastCalc.recoPrice.toFixed(2);
    document.getElementById("saleCost").value  = STATE.lastCalc.totalCost.toFixed(2);
    // Switch to sales tab
    document.querySelector('[data-tab="sales"]').click();
    toast("Pre-filled from last calculation.", "success");
  });
}

// ── LIBRARY ──────────────────────────────────────────────────
function renderLibrary(filter = "") {
  const grid  = document.getElementById("libraryGrid");
  const empty = document.getElementById("libraryEmpty");
  const items = STATE.library.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));

  if (items.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = items.map(item => `
    <div class="lib-item" data-id="${item.id}">
      <div class="lib-name" title="${item.name}">${item.name}</div>
      <div class="lib-price">${fmt(item.recoPrice)}</div>
      <div class="lib-cost">Cost: ${fmt(item.totalCost)}</div>
      <div class="lib-actions">
        <button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="loadFromLibrary(${item.id})">Load</button>
        <button class="btn-ghost" style="font-size:11px;padding:4px 10px" onclick="deleteLibraryItem(${item.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

function loadFromLibrary(id) {
  const item = STATE.library.find(i => i.id === id);
  if (!item) return;
  document.getElementById("printName").value = item.name;
  STATE.lastCalc = item;
  renderResult(item);
  toast("Loaded: " + item.name);
}

function deleteLibraryItem(id) {
  STATE.library = STATE.library.filter(i => i.id !== id);
  save();
  renderLibrary();
  toast("Removed from library.");
}

function initLibrary() {
  document.getElementById("librarySearch").addEventListener("input", e => {
    renderLibrary(e.target.value);
  });
}

// ── SALES ────────────────────────────────────────────────────
function initSales() {
  // Set today's date as default
  document.getElementById("saleDate").valueAsDate = new Date();

  document.getElementById("logSaleFormBtn").addEventListener("click", addSale);
  document.getElementById("logSaleBtn") // already handled in calculator init
  document.getElementById("salesSearch").addEventListener("input", e => renderSalesTable(e.target.value));
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
}

function addSale() {
  const item     = document.getElementById("saleItem").value.trim();
  const qty      = parseInt(document.getElementById("saleQty").value)   || 1;
  const price    = parseFloat(document.getElementById("salePrice").value) || 0;
  const cost     = parseFloat(document.getElementById("saleCost").value)  || 0;
  const fee      = parseFloat(document.getElementById("saleFee").value)   || 0;
  const date     = document.getElementById("saleDate").value;
  const platform = document.getElementById("salePlatform").value.trim() || "—";
  const notes    = document.getElementById("saleNotes").value.trim();

  if (!item) { toast("Please enter an item name.", "error"); return; }
  if (!date) { toast("Please select a date.", "error"); return; }
  if (price <= 0) { toast("Please enter a valid sale price.", "error"); return; }

  const revenue = price * qty;
  const totalCost = (cost + fee) * qty;
  const profit = revenue - totalCost;

  STATE.sales.unshift({ id: Date.now(), item, qty, price, cost, fee, revenue, profit, date, platform, notes });
  save();
  renderSalesTable();
  updateHeaderRevenue();
  toast(`Sale logged: ${item} — ${fmt(revenue)}`, "success");

  // Clear form (keep defaults)
  document.getElementById("saleItem").value    = "";
  document.getElementById("saleQty").value     = "1";
  document.getElementById("salePrice").value   = "";
  document.getElementById("saleCost").value    = "";
  document.getElementById("saleFee").value     = "";
  document.getElementById("salePlatform").value = "";
  document.getElementById("saleNotes").value   = "";
  document.getElementById("saleDate").valueAsDate = new Date();
}

function renderSalesTable(filter = "") {
  const tbody = document.getElementById("salesBody");
  const empty = document.getElementById("salesEmpty");
  const items = STATE.sales.filter(s =>
    s.item.toLowerCase().includes(filter.toLowerCase()) ||
    s.platform.toLowerCase().includes(filter.toLowerCase())
  );

  if (items.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tbody.innerHTML = items.map(s => `
    <tr>
      <td>${s.date}</td>
      <td>${s.item}${s.notes ? `<br><small style="color:var(--muted)">${s.notes}</small>` : ""}</td>
      <td>${s.qty}</td>
      <td class="money-cell">${fmt(s.price)}</td>
      <td class="money-cell">${fmt(s.cost)}</td>
      <td class="${s.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${fmt(s.profit)}</td>
      <td><span class="platform-badge">${s.platform}</span></td>
      <td><button class="btn-icon" onclick="deleteSale(${s.id})" title="Delete">🗑</button></td>
    </tr>
  `).join("");
}

function deleteSale(id) {
  if (!confirm("Delete this sale?")) return;
  STATE.sales = STATE.sales.filter(s => s.id !== id);
  save();
  renderSalesTable();
  updateHeaderRevenue();
  toast("Sale deleted.");
}

function exportCsv() {
  if (STATE.sales.length === 0) { toast("No sales to export.", "error"); return; }
  const headers = ["Date","Item","Qty","Price Each","Cost Each","Fee Each","Revenue","Profit","Platform","Notes"];
  const rows = STATE.sales.map(s => [
    s.date, s.item, s.qty, s.price.toFixed(2), s.cost.toFixed(2), s.fee.toFixed(2),
    s.revenue.toFixed(2), s.profit.toFixed(2), s.platform, s.notes
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `printprofit_sales_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast("CSV exported!");
}

// ── DASHBOARD ────────────────────────────────────────────────
function updateHeaderRevenue() {
  const total = STATE.sales.reduce((s, x) => s + x.revenue, 0);
  document.getElementById("headerRevenue").textContent = fmt(total);
}

function renderDashboard() {
  const sales = STATE.sales;

  const totalRevenue = sales.reduce((s, x) => s + x.revenue, 0);
  const totalProfit  = sales.reduce((s, x) => s + x.profit,  0);
  const totalUnits   = sales.reduce((s, x) => s + x.qty,     0);
  const avgMargin    = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

  document.getElementById("dRevenue").textContent = fmt(totalRevenue);
  document.getElementById("dProfit").textContent  = fmt(totalProfit);
  document.getElementById("dSales").textContent   = sales.length;
  document.getElementById("dUnits").textContent   = totalUnits;
  document.getElementById("dMargin").textContent  = avgMargin.toFixed(1) + "%";

  // Best seller
  const itemMap = {};
  sales.forEach(s => {
    itemMap[s.item] = (itemMap[s.item] || 0) + s.revenue;
  });
  const best = Object.entries(itemMap).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("dBestItem").textContent = best ? best[0] : "—";

  renderRevenueChart();
  renderTopItems(itemMap);
  renderGoals(totalRevenue, totalProfit, totalUnits);
}

function renderRevenueChart() {
  const canvas = document.getElementById("revenueChart");
  const empty  = document.getElementById("revenueChartEmpty");

  if (STATE.sales.length === 0) {
    canvas.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  canvas.classList.remove("hidden");
  empty.classList.add("hidden");

  // Aggregate by YYYY-MM
  const byMonth = {};
  STATE.sales.forEach(s => {
    const mo = s.date.slice(0, 7);
    byMonth[mo] = (byMonth[mo] || 0) + s.revenue;
  });
  const labels = Object.keys(byMonth).sort();
  const values = labels.map(k => byMonth[k]);

  const ctx = canvas.getContext("2d");
  const W = canvas.parentElement.clientWidth - 56;
  const H = 200;
  canvas.width  = W;
  canvas.height = H;

  const pad = { top: 20, right: 20, bottom: 40, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);
  const barW = Math.min(40, (innerW / labels.length) - 10);

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = "#252a3a";
  ctx.lineWidth = 1;
  [0, .25, .5, .75, 1].forEach(t => {
    const y = pad.top + innerH * (1 - t);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("$" + (maxVal * t).toFixed(0), pad.left - 6, y + 4);
  });

  // Bars
  labels.forEach((label, i) => {
    const x = pad.left + (innerW / labels.length) * i + (innerW / labels.length - barW) / 2;
    const barH = (values[i] / maxVal) * innerH;
    const y = pad.top + innerH - barH;

    // Gradient
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, "#f97316");
    grad.addColorStop(1, "#fb923c44");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    // Month label
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = "center";
    const mo = label.slice(5); // MM
    const yr = label.slice(2, 4);
    ctx.fillText(mo + "/" + yr, x + barW / 2, H - pad.bottom + 16);

    // Value
    ctx.fillStyle = "#e8eaf0";
    ctx.font = "bold 10px 'Space Mono', monospace";
    if (barH > 20) ctx.fillText("$" + values[i].toFixed(0), x + barW / 2, y - 5);
  });
}

function renderTopItems(itemMap) {
  const container = document.getElementById("topItemsChart");
  const empty     = document.getElementById("topItemsEmpty");
  const items     = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  if (items.length === 0) {
    container.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  container.classList.remove("hidden");
  empty.classList.add("hidden");

  const max = items[0][1];
  container.innerHTML = items.map(([name, rev]) => `
    <div class="bar-row">
      <div class="bar-label" title="${name}">${name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(rev/max*100).toFixed(1)}%">${fmt(rev)}</div>
      </div>
    </div>
  `).join("");
}

function renderGoals(revenue, profit, units) {
  const container = document.getElementById("goalsProgress");
  const g = STATE.goals;
  if (!g.revenue && !g.profit && !g.units) { container.innerHTML = "<p style='color:var(--muted);font-size:13px'>Set monthly goals above to track progress.</p>"; return; }

  // Current month totals
  const now = new Date().toISOString().slice(0, 7);
  const mSales = STATE.sales.filter(s => s.date.slice(0, 7) === now);
  const mRevenue = mSales.reduce((s, x) => s + x.revenue, 0);
  const mProfit  = mSales.reduce((s, x) => s + x.profit,  0);
  const mUnits   = mSales.reduce((s, x) => s + x.qty,     0);

  const goals = [
    { label: "Monthly Revenue", current: mRevenue, goal: g.revenue, unit: "$" },
    { label: "Monthly Profit",  current: mProfit,  goal: g.profit,  unit: "$" },
    { label: "Units Sold",      current: mUnits,   goal: g.units,   unit: ""  },
  ].filter(x => x.goal > 0);

  container.innerHTML = goals.map(go => {
    const pct = Math.min((go.current / go.goal) * 100, 100);
    const over = go.current >= go.goal;
    const display = go.unit === "$" ? fmt(go.current) + " / " + fmt(go.goal) : `${go.current} / ${go.goal}`;
    return `
      <div class="goal-item">
        <div class="goal-meta">
          <span>${go.label}</span>
          <span>${display} — <strong style="color:${over ? 'var(--success)' : 'var(--accent)'}">${pct.toFixed(0)}%</strong>${over ? " ✓" : ""}</span>
        </div>
        <div class="goal-bar-track">
          <div class="goal-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function initGoals() {
  // Load saved values
  document.getElementById("goalRevenue").value = STATE.goals.revenue || "";
  document.getElementById("goalProfit").value  = STATE.goals.profit  || "";
  document.getElementById("goalUnits").value   = STATE.goals.units   || "";

  document.getElementById("saveGoalsBtn").addEventListener("click", () => {
    STATE.goals.revenue = parseFloat(document.getElementById("goalRevenue").value) || 0;
    STATE.goals.profit  = parseFloat(document.getElementById("goalProfit").value)  || 0;
    STATE.goals.units   = parseInt(document.getElementById("goalUnits").value)     || 0;
    save();
    renderDashboard();
    toast("Goals saved!", "success");
  });
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  load();
  initTabs();
  initRanges();
  initCalculator();
  initLibrary();
  initSales();
  initGoals();
  renderLibrary();
  renderSalesTable();
  updateHeaderRevenue();

  // Set today's date for sale form
  document.getElementById("saleDate").valueAsDate = new Date();

  // Expose globals used in inline onclick
  window.loadFromLibrary   = loadFromLibrary;
  window.deleteLibraryItem = deleteLibraryItem;
  window.deleteSale        = deleteSale;
});
