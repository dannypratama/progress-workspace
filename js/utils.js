/**
 * Utilitas Murni — Format, Matematika, dan Helper
 * Kumpulan fungsi tanpa efek samping yang dipakai seluruh modul:
 * format angka & tanggal, escape HTML, debounce, dan paginasi.
 */

import { MASTER_PRICE_DATABASE } from "./database.js";

export function rupiah(n) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function angka(v) {
  return parseFloat(String(v).replace(/\./g, "")) || 0;
}

export function formatRibuan(el) {
  el.value = el.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function titleCase(el) {
  el.value = el.value.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()).trim();
}

export function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

export function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getNum(id) {
  return parseFloat(document.getElementById(id)?.value) || 0;
}

/** Delay pemanggilan fn sampai user berhenti mengetik (default 280ms).
 *  Mencegah render tabel berjalan destruktif setiap ketikan. */
export function debounce(fn, wait = 280) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn.apply(this, args); }, wait);
  };
}

/* ============================================================= */
/* 1. FORMAT TANGGAL                                            */
/* ============================================================= */
/* getToday() & <input type="date"> WAJIB YYYY-MM-DD (dipakai untuk
   perbandingan & disimpan ke database).
   YYYY-MM-DD -> DD-MM-YYYY hanya untuk TAMPILAN. */

function pad2(v) {
  return String(v).padStart(2, "0");
}

/** Ubah ke YYYY-MM-DD. Aman untuk input "YYYY-MM-DD", "DD-MM-YYYY",
 *  timestamp ISO, atau objek Date. Mengembalikan "" bila tidak valid. */
export function toIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD / ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Format locale lama hasil toLocaleDateString("id-ID") = D/M/YYYY.
  // Wajib dicek manual: new Date("28/6/2026") invalid & bisa geser 1 hari.
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Format untuk TAMPILAN: DD-MM-YYYY (mis. 28-06-2026). */
export function formatDateID(value) {
  if (!value) return "-";
  const iso = toIsoDate(value);
  if (!iso) return String(value);
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}

/** Panjang CM -> nilai meter polos tanpa satuan: 80cm -> "0.8", 130cm -> "1.3" */
export function formatMeterValue(cm) {
  const m = Number(cm) / 100;
  if (!Number.isFinite(m) || m === 0) return "0";
  return String(parseFloat(m.toFixed(2)));
}

/** Rate -> format "K": 10000 -> "10K", 7500 -> "7.5K" */
export function formatRateK(value) {
  const n = Number(value) || 0;
  const k = n / 1000;
  return `${parseFloat(k.toFixed(2))}K`;
}

/** Angka dengan pemisah ribuan tanpa simbol mata uang: 8000 -> "8.000" */
export function formatNumberID(value) {
  return (Number(value) || 0).toLocaleString("id-ID");
}

export function getAngka(id) {
  return angka(document.getElementById(id)?.value || "");
}

export function isLegacyOrder(order) {
  if (!order) return false;
  return !Array.isArray(order.items) || order.items.length === 0;
}

export function legacyItemsFallback(order) {
  const qty = Number(order?.qty) || 1;
  const total = Number(order?.total ?? order?.subtotal) || 0;
  return [{
    product: order?.material || order?.team || "PRODUK CUSTOM",
    size: "",
    qty,
    price: qty ? Math.round(total / qty) : 0,
    total,
    priceMode: "manual",
    discountPerPcs: 0,
    specs: null,
  }];
}

export function populateFilterSelect(selectId, values, label = "Semua") {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = el.value;
  const uniq = [...new Set((values || []).filter((v) => v !== null && v !== undefined && String(v).trim() !== ""))].sort((a, b) => String(a).localeCompare(String(b), "id"));
  el.innerHTML = `<option value="">${escapeHTML(label)}</option>` + uniq.map((v) => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
  if (uniq.includes(current)) el.value = current;
}

export function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatInvoiceDate(dateString) {
  if (!dateString) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric", month: "long", day: "numeric",
    }).format(new Date(dateString));
  } catch (e) {
    return dateString;
  }
}

export const avatarPalettes = [
  { bg: "rgba(37, 211, 102, 0.35)", text: "#25D366" },
  { bg: "rgba(18, 140, 126, 0.35)", text: "#128C7E" },
  { bg: "rgba(52, 183, 241, 0.35)", text: "#34B7F1" },
  { bg: "rgba(255, 167, 38, 0.35)", text: "#FFA726" },
  { bg: "rgba(171, 71, 188, 0.35)", text: "#AB47BC" },
  { bg: "rgba(236, 64, 122, 0.35)", text: "#EC407A" },
  { bg: "rgba(0, 172, 193, 0.35)", text: "#00ACC1" },
  { bg: "rgba(66, 165, 245, 0.35)", text: "#42A5F5" },
  { bg: "rgba(255, 82, 82, 0.35)", text: "#FF5252" },
];

const usedAvatarColors = new Map();

export function getAvatarPalette(name = "") {
  if (usedAvatarColors.has(name)) return usedAvatarColors.get(name);
  const palette = avatarPalettes[Math.floor(Math.random() * avatarPalettes.length)];
  usedAvatarColors.set(name, palette);
  return palette;
}

export const PAGE_SIZE = 5;

export const pagination = {
  designOrders: 1,
  productionOrders: 1,
  designHistory: 1,
  productionHistory: 1,
  costingHistory: 1,
  invoices: 1,
};

export function paginate(data, page) {
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  const start = (page - 1) * PAGE_SIZE;
  return {
    page, totalPages, start,
    end: start + PAGE_SIZE,
    items: data.slice(start, start + PAGE_SIZE),
  };
}

export function renderPagination(containerId, page, totalPages, callback, totalItems = 0) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (totalPages <= 1) { el.innerHTML = ""; return; }
  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalItems);
  let html = `<div class="pagination-wrap">`;
  html += `<button class="btn btn-ghost btn-sm" ${page === 1 ? "disabled" : ""} onclick="${callback}(${page - 1})">&lt;</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn ${i === page ? "btn-solid" : "btn-ghost"} btn-sm" onclick="${callback}(${i})">${i}</button>`;
  }
  html += `<button class="btn btn-ghost btn-sm" ${page === totalPages ? "disabled" : ""} onclick="${callback}(${page + 1})">&gt;</button>`;
  html += `</div><div class="pagination-info">Menampilkan ${startItem}–${endItem} dari ${totalItems} data</div>`;
  el.innerHTML = html;
}

export function handleUppercaseInput(inputElement) {
  const start = inputElement.selectionStart;
  const end = inputElement.selectionEnd;
  inputElement.value = inputElement.value.toUpperCase();
  inputElement.setSelectionRange(start, end);
}

/* ============================================================= */
/* 2. MAGIC TEXT PARSER                                         */
/* ============================================================= */
/* Parse format pesanan bebas menjadi data form.                   */
/* Contoh input:                                                  */
/*   ATASAN JERSEY / MILANO / POLO V-NECK TUTUP / PANJANG         */
/*   S = 1 / M = 2 / XL = 5 / 2XL = 1  ...  TOTAL 11 PCS          */

export const MAGIC_SIZES = ["1", "2", "3", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
// Global: wajib ada separator simbol (= : -) -> aman dari "TOTAL 11 PCS"
const MAGIC_SIZE_GLOBAL = /(?<![A-Z0-9/])(\d{1,2}\s*xl|x{1,2}l|[1-5]|xs|s|m|l)\s*[-:=–—]\s*(\d{1,4})(?![0-9])/gi;
// Per baris: separator hanya spasi (mis. "XL 5")
const MAGIC_SIZE_SPACED = /^\s*(\d{1,2}\s*xl|x{1,2}l|[1-5]|xs|s|m|l)\s+(\d{1,4})\s*$/i;
const MAGIC_SLEEVE_RULES = [
  { value: "3/4", re: /3\s*\/\s*4/ },
  { value: "7/8", re: /7\s*\/\s*8/ },
  { value: "PANJANG", re: /PANJANG/ },
  { value: "PENDEK", re: /PENDEK/ },
];
const MAGIC_PRODUCTS = ["JERSEY", "KAOS", "KEMEJA"];
const MAGIC_COLLARS = ["O-NECK", "V-NECK", "V-VARIASI", "V-POTONG", "POLO V-NECK", "KERAH KANCING", "KUPLUK"];

// buang semua non-alphanumeric -> agar "V-NECK" == "V NECK" == "VNECK"
const magicTight = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function magicNormalizeSize(raw) {
  const t = String(raw || "").toUpperCase().replace(/\s+/g, "");
  return t === "XXL" ? "2XL" : t;
}

function magicCandidateKeys(value) {
  const keys = new Set();
  const up = String(value || "").toUpperCase();
  keys.add(magicTight(up));
  const words = up.split(/\s+/).filter(Boolean);
  if (words.length > 2) keys.add(magicTight(words.slice(-2).join(" ")));
  return [...keys].filter(Boolean);
}

// Kunci kerah tambahan: buang awalan "V-" agar "VARIASI" -> V-VARIASI
function magicCollarKeys(value) {
  const up = String(value || "").toUpperCase();
  const keys = magicCandidateKeys(up);
  if (/^V-/i.test(up)) keys.push(up.replace(/^V-/i, ""));
  return keys.filter(Boolean);
}

// Return NILAI kandidat (bukan kuncinya); pilih kunci terpanjang agar
// "POLO V-NECK" menang atas "V-NECK".
function magicMatch(text, candidates, keyBuilder) {
  let bestValue = "";
  let bestLen = 0;
  for (const cand of candidates) {
    for (const key of keyBuilder(cand)) {
      if (key && key.length > bestLen && text.includes(key)) {
        bestLen = key.length;
        bestValue = cand;
      }
    }
  }
  return bestValue;
}

// Edit distance <= 1 (satu huruf typo)
function magicWithin1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return diff === 1;
  }
  const s = a.length < b.length ? a : b;
  const l = a.length < b.length ? b : a;
  let i = 0, j = 0, skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; }
    else { if (skipped) return false; skipped = true; j++; }
  }
  return true;
}

function magicFuzzyInText(text, needle) {
  const n = needle.length;
  if (!n) return false;
  if (text.includes(needle)) return true;
  // Uji panjang n-1 / n / n+1 agar typo "hilang huruf" (VNEK -> VNECK) tertangkap
  for (const w of [n - 1, n, n + 1]) {
    if (w < 1) continue;
    for (let i = 0; i + w <= text.length; i++) {
      if (magicWithin1(text.substr(i, w), needle)) return true;
    }
  }
  return false;
}

// Fallback typo-tolerant (mis. "VNEK" -> V-NECK)
function magicMatchFuzzy(text, candidates) {
  let best = "";
  let bestLen = 0;
  for (const cand of candidates) {
    const key = magicTight(cand);
    if (key.length > bestLen && magicFuzzyInText(text, key)) {
      bestLen = key.length;
      best = cand;
    }
  }
  return best;
}

function magicMaterialCandidates() {
  const out = [];
  const jersey = MASTER_PRICE_DATABASE.materials?.jersey || {};
  for (const k of Object.keys(jersey)) {
    if (k === "emboss") continue; // generik; diwakili "emboss topo"/"emboss straw"
    out.push(k.toUpperCase());
  }
  for (const k of Object.keys(MASTER_PRICE_DATABASE.products?.kaos?.tiers || {})) out.push(k);
  for (const k of Object.keys(MASTER_PRICE_DATABASE.products?.kemeja?.tiers || {})) out.push(k);
  return out;
}

export function parseMagicText(rawText) {
  const source = String(rawText || "");
  const tight = magicTight(source);
  const upper = source.toUpperCase();
  const result = { product: "", category: "", material: "", collar: "", sleeve: "", sizes: {}, totalQty: 0 };

  // 1. Ukuran & qty (dua pola terpisah: ada simbol vs hanya spasi)
  const addSize = (raw, qty) => {
    const size = magicNormalizeSize(raw);
    const n = Number(qty);
    if (!size || !MAGIC_SIZES.includes(size) || !n) return;
    result.sizes[size] = (result.sizes[size] || 0) + n;
  };
  for (const m of source.matchAll(MAGIC_SIZE_GLOBAL)) addSize(m[1], m[2]);
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(MAGIC_SIZE_SPACED);
    if (m) addSize(m[1], m[2]);
  }
  // Urutkan kanonik (1,2,3,S,M,L,XL,2XL,...) agar baris form tampil benar
  const orderedSizes = {};
  for (const s of MAGIC_SIZES) if (result.sizes[s]) orderedSizes[s] = result.sizes[s];
  result.sizes = orderedSizes;
  const totalMatch = source.match(/(\d+)\s*pcs/i);
  if (totalMatch) result.totalQty = Number(totalMatch[1]);

  // 2. Produk
  for (const p of MAGIC_PRODUCTS) {
    if (tight.includes(p)) { result.product = p; break; }
  }

  // 3. Kategori (khusus jersey)
  if (result.product === "JERSEY" || !result.product) {
    if (tight.includes("SETELAN")) result.category = "SETELAN JERSEY";
    else if (tight.includes("ATASAN")) result.category = "ATASAN JERSEY";
  }

  // 4. Bahan (single source of truth = MASTER_PRICE_DATABASE)
  result.material = magicMatch(tight, magicMaterialCandidates(), magicCandidateKeys);

  // 5. Kerah: exact dulu, lalu fallback typo-tolerant
  if (result.product === "JERSEY" || !result.product) {
    result.collar = magicMatch(tight, MAGIC_COLLARS, magicCollarKeys);
    if (!result.collar) result.collar = magicMatchFuzzy(tight, MAGIC_COLLARS);
  }

  // 6. Lengan (regex WAJIB di teks asli; pada teks tight "3/4" jadi "34")
  for (const rule of MAGIC_SLEEVE_RULES) {
    if (rule.re.test(upper)) { result.sleeve = rule.value; break; }
  }

  return result;
}
