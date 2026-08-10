/* ============================================================= */
/* PURE FUNCTIONS — Formatting, Math, Helpers                    */
/* ============================================================= */

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
  return new Date().toISOString().split("T")[0];
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
