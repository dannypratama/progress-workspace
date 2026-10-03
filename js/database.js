/**
 * Master Data & Konstanta
 * Sumber tunggal untuk matriks harga, daftar vendor estimator,
 * kategori desain, serta stage dan status pada tiap workflow.
 */

/* ============================================================= */
/* 1. VENDOR & MATRIKS BAHAN — Estimasi Produksi               */
/* ============================================================= */
/* Rumus kalkulator web (TIDAK diubah):
     kg      = panjang_meter × rasio_kg_per_meter
     Berat   = kg × harga_per_kg
     Print   = panjang_meter × biaya_cetak_per_meter
     Total   = Berat + Print
   Semua nilai di bawah sudah diturunkan agar rumus itu menghasilkan
   angka yang persis sama dengan tarif vendor.                      */

/* -- VENDOR 1: R SUBLIMATION --                                   */
/* Sistem: eceran kain per KG + jasa printpress per METER (terpisah) */
const R_SUBLIMATION = {
  id: "sublimation",
  name: "R",
  fullName: "R SUBLIMATION",
  system: "eceran_kain_per_kg + jasa_printpress_per_meter",
  // slot = id input existing di form (tidak mengubah form)
  slot: {
    milano: { nama: "Milano", kg: 0.34, harga: 63000, print: 14400, hppPerMeter: 35820 },
    emboss: { nama: "Emboss", kg: 0.34, harga: 76000, print: 14400, hppPerMeter: 40240 },
    rib: { nama: "Ribpoly", kg: 0.4, harga: 0, print: 14400, hppPerMeter: 14400 },
  },
  notes: "Rasio 0.34 kg/m (Milano & Emboss). Ribpoly all-in Rp14.400/meter.",
  services: [],
};

/* -- VENDOR 2: ALPA PRINTING --                                    */
/* Sistem asli: paket ALL-IN per meter (kain + printpress).
   Dipecah ke format kalkulator web:
     harga/kg turunan = (all_in − cetak_implisit) / rasio
   dengan rasio tetap 0.40 kg/m supaya tampilan kg tetap wajar.      */
const RASIO_ALPA = 0.4;
const CETAK_IMPLISIT_ALPA = 16000;
const alpaSlot = (nama, allIn) => ({
  nama,
  kg: RASIO_ALPA,
  harga: Math.round((allIn - CETAK_IMPLISIT_ALPA) / RASIO_ALPA),
  print: CETAK_IMPLISIT_ALPA,
  hppPerMeter: allIn,
});

const ALPA_PRINTING = {
  id: "alpa",
  name: "A",
  fullName: "ALPA PRINTING",
  system: "all_in_per_meter (dipecah: bahan + cetak implisit)",
  slot: {
    milano: alpaSlot("Milano", 47000),
    emboss: alpaSlot("Emboss", 60000),
    rib: alpaSlot("Ribpoly", 60000),
  },
  notes: "Harga all-in per meter sudah termasuk printpress Rp16.000/m.",
  services: [
    { nama: "Print Only (Kertas Sublim)", harga: 13000, unit: "/meter" },
    { nama: "Print Press 178 (Kain Bawa Sendiri)", harga: 16000, unit: "/meter" },
  ],
};

export const ESTIMATOR_VENDORS = {
  sublimation: R_SUBLIMATION,
  alpa: ALPA_PRINTING,
};

export const DEFAULT_ESTIMATOR_VENDOR = "sublimation";

// Slot yang tidak dipakai vendor →nol biaya (tidak merusak rumus)
const EMPTY_SLOT = { nama: "— Tidak dipakai —", kg: 0, harga: 0, print: 0, hppPerMeter: 0 };

/* Bentuk BAHAN untuk slot form.
   Card yang tampil di UI hanya 4: MILANO, EMBOSS, RIBPOLY, BAHAN CUSTOM. */
export const BAHAN_SLOTS = ["milano", "emboss", "rib"];

function buildBahan(vendorId) {
  const vendor = ESTIMATOR_VENDORS[vendorId] || ESTIMATOR_VENDORS[DEFAULT_ESTIMATOR_VENDOR];
  const out = {};
  for (const slot of BAHAN_SLOTS) out[slot] = vendor.slot[slot] ? { ...vendor.slot[slot] } : { ...EMPTY_SLOT };
  return out;
}

/* BAHAN aktif untuk kalkulator.
   `export let` + reassign => modul lain (costing.js) otomatis ikut berubah
   karena ES module memakai live binding. Rumus hitung() TIDAK diubah. */
export let BAHAN = buildBahan(DEFAULT_ESTIMATOR_VENDOR);

/** Ganti vendor aktif. Return matriks bahan baru (dipakai update label form). */
export function setEstimatorVendor(vendorId) {
  BAHAN = buildBahan(vendorId);
  // Custom Supplier memakai tarif cetak global -> ikut mengikuti vendor aktif
  const v = getEstimatorVendor(vendorId);
  const sample = v.slot.milano;
  if (sample) CFG.printPressRate = sample.print;
  return BAHAN;
}

export function getEstimatorVendor(vendorId) {
  return ESTIMATOR_VENDORS[vendorId] || ESTIMATOR_VENDORS[DEFAULT_ESTIMATOR_VENDOR];
}

export const CFG = {
  printPressRate: 12600,
  estimasiRatio: 0.7,
  toastDuration: 2800,
};

export const DESIGN_STAGES = ["design", "revisi", "done"];
export const PRODUCTION_STAGES = ["design", "printing", "jahit", "qc", "done"];

/* ---------- MASTER DATA PESANAN DESAIN ---------- */

/* Kategori pekerjaan desain + cara hitung harganya.
   DTF       -> input panjang (CM), harga = (CM/100) x rateDtf
   PLASTISOL -> input nama project/file, harga = ratePlastisol per desain
   DESAIN    -> input nama project + harga manual */
export const DESIGN_CATEGORIES = [
  { value: "DTF", label: "LAYOUT DTF", unit: "m", mode: "cm" },
  { value: "PLASTISOL", label: "PLASTISOL", unit: "desain", mode: "flat" },
  { value: "DESAIN", label: "DESAIN", unit: "", mode: "manual" },
];

/* Data awal Customer Loyal + rate khususnya.
   Bisa ditambah/ubah dari aplikasi (Firestore: design_customers). */
export const LOYAL_CUSTOMERS_SEED = [
  { name: "PAY SABLON", rateDtf: 10000, ratePlastisol: 25000 },
  { name: "SKYBLUE", rateDtf: 7000, ratePlastisol: 20000 },
  { name: "ICON STUDIO", rateDtf: 10000, ratePlastisol: 25000 },
];

export function getDesignCategory(value) {
  return DESIGN_CATEGORIES.find((c) => c.value === value) || null;
}

/* CM -> meter (1 m = 100 cm) */
export function cmToMeter(cm) {
  const n = Number(cm);
  return Number.isFinite(n) ? n / 100 : 0;
}

/* Format meter ringkas: 130 cm -> "1.3m" */
export function formatMeter(cm) {
  const m = cmToMeter(cm);
  if (!m) return "0m";
  return `${parseFloat(m.toFixed(2))}m`;
}

/* Hitung harga desain berdasarkan kategori + rate customer */
export function calcDesignPrice({ kategori, cm, manualPrice, rateDtf, ratePlastisol }) {
  const cat = getDesignCategory(kategori);
  if (!cat) return { price: 0, meter: 0 };
  if (cat.mode === "cm") {
    const meter = cmToMeter(cm);
    return { price: Math.round(meter * (Number(rateDtf) || 0)), meter };
  }
  if (cat.mode === "flat") {
    return { price: Number(ratePlastisol) || 0, meter: 0 };
  }
  return { price: Number(manualPrice) || 0, meter: 0 };
}

/* ---------- MAGIC: BULK INPUT DESAIN DARI NOTEPAD ---------- */

/* Kata kunci header blok. "LAYOUT DTF" & "DTF" dianggap sama. */
const MAGIC_BLOCK_HEADERS = [
  { re: /^(?:LAYOUT\s*)?DTF$/i, kategori: "DTF" },
  { re: /^PLASTISOL$/i, kategori: "PLASTISOL" },
  { re: /^DESAIN$/i, kategori: "DESAIN" },
];

function magicMatchBlockHeader(line) {
  const t = line.trim().replace(/[^A-Z\s]/gi, "").trim();
  for (const h of MAGIC_BLOCK_HEADERS) if (h.re.test(t)) return h.kategori;
  return "";
}

/* Angka polos tanpa satuan (mis. "A - 130") -> dianggap CM */
function magicBareNumber(line) {
  const m = String(line || "").match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/* Nominal harga: "25K" -> 25000 | "10k" -> 10000 | "1.5K" -> 1500 | "25000" -> 25000 */
function magicParseMoney(text) {
  const raw = String(text || "").trim().toUpperCase();
  const hasK = /K/.test(raw);
  let num;
  if (hasK) {
    // ada K -> angka dalam ribuan, titik/koma = desimal ("1.5K" = 1500)
    num = parseFloat(raw.replace(/[^0-9.]/g, "").replace(",", "."));
  } else {
    // tanpa K -> pemisah ribuan ala Indonesia ("25.000" = 25000)
    num = parseFloat(raw.replace(/[.,]/g, ""));
  }
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * (hasK ? 1000 : 1));
}

/* Pisahkan "NAMA - 25K" -> { name, price }.
   Mendukung: tanda hubung, kurung, atau spasi terakhir.
   Catatan: pemisah SPASI hanya dianggap harga bila diakhiri suffix "K",
   karena nama project sering berisi angka (mis. "LOGO 2024"). */
function magicSplitNamePrice(line) {
  // greedy: pisah di tanda hubung TERAKHIR agar "SQUAD-FC - 5K" -> "SQUAD-FC"
  let m = line.match(/^(.+)\s*[-–—]\s*(.+)$/); // "NAMA - 25K"
  if (!m) m = line.match(/^(.+?)\s*\(\s*(.+?)\s*\)$/); // "NAMA (25K)"
  if (!m) {
    const t = line.match(/^(.+?)\s+(\d[\d.,]*\s*[kK])\s*$/); // "NAMA 25K" (wajib ada K)
    if (t && magicParseMoney(t[2]) > 0) m = t;
  }
  if (!m) return null;
  const price = magicParseMoney(m[2]);
  if (!price) return null;
  const name = m[1].replace(/[\s\-–—()]+$/, "").trim();
  if (!name) return null;
  return { name, price };
}

/**
 * Parser blok notepad. Baris header (DTF / PLASTISOL / DESAIN) menentukan
 * kategori item di bawahnya sampai header berikutnya:
 *   DTF / A / B / C / (kosong) / PLASTISOL / A / B / C ...
 * Bila tidak ada header sama sekali, fallback penentuan kategori per baris.
 */
export function parseMagicDesignBlocks(text, rateDtf, ratePlastisol) {
  const out = [];
  let current = ""; // kategori aktif dari header
  const lines = String(text || "").split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 1) header blok? (dicek SEBELUM rule separator, agar "=== DTF ==="
    //    tetap terbaca sbg header)
    const header = magicMatchBlockHeader(line);
    if (header) { current = header; continue; }

    // 2) lewati bullet/garis pemisah notepad
    if (/^[\s\-*#=>|]+$/.test(line)) continue;
    if (/^[-=*#]{2,}/.test(line)) continue;

    // 3) item di bawah header aktif
    let kategori = current;
    if (!kategori) {
      // tanpa header: tentukan sendiri dari isi baris
      kategori = /\bDTF\b/i.test(line) || parseLengthCmFromText(line) > 0 ? "DTF" : "PLASTISOL";
    }

    let cm = 0;
    let manual = 0; // harga manual kategori DESAIN (dari teks "NAMA - 25K")
    let name = line;
    if (kategori === "DTF") {
      cm = parseLengthCmFromText(line);
      // angka tanpa satuan (mis. "A - 130") dianggap CM
      if (cm <= 0) {
        const bare = magicBareNumber(line);
        if (bare > 0) cm = bare;
      }
      name = line
        .replace(/(\d+(?:[.,]\d+)?)\s*(?:CM|METER|METRE|M)(?![A-Z])/gi, " ")
        .replace(/\bDTF\b/gi, " ")
        .replace(/\bLAYOUT\b/gi, " ")
        .replace(/^[\s\-–—:.,|>]+/, "")
        .replace(/[\s\-–—:.,|]+$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!name) name = line; // mis. "130CM" saja -> pakai baris asli
    } else if (kategori === "DESAIN") {
      // Format: "NAMA PROJECT - 25K" -> nama + harga manual dari teks
      const sp = magicSplitNamePrice(line);
      if (sp) { name = sp.name; manual = sp.price; }
      else {
        name = line
          .replace(/\bDESAIN\b/gi, " ")
          .replace(/^[\s\-–—:.,|>]+/, "")
          .replace(/[\s\-–—:.,|]+$/, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (!name) name = line;
      }
    } else {
      name = line
        .replace(/\bPLASTISOL\b/gi, " ")
        .replace(/^[\s\-–—:.,|>]+/, "")
        .replace(/[\s\-–—:.,|]+$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!name) name = line;
    }
    if (!name) continue;

    const calc = calcDesignPrice({ kategori, cm, manualPrice: manual, rateDtf, ratePlastisol });
    out.push({
      kategori,
      design: name.toUpperCase(),
      lengthCm: kategori === "DTF" ? cm : 0,
      meter: calc.meter,
      price: calc.price,
      rate: kategori === "DTF" ? Number(rateDtf) || 0 : kategori === "PLASTISOL" ? Number(ratePlastisol) || 0 : 0,
      noLength: kategori === "DTF" && cm <= 0, // DTF tanpa ukuran -> perlu dilengkapi
    });
  }
  return out;
}

/**
 * Parse per-baris (tanpa header blok). Dipakai bila notepad hanya berisi
 * daftar nama, contoh: "SERAGAM - 1.3m", "GREENHOOD A".
 */
export function parseMagicDesignLines(text, rateDtf, ratePlastisol) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // lewati bullet/heading notepad: - * # = >  dan garis pemisah
    if (/^[\s\-*#=>|]+$/.test(line)) continue;
    if (/^[-=*#]{2,}/.test(line)) continue;

    let cm = parseLengthCmFromText(line);
    const isDtf = /\bDTF\b/i.test(line) || cm > 0;

    // buang kata kunci & separator, sisakan nama project
    let name = line
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:CM|METER|METRE|M)(?![A-Z])/gi, " ")
      .replace(/\bDTF\b/gi, " ")
      .replace(/\bPLASTISOL\b/gi, " ")
      .replace(/\bLAYOUT\b/gi, " ")
      .replace(/\bDESAIN\b/gi, " ")
      .replace(/^[\s\-–—:.,|>]+/, "")
      .replace(/[\s\-–—:.,|]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // baris yang isinya cuma kategori+ukuran (mis. "LAYOUT DTF 130CM")
    // -> pakai baris asli sebagai nama agar item tidak hilang
    if (!name) name = line;
    if (!name) continue;

    const kategori = isDtf ? "DTF" : "PLASTISOL";
    if (kategori === "DTF" && cm <= 0) cm = 0;
    const calc = calcDesignPrice({ kategori, cm, manualPrice: 0, rateDtf, ratePlastisol });
    out.push({
      kategori,
      design: name.toUpperCase(),
      lengthCm: kategori === "DTF" ? cm : 0,
      meter: calc.meter,
      price: calc.price,
      rate: kategori === "DTF" ? Number(rateDtf) || 0 : Number(ratePlastisol) || 0,
    });
  }
  return out;
}

/* ---------- BACKFILL / NORMALISASI DATA DESAIN LAMA ---------- */

export const DEFAULT_DESIGN_RATE = { rateDtf: 10000, ratePlastisol: 25000 };

/* Petakan kategori lama -> kategori baru */
export function normalizeDesignCategory(jenis) {
  const v = String(jenis || "").trim().toUpperCase();
  if (v === "DTF") return "DTF";
  if (v === "PLASTISOL") return "PLASTISOL";
  if (v === "DESAIN") return "DESAIN";
  // CUSTOM (nama lama) / JERSEY / KAOS / DESAIN / kosong -> DESAIN (tanpa rate khusus)
  return "DESAIN";
}

const normKey = (v) => String(v || "").trim().toUpperCase().replace(/\s+/g, " ");

/* Cari customer di daftar (lalu seed, lalu default) */
export function resolveDesignCustomer(name, customers) {
  const key = normKey(name);
  if (!key) return { name: name || "", rateDtf: DEFAULT_DESIGN_RATE.rateDtf, ratePlastisol: DEFAULT_DESIGN_RATE.ratePlastisol, known: false };
  const list = [...(customers || []), ...LOYAL_CUSTOMERS_SEED];
  const hit = list.find((c) => normKey(c.name) === key);
  if (hit) return { name: hit.name, rateDtf: Number(hit.rateDtf) || 0, ratePlastisol: Number(hit.ratePlastisol) || 0, known: true };
  return { name: String(name).trim(), rateDtf: DEFAULT_DESIGN_RATE.rateDtf, ratePlastisol: DEFAULT_DESIGN_RATE.ratePlastisol, known: false };
}

/* Ambil panjang CM dari teks deskripsi (mis. "130CM", "1.3 METER") */
export function parseLengthCmFromText(text) {
  const s = String(text || "").toUpperCase();
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*CM/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 100) / 100;
  m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:METER|METRE)\b/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 100 * 100) / 100;
  m = s.match(/(\d+(?:[.,]\d+)?)\s*M(?![A-Z])/); // "1.3 M" di akhir kata
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 100 * 100) / 100;
  return 0;
}

/**
 * Lengkapi order desain lama agar kompatibel dengan format baru.
 * Murni turunan (tidak menulis ke database) -> aman & transparan.
 */
export function normalizeDesignOrder(order, customers) {
  if (!order) return null;
  const cust = resolveDesignCustomer(order.customer, customers);
  const kategori = normalizeDesignCategory(order.jenis);
  const rateDtf = Number(order.rateDtf) || cust.rateDtf;
  const ratePlastisol = Number(order.ratePlastisol) || cust.ratePlastisol;

  // Panjang: field baru -> field lama -> teks -> hitung mundur dari harga.
  // Hitung mundur HANYA untuk kategori berbasis CM (DTF); kalau tidak,
  // order PLASTISOL/DESAIN akan mendapat panjang fiktif dari harganya.
  const catObj = getDesignCategory(kategori);
  const usesCm = !!catObj && catObj.mode === "cm";
  let lengthCm = Number(order.lengthCm ?? order.cm) || 0;
  if (!lengthCm) lengthCm = parseLengthCmFromText(order.design);
  if (!lengthCm && usesCm && (order.price || 0) > 0 && rateDtf > 0) {
    lengthCm = Math.round(((Number(order.price) / rateDtf) * 100) * 100) / 100;
  }
  if (!usesCm) lengthCm = Number(order.lengthCm ?? order.cm) || 0;

  const manual = Number(order.price) || 0;
  const calc = calcDesignPrice({
    kategori, cm: lengthCm,
    manualPrice: kategori === "DESAIN" ? manual : 0,
    rateDtf, ratePlastisol,
  });

  // Harga: pakai yang tersimpan, atau hitung dari rate
  let price = manual;
  if (!price && kategori !== "DESAIN") price = calc.price;

  return {
    ...order,
    customer: order.customer || cust.name,
    jenis: kategori,
    lengthCm,
    meter: cmToMeter(lengthCm),
    price,
    rateDtf,
    ratePlastisol,
    customerKnown: cust.known,
  };
}

/* Backfill seluruh daftar order desain */
export function normalizeDesignOrders(orders, customers) {
  return (orders || []).map((o) => normalizeDesignOrder(o, customers)).filter(Boolean);
}

/* Nilai valid untuk dropdown filter status tiap section.
   Dipakai untuk memvalidasi nilai filter agar nilai lama yang tersimpan
   (mis. "progress"/"overdue") tidak menghasilkan tabel kosong. */
export const DESIGN_STATUS_VALUES = ["design", "revisi", "done"];
export const PRODUCTION_STATUS_VALUES = ["design", "production", "invoice", "done"];
export const INVOICE_STATUS_VALUES = ["draft", "paid"];

export const KEYS = {
  autosave: "progress_autosave",
  history: "progress_costings",
  theme: "progress_theme",
  design_orders: "progress_design_orders",
  tasks: "progress_tasks",
  smart_tasks_done: "progress_smart_tasks_done",
  production_orders: "progress_production_orders",
};

export const MASTER_PRICE_DATABASE = {
  products: {
    jersey: {
      name: "Jersey Custom",
      category: ["ATASAN JERSEY", "SETELAN JERSEY"],
      cuttings: ["Regular"],
      pricingModel: "matrix",
      matrix: {
        "ATASAN JERSEY": {
          MILANO: {
            satuan: { pendek: 90000, panjang: 100000 },
            lusinan: { pendek: 85000, panjang: 95000 },
          },
          EMBOSS: {
            satuan: { pendek: 100000, panjang: 110000 },
            lusinan: { pendek: 95000, panjang: 105000 },
          },
        },
        "SETELAN JERSEY": {
          MILANO: {
            satuan: { pendek: 130000, panjang: 140000 },
            lusinan: { pendek: 125000, panjang: 135000 },
          },
          EMBOSS: {
            satuan: { pendek: 140000, panjang: 150000 },
            lusinan: { pendek: 135000, panjang: 145000 },
          },
        },
      },
    },
    kaos: {
      name: "Kaos Custom",
      method: "DTF",
      pricingModel: "tier",
      defaultConfiguration: "Lengan pendek + sablon DTF",
      tiers: {
        "COTTON COMBED 30S": [
          { min: 1, max: 1, price: 70000 },
          { min: 12, max: 49, price: 65000 },
          { min: 50, max: 99, price: 60000 },
          { min: 100, max: 499, price: 55000 },
          { min: 500, max: Infinity, price: 50000 },
        ],
        "COTTON COMBED 24S": [
          { min: 1, max: 1, price: 75000 },
          { min: 12, max: 49, price: 70000 },
          { min: 50, max: 99, price: 65000 },
          { min: 100, max: 499, price: 60000 },
          { min: 500, max: Infinity, price: 55000 },
        ],
        "COTTON COMBED 20S": [
          { min: 1, max: 1, price: 85000 },
          { min: 12, max: 49, price: 80000 },
          { min: 50, max: 99, price: 75000 },
          { min: 100, max: 499, price: 70000 },
          { min: 500, max: Infinity, price: 65000 },
        ],
      },
    },
    kemeja: {
      name: "Kemeja Custom",
      pricingModel: "tier",
      defaultConfiguration: "Lengan pendek + 3 titik bordir",
      tiers: {
        "NAGATA DRILL": [
          { min: 1, max: 1, price: 155000 },
          { min: 12, max: 49, price: 150000 },
          { min: 50, max: 99, price: 145000 },
          { min: 100, max: 499, price: 140000 },
          { min: 500, max: Infinity, price: 135000 },
        ],
        RIPSTOP: [
          { min: 1, max: 1, price: 150000 },
          { min: 12, max: 49, price: 145000 },
          { min: 50, max: 99, price: 140000 },
          { min: 100, max: 499, price: 135000 },
          { min: 500, max: Infinity, price: 130000 },
        ],
        "AMERICAN DRILL": [
          { min: 1, max: 1, price: 130000 },
          { min: 12, max: 49, price: 125000 },
          { min: 50, max: 99, price: 120000 },
          { min: 100, max: 499, price: 115000 },
          { min: 500, max: Infinity, price: 110000 },
        ],
      },
    },
  },
  materials: {
    jersey: {
      bintik: 0,
      puma: 0,
      milano: 0,
      airwalk: 10000,
      "emboss straw": 10000,
      "emboss topo": 10000,
      emboss: 10000,
    },
    kaos: {},
    kemeja: {},
  },
  addons: {
    jersey: {
      kerah_free: { "o-neck": 0, "v-neck": 0, "v-variasi": 0, "v-potong": 0 },
      kerah_tambahan: {
        "polo v-neck": 5000,
        "polo v tutup": 5000,
        "kerah polo": 10000,
        "pake kerah": 10000,
        kupluk: 10000,
      },
      model: { panjang: 10000, "lengan panjang": 10000, "3/4": 10000, "7/8": 10000 },
      cutting: { oversize: 5000 },
    },
    kaos: {
      model: {
        panjang: 10000,
        "lengan panjang": 10000,
        "3/4": 5000,
        "7/8": 5000,
        "lengan 3/4": 5000,
        "lengan 7/8": 5000,
      },
    },
    kemeja: {
      model: { panjang: 10000, "lengan panjang": 10000 },
      fitur: { "tambah titik bordir": 10000 },
    },
  },
  sizeCharges: {
    global_apparel: {
      S: 0, M: 0, L: 0, XL: 0,
      "2XL": 5000, "3XL": 5000,
      "4XL": 15000, "5XL": 15000, "6XL": 15000,
    },
  },
  rules: {
    jersey: {
      minOrderForLusinan: 12,
      bonus: { type: "Free Sticker", minQty: 12 },
      downPaymentRatio: 0.5,
      productionTime: "7-14 hari",
    },
    kaos: { downPaymentRatio: 0.5, productionTime: "7-10 hari" },
    kemeja: { downPaymentRatio: 0.5, productionTime: "10-14 hari" },
  },
};

export function getProductBasePrice(productType, options = {}) {
  const product = MASTER_PRICE_DATABASE.products[productType];
  if (!product) return 0;
  const qty = options.qty || 1;
  const materialSelected = (options.material || "").toUpperCase();
  if (product.pricingModel === "matrix") {
    const category = options.category || "ATASAN JERSEY";
    const sleeve = options.sleeve || "pendek";
    let materialGroup = "MILANO";
    if (materialSelected.includes("EMBOSS")) materialGroup = "EMBOSS";
    const orderType = qty >= (MASTER_PRICE_DATABASE.rules.jersey?.minOrderForLusinan || 12) ? "lusinan" : "satuan";
    try {
      const bySleeve = product.matrix[category][materialGroup][orderType];
      // Lengan 3/4 & 7/8 tidak ada di matrix -> pakai harga lengan pendek
      return (sleeve in bySleeve ? bySleeve[sleeve] : bySleeve.pendek) || 0;
    } catch (e) {
      return 0;
    }
  }
  if (product.pricingModel === "tier") {
    const materialTiers = product.tiers[materialSelected];
    if (!materialTiers) {
      const first = Object.keys(product.tiers)[0];
      return findTierPrice(product.tiers[first], qty);
    }
    return findTierPrice(materialTiers, qty);
  }
  return 0;
}

export function findTierPrice(tiersArray, qty) {
  if (!Array.isArray(tiersArray) || !tiersArray.length) return 0;
  let best = null;
  for (const t of tiersArray) {
    if (qty >= t.min) best = t;
    else break;
  }
  return best ? best.price : tiersArray[0].price;
}

/* ============================================================= */
/* 2. ALIAS MATERIAL LAMA (hanya tampilan)                     */
/* ============================================================= */
/* Data lama menyimpan label dropdown versi lama, mis. "EMBOSS +10K". */
/* Fungsi ini hanya mengubah TEKS TAMPILAN ke nama kanonik terbaru.    */
/* Tidak mengubah data tersimpan dan tidak dipakai untuk kalkulasi harga. */

const MATERIAL_LEGACY_ALIASES = {
  "EMBOSS 10K": "EMBOSS TOPO",
  "EMBOSS": "EMBOSS TOPO",
  "AIRWALK 10K": "AIRWALK",
  "BINTIK BRAZIL": "BINTIK",
};

export function normalizeMaterialName(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  // Kunci lookup: uppercase + buang tanda "+" + rapikan spasi
  // sehingga "EMBOSS +10K" dan "EMBOSS 10K" dianggap sama
  const key = raw.toUpperCase().replace(/\s*\+\s*/g, " ").replace(/\s+/g, " ").trim();
  return MATERIAL_LEGACY_ALIASES[key] || raw;
}
