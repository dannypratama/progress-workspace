# OpenCode — Quick Reference & Command Format

Gunakan format ini saat memberikan perintah spesifik ke OpenCode.

---

## 📋 COMMAND TEMPLATES

### Template 1: Bug Fix

```
TASK: Fix [Bug Name]
SEVERITY: [Critical | High | Medium | Low]
AFFECTED FILE: [database.js | app.js | tracker.js | etc]

CURRENT BEHAVIOR:
[Describe what happens now]

EXPECTED BEHAVIOR:
[Describe what should happen]

REPRODUCTION STEPS:
1. [Step 1]
2. [Step 2]
3. [Step 3]

ROOT CAUSE (if known):
[Point to specific line/function if possible]

SUGGESTED FIX:
[Outline approach, code snippet if helpful]

TESTING:
[ ] Test case 1
[ ] Test case 2
```

**Example:**
```
TASK: Fix NaN in HPP calculation when pcs=0
SEVERITY: High
AFFECTED FILE: costing.js, line 71

CURRENT BEHAVIOR:
User enters qty (pcs) = 0
Click calculate → hppPcs shows "NaN Rp"

EXPECTED BEHAVIOR:
hppPcs should show "Rp0" or empty

REPRODUCTION:
1. Clear all inputs
2. Leave pcs field empty (defaults to 0)
3. Click hitung button or change material field
4. See hppPcs shows NaN

ROOT CAUSE:
Line 71: setText("hppPcs", rupiah(grandTotal / pcs));
Division by zero: grandTotal / 0 = Infinity → rupiah(Infinity) = NaN

SUGGESTED FIX:
const hppPcs = pcs > 0 ? grandTotal / pcs : 0;
setText("hppPcs", rupiah(hppPcs));

TESTING:
[ ] pcs=0 shows Rp0
[ ] pcs=1 shows correct value
[ ] pcs=100 shows correct value
```

---

### Template 2: Feature Request

```
FEATURE: [Feature Name]

DESCRIPTION:
[1-2 sentences what user wants to do]

USER STORY:
As a [user role],
I want to [action],
So that [benefit]

ACCEPTANCE CRITERIA:
- [ ] Criterion 1: [Specific, testable outcome]
- [ ] Criterion 2: ...
- [ ] Criterion 3: ...

AFFECTED MODULES:
[app.js, database.js, tracker.js | or "New file"]

DATA CHANGES (if any):
[Describe new fields, collections, or schema changes]

EDGE CASES TO CONSIDER:
1. [Edge case 1]
2. [Edge case 2]

PRIORITY:
[Critical | High | Medium | Low]

ESTIMATED EFFORT:
[1 hour | 4 hours | 1 day | etc]
```

**Example:**
```
FEATURE: Size Preset Templates

DESCRIPTION:
Users can save common size distributions as reusable presets to speed up order entry.

USER STORY:
As a production manager,
I want to select a size preset instead of manually entering 12 sizes,
So that I can create production orders 3x faster

ACCEPTANCE CRITERIA:
- [ ] Admin can create preset with name + size distribution
- [ ] Dropdown shows all presets on production order form
- [ ] Selecting preset auto-fills sizeDistribution array
- [ ] Presets saved to localStorage and persist across sessions
- [ ] User can delete preset
- [ ] Preset appears in invoice calculations correctly

AFFECTED MODULES:
app.js (modal + handlers), tracker.js (production form), database.js (new PRESETS constant)

DATA CHANGES:
Add to localStorage:
{
  "progress_size_presets": [
    { id: 1, name: "Small Set", distribution: { S: 2, M: 3, L: 4 } },
    { id: 2, name: "Large Set", distribution: { L: 4, XL: 5, XXL: 3 } }
  ]
}

EDGE CASES:
1. User create preset, then close tab → preset should persist
2. User create preset with invalid size (e.g., typo in size name) → validation
3. User apply preset, then manually change one size → both should work together

PRIORITY: Medium
ESTIMATED EFFORT: 4 hours
```

---

### Template 3: Refactoring

```
REFACTORING: [Component Name]

CURRENT STATE:
[Describe current implementation, pain points]

PROBLEMS:
- [ ] Problem 1
- [ ] Problem 2
- [ ] Problem 3

PROPOSED SOLUTION:
[High-level refactor approach]

AFFECTED FILES:
[List files that will change]

BACKWARDS COMPATIBILITY:
[Will existing code break? Yes/No, explain]

TESTING:
[Ensure all existing features still work]

BEFORE EXAMPLE:
[Show old code]

AFTER EXAMPLE:
[Show new code]
```

**Example:**
```
REFACTORING: Consolidate onSnapshot listeners in app.js

CURRENT STATE:
Multiple onSnapshot calls attached in different places:
- DOMContentLoaded → design_orders snapshot
- After theme toggle → re-attach listeners
- Each render function might attach new listener

This causes:
1. Multiple listeners accumulating (quota waste)
2. Race conditions (multiple listeners firing asynchronously)
3. Hard to debug which listener updating which data

PROBLEMS:
- [ ] Firebase quota exceeded errors when many listeners open
- [ ] Unpredictable render order (which data updates first)
- [ ] Memory leaks (listeners never cleaned up)

PROPOSED SOLUTION:
1. Create singleton SnapshotManager class/module
2. Register listeners ONCE in DOMContentLoaded
3. Store unsubscribe functions for cleanup
4. Listeners only in this manager, render functions only consume data

AFFECTED FILES:
app.js (main refactor)

BACKWARDS COMPATIBILITY:
Yes, all exports remain same (firebaseDesignOrders, etc)

TESTING:
[ ] Open app → data loads (design orders + production orders)
[ ] Add order → updates within 2s
[ ] Switch between tabs → data syncs correctly
[ ] Close app → listener unsubscribed (no quota waste)
[ ] Performance: no lag with 100+ items
```

---

### Template 4: Code Review Request

```
REVIEW: [Code/Feature Name]

CHANGES:
[Summarize what changed]

FILES MODIFIED:
- [ ] file1.js
- [ ] file2.js

CHECKLIST:
- [ ] Code follows naming conventions
- [ ] No console.log() left for production
- [ ] Error handling present
- [ ] No backwards-incompatible changes
- [ ] Mobile tested
- [ ] localStorage impact assessed
- [ ] Tested with [browser/device]

QUESTIONS:
1. [Ask for clarification if unsure]
2. [Flag potential issue]
```

---

## 🎯 SPECIFIC DEVELOPMENT WORKFLOWS

### Workflow: Add New Field to Production Order

**Step-by-step:**

1. **Update schema** (database.js)
   ```javascript
   // Add comment documenting new field
   // production_orders collection now includes:
   {
     newField: String,  // Description
   }
   ```

2. **Update HTML form** (index.html, modal-production)
   ```html
   <input id="prod-newfield" type="text" placeholder="..." />
   ```

3. **Update save handler** (app.js, saveProductionOrder)
   ```javascript
   async function saveProductionOrder() {
     const customer = document.getElementById("po-customer").value.trim();
     // ... existing fields ...
     const newField = document.getElementById("prod-newfield").value.trim();
     
     const data = {
       customer,
       // ... existing ...
       newField,
       updatedAt: serverTimestamp(),
     };
     
     // Save to Firestore
   }
   ```

4. **Update table column** (tracker.js, renderProductionOrders)
   ```javascript
   tbody.innerHTML = visible.map((o) => `
     <tr>
       <td>${o.customer}</td>
       <td>${o.newField || "-"}</td>
       ...
     </tr>
   `).join("");
   ```

5. **Test**
   - [ ] Create production order with new field
   - [ ] Check Firestore doc has field
   - [ ] Check table displays value
   - [ ] Edit order → field updates
   - [ ] Mobile layout → field visible

---

### Workflow: Fix Pricing Calculation Bug

**Step-by-step:**

1. **Identify exact bug**
   - Which product type? (jersey, kaos, kemeja)
   - Which inputs trigger bug? (qty, material, size, addons)
   - What's the expected price vs actual?

2. **Add debugging logs** (database.js, calculateInvoiceItem)
   ```javascript
   export function calculateInvoiceItem(orderPayload) {
     const { productType, category, material, qty, sleeve, sizeDistribution, addonsSelected, customCharge } = orderPayload;
     
     console.log("=== DEBUG calculateInvoiceItem ===");
     console.log("Input payload:", {
       productType, category, material, qty, sleeve,
       sizeDistribution, addonsSelected, customCharge
     });
     
     const validQty = Math.max(0, qty || 0);
     const validCustomCharge = Number(customCharge) || 0;
     const basePrice = getProductBasePrice(productType, { qty: validQty, material, category, sleeve });
     
     console.log("After getProductBasePrice:", basePrice);
     
     // ... continue logging each step ...
     
     console.log("Final output:", {
       basePricePerPcs: basePrice,
       calculatedHargaPerPcs: Math.round(realHargaPerPcs),
       subtotal: Math.round(grandSubtotalItem),
       dpRequired: Math.round(downPaymentRequired),
     });
     
     return { ... };
   }
   ```

3. **Test with known values**
   ```javascript
   // In browser console:
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
   console.log(result);
   ```

4. **Compare with expected**
   - Expected: Rp85.000 base (lusinan Milano pendek)
   - Actual: Check console output
   - If mismatch → trace through logs to find step

5. **Fix the bug** (common issues)
   - Material key mismatch → normalize input
   - Tier boundary wrong → adjust logic
   - Addon not found → add validation
   - Size charge double-applied → remove from one place

6. **Remove debug logs**
7. **Test thoroughly**

---

### Workflow: Add Validation to Form

**Step-by-step:**

1. **Identify fields needing validation**
   ```
   - Customer name: required, min 2 chars
   - Quantity: required, min 1, integer
   - Price: required, min 0, can have decimals
   - Email: format validation
   ```

2. **Create validation function** (utils.js or separate validation.js)
   ```javascript
   export function validateProductionOrder(data) {
     const errors = {};
     
     if (!data.customer || data.customer.trim().length < 2) {
       errors.customer = "Customer name required (min 2 chars)";
     }
     
     if (!data.qty || data.qty < 1 || !Number.isInteger(data.qty)) {
       errors.qty = "Quantity must be positive integer";
     }
     
     if (!data.material) {
       errors.material = "Select material";
     }
     
     return { valid: Object.keys(errors).length === 0, errors };
   }
   ```

3. **Call validation before save** (app.js)
   ```javascript
   async function saveProductionOrder() {
     const data = {
       customer: document.getElementById("po-customer").value,
       qty: parseInt(document.getElementById("po-qty").value),
       material: document.getElementById("po-material").value,
       // ...
     };
     
     const { valid, errors } = validateProductionOrder(data);
     if (!valid) {
       // Show errors to user
       Object.entries(errors).forEach(([field, message]) => {
         showToast(message, "error");
         document.getElementById(`po-${field}`).classList.add("error");
       });
       return;
     }
     
     // Proceed with save
     try {
       await addDoc(collection(db, "production_orders"), data);
       showToast("Pesanan tersimpan");
     } catch (err) {
       showToast("Penyimpanan gagal", "error");
     }
   }
   ```

4. **Add visual feedback** (CSS)
   ```css
   input.error {
     border-color: var(--color-danger) !important;
     background-color: rgba(var(--color-danger-rgb), 0.05);
   }
   ```

5. **Test**
   - [ ] Leave required field empty → error shown
   - [ ] Enter invalid value → error shown
   - [ ] Enter valid data → saved
   - [ ] Mobile → error styling visible

---

## 🚀 PERFORMANCE OPTIMIZATION CHECKLIST

### Before Submitting Code:

- [ ] No nested loops without reason
- [ ] No DOM queries in loops (cache selector)
- [ ] Charts destroyed before re-creating
- [ ] Event listeners cleaned up
- [ ] Large arrays paginated (max 100 per page)
- [ ] console.log() removed (for production)
- [ ] Debounce on input handlers (800ms+ for expensive ops)
- [ ] localStorage checked for quota before save

### Performance Testing:

```javascript
// Measure function time
console.time("functionName");
functionName();
console.timeEnd("functionName");
// Output: functionName: 125.45ms

// Profile with DevTools:
// 1. F12 → Performance tab
// 2. Click "Record"
// 3. Do action
// 4. Click "Stop"
// 5. Analyze timeline
```

---

## 🧪 TESTING CHECKLIST TEMPLATE

### Before Marking Complete:

**Desktop Browser (Chrome)**
- [ ] Load page → no console errors
- [ ] Add design order → appears in table within 2s
- [ ] Edit design order → changes saved
- [ ] Delete design order → removed from table
- [ ] Filter/search → works correctly
- [ ] Calculate costing → all values correct, no NaN
- [ ] Export invoice PNG → downloaded, readable
- [ ] Dark mode toggle → all colors update
- [ ] Theme persists on refresh

**Mobile Browser (Safari on iPhone)**
- [ ] Layout responsive
- [ ] Touch events work (tap, swipe, long-press)
- [ ] Dropdowns close on tap outside
- [ ] Modal swipeable to close
- [ ] Tables horizontal scroll if needed
- [ ] Buttons large enough (44px minimum)
- [ ] No text truncation in key fields

**Edge Cases**
- [ ] Zero quantity in form
- [ ] Empty/null fields
- [ ] Very long customer names (50+ chars)
- [ ] Special characters in input (é, ü, @, etc)
- [ ] Rapid clicking buttons
- [ ] Network delay (disable network in DevTools)
- [ ] localStorage full (quota exceeded)

---

## 📞 COMMUNICATION TEMPLATE

**When asking OpenCode for help:**

```
PROBLEM: [Brief title]
CONTEXT: [What were you doing]
SYMPTOM: [What happened]
EXPECTED: [What should happen]
STEPS TO REPRODUCE:
  1. ...
  2. ...
AFFECTED FILE: [database.js | app.js | etc]
ERROR MESSAGE: [From console, if any]
ATTACHMENT: [Screenshot, code snippet, or error log]
```

**Example:**
```
PROBLEM: Invoice calculation includes size charge twice

CONTEXT: Testing invoice export for jersey order

SYMPTOM: Invoice shows size charge = Rp120.000 (5000 × 12) but appears twice in breakdown

EXPECTED: Size charge shown once as Rp60.000 OR once as Rp120.000 (consistent)

STEPS:
1. Create production order: 12 pcs jersey
2. Specify size distribution: 2S, 3M, 4L, 2XL, 1XXL (all have charges)
3. Create invoice
4. Export PNG

AFFECTED FILE: database.js (calculateInvoiceItem function)

ERROR MESSAGE: None, data inconsistent

ATTACHMENT: [screenshot of invoice showing Rp120k + Rp120k]
```

---

**Last Updated:** 2026-08-11
