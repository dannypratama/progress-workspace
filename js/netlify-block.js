/**
 * Pemblokir Netlify Drawer / Collaborative Tools
 * -----------------------------------------------------------------
 * Netlify menyuntikkan Drawer ke HTML saat halaman dilayani (server-side),
 * sehingga elemennya sudah ada sebelum script aplikasi berjalan. CSS saja
 * tidak cukup karena beberapa bagian dirender di dalam shadow DOM atau
 * iframe. File ini menghapus elemennya secara langsung.
 *
 * Dijalankan sebagai classic script (bukan module) agar tidak ter-defer
 * dan dapathnerik elemen sebelum halaman selesai digambar.
 *
 * CATATAN: ini adalah solusi sisi klien. Untuk menonaktifkan Drawer
 * sepenuhnya, gunakan Netlify UI:
 *   Project configuration > Developer settings > Post processing
 */
(function () {
  "use strict";

  /* Elemen dianggap milik Netlify bila salah satu pola ini cocok. */
  var isNetlify = function (el) {
    if (!el || el.nodeType !== 1) return false;

    /* 1. Custom element: <netlify-drawer>, <netlify-*> */
    var tag = (el.tagName || "").toLowerCase();
    if (tag.indexOf("netlify") === 0) return true;

    /* 2. id diawali "netlify-" */
    if ((el.id || "").toLowerCase().indexOf("netlify") === 0) return true;

    /* 3. class mengandung kata "netlify" */
    var cls = typeof el.className === "string" ? el.className : "";
    if (/\bnetlify\b/i.test(cls)) return true;

    /* 4. atribut data-netlify-* */
    var attrs = el.attributes;
    for (var a = 0; a < attrs.length; a++) {
      if (attrs[a].name.toLowerCase().indexOf("data-netlify") === 0) return true;
    }

    /* 5. iframe yang memuat konten dari domain Netlify */
    if (tag === "iframe") {
      var src = (el.getAttribute("src") || "").toLowerCase();
      if (src.indexOf("netlify") !== -1) return true;
    }

    /* 6. elemen yang memuat URL Netlify pada style/background */
    var style = el.getAttribute ? (el.getAttribute("style") || "") : "";
    if (/netlify\.(app|com)/i.test(style)) return true;

    return false;
  };

  var removeEl = function (el) {
    if (!isNetlify(el)) return false;
    try {
      el.remove();
    } catch (e) {
      /* fallback bila .remove() tidak didukung */
      el.style.display = "none";
    }
    return true;
  };

  /* Sapu seluruh subtree yang diberikan (default: document). */
  var sweep = function (root) {
    var scope = root || document;
    var list;
    try {
      list = scope.querySelectorAll("*");
    } catch (e) {
      return 0;
    }
    var removed = 0;
    for (var i = 0; i < list.length; i++) {
      if (removeEl(list[i])) removed++;
    }
    return removed;
  };

  var observer = null;
  var ticks = 0;

  var install = function () {
    if (!document.body || observer) return false;

    /* Sapu dulu:_netlify injeksi server-side sudah ada di DOM. */
    sweep(document);

    /* Amati injeksi lanjutan (beberapa versi Drawer disisipkan
       setelah DOMContentLoaded). */
    try {
      observer = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var added = mutations[m].addedNodes;
          for (var n = 0; n < added.length; n++) {
            var node = added[n];
            if (node.nodeType !== 1) continue;
            if (!removeEl(node)) sweep(node);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      observer = null;
    }

    /* Penutup: beberapa Drawer menyisipkan ulang node lewat timer.
       Sapu berkala selama 12 detik lalu berhenti. */
    var guard = setInterval(function () {
      ticks++;
      sweep(document);
      if (ticks >= 12) clearInterval(guard);
    }, 1000);

    return true;
  };

  if (document.body) {
    install();
  } else {
    document.addEventListener("DOMContentLoaded", install);
  }
  /* Bila script dimuat setelah DOM siap, langsung pasang. */
  if (document.readyState === "complete" || document.readyState === "interactive") {
    install();
  }
})();