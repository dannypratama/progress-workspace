# OPENCODE WORKFLOW RULES

## Progress Printshop Workspace — Master Execution Guide

**Status:** PRODUCTION READY  
**Version:** 1.0  
**Last Updated:** 2026-08-11  
**Application:** Progress Printshop Workspace (SPA — Vanilla JS + Firebase)

---

## 📌 OVERVIEW

Dokumen ini adalah **PANDUAN KERJA KETAT** untuk OpenCode dalam mengeksekusi perbaikan, refactoring, dan optimasi pada aplikasi Progress Printshop Workspace.

**Tujuan:** OpenCode mengikuti **5-PHASE WORKFLOW** yang terstruktur, sehingga pekerjaan berjalan bertahap, terukur, dan bebas dari kesalahan.

**Target Outcome:** Aplikasi bebas bug, clean code, responsive design, aman, dan optimal.

---

## 🎯 SECTION 1: STRICT OPERATING RULES FOR OPENCODE

### Rule #1: Mandatory Codebase Architecture Review

Sebelum melakukan APAPUN (bug fix, refactoring, feature), OpenCode WAJIB:

1. **Read & Understand File Structure**

   ```
   js/
   ├── database.js          (MASTER: Pricing database, constants)
   ├── storage.js           (localStorage operations)
   ├── utils.js             (Helper functions, pure functions)
   ├── app.js               (ENTRY POINT: Firebase init, global handlers)
   └── components/
       ├── tracker.js       (Kanban rendering & filtering)
       ├── costing.js       (Cost calculation & charts)
       └── tasks.js         (Task management)

   html/css:
   ├── index.html           (Main UI, modals, forms)
   └── css/
       ├── variables.css    (CSS variables, theme)
       ├── main.css         (Layout & spacing)
       ├── components.css   (Component styles)
       └── mobile.css       (Mobile responsive)
   ```

2. **Map Data Dependencies**

   ```
   Firestore Collections:
   - design_orders (linked from tracker.js)
   - production_orders (linked from tracker.js + app.js)
   - invoices (linked from app.js)
   - costing_history (linked from storage.js)

   Global State (window object):
   - window.firebaseDesignOrders
   - window.firebaseProductionOrders
   - window.isDark

   localStorage Keys:
   - progress_autosave
   - progress_costings
   - progress_theme
   - progress_tasks
   - sectionStates
   ```

3. **Understand Module Exports**
   - database.js exports: BAHAN, CFG, KEYS, MASTER_PRICE_DATABASE, getProductBasePrice(), calculateInvoiceItem()
   - storage.js exports: saveAuto(), loadAuto(), saveHistory(), getTasks(), saveTasks()
   - utils.js exports: rupiah(), angka(), formatRibuan(), formatRupiah(), paginate(), getAvatarPalette()
   - tracker.js exports: renderDesignOrders(), renderProductionOrders(), updateHero(), updatePipeline()
   - costing.js exports: hitung(), hitungBahan(), tambahItem(), hapusItem(), renderCostingHistory()

### Rule #2: Preserve Global Namespacing & Module Integrity

OpenCode WAJIB:

1. **Never Change Variable Names**
   - ❌ JANGAN rename `window.firebaseDesignOrders` → `designOrdersData`
   - ❌ JANGAN rename `MASTER_PRICE_DATABASE` → `pricingDb`
   - ✅ Gunakan nama yang sama, hanya perbaiki ISINYA

2. **Maintain Module Exports Structure**
   - ❌ Jangan ubah `export function hitung()` menjadi internal-only
   - ✅ Semua function yang di-export harus tetap di-export dengan signature sama

3. **Respect ES Module Import/Export**
   - Import path harus tetap: `import { ... } from "./database.js"`
   - Jangan ubah ke CommonJS atau format lain

4. **Do Not Add Global Dependencies**
   - ❌ Jangan `window.myNewGlobal = ...`
   - ✅ Gunakan local scope, pass via parameter

### Rule #3: Critical No-Break Zones

Area yang TIDAK BOLEH diubah tanpa persetujuan eksplisit:

1. **Firebase Configuration Block** (app.js awal)
   - Jangan ubah: `initializeApp()`, `getFirestore()`, `onSnapshot()` flow

2. **Firestore Schema Structure** (database.js)
   - Pricing matrix field names & structure harus tetap
   - Field calculation formula harus tetap (unless bug fix approved)

3. **localStorage Key Names** (storage.js + database.js)
   - `KEYS` object harus tetap: `{ autosave, history, theme, tasks, production_orders }`

4. **HTML Element IDs** (index.html)
   - Button IDs, input IDs, modal IDs harus tetap
   - JavaScript rely pada ID selector

### Rule #4: Commit Message Format

Setiap code change harus disertai commit message jelas:

```
[FASE-#] [MODULE] Deskripsi singkat

Deskripsi detail:
- Apa yang diubah
- Mengapa diubah
- Impact ke modul lain (jika ada)
```

**Contoh:**

```
[FASE-2] [database.js] Fix zero-division bug in calculateInvoiceItem()

- Added guard: pcs > 0 check before division
- Prevent NaN propagation to invoice calculations
- Impact: costing.js hitung() also benefits (uses calculateInvoiceItem)
```

### Rule #5: Testing at Each Step

OpenCode WAJIB test setelah setiap perubahan:

1. **Unit Level** — Function return value correct
2. **Module Level** — Module exports work
3. **Integration Level** — Cross-module data flow
4. **UI Level** — Changes visible & functional in browser

---

## 🔄 SECTION 2: DETAILED 5-PHASE EXECUTION PLAN

### FASE 1: AUDIT TOTAL & PEMETAAN DEPENDENSI

**Durasi Estimasi:** 2-3 jam  
**Output:** Audit report + bug inventory + dependency map  
**Status:** NO CODE CHANGES (read-only)

#### 1.1 File-by-File Code Inspection

**database.js**

- [ ] Review BAHAN object (5 materials: milano, emboss, airwalk, rib, lotto)
- [ ] Review MASTER_PRICE_DATABASE structure (jersey, kaos, kemeja products)
- [ ] Check getProductBasePrice() logic for matrix/tier lookup
- [ ] Check findTierPrice() boundary conditions
- [ ] Check calculateInvoiceItem() complexity & all sub-calculations
- [ ] Document: Any missing validation, edge cases, silent failures

**storage.js**

- [ ] Review localStorage key usage
- [ ] Check saveAuto() debounce mechanism
- [ ] Check loadAuto() error handling
- [ ] Check saveHistory() array management
- [ ] Document: Quota risk, data corruption risk, migration path

**utils.js**

- [ ] Review numeric parsing (rupiah, angka, formatRibuan)
- [ ] Check pagination logic
- [ ] Check avatar color memoization
- [ ] Document: Input validation gaps, memory leak risk

**app.js**

- [ ] Review Firebase initialization block
- [ ] Check onSnapshot listener registration
- [ ] Review design order CRUD (add, edit, delete, stage)
- [ ] Review production order CRUD
- [ ] Review invoice builder & PNG export
- [ ] Check error handling in try-catch blocks
- [ ] Document: Missing loading states, async timing issues

**tracker.js**

- [ ] Review renderDesignOrders() filtering & pagination
- [ ] Review renderProductionOrders() same
- [ ] Check avatar generation & memoization
- [ ] Check stage filtering logic
- [ ] Document: Filter state management, pagination edge cases

**costing.js**

- [ ] Review hitungBahan() material calculation
- [ ] Review hitung() main calculation flow
- [ ] Check chart updates & destruction
- [ ] Review extra items dynamic DOM management
- [ ] Document: NaN propagation risk, chart memory leak

**tasks.js**

- [ ] Check task CRUD operations
- [ ] Check rendering logic
- [ ] Document: No critical issues expected

**index.html**

- [ ] Verify all element IDs referenced in JS
- [ ] Check modal structure & accessibility
- [ ] Check form input types & constraints
- [ ] Document: Missing labels, accessibility gaps

**CSS Files**

- [ ] Check responsive breakpoints (480px, 768px, 1200px)
- [ ] Check dark mode variable handling
- [ ] Check component consistency
- [ ] Document: Layout shift issues, mobile viewport issues

#### 1.2 Create Dependency Map

```
DEPENDENCIES CHART:

app.js (ENTRY POINT)
├── imports from database.js (KEYS, BAHAN, MASTER_PRICE_DATABASE)
├── imports from storage.js (saveAuto, loadAuto, getTasks)
├── imports from utils.js (rupiah, angka, formatRupiah)
├── imports from tracker.js (renderDesignOrders, updateHero)
├── imports from costing.js (hitung, tambahItem, hapusItem)
└── Firebase integration (onSnapshot → updates window.firebaseDesignOrders)

calculateInvoiceItem() (in database.js)
├── Used by: app.js → generateInvoiceHTML()
├── Used by: Production order item pricing
└── Critical: MUST handle edge cases (qty=0, undefined material)

hitung() (in costing.js)
├── Called by: Every input change in estimator
├── Calls: hitungBahan(), hitungTambahan()
├── Updates: localStorage via saveAuto()
└── Critical: NaN propagation risk
```

#### 1.3 Bug Inventory Template

**Format per bug:**

```
[SEVERITY] [MODULE] [FUNCTION]
Description: ...
Trigger: ...
Impact: ...
Fix Complexity: [LOW | MEDIUM | HIGH]
Blocked By: [None or list of other bugs]
```

#### 1.4 Deliverable Format

**Audit Report harus mencakup:**

1. File structure overview
2. Module dependency graph
3. Bug/Issue inventory (prioritized by severity)
4. Edge cases catalog
5. Performance baseline (chart render time, table render time, calculation time)
6. Security assessment (input validation gaps, XSS risk, localStorage risk)

---

### FASE 2: PERBAIKAN FUNGSIONALITAS & BUG FIX (SISTEM BERANTAI)

**Durasi Estimasi:** 4-6 jam  
**Output:** Bug-free codebase  
**Status:** ACTIVE CODE CHANGES

#### 2.1 Bug Fix Priority Rules

**Priority 1 (Critical - Fix First):**

- Zero-division bugs (calculation → NaN/Infinity)
- Firebase connectivity issues
- Form validation failures
- Data loss on save

**Priority 2 (High - Fix Second):**

- Chart memory leak
- localStorage quota overflow
- Calculation inaccuracy
- Mobile rendering issues

**Priority 3 (Medium - Fix After P1+P2):**

- UI alignment issues
- Performance optimization
- Accessibility gaps

#### 2.2 Chained Fix Rule (THE CORE RULE)

**RULE: Perbaikan Berantai Otomatis**

Jika bug fix di satu section membutuhkan perubahan di section lain yang saling terhubung, OpenCode WAJIB sekalian memperbaiki semua section yang terhubung hingga Zero Bugs.

**Contoh Kasus:**

```
Bug: calculateInvoiceItem() tidak handle qty=0 (NaN)

Direct Section: database.js → calculateInvoiceItem()
Fix: Add guard pcs > 0

Chained Section 1: costing.js → hitung()
Check: Apakah hitung() juga terpengaruh NaN?
Action: Jika ya, tambah validation di hitung() juga

Chained Section 2: app.js → generateInvoiceHTML()
Check: Apakah generate invoice juga bisa trigger NaN?
Action: Jika ya, add error boundary

Chained Section 3: tracker.js → renderProductionOrders()
Check: Apakah production order display juga affected?
Action: Jika ya, add null check pada display

STOP when: Semua chained sections fixed & tested
```

#### 2.3 Bug Fix Workflow per Section

**Step 1: Identify Root Cause**

- Add console.log di function yang suspect
- Test dengan input edge case
- Document exact trigger

**Step 2: Implement Fix**

- Code minimal, focused pada root cause
- DO NOT refactor at this phase
- Maintain backward compatibility

**Step 3: Add Guard Conditions**

- Validate inputs at function entry
- Handle null/undefined/NaN
- Add try-catch jika Firestore call

**Step 4: Test the Fix**

- Test original case yang error
- Test edge cases
- Test chained dependencies

**Step 5: Check Related Code**

- Grep untuk function name di seluruh codebase
- Ensure semua caller juga handle hasil dengan benar

#### 2.4 Fix Templates (Per Module)

**database.js Fixes**

```javascript
// BEFORE (buggy)
export function calculateInvoiceItem(orderPayload) {
  const hppPcs = grandTotal / pcs; // ← NaN jika pcs=0
  return { hppPcs };
}

// AFTER (fixed)
export function calculateInvoiceItem(orderPayload) {
  const validQty = Math.max(1, pcs || 0); // Guard: min 1
  const hppPcs = validQty > 0 ? grandTotal / validQty : 0;
  return { hppPcs };
}

// CHAINED: Check all callers
// costing.js line 71: setText("hppPcs", rupiah(grandTotal / pcs));
// MUST ALSO FIX: const hppPcs = pcs > 0 ? grandTotal / pcs : 0;
```

**storage.js Fixes**

```javascript
// BEFORE (no validation)
export function saveHistory() {
  const histories = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
  histories.unshift({ ... });
  localStorage.setItem(KEYS.history, JSON.stringify(histories));  // ← quota overflow
}

// AFTER (with quota check)
export function saveHistory() {
  try {
    const histories = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
    // Keep only last 100 entries to prevent quota overflow
    if (histories.length >= 100) histories.pop();
    histories.unshift({ ... });
    localStorage.setItem(KEYS.history, JSON.stringify(histories));
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      // Clear old entries
      localStorage.removeItem(KEYS.history);
      showToast("History cleared (quota limit)", "info");
    }
  }
}
```

**costing.js Fixes**

```javascript
// BEFORE (NaN propagation)
export function hitung() {
  const pcs = parseFloat(document.getElementById("pcs")?.value) || 0;
  // ... other calcs ...
  setText("hppPcs", rupiah(grandTotal / pcs)); // ← NaN if pcs=0
}

// AFTER (guarded)
export function hitung() {
  const pcs = Math.max(
    1,
    parseFloat(document.getElementById("pcs")?.value) || 1,
  );
  // ... other calcs ...
  const hppPcs = pcs > 0 ? grandTotal / pcs : 0;
  setText("hppPcs", rupiah(hppPcs));
}
```

**app.js Fixes**

```javascript
// BEFORE (missing error boundary)
async function saveDesignOrder() {
  try {
    await addDoc(collection(db, "design_orders"), data);
    showToast("Pesanan bertambah");
  } catch (err) {
    showToast("Gagal, coba lagi", "error");
    // ← err details swallowed, hard to debug
  }
}

// AFTER (with logging & specific handling)
async function saveDesignOrder() {
  try {
    if (!customer || !design) {
      showToast("Lengkapi nama pelanggan dan desain", "error");
      return;
    }
    await addDoc(collection(db, "design_orders"), data);
    showToast("Pesanan bertambah");
    // Reset form
    designState.editId = null;
    closeModal("modal-design");
  } catch (err) {
    console.error("[saveDesignOrder] Error:", err.message);
    if (err.code === "permission-denied") {
      showToast("Akses ditolak. Periksa Firebase rules.", "error");
    } else if (err.code === "unavailable") {
      showToast("Koneksi Firebase tidak tersedia", "error");
    } else {
      showToast("Penyimpanan gagal: " + err.message, "error");
    }
  }
}
```

#### 2.5 Chained Fix Detection Checklist

Setelah fix bug di satu section, OpenCode harus check:

```
Bug Fixed in: [Module].[Function]

Related Sections to Check:
□ app.js (if Firestore related)
□ tracker.js (if display related)
□ costing.js (if calculation related)
□ storage.js (if localStorage related)
□ database.js (if pricing related)
□ index.html (if form validation related)

For each related section, ask:
1. Does this section call the fixed function?
2. Does this section display/use the result?
3. Can this section handle errors from the fix?
4. Are there similar bugs in this section?

If YES to any: Include in fix batch
If NO to all: Continue to next bug
```

---

### FASE 3: REFACTORING & CLEAN CODE

**Durasi Estimasi:** 3-4 jam  
**Output:** Professional, maintainable code  
**Status:** ACTIVE CODE CHANGES

**PREREQUISITE:** Semua bugs dari FASE 2 sudah fixed (Zero Bugs)

#### 3.1 Refactoring Ground Rules

1. **DRY Principle (Don't Repeat Yourself)**
   - [ ] Identify duplicate code blocks (search same logic)
   - [ ] Extract to helper function or module
   - [ ] Replace all occurrences with function call

   **Example:**

   ```javascript
   // BEFORE (repeated)
   // In tracker.js line 50
   const today = getToday();
   const orders = [...orders].filter(
     (o) => o.deadline < today && o.stage !== "done",
   );

   // In costing.js line 200
   const today = getToday();
   const outdated = histories.filter((h) => h.date < today);

   // AFTER (DRY)
   // Add to utils.js
   export function filterByDeadline(items, fieldName = "deadline") {
     const today = getToday();
     return items.filter((item) => item[fieldName] < today);
   }

   // Use in tracker.js
   const overdue = filterByDeadline(orders);

   // Use in costing.js
   const outdated = filterByDeadline(histories, "date");
   ```

2. **ES Modules Organization**
   - [ ] Group related functions together
   - [ ] Put constants at top
   - [ ] Export only necessary functions
   - [ ] Use named exports (not default)

3. **Variable Naming Clarity**
   - ❌ `const x = 100; const y = x * 0.5;`
   - ✅ `const basePrice = 100; const dpAmount = basePrice * 0.5;`

4. **Function Responsibility (Single)**
   - Each function should do ONE thing only
   - If >30 lines, probably doing too much

5. **Remove Dead Code**
   - [ ] Grep untuk unreferenced functions
   - [ ] Remove unused imports
   - [ ] Remove commented-out code

#### 3.2 Module-Specific Refactoring

**database.js Refactoring**

- [ ] Simplify calculateInvoiceItem() if possible
- [ ] Extract sub-calculations to helper functions
- [ ] Add JSDoc comments untuk complex functions
- [ ] Organize MASTER_PRICE_DATABASE logically

```javascript
// BEFORE: Complex nested function
export function calculateInvoiceItem(orderPayload) {
  // ... 50 lines of mixed concerns ...
}

// AFTER: Extracted helpers
function calculateMaterialPremium(productType, material) { ... }
function calculateAddonCharges(productType, addonsSelected) { ... }
function calculateSizeCharges(sizeDistribution) { ... }

export function calculateInvoiceItem(orderPayload) {
  const materialPremium = calculateMaterialPremium(...);
  const addonCharges = calculateAddonCharges(...);
  const sizeCharges = calculateSizeCharges(...);
  // Simplified main logic
}
```

**storage.js Refactoring**

- [ ] Extract localStorage key management
- [ ] Add error handling wrapper
- [ ] Separate read/write concerns
- [ ] Add migration helper if schema changes

```javascript
// BEFORE: Scattered localStorage calls
localStorage.setItem("progress_autosave", JSON.stringify(data));
JSON.parse(localStorage.getItem("progress_costings") || "[]");

// AFTER: Centralized
const storageManager = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === "QuotaExceededError") handleQuotaExceeded();
    }
  },
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
};
```

**utils.js Refactoring**

- [ ] Group similar functions (formatters together, calculators together)
- [ ] Add JSDoc untuk each export
- [ ] Optimize performance (e.g., memoization limits)

**costing.js Refactoring**

- [ ] Extract chart management to separate module
- [ ] Separate rendering logic from calculation
- [ ] Create utility untuk form state management

**tracker.js Refactoring**

- [ ] Extract filtering logic to separate function
- [ ] Consolidate table rendering (reduce duplicate HTML generation)
- [ ] Extract date formatting logic

**app.js Refactoring (PRIORITY - most complex)**

- [ ] Break into smaller modules (firebase-manager.js, invoice-builder.js)
- [ ] Extract Firebase listeners to singleton
- [ ] Extract invoice generation to separate file
- [ ] Reduce global event listener chaos

#### 3.3 Code Quality Checklist

```
Per File Refactoring Checklist:

[ ] No commented-out code
[ ] No console.log() (except error logging)
[ ] No inline CSS (use CSS classes)
[ ] No magic numbers (use CONSTANTS)
[ ] All functions have clear purpose
[ ] <30 lines per function (refactor if >50)
[ ] Proper error handling (try-catch or guard)
[ ] No global variables (except window.firebase*)
[ ] All imports used
[ ] Consistent naming convention
[ ] JSDoc for public functions
```

---

### FASE 4: PEMBENAHAN UI/UX & TAMPILAN RESPONSIF

**Durasi Estimasi:** 2-3 jam  
**Output:** Professional, responsive UI  
**Status:** CSS + HTML changes

**PREREQUISITE:** FASE 2 (bugs fixed) + FASE 3 (code clean)

#### 4.1 UI/UX Assessment Areas

**Layout & Alignment**

- [ ] Table column alignment (data seharusnya center-right, labels left)
- [ ] Modal centering (should be vertically centered, not top-aligned)
- [ ] Form field spacing (consistent 12-16px gaps)
- [ ] Button sizing (min 44px height for touch targets)
- [ ] Text readability (sufficient line-height, font-size)

**Color & Visual Hierarchy**

- [ ] Dark mode colors (text contrast ≥ 4.5:1)
- [ ] Status badge colors (distinct untuk design/revisi/printing/done)
- [ ] Danger/warning colors (red for error, orange for warning)
- [ ] Hover/active states (visual feedback pada interactable elements)

**Responsive Design Verification**

| Breakpoint       | Test Cases                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| 480px (Phone)    | Table → single column OR horizontal scroll, modals full-width, buttons stacked |
| 768px (Tablet)   | 2-column layout, tables readable, all inputs visible                           |
| 1200px (Desktop) | Full layout, 3+ columns, all features visible                                  |

**Mobile-Specific Issues**

- [ ] Touch targets ≥44x44px
- [ ] Dropdown/modal close on tap outside
- [ ] Scrollbar visibility (don't hide completely)
- [ ] Input focus not hidden by keyboard
- [ ] No horizontal scroll (except for overflow tables)

**Dark Mode Verification**

- [ ] All text readable (good contrast)
- [ ] Form inputs visible (border or background needed)
- [ ] Modals have proper background
- [ ] Charts colors updated
- [ ] No hardcoded color values (#fff, #000)

#### 4.2 CSS Changes Template

**Fix Layout Issues**

```css
/* BEFORE: Misaligned */
.table-customer {
  display: flex;
  justify-content: space-between; /* ← causes weird alignment */
}

/* AFTER: Proper alignment */
.table-customer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-avatar {
  flex-shrink: 0; /* Prevent avatar size change */
  width: 40px;
  height: 40px;
}

.table-info {
  flex: 1;
  min-width: 0; /* Prevent text overflow */
}
```

**Mobile Responsive**

```css
/* BEFORE: Not responsive */
.invoice-table {
  width: 100%;
  border-collapse: collapse;
}

/* AFTER: Mobile-friendly */
@media (max-width: 768px) {
  .invoice-table {
    font-size: 12px;
  }

  .invoice-table th,
  .invoice-table td {
    padding: 8px 4px;
  }

  .table-customer-col {
    min-width: 120px; /* Prevent column collapse */
  }
}

@media (max-width: 480px) {
  .invoice-table {
    display: block;
    overflow-x: auto;
  }

  .invoice-table th,
  .invoice-table td {
    white-space: nowrap;
  }
}
```

**Dark Mode Compatibility**

```css
/* BEFORE: Hardcoded */
.button {
  color: #000;
  background: #fff;
}

/* AFTER: CSS Variables */
.button {
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

body.dark {
  --text-primary: #f0f0f0;
  --bg-primary: #2a2a2a;
  --border-color: #444;
}

body.light {
  --text-primary: #333;
  --bg-primary: #fff;
  --border-color: #ddd;
}
```

#### 4.3 HTML Accessibility Improvements

**Add Labels to Inputs**

```html
<!-- BEFORE: Unlabeled -->
<input id="po-qty" type="number" />

<!-- AFTER: Labeled -->
<label for="po-qty">Jumlah Pcs:</label>
<input id="po-qty" type="number" min="1" required aria-label="Jumlah Pcs" />
```

**Fix Modal Accessibility**

```html
<!-- BEFORE: Not accessible -->
<div id="modal-invoice" class="modal">
  <button onclick="closeModal('modal-invoice')">Close</button>
</div>

<!-- AFTER: Accessible -->
<div
  id="modal-invoice"
  class="modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-header">
    <h2 id="modal-title">Invoice Builder</h2>
    <button aria-label="Close" onclick="closeModal('modal-invoice')">×</button>
  </div>
  ...
</div>
```

**Add ARIA Labels**

```html
<!-- For icon buttons -->
<button aria-label="Tambah item" onclick="tambahItem()">
  <i class="ri-add-line"></i>
</button>

<!-- For status badges -->
<span role="status" aria-live="polite" class="badge">Selesai</span>
```

#### 4.4 UI Polish Checklist

```
Visual Polish:
□ Button hover states (darker background or shadow)
□ Input focus states (blue border or outline)
□ Link underlines or color distinction
□ Loading spinners on async operations
□ Success/error animations
□ Modal backdrop transparency
□ Tooltip clarity

Layout:
□ No unexpected line breaks in tables
□ Proper column widths (data doesn't overlap)
□ Modal max-width (not full screen on desktop)
□ Form input widths (consistent)
□ Button alignment in dialogs

Mobile:
□ Single column layout <768px
□ Touch-friendly buttons (≥44px)
□ Readable font sizes (base ≥14px)
□ Proper spacing below inputs (keyboard doesn't hide)
□ Hamburger menu functional
```

---

### FASE 5: FINISHING, KEAMANAN, & OPTIMASI PERFORMA

**Durasi Estimasi:** 2-3 jam  
**Output:** Secure, optimized, production-ready code  
**Status:** Final polishing

**PREREQUISITE:** FASE 1-4 completed

#### 5.1 Security Hardening

**Input Sanitization**

```javascript
// BEFORE: Direct user input to DOM
function renderCustomerName(name) {
  document.getElementById("customer-display").innerHTML = name; // ← XSS risk
}

// AFTER: Safe rendering
function renderCustomerName(name) {
  document.getElementById("customer-display").textContent = name; // textContent, not innerHTML
}

// OR for HTML content (rare):
function renderHTML(html) {
  const temp = document.createElement("div");
  temp.textContent = html; // First set as text
  const safe = temp.innerHTML; // Get escaped HTML
  return safe;
}
```

**Firebase Security**

- [ ] Review Firestore rules (not open for public)
- [ ] Validate user input before Firebase write
- [ ] Handle Firebase auth errors gracefully
- [ ] Timeout long-running queries

```javascript
// BEFORE: No validation before Firebase call
async function saveOrder(data) {
  await addDoc(collection(db, "production_orders"), data);
}

// AFTER: Validated
async function saveOrder(data) {
  const { customer, qty, material } = data;

  // Validate required fields
  if (!customer || customer.trim().length < 2) {
    throw new Error("Customer name invalid");
  }
  if (!qty || qty < 1) {
    throw new Error("Quantity must be ≥1");
  }
  if (!material || !MASTER_PRICE_DATABASE.products[material]) {
    throw new Error("Invalid material");
  }

  // Sanitize
  const sanitized = {
    customer: customer.trim(),
    qty: Math.floor(qty),
    material: material.trim(),
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, "production_orders"), sanitized);
}
```

**localStorage Security**

- [ ] No sensitive data (passwords, API keys)
- [ ] Assume data is readable/editable by user
- [ ] Validate on load (check integrity)

```javascript
// BEFORE: Trust localStorage data
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("settings"));
  return settings;
}

// AFTER: Validated
function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem("settings") || "{}");

    // Validate structure
    if (typeof settings !== "object") {
      throw new Error("Invalid settings format");
    }

    // Apply defaults for missing values
    return {
      theme: settings.theme === "dark" ? "dark" : "light",
      autoSave: settings.autoSave !== false,
      itemsPerPage: Math.max(1, Math.min(100, settings.itemsPerPage || 5)),
    };
  } catch (e) {
    console.error("Settings load failed:", e);
    return { theme: "light", autoSave: true, itemsPerPage: 5 };
  }
}
```

#### 5.2 Performance Optimization

**Reduce Reflows & Repaints**

```javascript
// BEFORE: Triggers reflow multiple times
for (let i = 0; i < 100; i++) {
  document.getElementById("list").innerHTML += `<li>${i}</li>`; // Reflow each iteration
}

// AFTER: Single batch
const html = [];
for (let i = 0; i < 100; i++) {
  html.push(`<li>${i}</li>`);
}
document.getElementById("list").innerHTML = html.join(""); // Single reflow
```

**Chart Memory Management**

```javascript
// BEFORE: Memory leak (chart not destroyed)
function updateChart(data) {
  new Chart(ctx, {
    type: "pie",
    data: data,
  }); // Previous chart instance leaked
}

// AFTER: Proper cleanup
let costChart = null;

function updateChart(data) {
  if (costChart) {
    costChart.destroy(); // Clean up old instance
  }
  costChart = new Chart(ctx, {
    type: "pie",
    data: data,
  });
}
```

**localStorage Cleanup**

```javascript
// BEFORE: No size management
export function saveHistory() {
  const histories = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
  histories.unshift(newEntry); // Array grows indefinitely
  localStorage.setItem(KEYS.history, JSON.stringify(histories));
}

// AFTER: Size capped
export function saveHistory() {
  const MAX_ENTRIES = 100;
  const histories = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
  histories.unshift(newEntry);

  // Keep only recent entries
  if (histories.length > MAX_ENTRIES) {
    histories.length = MAX_ENTRIES;
  }

  localStorage.setItem(KEYS.history, JSON.stringify(histories));
}
```

**Firebase Listener Optimization**

- [ ] Register listeners ONCE (not on every render)
- [ ] Unsubscribe old listeners before new ones
- [ ] Use query filters at database level, not in-memory

```javascript
// BEFORE: New listener each render
function renderDesignOrders() {
  onSnapshot(collection(db, "design_orders"), (snapshot) => {
    // ... render ...
  }); // Creates new listener each time!
}

// AFTER: Singleton listener
let designOrdersUnsubscribe = null;

function initDesignOrdersListener() {
  if (designOrdersUnsubscribe) {
    designOrdersUnsubscribe(); // Clean up old
  }
  designOrdersUnsubscribe = onSnapshot(
    collection(db, "design_orders"),
    (snapshot) => {
      window.firebaseDesignOrders = snapshot.docs.map(/* ... */);
      renderDesignOrders();
    },
  );
}
```

#### 5.3 Clean Console & Logging

**Remove Debug Logs**

```javascript
// BEFORE: Debug logging everywhere
function hitung() {
  console.log("Starting calculation...");
  const bahan = hitungBahan();
  console.log("Bahan result:", bahan);
  const jahit = g("jahitPcs") * a("jahitHarga");
  console.log("Jahit:", jahit);
  // ... more logs ...
}

// AFTER: Only meaningful logs remain
function hitung() {
  try {
    const bahan = hitungBahan();
    if (isNaN(bahan.milanoBerat)) {
      console.warn("[hitung] Invalid bahan calculation");
    }
    // ... calculation ...
  } catch (e) {
    console.error("[hitung] Calculation failed:", e);
    showToast("Perhitungan gagal", "error");
  }
}
```

**Production Logging**

```javascript
// For error tracking in production
const logger = {
  error(module, message, details) {
    console.error(`[${module}] ${message}`, details);
    // Can send to error tracking service (Sentry, etc)
  },
  warn(module, message) {
    console.warn(`[${module}] ${message}`);
  },
  // Development only
  ...(process.env.DEBUG && {
    debug(module, message, data) {
      console.log(`[DEBUG] [${module}] ${message}`, data);
    },
  }),
};
```

#### 5.4 Error Boundaries & Graceful Degradation

**Add Error Boundaries**

```javascript
// BEFORE: Unhandled errors crash app
window.addEventListener("load", () => {
  updateCharts();
  renderDesignOrders();
  hitung();
});

// AFTER: Safe execution
window.addEventListener("load", () => {
  try {
    updateCharts();
  } catch (e) {
    logger.error("app", "Chart update failed", e);
    showToast("Grafik tidak dapat ditampilkan", "warning");
  }

  try {
    renderDesignOrders();
  } catch (e) {
    logger.error("app", "Design orders render failed", e);
    showToast("Pesanan desain gagal dimuat", "warning");
  }

  try {
    hitung();
  } catch (e) {
    logger.error("costing", "Calculation failed", e);
    // Let user know but don't crash
  }
});
```

**Offline Fallback**

```javascript
// Detect offline
window.addEventListener("offline", () => {
  showToast("Koneksi terputus. Fitur offline terbatas.", "warning");
  document.body.classList.add("offline-mode");
});

window.addEventListener("online", () => {
  showToast("Koneksi kembali", "success");
  document.body.classList.remove("offline-mode");
  // Retry pending operations
});
```

#### 5.5 Final Production Checklist

```
FASE 5 COMPLETION CHECKLIST:

SECURITY:
□ No console.log() with sensitive data
□ All inputs validated before use
□ HTML content uses textContent (not innerHTML)
□ Firebase rules reviewed (not public)
□ No hardcoded secrets (API keys, URLs)
□ localStorage doesn't store sensitive data

PERFORMANCE:
□ Charts destroyed before recreation
□ Listeners registered once
□ No N+1 queries
□ Images optimized (if any)
□ No memory leaks detected
□ Page load < 3s, interactions < 500ms

RELIABILITY:
□ All try-catch blocks present
□ Firebase errors handled
□ Offline mode supported
□ localStorage quota handled
□ Network timeout managed

POLISH:
□ No console errors
□ No console.log() for debug
□ All tests passing
□ Mobile responsive verified
□ Dark mode working
□ Accessibility checked (keyboard nav, ARIA)

DOCUMENTATION:
□ Code comments for complex logic
□ JSDoc for public functions
□ README updated (if needed)
□ CHANGELOG updated (if needed)
```

---

## 📝 SECTION 3: COMMAND TEMPLATES FOR USER (READY-TO-USE PROMPTS)

**Gunakan template berikut untuk memberikan instruksi ke OpenCode. COPY-PASTE langsung, hanya ubah [BAGIAN_DALAM_KURUNG].**

---

### TEMPLATE: FASE 1 — AUDIT TOTAL & PEMETAAN DEPENDENSI

```markdown
# OPENCODE TASK — FASE 1: AUDIT TOTAL

Eksekusi Audit Total aplikasi Progress Printshop Workspace sesuai FASE 1 pada workflow-rules.md.

## INSTRUKSI KETAT:

- NO CODE CHANGES (read-only inspection)
- Lakukan file-by-file review (database.js, storage.js, utils.js, app.js, tracker.js, costing.js, tasks.js, index.html, CSS)
- Buat dependency map yang clear
- Identify dan inventory SEMUA bugs/issues

## DELIVERABLE YANG DIPERLUKAN:

### 1. Audit Report (dalam format Markdown)

Struktur:
```

## PHASE 1 AUDIT REPORT

### 1. Codebase Overview

- Total files & LOC
- Module structure summary
- Tech stack verification

### 2. File-by-File Analysis

For each file:

- [FILE NAME]
  - Purpose: ...
  - Key functions/exports: ...
  - Findings: ...
  - Risk areas: ...

### 3. Dependency Map

[ASCII diagram showing inter-module dependencies]

### 4. Bug & Issue Inventory

[Table with columns: Severity | Module | Function | Issue | Trigger | Impact | Fix Complexity]

### 5. Performance Baseline

- Table render time (current)
- Chart render time (current)
- Calculation time (current)
- localStorage usage (current)

### 6. Security Assessment

- Input validation gaps
- XSS risk areas
- localStorage security
- Firebase configuration status

### 7. Accessibility Issues

- Missing labels
- Missing ARIA
- Keyboard navigation gaps

### 8. Mobile Responsive Issues

- Breakpoint verification
- Touch target sizing
- Viewport issues

```

## OUTPUT FORMAT:
Save report as: `AUDIT_REPORT_PHASE1.md`

Mulai sekarang!
```

---

### TEMPLATE: FASE 2 — BUG FIX DENGAN SISTEM BERANTAI

```markdown
# OPENCODE TASK — FASE 2: BUG FIX (CHAINED SYSTEM)

Eksekusi perbaikan bug dengan SISTEM BERANTAI sesuai FASE 2 pada workflow-rules.md.

## INSTRUKSI KETAT:

- Prioritas: CRITICAL bugs dulu (P1 > P2 > P3)
- CHAINED FIX RULE: Jika bug di satu module terhubung ke module lain, fix SEMUA yang terhubung (Zero Bugs)
- Setiap fix harus tested sebelum lanjut ke bug berikutnya
- Commit message format: [FASE-2] [MODULE] Deskripsi

## BUG FIX PRIORITY (dari AUDIT REPORT):

### Priority 1 (CRITICAL) - Fix First:

[Copy dari AUDIT_REPORT bugs dengan severity=CRITICAL/HIGH]

Untuk SETIAP bug:

1. Identify root cause (add console.log jika perlu)
2. Implement minimal fix
3. Check CHAINED sections (app.js, tracker.js, costing.js, storage.js)
4. Fix chained bugs jika ada
5. Test thoroughly
6. Move to next bug

### Priority 2 (HIGH) - Fix After P1:

[Copy dari AUDIT_REPORT bugs dengan severity=HIGH]

### Priority 3 (MEDIUM) - Fix After P1+P2:

[Copy dari AUDIT_REPORT bugs dengan severity=MEDIUM]

## TESTING REQUIREMENT:

Setelah SETIAP fix:
```

□ Unit test: Function return value correct
□ Module test: Exports work with other modules
□ Integration test: Cross-module data flow works
□ UI test: Changes visible & functional in browser
□ Edge case test: Zero/negative/null values handled

```

## DELIVERABLE:
- Updated code files (all bugs fixed)
- Commit messages clear
- NO broken functionality

Mulai dari Priority 1 bugs sekarang!
```

---

### TEMPLATE: FASE 3 — REFACTORING & CLEAN CODE

```markdown
# OPENCODE TASK — FASE 3: REFACTORING & CLEAN CODE

Eksekusi refactoring sesuai FASE 3 pada workflow-rules.md.

## PREREQUISITE:

✓ FASE 1 (Audit) completed
✓ FASE 2 (Bugs fixed) completed — Zero Bugs

## REFACTORING PRIORITIES:

### Priority 1: Remove Dead Code

- [ ] Grep untuk unused functions/imports
- [ ] Remove commented-out code
- [ ] Clean up old logic
- [ ] Test bahwa aplikasi masih jalan

### Priority 2: DRY (Don't Repeat Yourself)

Identify duplicate code blocks dan extract ke helper functions:
```

[Copy dari AUDIT_REPORT duplicate code findings]

```

For each duplicate:
1. Create helper function in appropriate module
2. Replace all occurrences with function call
3. Test each replacement

### Priority 3: Module Organization
- [ ] Group related functions (constants, helpers, exports)
- [ ] Organize imports (database, utils, local)
- [ ] Separate concerns (calculation vs rendering vs storage)

### Priority 4: Naming Clarity
- [ ] Fix ambiguous variable names (x, y, temp, data → specific names)
- [ ] Fix confusing function names (do vs process vs execute)
- [ ] Ensure naming is consistent across codebase

### Priority 5: Function Simplification
- [ ] Break >50 line functions into smaller pieces
- [ ] Extract complex conditions to helper functions
- [ ] Simplify nested loops/conditions

## CODE QUALITY CHECKLIST:
Per file:
□ No commented-out code
□ No console.log() (except errors)
□ No magic numbers (use CONSTANTS)
□ All functions have single responsibility
□ Proper error handling
□ JSDoc for public functions

## TESTING:
After each refactoring step:
- Test in browser
- Verify functionality unchanged
- Check console for errors

## DELIVERABLE:
- Clean, professional code
- No dead code
- DRY principle applied
- Consistent naming
- Clear module organization

Mulai sekarang dengan Priority 1!
```

---

### TEMPLATE: FASE 4 — UI/UX & RESPONSIVE DESIGN

```markdown
# OPENCODE TASK — FASE 4: UI/UX & RESPONSIVE DESIGN

Eksekusi pembenahan UI/UX sesuai FASE 4 pada workflow-rules.md.

## PREREQUISITE:

✓ FASE 1-3 completed (Audit → Bugs → Clean Code)

## ASSESSMENT AREAS:

### Area 1: Layout & Alignment

Issues to fix:
```

[Copy dari AUDIT_REPORT layout issues]

```

For each issue:
- Identify CSS causing misalignment
- Fix with proper flexbox/grid
- Test on desktop & mobile
- Commit with before/after screenshots

### Area 2: Color & Visual Hierarchy
- [ ] Dark mode text contrast verified (≥4.5:1)
- [ ] Status badges distinct colors
- [ ] Hover/active states visible
- [ ] No hardcoded colors (#fff, #000) — use CSS variables

### Area 3: Responsive Design

Test pada breakpoints:
```

□ 480px (phone)

- [ ] Single column layout
- [ ] Table scrollable horizontally (jika perlu)
- [ ] Modals full-width with padding
- [ ] Buttons readable & touchable (≥44px)

□ 768px (tablet)

- [ ] 2-column layout readable
- [ ] Tables in normal view (not scrolled)
- [ ] All inputs visible

□ 1200px (desktop)

- [ ] Full layout optimal
- [ ] 3+ columns if applicable
- [ ] Proper spacing

```

### Area 4: Mobile-Specific Polish
- [ ] Touch targets ≥44x44px (buttons, links)
- [ ] Dropdown/modal close on tap outside
- [ ] Input focus doesn't hide behind keyboard
- [ ] No horizontal scroll (except table overflow)

### Area 5: Dark Mode Compatibility
- [ ] All text readable in dark mode
- [ ] Form inputs visible (border or background)
- [ ] Charts colors updated
- [ ] No hardcoded color values

## CSS REFACTORING RULES:
- Use CSS variables for colors (no #fff, #000)
- Media queries for breakpoints
- Flexbox for alignment (no floats)
- Grid for complex layouts

## TESTING CHECKLIST:
```

□ Chrome DevTools device emulation tested
□ Actual mobile device tested (if possible)
□ Dark mode toggle works
□ All colors have sufficient contrast
□ Forms readable on mobile
□ Tables scrollable on mobile

```

## DELIVERABLE:
- Professional, responsive UI
- Mobile-friendly design
- Proper dark mode support
- Accessibility improved

Mulai dengan Area 1 (Layout & Alignment) sekarang!
```

---

### TEMPLATE: FASE 5 — FINISHING, SECURITY & PERFORMA

```markdown
# OPENCODE TASK — FASE 5: FINISHING, SECURITY & PERFORMA

Eksekusi finishing sesuai FASE 5 pada workflow-rules.md.

## PREREQUISITE:

✓ FASE 1-4 completed (Audit → Bugs → Clean → UI)

## WORK ITEMS:

### Item 1: Security Hardening

- [ ] Audit input handling (use textContent not innerHTML)
- [ ] Validate all user inputs before Firebase calls
- [ ] Check localStorage doesn't store sensitive data
- [ ] Review Firestore rules (not public)
- [ ] Handle Firebase auth/permission errors

For each user input:
```

1. Identify input source
2. Check validation exists
3. Check XSS protection (textContent)
4. Add error handling
5. Test with malicious input (if applicable)

```

### Item 2: Performance Optimization
- [ ] Destroy charts before recreation (prevent memory leak)
- [ ] Register Firebase listeners ONCE (not per render)
- [ ] Batch DOM updates (join arrays instead of innerHTML +=)
- [ ] Cap localStorage history (max 100 entries)
- [ ] Add timeout to long Firebase queries

Performance targets:
```

- Table render: <500ms
- Chart render: <300ms
- Calculation: <200ms
- Page load: <3s

````

### Item 3: Remove Debug Logs
- [ ] Search untuk console.log() di setiap file
- [ ] Hapus debug logs
- [ ] Keep error logging (console.error)
- [ ] Keep important warnings (console.warn)

Command:
```bash
grep -r "console.log" js/ | grep -v "console.warn" | grep -v "console.error"
# Delete each unnecessary log
````

### Item 4: Error Handling & Fallbacks

- [ ] All Firestore calls in try-catch
- [ ] All chart updates wrapped in try-catch
- [ ] Offline mode supported (show warning, disable sync)
- [ ] Firebase quota error handled gracefully
- [ ] localStorage quota error handled

### Item 5: Final Quality Check

```
SECURITY CHECKLIST:
□ No hardcoded secrets (API keys, credentials)
□ All HTML content uses textContent (no innerHTML from user input)
□ Input validation on every user input
□ Firebase rules reviewed
□ No sensitive data in localStorage

PERFORMANCE CHECKLIST:
□ Charts destroyed before update
□ Listeners registered once only
□ No N+1 queries
□ localStorage capped at 100 entries
□ Timeouts added for async operations

RELIABILITY CHECKLIST:
□ All try-catch blocks present
□ Firebase errors handled with user message
□ Offline mode supported
□ localStorage fallback works
□ Console clear (no errors)

POLISH CHECKLIST:
□ No console.log() (debug removed)
□ Dark mode working
□ Mobile responsive
□ Accessibility improved
□ All buttons/links functional
```

## DELIVERABLE:

- Production-ready code
- Secure against common attacks
- Optimized performance
- Error handling complete
- Console clean

Mulai dengan Item 1 (Security) sekarang!

```

---

## 📋 QUICK COMMAND SUMMARY

**Gunakan prompt berikut untuk quick execution:**

### Command: Start FASE 1 (Copy-Paste)
```

Aku butuh kamu mengeksekusi OPENCODE FASE 1: Audit Total sesuai file workflow-rules.md.

Lakukan:

1. File-by-file inspection (database.js, storage.js, utils.js, app.js, tracker.js, costing.js, tasks.js, index.html, CSS)
2. Buat dependency map yang clear
3. Identify semua bugs & issues
4. Dokumentasi findings dalam format Markdown

Output: AUDIT_REPORT_PHASE1.md dengan struktur lengkap (overview, file analysis, dependency map, bug inventory, performance baseline, security assessment, mobile issues)

Jangan ubah kode apapun — hanya inspect!

```

### Command: Start FASE 2 (Copy-Paste)
```

Aku butuh kamu mengeksekusi OPENCODE FASE 2: Bug Fix (Chained System) sesuai workflow-rules.md.

Base: Gunakan AUDIT_REPORT_PHASE1.md yang sudah dibuat di FASE 1.

Instruksi:

1. Prioritas: Fix CRITICAL bugs dulu (P1)
2. CHAINED FIX RULE: Jika bug terhubung ke module lain, fix SEMUA section yang terhubung (Zero Bugs)
3. Per bug: identify root cause → implement fix → check chained sections → test
4. Commit message format: [FASE-2] [MODULE] Deskripsi

Jangan refactor — hanya fix bugs!
Test setiap fix sebelum lanjut bug berikutnya.

```

### Command: Start FASE 3 (Copy-Paste)
```

Aku butuh kamu mengeksekusi OPENCODE FASE 3: Refactoring & Clean Code sesuai workflow-rules.md.

Prerequisite: FASE 1 & 2 sudah completed (Zero Bugs)

Instruksi:

1. Priority 1: Remove dead code & unused imports
2. Priority 2: DRY — extract duplicate code ke helper functions
3. Priority 3: Organize modules (group related functions)
4. Priority 4: Fix naming clarity (x, y, temp → meaningful names)
5. Priority 5: Simplify functions (break >50 lines)

Code Quality Checklist per file:
□ No commented-out code
□ No console.log() (kecuali errors)
□ No magic numbers
□ Single responsibility functions
□ Proper error handling
□ JSDoc for public functions

Test setiap refactoring step untuk memastikan functionality tidak berubah.

```

### Command: Start FASE 4 (Copy-Paste)
```

Aku butuh kamu mengeksekusi OPENCODE FASE 4: UI/UX & Responsive Design sesuai workflow-rules.md.

Prerequisite: FASE 1-3 completed

Focus Areas:

1. Layout & Alignment (fix CSS misalignment)
2. Color & Visual Hierarchy (dark mode contrast, badges, hover states)
3. Responsive Design (test 480px, 768px, 1200px)
4. Mobile Polish (touch targets ≥44px, close on tap outside, no horizontal scroll)
5. Dark Mode (all text readable, no hardcoded colors)

Breakpoint Testing:

- 480px: Single column, modals full-width, scrollable tables
- 768px: 2-column, tables normal view, all inputs visible
- 1200px: Full layout optimal

Use CSS variables (not hardcoded colors).
Test di Chrome DevTools device emulation.

Commit dengan before/after screenshots jika UI changes signifikan.

```

### Command: Start FASE 5 (Copy-Paste)
```

Aku butuh kamu mengeksekusi OPENCODE FASE 5: Finishing, Security & Performa sesuai workflow-rules.md.

Prerequisite: FASE 1-4 completed

Work Items:

1. SECURITY: Audit input handling (textContent not innerHTML), validate inputs, check localStorage, Firestore rules
2. PERFORMANCE: Destroy charts before update, register listeners once, batch DOM, cap localStorage
3. REMOVE DEBUG: Delete console.log() (keep only errors/warns)
4. ERROR HANDLING: Try-catch semua async operations, handle offline, handle quota exceeded
5. FINAL QA: Run full security/performance/reliability checklist

Performance Targets:

- Table render: <500ms
- Chart render: <300ms
- Calculation: <200ms
- Page load: <3s

Output: Production-ready code, secure, optimized, error-handled, console clean.

```

---

## 🎯 SECTION 4: EXECUTION SUMMARY & CHECKLIST

### Overall Workflow Checklist

```

PHASE 1: AUDIT TOTAL (2-3 hours)
□ Read entire workflow-rules.md (this document)
□ File-by-file inspection (all 8+ JS files, index.html, CSS)
□ Create dependency map
□ Identify ALL bugs & issues
□ Document performance baseline
□ Output: AUDIT_REPORT_PHASE1.md

PHASE 2: BUG FIX (4-6 hours)
□ Fix P1 (Critical) bugs first
□ Apply CHAINED FIX rule (fix all connected sections)
□ Test each fix before next
□ Commit with clear messages
□ Output: Bug-free code

PHASE 3: REFACTORING (3-4 hours)
□ Remove dead code
□ Apply DRY principle
□ Organize modules
□ Fix naming clarity
□ Simplify functions
□ Output: Clean, professional code

PHASE 4: UI/UX (2-3 hours)
□ Fix layout alignment
□ Verify colors & contrast
□ Test responsive (480px, 768px, 1200px)
□ Polish mobile experience
□ Verify dark mode
□ Output: Professional, responsive UI

PHASE 5: FINISHING (2-3 hours)
□ Security hardening (input validation, XSS prevention)
□ Performance optimization (chart cleanup, listener mgmt, DOM batching)
□ Remove debug logs
□ Add error handling
□ Final quality check
□ Output: Production-ready, secure, optimized code

TOTAL: ~13-23 hours

```

### Mandatory Verification Points

**Before marking PHASE complete:**

```

PHASE 1:
□ Audit report complete & detailed
□ All 8+ files analyzed
□ Dependency map clear
□ Bug inventory prioritized
□ No code changes made

PHASE 2:
□ Zero critical bugs remaining
□ Chained sections checked
□ Each fix tested
□ Clear commit messages
□ All tests passing

PHASE 3:
□ Dead code removed
□ Duplicate code extracted
□ Naming consistent
□ Modules organized
□ Functions simplified
□ Functionality unchanged

PHASE 4:
□ Mobile responsive (480px, 768px, 1200px)
□ Dark mode working
□ Touch targets ≥44px
□ Color contrast verified
□ No horizontal scroll (except tables)
□ All UI polished

PHASE 5:
□ All inputs validated
□ XSS protection implemented
□ Charts properly cleaned
□ Listeners optimized
□ No debug logs
□ Error handling complete
□ Console clean
□ Performance targets met
□ Security checklist passed

```

---

## 📞 ESCALATION & SUPPORT

**If OpenCode encounters issues:**

1. **Unclear requirement?** → Reference workflow-rules.md section relevant to the task
2. **Code architecture question?** → Check Section 1 (Operating Rules) or Section 2 (Execution Plan)
3. **Template needed?** → Copy from Section 3 (Command Templates)
4. **Quality check?** → Use Section 4 (Execution Checklist)

**Common Questions:**

Q: Can I refactor during FASE 2?
A: No. FASE 2 is bug fixes only. Refactoring happens in FASE 3.

Q: Should I add new features during these phases?
A: No. These phases focus on fixing, cleaning, and optimizing existing code only.

Q: How do I know if FASE is complete?
A: Check "Execution Summary & Checklist" (Section 4) — all boxes must be checked.

Q: Can I skip a phase?
A: No. Phases are sequential and each prerequisite for the next.

---

## ✅ FINAL SIGN-OFF

**OpenCode Readiness:**
- [x] Understand 5-phase workflow
- [x] Know strict operating rules
- [x] Have command templates ready
- [x] Know what to check at each phase
- [x] Have escalation path

**User (Project Manager/Tech Lead) Readiness:**
- [x] Copy appropriate command template
- [x] Paste into OpenCode
- [x] Wait for deliverable
- [x] Verify against checklist
- [x] Move to next phase

---

**DOCUMENT STATUS: READY FOR PRODUCTION USE**
**Version:** 1.0
**Last Updated:** 2026-08-11
**Apply to:** OpenCode Development Tasks


```
