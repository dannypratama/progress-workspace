# Progress Printshop Workspace — Debugging & Troubleshooting Guide

---

## 🔍 COMMON ISSUES & QUICK FIXES

### Issue 1: "App loads but no data shows"

**Symptoms:**
- Page loads, hero section empty
- All tables empty (No orders)
- Network tab shows no Firestore calls

**Diagnosis Steps:**
```javascript
// 1. Check if Firebase initialized
console.log("Firebase DB:", db);  // Should not be undefined
// If undefined → Firebase config not loaded

// 2. Check if onSnapshot registered
console.log("Design orders:", window.firebaseDesignOrders);  // Should be array
// If undefined → onSnapshot callback not fired

// 3. Check Firestore collections exist
// Go to Firebase Console → Firestore → check collections created
```

**Fix:**
1. Verify Firebase config in app.js:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_ID",
     appId: "YOUR_ID"
   };
   ```

2. Check Firestore rules allow reads (dev mode):
   ```
   match /{document=**} {
     allow read: if true;
   }
   ```

3. Check browser console for errors (F12 → Console tab)

---

### Issue 2: "Added order but table doesn't update"

**Symptoms:**
- Click "Save" → Toast shows "Pesanan bertambah"
- But order not visible in table
- Firestore doc exists (checked console)

**Diagnosis:**
```javascript
// 1. Check onSnapshot fired
// Add log to onSnapshot callback in app.js
onSnapshot(collection(db, "design_orders"), (snapshot) => {
  console.log("onSnapshot fired, docs:", snapshot.size);  // Should log
  window.firebaseDesignOrders = snapshot.docs.map(...);
});

// 2. Check if renderDesignOrders called
console.log("Before render:", window.firebaseDesignOrders.length);
renderDesignOrders();
console.log("After render, DOM rows:", document.querySelectorAll("#design-tbody tr").length);
```

**Root Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| onSnapshot callback hasn't fired yet (network delay) | Wait 1-2s, page should update automatically |
| renderDesignOrders() not called in onSnapshot | Add `renderDesignOrders()` to onSnapshot callback |
| Table tbody element missing (id="design-tbody") | Check index.html has correct element IDs |
| Filter hiding the new order | Check filter/search state: `designState.filter`, `designState.stageFilter` |
| Pagination on page 2, new item on page 1 | Reset pagination: `pagination.designOrders = 1` on new data |

---

### Issue 3: "Invoice calculation wrong price"

**Symptoms:**
- Jersey 12 pcs showing Rp100.000 each, but should be Rp85.000
- Custom charge not included
- Size charges calculated twice

**Diagnosis:**
```javascript
// Add logging to calculateInvoiceItem
export function calculateInvoiceItem(orderPayload) {
  const { productType, category, material, qty, sleeve, sizeDistribution, addonsSelected, customCharge } = orderPayload;
  
  console.log("=== Invoice Calc ===");
  console.log("Input:", { productType, category, material, qty, sleeve });
  
  const basePrice = getProductBasePrice(productType, { qty, material, category, sleeve });
  console.log("Base price:", basePrice);
  
  // ... rest of function
  
  console.log("Final subtotal:", grandSubtotalItem);
  return { ... };
}

// Then call with problematic order:
const result = calculateInvoiceItem({
  productType: "jersey",
  category: "ATASAN JERSEY",
  material: "Milano",
  qty: 12,
  sleeve: "pendek",
  sizeDistribution: { S: 2, M: 3, L: 4, XL: 3 },
  addonsSelected: [],
  customCharge: 0,
});
console.log("Result:", result);
```

**Common Root Causes:**

1. **Wrong material selected**
   - Symptom: Price from different material tier
   - Fix: Verify material.toUpperCase() matches MASTER_PRICE_DATABASE.tiers keys
   
2. **Qty triggering wrong tier**
   - Symptom: Qty 11 showing "lusinan" price
   - Fix: Check tier boundary in findTierPrice()
   ```javascript
   // Debug: print all tiers
   const tiers = MASTER_PRICE_DATABASE.products.jersey.tiers[material];
   console.log("All tiers:", tiers);
   tiers.forEach(t => {
     if (qty >= t.min && qty <= t.max) console.log("MATCH:", t);
   });
   ```

3. **Addon not found in database**
   - Symptom: Addon selected but no charge added
   - Fix: Check addon name exact match (case-sensitive after toLowerCase)
   ```javascript
   const searchName = "lengan panjang".toLowerCase();
   const found = MASTER_PRICE_DATABASE.addons.jersey.model[searchName];
   console.log("Addon found:", found);  // undefined if not match
   ```

4. **Size charge applied twice**
   - Symptom: 2XL charge (5.000) × qty (12) = 60.000 BUT charged twice
   - Fix: Check if size charge in sizeDistribution OR somewhere else
   ```javascript
   // Only apply size charge if sizeDistribution provided
   let totalSizeChargeForGroup = 0;
   if (sizeDistribution && typeof sizeDistribution === "object") {
     // Calculate once only
   }
   ```

---

### Issue 4: "Export invoice PNG blurry on mobile"

**Symptoms:**
- Desktop export looks good (sharp text)
- Mobile export blurry or too small
- High-DPI device (iPhone Retina) especially affected

**Root Cause:**
html2canvas default scale doesn't account for devicePixelRatio.

**Fix:**
In app.js → exportInvoicePNG():
```javascript
async function exportInvoicePNG() {
  const element = document.getElementById("invoice-paper");
  const canvas = await html2canvas(element, {
    scale: window.devicePixelRatio,  // ← ADD THIS
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff"
  });
  
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `invoice-${Date.now()}.png`;
  link.click();
}
```

**Alternative:** If still blurry, increase scale:
```javascript
scale: window.devicePixelRatio * 2,  // 2x scaling
```

---

### Issue 5: "Calculations show NaN"

**Symptoms:**
- All prices show NaN
- Grand total shows NaN
- Chart breaks

**Diagnosis:**
```javascript
// Check where NaN comes from
const pcs = parseFloat(document.getElementById("pcs")?.value) || 0;
console.log("PCS value:", pcs);
if (isNaN(pcs)) console.log("ERROR: pcs is NaN!");

const hargaJual = angka(document.getElementById("hargaJualPcs")?.value || "0");
console.log("Harga jual:", hargaJual, "isNaN?", isNaN(hargaJual));
```

**Common Causes:**

1. **Invalid material selected**
   ```javascript
   // In hitungBahan(), check each material calculation
   const milanoBerat = hitungBahan().milanoBerat;
   console.log("Milano berat:", milanoBerat);  // Check if NaN
   ```

2. **Input field not found**
   ```javascript
   const pcs = document.getElementById("pcs");
   if (!pcs) console.error("Element #pcs not found!");
   ```

3. **angka() function failed to parse**
   ```javascript
   // Test angka function
   console.log(angka("100.000"));  // Should be 100000
   console.log(angka("abc"));      // Should be 0
   console.log(angka(""));         // Should be 0
   ```

**Fix:**
Add validation in hitung() function:
```javascript
export function hitung() {
  const pcs = parseFloat(document.getElementById("pcs")?.value) || 1;
  if (isNaN(pcs) || pcs < 0) {
    console.error("Invalid PCS value:", pcs);
    return;  // Stop calculation
  }
  
  const hargaJual = angka(document.getElementById("hargaJualPcs")?.value || "0");
  if (isNaN(hargaJual)) {
    console.error("Invalid harga jual");
    return;
  }
  
  // ... rest of hitung
}
```

---

### Issue 6: "Dropdown/Modal not closing on mobile"

**Symptoms:**
- Click dropdown → menu opens
- Tap outside → menu stays open
- Must click menu button again to close

**Root Cause:**
Click event listeners don't account for touch events.

**Fix:**
In app.js, update event listener:
```javascript
// Old (click only)
document.addEventListener("click", function (e) {
  const modal = e.target.closest(".modal");
  if (!modal) return;
  modal.classList.remove("open");
});

// New (click + touchend)
document.addEventListener("click touchend", function (e) {
  const modal = e.target.closest(".modal");
  if (!modal) return;
  if (e.target !== modal) return;
  modal.classList.remove("open");
}, true);
```

Similarly for dropdowns:
```javascript
document.addEventListener("click touchend", function (e) {
  const menu = document.getElementById("nav-add-menu");
  if (menu && !e.target.closest(".nav-add-dropdown")) {
    menu.classList.remove("open");
  }
});
```

---

### Issue 7: "Form data lost when refresh"

**Symptoms:**
- Filled form with data
- Refresh page (F5)
- Form empty (autosave didn't work)

**Diagnosis:**
```javascript
// Check if autosave ran
console.log("localStorage autosave key:", localStorage.getItem("progress_autosave"));

// Load and check content
const saved = JSON.parse(localStorage.getItem("progress_autosave") || "{}");
console.log("Saved data:", saved);
```

**Root Causes:**

1. **loadAuto() never called on page load**
   - Check app.js → should have `loadAuto()` call at startup
   
2. **saveAuto() debounce timer not firing**
   - Change hasn't happened in last 800ms before refresh
   - Fix: Move debounce to 300ms or call saveAuto() on blur
   
3. **localStorage quota exceeded**
   ```javascript
   try {
     localStorage.setItem("test", "test");
   } catch (e) {
     console.error("localStorage quota exceeded:", e);
   }
   ```

**Fix:**
Ensure in app.js:
```javascript
// On app init
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadAuto();  // ← Restore form
  renderTaskList();
  // ... firebase setup
});

// On blur, force save (don't wait for debounce)
document.addEventListener("blur", saveAuto, true);
```

---

### Issue 8: "Firestore read quota exceeded"

**Symptoms:**
- App worked yesterday, today showing quota error
- Production orders stopped syncing
- Firebase console shows "Quota exceeded"

**Diagnosis:**
```javascript
// Check how many onSnapshot listeners active
// Each render re-attach should be fixed
// Count: onSnapshot should be 1 per collection, not per render
```

**Root Cause:**
Multiple onSnapshot calls without cleanup.

**Fix:**
Ensure onSnapshot registered ONCE on app load:
```javascript
// app.js - ADD THIS ONCE in DOMContentLoaded
let designSnapshotUnsubscribe;
let productionSnapshotUnsubscribe;

document.addEventListener("DOMContentLoaded", () => {
  // Only register once
  if (!designSnapshotUnsubscribe) {
    designSnapshotUnsubscribe = onSnapshot(
      collection(db, "design_orders"),
      (snapshot) => {
        window.firebaseDesignOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        renderDesignOrders();
        updatePipeline();
        updateHero();
      }
    );
  }
  
  if (!productionSnapshotUnsubscribe) {
    productionSnapshotUnsubscribe = onSnapshot(
      collection(db, "production_orders"),
      (snapshot) => {
        window.firebaseProductionOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        renderProductionOrders();
        updateProductionPipeline();
        updateHero();
      }
    );
  }
});
```

---

## 🧪 DEBUGGING TECHNIQUES

### Technique 1: Console Logging Trail
```javascript
export function complexFunction(input) {
  console.log("→ Enter with:", input);
  
  const step1 = calculateStep1(input);
  console.log("  Step 1 result:", step1);
  
  const step2 = calculateStep2(step1);
  console.log("  Step 2 result:", step2);
  
  console.log("← Return:", step2);
  return step2;
}

// Call and check console
```

### Technique 2: Browser DevTools Breakpoints
1. F12 → Sources tab
2. Click line number to set breakpoint
3. Refresh page or trigger action
4. Execution pauses at breakpoint
5. Inspect variables in "Scope" panel
6. Step through with F10 (next line) or F11 (into function)

### Technique 3: Performance Profiling
```javascript
// Measure function execution time
console.time("renderDesignOrders");
renderDesignOrders();
console.timeEnd("renderDesignOrders");
// Output: renderDesignOrders: 125.45ms
```

### Technique 4: Network Monitoring
1. F12 → Network tab
2. Perform action (save order, load page)
3. Check:
   - **Firestore read** (graphql request) → Status 200
   - **Response** → Check data structure
   - **Timing** → How long took

### Technique 5: localStorage Inspection
```javascript
// Browser DevTools → Application tab → Local Storage
// Or in console:
Object.keys(localStorage).forEach(key => {
  console.log(key, ":", JSON.parse(localStorage.getItem(key)));
});
```

---

## 🚨 ERROR MESSAGES & MEANINGS

| Message | Cause | Fix |
|---------|-------|-----|
| "Penyimpanan gagal, coba lagi" | Firebase write failed (auth, network, quota) | Check Firebase console, network tab, try again later |
| "Lengkapi nama pelanggan dan desain" | Required fields empty | Fill in all marked fields |
| "Form tidak valid" | Validation error | Check form data, try different input |
| "Akses ditolak" | Firestore permission denied | Check rules in Firebase console |
| "Koneksi terputus" | No network | Check internet connection |
| NaN in calculations | Invalid numeric input | Check input fields have valid numbers |
| Chart doesn't render | Chart.js error or missing canvas | Check console for errors, ensure #cost-chart exists |

---

## 📊 PERFORMANCE DEBUGGING

### Slow Table Rendering
```javascript
// Measure
console.time("renderDesignOrders");
renderDesignOrders();
console.timeEnd("renderDesignOrders");

// If > 500ms:
// 1. Check dataset size (window.firebaseDesignOrders.length)
// 2. Check filter complexity
// 3. Consider virtual scrolling if 100+ rows
```

### Slow Charts
```javascript
console.time("updateCharts");
updateCharts(window.firebaseDesignOrders);
console.timeEnd("updateCharts");

// If > 300ms:
// 1. Destroy old chart first (costChart.destroy())
// 2. Reduce dataset if possible
// 3. Consider async chart update
```

### Memory Leak Detection
1. DevTools → Memory tab
2. Take heap snapshot (baseline)
3. Perform action multiple times
4. Take another snapshot
5. Compare: if growing → memory leak
6. Check for:
   - Undestroyed event listeners
   - Circular references
   - Uncleared timers/intervals

---

## 🔧 TESTING PROCEDURES

### Test Scenario: Add & Display Order

```
1. Clear Firestore (delete all design_orders docs)
2. Open app, verify table empty
3. Click "Tambah Pesanan Desain"
4. Fill: Customer=John, Design=Logo, Jenis=Kaos
5. Click Save
6. Check:
   - Toast shows "Pesanan desain bertambah"
   - Table updates within 2s
   - New row visible with correct data
   - Hero stats updated (active orders +1)
```

### Test Scenario: Costing Calculation

```
1. Enter: pcs=10, hargaJualPcs=150000
2. Select materials: Milano=1
3. Add extra: Jahit pcs=10, harga=5000/pcs
4. Verify:
   - Milano weight calculated
   - Jahit total = 10 × 5000 = 50.000
   - Grand total visible
   - HPP per pcs = grandTotal / 10
   - Profit = (150000 × 10) - grandTotal
   - All values NOT NaN
5. Refresh page
6. Verify form data restored (autosave)
```

### Test Scenario: Invoice Export

```
1. Create production order with 2 items (jersey + kaos)
2. Click "Buat Invoice"
3. Modal opens, invoice preview shows both items
4. Check calculations:
   - Base price correct per item
   - Size charges applied
   - DP = 50% of total
5. Click "Ekspor PNG"
6. PNG downloaded
7. Open PNG in image viewer
8. Check:
   - Text readable (not blurry)
   - All items visible
   - Numbers formatted correctly (Rp with dots)
```

---

## 📝 LOGGING BEST PRACTICES

**Good:**
```javascript
console.log("Design orders count:", designOrders.length);
console.log("Filter applied:", designState.filter, "Stage:", designState.stageFilter);
console.log("Calculation result:", { subtotal, dp, remaining });
```

**Bad:**
```javascript
console.log("data");  // Unclear
console.log(a, b, c);  // No context
console.log("Debug", result);  // Too generic
```

**Best for Production:**
```javascript
// Use named log levels
const DEBUG = process.env.DEBUG === "true";
if (DEBUG) console.log("[TRACKER]", "Rendering", orders.length, "orders");

// Or remove all console.log before deploying
// Use build tool to strip them
```

---

## 🎯 WHEN TO ESCALATE

**Escalate to OpenCode if:**
1. Issue persists after trying above fixes
2. Console shows no errors but bug still exists
3. Firestore data correct but UI doesn't update
4. Performance issue affects 100+ items
5. Business logic seems wrong (pricing calculation)

**Provide:**
- Exact reproduction steps
- Screenshot/video of issue
- Browser console output (F12 → Console)
- Firestore doc export (if data issue)
- User flow: what did you do before bug occurred

---

**Last Updated:** 2026-08-11
