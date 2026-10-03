# PHASE 1 AUDIT REPORT — Progress Printshop Workspace

**FASE 1: AUDIT TOTAL & PEMETAAN DEPENDENSI**
**Status:** READ-ONLY — No code changes performed
**Tanggal Audit:** 2026-08-11
**Berdasarkan:** docs/rules/workflow-rules.md (FASE 1)

> **Lokasi** : `docs/audit-phase1-archive.md` · **Status** : ARSIP (sudah kadalaluarsa, dipindahkan dari root)

---

## 1. Codebase Overview

### 1.1 File Structure & LOC

| # | File | LOC | Peran |
|---|------|-----|-------|
| 1 | `js/app.js` | 1.457 | ENTRY POINT — Firebase init, global handlers, invoice builder, listeners |
| 2 | `js/database.js` | 268 | MASTER pricing database & constants |
| 3 | `js/storage.js` | 151 | localStorage operations (autosave, history, tasks, section state) |
| 4 | `js/utils.js` | 106 | Pure helpers (formatting, pagination, avatar) |
| 5 | `js/components/costing.js` | 396 | Cost calculator, charts, history rendering |
| 6 | `js/components/tracker.js` | 211 | Kanban/pipeline rendering & filtering |
| 7 | `js/components/tasks.js` | 67 | To-do list (localStorage) |
| 8 | `index.html` | 1.996 | UI, modals, forms |
| 9 | `css/variables.css` | 115 | CSS variables & theme (light/dark) |
| 10 | `css/main.css` | 568 | Layout & base |
| 11 | `css/components.css` | 1.542 | Components (pipeline, table, invoice, modal) |
| 12 | `css/mobile.css` | 561 | Responsive < 768px |
| 13 | `docs/rules/*.md` (5 file) | ~4.000 | Dokumentasi kerja |

**Total JS:** ~2.656 baris | **Total HTML:** ~1.996 baris | **Total CSS:** ~2.786 baris

### 1.2 Tech Stack (verified)

- Vanilla JS ES Modules (type="module" di index.html → `js/app.js`)
- Firebase Firestore via CDN `firebase 10.12.2` (import URL di `app.js:1304-1308`) — config HADIR & lengkap (`app.js:1310-1318`)
- Chart.js, html2canvas 1.4.1, SortableJS 1.15, Remixicon (CDN)
- State: `window.*` globals + localStorage
- Tidak ada build tooling, test runner, atau linter di repo

### 1.3 Kontrak Modul (Ekspor)

- **database.js:** `BAHAN`, `CFG`, `DESIGN_STAGES`, `PRODUCTION_STAGES`, `KEYS`, `MASTER_PRICE_DATABASE`, `getProductBasePrice`, `findTierPrice`, `calculateInvoiceItem`
- **storage.js:** `saveAuto`, `loadAuto`, `saveHistory`, `getHistory`, `deleteHistoryById`, `loadHistoryData`, `getTasks`, `saveTasks`, `saveSectionState`, `restoreSectionState`
- **utils.js:** `rupiah`, `angka`, `formatRibuan`, `titleCase`, `setText`, `getToday`, `formatRupiah`, `formatInvoiceDate`, `avatarPalettes`, `getAvatarPalette`, `PAGE_SIZE`, `pagination`, `paginate`, `renderPagination`
- **costing.js:** `hitungBahan`, `hitung`, `hitungTambahan`, `tambahItem`, `hapusItem`, `resetCard`, `resetFormCosting`, `hitungEstimasi`, `setChartTheme`, `costChart`, `updateCostChart`, `pipeChart`, `updatePipelineChart`, `updateCharts`, `customerSortModes`, `toggleCustomerSort`, `renderCostingHistory`, `renderDesignHistory`, `renderProductionHistory`
- **tracker.js:** `updateHero`, `designState`, `renderDesignOrders`, `setDesignFilter`, `filterByStage`, `prodState`, `renderProductionOrders`, `filterProductionStage`, `updatePipeline`, `updateProductionPipeline`
- **tasks.js:** `saveTask`, `toggleTask`, `deleteTask`, `renderTaskList`

---

## 2. File-by-File Analysis

### 2.1 `js/database.js`
- **Purpose:** Single source of truth: harga bahan, konfigurasi, stages, keys localStorage, pricing matrix.
- **Key findings:**
  - `MASTER_PRICE_DATABASE.products.kaos.tiers` dan `kemeja.tiers` memiliki **gap tier**: `{min:1,max:1}` lalu `{min:12,max:49}` → qty 2–11 TIDAK match tier apapun → `findTierPrice` return 0 (lihat Bug P1-02).
  - `getProductBasePrice` untuk jersey memetakan SEMUA material non-EMBOSS (BINTIK BRAZIL, PUMA, AIRWALK) ke grup `MILANO`; premium material di `materials.jersey` tidak ikut dipakai di sini (hanya di `updateInvoiceTotals` app.js). Duplikasi logika.
  - `calculateInvoiceItem` (fungsi pricing paling kompleks) **TIDAK PERNAH dipanggil** dari manapun (dead code / orphaned).
  - `KEYS.design_orders` & `KEYS.production_orders` didefinisikan tapi tidak pernah dipakai.
- **Risk areas:** konsistensi harga (dua jalur pricing: database.js vs app.js), tier gap, silent fallback.

### 2.2 `js/storage.js`
- **Purpose:** localStorage handler.
- **Key findings:**
  - Import sirkular: storage.js → costing.js (`hitung`, `tambahItem`, dll) dan costing.js → storage.js (`saveAuto`, `getHistory`, dll).
  - Import tidak terpakai: `setText`, `getToday`, `hitungBahan`, `hitungTambahan`.
  - `saveHistory()` tanpa limit ukuran array → risiko quota overflow (bug potensial, P2).
  - `saveSectionState` memakai string `"sectionStates"` hardcoded, bukan `KEYS.*` (tidak konsisten).
  - `saveAuto()` debounce timer tidak pernah di-clear pada unmount → kebocoran timer potensial.
  - `restoreSectionState()` default untuk `report-section` tidak ada di index.html (section tidak ada).
- **Risk areas:** quota, korupsi data (silent fail di loadAuto), migrasi.

### 2.3 `js/utils.js`
- **Purpose:** pure helpers.
- **Key findings:**
  - `rupiah(n)` → `"Rp" + Math.round(n).toLocaleString("id-ID")`; tidak handle NaN/Infinity/negatif. `rupiah(NaN)` → `"RpNaN"`.
  - `getToday()` memakai `toISOString()` → **berbasis UTC**, bisa selisih 1 hari dari tanggal lokal WIB (Bug P2-01).
  - `getAvatarPalette` memakai `Math.random()` (bukan deterministic) + `usedAvatarColors` Map tidak pernah dibersihkan → memory growth & warna berubah antar reload (bertentangan dengan dokumentasi "deterministic").
  - `renderPagination` membuat `onclick="${callback}(${page})"` string → tidak ES6-safe / CSP-unsafe (tech debt).
- **Risk areas:** format angka, UTC date, leak Map.

### 2.4 `js/app.js` (1.457 baris — melampaui guideline 500 baris)
- **Purpose:** entry point: Firebase init, listeners, semua handler CRUD, invoice builder.
- **Key findings:**
  - **Firebase config ADA dan lengkap** (kontradiksi dengan dokumentasi Bug 17 yang menyebut config hilang — sudah ter-resolve di kode saat ini).
  - 4 `onSnapshot` terdaftar SEKALI di top-level (design_orders, production_orders, invoices, costing_history) — sudah benar (tidak ada listener per-render).
  - **`costing_history` listener mengisi `window.firebaseCostingOrders` namun `renderCostingHistory()` membaca dari localStorage (`getHistory()`) → data Firestore costing tidak pernah tampil**; dan tidak ada kode yang menulis costing ke Firestore (listener inert).
  - **Chart canvas TIDAK ADA di index.html** (`chart-cost`, `chart-pipeline` tidak ada) → `updateCostChart`/`updatePipelineChart` selalu `return` dini; fitur chart mati total.
  - `saveProductionNote()` hanya memutasi objek di array lokal, **TIDAK menulis ke Firestore** → catatan tidak tersimpan (P1).
  - `openProductionNote`/`saveProductionNote` memakai `Number(id)` padahal doc id Firestore string (alphanumeric) → `NaN` untuk id non-numerik.
  - Modal "Tambah Desain"/"Tambah Produksi" hanya `openModal(...)` → `designState.editId`/`prodState.editId` **tidak di-reset** saat buka modal baru; form juga tidak dikosongkan → risiko menimpa order lama (P1, data loss).
  - Judul modal produksi di-set "Edit Produksi" saat edit tapi **tidak pernah dikembalikan** ke "Tambah Produksi".
  - Duplikasi besar: `updateProductionTotals` ≈ `updateInvoiceTotals` (~40 baris identik), `collectProductionItems` ≈ `collectInvoiceItems` (identik), `addProductionItem` ≈ `addInvoiceItem`, `renderProductionItems` ≈ `loadInvoiceItems`.
  - Import tidak terpakai: `BAHAN`, `hitungBahan`, `updateCostChart`, `updatePipelineChart`, `costChart`, `pipeChart`.
  - `window.addProductionItem = addProductionItem` (baris 1427–1435) adalah rebinding diri yang redundan (harmless, karena global `window` env tersedia di module — bukan crash).
  - `generateInvoiceHTML` memakai data mentah item + `formatRupiah`, **tidak memakai `calculateInvoiceItem`** → DP, remaining, bonus, HPP tidak muncul di invoice.
  - `deleteInvoice` tidak membersihkan link `invoiceId` di production order (orphan link).
  - `downloadInvoiceAsImage` pakai `scale: 2` fixed (bukan `devicePixelRatio`).
- **Risk areas:** ukuran file, duplikasi, state modal, persisten catatan, dead code.

### 2.5 `js/components/costing.js`
- **Purpose:** kalkulator HPP + chart + riwayat.
- **Key findings:**
  - `hitung()` → `const pcs = g("pcs") || 1` → **divide-by-zero SUDAH ter-guard** (Bug 7 di docs sudah teratasi di file ini).
  - `hitungBahan()` tidak validasi range negatif → input negatif menghasilkan biaya negatif.
  - `hargaJualPcs` tanpa `min=0` → profit negatif bisa dianggap valid.
  - Chart `costChart`/`pipeChart` sudah di-destroy sebelum re-create (baik) — tapi canvas tidak ada di HTML.
  - `renderCostingHistory` dan render history lain memakai `innerHTML` + user data (XSS sink).
  - `tambahItem` menyisipkan `data.nama` mentah ke innerHTML (dari autosave localStorage → XSS).
  - `renderProductionHistory` memakai `#design-history-search` (salah id — harusnya `production-history-search`) → pencarian produksi membaca input pencarian desain.
- **Risk areas:** NaN, XSS, chart mati, salah id.

### 2.6 `js/components/tracker.js`
- **Purpose:** kanban/pipeline render.
- **Key findings:**
  - `renderDesignOrders`/`renderProductionOrders` innerHTML dengan data user (XSS sink).
  - Filter/search **tidak me-reset pagination ke halaman 1** → page 2 kosong setelah filter (Bug 2 di docs, masih ada).
  - `filterByStage`/`filterProductionStage` toggle state; konsisten.
  - `updateHero` menghitung overdue pakai string compare — rawan salah satu hari karena UTC (lihat Bug P2-01).
  - Import tidak terpakai: `updateCharts`.
- **Risk areas:** pagination state, XSS, tanggal.

### 2.7 `js/components/tasks.js`
- **Purpose:** to-do list.
- **Key findings:**
  - Sederhana, low risk. `renderList` innerHTML user text (XSS sink minor).
  - `saveTask` memakai `showToast`/`closeModal` global (window) — berfungsi karena app.js dievaluasi lebih dulu; namun rapuh (module bergantung pada global side-effect).
- **Risk areas:** rendah.

### 2.8 `index.html`
- **Key findings:**
  - **HTML tidak valid:** ada `<head>` bersarang di dalam `<body>` (baris 12–15) dan `<meta>` duplikat `apple-mobile-web-app-status-bar-style`.
  - Duplikat `id="design-arrow"` (costing-history-section & design-history-section).
  - **Tidak ada canvas `chart-cost`/`chart-pipeline` dan tidak ada `report-section`** (section charts hilang).
  - Tidak ada `role="dialog"`/`aria-modal` pada modal; toast tanpa `aria-live`.
  - `user-scalable=no` → aksesibilitas (zoom dimatikan).
  - Hero fallback teks "Senin, 25 Mei 2026" (stale).
  - SVG lokal (`/text-invoice.svg`, `/logo-progress.svg`, `/progress-footer.svg`) ADA di root (verified) — ok.
  - Kolom action dropdown menu dibuat dengan `onclick` string (tech debt).
- **Risk areas:** validitas HTML, aksesibilitas, duplicate id.

### 2.9 CSS (`variables.css`, `main.css`, `components.css`, `mobile.css`)
- **Key findings:**
  - Dark mode via `body.dark` override variabel — solid; namun ada hardcoded warna di beberapa tempat (`#1a1b1c` hero, `.total-card` `#191b1c`, invoice `#fff` — invoice sengaja putih untuk PNG).
  - Breakpoint hanya `max-width:768px` di mobile.css; tidak ada breakpoint eksplisit 480px/1200px.
  - Touch target: `.btn-icon-round` 34px (desktop), di mobile jadi 42px; `.btn-sm` di mobile jadi 32px (baris 173 mobile.css) → **di bawah 44px guideline**.
  - `.invoice-item-row` grid 6 kolom dengan ukuran fixed (24px + 1fr + 80px + 120px + 120px + 36px) → sempit di 480px, di-mobile di-grid ulang 2 kolom (ok).
  - `.summary-block` hardcode `#1a1b1c` dark selalu (bukan variabel) — konsisten di kedua tema tapi tidak ikut tema.
- **Risk areas:** touch targets, kurang breakpoint, beberapa hardcode.

---

## 3. Dependency Map

```
                ┌──────────────────────────────────────────────┐
                │                  index.html                  │
                │  (UI + modal + CDN: Chart.js, html2canvas,   │
                │   Sortable, Remixicon)                       │
                └──────────────────┬───────────────────────────┘
                                   │ <script type="module">
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                        app.js  (ENTRY POINT)                        │
│  Firebase init • 4× onSnapshot • CRUD handlers • invoice builder   │
│  • global window.* bindings                                         │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────┘
       │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼
  database.js  utils.js   storage.js  costing.js  tracker.js  tasks.js
  (pure data) (pure fn)      ▲            │           │          │
       │          │          │◄───────────┘           │          │
       │          │          │   CIRCULAR! storage ↔  │          │
       │          │          │   costing (import loop) │         │
       │          │          │                         │          │
       │          └──────────┼─────────────────────────┼──────────┘
       │                     │                         │
       ▼                     ▼                         ▼
  window.firebaseDesignOrders / firebaseProductionOrders / firebaseInvoices
       ▲                     (shared mutable global state)
       │
  onSnapshot callbacks → renderDesignOrders / renderProductionOrders /
  renderInvoices / renderCostingHistory / updateHero / updatePipeline
```

### Keterangan Aliran Data

```
User input (estimator) ─▶ hitung() [costing.js] ─▶ hitungBahan() + hitungTambahan()
        └──▶ updateCostChart() (matikan: canvas tidak ada)
        └──▶ saveAuto() [storage.js]
        └──▶ saveHistory() → localStorage KEYS.history

User input (production/invoice item) ─▶ updateProductionTotals()/updateInvoiceTotals() [app.js]
        └──▶ getProductBasePrice() [database.js]  ← satunya fungsi pricing yang benar-benar dipakai
        └──▶ MASTER_PRICE_DATABASE (material premium, addons, sizeCharges)

Firebase snapshot ─▶ window.firebase* ─▶ render* (tracker/costing/app) ─▶ DOM innerHTML
```

### Temuan Penting Dependency

1. **Satu-satunya jalur pricing yang LIVE** adalah `getProductBasePrice` yang dipanggil `updateProductionTotals`/`updateInvoiceTotals` di app.js (baris 280 & 690). `calculateInvoiceItem` di database.js **tidak terhubung** ke UI manapun.
2. **Import sirkular** `storage.js ↔ costing.js` — berfungsi karena lazy binding, tapi rapuh dan sulit di-debug.
3. `tracker.js` impor `updateCharts` dari costing.js tapi tidak dipakai (akan memicu siklus tambahan kalau dibiarkan).
4. Global `window.*` dipakai lintas module (window.firebase*, window.hitung, dll) — sesuai aturan Rule #2, namun membuat coupling implisit.

---

## 4. Bug & Issue Inventory

### 4.1 Ringkasan (Prioritized)

| # | Severity | Module | Function | Issue | Trigger | Impact | Fix Complexity |
|---|----------|--------|----------|-------|---------|--------|----------------|
| P1-01 | **CRITICAL** | app.js / index.html | — | Canvas chart (`chart-cost`, `chart-pipeline`) & `report-section` tidak ada di HTML | Buka app / toggle dark | Fitur grafik mati total; `updateCostChart`/`updatePipelineChart` silent-return | MEDIUM |
| P1-02 | **CRITICAL** | database.js | `findTierPrice` / `getProductBasePrice` | Gap tier: qty 2–11 tidak match tier → harga 0 (kaos/kemeja) | Order kaos/kemeja qty 2–11 | Harga satuan = Rp0 / hanya size charge → invoice salah & rugi | LOW |
| P1-03 | **CRITICAL** | app.js | `updateProductionTotals` / `updateInvoiceTotals` | Tier/lusinan dihitung per-ROW qty, bukan total order → jersey 12 pcs dipecah 4 baris dapet harga satuan; kaos per-row 2–11 → 0 | Buat invoice/produksi multi-ukuran | Harga otomatis salah besar | MEDIUM |
| P1-04 | **CRITICAL** | app.js | `saveProductionNote` | Catatan hanya mutasi array lokal, tidak `updateDoc`; id di-parse `Number()` | Buka & simpan catatan produksi | Catatan hilang saat reload | LOW |
| P1-05 | **CRITICAL** | app.js / tracker.js | Modal open + `designState.editId` / `prodState.editId` | `editId` & isi form tidak di-reset saat buka modal "Tambah ..." | Edit order lalu Tambah baru tanpa menyimpan | Order lama bisa tertimpa (data loss) | LOW |
| P1-06 | **HIGH** | tracker.js / costing.js / app.js / tasks.js | render* (innerHTML) | XSS: data user (customer, design, team, notes, task, extra nama) dimasukkan mentah ke `innerHTML` | Input nama dengan `<img onerror=…>` | Eksekusi script, data terbaca | MEDIUM |
| P2-01 | HIGH | utils.js | `getToday` | `toISOString()` berbasis UTC → tanggal bisa mundur 1 hari (WIB pagi) | Akses sebelum 07:00 WIB | Deadline/overdue salah hitung 1 hari | LOW |
| P2-02 | HIGH | app.js / costing.js | `calculateInvoiceItem` | Dead code / tidak terhubung; logika pricing duplikat di 2 tempat | Perubahan harga hanya di 1 tempat | Harga tidak konsisten antar modul | MEDIUM |
| P2-03 | HIGH | storage.js | `saveHistory` | Array history tanpa limit → quota overflow | Simpan riwayat berkali-kali | `localStorage.setItem` throw QuotaExceededError → crash penyimpanan | LOW |
| P2-04 | HIGH | tracker.js | `renderDesignOrders` / `renderProductionOrders` | Pagination tidak di-reset saat filter/search berubah | Di page 2 lalu cari/filter | Page kosong / data tak terlihat | LOW |
| P2-05 | HIGH | app.js | `deleteInvoice` | Tidak membersihkan link `invoiceId` di production order | Hapus invoice | Production order menunjuk ke invoice yang sudah hilang (orphan) | LOW |
| P2-06 | HIGH | app.js | onSnapshot costing_history | Listener `costing_history` mengisi array yang tidak pernah dirender; costing hanya di localStorage | Buka app | Data costing tidak sinkron Firestore; listener percuma | MEDIUM |
| P2-07 | HIGH | costing.js | `renderProductionHistory` | Memakai `#design-history-search` (salah id) | Cari di riwayat produksi | Search produksi tidak berfungsi | LOW |
| P3-01 | MEDIUM | app.js | — | Import tidak terpakai: `BAHAN`, `hitungBahan`, `updateCostChart`, `updatePipelineChart`, `costChart`, `pipeChart` (app.js); `setText`, `getToday`, `hitungBahan`, `hitungTambahan` (storage.js); `updateCharts` (tracker.js) | — | Dead code, peningkatan bundle mental | LOW |
| P3-02 | MEDIUM | storage.js ↔ costing.js | — | Import sirkular | Boot app | Rapuh, sulit debug | MEDIUM |
| P3-03 | MEDIUM | app.js | `updateProductionTotals` / `updateInvoiceTotals` / `collect*` | Duplikasi ~40+ baris identik antar production & invoice | — | DRY violation, bug fix ganda | MEDIUM |
| P3-04 | MEDIUM | costing.js | `hitungBahan` / `hitung` | Tidak ada validasi range negatif; `hargaJualPcs` tanpa min=0 | Input negatif | Biaya/profit negatif tampil | LOW |
| P3-05 | MEDIUM | utils.js | `getAvatarPalette` | `Math.random()` (bukan deterministik) + Map tanpa cleanup | Banyak customer unik | Warna berubah tiap reload; memory growth | LOW |
| P3-06 | MEDIUM | utils.js | `renderPagination` | Inline `onclick` string | Render pagination | Tidak ES6-safe, CSP conflict | LOW |
| P3-07 | MEDIUM | index.html | — | `<head>` bersarang + meta duplikat; `id="design-arrow"` duplikat; `user-scalable=no` | Validasi HTML | HTML invalid, aksesibilitas menurun | LOW |
| P3-08 | MEDIUM | app.js | `downloadInvoiceAsImage` | `scale: 2` fixed, tidak pakai `devicePixelRatio` | Export PNG di layar hi-DPI | PNG kurang tajam di Retina | LOW |
| P3-09 | MEDIUM | app.js | `openEditProduction` | `po-modal-title` di-set "Edit Produksi" tidak pernah kembali ke "Tambah Produksi" | Edit lalu Tambah baru | Label modal salah | LOW |
| P3-10 | MEDIUM | storage.js | `saveSectionState` | Key `"sectionStates"` hardcoded, tidak lewat `KEYS`; `report-section` tidak ada di HTML | — | Inkonsistensi konstanta; state section untuk section yang hilang | LOW |
| P3-11 | MEDIUM | database.js | `KEYS` | `KEYS.design_orders` & `KEYS.production_orders` tidak pernah dipakai | — | Dead constant | LOW |
| P4-01 | LOW | index.html | — | Hero fallback tanggal statis "Senin, 25 Mei 2026" | — | Informasi usang sebelum JS jalan | LOW |
| P4-02 | LOW | costing.js | renderCostingHistory / renderDesignHistory / renderProductionHistory | `colspan` empty-state tidak sesuai jumlah kolom (8 vs 9, 5 vs 6, dst) | List kosong | Layout kosong sedikit miring | LOW |
| P4-03 | LOW | app.js | — | `console.log` boot tersisa (baris 1457) | — | Debug log | LOW |

### 4.2 Detail Bug Prioritas 1

```
[CRITICAL] [app.js/index.html] [Chart rendering — updateCostChart/updatePipelineChart]
Description: costChart & pipeChart mengquery #chart-cost / #chart-pipeline, tapi canvas
             tersebut tidak ada di index.html (juga section report-section hilang).
Trigger:     Setiap hitung() memanggil updateCostChart(); toggleDark/onSnapshot
             memanggil updateCharts().
Impact:      Fitur grafik tidak pernah tampil; kode chart mati tanpa error (silent return).
Fix Complexity: MEDIUM (tambah canvas + section report + muat ulang render)
Blocked By:  None
```

```
[CRITICAL] [database.js] [findTierPrice / getProductBasePrice]
Description: Tier kaos/kemeja punya gap: {min:1,max:1} lalu {min:12,max:49} dst.
             qty 2–11 tidak match → return 0.
Trigger:     Hitung invoice/order kaos/kemeja qty 2–11.
Impact:      Base price Rp0 → subtotal hanya size charge/custom; kerugian/penagihan salah.
Fix Complexity: LOW (isi gap tier atau clamp qty ke tier terdekat)
Blocked By:  None
```

```
[CRITICAL] [app.js] [updateProductionTotals / updateInvoiceTotals]
Description: getProductBasePrice dipanggil dengan qty PER-ROW (qty ukuran), bukan total
             order. Jersey 12 pcs dalam 4 baris (3+3+3+3) → masing-masing <12 → harga
             "satuan" bukan "lusinan". Kaos per-row qty 2–11 → 0.
Trigger:     Order/invoice dengan beberapa baris ukuran.
Impact:      Harga otomatis salah untuk hampir semua order multi-ukuran.
Fix Complexity: MEDIUM (agregasi qty per group sebelum lookup tier)
Blocked By:  P1-02 (gap tier)
```

```
[CRITICAL] [app.js] [saveProductionNote]
Description: saveProductionNote mengubah order.notes di array lokal saja (tanpa
             updateDoc Firestore), dan id diparse via Number() (Firestore id = string).
Trigger:     Simpan catatan dari modal note.
Impact:      Catatan hilang setelah refresh; untuk id non-numerik lookup gagal.
Fix Complexity: LOW
Blocked By:  None
```

```
[CRITICAL] [app.js/tracker.js] [Modal open + editId state]
Description: openModal('modal-design'/'modal-production') tidak mereset editId maupun
             isi form. Setelah edit satu order lalu tutup modal tanpa simpan,
             "Tambah Desain/Produksi" berikutnya masih berisi data lama dan
             saveDesignOrder/saveProductionOrder akan menimpa doc lama.
Trigger:     Edit → tutup tanpa simpan → klik Tambah baru.
Impact:      Data order tertimpa (data loss) tanpa konfirmasi.
Fix Complexity: LOW
Blocked By:  None
```

---

## 5. Performance Baseline

> **Catatan:** repo tidak memiliki benchmark/test runner. Berikut baseline statis berdasarkan inspeksi kode — nilai aktual perlu diukur di browser (F12 → Performance).

| Metric | Target (docs) | Estimasi saat ini | Catatan |
|--------|---------------|-------------------|---------|
| Render tabel (5 item/halaman) | < 500 ms | ~5–20 ms | Array di-filter penuh lalu di-slice 5; OK untuk <1.000 item |
| Render chart | < 300 ms | — | **Chart tidak render** (canvas hilang) |
| Hitung `hitung()` | < 200 ms | < 5 ms | Operasi murni, aman |
| Page load | < 3 s | Tergantung CDN (Firebase/Chart.js/html2canvas) | Firebase config lengkap; 4 listener aktif |
| localStorage | — | Risiko `saveHistory` unbounded | Quota ~5–10 MB; setiap riwayat ~1–3 KB → ratusan entri aman, ribuan bisa overflow |

### Potensi Lambat / Leak
1. `usedAvatarColors` Map tak pernah di-clear (utils.js) → growth seiring customer unik.
2. `autoSaveTimer` di storage.js tak di-clear pada unmount (minor, SPA satu halaman).
3. `hitung()` memicu `updateCostChart` + `saveAuto` pada setiap input → jika chart diaktifkan kembali, pastikan destroy-before-create tetap (sudah benar).
4. String building render sudah memakai `.map().join()` (baik), bukan `+=`.

---

## 6. Security Assessment

| Area | Status | Detail |
|------|--------|--------|
| **XSS via innerHTML** | 🔴 GAP | `renderDesignOrders`, `renderProductionOrders`, `renderInvoices`, `renderCostingHistory`, `renderTaskList`, `tambahItem` memasukkan user input (customer, design, notes, team, task text, extra name) langsung ke `innerHTML` tanpa escape. Input disimpan di Firestore/localStorage → **stored XSS** |
| Input validation (sebelum Firebase) | 🔴 GAP | `saveDesignOrder`/`saveProductionOrder` hanya cek `customer` non-empty; tidak ada sanitasi/escape; angka tidak divalidasi range |
| Sensitive data | 🟢 OK | localStorage hanya data bisnis; Firebase config berisi `apiKey` (publik untuk web Firebase — wajar, tapi jangan dianggap secret) |
| Firebase rules | ⚠️ Tidak diverifikasi | Tidak ada file rules di repo; `allow read, write: if true` (dev) disebut di docs — **harus direview** |
| Firestore error handling | 🟡 Sebagian | `saveDesignOrder`/`saveProductionOrder`/`delete*` ada try-catch tapi pesan generic "Penyimpanan gagal" tanpa log detail (hanya `console.error(err)`) |
| localStoraw integrity | 🟡 Sebagian | `loadAuto` punya try-catch; `getHistory`/`getTasks` parse tanpa try-catch → JSON corrupt bisa crash |
| Inline handlers | 🟡 Tech debt | Ratusan `onclick="..."` string (CSP-incompatible, global name lookup) |
| Negative/zero validation | 🟡 Gap | qty/harga bisa negatif; tier gap menghasilkan harga 0 |

**Rekomendasi keamanan (untuk FASE 5):** gunakan helper `escapeHTML()` untuk semua interpolasi user data, atau `.textContent`; tambahkan validasi angka (`Math.max(0, …)`, `Number.isFinite`); cek Firestore rules; replace inline onclick dengan event delegation/addEventListener.

---

## 7. Accessibility Issues

| # | Issue | Lokasi | Impact |
|---|-------|--------|--------|
| A-1 | Modal tanpa `role="dialog"`, `aria-modal`, `aria-labelledby` | index.html semua modal | Screen reader tidak tahu ada dialog |
| A-2 | Toast tanpa `role="status"`/`aria-live` | index.html #toast | Notifikasi tak diumumkan |
| A-3 | `user-scalable=no` pada viewport | index.html:7 | Zoom dilarang → gagal WCAG 1.4.4 |
| A-4 | Tombol icon tanpa `aria-label` (theme, nav menu, close, dropdown) | index.html | Tombol tanpa nama aksesibel |
| A-5 | Touch target < 44px | mobile.css `.btn.btn-sm` 32px, beberapa 34px | Sulit disentuh di mobile |
| A-6 | Kontras: beberapa teks `--text-muted` (#909095 pada #f5f5f5) | variables.css | Kontras rendah untuk teks kecil |
| A-7 | Banyak interaksi via `onclick` string | semua | Keyboard navigation tidak dijamin (tombol OK, tapi kurang semantik) |
| A-8 | Fokus keyboard tidak dikelola (focus trap modal tidak ada) | app.js openModal/closeModal | Focus bisa kabur dari modal |

---

## 8. Mobile Responsive Issues

| Breakpoint | Status | Temuan |
|-----------|--------|--------|
| 480px | ⚠️ Sebagian | Hanya media `max-width:768px`; tidak ada aturan khusus 480px. Tabel disembunyikan → mobile list (ok). Modal full-width bottom sheet (ok). `.invoice-item-row` jadi 2 kolom (ok). Touch target 32px (<44px) |
| 768px | ⚠️ Sebagian | Layout 1 kolom untuk grid; `.pipeline` horizontal scroll (ok). `hide-mobile` menyembunyikan filter select di header section → di mobile pengguna kehilangan filter dropdown (design-filter & production-filter) |
| 1200px | 🟢 OK | Layout penuh 1280px, grid auto-fit |

### Isu Khusus Mobile
1. **Filter (select) disembunyikan di mobile** via `.hide-mobile` → tidak ada pengganti filter di mobile list (desain/produksi).
2. **Touch targets kecil:** `.btn-sm` 32px, `.btn-icon-round` di atas jadi 42px, `history-mobile-actions .btn` 34px.
3. `user-scalable=no` merusak zoom aksesibilitas.
4. Invoice preview toolbar di-mobile di-stack (ok) tapi tombol 38px.
5. Dropdown action (`.dropdown-menu`) absolute dengan 5–6 tombol horizontal → bisa overflow di layar 320px.

---

## 9. Edge Cases Catalog

| # | Skenario | Perilaku saat ini | Status |
|---|----------|-------------------|--------|
| E-1 | qty kaos/kemeja 2–11 | Harga base 0 | 🔴 BUG (P1-02) |
| E-2 | Order multi-ukuran (jersey) | Harga satuan bukan lusinan | 🔴 BUG (P1-03) |
| E-3 | pcs = 0 di estimator | Guarded (`|| 1`) → tidak NaN | 🟢 OK |
| E-4 | `customer` kosong | Toast error di save | 🟢 OK |
| E-5 | Nama dengan karakter spesial/XSS | Ter-render mentah | 🔴 BUG (P1-06) |
| E-6 | Deadline "hari ini" diakses <07:00 WIB | UTC selisih 1 hari | 🔴 BUG (P2-01) |
| E-7 | localStorage JSON corrupt (history/tasks) | Crash (tanpa try-catch) | 🟡 Risiko |
| E-8 | localStorage quota penuh | `saveHistory` throw, error generic | 🟡 Risiko (P2-03) |
| E-9 | Firestore id non-numerik pada modal note | `Number(id)` = NaN | 🔴 BUG (P1-04) |
| E-10 | Edit order → buka Tambah baru tanpa simpan | Form/state lama masih terisi | 🔴 BUG (P1-05) |
| E-11 | Harga manual 0 / negatif | Diizinkan | 🟡 Risiko |
| E-12 | Chart canvas hilang | Silent no-op | 🔴 BUG (P1-01) |
| E-13 | Invoice tanpa item | Toast "Minimal 1 item" | 🟢 OK |
| E-14 | Hapus invoice dari order produksi | Link invoiceId menggantung | 🟡 Risiko (P2-05) |
| E-15 | Riwayat produksi dicari | Memakai input search desain (salah id) | 🔴 BUG (P2-07) |

---

## 10. Kesimpulan & Rekomendasi FASE 2

### Ringkasan Severity
- **CRITICAL:** 6 bug (P1-01 … P1-06)
- **HIGH:** 7 bug (P2-01 … P2-07)
- **MEDIUM:** 11 isu (P3-01 … P3-11)
- **LOW:** 3 isu (P4-01 … P4-03)

### Prioritas Perbaikan FASE 2 (urutan berdampak)
1. **P1-02 + P1-03 (pricing)** — perbaiki gap tier + agregasi qty per group sebelum lookup; ini jantung bisnis (penagihan).
2. **P1-05 (state modal)** — reset `editId` + form saat openModal Tambah; cegah data loss.
3. **P1-06 (XSS)** — escape semua interpolasi user data.
4. **P1-04 (catatan produksi)** — tulis ke Firestore; jangan parse id dengan Number.
5. **P1-01 (charts)** — tambah canvas + section report, atau hapus kode chart jika fitur tidak dipakai (keputusan produk).
6. **P2-01 … P2-07** — perbaikan berantai sesuai chained-fix rule (khususnya P2-03 menyentuh storage + costing; P2-02 menghindari dual pricing).

### Catatan untuk FASE 3+
- App.js 1.457 baris → pecah (firebase-manager, invoice-builder, production-builder) di FASE 3.
- Hapus semua import/export mati; hilangkan duplikasi `updateProductionTotals`/`updateInvoiceTotals`, `collect*`, `render*`/`load*`.
- Resolusi sirkular storage ↔ costing.

---

## 11. Catatan Audit (Status Kode vs Dokumentasi)

- ✅ Firebase config sekarang ADA (docs Bug 17 menyebut hilang — sudah resolved di kode).
- ✅ Divide-by-zero di costing `hppPcs` sudah ter-guard (`pcs || 1`).
- ✅ Listener onSnapshot terdaftar sekali per collection (tidak per-render).
- ❌ `calculateInvoiceItem` (dipuja-puja di docs sebagai "wajib dipakai") justru dead code.
- ❌ Chart (`chart-cost`, `chart-pipeline`, `report-section`) tidak pernah ada di HTML.
- ❌ Bug pagination (Bug 2 docs), state reset (Bug 13 docs), avatar leak (Bug 14 docs), XSS (Bagian 5 docs) masih aktual.

---

*Laporan ini bersifat read-only. Tidak ada file kode yang diubah selama FASE 1.*
