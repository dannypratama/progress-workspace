/* ============================================================= */
/* COSTING MODULE — Kalkulator HPP, Invoice Preview, Estimasi    */
/* ============================================================= */

import { BAHAN, CFG } from "../database.js";
import { rupiah, angka, setText, formatRibuan, formatRupiah, formatInvoiceDate, getToday, getAvatarPalette, paginate, pagination, renderPagination } from "../utils.js";
import { saveAuto, getHistory, deleteHistoryById, loadHistoryData } from "../storage.js";

/* ===================== MATERIAL CALC ===================== */

export function hitungBahan() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const a = (id) => angka(document.getElementById(id)?.value || "");
  const results = {};
  Object.keys(BAHAN).forEach((k) => {
    const m = g(k);
    const b = BAHAN[k];
    results[k + "Kg"] = m * b.kg;
    results[k + "Berat"] = m * b.kg * b.harga;
    results[k + "Print"] = m * b.print;
    results[k + "Total"] = results[k + "Berat"] + results[k + "Print"];
  });
  const customMeter = g("customMeter");
  const customKg = g("customKg");
  const customHarga = a("customHarga");
  results.customKg = customMeter * customKg;
  results.customBerat = results.customKg * customHarga;
  results.customPrint = customMeter * CFG.printPressRate;
  results.customTotal = results.customBerat + results.customPrint;
  return results;
}

/* ===================== HITUNG TOTAL ===================== */

export function hitung() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const a = (id) => angka(document.getElementById(id)?.value || "");
  const pcs = g("pcs") || 1;
  const hargaJual = a("hargaJualPcs");
  const bahan = hitungBahan();
  const jahitTotal = g("jahitPcs") * a("jahitHarga");
  const ongkir = a("ongkirHarga");
  const tambahan = hitungTambahan();
  const grandTotal = Object.keys(BAHAN).reduce((s, k) => s + bahan[k + "Total"], 0) + bahan.customTotal + jahitTotal + ongkir + tambahan;
  const jualTotal = hargaJual * pcs;
  const profit = jualTotal - grandTotal;
  const totalKg = Object.keys(BAHAN).reduce((s, k) => s + bahan[k + "Kg"], 0) + bahan.customKg;
  const totalPrint = Object.keys(BAHAN).reduce((s, k) => s + bahan[k + "Print"], 0) + bahan.customPrint;

  Object.keys(BAHAN).forEach((k) => {
    setText(k + "Kg", bahan[k + "Kg"].toFixed(3) + " kg");
    setText(k + "Berat", rupiah(bahan[k + "Berat"]));
    if (k !== "rib") setText(k + "Print", rupiah(bahan[k + "Print"]));
    setText(k + "Total", rupiah(bahan[k + "Total"]));
  });
  setText("customKgTotal", bahan.customKg.toFixed(3) + " kg");
  setText("customBerat", rupiah(bahan.customBerat));
  setText("customPrint", rupiah(bahan.customPrint));
  setText("customTotal", rupiah(bahan.customTotal));
  setText("jahitTotalPcs", g("jahitPcs"));
  setText("jahitHargaView", rupiah(a("jahitHarga")));
  setText("jahitTotal", rupiah(jahitTotal));
  setText("ongkirNamaView", document.getElementById("ongkirNama")?.value || "–");
  setText("ongkirTotal", rupiah(ongkir));
  setText("allKg", totalKg.toFixed(3) + " kg");
  setText("allPrint", rupiah(totalPrint));
  setText("allJahit", rupiah(jahitTotal));
  setText("allOngkir", rupiah(ongkir));
  setText("grandTotal", rupiah(grandTotal));
  setText("jualTotal", rupiah(jualTotal));
  setText("hppPcs", rupiah(grandTotal / pcs));
  const pEl = document.getElementById("profitTotal");
  if (pEl) {
    pEl.textContent = rupiah(profit);
    pEl.className = "s-val " + (profit >= 0 ? "profit-pos" : "profit-neg");
  }
  updateCostChart([bahan.milanoTotal, bahan.embossTotal, bahan.airwalkTotal, bahan.ribTotal, bahan.lottoTotal, jahitTotal, ongkir, tambahan]);
  saveAuto();
}

/* ===================== EXTRA ITEMS ===================== */

let extraIndex = 0;

export function hitungTambahan() {
  let total = 0;
  document.querySelectorAll(".extra-item").forEach((item) => {
    const inputs = item.querySelectorAll("input");
    const qty = parseFloat(inputs[1]?.value) || 0;
    const harga = angka(inputs[2]?.value || "");
    const subtotal = qty * harga;
    const totalEl = item.querySelector(".extra-total");
    if (totalEl) totalEl.textContent = rupiah(subtotal);
    total += subtotal;
  });
  return total;
}

export function tambahItem(data = {}) {
  extraIndex++;
  const wrap = document.createElement("div");
  wrap.className = "extra-item";
  wrap.innerHTML = `
    <div class="extra-grid">
      <input class="input extra-name" placeholder="Nama barang" value="${data.nama || ""}" oninput="titleCase(this); hitung()" />
      <input class="input extra-qty" type="number" placeholder="pcs" value="${data.qty || ""}" oninput="hitung()" />
      <input class="input extra-price" placeholder="Harga" value="${data.harga || ""}" oninput="formatRibuan(this); hitung()" />
      <div class="extra-total">Rp0</div>
      <button class="btn btn-danger" onclick="tambahItem()"><i class="ri-shopping-cart-2-line"></i></button>
      <button class="btn btn-danger" onclick="hapusItem(this)"><i class="ri-delete-bin-line"></i></button>
    </div>`;
  document.getElementById("extraItems").appendChild(wrap);
  requestAnimationFrame(() => {
    const rect = wrap.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.32, behavior: "smooth" });
    wrap.animate([{ opacity: 0, transform: "translateY(18px) scale(0.985)", filter: "blur(3px)" }, { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" }], { duration: 950, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "both" });
  });
  hitung();
}

export function hapusItem(btn) {
  const item = btn.closest(".extra-item");
  if (!item) return;
  const target = item.nextElementSibling || item.previousElementSibling;
  const height = item.offsetHeight;
  item.style.height = height + "px";
  item.style.overflow = "hidden";
  requestAnimationFrame(() => {
    item.style.transition = "opacity 950ms cubic-bezier(0.22,1,0.36,1), transform 950ms cubic-bezier(0.22,1,0.36,1), height 1050ms cubic-bezier(0.22,1,0.36,1), margin 1050ms cubic-bezier(0.22,1,0.36,1), padding 1050ms cubic-bezier(0.22,1,0.36,1)";
    item.style.opacity = "0";
    item.style.transform = "translateY(-18px) scale(0.985)";
    item.style.height = "0px";
    item.style.marginTop = "0";
    item.style.marginBottom = "0";
    item.style.paddingTop = "0";
    item.style.paddingBottom = "0";
  });
  if (target) {
    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.32, behavior: "smooth" });
    }, 180);
  }
  setTimeout(() => {
    item.remove();
    if (target) {
      target.animate([{ opacity: 0.92, transform: "scale(0.992)" }, { opacity: 1, transform: "scale(1)" }], { duration: 950, easing: "cubic-bezier(0.22,1,0.36,1)" });
    }
    hitung();
  }, 1080);
}

/* ===================== RESET ===================== */

export function resetCard(ids) {
  ids.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  hitung();
}

export function resetFormCosting() {
  if (!confirm("Reset semua form estimasi biaya?")) return;
  ["customer", "team", "pcs", "hargaJualPcs", "milano", "emboss", "airwalk", "rib", "lotto", "jahitPcs", "jahitHarga", "ongkirNama", "ongkirHarga", "ongkirKet"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  hitung();
}

/* ===================== ESTIMASI CEPAT ===================== */

export function hitungEstimasi() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const a = (id) => angka(document.getElementById(id)?.value || "");
  const pcs = g("estimasiPcs");
  const bahan = document.getElementById("estimasiBahan")?.value;
  const hargaJ = a("estimasiHarga");
  const ratio = g("estimasiRatio") || CFG.estimasiRatio;
  if (!BAHAN[bahan]) {
    ["estimasiMeter", "estimasiModal", "estimasiJual", "estimasiProfit", "estimasiHpp"].forEach((id) => setText(id, "Rp0"));
    setText("estimasiMeter", "0 m");
    return;
  }
  const b = BAHAN[bahan];
  const meter = pcs * ratio;
  const modal = meter * b.kg * b.harga + meter * b.print;
  const jual = pcs * hargaJ;
  const profit = jual - modal;
  const hpp = pcs ? modal / pcs : 0;
  setText("estimasiMeter", meter.toFixed(1) + " m");
  setText("estimasiModal", rupiah(modal));
  setText("estimasiJual", rupiah(jual));
  setText("estimasiHpp", rupiah(hpp));
  const pEl = document.getElementById("estimasiProfit");
  if (pEl) {
    pEl.textContent = rupiah(profit);
    pEl.style.color = profit >= 0 ? "var(--color-success)" : "var(--color-danger)";
  }
}

/* ===================== CHARTS ===================== */

let isDark = false;

export function setChartTheme(dark) {
  isDark = dark;
}

function getChartTheme() {
  return {
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    text: isDark ? "#64748b" : "#94a3b8",
  };
}

export let costChart = null;

export function updateCostChart(data) {
  const ctx = document.getElementById("chart-cost");
  if (!ctx) return;
  if (costChart) costChart.destroy();
  const t = getChartTheme();
  costChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Milano", "Emboss", "Airwalk", "Ribpoly", "Lotto", "Jahit", "Ongkir"],
      datasets: [{ data, backgroundColor: data.map((v) => v > 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(0,0,0,0.05)"), borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 10 } } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 10 }, callback: (v) => "Rp" + (v / 1000).toFixed(0) + "k" } },
      },
    },
  });
}

export let pipeChart = null;

export function updatePipelineChart(designOrders) {
  const ctx = document.getElementById("chart-pipeline");
  if (!ctx) return;
  if (pipeChart) pipeChart.destroy();
  const orders = designOrders || [];
  const counts = ["design", "revisi", "done"].map((s) => orders.filter((o) => o.stage === s).length);
  pipeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Desain", "Revisi", "Selesai"],
      datasets: [{ data: counts, backgroundColor: ["#3b82f6", "#f59e0b", "#10b981"], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, color: getChartTheme().text, usePointStyle: true, padding: 12 } },
      },
      cutout: "70%",
    },
  });
}

export function updateCharts(designOrders) {
  updatePipelineChart(designOrders);
}

/* ===================== HISTORY ===================== */

export const customerSortModes = {
  designOrder: "default",
  costing: "default",
  design: "default",
  production: "default",
};

export function toggleCustomerSort(type) {
  customerSortModes[type] = customerSortModes[type] === "default" ? "az" : "default";
  if (type === "designOrder") { if (typeof window.renderDesignOrders === "function") window.renderDesignOrders(); }
  if (type === "costing") renderCostingHistory();
  if (type === "design") renderDesignHistory();
  if (type === "production") renderProductionHistory();
}

export function renderCostingHistory() {
  const tbody = document.getElementById("costing-history-tbody");
  const mobileList = document.getElementById("costing-history-mobile-list");
  if (!tbody) return;
  let histories = getHistory();
  if (customerSortModes.costing === "default") histories.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
  if (customerSortModes.costing === "az") histories.sort((a, b) => (a.customer || "").localeCompare(b.customer || "", "id", { sensitivity: "base" }));
  const search = (document.getElementById("costing-history-search")?.value || "").toLowerCase();
  if (search) histories = histories.filter((o) => (o.customer || "").toLowerCase().includes(search) || (o.team || "").toLowerCase().includes(search));
  const totalRows = histories.length;
  const p = paginate(histories, pagination.costingHistory);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="ri-file-list-3-line"></i>Belum ada riwayat costing</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = "";
    return;
  }
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const profit = Number(o.totalProfit || 0);
    const avatar = getAvatarPalette(o.customer || "");
    return `<tr>
<td class="table-number">${rowNumber}</td>
<td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer || "-"}</div></div></div></td>
<td><div class="table-title">${o.team || "-"}</div></td>
<td><div class="table-title">${o.qty || 0} pcs</div></td>
<td><div class="table-title">Rp${Number(o.hppPcs || 0).toLocaleString("id-ID")}</div></td>
<td><div class="table-title">Rp${Number(o.hargaJual || 0).toLocaleString("id-ID")}</div></td>
<td><div class="table-title" style="color:${profit >= 0 ? "var(--color-success)" : "var(--color-danger)"};">Rp${profit.toLocaleString("id-ID")}</div></td>
<td><div class="table-subtitle">${o.date || "-"}</div></td>
<td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="window.loadHistoryData(${o.id})"><i class="ri-upload-2-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="window.deleteHistory(${o.id})"><i class="ri-delete-bin-line"></i></button></div></div></td>
</tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => {
      const profit = Number(o.totalProfit || 0);
      return `<div class="history-mobile-item"><div class="history-mobile-head"><div><div class="history-mobile-customer">${o.customer || "-"}</div><div class="history-mobile-title">${o.team || "-"}</div></div><div class="history-mobile-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="window.loadHistoryData(${o.id})"><i class="ri-upload-2-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="window.deleteHistory(${o.id})"><i class="ri-delete-bin-line"></i></button></div></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-stack-line"></i>${o.qty || 0} pcs</div><div class="mobile-meta-item"><i class="ri-money-dollar-circle-line"></i>Rp${Number(o.hppPcs || 0).toLocaleString("id-ID")}</div><div class="mobile-meta-item"><i class="ri-line-chart-line"></i><span class="${profit >= 0 ? "mobile-meta-success" : "mobile-meta-danger"}">Rp${profit.toLocaleString("id-ID")}</span></div><div class="mobile-meta-item">${o.date || "-"}</div></div></div>`;
    }).join("");
  }
  renderPagination("costing-history-pagination", p.page, p.totalPages, "changeCostingHistoryPage", totalRows);
}

export function renderDesignHistory() {
  const tbody = document.getElementById("design-history-tbody");
  const mobileList = document.getElementById("design-history-mobile-list");
  if (!tbody) return;
  let orders = [...(window.firebaseDesignOrders || [])];
  orders = orders.filter((o) => o.stage === "done");
  const search = (document.getElementById("design-history-search")?.value || "").toLowerCase();
  if (customerSortModes.design === "az") orders.sort((a, b) => (a.customer || "").localeCompare(b.customer || "", "id", { sensitivity: "base" }));
  if (search) orders = orders.filter((o) => (o.customer || "").toLowerCase().includes(search) || (o.design || "").toLowerCase().includes(search) || (o.jenis || "").toLowerCase().includes(search));
  const totalRows = orders.length;
  const p = paginate(orders, pagination.designHistory);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ri-file-list-3-line"></i>Belum ada riwayat desain</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="empty-state"><i class="ri-file-list-3-line"></i>Belum ada riwayat desain</div>`;
    return;
  }
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const avatar = getAvatarPalette(o.customer || "");
    return `<tr>
<td class="table-number">${rowNumber}</td>
<td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer || "-"}</div></div></div></td>
<td><div class="table-title">${o.design || "-"}</div></td>
<td><span class="table-tag">${o.jenis || "-"}</span></td>
<td><div class="table-subtitle">${o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}</div></td>
<td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditDesign('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteDesignOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td>
</tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => `<div class="history-mobile-item"><div class="history-mobile-head"><div><div class="history-mobile-customer">${o.customer || "-"}</div><div class="history-mobile-title">${o.design || "-"}</div></div><div class="history-mobile-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditDesign('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteDesignOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-price-tag-3-line"></i><span>${o.jenis || "-"}</span></div><div class="mobile-meta-item"><span>${o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}</span></div></div></div>`).join("");
  }
  renderPagination("design-history-pagination", p.page, p.totalPages, "changeDesignHistoryPage", totalRows);
}

export function renderProductionHistory() {
  const tbody = document.getElementById("production-history-tbody");
  const mobileList = document.getElementById("production-history-mobile-list");
  if (!tbody) return;
  let orders = [...(window.firebaseProductionOrders || [])];
  orders = orders.filter((o) => o.stage === "done");
  const search = (document.getElementById("design-history-search")?.value || "").toLowerCase();
  if (customerSortModes.production === "default") orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (customerSortModes.production === "az") orders.sort((a, b) => (a.customer || "").localeCompare(b.customer || "", "id", { sensitivity: "base" }));
  if (search) orders = orders.filter((o) => (o.customer || "").toLowerCase().includes(search) || (o.team || "").toLowerCase().includes(search) || (o.material || "").toLowerCase().includes(search));
  const totalRows = orders.length;
  const p = paginate(orders, pagination.productionHistory);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ri-archive-stack-line"></i>Belum ada riwayat produksi</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = "";
    return;
  }
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const avatar = getAvatarPalette(o.customer || "");
    return `<tr>
<td class="table-number">${rowNumber}</td>
<td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer || "-"}</div></div></div></td>
<td><div class="table-title">${o.team || "-"}</div></td>
<td><span class="table-tag">${o.material || "-"}</span></td>
<td><div class="table-title">${o.qty || "-"}</div></td>
<td><div class="table-subtitle">${o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}</div></td>
<td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditProduction('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteProductionOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td>
</tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => `<div class="history-mobile-item"><div class="history-mobile-head"><div><div class="history-mobile-customer">${o.customer || "-"}</div><div class="history-mobile-title">${o.team || "-"}</div></div><div class="history-mobile-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditProduction('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteProductionOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-t-shirt-2-line"></i><span>${o.material || "-"}</span></div><div class="mobile-meta-item"><i class="ri-stack-line"></i><span>${o.qty || "-"} pcs</span></div></div></div>`).join("");
  }
  renderPagination("production-history-pagination", p.page, p.totalPages, "changeProductionHistoryPage", totalRows);
}
