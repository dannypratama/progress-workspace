/* ============================================================= */
/* TASKS MODULE — Todo List Widget (localStorage-based)          */
/* ============================================================= */

import { getTasks, saveTasks } from "../storage.js";
import { setText } from "../utils.js";

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

export function toggleTask(id) {
  const tasks = getTasks();
  const t = tasks.find((x) => x.id === id);
  if (t) { t.done = !t.done; saveTasks(tasks); renderTaskList(); }
}

export function deleteTask(id) {
  saveTasks(getTasks().filter((t) => t.id !== id));
  renderTaskList();
}

export function renderTaskList() {
  const all = getTasks();
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
  el.innerHTML = tasks.map((t) => `
    <div class="task-item">
      <div class="task-check ${t.done ? "done" : ""}" onclick="toggleTask(${t.id})">${t.done ? '<i class="ri-check-line"></i>' : ""}</div>
      <div style="flex:1;">
        <div class="task-text ${t.done ? "done-text" : ""}">${t.text}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;"><span style="color:${color[t.priority]};font-weight:600">● ${t.priority.toUpperCase()}</span> ${t.due ? `· ${t.due}` : ""}</div>
      </div>
      <button class="btn btn-ghost btn-sm btn-icon-round" onclick="deleteTask(${t.id})"><i class="ri-delete-bin-line"></i></button>
    </div>
  `).join("");
}
