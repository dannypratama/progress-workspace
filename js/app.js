/**
 * App Entry Point — Orkestrator Utama
 * Menyatukan seluruh modul: inisialisasi Firebase, kontrol modal,
 * penyaringan data, form Desain/Produksi/Invoice, dan registrasi
 * fungsi ke `window` untuk handler inline pada HTML.
 */

import { KEYS, CFG, MASTER_PRICE_DATABASE, getProductBasePrice, normalizeMaterialName, LOYAL_CUSTOMERS_SEED, getDesignCategory, formatMeter, calcDesignPrice, normalizeDesignOrders, parseMagicDesignBlocks, setEstimatorVendor, DEFAULT_ESTIMATOR_VENDOR } from "./database.js";
import { formatRibuan, titleCase, getToday, formatRupiah, formatInvoiceDate, paginate, pagination, renderPagination, getAvatarPalette, escapeHTML, legacyItemsFallback, parseMagicText, formatDateID, toIsoDate, formatMeterValue, formatRateK, formatNumberID, debounce } from "./utils.js";
import { loadAuto, saveHistory, deleteHistoryById, loadHistoryData, saveSectionState, restoreSectionState } from "./storage.js";
import {
  hitung, hitungTambahan, tambahItem, hapusItem,
  resetCard, resetFormCosting, hitungEstimasi,
  renderCostingHistory, renderDesignHistory, renderProductionHistory,
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
import { handleUppercaseInput } from "./utils.js";

window.handleUppercaseInput = handleUppercaseInput;

/* ============================================================= */
/* 1. PIN LOCK — Privasi lokal (6 digit)                          */
/* ============================================================= */
/* CATATAN KEAMANAN: PIN ini purely client-side (tersimpan di    */
/* localStorage & bisa dibaca lewat DevTools). Ini gunanya       */
/* privasi visual (mencegah orang lain melihat/menyalin layar), */
/* BUKAN enkripsi data. Untuk keamanan sungguhan, pakai auth     */
/* server-side.                                                   */

const PIN_LENGTH = 6;
const PIN_DEFAULT = "696969";
const PIN_STORE_KEY = "progress_pin_v1";
const PIN_SESSION_KEY = "progress_pin_unlocked";

let pinBuffer = "";

function pinGet() {
  try { return localStorage.getItem(PIN_STORE_KEY) || PIN_DEFAULT; }
  catch (e) { return PIN_DEFAULT; }
}
function pinSet(value) {
  try { localStorage.setItem(PIN_STORE_KEY, value); } catch (e) { showToast("Gagal menyimpan PIN", "error"); }
}
function pinSessionSet() {
  try { sessionStorage.setItem(PIN_SESSION_KEY, "1"); } catch (e) { /* abaikan */ }
}
function pinSessionGet() {
  try { return sessionStorage.getItem(PIN_SESSION_KEY) === "1"; } catch (e) { return false; }
}
function pinSessionClear() {
  try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch (e) { /* abaikan */ }
}

function pinIsValidFormat(v) {
  return /^\d{6}$/.test(v);
}

function pinRenderDots() {
  const wrap = document.getElementById("pin-dots");
  if (!wrap) return;
  if (wrap.children.length !== PIN_LENGTH) {
    wrap.innerHTML = Array.from({ length: PIN_LENGTH }, () => `<span class="pin-dot"></span>`).join("");
  }
  [...wrap.children].forEach((el, i) => el.classList.toggle("filled", i < pinBuffer.length));
}

function pinMessage(text, isError) {
  const el = document.getElementById("pin-msg");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", !!isError);
}

function pinPush(digit) {
  if (pinBuffer.length >= PIN_LENGTH) return;
  // pesan error dibiarkan sampai user mulai mengetik lagi (lebih terbaca)
  if (document.getElementById("pin-msg")?.classList.contains("error")) {
    pinMessage("Masukkan PIN 6 digit untuk melanjutkan");
  }
  pinBuffer += String(digit);
  pinRenderDots();
  if (pinBuffer.length === PIN_LENGTH) setTimeout(pinSubmit, 160);
}
function pinBack() {
  pinBuffer = pinBuffer.slice(0, -1);
  pinRenderDots();
  pinMessage("Masukkan PIN 6 digit untuk melanjutkan");
}
function pinClear() {
  pinBuffer = "";
  pinRenderDots();
}
function pinShake() {
  const card = document.getElementById("pin-lock-card");
  if (!card) return;
  card.classList.remove("pin-shake");
  void card.offsetWidth; // restart animasi
  card.classList.add("pin-shake");
  if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* abaikan */ } }
}

function pinSubmit() {
  if (pinBuffer.length !== PIN_LENGTH) return;
  if (pinBuffer === pinGet()) {
    pinSessionSet();
    pinBuffer = ""; // jangan sisakan digit PIN di memori
    pinRenderDots();
    pinUnlock();
  } else {
    pinShake();
    pinMessage("PIN salah, coba lagi", true);
    setTimeout(pinClear, 320);
  }
}

function pinUnlock() {
  document.body.classList.remove("pin-locked");
  const lock = document.getElementById("pin-lock");
  if (lock) lock.classList.add("pin-lock-hidden");
}

window.lockNow = function () {
  pinSessionClear();
  pinClear();
  closeModal("modal-pin");
  document.body.classList.add("pin-locked");
  const lock = document.getElementById("pin-lock");
  if (lock) lock.classList.remove("pin-lock-hidden");
  pinMessage("Masukkan PIN 6 digit untuk melanjutkan");
  showToast("Workspace dikunci", "info");
};

/* Keyboard input: angka (main + numpad), Backspace, Esc/Delete, Enter.
   Aktif hanya saat lock screen tampil, dan TIDAK mengganggu saat
   user mengetik di field input (mis. modal Pengaturan PIN). */
function pinKeyboardHandler(e) {
  if (!document.body.classList.contains("pin-locked")) return;
  const t = e.target;
  const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (typing && e.key !== "Escape") return; // biarkan input biasa

  // Digit 0-9 (main keyboard maupun numpad)
  if (/^\d$/.test(e.key)) {
    e.preventDefault();
    pinPush(e.key);
    return;
  }
  // Enter -> submit bila 6 digit sudah terisi
  if (e.key === "Enter") {
    if (pinBuffer.length === PIN_LENGTH) {
      e.preventDefault();
      pinSubmit();
    }
    return;
  }
  // Backspace -> hapus 1 digit
  if (e.key === "Backspace") {
    e.preventDefault(); // cegah navigasi "back" di sebagian browser
    pinBack();
    return;
  }
  // Escape / Delete -> hapus semua
  if (e.key === "Escape" || e.key === "Delete") {
    e.preventDefault();
    pinClear();
  }
}

function initPinLock() {
  const pad = document.getElementById("pin-pad");
  if (pad && !pad.dataset.bound) {
    pad.dataset.bound = "1";
    pad.addEventListener("click", (e) => {
      const key = e.target.closest(".pin-key");
      if (!key) return;
      if (key.dataset.pin) pinPush(key.dataset.pin);
    });
  }
  document.getElementById("pin-back")?.addEventListener("click", pinBack);
  document.getElementById("pin-clear")?.addEventListener("click", pinClear);

  // Keyboard desktop (dib_bound sekali saja agar tidak menumpuk)
  if (!window.__pinKeyBound) {
    window.__pinKeyBound = true;
    window.addEventListener("keydown", pinKeyboardHandler);
  }

  pinRenderDots();
  if (pinSessionGet()) pinUnlock();
  else document.body.classList.add("pin-locked");
}

window.openPinSettings = function () {
  ["pin-current", "pin-new", "pin-confirm"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  openModal("modal-pin");
};

window.savePinSettings = function () {
  const cur = document.getElementById("pin-current")?.value || "";
  const nw = document.getElementById("pin-new")?.value || "";
  const cf = document.getElementById("pin-confirm")?.value || "";
  if (!pinIsValidFormat(cur) || cur !== pinGet()) return showToast("PIN saat ini salah", "error");
  if (!pinIsValidFormat(nw)) return showToast("PIN baru harus 6 digit angka", "error");
  if (nw === cur) return showToast("PIN baru harus berbeda dari PIN lama", "error");
  if (nw !== cf) return showToast("Ulangi PIN baru tidak cocok", "error");
  pinSet(nw);
  pinSessionSet(); // tetap terkunci session ini
  closeModal("modal-pin");
  showToast("PIN berhasil diubah", "success");
};

/* ============================================================= */
/* 2. SCROLL MANAGER — Pengendali Lenis terpusat                */
/* ============================================================= */
/* Satu instance Lenis untuk halaman + satu untuk modal aktif.     */
/* Keduanya digerakkan SATU rAF loop (tidak autoRaf) agar tidak   */
/* dobel-animasi dan tidak menumpuk loop.                         */

const MODAL_SCROLL_SELECTOR = ".ws-modal, .modal-body, .modal-card";

const ScrollManager = {
  mainLenis: null,
  modalLenis: null,
  modalOwner: null,
  rafId: null,

  initMain() {
    if (typeof Lenis === "undefined") return;
    if (this.mainLenis) return; // idempotent: cegah rAF loop dobel
    this.mainLenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    window.lenis = this.mainLenis;
    const loop = (time) => {
      this.mainLenis?.raf(time);
      this.modalLenis?.raf(time);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  },

  resolveContainer(modalEl) {
    if (!modalEl) return null;
    return modalEl.querySelector(MODAL_SCROLL_SELECTOR);
  },

  clearModalStyles() {
    document.querySelectorAll(".lenis-modal-active").forEach((el) => el.classList.remove("lenis-modal-active"));
  },

  attachToModal(modalEl) {
    if (typeof Lenis === "undefined") return;
    const container = this.resolveContainer(modalEl);
    if (!container) return;

    // 1. Kunci scroll halaman utama
    this.mainLenis?.stop();
    document.body.classList.add("modal-open");

    // 2. Buang instance modal sebelumnya (wajib: mencegah event leak)
    this.modalLenis?.destroy();
    this.modalLenis = null;
    this.modalOwner = null;
    this.clearModalStyles();

    // 3. Instance baru. wrapper = elemen yang benar-benar di-scroll
    this.modalLenis = new Lenis({
      wrapper: container,
      content: container,
      eventsTarget: container,
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.5,
      overscroll: false, // cegah scroll chaining ke background
    });
    this.modalOwner = modalEl.id || null;
    container.classList.add("lenis-modal-active");
  },

  detachFromModal() {
    this.modalLenis?.destroy();
    this.modalLenis = null;
    this.modalOwner = null;
    this.clearModalStyles();

    // Nested modal: pindah ke modal yang masih terbuka
    const remaining = Array.from(document.querySelectorAll(".modal-overlay.open"));
    if (remaining.length) {
      this.attachToModal(remaining[remaining.length - 1]);
      return;
    }
    document.body.classList.remove("modal-open");
    this.mainLenis?.start();
  },

  // Jaring pengaman: pastikan modal aktif tetap bisa di-scroll
  refresh(modalId) {
    const box = this.resolveContainer(document.getElementById(modalId));
    if (!box) return;
    if (this.modalLenis && this.modalOwner === modalId) {
      box.classList.add("lenis-modal-active");
      box.removeAttribute("data-lenis-prevent");
      this.modalLenis.resize();
    } else {
      box.classList.remove("lenis-modal-active");
    }
  },

  // Scroll di dalam modal. JANGAN pakai scrollIntoView native saat Lenis
  // aktif — keduanya berebut scrollTop sehingga modal macet.
  scrollWithin(el) {
    if (!el) return;
    const box = el.closest(MODAL_SCROLL_SELECTOR);
    if (this.modalLenis && box && box.classList.contains("lenis-modal-active")) {
      this.modalLenis.scrollTo(el);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  },
};

window.ScrollManager = ScrollManager;
ScrollManager.initMain();

/* ============================================================= */
/* 3. TOAST & MODAL                                              */
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

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("open");
  ScrollManager.attachToModal(modal);
}

function hasInvoiceDraft() {
  return document.getElementById("invoice-customer")?.value || document.querySelectorAll("#invoice-items .invoice-item-row").length > 0 || document.getElementById("invoice-note")?.value;
}

function closeModal(id, force = false) {
  if (id === "modal-invoice" && !force) {
    if (hasInvoiceDraft() && !confirm("Invoice belum disimpan. Yakin tutup?")) return;
  }
  document.getElementById(id)?.classList.remove("open");
  ScrollManager.detachFromModal();
}

document.addEventListener("click", function (e) {
  const modal = e.target.closest(".modal");
  if (!modal) return;
  if (e.target !== modal) return;
  if (modal.id === "modal-invoice") { e.preventDefault(); e.stopPropagation(); return false; }
  modal.classList.remove("open");
  ScrollManager.detachFromModal();
}, true);

/* ============================================================= */
/* 4. TEMA TERANG/GELAP                                          */
/* ============================================================= */
function toggleDark() {
  document.body.classList.toggle("dark");
  window.isDark = document.body.classList.contains("dark");
  localStorage.setItem(KEYS.theme, window.isDark ? "dark" : "light");
  document.getElementById("theme-icon").className = window.isDark ? "ri-sun-line" : "ri-contrast-2-line";
}

function loadTheme() {
  if (localStorage.getItem(KEYS.theme) === "dark") {
    document.body.classList.add("dark");
    window.isDark = true;
    document.getElementById("theme-icon").className = "ri-sun-line";
  }
}

/* ============================================================= */
/* 5. NAVIGASI MOBILE                                            */
/* ============================================================= */
function toggleMobileNav() { document.getElementById("mobile-nav-menu").classList.toggle("show"); }
function toggleAddDropdown(e) { e.stopPropagation(); document.getElementById("nav-add-menu").classList.toggle("open"); }
document.addEventListener("click", function (e) { var m = document.getElementById("nav-add-menu"); if (m && !e.target.closest(".nav-add-dropdown")) m.classList.remove("open"); });
function scrollToSection(id) {
  const element = document.getElementById(id);
  if (!element) return;

  if (ScrollManager.mainLenis) {
    ScrollManager.mainLenis.scrollTo(element, { offset: -80 });
  } else {
    const y = element.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
  document.getElementById("mobile-nav-menu")?.classList.remove("show");
}

/* ============================================================= */
/* 6. PESANAN DESAIN — Pembungkus Firestore                    */
/*    Diisi dari callback onSnapshot, bukan dipanggil manual.            */
/* ============================================================= */

/* ---------- Customer Loyal + Rate Khusus ---------- */

window.designCustomers = [];

window.renderDesignCustomerOptions = function (selected, target) {
  const sel = target || document.getElementById("do-customer");
  if (!sel) return;
  const list = [...(window.designCustomers || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));
  sel.innerHTML = `<option value="">Pilih customer</option>` +
    list.map((c) => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join("");
  if (selected && list.some((c) => c.name === selected)) sel.value = selected;
  updateDesignPrice();
};

window.openDesignCustomerModal = function () {
  ["dc-name", "dc-rate-dtf", "dc-rate-plastisol"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = id === "dc-rate-dtf" ? "10000" : id === "dc-rate-plastisol" ? "25000" : "";
  });
  openModal("modal-design-customer");
};

window.saveDesignCustomer = async function () {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  const name = document.getElementById("dc-name")?.value.trim();
  if (!name) return showToast("Nama customer wajib diisi", "error");
  const rateDtf = Number(document.getElementById("dc-rate-dtf")?.value) || 0;
  const ratePlastisol = Number(document.getElementById("dc-rate-plastisol")?.value) || 0;
  try {
    await addDoc(collection(db, "design_customers"), { name: name.toUpperCase(), rateDtf, ratePlastisol, createdAt: serverTimestamp() });
    closeModal("modal-design-customer");
    showToast(`Customer ${name.toUpperCase()} tersimpan`, "success");
  } catch (err) { console.error(err); showToast("Gagal menyimpan customer", "error"); }
};

function currentDesignCustomer() {
  const name = document.getElementById("do-customer")?.value;
  return (window.designCustomers || []).find((c) => c.name === name) || null;
}

/* ---------- Dynamic price ---------- */

window.onDesignKategoriChange = function () {
  const kategori = document.getElementById("do-jenis")?.value || "";
  const cat = getDesignCategory(kategori);
  const cmField = document.getElementById("dg-cm-field");
  const priceField = document.getElementById("dg-price-field");
  if (cmField) cmField.style.display = cat && cat.mode === "cm" ? "flex" : "none";
  if (priceField) priceField.style.display = cat && cat.mode === "manual" ? "flex" : "none";
  updateDesignPrice();
};

window.updateDesignPrice = function () {
  const kategori = document.getElementById("do-jenis")?.value || "";
  const cust = currentDesignCustomer();
  const hint = document.getElementById("do-rate-hint");
  if (hint) {
    hint.textContent = cust
      ? `Rate ${cust.name}: DTF ${formatRupiah(cust.rateDtf)}/meter · Plastisol ${formatRupiah(cust.ratePlastisol)}/desain`
      : "Pilih customer untuk melihat rate khusus.";
  }
  const cm = document.getElementById("do-cm")?.value || "";
  const manual = document.getElementById("do-price")?.value || "";
  const r = calcDesignPrice({ kategori, cm, manualPrice: manual, rateDtf: cust?.rateDtf, ratePlastisol: cust?.ratePlastisol });
  const out = document.getElementById("do-price-display");
  if (out) {
    if (!kategori) out.value = "-";
    else if (r.price) out.value = formatRupiah(r.price) + (r.meter ? `  (${formatMeter(cm)} × ${formatRupiah(cust?.rateDtf || 0)})` : "");
    else out.value = "Belum ada harga";
  }
  return r;
};

async function saveDesignOrder() {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  const customer = document.getElementById("do-customer").value.trim();
  const design = document.getElementById("do-design").value.trim();
  if (!customer) return showToast("Pilih customer loyal", "error");
  if (!design) return showToast("Masukkan nama project", "error");
  const kategori = document.getElementById("do-jenis").value;
  if (!kategori) return showToast("Pilih kategori pekerjaan", "error");

  const cust = currentDesignCustomer();
  const cm = document.getElementById("do-cm")?.value || "";
  const manual = document.getElementById("do-price")?.value || "";
  const cat = getDesignCategory(kategori);
  if (cat?.mode === "cm" && !(Number(cm) > 0)) return showToast("Masukkan panjang dalam CM", "error");
  if (cat?.mode === "manual" && !(Number(manual) > 0)) return showToast("Masukkan harga manual", "error");

  const r = calcDesignPrice({ kategori, cm, manualPrice: manual, rateDtf: cust?.rateDtf, ratePlastisol: cust?.ratePlastisol });
  const data = {
    customer, design, jenis: kategori,
    deadline: document.getElementById("do-deadline").value,
    notes: document.getElementById("do-notes").value,
    cm: cat?.mode === "cm" ? Number(cm) || 0 : 0,
    lengthCm: cat?.mode === "cm" ? Number(cm) || 0 : 0,
    meter: r.meter,
    price: r.price,
    // snapshot rate saat order dibuat (agar rekap lama tetap konsisten)
    rateDtf: cust?.rateDtf || 0,
    ratePlastisol: cust?.ratePlastisol || 0,
  };
  try {
    if (designState.editId) {
      await updateDoc(doc(db, "design_orders", designState.editId), { ...data, updatedAt: serverTimestamp() });
      showToast("Perubahan desain tersimpan");
    } else {
      await addDoc(collection(db, "design_orders"), { ...data, stage: "design", createdAt: serverTimestamp() });
      showToast("Pesanan desain bertambah");
    }
    closeModal("modal-design");
    resetDesignForm();
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
async function deleteDesignOrder(id) {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  if (!confirm("Hapus pesanan desain ini?")) return; try { await deleteDoc(doc(db, "design_orders", id)); showToast("Pesanan desain dihapus", "info"); } catch (err) { showToast("Hapus gagal, coba lagi", "error"); } }

function openEditDesign(id) {
  const order = (window.firebaseDesignOrders || []).find((o) => o.id === id);
  if (!order) return;
  designState.editId = id;
  window.renderDesignCustomerOptions(order.customer || "");
  document.getElementById("do-design").value = order.design || "";
  document.getElementById("do-jenis").value = order.jenis || "";
  document.getElementById("do-deadline").value = order.deadline || "";
  document.getElementById("do-notes").value = order.notes || "";
  const cmEl = document.getElementById("do-cm");
  if (cmEl) cmEl.value = order.cm || "";
  const priceEl = document.getElementById("do-price");
  if (priceEl) priceEl.value = (order.jenis === "DESAIN" && order.price) ? order.price : "";
  window.onDesignKategoriChange();
  openModal("modal-design");
}

/* ============================================================= */
/* 7. VENDOR BAHAN — Estimasi Produksi                          */
/* ============================================================= */
/* Mengganti matriks BAHAN di database.js (ES live binding) lalu    */
/* menyelaraskan label form + dropdown Estimasi Cepat.              */
/* Rumus kalkulator hitung()/hitungBahan() TIDAK diubah.           */

window.applyEstimatorVendor = function (vendorId) {
  const bahan = setEstimatorVendor(vendorId);

  // 1. Label kartu material (nama + spesifikasi kg/m x harga/kg)
  for (const slot of Object.keys(bahan)) {
    const b = bahan[slot];
    const nameEl = document.getElementById(`mat-name-${slot}`);
    const descEl = document.getElementById(`mat-desc-${slot}`);
    if (nameEl) nameEl.textContent = b.nama;
    if (descEl) {
      if (b.harga > 0) {
        descEl.textContent = `${b.kg} kg/m × ${formatRupiah(b.harga)}${b.print > 0 ? ` + cetak ${formatRupiah(b.print)}/m` : " · tanpa cetak"}`;
      } else if (b.print > 0) {
        descEl.textContent = `${formatRupiah(b.print)}/meter (all-in)`;
      } else {
        descEl.textContent = "—";
      }
    }
  }

  // 2. Dropdown Estimasi Cepat ikut mengikuti vendor
  const sel = document.getElementById("estimasiBahan");
  if (sel) {
    const prev = sel.value;
    const opts = Object.entries(bahan)
      .filter(([, b]) => b.harga > 0)
      .map(([slot, b]) => `<option value="${escapeHTML(slot)}">${escapeHTML(b.nama)}</option>`);
    sel.innerHTML = `<option value="">Pilih material</option>` + opts.join("");
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  // 3. Hitung ulang seluruh estimasi
  hitung();
  hitungEstimasi();
};

/* ============================================================= */
/* 8. MAGIC TEXT PARSER — Pesanan Desain                         */
/* ============================================================= */

// Customer aktif = dropdown pada Modal Tambah Desain
function magicDesignCustomer() {
  const name = document.getElementById("do-customer")?.value || "";
  return (window.designCustomers || []).find((c) => c.name === name) || null;
}

/* Array penampung hasil parsing (dimuat 1x, di-reset setelah simpan
   supaya array lama langsung bisa di-GC). */
let magicParsedItems = [];

function resetMagicDesignState() {
  magicParsedItems = [];
  const input = document.getElementById("md-input");
  if (input) input.value = "";
  const prev = document.getElementById("md-preview");
  if (prev) prev.innerHTML = "";
}

window.openMagicDesignModal = function () {
  const box = document.getElementById("md-customer");
  const cust = magicDesignCustomer();
  if (box) {
    box.textContent = cust ? cust.name : "—";
    box.classList.toggle("magic-customer-empty", !cust);
  }
  resetMagicDesignState();
  updateMagicDesignPreview();
  openModal("modal-magic-design");
};

window.updateMagicDesignPreview = function () {
  const box = document.getElementById("md-preview");
  const saveBtn = document.getElementById("md-save");
  const saveLabel = document.getElementById("md-save-label");
  const text = document.getElementById("md-input")?.value || "";
  const cust = magicDesignCustomer();
  const items = cust
    ? parseMagicDesignBlocks(text, cust.rateDtf, cust.ratePlastisol)
    : [];
  magicParsedItems = items; // ditahan agar tidak parse ulang saat disimpan

  if (saveBtn) saveBtn.disabled = items.length === 0 || !cust;
  if (saveLabel) saveLabel.textContent = items.length ? `Proses & Simpan All (${items.length} Item)` : "Proses & Simpan All";
  if (!box) return;

  if (!cust) {
    box.innerHTML = `<div class="magic-empty magic-empty-warn">Pilih customer di Modal Pesanan Desain terlebih dahulu.</div>`;
    return;
  }
  if (!text.trim()) { box.innerHTML = `<div class="magic-empty">Tempel daftar desain per blok (DTF / PLASTISOL / DESAIN) di atas.</div>`; return; }
  if (!items.length) { box.innerHTML = `<div class="magic-empty">Tidak ada baris yang bisa dibaca.</div>`; return; }

  const total = items.reduce((a, x) => a + (x.price || 0), 0);
  const rows = items.map((x, i) => `<tr>
      <td class="md-num">${i + 1}</td>
      <td><span class="table-tag">${escapeHTML(x.kategori === "DTF" ? "LAYOUT DTF" : x.kategori)}</span></td>
      <td class="md-name">${escapeHTML(x.design)}</td>
      <td class="md-len">${x.kategori === "DTF" ? (x.noLength ? '<span class="md-warn">isi panjang</span>' : `${x.lengthCm} cm · ${formatMeterValue(x.lengthCm)}m`) : "—"}</td>
      <td class="md-rate">${x.rate ? formatRupiah(x.rate) : "—"}</td>
      <td class="md-price">${formatRupiah(x.price || 0)}</td>
    </tr>`).join("");
  box.innerHTML = `<table class="md-table">
      <thead><tr><th>#</th><th>Kategori</th><th>Nama Project</th><th>Panjang</th><th>Rate</th><th>Harga</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5">TOTAL</td><td>${formatRupiah(total)}</td></tr></tfoot>
    </table>`;
};

window.saveMagicDesignBulk = async function () {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  const cust = magicDesignCustomer();
  if (!cust) return showToast("Pilih customer di Modal Pesanan Desain terlebih dahulu", "error");
  // Pakai hasil parse yang sudah di-cache (hemat parse ulang)
  const items = magicParsedItems.length
    ? magicParsedItems
    : parseMagicDesignBlocks(document.getElementById("md-input")?.value || "", cust.rateDtf, cust.ratePlastisol);
  if (!items.length) return showToast("Tidak ada data untuk disimpan", "error");

  const btn = document.getElementById("md-save");
  if (btn) btn.disabled = true;
  let ok = 0;
  try {
    for (const it of items) {
      await addDoc(collection(db, "design_orders"), {
        customer: cust.name,
        design: it.design,
        jenis: it.kategori,
        lengthCm: it.lengthCm,
        cm: it.lengthCm,
        meter: it.meter,
        price: it.price,
        rateDtf: cust.rateDtf || 0,
        ratePlastisol: cust.ratePlastisol || 0,
        deadline: "",
        notes: "",
        rekapStatus: "BELUM DIREKAP",
        stage: "design",
        createdAt: serverTimestamp(),
      });
      ok++;
    }
    showToast(`${ok} pesanan desain tersimpan untuk ${cust.name}`, "success");
    closeModal("modal-magic-design");
    // Garbage collection: lepaskan array parse + kosongkan textarea
    resetMagicDesignState();
    renderDesignOrders();
    renderDesignHistory();
  } catch (err) {
    console.error("[saveMagicDesignBulk]", err);
    showToast(`Gagal menyimpan (${ok}/${items.length} berhasil)`, "error");
    if (btn) btn.disabled = false;
  }
};

/* ---------- Generator Rekap Tagihan ---------- */

const BULAN_PENDEK = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

function tglRekap(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return String(iso);
  return `${String(d).padStart(2, "0")} ${BULAN_PENDEK[m - 1]} ${y}`;
}

/* Tanggal order: dukung Timestamp Firertz (seconds/nanoseconds),
   objek Date, string ISO, angka epoch, atau fallback ke deadline. */
function designOrderDate(order) {
  const c = order?.createdAt;
  if (c) {
    if (typeof c === "object") {
      if (typeof c.seconds === "number") return toIsoDate(new Date(c.seconds * 1000));
      if (typeof c.nanoseconds === "number") return toIsoDate(new Date(c.seconds * 1000));
      if (c instanceof Date || typeof c.toDate === "function") {
        return toIsoDate(typeof c.toDate === "function" ? c.toDate() : c);
      }
    }
    if (typeof c === "string" && c.trim()) return toIsoDate(c);
    if (typeof c === "number" && c > 0) return toIsoDate(new Date(c < 1e12 ? c * 1000 : c));
  }
  if (order?.deadline) return toIsoDate(order.deadline);
  return "";
}

/* ---------- Auto-backfill data desain lama (transparan) ---------- */
/* Order lama dilengkapi saat dibaca: kategori dinormalisasi, rate customer
   dicocokkan, panjang (lengthCm) deduction dari teks/harga.
   Tidak menulis ke database -> aman & idempoten. */

window.designOrdersNormalized = function () {
  return normalizeDesignOrders(window.firebaseDesignOrders || [], window.designCustomers || []);
};

window.buildWaRecap = function (from, to, customer) {
  // Backfill: seluruh order lama otomatis ikut ter-backfill di sini
  const raw = window.firebaseDesignOrders || [];
  const all = normalizeDesignOrders(raw, window.designCustomers || []);
  const wantCust = String(customer || "").trim();
  let scanned = 0;
  let noDate = 0;
  const orders = all.filter((o) => {
    scanned++;
    const d = designOrderDate(o);
    // Order tanpa tanggal TIDAK dibuang (supaya data lama tetap muncul);
    // hanya yang memang di luar periode yang dibuang.
    if (!d) { noDate++; return !wantCust || String(o.customer || "").trim() === wantCust; }
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (wantCust && String(o.customer || "").trim() !== wantCust) return false;
    return true;
  });

  const groups = { DTF: new Map(), PLASTISOL: new Map(), DESAIN: new Map() };
  for (const o of orders) {
    const key = groups[o.jenis] ? o.jenis : "DESAIN";
    const rate = o.jenis === "DTF" ? (o.rateDtf || 0) : o.jenis === "PLASTISOL" ? (o.ratePlastisol || 0) : 0;
    const gkey = `${rate}`;
    if (!groups[key].has(gkey)) groups[key].set(gkey, { rate, items: [] });
    groups[key].get(gkey).items.push(o);
  }

  const lines = [];
  lines.push("PERIODE WAKTU");
  lines.push(`${tglRekap(from)} - ${tglRekap(to)}`);
  if (wantCust) lines.push(`CUSTOMER: ${wantCust}`);
  lines.push("");

  let grand = 0;
  const pushGroup = (title, map) => {
    if (!map.size) return;
    for (const { rate, items } of map.values()) {
      // Kategori tanpa rate (DESAIN) tidak perlu keterangan rate di header
      lines.push(rate > 0 ? `${title} - ${formatRateK(rate)}` : title);
      for (const o of items) {
        const noTgl = designOrderDate(o) ? "" : " (tanpa tanggal)";
        // DTF: <NAMA FILE/PROJECT> - <METER>  |  PLASTISOL/DESAIN: <NAMA>
        lines.push(title === "LAYOUT DTF"
          ? `- ${o.design || "-"}${noTgl} - ${formatMeterValue(o.lengthCm || 0)}`
          : `- ${o.design || "-"}${noTgl}`);
        grand += Number(o.price) || 0;
      }
      lines.push("TOTAL");
      if (title === "LAYOUT DTF") {
        const totalMeter = items.reduce((a, o) => a + (Number(o.lengthCm) || 0) / 100, 0);
        const totalPrice = items.reduce((a, o) => a + (Number(o.price) || 0), 0);
        lines.push(`${formatMeterValue(totalMeter * 100)} × ${formatRateK(rate)} = ${formatNumberID(totalPrice)}`);
      } else if (title === "PLASTISOL") {
        const totalPrice = items.reduce((a, o) => a + (Number(o.price) || 0), 0);
        lines.push(`${items.length} × ${formatRateK(rate)} = ${formatNumberID(totalPrice)}`);
      } else {
        const totalPrice = items.reduce((a, o) => a + (Number(o.price) || 0), 0);
        lines.push(`${items.length} item = ${formatRupiah(totalPrice)}`);
      }
      lines.push("");
    }
  };

  pushGroup("LAYOUT DTF", groups.DTF);
  pushGroup("PLASTISOL", groups.PLASTISOL);
  pushGroup("DESAIN", groups.DESAIN);

  if (!orders.length) {
    lines.push(wantCust
      ? "(Tidak ada pesanan customer ini pada periode tersebut)"
      : (scanned ? "(Tidak ada pesanan pada periode ini)" : "(Belum ada data pesanan desain)"));
    lines.push("");
  }

  lines.push("TOTAL KESELURUHAN");
  lines.push(`Total: ${formatRupiah(grand)}`);
  return {
    text: lines.join("\n"),
    count: orders.length,
    grand,
    scanned,
    noDate,
    backfilled: all.length - raw.length,
  };
};

/** API utama sesuai kebutuhan: teks rekap terfilter Customer + Periode. */
window.generateWaText = function (from, to, customer) {
  return window.buildWaRecap(from, to, customer).text;
};

/** Tombol icon Rekap Tagihan — bisa diklik kapan saja.
 *  Customer aktif di filter utama (bila ada) jadi default dropdown dalam modal. */
window.openWaRecapFromFilter = function () {
  const picked = (document.getElementById("design-filter-customer")?.value || "").trim();
  window.openWaRecapModal(picked);
};

window.renderWaCustomerOptions = function (selected) {
  const sel = document.getElementById("wr-customer");
  if (!sel) return;
  const names = [...new Set((window.designOrdersNormalized() || []).map((o) => o.customer).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "id"));
  sel.innerHTML = `<option value="">Semua Customer</option>` +
    names.map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join("");
  sel.disabled = false; // bebas diganti user di dalam modal
  if (selected) {
    // pastikan customer dari filter utama tetap muncul walau belum punya order
    if (!names.includes(selected)) sel.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(selected)}">${escapeHTML(selected)}</option>`);
    sel.value = selected;
  } else {
    sel.value = "";
  }
};

window.openWaRecapModal = function (customer) {
  const from = document.getElementById("wr-from");
  const to = document.getElementById("wr-to");
  const today = getToday();
  if (to) to.value = today;
  // Default: 30 hari terakhir (bukan hanya hari ini) supaya rekap tidak kosong
  if (from) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    from.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  window.renderWaCustomerOptions(customer || "");
  try {
    updateWaRecap();
  } catch (err) {
    console.error("[openWaRecapModal]", err);
    const box = document.getElementById("wr-preview");
    if (box) box.value = "Gagal memuat rekap: " + err.message;
    showToast("Gagal memuat rekap: " + err.message, "error");
  }
  openModal("modal-wa-recap");
};

window.updateWaRecap = function () {
  const from = document.getElementById("wr-from")?.value || "";
  const to = document.getElementById("wr-to")?.value || "";
  const sel = document.getElementById("wr-customer");
  const customer = sel?.disabled ? (sel.value || "") : (sel?.value || "");
  const box = document.getElementById("wr-preview");
  if (!box) return;
  let r;
  try {
    r = window.buildWaRecap(from, to, customer);
  } catch (err) {
    console.error("[updateWaRecap]", err);
    box.value = "Gagal membuat rekap: " + err.message;
    const info0 = document.getElementById("wr-info");
    if (info0) info0.textContent = "Terjadi kesalahan saat memuat data.";
    return;
  }
  box.value = r.text;
  const info = document.getElementById("wr-info");
  if (info) {
    const nd = r.noDate > 0 ? ` · ${r.noDate} tanpa tanggal (tetap dihitung)` : "";
    const who = customer ? customer : "semua customer";
    if (!r.scanned) info.textContent = "Belum ada data pesanan desain sama sekali.";
    else if (!r.count) info.textContent = `${r.scanned} order ditemukan, 0 cocok untuk ${who} pada periode ini.${nd}`;
    else info.textContent = `${r.count} pesanan · ${formatRupiah(r.grand)} · ${who}${nd}`;
  }
};

window.copyWaRecap = function () {
  const text = document.getElementById("wr-preview")?.value || "";
  if (!text) return showToast("Tidak ada rekap untuk disalin", "error");
  const ok = () => showToast("Rekap tagihan berhasil disalin ke clipboard!", "success");
  const fail = (why) => {
    console.error("[copyWaRecap]", why);
    // Fallback terakhir: tampilkan teks agar user bisa salin manual
    const box = document.getElementById("wr-preview");
    if (box) { box.removeAttribute("readonly"); box.focus(); box.select(); }
    showToast("Salin otomatis gagal — teks sudah diseleksi, tekan Ctrl+C", "error");
  };

  // Clipboard API hanya tersedia di secure context (https/localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(ok, (e) => {
      // Coba fallback lama dulu sebelum surrender
      tryLegacy();
    });
    return;
  }
  tryLegacy();

  function tryLegacy() {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const done = document.execCommand("copy");
      document.body.removeChild(ta);
      if (done) ok();
      else fail("execCommand('copy') mengembalikan false");
    } catch (e) {
      fail(e);
    }
  }
};

/* ============================================================= */
/* 9. PESANAN PRODUKSI — Pembungkus Firestore                    */
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
      <select class="input spec-color kaos-field" style="display:none"><option value="HITAM">HITAM</option><option value="PUTIH">PUTIH</option><option value="ABU">ABU</option><option value="BIRU BENHUR">BIRU BENHUR</option><option value="MAROON">MAROON</option><option value="MERAH">MERAH</option><option value="NAVY">NAVY</option></select>
      <select class="input spec-sleeve"><option value="PENDEK">PENDEK</option><option value="PANJANG">PANJANG +10K</option><option value="3/4">3/4 +10K</option><option value="7/8">7/8 +10K</option></select>
      <select class="input spec-collar jersey-field"><option value="O-NECK">O-NECK</option><option value="V-NECK">V-NECK</option><option value="V-VARIASI">V-VARIASI</option><option value="V-POTONG">V-POTONG</option><option value="POLO V-NECK">POLO V-NECK +5K</option><option value="KERAH KANCING">KERAH KANCING +10K</option><option value="KUPLUK">KUPLUK +10K</option></select>
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
  ScrollManager.refresh("modal-production");
  const newRow = wrap.lastElementChild;
  ScrollManager.scrollWithin(newRow);
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
        const groupQty = Array.from(group.querySelectorAll(".invoice-qty")).reduce((s, q) => s + (Number(q.value) || 0), 0);
        autoPrice = getProductBasePrice(pt, { qty: groupQty || 1, material: mat, category: cat, sleeve: slv });
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
          } else if (slv !== "pendek" && slv !== "panjang") {
            // Matrix (Jersey) hanya mencakup pendek & panjang; 3/4 & 7/8 lewat addon
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
  document.getElementById("po-material").value = normalizeMaterialName(material);
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
        if (colSelect) colSelect.value = specs.color || "HITAM";
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
  ScrollManager.refresh("modal-production");
};

async function saveProductionOrder() {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
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
    setLegacyNotice(false);
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
async function deleteProductionOrder(id) {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  if (!confirm("Hapus pesanan produksi ini?")) return; try { await deleteDoc(doc(db, "production_orders", id)); showToast("Berhasil dihapus", "info"); } catch (err) { showToast("Hapus gagal, coba lagi", "error"); } }
function openEditProduction(id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  prodState.editId = id;
  document.getElementById("po-customer").value = order.customer || "";
  document.getElementById("po-team").value = order.team || "";
  document.getElementById("po-qty").value = order.qty || "";
  document.getElementById("po-material").value = normalizeMaterialName(order.material);
  document.getElementById("po-deadline").value = order.deadline || "";
  document.getElementById("po-notes").value = order.notes || "";
  document.getElementById("po-discount").value = order.discount || 0;
  document.getElementById("po-subtotal").value = order.subtotal ? "Rp" + Number(order.subtotal).toLocaleString("id-ID") : "";
  document.getElementById("po-total").value = order.total ? "Rp" + Number(order.total).toLocaleString("id-ID") : "";
  if (order.items && order.items.length) {
    window.renderProductionItems(order.items);
    setLegacyNotice(false);
  } else {
    window.renderProductionItems(legacyItemsFallback(order));
    setLegacyNotice(true);
  }
  if (order.invoiceId) {
    window._prodLinkedInvoiceId = order.invoiceId;
  }
  document.getElementById("po-modal-title").textContent = "Edit Produksi";
  openModal("modal-production");
}

/* ============================================================= */
/* 10. MAGIC TEXT PARSER — Pesanan Produksi & Invoice             */
/* ============================================================= */

// Target parsing: "production" atau "invoice"
let magicTarget = "production";

const magicRowHTML = (size, qty, mode) => `<div class="invoice-item-row" data-price-mode="${mode}"><span class="drag-handle"><i class="ri-draggable"></i></span><select class="input invoice-size"><option value="">Pilih</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option><option value="5XL">5XL</option></select><input type="number" class="input invoice-qty" placeholder="0" min="0"><input type="number" class="input invoice-price" placeholder="0" min="0" ${mode === "manual" ? "" : "readonly"}><input class="input invoice-total" readonly value="Rp0"><button type="button" class="btn btn-red btn-sm btn-icon-round" onclick="removeMagicRow(this)"><i class="ri-delete-bin-line"></i></button></div>`;

window.removeMagicRow = function (btn) {
  const wrap = document.getElementById(magicTarget === "invoice" ? "invoice-items" : "production-items");
  wrap?.querySelector(".size-wrapper")?.firstElementChild?.remove();
  refreshMagicTotals();
};

function magicContainerId() {
  return magicTarget === "invoice" ? "invoice-items" : "production-items";
}

function refreshMagicTotals() {
  if (magicTarget === "invoice") window.updateInvoiceTotals();
  else window.updateProductionTotals();
  ScrollManager.refresh(magicTarget === "invoice" ? "modal-invoice" : "modal-production");
}

// Pastikan ada grup produk; pakai yang kosong bila ada, atau buat baru
function magicEnsureGroup() {
  const wrap = document.getElementById(magicContainerId());
  if (!wrap) return null;
  const groups = wrap.querySelectorAll(".invoice-product-group");
  for (const g of groups) {
    if (!(g.querySelector(".invoice-product")?.value || "").trim()) return g;
  }
  if (magicTarget === "invoice") window.addInvoiceItem();
  else window.addProductionItem();
  return wrap.lastElementChild;
}

window.openMagicParser = function (target) {
  magicTarget = target === "invoice" ? "invoice" : "production";
  const input = document.getElementById("magic-input");
  if (input) input.value = "";
  const preview = document.getElementById("magic-preview");
  if (preview) preview.innerHTML = "";
  openModal("modal-magic");
};

window.previewMagicText = function () {
  const box = document.getElementById("magic-preview");
  if (!box) return;
  const raw = document.getElementById("magic-input")?.value || "";
  if (!raw.trim()) { box.innerHTML = ""; return; }
  const p = parseMagicText(raw);
  const sizes = Object.entries(p.sizes);
  const sum = sizes.reduce((a, [, q]) => a + q, 0);
  const row = (label, val) => `<div class="magic-chip"><span>${escapeHTML(label)}</span><b>${escapeHTML(val || "—")}</b></div>`;
  box.innerHTML =
    row("Produk", p.product) +
    row("Kategori", p.category) +
    row("Bahan", p.material) +
    row("Kerah", p.collar) +
    row("Lengan", p.sleeve) +
    `<div class="magic-chip"><span>Total</span><b>${sum} pcs${p.totalQty && p.totalQty !== sum ? ` (teks: ${p.totalQty})` : ""}</b></div>` +
    (sizes.length
      ? `<div class="magic-sizes">${sizes.map(([s, q]) => `<span class="magic-size-tag">${escapeHTML(s)}: ${q}</span>`).join("")}</div>`
      : `<div class="magic-chip magic-chip-warn"><span>Ukuran</span><b>tidak terdeteksi</b></div>`);
};

window.applyMagicText = function () {
  const raw = document.getElementById("magic-input")?.value || "";
  const p = parseMagicText(raw);
  if (!p.product && !p.material && !Object.keys(p.sizes).length) {
    return showToast("Tidak ada data yang bisa dikenali", "error");
  }
  const group = magicEnsureGroup();
  if (!group) return showToast("Gagal membuat item", "error");

  // 1. Produk -> memicu populate dropdown bahan/addon & tampil/sembunyikan field
  const prodSel = group.querySelector(".spec-product");
  if (prodSel) {
    if (p.product) prodSel.value = p.product;
    window.changeProductTemplate(prodSel);
    const catSel = group.querySelector(".spec-category");
    if (catSel && p.category) catSel.value = p.category;
  }
  // 2. Bahan
  const matSel = group.querySelector(".spec-material");
  if (matSel && p.material) matSel.value = p.material;
  // 3. Kerah (hanya tampil untuk jersey)
  const colSel = group.querySelector(".spec-collar");
  if (colSel && p.collar && colSel.style.display !== "none") colSel.value = p.collar;
  // 4. Lengan
  const slvSel = group.querySelector(".spec-sleeve");
  if (slvSel && p.sleeve) slvSel.value = p.sleeve;

  // 5. Bangun nama produk + dataset.specs lewat logic yang sudah ada
  const builderBtn = group.querySelector(".product-builder-btn");
  if (builderBtn) window.applyProductSpec(builderBtn);

  // 6. Distribusi ukuran -> baris form
  const sizeWrap = group.querySelector(".size-wrapper");
  const sizes = Object.entries(p.sizes);
  if (sizeWrap && sizes.length) {
    const mode = group.querySelector(".invoice-mode-select")?.value || "auto";
    sizeWrap.innerHTML = "";
    for (const [size, qty] of sizes) {
      sizeWrap.insertAdjacentHTML("beforeend", magicRowHTML(size, qty, mode));
      const row = sizeWrap.lastElementChild;
      row.querySelector(".invoice-size").value = size;
      row.querySelector(".invoice-qty").value = qty;
    }
  }

  refreshMagicTotals();
  closeModal("modal-magic");
  // Garbage collection: kosongkan textarea magic
  const magicBox = document.getElementById("magic-input");
  if (magicBox) magicBox.value = "";
  const sum = sizes.reduce((a, [, q]) => a + q, 0);
  showToast(`Data pesanan berhasil diekstrak otomatis! (${sum} pcs)`);
};

function resetDesignForm() {
  designState.editId = null;
  ["do-design", "do-jenis", "do-deadline", "do-notes", "do-cm", "do-price"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  window.renderDesignCustomerOptions("");
  ["dg-cm-field", "dg-price-field"].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
  const d = document.getElementById("do-deadline");
  if (d) d.value = getToday();
  const p = document.getElementById("do-price-display");
  if (p) p.value = "-";
}

function setLegacyNotice(show) {
  const banner = document.getElementById("po-legacy-banner");
  if (banner) banner.style.display = show ? "flex" : "none";
}

window.upgradeLegacyOrder = function () {
  const group = document.querySelector("#production-items .invoice-product-group");
  if (!group) return showToast("Belum ada item produk", "error");
  const builderBtn = group.querySelector(".product-builder-btn");
  if (builderBtn) window.toggleProductBuilder(builderBtn);
  ScrollManager.refresh("modal-production");
  ScrollManager.scrollWithin(group);
  showToast("Pilih detail produk lalu klik PAKAI TEMPLATE", "info");
};

function resetProductionForm() {
  prodState.editId = null;
  window._prodLinkedInvoiceId = null;
  ["po-customer", "po-team", "po-qty", "po-material", "po-deadline", "po-notes", "po-subtotal", "po-discount", "po-total"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  const itemsWrap = document.getElementById("production-items");
  if (itemsWrap) itemsWrap.innerHTML = "";
  const title = document.getElementById("po-modal-title");
  if (title) title.textContent = "Tambah Produksi";
  setLegacyNotice(false);
  const d = document.getElementById("po-deadline");
  if (d) d.value = getToday();
}

window.openAddDesignModal = function () { resetDesignForm(); openModal("modal-design"); };
window.openAddProductionModal = function () { resetProductionForm(); openModal("modal-production"); };

window.openProductionNote = function (id) {
  const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
  if (!order) return;
  document.getElementById("production-note-id").value = id;
  document.getElementById("production-note-text").value = order.notes || "";
  openModal("modal-production-note");
};
window.saveProductionNote = async function () {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  const id = document.getElementById("production-note-id")?.value;
  if (!id) return;
  const note = document.getElementById("production-note-text")?.value.trim() || "";
  try {
    await updateDoc(doc(db, "production_orders", id), { notes: note });
    const order = (window.firebaseProductionOrders || []).find((o) => o.id === id);
    if (order) order.notes = note;
    closeModal("modal-production-note");
    showToast("Catatan tersimpan");
  } catch (err) { console.error("[saveProductionNote]", err); showToast("Penyimpanan catatan gagal, coba lagi", "error"); }
};

/* ============================================================= */
/* 11. RIWAYAT ESTIMASI (localStorage)                           */
/* ============================================================= */
function deleteHistory(id) {
  if (!confirm("Hapus riwayat ini?")) return;
  deleteHistoryById(id);
  showToast("Riwayat dihapus", "info");
  renderCostingHistory();
}
function loadHistory() { renderCostingHistory(); }

/* Parse product name string into specs object */
function parseJerseySpecs(specStr, specs) {
  specs.product = "JERSEY";
  const tokens = specStr.split(" ");
  if (tokens[0] === "ATASAN" && tokens[1] === "JERSEY") {
    specs.category = "ATASAN JERSEY";
  } else if (tokens[0] === "SETELAN" && tokens[1] === "JERSEY") {
    specs.category = "SETELAN JERSEY";
  }
  const pick = (phrases, words) =>
    phrases.find((p) => specStr.includes(p)) || words.find((w) => tokens.includes(w)) || "";
  specs.material = pick(["EMBOSS TOPO", "EMBOSS STRAW"], ["MILANO", "BINTIK", "PUMA", "AIRWALK", "EMBOSS"]);
  specs.collar = pick(["POLO V-NECK", "KERAH KANCING"], ["O-NECK", "V-NECK", "V-VARIASI", "V-POTONG", "KUPLUK"]);
  specs.sleeve = pick([], ["PENDEK", "PANJANG", "3/4", "7/8"]);
  specs.addon = pick([], ["OVERSIZE"]);
}

function parseKaosSpecs(specStr, specs) {
  specs.product = "KAOS";
  const tokens = specStr.split(" ");
  tokens.forEach((t) => {
    if (["HITAM", "PUTIH", "MERAH", "MAROON", "NAVY", "BIRU BENHUR", "ABU"].includes(t)) specs.color = t;
    if (["30S", "24S", "20S"].includes(t)) specs.material = "COTTON COMBED " + t;
    if (["PENDEK", "PANJANG", "3/4", "7/8"].includes(t)) specs.sleeve = t;
    if (["OVERSIZE"].includes(t)) specs.addon = t;
  });
  if (!specs.color) specs.color = "HITAM";
  if (!specs.material) specs.material = "COTTON COMBED 30S";
}

function parseKemejaSpecs(specStr, specs) {
  specs.product = "KEMEJA";
  const tokens = specStr.split(" ");
  tokens.forEach((t) => {
    if (["AMERICAN DRILL", "NAGATA DRILL", "RIPSTOP"].includes(t)) specs.material = t;
    if (["PENDEK", "PANJANG"].includes(t)) specs.sleeve = t;
    if (["TAMBAH TITIK BORDIR"].includes(t)) specs.addon = t;
  });
  if (!specs.material) specs.material = "AMERICAN DRILL";
}

function parseProductSpecs(productName) {
  if (!productName) return null;
  const parts = productName.split("|");
  if (parts.length < 2) return null;
  const specStr = parts[1].trim().toUpperCase();
  const specs = { product: "", category: "", color: "", material: "", sleeve: "", collar: "", addon: "" };
  if (specStr.startsWith("ATASAN JERSEY") || specStr.startsWith("SETELAN JERSEY")) {
    parseJerseySpecs(specStr, specs);
  } else if (specStr.startsWith("KAOS")) {
    parseKaosSpecs(specStr, specs);
  } else if (specStr.startsWith("KEMEJA")) {
    parseKemejaSpecs(specStr, specs);
  }
  return specs;
}
window.collectInvoiceItems = function () {
  const items = [];
  document.querySelectorAll("#invoice-items .invoice-product-group").forEach((group) => {
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
      <select class="input spec-color kaos-field" style="display:none"><option value="HITAM">HITAM</option><option value="PUTIH">PUTIH</option><option value="ABU">ABU</option><option value="BIRU BENHUR">BIRU BENHUR</option><option value="MAROON">MAROON</option><option value="MERAH">MERAH</option><option value="NAVY">NAVY</option></select>
      <select class="input spec-sleeve"><option value="PENDEK">PENDEK</option><option value="PANJANG">PANJANG +10K</option><option value="3/4">3/4 +10K</option><option value="7/8">7/8 +10K</option></select>
      <select class="input spec-collar jersey-field"><option value="O-NECK">O-NECK</option><option value="V-NECK">V-NECK</option><option value="V-VARIASI">V-VARIASI</option><option value="V-POTONG">V-POTONG</option><option value="POLO V-NECK">POLO V-NECK +5K</option><option value="KERAH KANCING">KERAH KANCING +10K</option><option value="KUPLUK">KUPLUK +10K</option></select>
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
  ScrollManager.refresh("modal-invoice");
  ScrollManager.scrollWithin(wrap.lastElementChild);
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
  ScrollManager.refresh("modal-invoice");
  if (target && document.body.contains(target)) ScrollManager.scrollWithin(target);
};

window.updateInvoiceTotals = function (manualPrice = false) {
  let subtotal = 0;
  document.querySelectorAll("#invoice-items .invoice-item-row").forEach((row) => {
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
        const groupQty = Array.from(group.querySelectorAll(".invoice-qty")).reduce((s, q) => s + (Number(q.value) || 0), 0);
        autoPrice = getProductBasePrice(pt, { qty: groupQty || 1, material: mat, category: cat, sleeve: slv });
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
          } else if (slv !== "pendek" && slv !== "panjang") {
            // Matrix (Jersey) hanya mencakup pendek & panjang; 3/4 & 7/8 lewat addon
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
  // Label lengan mengikuti produk: Jersey +10K, Kaos +5K, Kemeja tanpa charge
  const sleeveSelect = panel.querySelector(".spec-sleeve");
  if (sleeveSelect) {
    const q34 = sleeveSelect.querySelector('option[value="3/4"]');
    const q78 = sleeveSelect.querySelector('option[value="7/8"]');
    const label = type === "JERSEY" ? "+10K" : type === "KAOS" ? "+5K" : "";
    if (q34) q34.textContent = "3/4 " + label;
    if (q78) q78.textContent = "7/8 " + label;
  }
  if (type === "JERSEY") {
    jerseyFields.forEach((el) => el.style.display = "block");
    kaosFields.forEach((el) => el.style.display = "none");
    material.innerHTML = `<option value="MILANO">MILANO</option><option value="BINTIK">BINTIK</option><option value="PUMA">PUMA</option><option value="AIRWALK">AIRWALK +10K</option><option value="EMBOSS TOPO">EMBOSS TOPO +10K</option><option value="EMBOSS STRAW">EMBOSS STRAW +10K</option>`;
    addon.innerHTML += `<option value="OVERSIZE">OVERSIZE +5K</option>`;
  }
  if (type === "KAOS") {
    jerseyFields.forEach((el) => el.style.display = "none");
    kaosFields.forEach((el) => el.style.display = "block");
    material.innerHTML = `<option value="COTTON COMBED 30S">COTTON COMBED 30S</option><option value="COTTON COMBED 24S">COTTON COMBED 24S</option><option value="COTTON COMBED 20S">COTTON COMBED 20S</option>`;
    addon.innerHTML += `<option value="OVERSIZE">OVERSIZE +5K</option>`;
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
    return `<tr><td class="col-no">${index + 1}</td><td class="col-product"><div class="table-title">${escapeHTML(displayTitle)}</div>${displaySubtitle ? `<div class="table-subtitle">${escapeHTML(displaySubtitle)}</div>` : ""}</td><td class="col-size">${item.size || "-"}</td><td class="col-qty">${item.qty || 0}</td><td class="col-price">${formatRupiah(item.price || 0)}</td><td class="col-total">${formatRupiah((item.qty || 0) * (item.price || 0))}</td></tr>`;
  }).join("");
  if (items.length < 5) {
    tableRows += `<tr class="empty-row"><td colspan="6"></td></tr>`;
  }
  return `<div class="invoice">
<header class="invoice-header">
  <div class="invoice-header__label"><img class="text-vertical" src="./assets/icons/text-invoice.svg" alt="Invoice" onerror="this.style.display='none'"></div>
  <div class="invoice-header__left-group">
    <div class="invoice-header__company"><img class="company-logo" src="./assets/icons/logo-progress.svg" alt="Progress Logo" onerror="this.style.display='none'"><div class="company-info"><h1 class="company-name">PROGRESS PRINTSHOP</h1><p class="company-tagline">ISOLATED PRINT STUDIO IN THE WILD</p></div></div>
    <div class="invoice-header__contact"><div class="contact-item">Pacul Village, Talang, Tegal, Central Java, Indonesia</div><div class="contact-item"><i class="ri-instagram-line"></i> @progressprintshop | <i class="ri-whatsapp-line"></i> +62 882 3254 8532</div></div>
  </div>
  <div class="invoice-header__right-group">
    <div class="total-card">
      <div class="total-card__inner"><span class="total-card__label">TOTAL TAGIHAN</span><span class="total-card__value">${formatRupiah(total)}</span></div>
      <div class="total-card__client"><span class="total-card__customer-label">CUSTOMER</span><span class="total-card__customer">${escapeHTML(customer.toUpperCase())}</span></div>
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
      <div class="summary-text">${escapeHTML(note) || "Tidak ada catatan"}</div>
    </div>
  </div>
  <div class="summary-right">
    <div class="totals">
      <div class="total-row"><span class="total-label">Subtotal</span><span class="total-value">${formatRupiah(subtotal)}</span></div>
      <div class="total-row"><span class="total-label">Diskon</span><span class="total-value">-${formatRupiah(discount)}</span></div>
      <div class="grand-total"><span class="grand-total-label">TOTAL KESELURUHAN</span><span class="grand-total-value">${formatRupiah(total)}</span></div>
    </div>
    <div class="signature-area">
      <div class="signature"><img class="signature-image" src="./assets/images/signature-progress.png" alt="Tanda Tangan Progress" onerror="this.style.display='none'"><div class="signature-line"></div><div class="signature-title"><strong>Danny Pratama</strong><br><span>Founder & Graphic Designer</span></div></div>
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
  await whenAuthed();
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
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
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
  const filter = document.getElementById("invoice-filter")?.value || "";
  if (search) invoices = invoices.filter((i) => (i.customer || "").toLowerCase().includes(search) || (i.invoiceNo || "").toLowerCase().includes(search));
  if (filter) invoices = invoices.filter((i) => i.status === filter);
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
    const firstProduct = escapeHTML((o.items?.[0]?.product || o.invoiceNo).split("|")[0].trim());
    return `<tr><td class="table-number">${rowNumber}</td><td><div class="table-customer"><div class="table-avatar" style="background:${avatar.bg};color:${avatar.text};"><i class="ri-user-3-fill"></i></div><div class="table-info"><div class="table-title">${escapeHTML(o.customer)} ${prodBadge}</div><div class="table-subtitle">${escapeHTML(o.invoiceNo)}</div></div></div></td><td><div class="table-title">${firstProduct}</div></td><td><div class="table-title">${formatDateID(o.date)}</div></td><td><div class="table-title">${formatRupiah(o.total)}</div></td><td><span class="badge-status ${o.status === "paid" ? "badge-done" : "badge-design"}">${o.status === "paid" ? "LUNAS" : "DP"}</span></td><td class="table-action"><div class="action-dropdown"><button class="btn btn-ghost btn-sm btn-icon-round dropdown-toggle" onclick="toggleActionDropdown(this, event)"><i class="ri-more-2-fill"></i></button><div class="dropdown-menu"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openInvoicePreview('${o.id}')"><i class="ri-eye-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditInvoice('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteInvoice('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div></td></tr>`;
  }).join("");
  if (mobileList) {
    mobileList.innerHTML = visible.map((o) => `<div class="history-mobile-item"><div class="history-mobile-head"><div><div class="history-mobile-customer">${escapeHTML(o.customer)}</div><div class="history-mobile-title">${escapeHTML(o.invoiceNo)}</div></div><span class="badge-status ${o.status === "paid" ? "badge-done" : "badge-design"}">${o.status === "paid" ? "LUNAS" : "DP"}</span></div><div class="mobile-meta"><div class="mobile-meta-item"><i class="ri-calendar-line"></i><span>${formatDateID(o.date)}</span></div><div class="mobile-meta-item"><i class="ri-money-dollar-circle-line"></i><span>${formatRupiah(o.total)}</span></div></div><div class="history-mobile-actions"><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openInvoicePreview('${o.id}')"><i class="ri-eye-line"></i></button><button class="btn btn-ghost btn-sm btn-icon-round" onclick="openEditInvoice('${o.id}')"><i class="ri-edit-line"></i></button><button class="btn btn-red btn-sm btn-icon-round" onclick="deleteInvoice('${o.id}')"><i class="ri-delete-bin-line"></i></button></div></div>`).join("");
  }
  renderPagination("invoice-pagination", p.page, p.totalPages, "changeInvoicePage", totalRows);
};

window.deleteInvoice = async function (id) {
  if (!(await whenAuthed())) return showToast("Menyambung ke server, coba lagi sebentar", "error");
  if (!confirm("Hapus invoice ini?")) return;
  try {
    await deleteDoc(doc(db, "invoices", id));
    const linked = (window.firebaseProductionOrders || []).find((o) => o.invoiceId === id);
    if (linked) {
      await updateDoc(doc(db, "production_orders", linked.id), { invoiceId: deleteField() });
      linked.invoiceId = null;
    }
    showToast("Invoice dihapus");
  } catch (err) { console.error("[deleteInvoice]", err); showToast("Hapus gagal, coba lagi", "error"); }
};

window.changeInvoicePage = function (page) {
  pagination.invoices = page;
  window.renderInvoices();
  document.getElementById("invoice-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ============================================================= */
/* 12. COLLAPSE / EXPAND SECTION                                  */
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
/* 13. ACTION DROPDOWN                                            */
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
/* 14. CALLBACK PAGINASI                                         */
/* ============================================================= */
window.changeDesignPage = function (page) { pagination.designOrders = page; renderDesignOrders(); document.getElementById("design-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeProductionPage = function (page) { pagination.productionOrders = page; renderProductionOrders(); document.getElementById("production-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeCostingHistoryPage = function (page) { pagination.costingHistory = page; renderCostingHistory(); };
window.changeDesignHistoryPage = function (page) { pagination.designHistory = page; renderDesignHistory(); document.getElementById("design-history-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.changeProductionHistoryPage = function (page) { pagination.productionHistory = page; renderProductionHistory(); };

/* ============================================================= */
/* 15. FIREBASE                                                   */
/* ============================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, onSnapshot, query, orderBy, where, getDocs, deleteField, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

/* ============================================================= */
/* OFFLINE PERSISTENCE (graceful)                                */
/*                                                              */
/* Firebase v9+ memakai IndexedDB sebagai cache lokal. API      */
/* lama enableIndexedDbPersistence() sudah deprecated, sehingga  */
/* di sini memakai pola modern: initializeFirestore() dengan    */
/* persistentLocalCache().                                       */
/*                                                              */
/* Bila IndexedDB tidak tersedia (mis. mode incognito/private   */
/* window, atau browser tanpa dukungan LocalStorage), blok     */
/* di bawah TIDAK melempar error: initializeFirestore()         */
/* di-catching dan turun ke getFirestore(). Firestore lalu      */
/* otomatis memakai cache memori dan tetap online-bisa.         */
/* ============================================================= */
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  console.info("[Firebase] Cache lokal aktif (IndexedDB, multi-tab).");
} catch (err) {
  db = getFirestore(firebaseApp);
  console.info("[Firebase] Cache lokal tidak tersedia, memakai mode online saja.", err && err.message);
}

/* ============================================================= */
/* ANONYMOUS AUTH (wajib untuk Firestore)                        */
/*                                                              */
/* Security Rules mengizinkan akses hanya bila request.auth    */
/* terisi. Aplikasi tidak punya halaman login, jadi user       */
/* dibuat otomatis sebagai "anonymous" saat halaman dimuat.     */
/*                                                              */
/* PENTING: onSnapshot yang dipasang SEBELUM user terautentikasi*/
/* akan menerima permission-denied dan TIDAK pernah pulih       */
/* otomatis. Karena itu seluruh inisialisasi Firestore          */
/* ditunda sampai signInAnonymously() selesai.                  */
/* ============================================================= */
const auth = getAuth(firebaseApp);

/* Resolve setelah status auth diketahui (berhasil maupun gagal),
   sehingga init tidak menggantung selamanya saat jaringan mati. */
let authSettled;
const authReady = new Promise((resolve) => { authSettled = resolve; });
let authOk = false;

/* Menunggu user terautentikasi sebelum menjalankan operasi Firestore. */
async function whenAuthed() {
  await authReady;
  return authOk;
}

/* Dipakai oleh fungsi simpan/hapus: menunda sampai auth selesai
   agar tidak lebih dulu ditolak rules. */
window.whenAuthed = whenAuthed;

(async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await signInAnonymously(auth);
      authOk = true;
      console.info(`[Firebase Auth] Anonymous Auth aktif (percobaan ${attempt}).`);
      break;
    } catch (err) {
      const network = /network-request-failed|timeout|unavailable/i.test(`${err && err.code} ${err && err.message}`);
      if (attempt === 3 || !network) {
        console.info("[Firebase Auth] Gagal masuk secara anonim:", err && err.code);
        console.info("[Firebase Auth] Cek: Firebase Console > Authentication > Sign-in method > Anonymous > Enable.");
        break;
      }
      console.info(`[Firebase Auth] Jaringan bermasalah, mencoba lagi (${attempt}/3)...`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  authSettled();
})();

/* State */
window.firebaseDesignOrders = [];
window.firebaseInvoices = [];
window.firebaseProductionOrders = [];
window.firebaseCostingOrders = [];
window.isDark = false;

/* ============================================================= */
/* 16. RENDER DEBOUNCED — Mencegah render tabel tiap ketikan    */
/* ============================================================= */

window.debouncedRenderDesignOrders = debounce(() => renderDesignOrders(), 280);
window.debouncedRenderProductionOrders = debounce(() => renderProductionOrders(), 280);
window.debouncedRenderCostingHistory = debounce(() => renderCostingHistory(), 280);
window.debouncedRenderDesignHistory = debounce(() => renderDesignHistory(), 280);
window.debouncedRenderProductionHistory = debounce(() => renderProductionHistory(), 280);
window.debouncedRenderInvoices = debounce(() => window.renderInvoices(), 280);

/* ============================================================= */
/* REALTIME LISTENERS — semua handle disimpan agar bisa di-unsubscribe
   (mencegah penumpukan listener / memory leak bila didaftarkan ulang). */

const realtimeUnsubs = [];

function clearRealtimeListeners() {
  while (realtimeUnsubs.length) {
    const unsub = realtimeUnsubs.pop();
    try { unsub(); } catch (e) { console.warn("[clearRealtimeListeners]", e); }
  }
}
window.clearRealtimeListeners = clearRealtimeListeners;

function listen(queryRef, next, error) {
  realtimeUnsubs.push(onSnapshot(queryRef, next, error));
  return realtimeUnsubs[realtimeUnsubs.length - 1];
}

/* Error handler default untuk realtime listener.
   Tanpa ini, error Firestore (mis. permission-denied saat Security Rules
   belum dikonfigurasi) akan menjadi unhandled rejection: data di layar
   diam-diam kosong tanpa penjelasan ke user. */
let _listenerErrorShown = false;
function listenerError(collName) {
  return (err) => {
    console.error(`[Firestore:${collName}]`, err && err.code ? `${err.code} - ${err.message}` : err);
    if (_listenerErrorShown) return;
    _listenerErrorShown = true;
    const offline = /unavailable|network-request-failed|deadline-exceeded/i.test((err && err.code) || "");
    showToast(
      offline
        ? "Koneksi ke server terputus. Data mungkin tidak lengkap."
        : "Sinkronisasi data gagal. Periksa koneksi & aturan keamanan Firebase.",
      "error"
    );
  };
}

function startRealtimeListeners() {
  // Pembersihan dulu: aman kalau dipanggil ulang (reconnect / reload)
  clearRealtimeListeners();

  /* Customer Loyal + rate khusus (disimpan di Firestore, di-seed sekali saja) */
  listen(query(collection(db, "design_customers"), orderBy("name", "asc")), (snapshot) => {
    const list = [];
    snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
    window.designCustomers = list;
    window.renderDesignCustomerOptions(document.getElementById("do-customer")?.value || "");
  }, async (err) => {
    console.error("[design_customers]", err);
    window.designCustomers = [...LOYAL_CUSTOMERS_SEED];
    window.renderDesignCustomerOptions(document.getElementById("do-customer")?.value || "");
  });

  listen(query(collection(db, "design_orders"), orderBy("createdAt", "desc")), (snapshot) => {
    window.firebaseDesignOrders = [];
    snapshot.forEach((d) => window.firebaseDesignOrders.push({ id: d.id, ...d.data() }));
    renderDesignOrders();
    renderDesignHistory();
    updatePipeline();
    renderTaskList();
    updateHero();
  }, listenerError("design_orders"));

  listen(query(collection(db, "production_orders"), orderBy("createdAt", "desc")), (snapshot) => {
    window.firebaseProductionOrders = [];
    snapshot.forEach((d) => window.firebaseProductionOrders.push({ id: d.id, ...d.data() }));
    renderProductionOrders();
    renderProductionHistory();
    updateProductionPipeline();
    renderTaskList();
    updateHero();
  }, listenerError("production_orders"));

  listen(query(collection(db, "invoices"), orderBy("createdAt", "desc")), (snapshot) => {
    window.firebaseInvoices = [];
    snapshot.forEach((d) => window.firebaseInvoices.push({ id: d.id, ...d.data() }));
    window.renderInvoices();
    renderTaskList();
  }, listenerError("invoices"));

  listen(query(collection(db, "costing_history"), orderBy("created", "desc")), (snapshot) => {
    window.firebaseCostingOrders = [];
    snapshot.forEach((d) => window.firebaseCostingOrders.push({ id: d.id, ...d.data() }));
    renderCostingHistory();
  }, listenerError("costing_history"));
}

/* Bootstrap Firestore: ditunda sampai anonymous auth selesai,
   karena listener yang dipasang tanpa user akan ditolak rules. */
(async () => {
  const ok = await whenAuthed();
  if (!ok) {
    console.info("[Firebase Auth] Listener dinonaktifkan sampai login berhasil.");
    return;
  }
  startRealtimeListeners();

  /* Seed data awal bila koleksi masih kosong */
  try {
    const snap = await getDocs(query(collection(db, "design_customers")));
    if (snap.empty) {
      for (const c of LOYAL_CUSTOMERS_SEED) {
        await addDoc(collection(db, "design_customers"), { ...c, createdAt: serverTimestamp() });
      }
    }
  } catch (err) {
    console.info("[seed design_customers]", err && err.code);
    window.designCustomers = [...LOYAL_CUSTOMERS_SEED];
    window.renderDesignCustomerOptions("");
  }
})();

/* ============================================================= */
/* 17. INIT — Dijalankan sekali saat halaman siap              */
/* ============================================================= */
function init() {
  initPinLock(); // lock PIN dicek lebih dulu (sebelum data dimuat)
  loadTheme();
  applyEstimatorVendor(DEFAULT_ESTIMATOR_VENDOR); // label kartu + dropdown bahan ikut vendor
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
/* 18. GLOBAL WINDOW BINDINGS                                    */
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
