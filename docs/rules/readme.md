# Progress Printshop Workspace — OpenCode Technical Documentation

**Status:** Ready for OpenCode Deployment  
**Document Version:** 1.0  
**Last Updated:** 2026-08-11  
**Application Version:** Latest

---

## 📚 DOCUMENTATION PACKAGE CONTENTS

Paket dokumentasi ini terdiri dari **3 dokumen komprehensif** yang dirancang untuk memberdayakan OpenCode dalam melakukan bug fixes, refactoring, dan feature development pada aplikasi Progress Printshop Workspace.

### Document Overview

| Document | Purpose | Audience | Size |
|----------|---------|----------|------|
| **technical-spec.md** | Master blueprint lengkap: arsitektur, data flow, module breakdown, business rules, known bugs, guidelines | Technical leads, senior developers | 43 KB |
| **debug-guide.md** | Practical debugging playbook: common issues dengan diagnosis & fixes, troubleshooting techniques | QA engineers, developers | 17 KB |
| **quick-reference.md** | Command templates & workflows: cara memberikan instruksi ke OpenCode, standard format komunikasi | Project managers, tech leads | 14 KB |

**Total:** ~74 KB dokumentasi terstruktur

---

## 🎯 QUICK START

### Untuk Project Manager / Tech Lead:
1. Baca **technical-spec.md** → Section 1-4 (Overview, Architecture, Context Map, Module Breakdown)
2. Baca **quick-reference.md** → Gunakan template saat memberi instruksi OpenCode

### Untuk QA / Tester:
1. Baca **debug-guide.md** → Common Issues & Debugging Techniques
2. Gunakan Testing Checklist (section 7.2 di Technical Spec) sebelum mark complete

### Untuk OpenCode Developer:
1. **Hari 1:** Baca seluruh technical-spec.md
2. **Sebelum coding:** Refer quick-reference.md untuk format task
3. **Saat debug:** Gunakan debug-guide.md untuk diagnosis cepat

---

## 📖 DOCUMENT STRUCTURE & NAVIGATION

### 1. technical-spec.md

**Complete architectural reference & implementation guide**

| Section | What's Inside | When to Use |
|---------|---------------|------------|
| **1. Overview & Architecture** | Tech stack, key features, browser requirements | Understanding the app |
| **2. Context Map & Data Flow** | Data flow diagram, Firestore schema, localStorage keys, global state | Before any backend work |
| **3. Module Breakdown** | Deep dive each file/module with exports, functions, known issues | Implementing features |
| **4. Business Rules & Logic** | Pricing matrix, invoice breakdown, costing formula, stage workflow | Understanding calculations |
| **5. Known Bugs & Edge Cases** | 19 documented bugs with severity & fix | Before starting development |
| **6. Refactoring Guidelines** | Code quality standards, performance optimization, backwards compatibility | During code review |
| **7. Testing & Quality Checklist** | Manual test cases, code review criteria | QA & code review |
| **8. Feature Development** | How to brief features, examples, common workflows | Planning new features |
| **9-12. Setup & Support** | Deployment, Firebase setup, glossary, checklist | DevOps & project close |

**Key Sections to Read First:**
- Section 5 (Known Bugs) — Understand pain points
- Section 4 (Business Rules) — Avoid breaking calculations
- Section 3.5 (app.js) — Main event flow

---

### 2. debug-guide.md

**Practical troubleshooting & diagnosis playbook**

| Section | Problem | Solution Approach |
|---------|---------|-------------------|
| **Issue 1-8** | App crashes, data missing, wrong calculations, mobile issues | Step-by-step diagnosis + fixes |
| **Debugging Techniques** | How to debug like a pro | Breakpoints, logging, profiling |
| **Error Messages** | What error means | Quick reference table |
| **Performance Debugging** | App slow | Profiling & optimization |
| **Testing Procedures** | How to verify bug fixed | Test scenarios & checklist |

**When to Use:**
- ✅ App behaves unexpectedly
- ✅ Calculation wrong
- ✅ Data not syncing
- ✅ Mobile not working
- ✅ Performance issue

**Not for:**
- ❌ New feature design
- ❌ Architecture questions
- ❌ Code style questions

---

### 3. quick-reference.md

**Command format & workflow templates**

| Section | Use Case |
|---------|----------|
| **Command Templates** | Bug fix, feature, refactoring, code review request format |
| **Development Workflows** | Step-by-step: add field, fix calculation, add validation |
| **Performance Checklist** | Before submitting code |
| **Testing Checklist** | Desktop, mobile, edge cases |
| **Communication Template** | When asking for help |

**Examples Included:**
- ✅ Bug fix: NaN in calculation
- ✅ Feature: Size preset templates
- ✅ Refactoring: Consolidate listeners
- ✅ Workflows: Add field to order, fix pricing bug

**Use This When:**
- Writing task description for OpenCode
- Providing feedback on code
- Planning feature development
- Communicating issues

---

## 🔑 KEY TAKEAWAYS

### Critical Understanding (READ FIRST)

1. **Data Architecture** (Spec § 2.2)
   - Design orders & Production orders are SEPARATE collections
   - Invoice links via invoiceId (1-to-1 with production)
   - Size distribution = breakdown per size (not just total qty)

2. **Pricing is Complex** (Spec § 4.2, 4.3)
   - Base price from MASTER_PRICE_DATABASE (matrix or tier)
   - Add material premium + addons + size charges
   - Then apply DP ratio (default 50%)
   - **Bug risk:** If qty=0 → divide by zero → NaN

3. **Realtime Sync Pattern** (Spec § 3.4)
   - Firebase onSnapshot listeners
   - Update global `window.firebaseDesignOrders` array
   - Trigger re-render functions
   - **Bug risk:** Multiple listeners if not managed

4. **Stage Workflow** (Spec § 4.4)
   - Design: design → revisi → done
   - Production: design → printing → jahit → qc → done
   - Can move forward/backward (except from done)
   - Overdue if deadline < today && stage != done

5. **19 Known Bugs** (Spec § 5)
   - 7 High+ severity
   - All documented with fix
   - Prioritize fixes by impact

### Common Pitfalls (Avoid These)

| Pitfall | Why Bad | Fix |
|---------|---------|-----|
| Validate price manually instead of calculateInvoiceItem() | Calculation mismatch | Always use calculateInvoiceItem() |
| Attach new onSnapshot in render function | Firebase quota exceeded | One listener per collection, ever |
| No error handling on Firestore calls | App crashes silently | Always use try-catch, show toast |
| Hardcode harga/formula | Can't change pricing | Use MASTER_PRICE_DATABASE always |
| Forget to clear form after save | UX confusing | Reset all inputs + state |
| Add feature without considering offline | App breaks no-internet | Use localStorage fallback |

---

## 🚀 IMPLEMENTATION WORKFLOWS

### Workflow: Simple Bug Fix (1-2 hours)

```
1. Read debug-guide.md → Find matching issue
2. Apply suggested fix
3. Test case from Testing Checklist
4. Submit PR
```

### Workflow: Pricing Calculation Issue (2-4 hours)

```
1. Read Spec § 4.2 (Pricing Breakdown)
2. Read Spec § 3.1 (database.js)
3. Use Debug Guide § Issue 3 (wrong price diagnosis)
4. Add console.log to calculateInvoiceItem()
5. Test with known example values
6. Fix & test thoroughly
```

### Workflow: New Feature (4-8 hours)

```
1. Use quick-reference.md Template 2 (Feature Request)
2. Read Spec § 8 (Feature Development Instructions)
3. Follow Workflow A or B from Quick Reference
4. Use Testing Checklist before submit
```

### Workflow: Performance Issue (1-3 hours)

```
1. Read Spec § 6.2 (Performance Optimization)
2. Use DevTools Performance tab to profile
3. Read Debug Guide § Performance Debugging
4. Apply fix (destroy charts, batch DOM, etc)
5. Measure improvement
```

---

## 📊 STATISTICS & SCOPE

### Codebase Metrics
- **Total Files:** 8 JavaScript modules + 1 HTML + 3 CSS files
- **Lines of Code:** ~2,500 (app.js ~1,450, costing.js ~400, tracker.js ~200, etc)
- **Functions:** 80+ exported functions
- **Firestore Collections:** 4 (design_orders, production_orders, invoices, costing_history)
- **localStorage Keys:** 5 (autosave, history, theme, tasks, sectionStates)

### Bug & Issue Inventory
- **Known Bugs:** 19 documented
- **Severity:** 7 High, 5 Medium, 7 Low
- **Critical Path:** Pricing calculation, Firestore sync, form validation
- **Tech Debt:** Event delegation strings, memory leak potential, no error boundaries

### Test Coverage Needs
- **Unit Tests:** database.js functions (pricing, calculations)
- **Integration Tests:** Firebase snapshot → render flow
- **Manual Tests:** All section workflows (Design/Production/Invoice/Costing)
- **Performance Tests:** 100+ items rendering, chart updates

---

## 📞 GETTING SUPPORT

### For OpenCode:
1. **Questions about existing code?** → Check Technical Spec § 3 (Module Breakdown)
2. **Bug not listed?** → Follow Debug Guide diagnosis technique
3. **Not sure how to implement?** → Use Quick Reference workflow template
4. **Need clarification on requirements?** → Reference Business Rules (Spec § 4)

### For Project Managers:
1. **How to assign work?** → Use Quick Reference Templates (§ 8)
2. **What features exist?** → See Technical Spec § 1.3 (Key Features)
3. **Estimate task?** → Check Quick Reference (effort estimates in feature template)
4. **Review quality?** → Use Testing Checklist (Spec § 7.2)

### For QA / Testers:
1. **What to test?** → Section 7.2 Testing Checklist (Spec)
2. **Bug not replicable?** → Use Debug Guide diagnosis
3. **Performance acceptable?** → See Spec § 6.2 (Performance standards)

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before marking tasks complete, ensure:

### Code Quality
- [ ] Follows naming conventions (Spec § 6.1)
- [ ] No console.log() or debug code
- [ ] Error handling present (try-catch)
- [ ] No breaking changes to exports
- [ ] Backwards compatible

### Testing
- [ ] Desktop browser tested (Chrome, Firefox)
- [ ] Mobile tested (480px, 768px widths)
- [ ] All test cases from Checklist pass
- [ ] Edge cases covered
- [ ] No console errors

### Performance
- [ ] Function runs < 500ms (tables) or < 300ms (charts)
- [ ] Memory leak potential checked
- [ ] localStorage quota impact assessed
- [ ] Firebase quota not exceeded

### Documentation
- [ ] Changes documented (if any schema changes)
- [ ] Complex logic has comments
- [ ] PR description clear

---

## 🎓 RECOMMENDED READING ORDER

**Day 1 (Orientation):**
1. This README (overview)
2. Technical Spec § 1 (Overview & Architecture)
3. Technical Spec § 2 (Context Map & Data Flow)

**Day 2 (Deep Dive):**
1. Technical Spec § 3 (Module Breakdown) — focus on assigned module
2. Technical Spec § 4 (Business Rules)
3. Technical Spec § 5 (Known Bugs) — understand landscape

**Before First Task:**
1. Quick Reference § Command Templates — understand task format
2. Quick Reference § Workflows — see step-by-step examples
3. Debug Guide § Issue 1-3 — see real examples

**During Development:**
1. Keep Quick Reference handy for workflow steps
2. Refer Technical Spec for module details
3. Check Debug Guide if unexpected behavior

---

## 📝 DOCUMENT MAINTENANCE

This documentation package should be updated when:

- [ ] New bug discovered & fixed (add to Spec § 5)
- [ ] New feature released (add to Spec § 8)
- [ ] Module refactored (update Spec § 3)
- [ ] Common issue found (add to Debug Guide)
- [ ] New workflow pattern discovered (add to Quick Reference)

**Estimated update frequency:** Quarterly (or per major release)

---

## 🎯 SUCCESS METRICS

**For OpenCode, measure success by:**

1. **Bug Fix Success Rate:** 90%+ bugs fixed correctly on first try
2. **Feature Delivery:** 80%+ features meet acceptance criteria
3. **Code Quality:** 0 breaking changes, all tests pass
4. **Performance:** App responds < 1s for all user actions
5. **Data Accuracy:** Pricing calculations 100% accurate

**For Project Managers:**
- Task completion time within estimate
- Minimal back-and-forth questions
- Clear communication using provided templates

---

## 📋 VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-11 | Initial comprehensive documentation package |

---

## 🔗 QUICK LINKS

- **Technical Specification:** [technical-spec.md](technical-spec.md)
  - Complete reference (43 KB)
  - 12 sections covering all aspects
  
- **Debug Guide:** [debug-guide.md](debug-guide.md)
  - Common issues & fixes (17 KB)
  - Practical troubleshooting
  
- **Quick Reference:** [quick-reference.md](quick-reference.md)
  - Command templates & workflows (14 KB)
  - Standard formats & examples

---

## 📄 FILE CHECKLIST

Ensure you have all 4 files:

- [x] README.md (this file - overview & navigation)
- [x] technical-spec.md (master blueprint)
- [x] debug-guide.md (practical troubleshooting)
- [x] quick-reference.md (command templates)

**Total Package Size:** ~74 KB (easily searchable, copy-paste friendly)

---

## 🎓 FINAL NOTE

Dokumentasi ini dirancang untuk **independensi maksimal** — OpenCode dapat bekerja efektif dengan hanya referencing dokumen ini, minimal back-and-forth questions.

**Key Principles:**
1. ✅ **Actionable:** Setiap section punya clear next steps
2. ✅ **Comprehensive:** Semua edge cases & workflows covered
3. ✅ **Practical:** Real examples, tested patterns
4. ✅ **Organized:** Mudah navigate & search
5. ✅ **Maintainable:** Format yang bisa diedit & updated

---

**Last Updated:** 2026-08-11  
**Status:** Ready for Production Use  
**Contact:** Technical Lead / Project Manager

---

**Terima kasih telah menggunakan dokumentasi OpenCode Progress Printshop Workspace! 🚀**
