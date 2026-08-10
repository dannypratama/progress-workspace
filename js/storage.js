/* ============================================================= */
/* LOCALSTORAGE HANDLER — Autosave, Load, Clear                  */
/* ============================================================= */

import { KEYS, BAHAN, CFG } from "./database.js";
import { rupiah, angka, setText, getToday } from "./utils.js";
import { hitung, hitungBahan, hitungTambahan, tambahItem } from "./components/costing.js";

let autoSaveTimer = null;

export function saveAuto() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const inputs = {};
    document.querySelectorAll("#estimator-section input, #estimator-section select").forEach((el) => {
      if (el.id) inputs[el.id] = el.value;
    });
    const extraItems = [];
    document.querySelectorAll(".extra-item").forEach((item) => {
      const nama = item.querySelector(".extra-name")?.value || "";
      const qty = parseFloat(item.querySelector(".extra-qty")?.value) || 0;
      const harga = angka(item.querySelector(".extra-price")?.value || "");
      if (!nama && !qty && !harga) return;
      extraItems.push({ nama, qty, harga });
    });
    localStorage.setItem(KEYS.autosave, JSON.stringify({ inputs, extraItems }));
  }, 800);
}

export function loadAuto() {
  const raw = localStorage.getItem(KEYS.autosave);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.keys(data.inputs || {}).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = data.inputs[id];
    });
    const extraWrap = document.getElementById("extraItems");
    if (extraWrap && extraWrap.innerHTML) extraWrap.innerHTML = "";
    if (extraWrap && Array.isArray(data.extraItems)) {
      data.extraItems.forEach((x) => tambahItem({ nama: x.nama || "", qty: x.qty || "", harga: x.harga || "" }));
    }
    hitung();
  } catch (e) { /* ignore corrupt data */ }
}

export function saveHistory() {
  const extraItems = [];
  document.querySelectorAll(".extra-item").forEach((item) => {
    const nama = item.querySelector(".extra-name")?.value || "";
    const qtyExtra = parseFloat(item.querySelector(".extra-qty")?.value) || 0;
    const harga = angka(item.querySelector(".extra-price")?.value || "");
    if (!nama && !qtyExtra && !harga) return;
    extraItems.push({ nama, qty: qtyExtra, harga, total: qtyExtra * harga });
  });
  const inputs = {};
  document.querySelectorAll("#estimator-section input, #estimator-section select").forEach((el) => {
    if (el.id) inputs[el.id] = el.value;
  });
  const qty = parseFloat(document.getElementById("pcs")?.value) || 0;
  const hargaJual = angka(document.getElementById("hargaJualPcs")?.value || "0");
  const grandTotal = parseFloat((document.getElementById("grandTotal")?.textContent || "0").replace(/[^\d]/g, "")) || 0;
  const hppPcs = qty ? Math.round(grandTotal / qty) : 0;
  const jualTotal = hargaJual * qty;
  const profit = jualTotal - grandTotal;
  const histories = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
  histories.unshift({
    id: Date.now(),
    customer: document.getElementById("customer")?.value || "Tanpa Nama",
    team: document.getElementById("team")?.value || "-",
    qty, hppPcs, hargaJual, grandTotal, totalProfit: profit,
    extraItems, inputs,
    date: new Date().toLocaleDateString("id-ID"),
    total: rupiah(grandTotal),
    created: new Date().toISOString(),
  });
  localStorage.setItem(KEYS.history, JSON.stringify(histories));
  document.querySelectorAll("#estimator-section input, #estimator-section select").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") el.checked = false;
    else el.value = "";
  });
  localStorage.removeItem(KEYS.autosave);
  const extraWrap = document.getElementById("extraItems");
  if (extraWrap) extraWrap.innerHTML = "";
  hitung();
  return histories;
}

export function getHistory() {
  return JSON.parse(localStorage.getItem(KEYS.history) || "[]");
}

export function deleteHistoryById(id) {
  let histories = getHistory();
  histories = histories.filter((h) => h.id !== id);
  localStorage.setItem(KEYS.history, JSON.stringify(histories));
  return histories;
}

export function loadHistoryData(id) {
  const histories = getHistory();
  const data = histories.find((x) => x.id === id);
  if (!data) return;
  const extraWrap = document.getElementById("extraItems");
  if (extraWrap) extraWrap.innerHTML = "";
  if (extraWrap && Array.isArray(data.extraItems)) {
    data.extraItems.forEach((x) => tambahItem({ nama: x.nama || "", qty: x.qty || "", harga: x.harga || "" }));
  }
  Object.keys(data.inputs || {}).forEach((id) => {
    if (id.includes("extra")) return;
    const el = document.getElementById(id);
    if (el) el.value = data.inputs[id];
  });
  hitung();
  document.getElementById("estimator-section")?.scrollIntoView({ behavior: "smooth" });
}

export function getTasks() {
  return JSON.parse(localStorage.getItem(KEYS.tasks) || "[]");
}

export function saveTasks(tasks) {
  localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
}

export function saveSectionState() {
  const states = {};
  document.querySelectorAll(".collapsible-section").forEach((section) => {
    states[section.id] = section.classList.contains("collapsed");
  });
  localStorage.setItem("sectionStates", JSON.stringify(states));
}

export function restoreSectionState() {
  const defaults = {
    "design-section": false,
    "production-section": false,
    "tasks-section": false,
    "invoice-section": false,
    "history-section": true,
    "design-history-section": true,
    "production-history-section": true,
    "report-section": true,
  };
  const saved = JSON.parse(localStorage.getItem("sectionStates") || "{}");
  document.querySelectorAll(".collapsible-section").forEach((section) => {
    const collapsed = Object.prototype.hasOwnProperty.call(saved, section.id) ? saved[section.id] : (defaults[section.id] ?? true);
    section.classList.toggle("collapsed", collapsed);
  });
}
