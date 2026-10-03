/**
 * Modul Pusat Kontrol (Tasks)
 * Menyatukan tugas manual dan tugas harian otomatis.
 *
 * Tugas manual   -> disimpan di localStorage (getTasks/saveTasks)
 * Tugas otomatis -> diturunkan dari Firestore tiap render; status
 *                  "selesai" disimpan per tanggal.
 */

import { getTasks, saveTasks, getSmartDoneMap, saveSmartDoneMap } from "../storage.js";
import { setText, escapeHTML, getToday, formatDateID, toIsoDate } from "../utils.js";

/* ===================== TUGAS MANUAL (LAMA) ===================== */

export function saveTask() {
  const text = document.getElementById("task-text").value.trim();
  if (!text) return showToast("Masukkan deskripsi", "error");
  const tasks = getTasks();
  tasks.unshift({
    id: Date.now(),
    text,
    priority: document.getElementById("task-priority").value,
    due: document.getElementById("task-due").value,
    done: false,
    created: new Date().toISOString(),
  });
  saveTasks(tasks);
  renderTaskList();
  document.getElementById("task-text").value = "";
  document.getElementById("task-due").value = "";
  closeModal("modal-task");
}

export function deleteTask(id) {
  saveTasks(getTasks().filter((t) => t.id !== id));
  renderTaskList();
}

/* Toggle untuk manual (id numerik) & otomatis (id string berawalan "auto:") */
export function toggleTask(id) {
  const key = String(id);
  if (key.startsWith("auto:")) {
    const today = getToday();
    const map = getSmartDoneMap();
    const list = new Set(map[today] || []);
    if (list.has(key)) list.delete(key); else list.add(key);
    map[today] = [...list];
    pruneSmartDone(map, today);
    saveSmartDoneMap(map);
  } else {
    const tasks = getTasks();
    const t = tasks.find((x) => String(x.id) === key);
    if (t) { t.done = !t.done; saveTasks(tasks); }
  }
  renderTaskList();
}

// Buang riwayat tanggal lama (simpan 7 hari terakhir)
function pruneSmartDone(map, today) {
  const keys = Object.keys(map).sort();
  while (keys.length > 7) delete map[keys.shift()];
}

/* ===================== TUGAS OTOMATIS ===================== */

function shiftDate(iso, days) {
  const [y, m, d] = toIsoDate(iso).split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Selisih hari antara dua tanggal (positif = from lebih lama)
function daysBetween(fromIso, toIso) {
  const [y1, m1, d1] = toIsoDate(fromIso).split("-").map(Number);
  const [y2, m2, d2] = toIsoDate(toIso).split("-").map(Number);
  if (!y1 || !y2) return 0;
  return Math.max(1, Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000));
}

/**
 * Pindai Firestore & buat daftar tugas otomatis.
 * Murni turunan data — tidak disimpan ke database.
 */
export function generateSmartDailyTasks() {
  const today = getToday();
  const tomorrow = shiftDate(today, 1);
  const doneSet = new Set(getSmartDoneMap()[today] || []);
  const out = [];

  const designs = window.firebaseDesignOrders || [];
  const productions = window.firebaseProductionOrders || [];
  const invoices = window.firebaseInvoices || [];

  const push = (t) => {
    t.auto = true;
    t.done = doneSet.has(t.id);
    out.push(t);
  };

  // Order yang sudah dapat Deadline Alert (untuk dedup approval di bawah)
  const hasDeadlineAlert = new Set();

  // 1. Deadline Alert — sudah TERLAMBAT / hari ini / besok
  for (const o of productions) {
    if (!o.deadline || o.stage === "done") continue;
    const isOverdue = o.deadline < today; // banding string YYYY-MM-DD
    const isToday = o.deadline === today;
    const isTomorrow = o.deadline === tomorrow;
    if (!isOverdue && !isToday && !isTomorrow) continue;
    const label = isOverdue ? `TERLAMBAT ${daysBetween(o.deadline, today)} hari` : isToday ? "HARI INI" : "BESOK";
    const tgl = formatDateID(o.deadline);
    const ref = o.team || o.material || "Pesanan Produksi";
    hasDeadlineAlert.add(o.id);
    push({
      id: `auto:deadline:production:${o.id}`,
      kind: "deadline",
      priority: isOverdue || isToday ? "urgent" : "high",
      text: `Deadline ${label} (${tgl}): ${ref} — ${o.customer || "-"}`,
      section: "production-section",
      refId: o.id,
    });
  }
  for (const o of designs) {
    if (!o.deadline || o.stage === "done") continue;
    const isOverdue = o.deadline < today;
    const isToday = o.deadline === today;
    const isTomorrow = o.deadline === tomorrow;
    if (!isOverdue && !isToday && !isTomorrow) continue;
    const label = isOverdue ? `TERLAMBAT ${daysBetween(o.deadline, today)} hari` : isToday ? "HARI INI" : "BESOK";
    const tgl = formatDateID(o.deadline);
    hasDeadlineAlert.add(o.id);
    push({
      id: `auto:deadline:design:${o.id}`,
      kind: "deadline",
      priority: isOverdue || isToday ? "urgent" : "high",
      text: `Deadline ${label} (${tgl}): Desain ${o.design || "-"} — ${o.customer || "-"}`,
      section: "design-section",
      refId: o.id,
    });
  }

  // 2. Unpaid Invoice Alert
  for (const inv of invoices) {
    if (inv.status !== "draft") continue;
    push({
      id: `auto:invoice:${inv.id}`,
      kind: "invoice",
      priority: "high",
      text: `Invoice ${inv.invoiceNo || "-"} belum lunas — ${inv.customer || "-"}`,
      section: "invoice-section",
      refId: inv.id,
    });
  }

  // 3. Design Approval Alert (masih di stage desain = belum disetujui)
  //    Dilewati bila order tsb sudah punya Deadline Alert (hindari 2 tugas
  //    untuk satu order yang sama — Deadline lebih mendesak).
  for (const o of designs) {
    if (o.stage !== "design") continue;
    if (hasDeadlineAlert.has(o.id)) continue;
    push({
      id: `auto:approval:design:${o.id}`,
      kind: "approval",
      priority: "normal",
      text: `Desain menunggu persetujuan: ${o.design || "-"} — ${o.customer || "-"}`,
      section: "design-section",
      refId: o.id,
    });
  }

  // Urutkan: paling mendesak dulu
  const rank = { urgent: 0, high: 1, normal: 2 };
  out.sort((a, b) => rank[a.priority] - rank[b.priority] || a.text.localeCompare(b.text));
  return out;
}

/* ===================== QUICK ACTION ===================== */

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* abaikan */ }
  document.body.removeChild(ta);
  return Promise.resolve();
}

window.copyDailyReport = function () {
  const smart = generateSmartDailyTasks();
  const manual = getTasks();
  const all = [
    ...smart.map((t) => ({ ...t, label: "Otomatis" })),
    ...manual.map((t) => ({ ...t, auto: false, label: "Manual" })),
  ];
  const done = all.filter((t) => t.done);
  const pending = all.filter((t) => !t.done);
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;
  const line = (t) => `${t.done ? "✅" : "⏳"} ${t.text} [${t.label}]`;

  const report = [
    `📋 LAPORAN TUGAS HARIAN — ${formatDateID(getToday())}`,
    `Progress: ${pct}% (${done.length}/${all.length} selesai)`,
    `🤖 Otomatis: ${smart.length} | ✍️ Manual: ${manual.length}`,
    "",
    `✅ SELESAI (${done.length}):`,
    ...(done.length ? done.map(line) : ["- (none)"]),
    "",
    `⏳ PENDING (${pending.length}):`,
    ...(pending.length ? pending.map(line) : ["- (none)"]),
  ].join("\n");

  copyText(report).then(
    () => showToast("Laporan harian disalin ke clipboard", "success"),
    () => showToast("Gagal menyalin laporan", "error")
  );
};

/* ===================== RENDER ===================== */

export function renderTaskList() {
  const smart = generateSmartDailyTasks();
  const manual = getTasks();

  const norm = (t) => ({
    ...t,
    done: !!t.done,
    auto: !!t.auto,
    label: t.auto ? "Otomatis System" : "Tugas Manual",
  });
  const all = [...smart.map(norm), ...manual.map(norm)];

  const pending = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  setText("task-pending-count", pending.length);
  setText("task-done-count", done.length);

  renderList(pending, "task-list-pending", "Tidak ada tugas tertunda");
  renderList(done, "task-list-done", "Belum ada tugas selesai");
}

function renderList(tasks, containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!tasks.length) {
    const icon = containerId.includes("done") ? "check-double" : "checkbox-blank-circle";
    el.innerHTML = `<div class="empty-state"><i class="ri-${icon}-line"></i>${msg}</div>`;
    return;
  }
  const color = { urgent: "var(--color-danger)", high: "var(--color-warning)", normal: "var(--text-muted)" };
  el.innerHTML = tasks.map((t) => {
    const isAuto = !!t.auto;
    const idAttr = isAuto ? `'${escapeHTML(t.id)}'` : Number(t.id) || 0;
    const tag = isAuto
      ? `<span class="task-tag task-tag-auto"><i class="ri-robot-2-line"></i> Otomatis</span>`
      : `<span class="task-tag task-tag-manual"><i class="ri-pencil-line"></i> Manual</span>`;
    const delBtn = isAuto
      ? ""
      : `<button class="btn btn-ghost btn-sm btn-icon-round" onclick="deleteTask(${Number(t.id) || 0})"><i class="ri-delete-bin-line"></i></button>`;
    return `
    <div class="task-item${isAuto ? " task-item-auto" : ""}">
      <div class="task-check ${t.done ? "done" : ""}" onclick="toggleTask(${idAttr})">${t.done ? '<i class="ri-check-line"></i>' : ""}</div>
      <div class="task-body">
        <div class="task-text ${t.done ? "done-text" : ""}">${escapeHTML(t.text)}</div>
        <div class="task-meta">
          ${tag}
          <span style="color:${color[t.priority] || "var(--text-muted)"};font-weight:700">${String(t.priority || "normal").toUpperCase()}</span>
          ${t.due ? `<span>· ${escapeHTML(t.due)}</span>` : ""}
        </div>
      </div>
      ${delBtn}
    </div>`;
  }).join("");
}
