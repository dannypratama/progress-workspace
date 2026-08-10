/* ============================================================= */
/* MASTER PRICE DATABASE & CONSTANTS (Single Source of Truth)    */
/* ============================================================= */

export const BAHAN = {
  milano: { nama: "Milano", kg: 0.35, harga: 60000, print: 12600 },
  emboss: { nama: "Emboss", kg: 0.34, harga: 60000, print: 12600 },
  airwalk: { nama: "Airwalk", kg: 0.4, harga: 71000, print: 12600 },
  rib: { nama: "Ribpoly", kg: 0.4, harga: 62000, print: 0 },
  lotto: { nama: "Lotto", kg: 0.4, harga: 62000, print: 12600 },
};

export const CFG = {
  printPressRate: 12600,
  estimasiRatio: 0.7,
  toastDuration: 2800,
};

export const DESIGN_STAGES = ["design", "revisi", "done"];
export const PRODUCTION_STAGES = ["design", "printing", "jahit", "qc", "done"];

export const KEYS = {
  autosave: "progress_autosave",
  history: "progress_costings",
  theme: "progress_theme",
  design_orders: "progress_design_orders",
  tasks: "progress_tasks",
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
      "bintik brazil": 0,
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
      },
      model: { panjang: 10000, "lengan panjang": 10000 },
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
      return product.matrix[category][materialGroup][orderType][sleeve] || 0;
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
  const tier = tiersArray.find((t) => qty >= t.min && qty <= t.max);
  return tier ? tier.price : 0;
}

export function calculateInvoiceItem(orderPayload) {
  const { productType, category, material, qty, sleeve, sizeDistribution, addonsSelected, customCharge } = orderPayload;
  const validQty = Math.max(0, qty || 0);
  const validCustomCharge = Number(customCharge) || 0;
  const basePrice = getProductBasePrice(productType, { qty: validQty, material, category, sleeve });
  let materialPremiumCharge = 0;
  const searchMat = (material || "").toLowerCase();
  if (MASTER_PRICE_DATABASE.materials[productType]) {
    const matRules = MASTER_PRICE_DATABASE.materials[productType];
    for (const key in matRules) {
      if (searchMat.includes(key)) { materialPremiumCharge = matRules[key]; break; }
    }
  }
  let totalAddonChargePerPcs = 0;
  if (addonsSelected && Array.isArray(addonsSelected) && MASTER_PRICE_DATABASE.addons[productType]) {
    const productAddons = MASTER_PRICE_DATABASE.addons[productType];
    addonsSelected.forEach((addonName) => {
      const cleaned = addonName.toLowerCase().trim();
      for (const section in productAddons) {
        if (productAddons[section][cleaned] !== undefined) {
          totalAddonChargePerPcs += productAddons[section][cleaned];
          break;
        }
      }
    });
  }
  let totalSizeChargeForGroup = 0;
  if (sizeDistribution && typeof sizeDistribution === "object") {
    const sizeRules = MASTER_PRICE_DATABASE.sizeCharges.global_apparel;
    for (const size in sizeDistribution) {
      const sizeQty = sizeDistribution[size] || 0;
      const chargePerPcs = sizeRules[size] !== undefined ? sizeRules[size] : 0;
      totalSizeChargeForGroup += chargePerPcs * sizeQty;
    }
  }
  const nominalBasePcs = basePrice + materialPremiumCharge + totalAddonChargePerPcs;
  const subtotalTanpaSizeDanCustom = nominalBasePcs * validQty;
  const grandSubtotalItem = subtotalTanpaSizeDanCustom + totalSizeChargeForGroup + validCustomCharge;
  const realHargaPerPcs = validQty > 0 ? grandSubtotalItem / validQty : 0;
  const productRules = MASTER_PRICE_DATABASE.rules[productType] || { downPaymentRatio: 0.5 };
  const dpRatio = productRules.downPaymentRatio;
  const downPaymentRequired = grandSubtotalItem * dpRatio;
  const remainingPayment = grandSubtotalItem - downPaymentRequired;
  let bonusMetadata = null;
  if (productRules.bonus && validQty >= productRules.bonus.minQty) {
    bonusMetadata = { item: productRules.bonus.type, qty: validQty };
  }
  return {
    basePricePerPcs: basePrice,
    addonAndPremiumChargePerPcs: materialPremiumCharge + totalAddonChargePerPcs,
    calculatedHargaPerPcs: Math.round(realHargaPerPcs),
    subtotal: Math.round(grandSubtotalItem),
    dpRequired: Math.round(downPaymentRequired),
    remainingPayment: Math.round(remainingPayment),
    bonus: bonusMetadata,
    productionEstimation: productRules.productionTime || "7-14 hari",
  };
}
