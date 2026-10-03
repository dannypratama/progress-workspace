# PANDUAN SETUP FIREBASE — Progress Printshop Workspace

**Tanggal** : 4 Oktober 2026 · **Project** : `progress-workspace`

Dokumen ini adalah pasangan dari `firestore.rules`. Ikuti urutan di bawah **persis** — salah urutan membuat aplikasi gagal total.

> **Lokasi** : `docs/firebase-setup.md` · **Deploy** : tidak ikut di-upload ke hosting

---

## ⚠ RINGKASAN TEMUAN AUDIT

### Status per 4 Oktober 2026 (setelah configure ulang)

Live test **read-only** terbaru:

```
[SEBELUM anonymous auth]
design_customers     permission-denied
design_orders        permission-denied
production_orders    permission-denied
invoices             permission-denied
costing_history      permission-denied

[SETELAH anonymous auth + gating di app.js]
[OK] design_customers       3 dokumen
[OK] design_orders         31 dokumen
[OK] production_orders     30 dokumen
[OK] invoices              22 dokumen
[OK] costing_history       2 dokumen
========================================
total 88 dokumen, 0 ditolak
```

Kabar baik: **Anonymous Auth sudah aktif, dan `firestore.rules` sudah berjalan dengan benar** — tidak perlu mengubah rules lagi.

## ⚠️ TEMUAN PENTING: race condition pada `onSnapshot`

Percobaan pertama memanggil `signInAnonymously()` *salah tempat* — listener sudah terpasang sebelum auth selesai. Hasilnya:

```
[SEBELUM AUTH]  next(): 0   error(): permission-denied
[SETELAH AUTH]  next(): 0   error(): permission-denied   <- TIDAK PULIH
```

`onSnapshot` yang ditolak rules akan **berhenti permanen** dan tidak pernah mencoba lagi, meskipun user sudah terautentikasi. Karena itu aplikasi **wajib menunda** pemasangan listener sampai auth selesai — hal ini sudah diterapkan di `js/app.js` pada langkah 1.

---

## 📋 LANGKAH 1 — Aktifkan Anonymous Authentication

> **WAJIB DULUAN.** Rules di `firestore.rules` memakai `request.auth != null`. Tanpa langkah ini, semua operasi ditolak.

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project **progress-workspace**
3. Menu **Authentication** → tab **Sign-in method**
4. Klik **Anonymous** →status **Enable** → **Save**

Referensi tampilan: `Authentication > Sign-in method > Anonymous > Enable`

---

## 📋 LANGKAH 1b — Pemicu Anonymous Auth di Kode (sudah diterapkan)

Rules memakai `request.auth != null`. Tanpa pemicu di kode, browser tidak pernah terautentikasi dan **semua operasi ditolak**.

`js/app.js` sudah ContainsThree bagian:

```javascript
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(firebaseApp);

// Ditutup sampai status auth diketahui, supaya init tidak menggantung.
let authSettled;
const authReady = new Promise((resolve) => { authSettled = resolve; });
let authOk = false;

async function whenAuthed() {
  await authReady;
  return authOk;
}

(async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await signInAnonymously(auth);
      authOk = true;
      break;
    } catch (err) {
      const network = /network-request-failed|timeout|unavailable/i.test(`${err && err.code} ${err && err.message}`);
      if (attempt === 3 || !network) break;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  authSettled();
})();
```

Lalu seluruh inisialisasi Firestore ditunda:

```javascript
(async () => {
  if (!(await whenAuthed())) return;   // jangan pasang listener tanpa user
  startRealtimeListeners();
  /* seed design_customers ... */
})();
```

Sembilan titik tulis (simpan/hapus Desain, Produksi, Invoice, Magic, Customer, Nomor invoice) juga memakai `await whenAuthed()` agar tidak lebih dulu ditolak rules.

## 📋 LANGKAH 2 — Publish Rules

**Cara A — Console (paling mudah)**
1. **Firestore Database** → tab **Rules**
2. Klik **Edit**, hapus semua isi
3. Buka file `firestore.rules` di project ini, salin **seluruh** isinya
4. Tempel ke editor
5. Klik **Publish**

**Cara B — Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase use progress-workspace
firebase deploy --only firestore:rules
```
> Cara B butuh file `firebase.json`. Kalau belum ada, buat manual:
> ```json
> { "firestore": { "rules": "firestore.rules" } }
> ```

### Verifikasi Rules aktif
Kembali ke tab **Rules**, pastikan tampil:
```
rules_version = '2';
service cloud.firestore { ...
```
dan tidak ada warning merah di panel **Rules Playground**.

---

## 📋 LANGKAH 3 — Index Komposit

### ✅ KABAR BAIK: TIDAK PERLU INDEX KOMPOSIT

Saya sudah menganalisis keenam query di aplikasi. **Semuanya memakai single-field index bawaan** — jadi bagian Index di Console akan tetap kosong, dan itu normal.

| # | Lokasi | Query | Index |
|---|---|---|---|
| 1 | `app.js:2047` | `where("invoiceNo", ">=") + where("invoiceNo", "<=")` | ✅ otomatis (range pada field yang sama digabung) |
| 2 | `app.js:2449` | `orderBy("name", "asc")` | ✅ otomatis |
| 3 | `app.js:2460` | `orderBy("createdAt", "desc")` | ✅ otomatis |
| 4 | `app.js:2470` | `orderBy("createdAt", "desc")` | ✅ otomatis |
| 5 | `app.js:2480` | `orderBy("createdAt", "desc")` | ✅ otomatis |
| 6 | `app.js:2487` | `orderBy("created", "desc")` | ✅ otomatis |
| 7 | `app.js:2497` | `getDocs(collection(...))` | ✅ tidak perlu index |

**Kapan index komposit dibutuhkan?**
Hanya jika satu query punya `where()` **dan** `orderBy()` pada **field berbeda**. Contoh: `where("status","==","paid") + orderBy("createdAt","desc")`. Aplikasi ini belum punya query seperti itu.

### Kalau nanti menambah filter someday
Kalau suatu saat Anda tambahkan filter status + urutan tanggal, Firestore akan langsung memberi error `failed-precondition` beserta **tautan** untuk membuat index otomatis. Klik tautan itu, tunggu 1–2 menit, index selesai dibuat sendiri. Tidak perlu/APK manual.

---

## 📋 LANGKAH 4 — App Check (Sangat Disarankan)

App Check membuat project mustahil diakses langsung lewat `curl`/REST API.

1. **Build** → **App Check**
2. Klik **Register app** → pilih **Web**
3. Pilih **ReCAPTCHA Enterprise** (gratis, recommended untuk web)
4. **App Check > API Keys** → salin `siteKey`
5. Tambahkan di `index.html` **sebelum** modul lain:
   ```html
   <script src="https://firebaseappcheck.googleapis.com/1.x/firebase-app-check.js"></script>
   ```
6. Di `js/app.js`, tambahkan setelah `initializeApp`:
   ```js
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from
     "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";

   initializeAppCheck(firebaseApp, {
     provider: new ReCaptchaEnterpriseProvider("PASTE_SITE_KEY_DISINI"),
     isTokenAutoRefreshEnabled: true,
   });
   ```
7. Di Firebase Console **App Check** → **APIs** → centang `firestore`

Mau saya implementasikan langkah 4 ini? Sayati saja.

---

## 📋 LANGKAH 5 — Uji Setelah Rules Aktif

Buka aplikasi di browser, lalu:

| # | Uji | Harapan |
|---|---|---|
| 1 | Buka aplikasi | Toast "Customer tersimpan" tidak muncul, tidak ada error merah di console |
| 2 | Tambah **Customer Loyal** | Tersimpan, muncul di dropdown `Pilih Customer` |
| 3 | Tambah **Pesanan Desain** | Muncul di board & riwayat, tanpa `permission-denied` |
| 4 | Tambah **Pesanan Produksi** | Muncul, pipeline terupdate |
| 5 | Buat **Invoice** | Nomor `INV-MMPP-01` otomatis, tersimpan |
| 6 | **Tutup & buka lagi browser** | Data masih ada (realtime listener) |
| 7 | Geser stage desain (`design`→`revisi`→`done`) | Jalan tanpa error |
| 8 | Hapus invoice | Jalan, `production_orders.invoiceId` ikut dilepas |
| 9 | Buka 2 tab browser | Tab 2 otomatis update saat tab 1 mengubah data |

### Kalau masih `permission-denied`
1. Pastikan Anonymous Auth **sudah** diaktifkan (Langkah 1)
2. Tunggu ~1 menit setelah publish rules
3. Hard refresh: `Ctrl + Shift + R`
4. Cek Rules Playground di Console dengan operations:
   - `get /design_customers` → harus **Allowed**
   - `create /invoices` dengan body valid → **Allowed**

---

## 📋 CATATAN PENTING

### 1. `costing_history` — koreksi temuan audit
Live test terbaru menemukan **2 dokumen** di koleksi ini, jadi koleksi **tidak kosong**. Namun listener `onSnapshot`-nya tetap tidak pernah bertambah: **tidak ada kode di aplikasi yang menulis ke `costing_history`** sekarang.

`saveHistory()` (`storage.js:48`) menyimpan riwayat estimasi ke **localStorage** — jadi **per perangkat**, tidak tersinkron ke Firestore.

Konsekuensi: riwayat estimasi yang **baru** dibuat di HP tidak muncul di laptop. Dua dokumen yang ada di Firestore adalah data lama dari versi aplikasi sebelumnya.

Rules-nya sudah dibuka agar tidak perlu diubah nanti. Kalau ingin riwayat estimasi baru ikut tersinkron, itu perubahan fitur terpisah.

### 2b. Field opsional & `deleteField()`
Rules tidak mewajibkan field opsional seperti `invoices.productionId` atau `production_orders.invoiceId`. Ini penting karena saat invoice dihapus, kode memakai `deleteField()` untuk **melepas** field tersebut:

```js
await updateDoc(doc(db, "production_orders", linked.id), { invoiceId: deleteField() });
```

Kalau rules ikut memaksa `invoiceId` ada, operasi ini akan ditolak. Karena opsional, aman.

### 2. PIN bukan keamanan
PIN 6 digit di `app.js` murni privasi visual (bisa dibaca lewat DevTools). Keamanan data 100% bergantung pada **Security Rules + App Check**, bukan PIN.

### 3. `apiKey` bukan rahasia
`AIzaSy...` adalah identifier publik untuk Firebase Web SDK — aman untuk ditaruh di kode. Yang melindungi data tetap Security Rules.

### 4. Field `created` vs `createdAt` tidak seragam
| Koleksi | Field waktu | Tipe |
|---|---|---|
| `design_orders`, `production_orders`, `invoices` | `createdAt` | `serverTimestamp()` |
| `costing_history` (kalau nanti dipakai) | `created` | ISO string client |
| `design_customers` | `createdAt` | `serverTimestamp()` |

 bukan bug (sesuai query-nya masing-masing), tapi perlu diingat bila nanti menambah query lintas koleksi.

### 5. `serverTimestamp()` = dokumen baru muncul sedikit terlambat
Field `createdAt` diisi `serverTimestamp()`. Firestore **sengaja tidak memasukkan dokumen dengan timestamp yang belum selesai ke hasil query**. Efeknya: pesanan yang baru disimpan akan muncul di listener **1–2 detik setelah** server merespons. Ini perilaku normal, bukan bug.

---

## 📋 RINGKASAN

```
- [x] 1. Authentication > Sign-in method > Anonymous > **Enable** (sudah)
- [x] 1b. Pemicu `signInAnonymously()` + gating listener (sudah di `js/app.js`)