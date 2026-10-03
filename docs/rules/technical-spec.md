# Progress Printshop Workspace — Technical Specification & Development Guide
## Untuk OpenCode (Bug Fixes, Refactoring, Feature Development)

---

## 📋 DAFTAR ISI
1. [Overview & Architecture](#overview--architecture)
2. [Context Map & Data Flow](#context-map--data-flow)
3. [Module Breakdown](#module-breakdown)
4. [Critical Business Rules & Logic](#critical-business-rules--logic)
5. [Known Bugs & Edge Cases](#known-bugs--edge-cases)
6. [Refactoring Guidelines](#refactoring-guidelines)
7. [Testing & Quality Checklist](#testing--quality-checklist)
8. [Feature Development Instructions](#feature-development-instructions)

---

## 1. OVERVIEW & ARCHITECTURE

### 1.1 Tech Stack
- **Frontend:** Vanilla JS (ES Modules), HTML5, CSS3 (Variables + Mobile-First)
- **State Management:** Global `window` object (Firebase snapshots) + `localStorage`
- **Database:** Firebase Firestore (Collections: `design_orders`, `production_orders`, `invoices`, `costing_history`)
- **Realtime Sync:** Firebase Realtime Snapshots (onSnapshot)
- **UI Libraries:** Chart.js, html2canvas, SortableJS, Remixicon
- **Deployment:** Static HTML/JS/CSS (Serverless)

### 1.2 Application Type
SPA (Single Page Application) untuk manajemen operasional percetakan/konveksi (kaos, jersey, kemeja, DTF).

### 1.3 Key Features
- **Design Order Tracker:** Kanban workflow (design → revisi → done)
- **Production Order Tracker:** Kanban workflow (design → printing → jahit → qc → done)
- **Invoice Builder:** Auto-generate & render-to-PNG invoices
- **Costing Calculator:** HPP estimasi dengan breakdown bahan, jahit, ongkir, extras
- **Daily Task List:** To-do management
- **Charts & Reports:** Cost breakdown, pipeline overview

### 1.4 Browser Requirements
- Modern browsers dengan ES Modules support (Chrome 63+, Firefox 67+, Safari 10.1+)
- Responsive design: Mobile (480px) → Tablet (768px) → Desktop (1200px)

---

## 2. CONTEXT MAP & DATA FLOW

### 2.1 High-Level Data Flow Diagram

```
USER INTERACTION (UI)
    ↓
EVENT LISTENER (app.js)
    ↓
HANDLER (Firebase Write / localStorage Read/Write)
    ↓
DATABASE (Firestore + localStorage)
    ↓
onSnapshot Callback (Realtime Update)
    ↓
RENDER FUNCTION (tracker.js, costing.js)
    ↓
DOM UPDATE (HTML Table/List/Chart)
```

### 2.2 Firebase Firestore Collections

#### `design_orders`
```javascript
{
  id: "auto-generated",
  customer: String,
  design: String,
  jenis: String,
  deadline: Date (ISO string: "2026-08-15"),
  notes: String,
  stage: "design" | "revisi" | "done",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `production_orders`
```javascript
{
  id: "auto-generated",
  customer: String,
  team: String,
  qty: Number,
  material: String (e.g., "Milano", "Cotton 30S"),
  jenis: String,
  deadline: Date (ISO string),
  notes: String,
  stage: "design" | "printing" | "jahit" | "qc" | "done",
  invoiceId: String (nullable, link ke invoices collection),
  designOrderId: String (nullable, link ke design_orders),
  items: Array<{
    productType: "jersey" | "kaos" | "kemeja",
    category: String,
    material: String,
    qty: Number,
    sizeDistribution: { S: 2, M: 3, L: 5 },
    addonsSelected: Array<String>,
    customCharge: Number
  }>,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `invoices`
```javascript
{
  id: "auto-generated",
  invoiceNumber: String (e.g., "INV-20260811-001"),
  customer: String,
  items: Array<{
    productType: String,
    category: String,
    material: String,
    qty: Number,
    sizeDistribution: Object,
    addonsSelected: Array,
    customCharge: Number,
    subtotal: Number,
    dpRequired: Number,
    remainingPayment: Number,
    productionEstimation: String
  }>,
  totalAmount: Number,
  dpAmount: Number,
  remainingAmount: Number,
  notes: String,
  status: "draft" | "issued" | "paid" | "partial",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  productionId: String (nullable, link ke production_orders)
}
```

### 2.3 localStorage Keys
```javascript
{
  "progress_autosave": JSON (form state + extra items),
  "progress_costings": JSON (array of costing history),
  "progress_theme": "light" | "dark",
  "progress_tasks": JSON (array of tasks),
  "sectionStates": JSON (collapse state per section)
}
```

### 2.4 Global Window Variables (State)
```javascript
window.firebaseDesignOrders = Array<DesignOrder>  // dari Firestore snapshot
window.firebaseProductionOrders = Array<ProductionOrder>  // dari Firestore snapshot
window.isDark = Boolean  // theme toggle state
```

---

## 3. MODULE BREAKDOWN

### 3.1 `database.js` — Single Source of Truth for Pricing & Constants

**Exports:**
- `BAHAN`: Material master data (milano, emboss, airwalk, rib, lotto)
  - Fields: `nama`, `kg` (weight per unit), `harga` (unit price), `print` (printing rate)
- `CFG`: Config constants
  - `printPressRate`: Default print rate (12,600)
  - `estimasiRatio`: Estimation multiplier (0.7)
  - `toastDuration`: Toast notification duration (2,800ms)
- `DESIGN_STAGES`: ["design", "revisi", "done"]
- `PRODUCTION_STAGES`: ["design", "printing", "jahit", "qc", "done"]
- `KEYS`: localStorage key constants
- `MASTER_PRICE_DATABASE`: Nested pricing matrix
  - **Structure:**
    ```
    products: { jersey, kaos, kemeja }
      jersey:
        matrix: { "ATASAN JERSEY", "SETELAN JERSEY" }
          → { MILANO, EMBOSS }
            → { satuan, lusinan } { pendek, panjang }
      kaos/kemeja:
        tiers: { "COTTON COMBED 30S", etc. }
          → Array<{ min, max, price }>
    materials: { jersey: { ...}, kaos: {}, kemeja: {} }
    addons: { jersey: { kerah_free, kerah_tambahan, model, cutting }, ... }
    sizeCharges: { global_apparel: { S: 0, M: 0, ..., 5XL: 15000 } }
    rules: { jersey, kaos, kemeja } — minOrderForLusinan, bonus, dpRatio, productionTime
    ```

**Key Functions:**
- `getProductBasePrice(productType, options)`: Lookup harga base dari matrix/tier
  - Input: `{ qty, material, category, sleeve }`
  - Output: Price per unit
  - **Bug Risk:** Tidak handle undefined material keys → fallback ke first tier
  
- `findTierPrice(tiersArray, qty)`: Binary-like search untuk tier pricing
  - Input: Array of tiers, quantity
  - Output: Price yang match dengan quantity range
  - **Bug Risk:** Jika qty berada di gap (misal antara max tier) → return 0
  
- `calculateInvoiceItem(orderPayload)`: Kalkulator invoice item PALING KOMPLEKS
  - Input: `{ productType, category, material, qty, sleeve, sizeDistribution, addonsSelected, customCharge }`
  - Output: Breakdown invoice (`basePricePerPcs`, `calculatedHargaPerPcs`, `subtotal`, `dpRequired`, `bonus`, etc.)
  - **Logic:**
    1. Validate qty (Math.max(0, qty))
    2. Get base price dari matrix/tier
    3. Add material premium charge (lookup di MASTER_PRICE_DATABASE.materials[productType])
    4. Add addon charges (loop addonsSelected → lookup di addons → sum)
    5. Add size charges (loop sizeDistribution → sum)
    6. Calculate final price per PCS = (base + premium + addons + size) / qty
    7. Calculate subtotal dan DP ratio
    8. Check bonus eligibility
  - **Edge Cases:**
    - qty = 0 → realHargaPerPcs = 0, prevent divide-by-zero
    - addonsSelected array kosong → skip loop
    - sizeDistribution undefined → totalSizeChargeForGroup = 0
    - customCharge = NaN/undefined → set ke 0
    - Material key tidak ditemukan → no premium charge (silent fail)

---

### 3.2 `storage.js` — localStorage Management

**Exports:**
- `saveAuto()`: Debounced autosave (800ms) dari estimator section ke localStorage
  - Trigger: Setiap ada input change di #estimator-section
  - Store: Form values + extra items array
  - **Issue:** Timer tidak di-clear pada unmount → potential memory leak
  
- `loadAuto()`: Restore form state saat app boot
  - Graceful error handling dengan try-catch
  - Silent fail jika JSON corrupt
  
- `saveHistory()`: Save costing calculation to history
  - Prepend ke array (unshift)
  - Store: inputs, extraItems, qty, hargaJual, profit, grandTotal, date, etc.
  
- `getHistory()`: Retrieve costing history from localStorage
  - Safe fallback: return [] jika key tidak ada
  
- `deleteHistoryById(id)`: Remove specific history entry
  
- `loadHistoryData(id)`: Restore form dari history entry
  
- `getTasks()` / `saveTasks(tasks)`: Task list management
  
- `saveSectionState()` / `restoreSectionState()`: Collapse state persistence
  - Auto-restore pada app boot

**Issues to Watch:**
- No size limit check → localStorage quota overflow possible
- No encryption → pricing data visible
- No conflict resolution jika multiple tabs open

---

### 3.3 `utils.js` — Helper Functions (Pure Functions)

**Key Functions:**
- `rupiah(n)`: Format number to Rp (Indonesian currency)
  - Bug: Tidak handle negative values properly
  
- `angka(v)`: Parse string dengan dots to number
  - Input: "100.000.000" → Output: 100000000
  - Removes all dots, parseFloat fallback 0
  
- `formatRibuan(el)`: Format input ke Rp thousands separator
  - Regex: `/\B(?=(\d{3})+(?!\d))/g` untuk insert dots
  - Real-time input formatting (oninput event)
  
- `formatRupiah(amount)`: Intl.NumberFormat (Rp dengan format locale)
  
- `formatInvoiceDate(dateString)`: Format date ke id-ID locale
  
- `getToday()`: Return ISO date string (YYYY-MM-DD)
  
- `getAvatarPalette(name)`: Deterministic color per customer
  - Memoization: usedAvatarColors Map
  - **Bug Risk:** Map tidak di-clear → leak jika many unique customers
  
- `paginate(data, page)`: Calculate pagination (offset, totalPages)
  
- `renderPagination(containerId, page, totalPages, callback)`: Build pagination UI
  - **Bug Risk:** onclick callback string → tidak ES6 safe

---

### 3.4 `app.js` — Main Entry Point & Event Handlers

**Sections:**

#### A. Firebase Initialization
```javascript
// Requires global Firebase SDK (dari HTML <script>)
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, onSnapshot, doc, serverTimestamp } from "firebase/firestore";

// Config dari Firebase Console (tidak ada di codebase → pastikan di .env atau inline)
const firebaseConfig = { /* ... */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

**Issue:** Config tidak ada → Firebase tidak inisialisasi

#### B. Global Event Listeners
- Toast notifikasi system
- Modal open/close handlers
- Theme toggle (dark/light)
- Mobile nav toggle
- Design Order CRUD (Firebase Firestore)
- Production Order CRUD
- Invoice Builder & Exporter (html2canvas)

#### C. Design Orders Handlers
- `saveDesignOrder()`: Add/Update design order
  - Validate customer & design fields
  - Call updateDoc (edit) atau addDoc (new)
  - Reset form on success
  - **Bug:** designState.editId tidak di-reset jika error → state inconsistent
  
- `advanceDesignStage(id)`: Move stage forward (design → revisi → done)
  - **Bug:** Tidak check current stage first → could skip stages
  
- `prevDesignStage(id)`: Move stage backward
  
- `deleteDesignOrder(id)`: Delete dengan confirmation
  
- `openEditDesign(id)`: Load order into modal form

#### D. Production Orders Handlers (Similar pattern ke Design Orders)
- `addProductionItem()`: Dynamically add item row ke production form
- `saveProductionOrder()`: Validate + Firebase write
- `nextProductionStage()` / `prevProductionStage()`
- `deleteProductionOrder(id)`

#### E. Invoice Builder (KOMPLEKS)
```javascript
function generateInvoiceHTML(productionOrder) {
  // Create temporary DOM element
  // Populate dengan production order items
  // Use calculateInvoiceItem() untuk pricing breakdown
  // Return HTML string
}

function renderInvoicePreview(productionOrderId) {
  // Parse production order
  // Generate HTML
  // Inject ke #invoice-paper DOM
  // Show modal
}

async function exportInvoicePNG() {
  // Use html2canvas to capture #invoice-paper
  // Download as PNG (base64 → blob → download)
  // ISSUE: Mobile rendering issues (scale, DPI)
}

async function createInvoiceFromProduction(productionOrderId) {
  // Lookup production order
  // Save invoice doc ke Firestore
  // Link invoiceId ke production_orders
  // Show toast
}
```

**Bug Risks:**
- html2canvas canvas size dependency (retina displays, mobile zoom)
- Async rendering delay → user click "export" tapi belum selesai
- Invoice HTML hardcoded → tidak flexible untuk custom layout

#### F. Firebase Realtime Snapshots
```javascript
// Listen ke design_orders collection
onSnapshot(collection(db, "design_orders"), (snapshot) => {
  window.firebaseDesignOrders = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  // Trigger re-renders
  updateHero();
  renderDesignOrders();
  updatePipeline();
  updateCharts(window.firebaseDesignOrders);
});

// Same pattern untuk production_orders
```

**Issue:** Realtime snapshot update trigger ALL render functions (tidak selective) → performance issue dengan large datasets

---

### 3.5 `components/tracker.js` — Kanban & Pipeline Rendering

**Exports:**

#### `updateHero()`
- Update hero stats: active, production, done, overdue
- Real-time counter dari Firebase snapshots
- Format: `setText(elementId, value)`

#### `renderDesignOrders()` / `renderProductionOrders()`
- Main rendering function untuk table & mobile list
- **Features:**
  - Sort by stage (done last)
  - Sort by customer (optional A-Z)
  - Search filtering (customer, design, jenis, team, material)
  - Stage filtering (all, done, progress, overdue, urgent)
  - Pagination (5 items per page)
  - Deadline color coding (overdue red, urgent orange)
  - Avatar per customer (deterministic color)
  
- **Output:** Render table rows + mobile cards
- **Bug Risk:** 
  - Pagination state not synced → user click page 2, then filter changes, stays on page 2 (empty)
  - Search/filter tidak reset pagination ke page 1
  - Large datasets (100+ orders) → sluggish rendering dari DOM string concat

#### `filterByStage(stage)` / `filterProductionStage(stage)`
- Toggle stage filter
- Re-render orders + pipeline visual
- Update pipeline-step active state

#### `updatePipeline()` / `updateProductionPipeline()`
- Count orders per stage
- Update stage counters
- Visual indicator (active/done class)

#### State Objects
```javascript
export const designState = { editId: null, filter: "all", stageFilter: null };
export const prodState = { editId: null, filter: "all", stageFilter: null };
```

---

### 3.6 `components/costing.js` — Cost Calculator & Charts

**Exports:**

#### Material Calculation
- `hitungBahan()`: Calculate weight & cost per material type (BAHAN)
  - Return object: { milanoBerat, milanoKg, milanoPrint, milanoTotal, ... }
  - **Bug:** Tidak validate input ranges → negative values possible
  
- `hitungTambahan()`: Sum extra items (per-PCS costs)
  - Loop `.extra-item` → sum qty * harga

#### Main Calculation
- `hitung()`: Central calculation trigger
  1. Parse all inputs dari form
  2. Call `hitungBahan()`
  3. Calculate jahit total, ongkir, extras
  4. Sum ke grandTotal
  5. Calculate profit (hargaJual * pcs - grandTotal)
  6. Update ALL display elements (setText)
  7. Update charts
  8. Auto-save form
  
- **Bug Risk:**
  - No validation → NaN propagation jika invalid input
  - No error boundary → chart update fails silently
  - `pcs = 0` → divide by zero jika tidak handled (Math.max(1, pcs))

#### Extra Items Management
- `tambahItem(data)`: Add dynamic extra item row
  - DOM manipulation dengan innerHTML
  - Animation: fadeIn + translateY
  - Auto-focus first input
  - **Issue:** No unique ID per item → hard to track/delete
  
- `hapusItem(btn)`: Remove item dengan animation
  - 1050ms animation + smooth scroll
  - Re-calculate on done

#### History Management
- `renderCostingHistory()`: Paginated history table
  - Search by customer
  - Restore previous calculation (loadHistoryData)
  - Delete entry option
  
- `renderDesignHistory()` / `renderProductionHistory()`: Similar pattern

#### Charts (Chart.js)
- `costChart`: Pie chart breakdown (materials, jahit, ongkir, extras)
  - Re-render setiap calculation
  
- `pipeChart`: Pipeline stage count bar chart
  - Design stages vs Production stages
  
- `updateCostChart(data)`: Update chart data
  
- `updatePipelineChart()`: Update pipeline chart
  
- `setChartTheme(isDark)`: Toggle chart colors for dark mode
  
- **Bug Risk:**
  - Chart instance creation without destroy → memory leak
  - Theme toggle tidak update existing charts properly
  - Large datasets → chart render lag

#### Customer Sorting
- `customerSortModes`: { designOrder, productionOrder, history }
- `toggleCustomerSort()`: Toggle between default (date) dan A-Z sort

---

### 3.7 `components/tasks.js` — Daily To-Do List

**Exports:**
- `saveTask(text)`: Add new task, save to localStorage
  - Auto-focus on add
  - Autosave dengan storage.js
  
- `toggleTask(id)`: Mark task done/undone (checkbox)
  
- `deleteTask(id)`: Remove task
  
- `renderTaskList()`: Render task items dengan checkbox + delete button
  - Show completed count
  - Basic search filter

**Simple module, low bug risk.**

---

## 4. CRITICAL BUSINESS RULES & LOGIC

### 4.1 Pricing Matrix Lookup

**Rule 1: Jersey (Matrix Model)**
```
Lookup: products.jersey.matrix[category][materialGroup][orderType][sleeve]
- category: "ATASAN JERSEY" | "SETELAN JERSEY"
- materialGroup: "MILANO" | "EMBOSS" (dari material input)
- orderType: qty >= 12 ? "lusinan" : "satuan"
- sleeve: "pendek" | "panjang"
Result: Base price per unit
```

**Rule 2: Kaos/Kemeja (Tier Model)**
```
Lookup: products[type].tiers[materialSelected]
- Find tier where: qty >= min && qty <= max
Result: Price per unit matching tier
Fallback: Jika material tidak ada, use first tier
```

### 4.2 Invoice Item Pricing Breakdown

**Formula:**
```
hargaPerPcs = basePrice + materialPremium + addonCharges

subtotal = (hargaPerPcs * qty) + sizeCharges + customCharge

dpRequired = subtotal * dpRatio (default 0.5)
remainingPayment = subtotal - dpRequired

BONUS: Check jika qty >= minQty, then apply bonus
```

**Example:**
```
Jersey 12 pcs, Milano, Atasan, Pendek, Addon "lengan panjang", 2XL size charge
- basePrice = 85.000 (lusinan, Milano)
- materialPremium = 0
- addonCharge = 10.000
- nominalPerPcs = 95.000
- subtotalBefore = 95.000 * 12 = 1.140.000
- sizeCharge = 5.000 * 12 = 60.000
- customCharge = 0
- grandSubtotal = 1.140.000 + 60.000 = 1.200.000
- realHargaPerPcs = 1.200.000 / 12 = 100.000
- dpRequired = 1.200.000 * 0.5 = 600.000
- BONUS: qty 12 >= minQty 12 → apply "Free Sticker"
```

### 4.3 Costing (HPP Estimation)

**Formula:**
```
HPP = (Total Bahan Cost + Total Jahit Cost + Total Ongkir + Extras) / Total PCS

berat total = sum(pcs_material * material_kg * material_price)
print total = sum(pcs_material * material_print_rate)
jahit total = jahit_pcs * jahit_harga_pcs
ongkir = flat rate

grandTotal = berat + print + jahit + ongkir + extras
hppPcs = grandTotal / pcs
profit = (hargaJualPcs * pcs) - grandTotal
```

### 4.4 Stage Workflow Rules

**Design Order Stages:**
1. **design**: Desainer sedang membuat desain
2. **revisi**: Desain selesai tapi menunggu approval/revisi
3. **done**: Desain approved, siap produksi

**Production Order Stages:**
1. **design**: Persiapan desain (link ke design order)
2. **printing**: Tahap printing/sablon
3. **jahit**: Tahap penjahitan
4. **qc**: Quality control
5. **done**: Selesai, siap pengiriman

**Rules:**
- Stage hanya bisa forward atau backward (tidak skip)
- Tidak bisa back dari "done"
- Overdue detection: deadline < today && stage != "done"
- Urgent detection: deadline <= today + 2 hari && stage != "done"

### 4.5 Invoice & Production Order Relationship

**Link Model:**
```
production_order.invoiceId → invoices.id
invoices.productionId → production_orders.id
```

**Rules:**
- 1 production order → 1 invoice (1-to-1, not 1-to-many)
- Multiple items dalam production order → 1 invoice dengan multiple line items
- Invoice dapat dibuat dari production order atau standalone
- Once invoice created, invoiceId di production order diset (read-only)

---

## 5. KNOWN BUGS & EDGE CASES

### 5.1 Firestore/Realtime Sync Issues

**Bug 1: onSnapshot Callback Race Condition**
- **Symptom:** User add production order, but table doesn't update immediately
- **Cause:** onSnapshot callback tidak triggered instantly (network delay)
- **Fix:** Optimistic update: update local array BEFORE Firebase call, then sync on callback
- **Severity:** Medium (UX issue, data eventually consistent)

**Bug 2: Pagination State Not Synced After Filter**
- **Symptom:** User on page 2 of 5 orders, then apply filter that shows 3 orders → page 2 is empty
- **Cause:** Filter change tidak reset `pagination.designOrders = 1`
- **Fix:** Reset pagination page to 1 when filter/search changes
- **Severity:** Low (but annoying)

**Bug 3: Multiple Tab Sync Issue**
- **Symptom:** Update order in tab A, tab B doesn't refresh
- **Cause:** Firestore updates only in one tab (no cross-tab event)
- **Fix:** Add localStorage-based cross-tab sync or ignore (low priority)
- **Severity:** Low (not common use case)

### 5.2 Calculation & Pricing Bugs

**Bug 4: NaN Propagation in Material Calculation**
- **Symptom:** One invalid input → all calculations become NaN
- **Cause:** No validation in hitungBahan() → parseFloat() returns NaN
- **Fix:** Validate all numeric inputs in hitungBahan(), use Math.max(0, value)
- **Severity:** High (breaks app functionality)

**Bug 5: Tier Price Fallback Silently Fails**
- **Symptom:** User select material not in tiers → price shows 0 or wrong value
- **Cause:** getProductBasePrice fallback to first tier tidak match actual logic
- **Fix:** Explicit error message if material not found, ask user to select valid material
- **Severity:** Medium (silent data error)

**Bug 6: Size Charge Double-Applied**
- **Symptom:** In some flows, size charge calculated twice (in invoice + in production)
- **Cause:** Unclear which component responsible for size charge
- **Fix:** Standardize: size charge ONLY applied in calculateInvoiceItem(), not elsewhere
- **Severity:** Medium (financial impact)

**Bug 7: Zero Division Not Handled**
- **Location:** costing.js line 71 → `setText("hppPcs", rupiah(grandTotal / pcs));`
- **Symptom:** pcs = 0 → hppPcs = Infinity
- **Fix:** Add guard: `const hppPcs = pcs > 0 ? grandTotal / pcs : 0;`
- **Severity:** High

**Bug 8: Negative Values Allowed**
- **Symptom:** User can enter negative hargaJualPcs → negative profit
- **Cause:** No input type="number" min="0" constraint
- **Fix:** Add input validation: `Math.max(0, parseFloat(value))`
- **Severity:** Medium (business logic error)

### 5.3 DOM & Rendering Issues

**Bug 9: html2canvas Resolution on Mobile**
- **Symptom:** Exported invoice PNG blurry on high-DPI devices
- **Cause:** html2canvas default scale doesn't account for devicePixelRatio
- **Fix:** Pass `scale: window.devicePixelRatio` to html2canvas options
- **Severity:** Medium (UX issue, feature works)

**Bug 10: Chart Memory Leak**
- **Symptom:** App slows down after many calculations (chart update)
- **Cause:** Chart.js instances not destroyed before re-create
- **Fix:** Call `costChart.destroy()` before updating data
- **Severity:** Medium (affects long sessions)

**Bug 11: Event Delegation String Callbacks**
- **Symptom:** onclick="formatRibuan(this)" works but not ES6 safe
- **Cause:** Inline onclick handler → global function lookup (bad practice)
- **Fix:** Use modern addEventListener with proper scoping
- **Severity:** Low (technical debt, functional)

**Bug 12: localStorage Quota Overflow**
- **Symptom:** App crash if costing history too large
- **Cause:** No size check before saveHistory()
- **Fix:** Limit history to last 100 entries, clear old ones
- **Severity:** Medium (rare but critical when happens)

### 5.4 State Management Issues

**Bug 13: Inconsistent Form State Reset**
- **Symptom:** After save production order, form still shows old data
- **Cause:** Reset form tidak reset all related state (editId, stage filters)
- **Fix:** Centralize form reset function that clears all state
- **Severity:** Low (UX issue)

**Bug 14: Avatar Color Palette Map Not Cleared**
- **Symptom:** Memory usage increases with unique customer names (never freed)
- **Cause:** usedAvatarColors Map in utils.js never cleared
- **Fix:** Add periodic cleanup or use WeakMap (not applicable here, use Set + limit)
- **Severity:** Low (memory leak over very long sessions)

### 5.5 Mobile/Responsive Issues

**Bug 15: Touch Event Handling on Dropdown**
- **Symptom:** On mobile, dropdown menu don't close on tap outside
- **Cause:** Click event listener not accounting for touch
- **Fix:** Add touchend event listener alongside click
- **Severity:** Medium (mobile UX)

**Bug 16: Modal Scroll Lock Not Applied**
- **Symptom:** Background content scrollable when modal open
- **Cause:** No `body { overflow: hidden }` when modal open
- **Fix:** Add/remove overflow class on modal open/close
- **Severity:** Low (UX but not critical)

### 5.6 Firebase Configuration

**Bug 17: Missing Firebase Config**
- **Symptom:** App loads but no data → Firebase not initialized
- **Cause:** `firebaseConfig` not found in app.js (commented out or missing)
- **Fix:** Ensure firebaseConfig is available (via .env or constants)
- **Severity:** Critical (breaks entire app)

### 5.7 Async/Await Issues

**Bug 18: No Loading Indicator on Firebase Operations**
- **Symptom:** User click "Save" → think nothing happened
- **Cause:** async operations not show progress indicator
- **Fix:** Add button disabled state + loading spinner during Firestore calls
- **Severity:** Medium (UX issue)

**Bug 19: Error Handling Too Generic**
- **Symptom:** "Penyimpanan gagal, coba lagi" for all errors
- **Cause:** Catch block swallow actual error (Firebase auth, network, quota)
- **Fix:** Log actual error and provide specific user message
- **Severity:** Medium (debugging hard)

---

## 6. REFACTORING GUIDELINES

### 6.1 Code Quality Standards

#### Naming Conventions
- **Variables:** camelCase
  ```javascript
  const customerName = "John Doe";  // ✅ good
  const customer_name = "";         // ❌ avoid
  ```

- **Functions:** camelCase (actions)
  ```javascript
  export function renderDesignOrders() {}  // ✅ good
  export function designOrdersRender() {}  // ❌ ambiguous
  ```

- **Constants:** UPPER_SNAKE_CASE
  ```javascript
  export const DESIGN_STAGES = [...];  // ✅ good
  export const designStages = [...];   // ❌ should be constant
  ```

- **Classes/Constructors:** PascalCase (not used currently, but if added)
  ```javascript
  class ProductionOrder {}  // ✅ if needed
  ```

#### Module Organization
```
js/
├── database.js          // Pricing + constants (IMMUTABLE)
├── storage.js           // localStorage operations
├── utils.js             // Pure utility functions
├── app.js               // Main entry + Firebase init + top-level handlers
└── components/
    ├── tracker.js       // Kanban rendering + filtering
    ├── costing.js       // Cost calculation + charts
    └── tasks.js         // Task management
```

**Rule:** 1 file = 1 responsibility, max 500 lines (refactor if bigger)

#### Import/Export Structure
```javascript
// ✅ Good: Named exports (tree-shakeable)
export function hitung() {}
export const BAHAN = {};

// Importing
import { hitung, BAHAN } from "./database.js";

// ❌ Avoid: Default export mixed with named
export default { hitung };
export { BAHAN };
```

#### Comments & Documentation
- **Use comments for:** Complex business logic, workarounds, known limitations
- **Avoid comments for:** Obvious code (function name should be clear)

```javascript
// ✅ Good
// If qty >= 12, apply "lusinan" discount tier
const orderType = qty >= 12 ? "lusinan" : "satuan";

// ❌ Bad
// Set order type
const orderType = qty >= 12 ? "lusinan" : "satuan";
```

### 6.2 Performance Optimization

**Avoid:**
1. **Inefficient DOM Selectors**
   ```javascript
   // ❌ Bad: Query in loop
   for (let i = 0; i < 100; i++) {
     document.getElementById("result").textContent += data[i];
   }

   // ✅ Good: Batch DOM update
   const el = document.getElementById("result");
   el.textContent = data.join("");
   ```

2. **Unnecessary Re-renders**
   ```javascript
   // ❌ Bad: Render on every data change
   onSnapshot(collection(db, "orders"), () => {
     renderDesignOrders();
     renderProductionOrders();
     updateCharts();
     updateHero();
   });

   // ✅ Better: Selective render based on type
   onSnapshot(collection(db, "design_orders"), () => {
     renderDesignOrders();
     updateHero();
   });
   ```

3. **String Concatenation in Loops**
   ```javascript
   // ❌ Bad
   let html = "";
   for (let row of data) {
     html += `<tr>...</tr>`;  // String concat creates new string each iteration
   }
   tbody.innerHTML = html;

   // ✅ Good: Use array join
   const rows = data.map(row => `<tr>...</tr>`);
   tbody.innerHTML = rows.join("");
   ```

4. **Memory Leaks**
   ```javascript
   // ❌ Bad: Event listener never cleaned
   function addListener() {
     element.addEventListener("click", handler);  // Accumulates if called multiple times
   }

   // ✅ Good: Remove old listener
   function addListener() {
     element.removeEventListener("click", handler);
     element.addEventListener("click", handler);
   }
   ```

### 6.3 Backwards Compatibility

**Rules:**
- **Don't remove:** Existing function signatures without deprecation period
  ```javascript
  // OLD: calculateInvoiceItem(payload)
  // NEW: calculateInvoiceItem(payload, options = {})  // ✅ backwards compatible
  // NEW: calculateInvoiceItemV2(payload)              // ❌ breaks existing code
  ```

- **Add new features** without breaking existing logic
  ```javascript
  // ✅ Add optional param
  export function getProductBasePrice(productType, options = {}) {
    const newLogic = options.useNewCalculation ? ... : ...;
  }
  ```

- **Keep localStorage format** unchanged (or provide migration)
  ```javascript
  // If changing shape, migrate on load
  export function loadAuto() {
    let data = JSON.parse(localStorage.getItem(KEYS.autosave) || "{}");
    // Check old format, migrate if needed
    if (data.oldField) data.newField = data.oldField;
    return data;
  }
  ```

---

## 7. TESTING & QUALITY CHECKLIST

### 7.1 Manual Testing Checklist

**Design Orders**
- [ ] Add new design order with all fields
- [ ] Edit existing order (search first)
- [ ] Delete order (confirm dialog)
- [ ] Navigate through stages (design → revisi → done)
- [ ] Filter by stage, customer, overdue/urgent
- [ ] Pagination works correctly (page forward/back, search updates page)
- [ ] Deadline calculation correct (overdue red, urgent orange)

**Production Orders**
- [ ] Add order with multiple items
- [ ] Each item has correct pricing breakdown
- [ ] Edit production order
- [ ] Advance stages correctly
- [ ] Link to invoice (create, edit, view)
- [ ] Filter/search works
- [ ] Pagination works

**Invoice Builder**
- [ ] Create invoice from production order
- [ ] All items calculate correct price (base + addons + size)
- [ ] DP calculation correct (50% default)
- [ ] Export to PNG (check mobile resolution)
- [ ] Invoice number auto-generated (INV-YYYYMMDD-###)

**Costing Calculator**
- [ ] Add extra items (name, qty, price)
- [ ] Calculation accurate (material + jahit + ongkir + extras = grandTotal)
- [ ] HPP per pcs correct (grandTotal / pcs)
- [ ] Profit calculation (jualTotal - grandTotal)
- [ ] Save history (loadable later)
- [ ] Autosave works (leave form, refresh, data restored)

**UI/UX**
- [ ] Mobile layout responsive (test 480px, 768px, 1200px)
- [ ] Dark mode toggle (all colors update)
- [ ] Toast notifications show/hide correctly
- [ ] Modal dialogs close properly
- [ ] Search/filter input responsive
- [ ] Tables sortable by customer (A-Z toggle)

**Performance**
- [ ] Load 100+ design orders → table updates smoothly
- [ ] Calculate 50+ costing history → no lag
- [ ] Charts render quickly (< 1s)
- [ ] Export PNG < 3s on desktop, < 5s on mobile

### 7.2 Automated Testing (if applicable)

**Unit Tests (Jest + DOM testing library)**
```javascript
// Example: test calculateInvoiceItem
describe("calculateInvoiceItem", () => {
  test("jersey 12 pcs Milano", () => {
    const result = calculateInvoiceItem({
      productType: "jersey",
      category: "ATASAN JERSEY",
      material: "Milano",
      qty: 12,
      sleeve: "pendek",
      sizeDistribution: { M: 12 },
      addonsSelected: [],
      customCharge: 0,
    });
    expect(result.basePricePerPcs).toBe(85000);
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.dpRequired).toBe(result.subtotal * 0.5);
  });

  test("zero qty returns zero prices", () => {
    const result = calculateInvoiceItem({
      productType: "jersey",
      qty: 0,
      // ...
    });
    expect(result.calculatedHargaPerPcs).toBe(0);
  });
});
```

**Integration Tests**
```javascript
// Test Firebase sync + render flow
describe("Firestore onSnapshot → renderDesignOrders", () => {
  test("new order appears in table", async () => {
    // Add order via Firebase
    // Wait for onSnapshot callback
    // Check DOM contains new row
  });
});
```

### 7.3 Code Review Checklist

**Before Merge:**
- [ ] All function exports documented (params, return)
- [ ] No hardcoded values (use CONSTANTS)
- [ ] Error handling present (try-catch or error boundary)
- [ ] No console.log() left (use proper logging)
- [ ] Mobile tested (Chrome DevTools device emulator)
- [ ] No breaking changes to exports
- [ ] localStorage quota impact considered
- [ ] Accessibility checked (keyboard nav, ARIA labels)

---

## 8. FEATURE DEVELOPMENT INSTRUCTIONS

### 8.1 How to Brief OpenCode for New Features

**Format:**
```markdown
# Feature: [Feature Name]

## Description
[What feature does, who uses it, why]

## Requirements
- [ ] Req 1: ...
- [ ] Req 2: ...
- [ ] Req 3: ...

## Acceptance Criteria
- [ ] Scenario 1: Given X, When Y, Then Z
- [ ] Scenario 2: ...

## Data Model Changes (if any)
```javascript
// New fields to add to production_orders:
{
  newField: Type,
  ...
}
```

## Implementation Notes
- Affected modules: [ tracker.js, database.js ]
- Backwards compatibility: Yes/No
- Database migration needed: Yes/No

## Testing
- Manual test cases: [...]
- Edge cases to check: [...]
```

### 8.2 Example: Adding Size Presets Feature

```markdown
# Feature: Size Presets for Quick Order Entry

## Description
Pre-fill size distribution for common templates (e.g., "12-pcs Standard" = 2S, 3M, 4L, 2XL, 1XXL).
Reduces manual entry errors and speeds up production order creation.

## Requirements
1. Admin create size preset (name, distribution)
2. Dropdown on production order form to select preset
3. Populate sizeDistribution automatically
4. Store presets in localStorage or Firestore

## Affected Modules
- app.js: Add modal for preset management
- database.js: Define PRESET structure or Firestore schema
- tracker.js (production): Add dropdown selector

## Implementation Steps
1. Define preset schema:
```javascript
// In database.js
export const SIZE_PRESETS = {
  standardSmall: { name: "Small Set", sizes: { S: 2, M: 3, L: 4 } },
  standardLarge: { name: "Large Set", sizes: { L: 4, XL: 5, "2XL": 3 } },
};
```

2. Add UI: Modal untuk manage presets
3. Add function: `applyPreset(presetName)` → populate form
4. Test: All preset sizes calculate correctly in invoice
```

### 8.3 Example: Adding Discount Rules Feature

```markdown
# Feature: Volume Discounts

## Description
Apply automatic discounts based on total order quantity or repeat customer status.
E.g., 50+ pcs = 5% discount, 100+ pcs = 10% discount, VIP customer = 15% flat.

## Business Rules
- Discount applied AFTER base price + addons (not on materials)
- DP amount also discounted
- Cannot combine with other discounts (max 1 per order)

## Data Model
```javascript
// In production_orders (new field)
{
  discountType: "volume" | "customer_vip" | "promotional_code" | null,
  discountPercentage: Number (0-100),
  discountAmount: Number (calculated),
}

// In MASTER_PRICE_DATABASE (new)
export const VOLUME_DISCOUNTS = {
  tiered: [
    { minQty: 50, maxQty: 99, discount: 0.05 },
    { minQty: 100, maxQty: 499, discount: 0.10 },
    { minQty: 500, discount: 0.15 },
  ]
};

export const CUSTOMER_VIPS = [
  { name: "John Doe", discountPercentage: 0.15 }
];
```

## Implementation
1. Modify `calculateInvoiceItem()`:
   ```javascript
   // After calculating subtotal, apply discount
   let discountedSubtotal = subtotal;
   if (options.discountType === "volume") {
     const discountRate = getVolumeDiscount(qty);
     const discountAmount = subtotal * discountRate;
     discountedSubtotal = subtotal - discountAmount;
   }
   ```

2. Add dropdown in invoice form: "Select discount type"
3. Display discount amount on invoice

## Testing
- Order 50 pcs → 5% discount applied correctly
- Order 100 pcs → 10% applied
- Discount correctly reflected in DP & remaining payment
- Mix discount + custom charge → priority correct
```

### 8.4 Common Development Workflows

#### Workflow A: Add New Field to Production Order

1. **Update schema** (database.js or docs)
   ```javascript
   // Add to production_orders doc structure
   {
     newField: Type,
   }
   ```

2. **Update form** (index.html)
   ```html
   <input id="prod-newfield" type="text" class="input" />
   ```

3. **Update handler** (app.js → saveProductionOrder)
   ```javascript
   async function saveProductionOrder() {
     const newField = document.getElementById("prod-newfield").value;
     const data = { customer, ..., newField };
     await addDoc(collection(db, "production_orders"), data);
   }
   ```

4. **Update render** (tracker.js → renderProductionOrders)
   ```javascript
   // Add column to table
   <td>${o.newField || "-"}</td>
   ```

5. **Test:** Create order with new field, check Firestore doc, verify render

#### Workflow B: Add Calculation to Invoice

1. **Update calculateInvoiceItem** (database.js)
   ```javascript
   export function calculateInvoiceItem(orderPayload) {
     // ... existing code ...
     const newCalculation = ... // your logic
     return {
       ...existing,
       newField: newCalculation,
     };
   }
   ```

2. **Update invoice template** (app.js → generateInvoiceHTML)
   ```javascript
   // Add line to invoice
   <tr><td>New Item</td><td>${invoice.newField}</td></tr>
   ```

3. **Update preview modal** (index.html → modal-invoice)
   ```html
   <div id="invoice-newfield">—</div>
   ```

4. **Update renderer** (app.js → renderInvoicePreview)
   ```javascript
   setText("invoice-newfield", rupiah(invoice.newField));
   ```

5. **Test:** Create invoice, check calculation & preview, export PNG

#### Workflow C: Debug Calculation Bug

1. **Identify bug** (e.g., "Jersey 12 pcs showing wrong price")
2. **Trace flow:**
   - Check input values (qty, material, category, sleeve)
   - Call calculateInvoiceItem() with same inputs
   - Verify MASTER_PRICE_DATABASE lookup
   - Check addon/size charges
   - Verify DP ratio applied
3. **Add console.log at each step:**
   ```javascript
   console.log("Input:", orderPayload);
   console.log("Base price:", basePrice);
   console.log("Addon charges:", totalAddonChargePerPcs);
   console.log("Size charges:", totalSizeChargeForGroup);
   console.log("Final:", grandSubtotalItem);
   ```
4. **Verify in Firestore:** Check saved value vs calculated
5. **Write test case** to prevent regression

---

## 9. SETUP & DEPLOYMENT

### 9.1 Local Development

```bash
# 1. Clone repository
git clone <repo-url>
cd progress-workspace-baru

# 2. Ensure Firebase config is set
# Create js/firebase-config.js or inline in app.js:
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "...",
  projectId: "...",
  // ...
};

# 3. Serve locally (Python)
python3 -m http.server 8000

# 4. Open browser
http://localhost:8000
```

### 9.2 Firebase Setup Checklist

- [ ] Create Firebase project in console
- [ ] Enable Firestore Database (Production mode)
- [ ] Create collections: `design_orders`, `production_orders`, `invoices`, `costing_history`
- [ ] Set Firestore rules (allow authenticated or public read/write for dev):
  ```
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ DEV ONLY
    }
  }
  ```
- [ ] Get Firebase config, add to app.js
- [ ] Test Firestore connectivity (inspect Network tab)

### 9.3 Deployment

**Static hosting (Firebase Hosting, Netlify, Vercel):**
1. Build not needed (Vanilla JS)
2. Deploy html + js + css + assets
3. Ensure Firebase config available (via .env or secrets)
4. Test all features post-deployment

---

## 10. GLOSSARY & ABBREVIATIONS

| Term | Meaning |
|------|---------|
| HPP | Harga Pokok Penjualan (Cost of Goods Sold) |
| DP | Down Payment (uang muka, typically 50%) |
| PCS | Pieces (jumlah barang) |
| DTF | Direct-to-Film printing |
| Kanban | Visual workflow board (design → revisi → done) |
| Realtime Sync | Firebase onSnapshot updates |
| Mobile-First | Design starts at 480px, scales up |
| ESM | ES Modules (import/export) |
| localStorage | Browser client-side storage |
| Firestore | Firebase NoSQL database |
| Margin/Profit | Revenue - Cost |

---

## 11. SUPPORT & ESCALATION

### When to Contact OpenCode:
- **Bug fix:** Description + reproduction steps + affected module
- **Feature request:** Requirements + acceptance criteria (use format in 8.1)
- **Performance issue:** Profiling data (DevTools Performance tab)
- **Data inconsistency:** Firestore doc export + browser console logs

### Provide Context:
- Exact error message + stack trace
- Browser + device (Chrome Desktop / Safari Mobile)
- Steps to reproduce
- Expected vs actual behavior
- Related modules/files

---

## 12. FINAL CHECKLIST BEFORE LAUNCH

- [ ] Firebase config set & tested
- [ ] All Firestore collections created & indexed
- [ ] Design orders CRUD working (add/edit/delete/stage advance)
- [ ] Production orders CRUD working (items, pricing, invoices)
- [ ] Invoice generation & PNG export tested on mobile & desktop
- [ ] Costing calculator accurate (test with known examples)
- [ ] Charts render correctly (desktop & mobile)
- [ ] Dark mode toggle working
- [ ] Mobile navigation responsive
- [ ] Toast notifications display
- [ ] localStorage autosave working
- [ ] Pagination working (all views)
- [ ] Search/filter working
- [ ] Performance acceptable (no lag with 100+ items)
- [ ] All edge cases tested (zero qty, negative values, missing data)
- [ ] No console errors
- [ ] Accessibility checked (keyboard nav, screen reader)
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-11  
**Status:** Ready for OpenCode

---

*This document is a living guide. Update as new bugs found, features added, or patterns emerge.*
