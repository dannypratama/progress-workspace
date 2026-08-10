/* ============================================================= */
/* TRACKER MODULE — Kanban Board (Design & Production Pipeline)  */
/* ============================================================= */

import { DESIGN_STAGES, PRODUCTION_STAGES } from "../database.js";
import { setText, getToday, getAvatarPalette, paginate, pagination, renderPagination } from "../utils.js";
import { updateCharts, customerSortModes } from "./costing.js";

/* ===================== HERO ===================== */

export function updateHero() {
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  if (document.getElementById("hero-date")) document.getElementById("hero-date").textContent = now.toLocaleDateString("id-ID", options);
  if (document.getElementById("hero-clock")) document.getElementById("hero-clock").textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB";
  const designOrders = window.firebaseDesignOrders || [];
  const prodOrders = window.firebaseProductionOrders || [];
  const todayStr = getToday();
  const activeDesign = designOrders.filter((o) => o.stage === "design").length;
  const activeProd = prodOrders.filter((o) => o.stage === "design").length;
  setText("stat-active-orders", activeDesign + activeProd);
  const prodDesign = designOrders.filter((o) => o.stage === "revisi").length;
  const prodProd = prodOrders.filter((o) => ["printing", "jahit", "qc"].includes(o.stage)).length;
  setText("stat-production", prodDesign + prodProd);
  const doneDesign = designOrders.filter((o) => o.stage === "done").length;
  const doneProd = prodOrders.filter((o) => o.stage === "done").length;
  setText("stat-done-today", doneDesign + doneProd);
  const overdueDesign = designOrders.filter((o) => o.deadline && o.deadline < todayStr && o.stage !== "done").length;
  const overdueProd = prodOrders.filter((o) => o.deadline && o.deadline < todayStr && o.stage !== "done").length;
  setText("stat-overdue", overdueDesign + overdueProd);
}

/* ===================== DESIGN ORDERS ===================== */

export const designState = { editId: null, filter: "all", stageFilter: null };

export function renderDesignOrders() {
  let orders = window.firebaseDesignOrders || [];
  const tbody = document.getElementById("design-tbody");
  const mobileList = document.getElementById("design-mobile-list");
  if (!tbody) return;
  orders = [...orders].sort((a, b) => {
    if (a.stage === "done" && b.stage !== "done") return 1;
    if (a.stage !== "done" && b.stage === "done") return -1;
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
  const search = (document.getElementById("design-search")?.value || "").toLowerCase();
  const today = getToday();
  if (customerSortModes.designOrder === "az") orders.sort((a, b) => (a.customer || "").localeCompare(b.customer || "", "id", { sensitivity: "base" }));
  if (search) orders = orders.filter((o) => (o.customer || "").toLowerCase().includes(search) || (o.design || "").toLowerCase().includes(search) || (o.jenis || "").toLowerCase().includes(search));
  if (designState.filter === "done") orders = orders.filter((o) => o.stage === "done");
  if (designState.filter === "progress") orders = orders.filter((o) => o.stage !== "done");
  if (designState.filter === "overdue") orders = orders.filter((o) => o.deadline && o.deadline < today && o.stage !== "done");
  if (designState.filter === "urgent") orders = orders.filter((o) => { if (!o.deadline || o.stage === "done") return false; const diff = (new Date(o.deadline) - new Date(today)) / 86400000; return diff >= 0 && diff <= 2; });
  if (designState.stageFilter) orders = orders.filter((o) => o.stage === designState.stageFilter);
  const totalRows = orders.length;
  const p = paginate(orders, pagination.designOrders);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ri-check-double-line"></i>Semua tugas desain selesai / kosong</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = "";
    renderPagination("design-pagination", 1, 1, "changeDesignPage", totalRows);
    return;
  }
  const statusBadge = { design: "badge-design", revisi: "badge-revisi", done: "badge-done" };
  const statusLabel = { design: "Desain", revisi: "Revisi", done: "Selesai" };
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const deadline = o.deadline || "";
    const diffDays = deadline ? (new Date(deadline) - new Date(today)) / 86400000 : 999;
    const overdue = deadline && diffDays < 0 && o.stage !== "done";
    const urgent = deadline && diffDays >= 0 && diffDays <= 2 && o.stage !== "done";
    const avatar = getAvatarPalette(o.customer || "");
    return `<tr>
<td class="table-number">${rowNumber}</td>
<td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer}</div><div class="table-subtitle">${o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}</div></div></div></td>
<td><div class="table-title">${o.design}</div></td>
<td><span class="table-tag">${o.jenis || "-"}</span></td>
<td><div class="table-deadline" style="color:${overdue ? "var(--color-danger)" : urgent ? "var(--color-warning)" : ""};"><i class="${overdue ? "ri-alarm-warning-fill" : urgent ? "ri-time-fill" : "ri-calendar-line"}"></i>${overdue ? "Terlambat" : deadline || "-"}</div></td>
<td><span class="badge-status ${statusBadge[o.stage]}">${statusLabel[o.stage]}</span></td>
<td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="prevDesignStage('${o.id}')"><i class="ri-arrow-left-line"></i></button>${o.stage !== "done" ? `<button class="btn btn-solid btn-sm btn-icon-round" onclick="advanceDesignStage('${o.id}')"><i class="ri-arrow-right-line"></i></button>` : ""}<button class="btn btn-green btn-sm btn-icon-round" onclick="markDesignDone('${o.id}')"><i class="ri-check-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditDesign('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteDesignOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td>
</tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => {
      const deadline = o.deadline || "";
      const diffDays = deadline ? (new Date(deadline) - new Date(today)) / 86400000 : 999;
      const overdue = deadline && diffDays < 0 && o.stage !== "done";
      const urgent = deadline && diffDays >= 0 && diffDays <= 2 && o.stage !== "done";
      return `<div class="design-mobile-card"><div class="design-mobile-head"><div><div class="design-mobile-customer">${o.customer}</div><div class="design-mobile-title">${o.design}</div></div><span class="badge-status ${statusBadge[o.stage]}">${statusLabel[o.stage]}</span></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-price-tag-3-line"></i><span>${o.jenis || "-"}</span></div><div class="mobile-meta-item ${overdue ? "mobile-meta-danger" : urgent ? "mobile-meta-warning" : ""}"><i class="${overdue ? "ri-alarm-warning-fill" : urgent ? "ri-error-warning-line" : "ri-calendar-line"}"></i><span>${overdue ? "Terlambat" : deadline || "-"}</span></div></div><div class="design-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="prevDesignStage('${o.id}')"><i class="ri-arrow-left-line"></i></button>${o.stage !== "done" ? `<button class="btn btn-solid btn-sm btn-icon-round" onclick="advanceDesignStage('${o.id}')"><i class="ri-arrow-right-line"></i></button>` : ""}<button class="btn btn-green btn-sm btn-icon-round" onclick="markDesignDone('${o.id}')"><i class="ri-check-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditDesign('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteDesignOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div>`;
    }).join("");
  }
  renderPagination("design-pagination", p.page, p.totalPages, "changeDesignPage", totalRows);
}

export function setDesignFilter(filter) { designState.filter = filter; renderDesignOrders(); }

export function filterByStage(stage) {
  designState.stageFilter = designState.stageFilter === stage ? null : stage;
  renderDesignOrders();
  const steps = document.querySelectorAll("#pipeline-section .pipeline-step");
  const selectedIdx = DESIGN_STAGES.indexOf(designState.stageFilter);
  steps.forEach((el, i) => {
    el.classList.toggle("pipeline-selected", el.dataset.stage === designState.stageFilter);
    el.classList.toggle("line-active", selectedIdx >= 0 && i < selectedIdx);
  });
}

/* ===================== PRODUCTION ORDERS ===================== */

export const prodState = { editId: null, stageFilter: null };

export function renderProductionOrders() {
  let orders = window.firebaseProductionOrders || [];
  const tbody = document.getElementById("production-tbody");
  const mobileList = document.getElementById("production-mobile-list");
  if (!tbody) return;
  const today = getToday();
  orders = [...orders].sort((a, b) => {
    if (a.stage === "done" && b.stage !== "done") return 1;
    if (a.stage !== "done" && b.stage === "done") return -1;
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
  const search = (document.getElementById("production-search")?.value || "").toLowerCase();
  if (search) orders = orders.filter((o) => (o.customer || "").toLowerCase().includes(search) || (o.team || "").toLowerCase().includes(search) || (o.material || "").toLowerCase().includes(search));
  const filter = document.getElementById("production-filter")?.value || "all";
  if (filter === "progress") orders = orders.filter((o) => o.stage !== "done");
  if (filter === "done") orders = orders.filter((o) => o.stage === "done");
  if (filter === "overdue") orders = orders.filter((o) => o.deadline && o.deadline < today && o.stage !== "done");
  if (filter === "urgent") orders = orders.filter((o) => { if (!o.deadline || o.stage === "done") return false; const diff = (new Date(o.deadline) - new Date(today)) / 86400000; return diff >= 0 && diff <= 2; });
  if (prodState.stageFilter) orders = orders.filter((o) => o.stage === prodState.stageFilter);
  const totalRows = orders.length;
  const p = paginate(orders, pagination.productionOrders);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ri-inbox-line"></i>Belum ada pesanan produksi</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = "";
    return;
  }
  const statusClass = { design: "badge-design", printing: "badge-revisi", jahit: "badge-revisi", qc: "badge-revisi", done: "badge-done" };
  const statusLabel = { design: "Desain", printing: "Printing", jahit: "Jahit", qc: "QC", done: "Selesai" };
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const deadline = o.deadline || "";
    const diff = deadline ? (new Date(deadline) - new Date(today)) / 86400000 : 999;
    const overdue = deadline && diff < 0 && o.stage !== "done";
    const urgent = deadline && diff >= 0 && diff <= 2 && o.stage !== "done";
    const avatar = getAvatarPalette(o.customer || "");
    return `<tr>
<td class="table-number">${rowNumber}</td>
<td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer}</div><div class="table-subtitle">${o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}</div></div></div></td>
<td><div class="table-title">${o.team || "-"}</div></td>
<td><div class="table-title">${o.qty || "-"}</div></td>
<td><span class="table-tag">${o.material || "-"}</span></td>
<td><div class="table-deadline" style="color:${overdue ? "var(--color-danger)" : urgent ? "var(--color-warning)" : ""};"><i class="${overdue ? "ri-alarm-warning-fill" : urgent ? "ri-error-warning-line" : "ri-calendar-line"}"></i>${overdue ? "Terlambat" : deadline || "-"}</div></td>
<td><span class="badge-status ${statusClass[o.stage]}">${statusLabel[o.stage]}</span></td>
<td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="prevProductionStage('${o.id}')"><i class="ri-arrow-left-line"></i></button><button class="btn btn-solid btn-sm btn-icon-round" onclick="nextProductionStage('${o.id}')"><i class="ri-arrow-right-line"></i></button><button class="btn btn-green btn-sm btn-icon-round" onclick="markProductionDone('${o.id}')"><i class="ri-check-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditProduction('${o.id}')"><i class="ri-edit-line"></i></button>${o.invoiceId ? `<button class="btn btn-ghost btn-sm btn-icon-round" onclick="createInvoiceFromProduction('${o.id}')" title="Lihat Invoice"><i class="ri-file-text-line"></i></button>` : `<button class="btn btn-solid btn-sm btn-icon-round" onclick="createInvoiceFromProduction('${o.id}')" title="Buat Invoice"><i class="ri-file-add-line"></i></button>`}<button class="btn btn-red btn-sm btn-icon-round" onclick="deleteProductionOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td>
</tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => {
      const deadline = o.deadline || "";
      const diff = deadline ? (new Date(deadline) - new Date(today)) / 86400000 : 999;
      const overdue = deadline && diff < 0 && o.stage !== "done";
      const urgent = deadline && diff >= 0 && diff <= 2 && o.stage !== "done";
      return `<div class="design-mobile-card"><div class="design-mobile-head"><div><div class="design-mobile-customer">${o.customer}</div><div class="design-mobile-title">${o.team || "-"}</div></div><span class="badge-status ${statusClass[o.stage]}">${statusLabel[o.stage]}</span></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-t-shirt-2-line"></i><span>${o.material || "-"}</span></div><div class="mobile-meta-item"><i class="ri-stack-line"></i><span>${o.qty || "-"} pcs</span></div><div class="mobile-meta-item ${overdue ? "mobile-meta-danger" : urgent ? "mobile-meta-warning" : ""}"><i class="${overdue ? "ri-alarm-warning-fill" : urgent ? "ri-error-warning-line" : "ri-calendar-line"}"></i><span>${overdue ? "Terlambat" : deadline || "-"}</span></div></div><div class="design-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="prevProductionStage('${o.id}')"><i class="ri-arrow-left-line"></i></button>${o.stage !== "done" ? `<button class="btn btn-solid btn-sm btn-icon-round" onclick="nextProductionStage('${o.id}')"><i class="ri-arrow-right-line"></i></button>` : ""}<button class="btn btn-green btn-sm btn-icon-round" onclick="markProductionDone('${o.id}')"><i class="ri-check-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditProduction('${o.id}')"><i class="ri-edit-line"></i></button>${o.invoiceId ? `<button class="btn btn-ghost btn-sm btn-icon-round" onclick="createInvoiceFromProduction('${o.id}')" title="Lihat Invoice"><i class="ri-file-text-line"></i></button>` : `<button class="btn btn-solid btn-sm btn-icon-round" onclick="createInvoiceFromProduction('${o.id}')" title="Buat Invoice"><i class="ri-file-add-line"></i></button>`}<button class="btn btn-red btn-sm btn-icon-round" onclick="deleteProductionOrder('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div>`;
    }).join("");
  }
  renderPagination("production-pagination", p.page, p.totalPages, "changeProductionPage", totalRows);
}

export function filterProductionStage(stage) {
  prodState.stageFilter = prodState.stageFilter === stage ? null : stage;
  renderProductionOrders();
  const steps = document.querySelectorAll("[data-production-stage]");
  const selectedIdx = PRODUCTION_STAGES.indexOf(prodState.stageFilter);
  steps.forEach((el, i) => {
    el.classList.toggle("pipeline-selected", el.dataset.productionStage === prodState.stageFilter);
    el.classList.toggle("line-active", selectedIdx >= 0 && i < selectedIdx);
  });
}

/* ===================== PIPELINE ===================== */

export function updatePipeline() {
  const counts = DESIGN_STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  (window.firebaseDesignOrders || []).forEach((o) => counts[o.stage]++);
  DESIGN_STAGES.forEach((s) => {
    setText("pipe-" + s, counts[s]);
    const step = document.querySelector(`#pipeline-section .pipeline-step[data-stage="${s}"]`);
    if (step) {
      step.classList.remove("active", "done");
      if (counts[s] > 0) step.classList.add(s === "done" ? "done" : "active");
    }
  });
}

export function updateProductionPipeline() {
  const counts = PRODUCTION_STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  (window.firebaseProductionOrders || []).forEach((o) => counts[o.stage]++);
  PRODUCTION_STAGES.forEach((s) => {
    setText("prod-pipe-" + s, counts[s]);
    const step = document.querySelector(`.pipeline-step[data-production-stage="${s}"]`);
    if (step) {
      step.classList.remove("active", "done");
      if (counts[s] > 0) step.classList.add(s === "done" ? "done" : "active");
    }
  });
}


