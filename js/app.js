/* ============================================================= */
/* APP ENTRY POINT — Inisialisasi, Firebase, Global Bindings     */
/* ============================================================= */

import { KEYS, BAHAN, CFG, MASTER_PRICE_DATABASE, getProductBasePrice } from "./database.js";
import { rupiah, angka, formatRibuan, titleCase, setText, getToday, formatRupiah, formatInvoiceDate, paginate, pagination, renderPagination, getAvatarPalette } from "./utils.js";
import { saveAuto, loadAuto, saveHistory, getHistory, deleteHistoryById, loadHistoryData, saveTasks, getTasks, saveSectionState, restoreSectionState } from "./storage.js";
import {
  hitung, hitungBahan, hitungTambahan, tambahItem, hapusItem,
  resetCard, resetFormCosting, hitungEstimasi,
  updateCostChart, updatePipelineChart, updateCharts, setChartTheme,
  costChart, pipeChart,
  renderCostingHistory, renderDesignHistory, renderProductionHistory,
  customerSortModes, toggleCustomerSort,
} from "./components/costing.js";
import {
  updateHero, renderDesignOrders, setDesignFilter, filterByStage,
  renderProductionOrders, filterProductionStage,
  updatePipeline, updateProductionPipeline,
  designState, prodState,
} from "./components/tracker.js";
import {
  saveTask, toggleTask, deleteTask, renderTaskList,
} from "./components/tasks.js";

/* ============================================================= */
/* TOAST & MODAL                                                  */
/* ============================================================= */
let toastTimer = null;

function showToast(msg, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  document.getElementById("toast-msg").textContent = msg;
  el.className = `toast show ${type}`;
  const icon = type === "error" ? "ri-error-warning-fill" : type === "info" ? "ri-information-fill" : "ri-check-circle-fill";
  el.querySelector(".toast-icon").className = `toast-icon ${icon}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), CFG.toastDuration);
}

function openModal(id) { document.getElementById(id)?.classList.add("open"); }

function hasInvoiceDraft() {
  return document.getElementById("invoice-customer")?.value || document.querySelectorAll(".invoice-item-row").length > 0 || document.getElementById("invoice-note")?.value;
}

function closeModal(id, force = false) {
  if (id === "modal-invoice" && !force) {
    if (hasInvoiceDraft() && !confirm("Invoice belum disimpan. Yakin tutup?")) return;
  }
  document.getElementById(id)?.classList.remove("open");
}

document.addEventListener("click", function (e) {
  const modal = e.target.closest(".modal");
  if (!modal) return;
  if (e.target !== modal) return;
  if (modal.id === "modal-invoice") { e.preventDefault(); e.stopPropagation(); return false; }
  modal.classList.remove("open");
}, true);

/* ============================================================= */
/* THEME                                                          */
/* ============================================================= */
function toggleDark() {
  document.body.classList.toggle("dark");
  window.isDark = document.body.classList.contains("dark");
  localStorage.setItem(KEYS.theme, window.isDark ? "dark" : "light");
  document.getElementById("theme-icon").className = window.isDark ? "ri-sun-line" : "ri-contrast-2-line";
  setChartTheme(window.isDark);
  updateCharts(window.firebaseDesignOrders);
}

function loadTheme() {
  if (localStorage.getItem(KEYS.theme) === "dark") {
    document.body.classList.add("dark");
    window.isDark = true;
    document.getElementById("theme-icon").className = "ri-sun-line";
  }
  setChartTheme(!!window.isDark);
}

/* ============================================================= */
/* MOBILE NAV                                                     */
/* ============================================================= */
function toggleMobileNav() { document.getElementById("mobile-nav-menu").classList.toggle("show"); }
function toggleAddDropdown(e) { e.stopPropagation(); document.getElementById("nav-add-menu").classList.toggle("open"); }
document.addEventListener("click", function (e) { var m = document.getElementById("nav-add-menu"); if (m && !e.target.closest(".nav-add-dropdown")) m.classList.remove("open"); });
function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); document.getElementById("mobile-nav-menu").classList.remove("show"); }

/* ============================================================= */
/* DESIGN ORDERS — Firebase wrappers (called from onSnapshot)     */
/* ============================================================= */
async function saveDesignOrder() {
  const customer = document.getElementById("do-customer").value.trim();
  const design = document.getElementById("do-design").value.trim();
  if (!customer || !design) return showToast("Lengkapi nama pelanggan dan desain", "error");
  const data = { customer, design, jenis: document.getElementById("do-jenis").value, deadline: document.getElementById("do-deadline").value, notes: document.getElementById("do-notes").value };
  try {
    if (designState.editId) {
      await updateDoc(doc(db, "design_orders", designState.editId), { ...data, updatedAt: serverTimestamp() });
      showToast("Perubahan desain tersimpan");
    } else {
      await addDoc(collection(db, "design_orders"), { ...data, stage: "design", createdAt: serverTimestamp() });
      showToast("Pesanan desain bertambah");
    }
    closeModal("modal-design");
    ["do-customer", "do-design", "do-jenis", "do-deadline", "do-notes"].forEach((id) => document.getElementById(id).value = "");
    designState.editId = null;
  } catch (err) { console.error(err); showToast("Penyimpanan gagal, coba lagi", "error"); }
}

async function advanceDesignStage(id) {
  const order = (window.firebaseDesignOrders || []).find((o) => o.id === id);
  if (!order) return;
  const ci = ["design", "revisi", "done"].indexOf(order.stage);
  if (ci < 2) { await updateDoc(doc(db, "design_orders", id), { stage: ["design", "revisi", "done"][ci + 1] }); showToast("Pindah ke tahap " + ["Desain", "Revisi", "Selesai"][ci + 1]); }
}
async function prevDesignStage(id) {
  const order = (window.firebaseDesignOrders || []).find((o) => o.id === id);
  if (!order) return;
  const ci = ["design", "revisi", "done"].indexOf(order.stage);
  if (ci > 0) { await updateDoc(doc(db, "design_orders", id), { stage: ["design", "revisi", "done"][ci - 1] }); showToast("Kembali ke tahap sebelumnya"); }
}
async function markDesignDone(id) { await updateDoc(doc(db, "design_orders", id), { stage: "done" }); showToast("Pesanan desain selesai"); }
async function deleteDesignOrder(id) { if (!confirm("Hapus pesanan desain ini?")) return; try { await deleteDoc(doc(db, "design_orders", id)); showToast("Pesanan desain dihapus", "info"); } catch (err) { showToast("Hapus gagal, coba lagi", "error"); } }

function openEditDesign(id) {
  const order = (window.firebaseDesignOrders || []).find((o) => o.id === id);
  if (!order) return;
  designState.editId = id;
  document.getElementById("do-customer").value = order.customer || "";
  document.getElementById("do-design").value = order.design || "";
  document.getElementById("do-jenis").value = order.jenis || "";
  document.getElementById("do-deadline").value = order.deadline || "";
  document.getElementById("do-notes").value = order.notes || "";
  openModal("modal-design");
}

/* ============================================================= */
/* PRODUCTION ORDERS — Firebase wrappers                          */
/* ============================================================= */
/* ===================== PRODUCTION — Item Builder ===================== */

window.addProductionItem = function () {
  const wrap = document.getElementById("production-items");
  if (!wrap) return;
  const idx = Date.now();
  wrap.insertAdjacentHTML("beforeend", `
<div class="invoice-product-group" data-group-idx="${idx}">
  <div class="invoice-product-wrap">
    <div class="invoice-product-wrap-row">
      <input class="input invoice-product" placeholder="Nama Produk" oninput="this.value=this.value.toUpperCase();updateProductionTotals();">
      <button type="button" class="product-builder-btn" onclick="toggleProductBuilder(this)"><i class="ri-ai-generate-text"></i></button>
    </div>
    <div class="product-builder-panel">
      <select class="input spec-product" onchange="changeProductTemplate(this)"><option value="JERSEY">JERSEY CUSTOM</option><option value="KAOS">KAOS CUSTOM</option><option value="KEMEJA">KEMEJA CUSTOM</option></select>
      <select class="input spec-category jersey-field"><option value="ATASAN JERSEY">ATASAN JERSEY</option><option value="SETELAN JERSEY">SETELAN JERSEY</option></select>
      <select class="input spec-material"></select>
      <select class="input spec-color kaos-field" style="display:none"><option value="">PILIH WARNA</option><option value="HITAM">HITAM</option><option value="PUTIH">PUTIH</option><option value="ABU">ABU</option><option value="BIRU BENHUR">BIRU BENHUR</option><option value="MAROON">MAROON</option><option value="MERAH">MERAH</option><option value="NAVY">NAVY</option></select>
      <select class="input spec-sleeve"><option value="PENDEK">PENDEK</option><option value="PANJANG">PANJANG +10K</option></select>
      <select class="input spec-collar jersey-field"><option value="O-NECK">O-NECK</option><option value="V-NECK">V-NECK</option><option value="V-VARIASI">V-VARIASI</option><option value="V-POTONG">V-POTONG</option><option value="POLO V-NECK">POLO V-NECK +5K</option><option value="KERAH POLO">KERAH POLO +10K</option></select>
      <select class="input spec-addon"><option value="">TANPA ADDON</option></select>
      <button type="button" class="btn btn-sm" onclick="applyProductSpec(this)"><i class="ri-check-line"></i> PAKAI TEMPLATE</button>
    </div>
  </div>
  <div class="invoice-mode-bar">
    <select class="input invoice-mode-select" onchange="changePriceModeProd(this)">
      <option value="auto">AUTO</option>
      <option value="auto-discount">AUTO - DISKON</option>
      <option value="manual">MANUAL</option>
    </select>
    <input class="input invoice-mode-discount" type="number" placeholder="Diskon/pcs" min="0" style="display:none" oninput="updateProductionTotals()">
  </div>
  <div class="invoice-size-header">
    <span class="isize-drag"></span>
    <span class="isize-size">Ukuran</span>
    <span class="isize-qty">Jml</span>
    <span class="isize-price">Harga</span>
    <span class="isize-total">Total</span>
    <span class="isize-del"></span>
  </div>
  <div class="size-wrapper">
    <div class="invoice-item-row" data-price-mode="auto">
      <span class="drag-handle"><i class="ri-draggable"></i></span>
      <select class="input invoice-size" onchange="updateProductionTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select>
      <input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateProductionTotals()">
      <input type="number" class="input invoice-price" placeholder="0" min="0" readonly oninput="updateProductionTotals(true)">
      <input class="input invoice-total" readonly value="Rp0">
      <button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeProductionItem(this)"><i class="ri-delete-bin-line"></i></button>
    </div>
  </div>
  <button type="button" class="btn btn-sm btn-add-size" onclick="addProductionSize(this)">+ TAMBAH UKURAN</button>
</div>`);
  updateProductionTotals();
  const newRow = wrap.lastElementChild;
  if (newRow) newRow.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.addProductionSize = function (btn) {
  const group = btn.closest(".invoice-product-group");
  const wrap = group.querySelector(".size-wrapper");
  const mode = group.querySelector(".invoice-mode-select")?.value || "auto";
  wrap.insertAdjacentHTML("beforeend", `<div class="invoice-item-row" data-price-mode="${mode}"><span class="drag-handle"><i class="ri-draggable"></i></span><select class="input invoice-size" onchange="updateProductionTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select><input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateProductionTotals()"><input type="number" class="input invoice-price" placeholder="0" min="0" ${mode === "manual" ? "" : "readonly"} oninput="updateProductionTotals(true)"><input class="input invoice-total" readonly value="Rp0"><button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeProductionItem(this)"><i class="ri-delete-bin-line"></i></button></div>`);
  updateProductionTotals();
};

window.removeProductionItem = function (btn) {
  const row = btn.closest(".invoice-item-row");
  if (row) {
    const group = row.closest(".invoice-product-group");
    const wrap = group?.querySelector(".size-wrapper");
    if (wrap && wrap.querySelectorAll(".invoice-item-row").length <= 1) {
      group?.remove();
    } else {
      row.remove();
    }
  }
  updateProductionTotals();
};

window.changePriceModeProd = function (select) {
  const group = select.closest(".invoice-product-group");
  const mode = select.value;
  const discountInput = group.querySelector(".invoice-mode-discount");
  const rows = group.querySelectorAll(".invoice-item-row");
  discountInput.style.display = mode === "auto-discount" ? "" : "none";
  rows.forEach((row) => {
    row.dataset.priceMode = mode;
    const priceInput = row.querySelector(".invoice-price");
    priceInput.readOnly = mode !== "manual";
  });
  updateProductionTotals();
};

window.collectProductionItems = function () {
  const items = [];
  document.querySelectorAll("#production-items .invoice-product-group").forEach((group) => {
    const product = group.querySelector(".invoice-product")?.value.trim() || "";
    const mode = group.querySelector(".invoice-mode-select")?.value || "auto";
    const discountPerPcs = Number(group.querySelector(".invoice-mode-discount")?.value) || 0;
    const specs = group.dataset.specs ? JSON.parse(group.dataset.specs) : null;
    if (!product) return;
    group.querySelectorAll(".invoice-item-row").forEach((row) => {
      const size = row.querySelector(".invoice-size")?.value.trim() || "";
      const qty = Number(row.querySelector(".invoice-qty")?.value) || 0;
      const price = Number(row.querySelector(".invoice-price")?.value) || 0;
      if (!size && !qty) return;
      items.push({ product, size, qty, price, total: qty * price, priceMode: mode, discountPerPcs, specs });
    });
  });
  return items;
};

window.updateProductionTotals = function () {
  let subtotal = 0;
  let totalQty = 0;
  let material = "";
  document.querySelectorAll("#production-items .invoice-item-row").forEach((row) => {
    const group = row.closest(".invoice-product-group");
    const product = group ? group.querySelector(".invoice-product")?.value || "" : "";
    const qtyInput = row.querySelector(".invoice-qty");
    const priceInput = row.querySelector(".invoice-price");
    const totalInput = row.querySelector(".invoice-total");
    const qty = Number(qtyInput?.value || 0);
    const size = row.querySelector(".invoice-size")?.value || "";
    const mode = group ? (group.querySelector(".invoice-mode-select")?.value || "auto") : row.dataset.priceMode || "auto";
    row.dataset.priceMode = mode;
    if ((mode === "auto" || mode === "auto-discount") && priceInput) {
      let autoPrice = 0;
      const specs = JSON.parse(group?.dataset?.specs || "{}");
      if (specs.product) {
        const pt = specs.product.toLowerCase();
        const mat = specs.material || "";
        const cat = specs.category || "";
        const slv = (specs.sleeve || "PENDEK").toLowerCase();
        const col = specs.collar || "";
        const add = specs.addon || "";
        autoPrice = getProductBasePrice(pt, { qty: qty || 1, material: mat, category: cat, sleeve: slv });
        const matRules = MASTER_PRICE_DATABASE.materials[pt];
        if (matRules) {
          const mSearch = mat.toLowerCase();
          for (const k in matRules) { if (mSearch.includes(k)) { autoPrice += matRules[k]; break; } }
        }
        const allAddons = MASTER_PRICE_DATABASE.addons[pt];
        if (allAddons) {
          if (col) {
            const ck = col.toLowerCase().trim();
            for (const sec in allAddons) { if (allAddons[sec][ck] !== undefined) { autoPrice += allAddons[sec][ck]; break; } }
          }
          if (add) {
            const ak = add.toLowerCase().trim();
            for (const sec in allAddons) { if (allAddons[sec][ak] !== undefined) { autoPrice += allAddons[sec][ak]; break; } }
          }
          if (slv !== "pendek" && MASTER_PRICE_DATABASE.products[pt]?.pricingModel !== "matrix") {
            for (const sec in allAddons) { if (allAddons[sec][slv] !== undefined) { autoPrice += allAddons[sec][slv]; break; } }
          }
        }
        const sRules = MASTER_PRICE_DATABASE.sizeCharges.global_apparel;
        if (size && sRules[size] !== undefined) autoPrice += sRules[size];
      } else {
        if (product.includes("JERSEY")) autoPrice = 75000;
        else if (product.includes("KAOS")) autoPrice = 55000;
        else if (product.includes("KEMEJA")) autoPrice = 85000;
      }
      const discountPerPcs = Number(group?.querySelector(".invoice-mode-discount")?.value) || 0;
      priceInput.value = autoPrice - discountPerPcs;
    }
    const price = Number(priceInput?.value || 0);
    const total = qty * price;
    if (totalInput) totalInput.value = "Rp" + total.toLocaleString("id-ID");
    subtotal += total;
    totalQty += qty;
  });
  document.getElementById("po-qty").value = totalQty;
  const firstGroup = document.querySelector("#production-items .invoice-product-group");
  if (firstGroup) {
    const specMat = firstGroup.querySelector(".spec-material");
    if (specMat && specMat.value) {
      material = specMat.options[specMat.selectedIndex]?.text || "";
    }
    if (!material) {
      const specs = JSON.parse(firstGroup.dataset?.specs || "{}");
      if (specs.material) {
        material = specs.material;
      } else {
        const prodVal = firstGroup.querySelector(".invoice-product")?.value || "";
        if (prodVal.includes("JERSEY")) material = "Jersey";
        else if (prodVal.includes("KAOS")) material = "Kaos";
        else if (prodVal.includes("KEMEJA")) material = "Kemeja";
      }
    }
  }
  document.getElementById("po-material").value = material;
  const subtotalEl = document.getElementById("po-subtotal");
  if (subtotalEl) subtotalEl.value = "Rp" + subtotal.toLocaleString("id-ID");
  const discount = Number(document.getElementById("po-discount")?.value || 0);
  const totalEl = document.getElementById("po-total");
  if (totalEl) totalEl.value = "Rp" + (subtotal - discount).toLocaleString("id-ID");
};

window.renderProductionItems = function (items) {
  const wrap = document.getElementById("production-items");
  wrap.innerHTML = "";
  const groups = {};
  (items || []).forEach((item) => {
    const prodKey = (item.product || "").trim().toUpperCase();
    if (!groups[prodKey]) groups[prodKey] = [];
    groups[prodKey].push(item);
  });
  Object.keys(groups).forEach((product) => {
    const grpItems = groups[product];
    window.addProductionItem();
    const group = wrap.lastElementChild;
    group.querySelector(".invoice-product").value = product;
    let specs = grpItems[0]?.specs;
    if (!specs) specs = parseProductSpecs(product);
    if (specs) {
      group.dataset.specs = JSON.stringify(specs);
      // Populate product builder dropdowns from specs
      const prodSelect = group.querySelector(".spec-product");
      const matSelect = group.querySelector(".spec-material");
      const catSelect = group.querySelector(".spec-category");
      const colSelect = group.querySelector(".spec-color");
      const slvSelect = group.querySelector(".spec-sleeve");
      const colrSelect = group.querySelector(".spec-collar");
      const addSelect = group.querySelector(".spec-addon");
      if (specs.product && prodSelect) {
        prodSelect.value = specs.product;
        window.changeProductTemplate(prodSelect);
        if (specs.category && catSelect) catSelect.value = specs.category;
        if (specs.material && matSelect) matSelect.value = specs.material;
        if (specs.color && colSelect) colSelect.value = specs.color;
        if (specs.sleeve && slvSelect) slvSelect.value = specs.sleeve;
        if (specs.collar && colrSelect) colrSelect.value = specs.collar;
        if (specs.addon && addSelect) addSelect.value = specs.addon;
      }
    }
    const mode = grpItems[0]?.priceMode || "auto";
    const modeSelect = group.querySelector(".invoice-mode-select");
    modeSelect.value = mode;
    if (grpItems[0]?.discountPerPcs) {
      const dInput = group.querySelector(".invoice-mode-discount");
      dInput.value = grpItems[0].discountPerPcs;
      dInput.style.display = "";
    }
    const sizeWrap = group.querySelector(".size-wrapper");
    sizeWrap.innerHTML = "";
    grpItems.forEach((item) => {
      const itemMode = item.priceMode || "auto";
      sizeWrap.insertAdjacentHTML("beforeend", `<div class="invoice-item-row" data-price-mode="${itemMode}"><span class="drag-handle"><i class="ri-draggable"></i></span><select class="input invoice-size" onchange="updateProductionTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select><input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateProductionTotals()"><input type="number" class="input invoice-price" placeholder="0" min="0" ${itemMode === "manual" ? "" : "readonly"} oninput="updateProductionTotals(true)"><input class="input invoice-total" readonly value="Rp0"><button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeProductionItem(this)"><i class="ri-delete-bin-line"></i></button></div>`);
      const row = sizeWrap.lastElementChild;
      row.querySelector(".invoice-size").value = item.size || "";
      row.querySelector(".invoice-qty").value = item.qty || 1;
      row.querySelector(".invoice-price").value = item.price || 0;
    });
  });
  updateProductionTotals();
};

async function saveProductionOrder() {
  const customer = document.getElementById("po-customer").value.trim();
  if (!customer) return showToast("Lengkapi nama pelanggan", "error");
  const items = window.collectProductionItems();
  const subtotal = Number(document.getElementById("po-subtotal").value.replace(/[^\d]/g, "")) || 0;
  const discount = Number(document.getElementById("po-discount").value) || 0;
  const total = Number(document.getElementById("po-total").value.replace(/[^\d]/g, "")) || 0;
  const prodData = { customer, team: document.getElementById("po-team").value, qty: document.getElementById("po-qty").value, material: document.getElementById("po-material").value, deadline: document.getElementById("po-deadline").value, notes: document.getElementById("po-notes").value, items, subtotal, discount, total };
  try {
    if (prodState.editId) {
      await updateDoc(doc(db, "production_orders", prodState.editId), { ...prodData });
      if (window._prodLinkedInvoiceId) {
        await updateDoc(doc(db, "invoices", window._prodLinkedInvoiceId), { items, subtotal, discount, total, customer: prodData.customer, note: prodData.notes });
        showToast("Data produksi & invoice tersimpan");
      } else {
        showToast("Data produksi tersimpan");
      }
    } else {
      const docRef = await addDoc(collection(db, "production_orders"), { ...prodData, stage: "design", createdAt: serverTimestamp() });
      if (window._pendingProductionInvoiceId) {
        await updateDoc(doc(db, "invoices", window._pendingProductionInvoiceId), { productionId: docRef.id });
        window._pendingProductionInvoiceId = null;
      }
      showToast("Pesanan produksi bertambah");
    }
    closeModal("modal-production");
    ["po-customer", "po-team", "po-qty", "po-material", "po-deadline", "po-notes", "po-subtotal", "po-discount", "po-total"].forEach((id) => document.getElementById(id).value = "");
    document.getElementById("production-items").innerHTML = "";
    prodState.editId = null;
    window._prodLinkedInvoiceId = null;
  } catch (err) { console.error(err); showToast("Penyimpanan gagal, coba lagi", "error"); }
}
async function nextProductionStage(id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  const ci = ["design", "printing", "jahit", "qc", "done"].indexOf(order.stage);
  if (ci < 4) { await updateDoc(doc(db, "production_orders", id), { stage: ["design", "printing", "jahit", "qc", "done"][ci + 1] }); showToast("Status produksi diperbarui"); }
}
async function prevProductionStage(id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  const ci = ["design", "printing", "jahit", "qc", "done"].indexOf(order.stage);
  if (ci > 0) { await updateDoc(doc(db, "production_orders", id), { stage: ["design", "printing", "jahit", "qc", "done"][ci - 1] }); showToast("Status produksi diperbarui"); }
}
async function markProductionDone(id) { await updateDoc(doc(db, "production_orders", id), { stage: "done" }); showToast("Pesanan produksi selesai"); }
async function deleteProductionOrder(id) { if (!confirm("Hapus pesanan produksi ini?")) return; try { await deleteDoc(doc(db, "production_orders", id)); showToast("Berhasil dihapus", "info"); } catch (err) { showToast("Hapus gagal, coba lagi", "error"); } }
function openEditProduction(id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  prodState.editId = id;
  document.getElementById("po-customer").value = order.customer || "";
  document.getElementById("po-team").value = order.team || "";
  document.getElementById("po-qty").value = order.qty || "";
  document.getElementById("po-material").value = order.material || "";
  document.getElementById("po-deadline").value = order.deadline || "";
  document.getElementById("po-notes").value = order.notes || "";
  document.getElementById("po-discount").value = order.discount || 0;
  document.getElementById("po-subtotal").value = order.subtotal ? "Rp" + Number(order.subtotal).toLocaleString("id-ID") : "";
  document.getElementById("po-total").value = order.total ? "Rp" + Number(order.total).toLocaleString("id-ID") : "";
  if (order.items && order.items.length) {
    window.renderProductionItems(order.items);
  }
  if (order.invoiceId) {
    window._prodLinkedInvoiceId = order.invoiceId;
  }
  document.getElementById("po-modal-title").textContent = "Edit Produksi";
  openModal("modal-production");
}

window.openProductionNote = function (id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  document.getElementById("production-note-id").value = id;
  document.getElementById("production-note-text").value = order.notes || "";
  openModal("modal-production-note");
};
window.saveProductionNote = function () {
  const id = Number(document.getElementById("production-note-id").value);
  const orders = window.firebaseProductionOrders || [];
  const order = orders.find((o) => o.id === id);
  if (order) { order.notes = document.getElementById("production-note-text").value.trim(); closeModal("modal-production-note"); showToast("Catatan tersimpan"); }
};

/* ============================================================= */
/* HISTORY CRUD (localStorage)                                    */
/* ============================================================= */
function deleteHistory(id) {
  if (!confirm("Hapus riwayat ini?")) return;
  deleteHistoryById(id);
  showToast("Riwayat dihapus", "info");
  renderCostingHistory();
}
function loadHistory() { renderCostingHistory(); }

/* Parse product name string into specs object */
function parseProductSpecs(productName) {
  if (!productName) return null;
  const parts = productName.split("|");
  if (parts.length < 2) return null;
  const specStr = parts[1].trim().toUpperCase();
  const specs = { product: "", category: "", color: "", material: "", sleeve: "", collar: "", addon: "" };
  
  // Detect product type
  if (specStr.startsWith("ATASAN JERSEY") || specStr.startsWith("SETELAN JERSEY")) {
    specs.product = "JERSEY";
    const tokens = specStr.split(" ");
    // First token is category (ATASAN JERSEY / SETELAN JERSEY)
    if (tokens[0] === "ATASAN" && tokens[1] === "JERSEY") {
      specs.category = "ATASAN JERSEY";
    } else if (tokens[0] === "SETELAN" && tokens[1] === "JERSEY") {
      specs.category = "SETELAN JERSEY";
    }
    // Find material, collar, sleeve
    tokens.forEach((t, i) => {
      if (["MILANO", "BINTIK BRAZIL", "PUMA", "AIRWALK", "EMBOSS"].includes(t)) specs.material = t;
      if (["O-NECK", "V-NECK", "V-VARIASI", "V-POTONG", "POLO V-NECK", "KERAH POLO"].includes(t)) specs.collar = t;
      if (["PENDEK", "PANJANG"].includes(t)) specs.sleeve = t;
      if (["OVERSIZE"].includes(t)) specs.addon = t;
    });
  } else if (specStr.startsWith("KAOS")) {
    specs.product = "KAOS";
    specs.color = "";
    specs.material = "";
    specs.sleeve = "";
    specs.addon = "";
    const tokens = specStr.split(" ");
    tokens.forEach((t, i) => {
      if (["HITAM", "PUTIH", "MERAH", "MAROON", "NAVY", "BIRU BENHUR", "ABU"].includes(t)) specs.color = t;
      if (["30S", "24S", "20S"].includes(t)) specs.material = "COTTON COMBED " + t;
      if (["PENDEK", "PANJANG", "3/4", "7/8"].includes(t)) specs.sleeve = t;
      if (["OVERSIZE"].includes(t)) specs.addon = t;
    });
    // If material not found, default
    if (!specs.material) specs.material = "COTTON COMBED 30S";
  } else if (specStr.startsWith("KEMEJA")) {
    specs.product = "KEMEJA";
    specs.material = "";
    specs.sleeve = "";
    specs.addon = "";
    const tokens = specStr.split(" ");
    tokens.forEach((t, i) => {
      if (["AMERICAN DRILL", "NAGATA DRILL", "RIPSTOP"].includes(t)) specs.material = t;
      if (["PENDEK", "PANJANG"].includes(t)) specs.sleeve = t;
      if (["TAMBAH TITIK BORDIR"].includes(t)) specs.addon = t;
    });
    if (!specs.material) specs.material = "AMERICAN DRILL";
  }
  return specs;
}
window.collectInvoiceItems = function () {
  const items = [];
  document.querySelectorAll(".invoice-product-group").forEach((group) => {
    const product = group.querySelector(".invoice-product")?.value.trim() || "";
    const mode = group.querySelector(".invoice-mode-select")?.value || "auto";
    const discountPerPcs = Number(group.querySelector(".invoice-mode-discount")?.value) || 0;
    const specs = group.dataset.specs ? JSON.parse(group.dataset.specs) : null;
    if (!product) return;
    group.querySelectorAll(".invoice-item-row").forEach((row) => {
      const size = row.querySelector(".invoice-size")?.value.trim() || "";
      const qty = Number(row.querySelector(".invoice-qty")?.value) || 0;
      const price = Number(row.querySelector(".invoice-price")?.value) || 0;
      if (!size && !qty) return;
      items.push({ product, size, qty, price, total: qty * price, priceMode: mode, discountPerPcs, specs });
    });
  });
  return items;
};

/* ===================== INVOICE ITEM GROUP ===================== */

window.changePriceMode = function (select) {
  const group = select.closest(".invoice-product-group");
  const mode = select.value;
  const discountInput = group.querySelector(".invoice-mode-discount");
  const rows = group.querySelectorAll(".invoice-item-row");
  discountInput.style.display = mode === "auto-discount" ? "" : "none";
  rows.forEach((row) => {
    row.dataset.priceMode = mode;
    const priceInput = row.querySelector(".invoice-price");
    if (mode === "auto" || mode === "auto-discount") {
      priceInput.readOnly = true;
    } else {
      priceInput.readOnly = false;
    }
  });
  updateInvoiceTotals();
};

window.addInvoiceItem = function () {
  const wrap = document.getElementById("invoice-items");
  if (!wrap) return;
  const idx = Date.now();
  wrap.insertAdjacentHTML("beforeend", `
<div class="invoice-product-group" data-group-idx="${idx}">
  <div class="invoice-product-wrap">
    <div class="invoice-product-wrap-row">
      <input class="input invoice-product" placeholder="Nama Produk" oninput="this.value=this.value.toUpperCase();updateInvoiceTotals();">
      <button type="button" class="product-builder-btn" onclick="toggleProductBuilder(this)"><i class="ri-ai-generate-text"></i></button>
    </div>
    <div class="product-builder-panel">
      <select class="input spec-product" onchange="changeProductTemplate(this)"><option value="JERSEY">JERSEY CUSTOM</option><option value="KAOS">KAOS CUSTOM</option><option value="KEMEJA">KEMEJA CUSTOM</option></select>
      <select class="input spec-category jersey-field"><option value="ATASAN JERSEY">ATASAN JERSEY</option><option value="SETELAN JERSEY">SETELAN JERSEY</option></select>
      <select class="input spec-material"></select>
      <select class="input spec-color kaos-field" style="display:none"><option value="">PILIH WARNA</option><option value="HITAM">HITAM</option><option value="PUTIH">PUTIH</option><option value="ABU">ABU</option><option value="BIRU BENHUR">BIRU BENHUR</option><option value="MAROON">MAROON</option><option value="MERAH">MERAH</option><option value="NAVY">NAVY</option></select>
      <select class="input spec-sleeve"><option value="PENDEK">PENDEK</option><option value="PANJANG">PANJANG +10K</option></select>
      <select class="input spec-collar jersey-field"><option value="O-NECK">O-NECK</option><option value="V-NECK">V-NECK</option><option value="V-VARIASI">V-VARIASI</option><option value="V-POTONG">V-POTONG</option><option value="POLO V-NECK">POLO V-NECK +5K</option><option value="KERAH POLO">KERAH POLO +10K</option></select>
      <select class="input spec-addon"><option value="">TANPA ADDON</option></select>
      <button type="button" class="btn btn-sm" onclick="applyProductSpec(this)"><i class="ri-check-line"></i> PAKAI TEMPLATE</button>
    </div>
  </div>
  <div class="invoice-mode-bar">
    <select class="input invoice-mode-select" onchange="changePriceMode(this)">
      <option value="auto">AUTO</option>
      <option value="auto-discount">AUTO - DISKON</option>
      <option value="manual">MANUAL</option>
    </select>
    <input class="input invoice-mode-discount" type="number" placeholder="Diskon/pcs" min="0" style="display:none" oninput="updateInvoiceTotals()">
  </div>
  <div class="invoice-size-header">
    <span class="isize-drag"></span>
    <span class="isize-size">Ukuran</span>
    <span class="isize-qty">Jml</span>
    <span class="isize-price">Harga</span>
    <span class="isize-total">Total</span>
    <span class="isize-del"></span>
  </div>
  <div class="size-wrapper">
    <div class="invoice-item-row" data-price-mode="auto">
      <span class="drag-handle"><i class="ri-draggable"></i></span>
      <select class="input invoice-size" onchange="updateInvoiceTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select>
      <input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateInvoiceTotals()">
      <input type="number" class="input invoice-price" placeholder="0" min="0" readonly oninput="updateInvoiceTotals(true)">
      <input class="input invoice-total" readonly value="Rp0">
      <button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeInvoiceItem(this)"><i class="ri-delete-bin-line"></i></button>
    </div>
  </div>
  <button type="button" class="btn btn-sm btn-add-size" onclick="addInvoiceSize(this)">+ TAMBAH UKURAN</button>
</div>`);
  updateInvoiceTotals();
  initSortable(wrap.lastElementChild);
  const newRow = wrap.lastElementChild;
  if (newRow) newRow.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.addInvoiceSize = function (btn) {
  const group = btn.closest(".invoice-product-group");
  const wrap = group.querySelector(".size-wrapper");
  const mode = group.querySelector(".invoice-mode-select")?.value || "auto";
  wrap.insertAdjacentHTML("beforeend", `<div class="invoice-item-row" data-price-mode="${mode}"><span class="drag-handle"><i class="ri-draggable"></i></span><select class="input invoice-size" onchange="updateInvoiceTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select><input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateInvoiceTotals()"><input type="number" class="input invoice-price" placeholder="0" min="0" ${mode === "manual" ? "" : "readonly"} oninput="updateInvoiceTotals(true)"><input class="input invoice-total" readonly value="Rp0"><button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeInvoiceItem(this)"><i class="ri-delete-bin-line"></i></button></div>`);
  updateInvoiceTotals();
};

window.removeInvoiceItem = function (button) {
  const row = button.closest(".invoice-item-row");
  if (!row) return;
  const group = button.closest(".invoice-product-group");
  const target = row.previousElementSibling || row.nextElementSibling || group || document.getElementById("invoice-items");
  row.remove();
  if (group && group.querySelectorAll(".invoice-item-row").length === 0) group.remove();
  updateInvoiceTotals();
  if (target && document.body.contains(target)) target.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.updateInvoiceTotals = function (manualPrice = false) {
  let subtotal = 0;
  document.querySelectorAll(".invoice-item-row").forEach((row) => {
    const group = row.closest(".invoice-product-group");
    const product = group ? group.querySelector(".invoice-product")?.value || "" : "";
    const size = row.querySelector(".invoice-size")?.value || "";
    const qtyInput = row.querySelector(".invoice-qty");
    const priceInput = row.querySelector(".invoice-price");
    const totalInput = row.querySelector(".invoice-total");
    const qty = Number(qtyInput?.value || 0);
    const mode = group ? (group.querySelector(".invoice-mode-select")?.value || "auto") : row.dataset.priceMode || "auto";
    row.dataset.priceMode = mode;
    if (manualPrice && mode === "manual") {
      row.dataset.manualPrice = parseFloat(priceInput?.value) || 0;
    }
    if ((mode === "auto" || mode === "auto-discount") && priceInput) {
      let autoPrice = 0;
      const specs = JSON.parse(group?.dataset?.specs || "{}");
      if (specs.product) {
        const pt = specs.product.toLowerCase();
        const mat = specs.material || "";
        const cat = specs.category || "";
        const slv = (specs.sleeve || "PENDEK").toLowerCase();
        const col = specs.collar || "";
        const add = specs.addon || "";
        autoPrice = getProductBasePrice(pt, { qty: qty || 1, material: mat, category: cat, sleeve: slv });
        const matRules = MASTER_PRICE_DATABASE.materials[pt];
        if (matRules) {
          const mSearch = mat.toLowerCase();
          for (const k in matRules) { if (mSearch.includes(k)) { autoPrice += matRules[k]; break; } }
        }
        const allAddons = MASTER_PRICE_DATABASE.addons[pt];
        if (allAddons) {
          if (col) {
            const ck = col.toLowerCase().trim();
            for (const sec in allAddons) { if (allAddons[sec][ck] !== undefined) { autoPrice += allAddons[sec][ck]; break; } }
          }
          if (add) {
            const ak = add.toLowerCase().trim();
            for (const sec in allAddons) { if (allAddons[sec][ak] !== undefined) { autoPrice += allAddons[sec][ak]; break; } }
          }
          if (slv !== "pendek" && MASTER_PRICE_DATABASE.products[pt]?.pricingModel !== "matrix") {
            for (const sec in allAddons) { if (allAddons[sec][slv] !== undefined) { autoPrice += allAddons[sec][slv]; break; } }
          }
        }
        const sRules = MASTER_PRICE_DATABASE.sizeCharges.global_apparel;
        if (size && sRules[size] !== undefined) autoPrice += sRules[size];
      } else {
        if (product.includes("JERSEY")) autoPrice = 75000;
        else if (product.includes("KAOS")) autoPrice = 55000;
        else if (product.includes("KEMEJA")) autoPrice = 85000;
      }
      const discountPerPcs = Number(group?.querySelector(".invoice-mode-discount")?.value) || 0;
      priceInput.value = autoPrice - discountPerPcs;
    }
    const price = Number(priceInput?.value || 0);
    const total = qty * price;
    if (totalInput) totalInput.value = "Rp" + total.toLocaleString("id-ID");
    subtotal += total;
  });
  const subtotalEl = document.getElementById("invoice-subtotal");
  if (subtotalEl) subtotalEl.value = "Rp" + subtotal.toLocaleString("id-ID");
  const discount = Number(document.getElementById("invoice-discount")?.value || 0);
  const totalEl = document.getElementById("invoice-total");
  if (totalEl) totalEl.value = "Rp" + (subtotal - discount).toLocaleString("id-ID");
};

/* Invoice product builder */
window.toggleProductBuilder = function (btn) {
  const panel = btn.closest(".invoice-product-wrap").querySelector(".product-builder-panel");
  if (!panel) return;
  const wasHidden = !panel.classList.contains("show");
  panel.classList.toggle("show");
  if (wasHidden) {
    const material = panel.querySelector(".spec-material");
    if (material && material.options.length === 0) {
      const productSelect = panel.querySelector(".spec-product");
      if (productSelect) changeProductTemplate(productSelect);
    }
  }
};

window.changeProductTemplate = function (select) {
  const panel = select.closest(".product-builder-panel");
  const type = select.value;
  const material = panel.querySelector(".spec-material");
  const addon = panel.querySelector(".spec-addon");
  const jerseyFields = panel.querySelectorAll(".jersey-field");
  const kaosFields = panel.querySelectorAll(".kaos-field");
  material.innerHTML = "";
  addon.innerHTML = `<option value="">TANPA ADDON</option>`;
  if (type === "JERSEY") {
    jerseyFields.forEach((el) => el.style.display = "block");
    kaosFields.forEach((el) => el.style.display = "none");
    material.innerHTML = `<option value="MILANO">MILANO</option><option value="BINTIK BRAZIL">BINTIK BRAZIL</option><option value="PUMA">PUMA</option><option value="AIRWALK">AIRWALK +10K</option><option value="EMBOSS">EMBOSS +10K</option>`;
    addon.innerHTML += `<option value="OVERSIZE">OVERSIZE +5K</option>`;
  }
  if (type === "KAOS") {
    jerseyFields.forEach((el) => el.style.display = "none");
    kaosFields.forEach((el) => el.style.display = "block");
    material.innerHTML = `<option value="COTTON COMBED 30S">COTTON COMBED 30S</option><option value="COTTON COMBED 24S">COTTON COMBED 24S</option><option value="COTTON COMBED 20S">COTTON COMBED 20S</option>`;
    addon.innerHTML += `<option value="OVERSIZE">OVERSIZE +5K</option><option value="3/4">LENGAN 3/4 +5K</option><option value="7/8">LENGAN 7/8 +5K</option>`;
  }
  if (type === "KEMEJA") {
    jerseyFields.forEach((el) => el.style.display = "none");
    kaosFields.forEach((el) => el.style.display = "none");
    material.innerHTML = `<option value="AMERICAN DRILL">AMERICAN DRILL</option><option value="NAGATA DRILL">NAGATA DRILL</option><option value="RIPSTOP">RIPSTOP</option>`;
    addon.innerHTML += `<option value="TAMBAH TITIK BORDIR">TAMBAH BORDIR +10K</option>`;
  }
};

window.applyProductSpec = function (btn) {
  const wrap = btn.closest(".invoice-product-wrap");
  const name = wrap.querySelector(".invoice-product");
  const product = wrap.querySelector(".spec-product").value;
  const category = wrap.querySelector(".spec-category").value;
  const color = wrap.querySelector(".spec-color")?.value || "";
  const material = wrap.querySelector(".spec-material").value;
  const sleeve = wrap.querySelector(".spec-sleeve").value;
  const collar = wrap.querySelector(".spec-collar").value;
  const addon = wrap.querySelector(".spec-addon").value;
  const parts = [];
  if (product === "JERSEY") {
    if (category) parts.push(category);
    if (material) parts.push(material);
    if (collar) parts.push(collar);
    if (sleeve) parts.push(sleeve);
    if (addon) parts.push(addon);
  } else if (product === "KAOS") {
    parts.push("KAOS");
    if (color) parts.push(color);
    if (material) parts.push(material.replace(/^COTTON COMBED /, ""));
    if (sleeve) parts.push(sleeve);
    if (addon) parts.push(addon);
  } else if (product === "KEMEJA") {
    parts.push("KEMEJA");
    if (material) parts.push(material);
    if (sleeve) parts.push(sleeve);
    if (addon) parts.push(addon);
  }
  // Preserve existing title (text before |), if any
  const existingTitle = name.value.split("|")[0]?.trim() || "";
  const title = existingTitle || product; // fallback to product type if no title
  name.value = title + " | " + parts.join(" ");
  const group = btn.closest(".invoice-product-group");
  if (group) {
    group.dataset.specs = JSON.stringify({
      product, category, color, material, sleeve, collar, addon
    });
  }
  wrap.querySelector(".product-builder-panel").classList.remove("show");
  if (btn.closest("#production-items")) {
    updateProductionTotals();
  } else {
    updateInvoiceTotals();
  }
};

/* SortableJS initialization */
function initSortable(container) {
  if (typeof Sortable === "undefined") return;
  const sw = container?.querySelector(".size-wrapper") || container;
  if (!sw || sw.sortableInstance) return;
  sw.sortableInstance = Sortable.create(sw, {
    animation: 150,
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    onEnd: () => updateInvoiceTotals(),
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".size-wrapper").forEach(initSortable);
});

/* Invoice generation & preview */
window.generateInvoiceHTML = function (invoiceData) {
  const customer = invoiceData?.customer || "-";
  const invoiceNo = invoiceData?.invoiceNo || "-";
  const date = invoiceData?.date ? formatInvoiceDate(invoiceData.date) : "-";
  const items = invoiceData?.items || [];
  const subtotal = invoiceData?.subtotal || 0;
  const discount = invoiceData?.discount || 0;
  const total = invoiceData?.total || 0;
  const note = invoiceData?.note || "";
  let tableRows = items.map((item, index) => {
    const originalProduct = item.product || "-";
    let displayTitle = originalProduct;
    let displaySubtitle = "";
    if (originalProduct.includes("|")) { const parts = originalProduct.split("|"); displayTitle = parts[0].trim(); displaySubtitle = parts[1].trim(); }
    return `<tr><td class="col-no">${index + 1}</td><td class="col-product"><div class="table-title">${displayTitle}</div>${displaySubtitle ? `<div class="table-subtitle">${displaySubtitle}</div>` : ""}</td><td class="col-size">${item.size || "-"}</td><td class="col-qty">${item.qty || 0}</td><td class="col-price">${formatRupiah(item.price || 0)}</td><td class="col-total">${formatRupiah((item.qty || 0) * (item.price || 0))}</td></tr>`;
  }).join("");
  if (items.length < 5) {
    tableRows += `<tr class="empty-row"><td colspan="6"></td></tr>`;
  }
  return `<div class="invoice">
<header class="invoice-header">
  <div class="invoice-header__label"><img class="text-vertical" src="/text-invoice.svg" alt="Invoice" onerror="this.style.display='none'"></div>
  <div class="invoice-header__left-group">
    <div class="invoice-header__company"><img class="company-logo" src="/logo-progress.svg" alt="Progress Logo" onerror="this.style.display='none'"><div class="company-info"><h1 class="company-name">PROGRESS PRINTSHOP</h1><p class="company-tagline">ISOLATED PRINT STUDIO IN THE WILD</p></div></div>
    <div class="invoice-header__contact"><div class="contact-item">Pacul Village, Talang, Tegal, Central Java, Indonesia</div><div class="contact-item"><i class="ri-instagram-line"></i> @progressprintshop | <i class="ri-whatsapp-line"></i> +62 882 3254 8532</div></div>
  </div>
  <div class="invoice-header__right-group">
    <div class="total-card">
      <div class="total-card__inner"><span class="total-card__label">TOTAL TAGIHAN</span><span class="total-card__value">${formatRupiah(total)}</span></div>
      <div class="total-card__client"><span class="total-card__customer-label">CUSTOMER</span><span class="total-card__customer">${customer.toUpperCase()}</span></div>
    </div>
  </div>
</header>
<section class="invoice-info">
  <div class="info-item"><div class="info-label">NO. ORDER</div><div class="info-value">${invoiceNo}</div></div>
  <div class="info-item"><div class="info-label">TANGGAL</div><div class="info-value">${date}</div></div>
</section>
<section class="invoice-items">
  <table class="items-table"><thead><tr><th class="col-no">NO</th><th class="col-product">DESKRIPSI PRODUK</th><th class="col-size">UKURAN</th><th class="col-qty">JUMLAH</th><th class="col-price">HARGA SATUAN</th><th class="col-total">TOTAL</th></tr></thead><tbody>${tableRows}</tbody></table>
</section>
<section class="invoice-summary-inv">
  <div class="summary-left">
    <div class="summary-block-inv">
      <div class="summary-title">INFO PEMBAYARAN</div>
      <div class="summary-text">
        <div class="payment-item">
          <i class="ri-bank-line"></i>
          <div class="payment-detail">
            <span class="payment-label">BNI</span>
            <span>1147 337 270</span>
            <span>Sdr. DANNY PRATAMA FIRMANSYAH</span>
          </div>
        </div>
        <div class="payment-item">
          <i class="ri-wallet-3-line"></i>
          <div class="payment-detail">
            <span class="payment-label">DANA</span>
            <span>0882 3254 8532</span>
          </div>
        </div>
      </div>
    </div>
    <div class="summary-block-inv">
      <div class="summary-title">TERM & CONDITION</div>
      <div class="summary-text">We guarantee that every product we work on is the best product, rich with history and passion. So wear it with pride. Thank you!</div>
    </div>
    <div class="summary-block-inv">
      <div class="summary-title">CATATAN TAMBAHAN</div>
      <div class="summary-text">${note || "Tidak ada catatan"}</div>
    </div>
  </div>
  <div class="summary-right">
    <div class="totals">
      <div class="total-row"><span class="total-label">Subtotal</span><span class="total-value">${formatRupiah(subtotal)}</span></div>
      <div class="total-row"><span class="total-label">Diskon</span><span class="total-value">-${formatRupiah(discount)}</span></div>
      <div class="grand-total"><span class="grand-total-label">TOTAL KESELURUHAN</span><span class="grand-total-value">${formatRupiah(total)}</span></div>
    </div>
    <div class="signature-area">
      <div class="signature"><img class="signature-image" src="https://i.ibb.co.com/5XyQZCyD/SIGNATURE-PROGRESS.png" alt="Tanda Tangan Progress" onerror="this.style.display='none'"><div class="signature-line"></div><div class="signature-title"><strong>Danny Pratama</strong><br><span>Founder & Graphic Designer</span></div></div>
    </div>
  </div>
</section>
</div>`;
};

window.renderInvoiceToPaper = function (invoiceData) {
  const paper = document.getElementById("invoice-paper");
  if (!paper) return;
  paper.innerHTML = window.generateInvoiceHTML(invoiceData);
};

/* Invoice preview & zoom */
window.currentPreviewInvoice = null;
window.invoiceZoom = 1;

window.previewInvoice = function () {
  openModal("modal-preview-invoice");
  requestAnimationFrame(() => {
    window.invoiceZoom = 1;
    updateInvoiceZoom();
    autoFitInvoice();
    const canvas = document.querySelector(".invoice-canvas");
    if (canvas) canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
  });
};

function updateInvoiceZoom() {
  const paper = document.getElementById("invoice-paper");
  if (!paper) return;
  paper.style.transform = `scale(${window.invoiceZoom})`;
  paper.style.transformOrigin = "center";
  document.getElementById("invoice-zoom-value").textContent = Math.round(window.invoiceZoom * 100) + "%";
}
window.zoomInInvoice = function () { window.invoiceZoom = Math.min(window.invoiceZoom + 0.1, 2); updateInvoiceZoom(); };
window.zoomOutInvoice = function () { window.invoiceZoom = Math.max(window.invoiceZoom - 0.1, 0.3); updateInvoiceZoom(); };
window.fitInvoiceWidth = function () { autoFitInvoice(); };
function autoFitInvoice() {
  const canvas = document.querySelector(".invoice-canvas");
  const paper = document.getElementById("invoice-paper");
  if (!canvas || !paper) return;
  const paperH = paper.scrollHeight || 1123;
  const scaleByHeight = (canvas.clientHeight - 40) / paperH;
  const scaleByWidth = (canvas.clientWidth - 40) / 794;
  window.invoiceZoom = Math.min(scaleByHeight, scaleByWidth, 0.95);
  updateInvoiceZoom();
}

window.downloadInvoiceAsImage = function () {
  const originalElement = document.getElementById("invoice-paper");
  if (!originalElement) { alert("Area cetak invoice tidak ditemukan!"); return; }
  const invoiceNumberElement = document.querySelector(".invoice-info .info-value");
  const invoiceNumber = invoiceNumberElement?.innerText?.trim() || "";
  if (!invoiceNumber) { alert("Nomor invoice tidak ditemukan!"); return; }
  const fileName = `PROGRESS-${invoiceNumber}.png`;
  const downloadBtn = document.querySelector('[onclick="downloadInvoiceAsImage()"]');
  if (!downloadBtn) return;
  const originalBtnHtml = downloadBtn.innerHTML;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `<i class="ri-loader-4-line animate-spin text-lg"></i> RENDERING IMAGE...`;
  const cloneElement = originalElement.cloneNode(true);
  cloneElement.style.transform = "none";
  cloneElement.style.transformOrigin = "unset";
  cloneElement.style.position = "fixed";
  cloneElement.style.top = "-9999px";
  cloneElement.style.left = "-9999px";
  document.body.appendChild(cloneElement);
  const opt = { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", width: originalElement.offsetWidth, height: originalElement.offsetHeight };
  html2canvas(cloneElement, opt).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = imgData;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    document.body.removeChild(cloneElement);
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalBtnHtml;
  }).catch((err) => {
    console.error("Gagal merender gambar:", err);
    alert("Terjadi kesalahan saat memproses gambar invoice.");
    if (document.body.contains(cloneElement)) document.body.removeChild(cloneElement);
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalBtnHtml;
  });
};

/* Invoice modal open/close */
window.generateNextInvoiceNumber = async function () {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `INV-${mm}${yy}-`;
  try {
    const invoiceRef = collection(db, "invoices");
    const q = query(invoiceRef, where("invoiceNo", ">=", prefix), where("invoiceNo", "<=", prefix + "\uf8ff"));
    const querySnapshot = await getDocs(q);
    let maxCount = 0;
    querySnapshot.forEach((d) => { const invNum = d.data().invoiceNo; if (invNum && invNum.startsWith(prefix)) { const c = parseInt(invNum.replace(prefix, ""), 10); if (!isNaN(c) && c > maxCount) maxCount = c; } });
    return `${prefix}${String(maxCount + 1).padStart(2, "0")}`;
  } catch (error) { return `${prefix}01`; }
};

/* ===================== PRODUCTION → INVOICE ===================== */

window.createInvoiceFromProduction = async function (id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return showToast("Pesanan produksi tidak ditemukan", "error");
  if (order.invoiceId) {
    window.openEditInvoice(order.invoiceId);
    return;
  }
  document.getElementById("invoice-customer").value = order.customer || "";
  document.getElementById("invoice-number").value = "";
  document.getElementById("invoice-number").readOnly = false;
  document.getElementById("invoice-date").value = getToday();
  document.getElementById("invoice-status").value = "draft";
  document.getElementById("invoice-discount").value = order.discount || 0;
  document.getElementById("invoice-note").value = order.notes || "";
  document.getElementById("invoice-items").innerHTML = "";
  window.editInvoiceId = null;
  window._pendingProductionId = id;
  if (order.items && order.items.length) {
    window.loadInvoiceItems(order.items);
    document.getElementById("invoice-subtotal").value = order.subtotal ? "Rp" + Number(order.subtotal).toLocaleString("id-ID") : "";
    document.getElementById("invoice-total").value = order.total ? "Rp" + Number(order.total).toLocaleString("id-ID") : "";
  } else {
    addInvoiceItem();
  }
  const invInput = document.getElementById("invoice-number");
  if (invInput) { invInput.value = await window.generateNextInvoiceNumber(); invInput.readOnly = true; }
  const modalTitle = document.querySelector("#modal-invoice .modal-title");
  if (modalTitle) modalTitle.innerHTML = '<i class="ri-file-add-line"></i> Invoice dari Produksi';
  openModal("modal-invoice");
};

window.loadInvoiceItems = function (items) {
  const wrap = document.getElementById("invoice-items");
  wrap.innerHTML = "";
  const groups = {};
  (items || []).forEach((item) => {
    const prodKey = (item.product || "").trim().toUpperCase();
    if (!groups[prodKey]) groups[prodKey] = [];
    groups[prodKey].push(item);
  });
  Object.keys(groups).forEach((product) => {
    const grpItems = groups[product];
    addInvoiceItem();
    const group = wrap.lastElementChild;
    group.querySelector(".invoice-product").value = product;
    const mode = grpItems[0]?.priceMode || "auto";
    const modeSelect = group.querySelector(".invoice-mode-select");
    modeSelect.value = mode;
    if (grpItems[0]?.discountPerPcs) {
      const dInput = group.querySelector(".invoice-mode-discount");
      dInput.value = grpItems[0].discountPerPcs;
      dInput.style.display = "";
    }
    if (grpItems[0]?.specs) {
      group.dataset.specs = JSON.stringify(grpItems[0].specs);
    } else {
      // Parse specs from product name if not saved
      const parsed = parseProductSpecs(product);
      if (parsed) group.dataset.specs = JSON.stringify(parsed);
    }
    const sizeWrap = group.querySelector(".size-wrapper");
    sizeWrap.innerHTML = "";
    grpItems.forEach((item) => {
      const itemMode = item.priceMode || "auto";
      sizeWrap.insertAdjacentHTML("beforeend", `<div class="invoice-item-row" data-price-mode="${itemMode}"><span class="drag-handle"><i class="ri-draggable"></i></span><select class="input invoice-size" onchange="updateInvoiceTotals()"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select><input type="number" class="input invoice-qty" placeholder="0" min="0" oninput="updateInvoiceTotals()"><input type="number" class="input invoice-price" placeholder="0" min="0" ${itemMode === "manual" ? "" : "readonly"} oninput="updateInvoiceTotals(true)"><input class="input invoice-total" readonly value="Rp0"><button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeInvoiceItem(this)"><i class="ri-delete-bin-line"></i></button></div>`);
      const row = sizeWrap.lastElementChild;
      row.querySelector(".invoice-size").value = item.size || "";
      row.querySelector(".invoice-qty").value = item.qty || 1;
      row.querySelector(".invoice-price").value = item.price || 0;
    });
  });
  updateInvoiceTotals();
};

async function prepareInvoiceModal() {
  document.getElementById("invoice-customer").value = "";
  document.getElementById("invoice-date").value = getToday();
  document.getElementById("invoice-status").value = "draft";
  document.getElementById("invoice-discount").value = "0";
  document.getElementById("invoice-note").value = "";
  const wrap = document.getElementById("invoice-items");
  if (wrap) wrap.innerHTML = "";
  window.editInvoiceId = null;
  window._pendingProductionId = null;
  const invInput = document.getElementById("invoice-number");
  if (invInput) { invInput.value = await window.generateNextInvoiceNumber(); invInput.readOnly = true; }
  updateInvoiceTotals();
}

window.openAddInvoiceModal = async function () {
  await prepareInvoiceModal();
  const modalTitle = document.querySelector("#modal-invoice .modal-title");
  if (modalTitle) modalTitle.innerHTML = '<i class="ri-file-add-line"></i> Tambah Invoice';
  const wrap = document.getElementById("invoice-items");
  if (wrap) wrap.innerHTML = "";
  addInvoiceItem();
  const invInput = document.getElementById("invoice-number");
  if (invInput) { invInput.value = await window.generateNextInvoiceNumber(); invInput.readOnly = true; }
  openModal("modal-invoice");
};

window.saveInvoice = async function () {
  const customer = document.getElementById("invoice-customer").value.trim();
  if (!customer) return showToast("Lengkapi nama customer", "error");
  const items = window.collectInvoiceItems();
  if (!items.length) return showToast("Minimal 1 item", "error");
  const subtotal = Number(document.getElementById("invoice-subtotal").value.replace(/[^\d]/g, "")) || 0;
  const discount = Number(document.getElementById("invoice-discount").value) || 0;
  const total = Number(document.getElementById("invoice-total").value.replace(/[^\d]/g, "")) || 0;
  const invoiceData = { customer, invoiceNo: document.getElementById("invoice-number").value, date: document.getElementById("invoice-date").value, status: document.getElementById("invoice-status").value, items, subtotal, discount, total, note: document.getElementById("invoice-note").value };
  if (window._pendingProductionId) {
    invoiceData.productionId = window._pendingProductionId;
  }
  try {
    if (window.editInvoiceId) {
      await updateDoc(doc(db, "invoices", window.editInvoiceId), { ...invoiceData, updatedAt: serverTimestamp() });
      if (window._pendingProductionId) {
        // Normalize invoice items to production format before saving to production order
        const productionItems = items.map(it => ({
          product: it.product,
          size: it.size,
          qty: it.qty,
          price: it.price,
          total: it.total,
          priceMode: it.priceMode || "auto",
          discountPerPcs: it.discountPerPcs || 0,
          specs: it.specs || null
        }));
        await updateDoc(doc(db, "production_orders", window._pendingProductionId), { invoiceId: window.editInvoiceId, items: productionItems, subtotal, discount, total });
      }
      showToast("Invoice tersimpan");
    } else {
      const docRef = await addDoc(collection(db, "invoices"), { ...invoiceData, createdAt: serverTimestamp() });
      if (window._pendingProductionId) {
        const productionItems = items.map(it => ({
          product: it.product,
          size: it.size,
          qty: it.qty,
          price: it.price,
          total: it.total,
          priceMode: it.priceMode || "auto",
          discountPerPcs: it.discountPerPcs || 0,
          specs: it.specs || null
        }));
        await updateDoc(doc(db, "production_orders", window._pendingProductionId), { invoiceId: docRef.id, items: productionItems, subtotal, discount, total });
      }
      showToast("Invoice baru tersimpan");
    }
    closeModal("modal-invoice", true);
    window._pendingProductionId = null;
    prepareInvoiceModal();
    renderInvoices();
  } catch (err) { console.error(err); showToast("Penyimpanan gagal, coba lagi", "error"); }
};

window.openEditInvoice = function (id) {
  const invoice = (window.firebaseInvoices || []).find((i) => i.id === id);
  if (!invoice) return;
  window.editInvoiceId = id;
  window._pendingProductionId = invoice.productionId || null;
  const modalTitle = document.querySelector("#modal-invoice .modal-title");
  if (invoice.productionId) {
    if (modalTitle) modalTitle.innerHTML = '<i class="ri-file-edit-line"></i> Edit Invoice <span style="font-size:11px;color:var(--color-info);font-weight:400;">(dari Produksi)</span>';
  } else {
    if (modalTitle) modalTitle.innerHTML = '<i class="ri-file-edit-line"></i> Edit Invoice';
  }
  document.getElementById("invoice-customer").value = invoice.customer || "";
  document.getElementById("invoice-number").value = invoice.invoiceNo || "";
  document.getElementById("invoice-number").readOnly = true;
  document.getElementById("invoice-date").value = invoice.date || "";
  document.getElementById("invoice-status").value = invoice.status || "draft";
  document.getElementById("invoice-discount").value = invoice.discount || 0;
  document.getElementById("invoice-note").value = invoice.note || "";
  window.loadInvoiceItems(invoice.items || []);
  openModal("modal-invoice");
};

window.openInvoicePreview = function (invoiceId) {
  const invoice = (window.firebaseInvoices || []).find((i) => i.id === invoiceId);
  if (!invoice) { showToast("Invoice tidak ditemukan", "error"); return; }
  window.currentPreviewInvoice = invoice;
  window.renderInvoiceToPaper(invoice);
  window.previewInvoice();
};

window.previewCurrentInvoice = function () {
  const customer = document.getElementById("invoice-customer")?.value || "";
  const invoiceNo = document.getElementById("invoice-number")?.value || "";
  const date = document.getElementById("invoice-date")?.value || "";
  const items = window.collectInvoiceItems();
  const subtotal = Number(document.getElementById("invoice-subtotal")?.value.replace(/[^\d]/g, "") || 0);
  const discount = Number(document.getElementById("invoice-discount")?.value || 0);
  const total = Number(document.getElementById("invoice-total")?.value.replace(/[^\d]/g, "") || 0);
  const note = document.getElementById("invoice-note")?.value || "";
  window.renderInvoiceToPaper({ customer, invoiceNo, date, items, subtotal, discount, total, note });
  window.previewInvoice();
};

/* Invoice list rendering */
window.renderInvoices = function () {
  let invoices = window.firebaseInvoices || [];
  const tbody = document.getElementById("invoice-tbody");
  const mobileList = document.getElementById("invoice-mobile-list");
  if (!tbody) return;
  const search = (document.getElementById("invoice-search")?.value || "").toLowerCase();
  const filter = document.getElementById("invoice-filter")?.value || "all";
  if (search) invoices = invoices.filter((i) => (i.customer || "").toLowerCase().includes(search) || (i.invoiceNo || "").toLowerCase().includes(search));
  if (filter !== "all") invoices = invoices.filter((i) => i.status === filter);
  const totalRows = invoices.length;
  const p = paginate(invoices, pagination.invoices);
  const visible = p.items;
  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ri-file-list-3-line"></i>Belum ada Invoice</div></td></tr>`;
    if (mobileList) mobileList.innerHTML = "";
    renderPagination("invoice-pagination", 1, 1, "changeInvoicePage", 0);
    return;
  }
  tbody.innerHTML = visible.map((o, index) => {
    const rowNumber = totalRows - ((p.page - 1) * 5 + index);
    const avatar = getAvatarPalette(o.customer || "");
    const prodBadge = o.productionId ? '<span class="tag-prod" title="Dari Produksi"><i class="ri-link"></i></span>' : "";
    const firstProduct = (o.items?.[0]?.product || o.invoiceNo).split("|")[0].trim();
    return `<tr><td class="table-number">${rowNumber}</td><td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${o.customer} ${prodBadge}</div><div class="table-subtitle">${o.invoiceNo}</div></div></div></td><td><div class="table-title">${firstProduct}</div></td><td><div class="table-title">${o.date || "-"}</div></td><td><div class="table-title">${formatRupiah(o.total)}</div></td><td><span class="badge-status ${o.status === "paid" ? "badge-done" : "badge-design"}">${o.status === "paid" ? "LUNAS" : "DP"}</span></td><td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openInvoicePreview('${o.id}')"><i class="ri-eye-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditInvoice('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteInvoice('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td></tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => `<div class="history-mobile-item"><div class="history-mobile-head"><div><div class="history-mobile-customer">${o.customer}</div><div class="history-mobile-title">${o.invoiceNo}</div></div><span class="badge-status ${o.status === "paid" ? "badge-done" : "badge-design"}">${o.status === "paid" ? "LUNAS" : "DP"}</span></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-calendar-line"></i><span>${o.date || "-"}</span></div><div class="mobile-meta-item"><i class="ri-money-dollar-circle-line"></i><span>${formatRupiah(o.total)}</span></div></div><div class="history-mobile-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openInvoicePreview('${o.id}')"><i class="ri-eye-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditInvoice('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteInvoice('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div>`).join("");
  }
  renderPagination("invoice-pagination", p.page, p.totalPages, "changeInvoicePage", totalRows);
};

window.deleteInvoice = async function (id) {
  if (!confirm("Hapus invoice ini?")) return;
  try { await deleteDoc(doc(db, "invoices", id)); showToast("Invoice dihapus"); } catch (err) { showToast("Hapus gagal, coba lagi", "error"); }
};

window.changeInvoicePage = function (page) {
  pagination.invoices = page;
  window.renderInvoices();
  document.getElementById("invoice-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ============================================================= */
/* TOGGLE SECTION COLLAPSE                                        */
/* ============================================================= */
window.toggleSection = function (header) {
  const section = header.closest(".collapsible-section");
  if (!section) return;
  section.classList.toggle("collapsed");
  saveSectionState();
  const y = section.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: "smooth" });
};

/* ============================================================= */
/* ACTION DROPDOWN                                                */
/* ============================================================= */
window.toggleActionDropdown = function (btn, event) {
  event.stopPropagation();
  const current = btn.closest(".action-dropdown");
  document.querySelectorAll(".action-dropdown.active").forEach((d) => { if (d !== current) d.classList.remove("active"); });
  current.classList.toggle("active");
};
document.addEventListener("click", function () {
  document.querySelectorAll(".action-dropdown.active").forEach((d) => d.classList.remove("active"));
});

/* ============================================================= */
/* PAGINATION CALLBACKS                                           */
/* ============================================================= */
window.changeDesignPage = function (page) { pagination.designOrders = page; renderDesignOrders(); document.getElementById("design-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeProductionPage = function (page) { pagination.productionOrders = page; renderProductionOrders(); document.getElementById("production-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeCostingHistoryPage = function (page) { pagination.costingHistory = page; renderCostingHistory(); };
window.changeDesignHistoryPage = function (page) { pagination.designHistory = page; renderDesignHistory(); document.getElementById("design-history-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeProductionHistoryPage = function (page) { pagination.productionHistory = page; renderProductionHistory(); };

/* ============================================================= */
/* FIREBASE                                                       */
/* ============================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, onSnapshot, query, orderBy, setDoc, getDoc, where, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeExsNmeo1KcIEeCQJI4TMPVOzxNhrmYI",
  authDomain: "progress-workspace.firebaseapp.com",
  projectId: "progress-workspace",
  storageBucket: "progress-workspace.firebasestorage.app",
  messagingSenderId: "386467300617",
  appId: "1:386467300617:web:dd56ccc21ee0abd3cdbfd8",
  measurementId: "G-9GXHTCGMQ3",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
window.db = db;

/* Global Firebase refs needed by inline HTML handlers */
window.addDoc = addDoc;
window.collection = collection;
window.serverTimestamp = serverTimestamp;
window.deleteDoc = deleteDoc;
window.doc = doc;
window.updateDoc = updateDoc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.where = where;
window.query = query;

/* State */
window.firebaseDesignOrders = [];
window.firebaseInvoices = [];
window.firebaseProductionOrders = [];
window.firebaseCostingOrders = [];
window.isDark = false;

/* Realtime listeners */
onSnapshot(query(collection(db, "design_orders"), orderBy("createdAt", "desc")), (snapshot) => {
  window.firebaseDesignOrders = [];
  snapshot.forEach((d) => window.firebaseDesignOrders.push({ id: d.id, ...d.data() }));
  renderDesignOrders();
  renderDesignHistory();
  updatePipeline();
  updateHero();
  updateCharts(window.firebaseDesignOrders);
});

onSnapshot(query(collection(db, "production_orders"), orderBy("createdAt", "desc")), (snapshot) => {
  window.firebaseProductionOrders = [];
  snapshot.forEach((d) => window.firebaseProductionOrders.push({ id: d.id, ...d.data() }));
  renderProductionOrders();
  renderProductionHistory();
  updateProductionPipeline();
  updateHero();
});

onSnapshot(query(collection(db, "invoices"), orderBy("createdAt", "desc")), (snapshot) => {
  window.firebaseInvoices = [];
  snapshot.forEach((d) => window.firebaseInvoices.push({ id: d.id, ...d.data() }));
  window.renderInvoices();
});

onSnapshot(query(collection(db, "costing_history"), orderBy("created", "desc")), (snapshot) => {
  window.firebaseCostingOrders = [];
  snapshot.forEach((d) => window.firebaseCostingOrders.push({ id: d.id, ...d.data() }));
  renderCostingHistory();
});

/* ============================================================= */
/* INIT                                                           */
/* ============================================================= */
function init() {
  loadTheme();
  loadAuto();
  renderTaskList();
  updatePipeline();
  updateProductionPipeline();
  updateHero();
  hitung();
  restoreSectionState();
  const doDeadline = document.getElementById("do-deadline");
  if (doDeadline) doDeadline.value = getToday();
  const poDeadline = document.getElementById("po-deadline");
  if (poDeadline) poDeadline.value = getToday();
  setInterval(updateHero, 60000);
}

init();

/* ============================================================= */
/* GLOBAL WINDOW BINDINGS                                        */
/* ============================================================= */
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.toggleDark = toggleDark;
window.toggleMobileNav = toggleMobileNav;
window.toggleAddDropdown = toggleAddDropdown;
window.scrollToSection = scrollToSection;
window.filterByStage = filterByStage;
window.setDesignFilter = setDesignFilter;
window.filterProductionStage = filterProductionStage;
window.renderDesignOrders = renderDesignOrders;
window.saveDesignOrder = saveDesignOrder;
window.deleteDesignOrder = deleteDesignOrder;
window.openEditDesign = openEditDesign;
window.advanceDesignStage = advanceDesignStage;
window.prevDesignStage = prevDesignStage;
window.markDesignDone = markDesignDone;
window.renderDesignHistory = renderDesignHistory;
window.renderProductionOrders = renderProductionOrders;
window.saveProductionOrder = saveProductionOrder;
window.nextProductionStage = nextProductionStage;
window.prevProductionStage = prevProductionStage;
window.markProductionDone = markProductionDone;
window.deleteProductionOrder = deleteProductionOrder;
window.openEditProduction = openEditProduction;
window.openProductionNote = window.openProductionNote;
window.saveProductionNote = window.saveProductionNote;
window.addProductionItem = addProductionItem;
window.addProductionSize = addProductionSize;
window.removeProductionItem = removeProductionItem;
window.changePriceModeProd = changePriceModeProd;
window.collectProductionItems = collectProductionItems;
window.updateProductionTotals = updateProductionTotals;
window.renderProductionItems = renderProductionItems;
window.createInvoiceFromProduction = createInvoiceFromProduction;
window.loadInvoiceItems = loadInvoiceItems;
window.renderProductionHistory = renderProductionHistory;
window.hitung = hitung;
window.formatRibuan = formatRibuan;
window.titleCase = titleCase;
window.hitungTambahan = hitungTambahan;
window.resetFormCosting = resetFormCosting;
window.saveHistory = () => { saveHistory(); showToast("Estimasi tersimpan"); renderCostingHistory(); };
window.deleteHistory = deleteHistory;
window.loadHistory = loadHistory;
window.loadHistoryData = loadHistoryData;
window.toggleCustomerSort = toggleCustomerSort;
window.tambahItem = tambahItem;
window.hapusItem = hapusItem;
window.resetCard = resetCard;
window.hitungEstimasi = hitungEstimasi;
window.renderCostingHistory = renderCostingHistory;
window.saveTask = saveTask;
window.deleteTask = deleteTask;
window.toggleTask = toggleTask;
window.renderTaskList = renderTaskList;

console.log("Progress Workspace — Modular Architecture Loaded");
