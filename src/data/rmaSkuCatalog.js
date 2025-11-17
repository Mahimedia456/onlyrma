// ===========================================================
// RMA SKU CATALOG — FULL EXPANDED LIST (US + EMEA)
// Name format: Product Name (US), Product Name (EMEA)
// Suffix rules exactly match Atomos tables
// ===========================================================

// Device names used in dropdowns
export const DEVICE_NAMES = [
  "Ninja", "Ninja V", "Ninja V Plus", "Ninja Ultra", "Ninja Phone",
  "Shinobi II", "Shinobi 7", "Shinobi GO", "Shogun Ultra",
  "Shogun Connect", "Sumo 19SE", "A-Eye PTZ camera", "Sun Hood",
  "Master Caddy III", "Atomos Connect", "AtomX Battery",
  "Ultrasync Blue", "AtomFlex HDMI Cable", "Atomos Creator Kit 5''",
];

// ===========================================================
// FULL PRODUCT LIST — US + EMEA separated
// ===========================================================
export const PRODUCT_SKUS = [

/* -----------------------------------------------------------
 *  SHINOBI / SHOGUN / NINJA PRODUCT FAMILY
 * --------------------------------------------------------- */

{
  name: "Shinobi II (US)",
  base: "ATOMSHB003",
  region: "US",
  variants: {
    normal: "ATOMSHB003-O",
    bstock: "ATOMSHB003-B-O",
    rstock: "ATOMSHB003-R-O",
  }
},
{
  name: "Shinobi II (EMEA)",
  base: "ATOMSHB003",
  region: "EMEA",
  variants: {
    normal: "ATOMSHB003-E",
    bstock: "ATOMSHB003-B-E",
    rstock: "ATOMSHB003-R-E",
  }
},

{
  name: "Shinobi 7 (US)",
  base: "ATOMSHB002",
  region: "US",
  variants: {
    normal: "ATOMSHB002-O",
    bstock: "ATOMSHB002-B-O",
    rstock: "ATOMSHB002-R-O",
  }
},
{
  name: "Shinobi 7 (EMEA)",
  base: "ATOMSHB002",
  region: "EMEA",
  variants: {
    normal: "ATOMSHB002-E",
    bstock: "ATOMSHB002-B-E",
    rstock: "ATOMSHB002-R-E",
  }
},

{
  name: "Ninja V (US)",
  base: "ATOMNJAV01",
  region: "US",
  variants: {
    normal: "ATOMNJAV01-O",
    bstock: "ATOMNJAV01-B-O",
    rstock: "ATOMNJAV01-R-O",
  }
},
{
  name: "Ninja V (EMEA)",
  base: "ATOMNJAV01",
  region: "EMEA",
  variants: {
    normal: "ATOMNJAV01-E",
    bstock: "ATOMNJAV01-B-E",
    rstock: "ATOMNJAV01-R-E",
  }
},

{
  name: "Ninja V Plus (US)",
  base: "ATOMNJVPL1",
  region: "US",
  variants: {
    normal: "ATOMNJVPL1-O",
    bstock: "ATOMNJVPL1-B-O",
    rstock: "ATOMNJVPL1-R-O",
  }
},
{
  name: "Ninja V Plus (EMEA)",
  base: "ATOMNJVPL1",
  region: "EMEA",
  variants: {
    normal: "ATOMNJVPL1-E",
    bstock: "ATOMNJVPL1-B-E",
    rstock: "ATOMNJVPL1-R-E",
  }
},

{
  name: "Ninja (new) (US)",
  base: "ATOMNJA004",
  region: "US",
  variants: {
    normal: "ATOMNJA004-O",
    bstock: "ATOMNJA004-B-O",
    rstock: "ATOMNJA004-R-O",
  }
},
{
  name: "Ninja (new) (EMEA)",
  base: "ATOMNJA004",
  region: "EMEA",
  variants: {
    normal: "ATOMNJA004-E",
    bstock: "ATOMNJA004-B-E",
    rstock: "ATOMNJA004-R-E",
  }
},

{
  name: "Ninja Ultra (US)",
  base: "ATOMNJAU01",
  region: "US",
  variants: {
    normal: "ATOMNJAU01-O",
    bstock: "ATOMNJAU01-B-O",
    rstock: "ATOMNJAU01-R-O",
  }
},
{
  name: "Ninja Ultra (EMEA)",
  base: "ATOMNJAU01",
  region: "EMEA",
  variants: {
    normal: "ATOMNJAU01-E",
    bstock: "ATOMNJAU01-B-E",
    rstock: "ATOMNJAU01-R-E",
  }
},

{
  name: "Ninja Phone (US)",
  base: "ATOMNJPB01",
  region: "US",
  variants: {
    normal: "ATOMNJPB01-O",
    bstock: "ATOMNJPB01-B-O",
    rstock: "ATOMNJPB01-R-O",
  }
},
{
  name: "Ninja Phone (EMEA)",
  base: "ATOMNJPB01",
  region: "EMEA",
  variants: {
    normal: "ATOMNJPB01-E",
    bstock: "ATOMNJPB01-B-E",
    rstock: "ATOMNJPB01-R-E",
  }
},

{
  name: "Shogun Connect (US)",
  base: "ATOMSHGCO1",
  region: "US",
  variants: {
    normal: "ATOMSHGCO1-O",
    bstock: "ATOMSHGCO1-B-O",
    rstock: "ATOMSHGCO1-R-O",
  }
},
{
  name: "Shogun Connect (EMEA)",
  base: "ATOMSHGCO1",
  region: "EMEA",
  variants: {
    normal: "ATOMSHGCO1-E",
    bstock: "ATOMSHGCO1-B-E",
    rstock: "ATOMSHGCO1-R-E",
  }
},

{
  name: "Shogun (new) (US)",
  base: "ATOMSHG002",
  region: "US",
  variants: {
    normal: "ATOMSHG002-O",
    bstock: "ATOMSHG002-B-O",
    rstock: "ATOMSHG002-R-O",
  }
},
{
  name: "Shogun (new) (EMEA)",
  base: "ATOMSHG002",
  region: "EMEA",
  variants: {
    normal: "ATOMSHG002-E",
    bstock: "ATOMSHG002-B-E",
    rstock: "ATOMSHG002-R-E",
  }
},

{
  name: "Shogun Ultra (US)",
  base: "ATOMSHGU01",
  region: "US",
  variants: {
    normal: "ATOMSHGU01-O",
    bstock: "ATOMSHGU01-B-O",
    rstock: "ATOMSHGU01-R-O",
  }
},
{
  name: "Shogun Ultra (EMEA)",
  base: "ATOMSHGU01",
  region: "EMEA",
  variants: {
    normal: "ATOMSHGU01-E",
    bstock: "ATOMSHGU01-B-E",
    rstock: "ATOMSHGU01-R-E",
  }
},

{
  name: "Shogun Classic (US)",
  base: "ATOMSHG701",
  region: "US",
  variants: {
    normal: "ATOMSHG701-O",
    bstock: "ATOMSHG701-B-O",
    rstock: "ATOMSHG701-R-O",
  }
},
{
  name: "Shogun Classic (EMEA)",
  base: "ATOMSHG701",
  region: "EMEA",
  variants: {
    normal: "ATOMSHG701-E",
    bstock: "ATOMSHG701-B-E",
    rstock: "ATOMSHG701-R-E",
  }
},

{
  name: "Shogun 7 (US)",
  base: "ATOMSHG701",
  region: "US",
  variants: {
    normal: "ATOMSHG701-O",
    bstock: "ATOMSHG701-B-O",
    rstock: "ATOMSHG701-R-O",
  }
},
{
  name: "Shogun 7 (EMEA)",
  base: "ATOMSHG701",
  region: "EMEA",
  variants: {
    normal: "ATOMSHG701-E",
    bstock: "ATOMSHG701-B-E",
    rstock: "ATOMSHG701-R-E",
  }
},

{
  name: "Sumo 19SE (US)",
  base: "ATOMSUMSE1",
  region: "US",
  variants: {
    normal: "ATOMSUMSE1-O",
    bstock: "ATOMSUMSE1-B-O",
    rstock: "ATOMSUMSE1-R-O",
  }
},
{
  name: "Sumo 19SE (EMEA)",
  base: "ATOMSUMSE1",
  region: "EMEA",
  variants: {
    normal: "ATOMSUMSE1-E",
    bstock: "ATOMSUMSE1-B-E",
    rstock: "ATOMSUMSE1-R-E",
  }
},
/* -----------------------------------------------------------
 *  ZATO / ACCESSORIES / CABLES
 * --------------------------------------------------------- */

{
  name: "Zato Connect (US)",
  base: "ATOMZATC01",
  region: "US",
  variants: {
    normal: "ATOMZATC01-O",
    bstock: "ATOMZATC01-B-O",
    rstock: "ATOMZATC01-R-O",
  }
},
{
  name: "Zato Connect (EMEA)",
  base: "ATOMZATC01",
  region: "EMEA",
  variants: {
    normal: "ATOMZATC01-E",
    bstock: "ATOMZATC01-B-E",
    rstock: "ATOMZATC01-R-E",
  }
},

{
  name: "Battery Eliminator (US)",
  base: "ATOMDCA001",
  region: "US",
  variants: {
    normal: "ATOMDCA001-O",
    bstock: "ATOMDCA001-B-O",
    rstock: null,
  }
},
{
  name: "Battery Eliminator (EMEA)",
  base: "ATOMDCA001",
  region: "EMEA",
  variants: {
    normal: "ATOMDCA001-E",
    bstock: "ATOMDCA001-B-E",
    rstock: null,
  }
},

{
  name: "AtomX Battery (US)",
  base: "ATOMBAT003",
  region: "US",
  variants: {
    normal: "ATOMBAT003-O",
    bstock: "ATOMBAT003-B-O",
    rstock: null,
  }
},
{
  name: "AtomX Battery (EMEA)",
  base: "ATOMBAT003",
  region: "EMEA",
  variants: {
    normal: "ATOMBAT003-E",
    bstock: "ATOMBAT003-B-E",
    rstock: null,
  }
},

{
  name: "Docking Station (US)",
  base: "ATOMDCK004",
  region: "US",
  variants: {
    normal: "ATOMDCK004-O",
    bstock: "ATOMDCK004-B-O",
    rstock: null,
  }
},
{
  name: "Docking Station (EMEA)",
  base: "ATOMDCK004",
  region: "EMEA",
  variants: {
    normal: "ATOMDCK004-E",
    bstock: "ATOMDCK004-B-E",
    rstock: null,
  }
},

/* -----------------------------------------------------------
 *  ATOMFLEX HDMI LOCKING
 * --------------------------------------------------------- */

...[
  ["ATOM4K60L1"],
  ["ATOM4K60L2"],
  ["ATOM4K60L3"],
].flatMap(([code]) => ([
  {
    name: `AtomFlex HDMI Locking (${code}) (US)`,
    base: code,
    region: "US",
    variants: {
      normal: `${code}-O`,
      bstock: `${code}-B-O`,
      rstock: null,
    }
  },
  {
    name: `AtomFlex HDMI Locking (${code}) (EMEA)`,
    base: code,
    region: "EMEA",
    variants: {
      normal: `${code}-E`,
      bstock: `${code}-B-E`,
      rstock: null,
    }
  }
])),

/* -----------------------------------------------------------
 *  ATOMFLEX HDMI STANDARD
 * --------------------------------------------------------- */

...[
  "ATOM4K60C1", "ATOM4K60C2", "ATOM4K60C3",
  "ATOM4K60C4", "ATOM4K60C5", "ATOM4K60C6",
  "ATOMCAB007", "ATOMCAB008", "ATOMCAB009",
  "ATOMCAB010", "ATOMCAB011", "ATOMCAB012",
  "ATOMCAB013", "ATOMCAB014", "ATOMCAB015"
].flatMap(code => ([
  {
    name: `AtomFlex HDMI (${code}) (US)`,
    base: code,
    region: "US",
    variants: {
      normal: `${code}-O`,
      bstock: `${code}-B-O`,
      rstock: null,
    }
  },
  {
    name: `AtomFlex HDMI (${code}) (EMEA)`,
    base: code,
    region: "EMEA",
    variants: {
      normal: `${code}-E`,
      bstock: `${code}-B-E`,
      rstock: null,
    }
  }
])),

/* -----------------------------------------------------------
 *  ULTRASYNC SYSTEM (special case — EMEA uses ROW codes)
 * --------------------------------------------------------- */

{
  name: "UltraSync One (US)",
  base: "ATOMSYON1",
  region: "US",
  variants: {
    normal: "ATOMSYON1-US",
    bstock: "ATOMSYONO1-B-O",
    rstock: null,
  }
},
{
  name: "UltraSync One (EMEA)",
  base: "ATOMSYON01",
  region: "EMEA",
  variants: {
    normal: "ATOMSYON01-E",
    bstock: "ATOMSYON01-B-E",
    rstock: null,
  }
},

{
  name: "UltraSync Blue (US)",
  base: "ATOMSYBL1",
  region: "US",
  variants: {
    normal: "ATOMSYBL1-US",
    bstock: "ATOMSYBL1-US-B-O",
    rstock: null,
  }
},
{
  name: "UltraSync Blue (EMEA)",
  base: "ATOMSYBL1",
  region: "EMEA",
  variants: {
    normal: "ATOMSYBL1-E",
    bstock: "ATOMSYBL1-B-E",
    rstock: null,
  }
},

/* -----------------------------------------------------------
 *  ATOMX MODULES
 * --------------------------------------------------------- */

{
  name: "AtomX Cast (US)",
  base: "ATOMXCST01",
  region: "US",
  variants: {
    normal: "ATOMXCST01-O",
    bstock: "ATOMXCST01-B-O",
    rstock: null,
  }
},
{
  name: "AtomX Cast (EMEA)",
  base: "ATOMXCST01",
  region: "EMEA",
  variants: {
    normal: "ATOMXCST01-E",
    bstock: "ATOMXCST01-B-E",
    rstock: null,
  }
},

{
  name: "AtomX Fast Charger (US)",
  base: "ATOMFCGRS2",
  region: "US",
  variants: {
    normal: "ATOMFCGRS2-O",
    bstock: "ATOMFCGRS2-B-O",
    rstock: null,
  }
},
{
  name: "AtomX Fast Charger (EMEA)",
  base: "ATOMFCGRS2",
  region: "EMEA",
  variants: {
    normal: "ATOMFCGRS2-E",
    bstock: "ATOMFCGRS2-B-E",
    rstock: null,
  }
},

{
  name: "AtomX Sync Module (US)",
  base: "ATOMXSYNC1",
  region: "US",
  variants: {
    normal: "ATOMXSYNC1-O",
    bstock: "ATOMXSYNC1-B-O",
    rstock: null,
  }
},
{
  name: "AtomX Sync Module (EMEA)",
  base: "ATOMXSYNC1",
  region: "EMEA",
  variants: {
    normal: "ATOMXSYNC1-E",
    bstock: "ATOMXSYNC1-B-E",
    rstock: null,
  }
},

{
  name: "Power Kit 2 (US)",
  base: "ATOMXPWKT2",
  region: "US",
  variants: {
    normal: "ATOMXPWKT2-O",
    bstock: "ATOMXPWKT2-B-O",
    rstock: null,
  }
},
{
  name: "Power Kit 2 (EMEA)",
  base: "ATOMXPWKT2",
  region: "EMEA",
  variants: {
    normal: "ATOMXPWKT2-E",
    bstock: "ATOMXPWKT2-B-E",
    rstock: null,
  }
},

{
  name: "DC to D-Tap Cable (US)",
  base: "ATOMDTPCB2",
  region: "US",
  variants: {
    normal: "ATOMDTPCB2-O",
    bstock: "ATOMDTPCB2-B-O",
    rstock: null,
  }
},
{
  name: "DC to D-Tap Cable (EMEA)",
  base: "ATOMDTPCB2",
  region: "EMEA",
  variants: {
    normal: "ATOMDTPCB2-E",
    bstock: "ATOMDTPCB2-B-E",
    rstock: null,
  }
},

{
  name: "Accessory Kit Version II (US)",
  base: "ATOMACCKT4",
  region: "US",
  variants: {
    normal: "ATOMACCKT4-O",
    bstock: "ATOMACCKT4-B-O",
    rstock: null,
  }
},
{
  name: "Accessory Kit Version II (EMEA)",
  base: "ATOMACCKT4",
  region: "EMEA",
  variants: {
    normal: "ATOMACCKT4-E",
    bstock: "ATOMACCKT4-B-E",
    rstock: null,
  }
},

{
  name: "Atomos Connect (US)",
  base: "ATOMCON003",
  region: "US",
  variants: {
    normal: "ATOMCON003-O",
    bstock: "ATOMCON003-B-O",
    rstock: null,
  }
},
{
  name: "Atomos Connect (EMEA)",
  base: "ATOMCON003",
  region: "EMEA",
  variants: {
    normal: "ATOMCON003-E",
    bstock: "ATOMCON003-B-E",
    rstock: null,
  }
},

/* -----------------------------------------------------------
 *  LEGACY PRODUCTS (NINJA FLAME → SAMURAI BLADE)
 * --------------------------------------------------------- */

{
  name: "Ninja Flame (US)",
  base: "ATOMNJAFL2",
  region: "US",
  variants: {
    normal: "ATOMNJAFL2-O",
    bstock: "ATOMNJAFL2-B-O",
    rstock: "ATOMNJAFL2-R-O",
  }
},
{
  name: "Ninja Flame (EMEA)",
  base: "ATOMNJAFL2",
  region: "EMEA",
  variants: {
    normal: "ATOMNJAFL2-E",
    bstock: "ATOMNJAFL2-B-E",
    rstock: "ATOMNJAFL2-R-E",
  }
},

{
  name: "Ninja Inferno (US)",
  base: "ATOMNJAIN1",
  region: "US",
  variants: {
    normal: "ATOMNJAIN1-O",
    bstock: "ATOMNJAIN1-B-O",
    rstock: "ATOMNJAIN1-R-O",
  }
},
{
  name: "Ninja Inferno (EMEA)",
  base: "ATOMNJAIN1",
  region: "EMEA",
  variants: {
    normal: "ATOMNJAIN1-E",
    bstock: "ATOMNJAIN1-B-E",
    rstock: "ATOMNJAIN1-R-E",
  }
},

{
  name: "Ninja Blade (US)",
  base: "ATOMNJB001",
  region: "US",
  variants: {
    normal: "ATOMNJB001-O",
    bstock: "ATOMNJB001-B-O",
    rstock: "ATOMNJB001-R-O",
  }
},
{
  name: "Ninja Blade (EMEA)",
  base: "ATOMNJB001",
  region: "EMEA",
  variants: {
    normal: "ATOMNJB001-E",
    bstock: "ATOMNJB001-B-E",
    rstock: "ATOMNJB001-R-E",
  }
},

{
  name: "Shinobi HDMI (US)",
  base: "ATOMSHBH01",
  region: "US",
  variants: {
    normal: "ATOMSHBH01-O",
    bstock: "ATOMSHBH01-B-O",
    rstock: "ATOMSHBH01-R-O",
  }
},
{
  name: "Shinobi HDMI (EMEA)",
  base: "ATOMSHBH01",
  region: "EMEA",
  variants: {
    normal: "ATOMSHBH01-E",
    bstock: "ATOMSHBH01-B-E",
    rstock: "ATOMSHBH01-R-E",
  }
},

{
  name: "Shinobi SDI (US)",
  base: "ATOMSHBS01",
  region: "US",
  variants: {
    normal: "ATOMSHBS01-O",
    bstock: "ATOMSHBS01-B-O",
    rstock: "ATOMSHBS01-R-O",
  }
},
{
  name: "Shinobi SDI (EMEA)",
  base: "ATOMSHBS01",
  region: "EMEA",
  variants: {
    normal: "ATOMSHBS01-E",
    bstock: "ATOMSHBS01-B-E",
    rstock: "ATOMSHBS01-R-E",
  }
},

{
  name: "Shogun Inferno (US)",
  base: "ATOMSHGIN2",
  region: "US",
  variants: {
    normal: "ATOMSHGIN2-O",
    bstock: "ATOMSHGIN2-B-O",
    rstock: "ATOMSHGIN2-R-O",
  }
},
{
  name: "Shogun Inferno (EMEA)",
  base: "ATOMSHGIN2",
  region: "EMEA",
  variants: {
    normal: "ATOMSHGIN2-E",
    bstock: "ATOMSHGIN2-B-E",
    rstock: "ATOMSHGIN2-R-E",
  }
},

{
  name: "Shogun Flame (US)",
  base: "ATOMSHGFL1",
  region: "US",
  variants: {
    normal: "ATOMSHGFL1-O",
    bstock: "ATOMSHGFL1-B-O",
    rstock: "ATOMSHGFL1-R-O",
  }
},
{
  name: "Shogun Flame (EMEA)",
  base: "ATOMSHGFL1",
  region: "EMEA",
  variants: {
    normal: "ATOMSHGFL1-E",
    bstock: "ATOMSHGFL1-B-E",
    rstock: "ATOMSHGFL1-R-E",
  }
},

{
  name: "Shogun (US)",
  base: "ATOMSHG001",
  region: "US",
  variants: {
    normal: "ATOMSHG001-O",
    bstock: "ATOMSHG001-B-O",
    rstock: "ATOMSHG001-R-O",
  }
},
{
  name: "Shogun (EMEA)",
  base: "ATOMSHG001",
  region: "EMEA",
  variants: {
    normal: "ATOMSHG001-E",
    bstock: "ATOMSHG001-B-E",
    rstock: "ATOMSHG001-R-E",
  }
},

{
  name: "Shogun Studio (US)",
  base: "ATOMSHSTU01",
  region: "US",
  variants: {
    normal: "ATOMSHSTU01-O",
    bstock: "ATOMSHSTU01-B-O",
    rstock: "ATOMSHSTU01-R-O",
  }
},
{
  name: "Shogun Studio (EMEA)",
  base: "ATOMSHSTU01",
  region: "EMEA",
  variants: {
    normal: "ATOMSHSTU01-E",
    bstock: "ATOMSHSTU01-B-E",
    rstock: "ATOMSHSTU01-R-E",
  }
},

{
  name: "Shogun Studio 2 (US)",
  base: "ATOMSHSTU2",
  region: "US",
  variants: {
    normal: "ATOMSHSTU2-O",
    bstock: "ATOMSHSTU2-B-O",
    rstock: "ATOMSHSTU2-R-O",
  }
},
{
  name: "Shogun Studio 2 (EMEA)",
  base: "ATOMSHSTU2",
  region: "EMEA",
  variants: {
    normal: "ATOMSHSTU2-E",
    bstock: "ATOMSHSTU2-B-E",
    rstock: "ATOMSHSTU2-R-E",
  }
},

{
  name: "Sumo 19 (US)",
  base: "ATOMSUMO19",
  region: "US",
  variants: {
    normal: "ATOMSUMO19-O",
    bstock: "ATOMSUMO19-B-O",
    rstock: "ATOMSUMO19-R-O",
  }
},
{
  name: "Sumo 19 (EMEA)",
  base: "ATOMSUMO19",
  region: "EMEA",
  variants: {
    normal: "ATOMSUMO19-E",
    bstock: "ATOMSUMO19-B-E",
    rstock: "ATOMSUMO19-R-E",
  }
},

{
  name: "Sumo 19M (US)",
  base: "ATOMSUMO19M",
  region: "US",
  variants: {
    normal: "ATOMSUMO19M-O",
    bstock: "ATOMSUMO19M-B-O",
    rstock: "ATOMSUMO19M-R-O",
  }
},
{
  name: "Sumo 19M (EMEA)",
  base: "ATOMSUMO19M",
  region: "EMEA",
  variants: {
    normal: "ATOMSUMO19M-E",
    bstock: "ATOMSUMO19M-B-E",
    rstock: "ATOMSUMO19M-R-E",
  }
},

{
  name: "Samurai Blade (US)",
  base: "ATOMSAM002",
  region: "US",
  variants: {
    normal: "ATOMSAM002-O",
    bstock: "ATOMSAM002-B-O",
    rstock: "ATOMSAM002-R-O",
  }
},
{
  name: "Samurai Blade (EMEA)",
  base: "ATOMSAM002",
  region: "EMEA",
  variants: {
    normal: "ATOMSAM002-E",
    bstock: "ATOMSAM002-B-E",
    rstock: "ATOMSAM002-R-E",
  }
},

]; // end PRODUCT_SKUS array
// ===========================================================
// LOOKUP MAPS — Used by your RMA Entry UI
// ===========================================================

// Map SKU code → product name
export const SKU_BY_CODE = new Map();
export const CODE_BY_NAME = new Map();

// Populate maps
for (const p of PRODUCT_SKUS) {
  // Name → Base code lookup (lowercased)
  CODE_BY_NAME.set(p.name.toLowerCase(), p.base);

  // All variants → product name lookup
  if (p.variants.normal) SKU_BY_CODE.set(p.variants.normal, p.name);
  if (p.variants.bstock) SKU_BY_CODE.set(p.variants.bstock, p.name);
  if (p.variants.rstock) SKU_BY_CODE.set(p.variants.rstock, p.name);
}
