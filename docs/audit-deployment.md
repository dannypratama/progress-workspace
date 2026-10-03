# LAPORAN AUDIT & STRUKTUR KODE — PROGRESS PRINTSHOP WORKSPACE

**Tanggal audit** : 4 Oktober 2026
**Status** : ✅ **CLEANUP PRA-DEPLOYMENT SELESAI** — siap di-deploy
**Versi** : 1.1 — Modular Architecture (Vanilla ES Modules)
**Metode** : Analisis statis 100% kode (tidak ada runtime/profiling)

> **Lokasi** : `docs/audit-deployment.md` · **Deploy** : tidak ikut di-upload ke hosting

---

## CATATAN REVISI v1.4 (4 Oktober 2026) — Penataan `docs/rules/`

Folder `RULES/` dari root sudah dipindahkan ke `docs/rules/` dan semua nama file diseragamkan ke kebab-case:

| Sebelum | Sesudah |
|---|---|
| `RULES/OPENCODE_WORKFLOW_RULES.md` | `docs/rules/workflow-rules.md` |
| `RULES/OPENCODE_TECHNICAL_SPECIFICATION.md` | `docs/rules/technical-spec.md` |
| `RULES/OPENCODE_DEBUG_GUIDE.md` | `docs/rules/debug-guide.md` |
| `RULES/OPENCODE_QUICK_REFERENCE.md` | `docs/rules/quick-reference.md` |
| `RULES/README.md` | `docs/rules/readme.md` |

Root project sekarang hanya berisi: `index.html`, `firestore.rules`, `assets/`, `css/`, `js/`, `docs/` (plus `.vscode/` sebagai folder tersembunyi).

Semua rujukan silang sudah diperbarui: 4 rujukan `RULES/` di dokumen, 5 rujukan nama file `OPENCODE_*.md`, dan 3 tautan markdown internal di `docs/rules/readme.md`.

Pohon struktur di §1.1 juga di-regenerate langsung dari filesystem agar ukuran dan isi selalu akurat.

## CATATAN REVISI v1.3 (4 Oktober 2026) — Verifikasi Inisialisasi Firebase

Audit terhadap `js/app.js` + **live read-only test** ke project `progress-workspace`.

### Konfirmasi yang lulus
| Aspek | Status |
|---|---|
| Import CDN resmi ES Modules | ✅ `www.gstatic.com/firebasejs/10.12.2/` (app + firestore, versi konsisten) |
| `initializeApp()` dipanggil | ✅ tepat **1x**, top-level |
| Import sia-sia | ✅ **0** — 16 API Firebase, semua dipakai (`setDoc`/`getDoc` sudah dibuang) |
| Pola offline persistence | ✅ Modern: `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager` |
| API deprecated | ✅ Tidak memakai `enableIndexedDbPersistence` |
| Fallback graceful | ✅ `try/catch` → `getFirestore()`, hanya `console.info` (tidak pernah `console.error`) |
| Init idempoten | ✅ Dipanggil 2x tetap aman, instance sama |
| `onSnapshot` | ✅ 5 listener, **5 punya error handler** (sebelumnya hanya 1) |
| Write path | ✅ 8 fungsi: `try` + `await addDoc/updateDoc/deleteDoc` + `catch` + `showToast` |
| Rahasia | ✅ Tidak ada `private_key`; `apiKey` Web SDK bukan secret |
| Node | ✅ `node --check` 7/7 lulus |

### Live test(read-only, tidak ada data ditulis)

**Sebelum anonymous auth ditambahkan:**

```
design_customers     permission-denied
design_orders        permission-denied
production_orders    permission-denied
invoices             permission-denied
costing_history      permission-denied
onSnapshot           error callback = permission-denied
```

**Setelah `signInAnonymously()` + gating di `js/app.js`:**

```
[OK] design_customers       3 dokumen
[OK] design_orders         31 dokumen
[OK] production_orders     30 dokumen
[OK] invoices              22 dokumen
[OK] costing_history       2 dokumen
=============================================
total 88 dokumen, 0 ditolak
listener: next() dipanggil, tanpa error
```

### ✅ RESOLVED: Anonymous Auth + Security Rules

Status: **sudah berfungsi.** Dua hal sudah selesai:

1. **Security Rules** — `firestore.rules` sudah dipublish di Firebase Console dan menerima akses untuk user yang terautentikasi.
2. **Anonymous Auth** — `js/app.js` kini memanggil `signInAnonymously()` dan **menunda pemasangan `onSnapshot`** sampai login selesai.

### ⚠️ Temuan penting: race condition `onSnapshot`

Percobaan pertama memasang listener **sebelum** auth selesai. Hasilnya:

```
[SEBELUM AUTH]  next(): 0   error(): permission-denied
[SETELAH AUTH]  next(): 0   error(): permission-denied   <- TIDAK PULIH
```

`onSnapshot` yang ditolak rules **berhenti permanen** dan tidak pernah mencoba lagi. Karena itu `startRealtimeListeners()` sekarang dijalankan di dalam `(async () => { if (!(await whenAuthed())) return; ... })()`.

### Index komposit: tidak diperlukan

 keenam query aplikasi hanya memakai `orderBy` tunggal atau `where` range pada satu field — semuanya dilayani **single-field index** bawaan. Bagian Index di Firebase Console akan tetap kosong, dan itu normal. Index komposit baru dibutuhkan bila suatu saat ada query `where("x")` + `orderBy("y")` pada field berbeda.

---

## CATATAN REVISI v1.2 (4 Oktober 2026) — Penataan `assets/`

Folder aset sudah dirapikan. Tidak ada lagi file gambar/SVG di root project.

```
assets/
├── icons/                          ← icon, logo, favicon (vektor + icon app)
│   ├── favicon.png          5.5 KB
│   ├── logo-progress.svg   12.8 KB   (logo invoice, vektor)
│   └── text-invoice.svg    38.4 KB   (label vertikal invoice)
└── images/                         ← background, foto, grafik
    ├── lockscreen-bg.webp  420.6 KB  (background lock screen)
    ├── logo-progress.png    56.8 KB  (logo navbar & PIN lock, raster)
    ├── nav-bg.jpg          329.7 KB  (background hero navbar)
    ├── progress-footer.svg  77.1 KB  (footer brand)
    └── signature-progress.png 208.3 KB (signature invoice)
```

**Catatan**: `logo-progress.svg` (vektor, invoice) dan `logo-progress.png` (raster, navbar) adalah dua file berbeda dengan nama mirip — sengaja dipisah karena format & penggunaan berbeda.

**Semua path sudah relatif** — aman di-deploy di root domain maupun subfolder (GitHub Pages). `css/components.css` memakai path relatif terhadap file CSS (`../assets/images/...`).

**Verifikasi**: 0 broken link, 0 path absolut, 0 file gambar di root, syntax 7/7 OK, integrity HTML & CSS utuh.

---

## ✅ CATATAN REVISI v1.1 (4 Oktober 2026)

Seluruh poin cleanup yang disetujui reviewer sudah dieksekusi dan diverifikasi:

| Poin | Status |
|---|---|
| Hapus folder `migration/` (kosong) | ✅ Selesai |
| Hapus 3 dead import (`DESIGN_CATEGORIES`, `cmToMeter`, `getEstimatorVendor`) | ✅ Selesai |
| Hapus 12 `window.*` Firestore yang bocor | ✅ Selesai |
| Ubah 5 path absolut SVG → relatif | ✅ Selesai |
| Localisasi 5 aset `ibb.co` → `assets/images/` | ✅ Selesai (1 temuan tambahan di luar rencana) |
| Hapus 3 `@import "variables.css"` | ✅ Selesai |
| Pertahankan 137 `window.*` UI | ✅ Digunakan, tanpa regresi |

**Temuan tambahan di luar rencana awal** (berhasil ditangani):
1. **5 rujukan `ibb.co`, bukan 2** —icitual plan hanya menyebut logo + favicon. Aktualnya ada juga **background navbar** (`nav-bg.jpg` via CSS) dan **signature invoice** (`SIGNATURE-PROGRESS.png` via `app.js`). Semuanya kini lokal.
2. **2 import Firebase jadi sia-sia** setelah `window.*` dihapus: `setDoc` & `getDoc` (0 pemakaian) — ikut dibuang dari import.
3. `docs/audit-phase1-archive.md` sudah dipindahkan ke folder `docs/` (arsip, tidak mengganggu deploy).

**Angka terbaru**: 7 folder · 22 file · `window.*` 149 → **137** · 0 dead import · 0 path absolut · 0 rujukan `ibb.co` · syntax 7/7 OK.

---

## RINGKASAN EKSEKUTIF

| Aspek | Nilai | Catatan |
|---|---|---|
| Folder | 6 | bersih, tanpa folder kosong |
| File | 23 | 7 JS · 4 CSS · 4 gambar · 7 dokumenasi · 1 config |
| Total ukuran project | 1.70 MB | deploy payload hanya 1.50 MB |
| Baris JS | 4.661 | 7 modul |
| Baris CSS | 3.433 | 4 file |
| Deploy payload | 14 file / 1.407 KB | gzip ≈ 394 KB |
| Path rusak | **0** | Semua referensi lokal valid |
| Syntax error | **0** | `node --check` lulus semua modul |
| Cyclic import | **1** | `storage.js` ⇄ `costing.js` |
| Dead import | **3** | Lihat §2.3 |
| Global `window.*` | 149 | 2 tidak terpakai, 12 bocor Firestore |
| Variabel CSS mati | 16 dari 65 | 49 aktif, 0 undefined |
| Risiko deployment | **RENDAH** | Site statis, tanpa build step; sinkronisasi Firestore sudah terverifikasi |

**Verdict** : Aman untuk di-deploy. Semua temuan bersifat *cleanup* & *best-practice*, bukan blocker fungsional.

---

# 1. PETA & STRUKTUR FOLDER

## 1.1 Pohon Lengkap

```
progress-workspace-baru/
├── assets/                   8 file
│   ├── icons/                    3 file
│   │   ├── favicon.png               5.5 KB   favicon aplikasi
│   │   ├── logo-progress.svg        12.8 KB   logo invoice (vektor)
│   │   └── text-invoice.svg         38.4 KB   label vertikal invoice
│   └── images/                   5 file
│       ├── lockscreen-bg.webp      420.6 KB   background lock screen (desktop)
│       ├── logo-progress.png        56.8 KB   logo navbar & PIN lock
│       ├── nav-bg.jpg              329.7 KB   background hero navbar
│       ├── progress-footer.svg      77.1 KB   footer brand
│       └── signature-progress.png  208.3 KB   signature invoice
├── css/                      4 file
│   ├── components.css           49.9 KB   komponen (terbesar)
│   ├── main.css                 14.7 KB   layout/global
│   ├── mobile.css               11.4 KB   responsive override
│   └── variables.css             3.7 KB   design token
├── docs/                     8 file
│   ├── audit-deployment.md      30.3 KB   laporan audit & struktur kode
│   ├── audit-phase1-archive.md  31.4 KB   arsip audit FASE 1
│   ├── firebase-setup.md        10.2 KB   panduan setup Firebase
│   └── rules/                    5 file
│       ├── debug-guide.md           16.4 KB   panduan debugging
│       ├── quick-reference.md       13.7 KB   referensi cepat
│       ├── readme.md                13.2 KB   navigasi dokumentasi
│       ├── technical-spec.md        42.1 KB   spesifikasi teknis
│       └── workflow-rules.md        51.7 KB   aturan alur kerja
├── firestore.rules           6.9 KB   security rules Firebase
├── index.html               79.0 KB   entry point
├── js/                       7 file
│   ├── app.js                  128.0 KB   orchestrator (terbesar)
│   ├── components/               3 file
│   │   ├── costing.js               20.2 KB   estimasi biaya
│   │   ├── tasks.js                  9.8 KB   pusat kontrol
│   │   └── tracker.js               18.5 KB   board desain & produksi
│   ├── database.js              23.8 KB   master data & pricing
│   ├── storage.js                6.3 KB   localStorage
│   └── utils.js                 14.3 KB   helper universal
└── .vscode/                  1 file
    └── settings.json             0.1 KB   konfigurasi editor
```

## 1.2 Klasifikasi File

| Kategori | File | Total | Ikut Deploy? |
|---|---|---|---|
| **Inti aplikasi** | `index.html`, `firestore.rules`, 4 CSS, 7 JS | 386.4 KB | ✅ YA |
| **Aset runtime** | 3 icon + 5 gambar = 8 file | 1.12 MB | ✅ YA |
| **Dokumentasi** | 3 panduan (`docs/`) | 70.7 KB | ❌ TIDAK |
| **Aturan developer** | 5 dokumen (`docs/rules/`) | 137.1 KB | ❌ TIDAK |
| **Editor config** | `.vscode/settings.json` | 0.1 KB | ❌ TIDAK |
| | **TOTAL project** | **1.70 MB** | |

## 1.3 Temuan: File/Folder Redundan

### ~~`migration/`~~ — sudah dihapus

Folder kosong sisa rencana migrasi schema. Telah dibersihkan pada revisi 1.1.

### 🟡 `audit-phase1-archive.md` — SUDAH KADALUARSAT
Berisi audit FASE 1/FASE 2 yang sekarang sudah **selesai dan sudah diperbaiki**. Nilainya sebagai riwayat, tapi jika tidak dipakai sebagai rujukan keputusan, bisa diarsipkan atau dihapus. Perhatikan: file ini **salah nama** karena isinya mencakup FASE 1–3.

### 🟢 File lain TIDAK redundan — semua dipakai

Dibilangacid sebelumnya suspect, tapi **ternyata aktif semua**:

| Aset | Ukuran | Dipakai di |
|---|---|---|
| `logo-progress.svg` | 12.8 KB | `js/app.js:1895` — logo header invoice |
| `text-invoice.svg` | 38.4 KB | `js/app.js:1893` — label vertikal invoice |
| `progress-footer.svg` | 77.1 KB | `index.html:2261–2263` — footer `<picture>` (3 rujukan) |
| `assets/images/lockscreen-bg.webp` | 420.6 KB | HTML preload + CSS (desktop lock screen) |

> **Catatan optimasi**: ketiga SVG menggunakan `src="/nama.svg"` — **path absolut dari root**. Jika di-deploy di **subfolder** (misal `github.io/progress/`), path ini akan **rusak** dan gambar tidak muncul. Bandingkan dengan `assets/images/lockscreen-bg.webp` yang memakai path relatif. **Ini berpotensi jadi bug deployment.**

## 1.4 Ukuran — Optimasi Prioritas

| File | Ukuran | Catatan |
|---|---|---|
| `lockscreen-bg.webp` | **420.6 KB** | 27% dari payload. Hanya dipakai di lock screen desktop |
| `app.js` | 128.0 KB | Modularisasi sudah dilakukan, tapi masih satu file besar |
| `index.html` | 78.3 KB | Banyak markup (92 `onclick`) |
| `progress-footer.svg` | 77.1 KB | SVG bertekstur berat, bisa dioptimasi |

**Rekomendasi**: compress `lockscreen-bg.webp` ke ~200–300 KB, atau tambahkan `<link rel="preload">` + `loading="lazy"`. Footer SVG bisa disederhanakan path-nya.

---

# 2. KERAPIAN & STRUKTUR MODUL JAVASCRIPT

## 2.1 Pembagian Tugas per Modul

| Modul | Baris | Non-komentar | Tanggung jawab |
|---|---|---|---|
| `js/app.js` | 2.564 | 2.235 | **Orchestrator**: init Firebase, modal, filter, form Desain/Produksi/Invoice, Rekap Tagihan, Magic Parser, ScrollManager (Lenis), PIN lock, registrasi 149 global |
| `js/database.js` | 677 | 541 | **Master data**: matriks harga, tier&qty, normalizer material, vendor estimator, parser produk/magic, kategori desain, stage & status |
| `js/utils.js` | 413 | 321 | **Helper**: format (rupiah/tanggal/angka), `escapeHTML`, `debounce`, paginasi, filter select, avatar palette |
| `js/storage.js` | 181 | 162 | **Persistensi lokal**: autosave form, riwayat, tasks, smart-done map, state section |
| `js/components/costing.js` | 327 | 299 | **Estimasi Biaya**: kalkulasi bahan/jahit/tambahan, item dinamis, reset, render 4 jenis history |
| `js/components/tracker.js` | 221 | 193 | **Tracker**: board Desain & Produksi, filter stage, pipeline summary |
| `js/components/tasks.js` | 278 | 225 | **Pusat Kontrol**: CRUD task manual, generate smart daily task, daily report |

### Layer yang terbentuk
```
app.js  ──────────────►  components/  ──┐
  │  │  │
  ├──────────────►  database.js ◄──────┼─── (data & pricing, tanpa import)
  │  │  │
  ├──────────────►  utils.js ──────────┘
  │  │
  └──────────────►  storage.js
```
`database.js` = **leaf node**, nol import. Ini layering yang benar.

## 2.2 Import Graph & Temuan Siklus

```
app.js  → database, utils, storage, costing, tracker, tasks
utils.js  → database
database.js  → (tidak ada)
storage.js  → database, utils, costing  ⚠
components/costing  → database, utils, storage  ⚠
components/tasks  → storage, utils
components/tracker  → database, utils
```

### 🔴 TEMUAN: 1 Cyclic Import

```
js/storage.js  ⇄  js/components/costing.js
```

**Penyebab**: `storage.js` mengimpor `hitung` dan `tambahItem` dari `costing.js`, sementara `costing.js` mengimpor `saveAuto`, `getHistory`, `loadHistoryData` dari `storage.js`.

**Pemakaian silang di `storage.js`:**
- Baris ~42 — `data.extraItems.forEach((x) => tambahItem({ nama, qty, harga }))`
- Baris ~44 — `hitung()` untuk hitung ulang hasil setelah restore autosave

**Dampak**: rapuh. Saat ini tidak error karena aturan hoisting pada ES Modules, tetapi urutan evaluasi modul bisa berubah bila refactor berikutnya. Risiko `ReferenceError` subtle saat dipindah ke bundler.

**Rekomendasi**: ekstrak `hitung()` & `tambahItem()` ke modul baru `js/components/calculator.js` yang netral, atau injeksi `hitung` sebagai callback parameter ke `loadAuto()`.

## 2.3 Dead Import (3) — PERBAIKAN SEGERA

| File | Import | Dipakai |
|---|---|---|
| `js/app.js` | `DESIGN_CATEGORIES` | ❌ 0× |
| `js/app.js` | `cmToMeter` | ❌ 0× |
| `js/app.js` | `getEstimatorVendor` | ❌ 0× |

`getEstimatorVendor` menjadi mati setelah fitur toast vendor dihapus. Aman dihapus dari baris import.

## 2.4 Import Duplikat

```
./utils.js  ← di-import 2× pada app.js
```
Baris kedua hanya berisi `handleUppercaseInput`. **Legal secara ES Modules** (tidak duplikat bersifat fatal), tapi tidak rapi. Gabungkan ke import pertama.

## 2.5 Export yang Hanya Dipakai Internal (14)

Bukan dead code (masih dipakai di file asalnya) - **sengaja** dipertahankan sebagai API publik, aman dibiarkan:

`utils.js`: `avatarPalettes`, `PAGE_SIZE`, `MAGIC_SIZES`
`database.js`: `parseMagicDesignLines`, `normalizeDesignCategory`, `resolveDesignCustomer`, `parseLengthCmFromText`, `normalizeDesignOrder`, `findTierPrice`, `ESTIMATOR_VENDORS`, `BAHAN_SLOTS`, `DEFAULT_DESIGN_RATE`, `PRODUCTION_STATUS_VALUES`, `INVOICE_STATUS_VALUES`
`components/tasks.js`: `generateSmartDailyTasks`

> `findTierPrice` menarik: ia diekspor dan dipakai 3× internal, tapi **tidak ada modul lain yang mengimpornya**. Jika tujuannya reusable, dokumentasikan; jika tidak, jadikan non-export.

## 2.6 Duplikasi Fungsi

✅ **Tidak ada nama fungsi kembar antar file.** Zero duplikasi fungsi terdeteksi.

## 2.7 Variabel Global — 149 `window.*`

Ini **kompleksitas terbesar** project. Penyebabnya:

```
Inline handler di HTML : 92 onclick + 59 onchange/oninput = 151
Global window.*  : 149 nama unik
```
Artinya **hampir semua global dibenarkan oleh kebutuhan inline handler HTML**.

**Temuan:**

| Jenis | Jumlah | Status |
|---|---|---|
| Fungsi UI | 137 | ✅ paired dengan inline handler |
| **Firestore bocor** | **12** | 🔴 tidak dipakai di HTML — tidak perlu di-global-kan |
| **Orphan** | **2** | 🟡 `generateWaText`, `currentPreviewInvoice` |

**Firestore yang bocor ke global tanpa perlu:**
`db`, `addDoc`, `collection`, `serverTimestamp`, `deleteDoc`, `doc`, `updateDoc`, `setDoc`, `getDoc`, `getDocs`, `where`, `query`
→ Semuanya **0× dipakai di inline handler HTML**. Cukup hapus baris `window.x = x`; pemanggilan internal tetap jalan karena itu satu modul.

**Orphan window:**
- `generateWaText` — dipanggil internal (`buildWaRecap`), tidak perlu global
- `currentPreviewInvoice` — state internal, tidak perlu global

**Saran jangka panjang**: migrasi inline `onclick` → `addEventListener` + `data-action`. Setelah itu global bisa turun dari 149 → ~10. Tapi ini refactor besar, **jangan dilakukan menjelang deployment**.

## 2.8 Kualitas & Risiko Kode

| Metrik | Nilai | Penilaian |
|---|---|---|
| `eval` / `new Function` / `with` | **0** | ✅ Aman |
| `console.log` | 1 | 🟡 1 pesan load — harmless, boleh untuk debug produksi |
| `console.warn` | 2 | ✅ 2 di `catch` block (clearRealtime, saveHistory) — benar |
| TODO/FIXME/HACK | **0** | ✅ Bersih |
| `innerHTML` total | 68 | perlu review |
| `escapeHTML` | 64 | ✅ Hampir semua |
| `addEventListener` | 8 | Kurang untuk 149 global |
| Inline `script` | **0** | ✅ Bagus — semua logika di module eksternal |

**Catatan `innerHTML`**: dari 68, mayoritas adalah `el.innerHTML = ""` (reset) atau template statis (pilihan `<option>` hardcoded, ikon). Yang dinamis (render tabel) sudah memakai `escapeHTML`. **Risiko XSS rendah**, tapi perlu ditinjau pada titik berikut:
- `app.js:676` — `box.innerHTML = ...` template tabel markdown parser (periksa escaping isi user)
- `app.js:2274` — `tbody.innerHTML = visible.map(...)` render invoice
- `costing.js:221, 238, 268, 309` · `tasks.js:254` · `tracker.js:81, 96, 156, 172` — render list
- `app.js:1960` — `paper.innerHTML = generateInvoiceHTML(invoiceData)` — **paling berisiko**, data invoice user masuk ke DOM untuk render. Pastikan semua field sudah di-escape di dalam `generateInvoiceHTML()`.

---

# 3. STRUKTUR CSS & TAMPILAN

## 3.1 Pembagian File

| File | Baris | Ukuran | Selector | Deklarasi | Isi |
|---|---|---|---|---|---|
| `variables.css` | 119 | 3.4 KB | 2 | 84 | **90 custom property** — token warna, radius, shadow, typography |
| `main.css` | 629 | 14.4 KB | 91 | 356 | Layout global, navbar, section, button, table, dark mode |
| `components.css` | 2.123 | 49.6 KB | 330 | 1.312 | Modal, form, estimasi, invoice, magic parser, PIN, filter |
| `mobile.css` | 562 | 11.1 KB | 0 top-level | 301 | **100% di dalam 1 `@media (max-width: 768px)`** |

**Total**: 424 selector block, 2.053 deklarasi, 6 `@media`, 3 `@keyframes`.

## 3.2 Kerapian —Bagus

| Aspek | Status |
|---|---|
| Urutan `<link>` | ✅ `variables → main → components → mobile` (cascade benar) |
| Balance kurung kurawal | ✅ `2/2`, `100/100`, `347/347`, `100/100` |
| Variabel dipakai tapi tak terdefinisi | ✅ **0** (tidak ada bug) |
| Struktur `mobile.css` | ✅ Isolasi responsif dalam 1 blok media query |
| Cache CSS | ✅ Tanpa `@font-face` duplikat |

## 3.3 Temuan

### 🟡 `@import "variables.css"` Redundan (3 file)
```
css/main.css  @import "variables.css";
css/components.css @import "variables.css";
css/mobile.css  @import "variables.css";
```
`variables.css` **sudah** dimuat via `<link>` sebagai file pertama. ketiga `@import` ini:
- **Melambat render** — `@import` bersifat blocking dan harus diunduh terpisah
- Deduplikasi browser mencegah fetch ulang, tapi 3 request tambahan tetap di-*queue*

**Rekomendasi**: hapus ketiga baris `@import`.

### 🟡 16 Variabel CSS Mati
Deklarasi 65, aktif 49. Kandidat hapus:
```
--fs-3xl  --fs-4xl  --bg  --surface-solid  --surface-raised  --surface-dark
--input-bg  --input-hover  --text-1  --text-2  --green-bg  --yellow-bg
--red-bg  --blue-bg  --border  --glass
```
Aman dihapus, tapi **rendah prioritas** — sisa ~1 KB dan berguna sebagai token fallback.

### 🟢 7 Selector Duplikat Lintas File (Minor)
```
.ws-section  main.css → components.css
.extra-field .input  components.css (2 blok)
.modal-card  components.css (2 blok)
.magic-preview-table  components.css (2 blok)
.invoice-product-group  components.css (2 blok)
.invoice-item-head  components.css (2 blok)
.invoice-item-row  components.css (2 blok)
```
Semuanya berada di `components.css` sebagai **penambahan property pada konteks berbeda** (base + modifier), bukan bentrok. **Aman dibiarkan** — ini pola CSS yang benar.

### 🟢 Breakpoint
```
@media (prefers-reduced-motion: reduce)  → aksesibilitas
@media (min-width: 769px)  → desktop
@media (max-width: 768px)  → mobile/tablet
@media print  → cetak invoice
```
Konsisten (satu breakpoint utama 768px). Tidak ada breakpoint yang bertabrakan.

---

# 4. KETERSEDIAAN FILE WAJIB DEPLOYMENT

## 4.1 File Inti — ✅ SEMUA LENGKAP

```
✅ index.html
✅ css/variables.css  ✅ css/main.css
✅ css/components.css  ✅ css/mobile.css
✅ js/app.js  ✅ js/utils.js
✅ js/database.js  ✅ js/storage.js
✅ js/components/costing.js  ✅ js/components/tracker.js  ✅ js/components/tasks.js
```
**Semua path lokal valid — 0 referensi rusak.**

## 4.2 Meta Tag

| Tag | Status | Nilai |
|---|---|---|
| `charset` | ✅ ADA | `utf-8` |
| `viewport` | ✅ ADA | `width=device-width, maximum-scale=1.0, user-scalable=no` |
| `theme-color` | ✅ ADA | `#1a1b1c` |
| `robots` | ✅ ADA | `noindex, nofollow` ← **sengaja**, app internal |
| `msapplication-navbutton-color` | ✅ ADA | `#1a1b1c` |
| `mobile-web-app-capable` | ✅ ADA | `yes` |
| `apple-mobile-web-app-capable` | ✅ ADA | `yes` |
| `description` | ❌ TIDAK | Kosong — tidak wajib (noindex) |
| `og:title` / `og:description` / `og:image` | ❌ TIDAK | Tidak wajib (tanpa share) |
| `author` | ❌ TIDAK | Tidak wajib |

> **Penilaian**: 7 meta tag ada, semua esensial tercakup. Tag yang hilang seluruhnya bersifat SEO/share dan memang tidak relevan karena `robots=noindex,nofollow`. **Tidak perlu ditambahkan.**

⚠️ **Catatan**: ada `mobile-web-app-capable = yes` tetapi **tidak ada `manifest.json`** dan **tidak ada `apple-touch-icon`**. Damiariobile Safari akan menampilkan ikon default. Rendah prioritas.

## 4.3 Favicon — ⚠ PERLU PERHATIAN

```html
<link rel="icon" type="image/png" href="https://i.ibb.co.com/Mb1TFB2/favicon.png" />
```

| Aspek | Status |
|---|---|
| Tag `<link rel="icon">` | ✅ ADA |
| File lokal `favicon.ico` | ❌ TIDAK ADA |
| Sumber | ⚠ **Hosting pihak ketiga (ibb.co)** |
| Risiko | Jika ibb.co down/offline → favicon hilang, request error di tiap halaman |
| Perbaikan | Unduh → simpan sebagai `favicon.png` lokal |

## 4.4 Aset Eksternal (CDN) — 9 URL, 6 Host

| CDN | Dipakai Untuk | Risiko |
|---|---|---|
| `fonts.googleapis.com` | Font Inter | 🟡 estándar |
| `fonts.gstatic.com` | Font file | 🟡 standar |
| `cdn.jsdelivr.net` | RemixIcon 4.9.1 | 🟢 |
| `cdnjs.cloudflare.com` | html2canvas 1.4.1 | 🟡 dipakai saat export invoice PNG |
| `cdn.jsdelivr.net` | SortableJS 1.15.0 | 🟢 drag & drop item |
| `unpkg.com` | Lenis 1.1.18 | 🟡 smooth scroll |
| `i.ibb.co.com` | Favicon + Logo (2×) | 🔴 **hosting gambar pihak ketiga, single point of failure** |
| `i.ibb.co.com` | `LOGO-PROGRESS.png` (2x: navbar + PIN lock) | 🔴 **bergantung pada hosting pihak ketiga** |

**Rekomendasi**: unduh logo & favicon ke lokal (2 file, ~15 KB) → hilangkan ketergantungan `ibb.co`.

## 4.5 Konfigurasi Deployment

| File | Status | Keterangan |
|---|---|---|
| `package.json` | ❌ TIDAK | ✅ **Tidak perlu** — tanpa build step |
| `node_modules/` | ❌ TIDAK | ✅ **Tidak perlu** |
| `.htaccess` | ❌ TIDAK | 🟡 hanya perlu di Apache; opsional |
| `sw.js` (Service Worker) | ❌ TIDAK | ⚠ tidak ada PWA/offline |
| `robots.txt` | ❌ TIDAK | ✅ cukup `meta robots` |
| `sitemap.xml` | ❌ TIDAK | ✅ tidak relevan (noindex) |
| `manifest.json` | ❌ TIDAK | 🟡 opsional |

**Simpulan**: karena situs **100% statis** dan memakai **ES Modules native** (`<script type="module">`), proses deploy sangat sederhana:

```
Upload 14 file berikut apa adanya ke hosting:
  index.html
  css/  (4 file)
  js/  (4 file + components/ 3 file)
  progress-footer.svg
  assets/images/lockscreen-bg.webp
```

**⚠️ Kebutuhan server**: ES Modules **tidak bisa** dibuka via `file://` — harus lewat HTTP server. Pastikan hosting mendukung (semua shared hosting modern & GitHub Pages mendukungnya).

## 4.6 Firebase Config

```js
const firebaseConfig = {
  apiKey: "AIzaSyCeExsNmeo1KcIEeCQJI4TMPVOzxNhrmYI",
  authDomain: "progress-workspace.firebaseapp.com",
  projectId: "progress-workspace",
  storageBucket: "progress-workspace.firebasestorage.app",
  messagingSenderId: "386467300617",
  appId: "1:386467300617:web:dd56ccc21ee0abd3cdbfd8",
  measurementId: "G-9GXHTCGMQ3",
};
```

| Aspek | Penilaian |
|---|---|
| `private_key` | ✅ 0× — tidak ada |
| Firebase Web SDK `apiKey` | ✅ **Bukan secret** — ini identifier publik, tidak bisa di-commit-ramah |
| Risiko nyata | 🔴 **Tergantung sepenuhnya pada Firebase Security Rules** |
| Auth | ⚠ **Tidak ada Firebase Auth** — PIN client-side hanya privacy, bukan security |

### 🔴 TINDAKAN WAJIB SEBELUM DEPLOY

1. **Verifikasi Firebase Security Rules** — ini satu-satunya lapisan keamanan. Pastikan:
  - Rules menolak writes dari origin yang tidak dikenal
  - Timestamp (`serverTimestamp`) & validasi field sesuai kebutuhan
2. **Aktifkan App Check** (opsional tapi disarankan) untuk abuse mitigation
3. **Hapus `measurementId`** atau biarkan — Analytics tidak hurts
4. **PIN default `696969`** ada di `js/app.js` - bukan secret (terbaca di source), hanya untuk privacy. Pastikan pengguna memahami ini bukan autentikasi.

## 4.7 Checklist Sebelum Deploy

```
[x] Semua 12 file inti ada
[x] Semua path lokal valid (0 rusak)
[x] node --check lulus semua 7 modul JS
[x] CSS braces seimbang (4/4 file)
[x] Urutan <link> CSS benar (cascade)
[x] Tidak ada variabel CSS undefined
[x] robots = noindex,nofollow (sesuai aplikasi internal)
[x] Tidak ada eval/new Function
[x] Tidak ada inline <script>
[ ] Periksa Firebase Security Rules  ← WAJIB, dilakukan manual
[ ] Pindahkan favicon & logo ke lokal  ← disarankan
[ ] Hapus folder migration/ (kosong)  ← bersihkan
[ ] Hapus 3 dead import di app.js  ← bersihkan
[ ] Hapus 3 @import "variables.css"  ← optimizer
[ ] Hapus 12 window.* Firestore  ← optimizer
[ ] Compress lockscreen-bg.webp  ← optimizer (958 KB → ~250 KB)
[ ] Ganti src="/nama.svg" → relatif  ← JIKA deploy di subfolder
[ ] Uji 4 breakpoint (mobile/tablet/desktop/print)
[ ] Uji mode gelap + lock screen
[ ] Uji dengan Firebase Rules ketat
```

---

# 5. DAFTAR TEMUAN TERKATEGORI

## 🔴 KRITIS / WAJIB (2)
| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| 1 | **Firebase Security Rules belum diverifikasi** | Console Firebase | Satu-satunya lapisan keamanan; data bisa dibaca ditulis siapa pun bila rules longgar |
| 2 | **Path absolut `/nama.svg`** | `app.js:1893,1895`, `index.html:2261–2263` | Gambar rusak jika deploy di subfolder |

## 🟠 MENENGAH / DISARANKAN (5)
| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| 3 | Cyclic import `storage.js ⇄ costing.js` | 2 file | Rapuh saat refactor; aman sekarang |
| 4 | `lockscreen-bg.webp` 958 KB | `assets/images/` | 68% payload, lambat load |
| 5 | Ketergantungan `ibb.co` untuk logo & favicon | `index.html` head + 3 img | Single point of failure |
| 6 | 149 global `window.*` | `app.js` | Namespace polusi, rawan tabrakan |
| 7 | 3 `@import "variables.css"` redundan | 3 file CSS | Render blocking |

## 🟡 RENDAH / OPTIMIZER (6)
| # | Temuan | Lokasi |
|---|---|---|
| 8 | 3 dead import: `DESIGN_CATEGORIES`, `cmToMeter`, `getEstimatorVendor` | `app.js` |
| 9 | 2 orphan global: `generateWaText`, `currentPreviewInvoice` | `app.js` |
| 10 | 12 Firestore function bocor ke global (tak dipakai inline) | `app.js` |
| 11 | Import `./utils.js` terduplikasi 2× | `app.js` |
| 12 | 16 variabel CSS mati | `variables.css` |
| 13 | Folder `migration/` kosong | root |

## 🟢 BERSIH / POSITIF (9)
```
✅ 0 path rusak
✅ 0 syntax error
✅ 0 eval / new Function
✅ 0 inline <script>
✅ 0 variabel CSS undefined
✅ 0 duplikasi nama fungsi
✅ 0 TODO/FIXME/HACK
✅ 0 export hilang
✅ Layering database.js benar (leaf node)
✅ Documented escapeHTML dipakai konsisten di render list
```

---

# 6. REKOMENDASI PRIORITAS

## Sebelum Deploy (Wajib — 15 menit)
1. Verifikasi **Firebase Security Rules** di Firebase Console
2. **Hapus folder `migration/`** (kosong)
3. **Hapus 3 dead import** di `app.js`
4. **Uji di hosting** — pastikan `file://` tidak dipakai, harus HTTP

## Saat Deploy (Sangat Disarankan — 30 menit)
5. **Compress `lockscreen-bg.webp`** → target < 300 KB (Tools: Squoosh / cwebp `-q 80`)
6. **Unduh logo + favicon** dari ibb.co → simpan lokal (hilangkan external dependency)
7. **Ganti path absolut** → relatif: `/logo-progress.svg` → `./logo-progress.svg` (dan seterusnya)
8. **Test 4 breakpoint** + dark mode + lock screen

## Setelah Deploy (Improvement — 1–2 jam)
9. Hapus 3 `@import "variables.css"`
10. Hapus 12 `window.*` Firestore
11. Hapus 2 orphan global
12. Gabungkan import `./utils.js`

## Jangka Panjang (Refactor — 4–8 jam)
13. **Pecah `app.js`** (2.564 baris) → `modals.js`, `forms.js`, `rekap.js`, `pin.js`, `invoice.js`
14. **Migrasi 151 inline handler** → `addEventListener` + `data-action` → global 149 → ~10
15. **Putus cyclic import** → ekstrak `calculator.js`
16. Hapus `audit-phase1-archive.md` (arsip atau ganti nama)

---

## CATATAN UNTUK REVIEWER (GEMINI)

**Profil project**: aplikasi internal printshop (Produksi, Desain, Invoice, Estimasi Biaya, Pusat Kontrol). Single-page, tanpa framework, tanpa build step. Vanilla ES Modules + Firebase Firestore + localStorage.

**Pertanyaan untuk direview**:
1. Apakah architecture `app.js / database.js / utils.js / storage.js / components/*` cukup baik untuk dilanjutkan, atau perlu dirombak total sebelum deploy?
2. Apakah cyclic import `storage.js <-> costing.js` cukup penting untuk ditunda, atau harus dipecah sekarang?
3. Apakah 149 global `window.*` masih bisa diterima untuk aplikasi internal, atau wajib dimigrasikan ke `addEventListener`?
4. Apakah Firebase rules yang perlu saya tulis sudah cukup jelas dari kode ini? Perlu contoh rules yang disarankan?
5. Apakah optimasi `lockscreen-bg.webp` dan SVG perlu dilakukan sekarang, atau bisa menyusul setelah deploy?
6. Apakah ada risiko keamanan yang belum tersorot (selain Security Rules & ketergantungan ibb.co)?
7. Ada bug potensial lain yang belum terdeteksi dari laporan ini?

---

*Dokumen dibuat dari analisis statis kode. Semua angka hasil pengukuran langsung terhadap file di `progress-workspace-baru`.*