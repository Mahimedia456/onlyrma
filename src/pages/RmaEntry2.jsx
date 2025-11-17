// =======================================
// RmaEntry.jsx — PART 1 / 4
// IMPORTS + CONSTANTS + GROUPED PRODUCT SYSTEM
// =======================================

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// ----------------------------------------------
// RMA Categories (unchanged)
// ----------------------------------------------
const CATEGORIES = ["product-fault", "warranty", "out-of-warranty", "other"];

// ----------------------------------------------
// Supported Regions
// ----------------------------------------------
const ORGS = ["US", "EMEA"];

// ----------------------------------------------
// DEVICE NAMES (Grouped)
// ----------------------------------------------
const DEVICE_GROUPS = {
  "Ninja Series": [
    "Ninja",
    "Ninja V",
    "Ninja V Plus",
    "Ninja Ultra",
    "Ninja Phone",
    "Ninja Flame",
    "Ninja Inferno",
    "Ninja Blade",
  ],
  "Shinobi Series": [
    "Shinobi II",
    "Shinobi 7",
    "Shinobi GO",
    "Shinobi HDMI",
    "Shinobi SDI",
  ],
  "Shogun Series": [
    "Shogun Ultra",
    "Shogun Connect",
    "Shogun (new)",
    "Shogun Classic",
    "Shogun 7",
    "Shogun Inferno",
    "Shogun Flame",
    "Shogun",
    "Shogun Studio",
    "Shogun Studio 2",
  ],
  "Sumo Series": ["Sumo 19SE", "Sumo 19", "Sumo 19M"],
  Accessories: [
    "A-Eye PTZ camera",
    "Sun Hood",
    "Master Caddy III",
    "Atomos Connect",
    "AtomX Battery",
    "Ultrasync Blue",
    "Docking Station",
    "AtomFlex HDMI Cable",
    "Atomos Creator Kit 5''",
    "Zato Connect",
    "Battery Eliminator",
    "AtomX Cast",
    "AtomX Fast Charger",
    "AtomX Sync Module",
    "Power Kit 2",
    "DC to Dtap cable",
    "Accessory Kit Version II",
  ],
  Cables: [
    "AtomFlex HDMI locking L1",
    "AtomFlex HDMI locking L2",
    "AtomFlex HDMI locking L3",
    "AtomFlex HDMI C1",
    "AtomFlex HDMI C2",
    "AtomFlex HDMI C3",
    "AtomFlex HDMI C4",
    "AtomFlex HDMI C5",
    "AtomFlex HDMI C6",
    "AtomFlex HDMI CAB007",
    "AtomFlex HDMI CAB008",
    "AtomFlex HDMI CAB009",
    "AtomFlex HDMI CAB010",
    "AtomFlex HDMI CAB011",
    "AtomFlex HDMI CAB012",
    "AtomFlex HDMI CAB013",
    "AtomFlex HDMI CAB014",
    "AtomFlex HDMI CAB015",
  ],
  "UltraSync Series": ["UltraSync One", "UltraSync Blue"],
};

// Flatten device list
const DEVICE_NAMES = Object.values(DEVICE_GROUPS).flat();

// ----------------------------------------------
// PRODUCT SKU CATALOG (base codes only)
// (Grouping applies to dropdown UI only)
// ----------------------------------------------
const PRODUCT_GROUPS = {
  "Shinobi Series": [
    { name: "Shinobi II", code: "ATOMSHB003" },
    { name: "Shinobi HDMI", code: "ATOMSHBH01" },
    { name: "Shinobi SDI", code: "ATOMSHBS01" },
    { name: "Shinobi 7", code: "ATOMSHB002" },
  ],
  "Ninja Series": [
    { name: "Ninja V", code: "ATOMNJAV01" },
    { name: "Ninja V Plus", code: "ATOMNJVPL1" },
    { name: "Ninja (new)", code: "ATOMNJA004" },
    { name: "Ninja Ultra", code: "ATOMNJAU01" },
    { name: "Ninja Phone", code: "ATOMNJPB01" },
    { name: "Ninja Flame", code: "ATOMNJAFL2" },
    { name: "Ninja Inferno", code: "ATOMNJAIN1" },
    { name: "Ninja Blade", code: "ATOMNJB001" },
  ],
  "Shogun Series": [
    { name: "Shogun Connect", code: "ATOMSHGCO1" },
    { name: "Shogun (new)", code: "ATOMSHG002" },
    { name: "Shogun Ultra", code: "ATOMSHGU01" },
    { name: "Shogun Classic", code: "ATOMSHG701" },
    { name: "Shogun 7", code: "ATOMSHG701" },
    { name: "Shogun Inferno", code: "ATOMSHGIN2" },
    { name: "Shogun Flame", code: "ATOMSHGFL1" },
    { name: "Shogun", code: "ATOMSHG001" },
    { name: "Shogun Studio", code: "ATOMSHSTU01" },
    { name: "Shogun Studio 2", code: "ATOMSHSTU2" },
  ],
  "Sumo Series": [
    { name: "Sumo 19SE", code: "ATOMSUMSE1" },
    { name: "Sumo 19", code: "ATOMSUMO19" },
    { name: "Sumo 19M", code: "ATOMSUMO19M" },
  ],
  "Zato / UltraSync / Accessories": [
    { name: "Zato Connect", code: "ATOMZATC01" },
    { name: "UltraSync One", code: "ATOMSYON1" },
    { name: "UltraSync Blue", code: "ATOMSYBL1" },
    { name: "Battery Eliminator", code: "ATOMDCA001" },
    { name: "AtomX Battery", code: "ATOMBAT003" },
    { name: "Docking Station", code: "ATOMDCK004" },
    { name: "AtomX Cast", code: "ATOMXCST01" },
    { name: "AtomX Fast Charger", code: "ATOMFCGRS2" },
    { name: "AtomX Sync Module", code: "ATOMXSYNC1" },
    { name: "Power Kit 2", code: "ATOMXPWKT2" },
    { name: "DC to Dtap cable", code: "ATOMDTPCB2" },
    { name: "Accessory Kit Version II", code: "ATOMACCKT4" },
    { name: "Atomos Connect", code: "ATOMCON003" },
  ],
  Cables: [
    { name: "AtomFlex HDMI locking", code: "ATOM4K60L1" },
    { name: "AtomFlex HDMI locking", code: "ATOM4K60L2" },
    { name: "AtomFlex HDMI locking", code: "ATOM4K60L3" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C1" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C2" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C3" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C4" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C5" },
    { name: "AtomFlex HDMI", code: "ATOM4K60C6" },
    { name: "AtomFlex HDMI", code: "ATOMCAB007" },
    { name: "AtomFlex HDMI", code: "ATOMCAB008" },
    { name: "AtomFlex HDMI", code: "ATOMCAB009" },
    { name: "AtomFlex HDMI", code: "ATOMCAB010" },
    { name: "AtomFlex HDMI", code: "ATOMCAB011" },
    { name: "AtomFlex HDMI", code: "ATOMCAB012" },
    { name: "AtomFlex HDMI", code: "ATOMCAB013" },
    { name: "AtomFlex HDMI", code: "ATOMCAB014" },
    { name: "AtomFlex HDMI", code: "ATOMCAB015" },
  ],
};

// Flatten for lookups
const PRODUCT_SKUS = Object.values(PRODUCT_GROUPS)
  .flat()
  .filter(Boolean);

// Map base code → name
const SKU_BY_CODE = PRODUCT_SKUS.reduce((map, p) => {
  if (!map.has(p.code)) map.set(p.code, p.name);
  return map;
}, new Map());

// Map name → base code
const CODE_BY_NAME = PRODUCT_SKUS.reduce((map, p) => {
  const key = p.name.toLowerCase();
  if (!map.has(key)) map.set(key, p.code);
  return map;
}, new Map());

// ----------------------------------------------
// REGION-BASED SKU VARIANT LOGIC (US / EMEA)
// ----------------------------------------------

/**
 * Convert a base SKU (ATOMxxxx) into a region-specific SKU:
 *
 * US:
 *   Original → -O
 *   B-Stock  → -B-O
 *   R-Stock  → -R-O
 *
 * EMEA:
 *   Original → -E
 *   B-Stock  → -B-E
 *   R-Stock  → -R-E
 *
 * Already-variant SKUs pass through unchanged.
 */
function toRegionSku(baseSku, region, stockType) {
  if (!baseSku) return baseSku;

  // Already has -O / -E / -B-O / -B-E / -R-O / -R-E
  if (isVariantSku(baseSku)) return baseSku;

  const reg = (region || "").toUpperCase();
  const st = (stockType || "").toLowerCase();

  const isR = st.includes("r-stock");
  const isB = !isR && st.includes("b-stock");

  if (reg === "US") {
    if (isR) return `${baseSku}-R-O`;
    if (isB) return `${baseSku}-B-O`;
    return `${baseSku}-O`;
  }

  if (reg === "EMEA") {
    if (isR) return `${baseSku}-R-E`;
    if (isB) return `${baseSku}-B-E`;
    return `${baseSku}-E`;
  }

  return baseSku;
}

function isVariantSku(code) {
  if (!code) return false;
  return /-(?:O|E|US|B-O|B-E|R-O|R-E)$/i.test(code.trim());
}

// ----------------------------------------------
// Small utilities shared across file
// ----------------------------------------------
function fmtDate(v) {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const only = v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(only)) return only;
    const d = new Date(v);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  }
  return "";
}

function safeJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}
// =======================================
// RmaEntry.jsx — PART 2 / 4
// MAIN WRAPPER + RMA LISTS
// =======================================

export default function RmaEntry() {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [tab, setTab] = useState("lists");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 space-y-4">
      {/* Tabs */}
      <div className="inline-flex rounded-xl border overflow-hidden">
        <TabButton active={tab === "lists"} onClick={() => setTab("lists")}>
          RMA Lists
        </TabButton>

        {!isViewer && (
          <TabButton active={tab === "new"} onClick={() => setTab("new")}>
            New RMA Entry
          </TabButton>
        )}
      </div>

      {/* Content */}
      {tab === "lists" ? (
        <RmaLists refreshKey={refreshKey} />
      ) : (
        <RmaForm
          onSaved={() => {
            setRefreshKey((n) => n + 1);
            setTab("lists");
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 ${
        active ? "bg-black text-white" : "bg-white hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

// =========================================================
// RMA LISTS SECTION
// =========================================================

function RmaLists({ refreshKey }) {
  const API = import.meta.env.VITE_API_BASE || "";
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    month: "",
    category: "",
    search: "",
    year: "",
    fromMonth: "",
    toMonth: "",
    fromDate: "",
    toDate: "",
    stock_type: "",
    organization: "",
  });

  const [editRow, setEditRow] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef(null);

  // --------------------------
  // Fetch list from server
  // --------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const qs = new URLSearchParams({
          month: filters.month,
          category: filters.category,
        });

        const res = await fetch(apiUrl(`/rma/entries?${qs.toString()}`), {
          credentials: "include",
        });

        const data = await safeJson(res);
        setRows(data?.entries || []);
      } catch (err) {
        console.error("Fetch error", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters.month, filters.category, refreshKey]);

  // --------------------------
  // Group entries by month (for tiles)
  // --------------------------
  const grouped = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const d = new Date(r.entry_date);
      if (isNaN(d)) return;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym).push(r);
    });
    return m;
  }, [rows]);

  // --------------------------
  // Dynamic year dropdown
  // --------------------------
  const yearOptions = useMemo(() => {
    const ys = new Set();
    rows.forEach((r) => {
      const d = new Date(r.entry_date);
      if (!isNaN(d)) ys.add(d.getFullYear());
    });
    return [...ys].sort((a, b) => a - b);
  }, [rows]);

  // ======================================================
  // CSV EXPORT
  // ======================================================
  async function exportCSV() {
    const list = filteredRows;

    if (!list.length) return alert("No rows to export.");

    const columns = [
      "id",
      "entry_date",
      "rma_no",
      "ticket_id",
      "first_name",
      "last_name",
      "email",
      "phone",
      "company",
      "reseller_customer",
      "address1",
      "address2",
      "city",
      "state",
      "country",
      "postcode",
      "product_with_fault",
      "serial_number",
      "product_sku",
      "device_name",
      "category",
      "rma_type",
      "stock_type",
      "quantity",
      "returned_reason",
      "action",
      "custom_tracking",
      "replacement_tracking",
      "created_at",
      "updated_at",
      "organization",
    ];

    const lines = [];
    lines.push(columns.join(","));

    for (const r of list) {
      const row = columns.map((c) => csvEscape(r[c] ?? ""));
      lines.push(row.join(","));
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "RMA_Export.csv";
    a.click();
  }

  // ======================================================
  // CSV IMPORT
  // ======================================================
  async function handleImportFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    try {
      setImporting(true);
      setImportMsg("Reading file…");

      const text = await f.text();
      const { headers, records } = parseCsv(text);

      if (!headers.length || !records.length) {
        setImportMsg("Invalid or empty CSV.");
        return;
      }

      const idx = new Map(headers.map((h, i) => [h.trim(), i]));
      const get = (row, h) => {
        const pos = idx.get(h);
        return pos == null ? "" : row[pos];
      };

      const items = records.map((rObj) => {
        const rowArr = headers.map((h) => rObj[h] ?? "");
        const obj = {};

        for (const [human, canon] of Object.entries(HUMAN_TO_CANON)) {
          obj[canon] = get(rowArr, human);
        }

        obj.entry_date = fmtDate(obj.entry_date);
        obj.quantity = Number(obj.quantity || 0);

        return obj;
      });

      setImportMsg("Uploading records…");

      const res = await fetch(`${API}/api/rma/entries/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await safeJson(res);

      if (!res.ok) return alert(data?.error || "Import failed.");

      setImportMsg(`Imported ${data?.imported || items.length} rows.`);
    } catch (err) {
      console.error(err);
      setImportMsg("Import failed.");
    } finally {
      setImporting(false);
    }
  }

  // ======================================================
  // CLIENT-SIDE FILTERING
  // ======================================================
  const filteredRows = useMemo(() => {
    let list = rows;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter((r) =>
        [
          r.rma_no,
          r.ticket_id,
          r.first_name,
          r.last_name,
          r.email,
          r.phone,
          r.company,
          r.reseller_customer,
          r.product_with_fault,
          r.product_sku,
          r.device_name,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (filters.organization) {
      list = list.filter((r) => r.organization === filters.organization);
    }

    if (filters.stock_type) {
      list = list.filter((r) => r.stock_type === filters.stock_type);
    }

    if (filters.year) {
      const yearNum = Number(filters.year);
      list = list.filter((r) => {
        const d = new Date(r.entry_date);
        return !isNaN(d) && d.getFullYear() === yearNum;
      });
    }

    if (filters.fromDate || filters.toDate) {
      list = list.filter((r) => {
        const date = fmtDate(r.entry_date);
        if (!date) return false;
        if (filters.fromDate && date < filters.fromDate) return false;
        if (filters.toDate && date > filters.toDate) return false;
        return true;
      });
    }

    return list;
  }, [rows, filters]);

  // ------------------------------
  // Pagination logic
  // ------------------------------
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const start = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.year,
    filters.fromDate,
    filters.toDate,
    filters.category,
    filters.stock_type,
    filters.organization,
    pageSize,
  ]);

  // ======================================================
  // DELETE ENTRY
  // ======================================================
  async function remove(id) {
    if (!confirm("Delete this entry?")) return;

    const res = await fetch(apiUrl(`/rma/entries/${id}`), {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) return alert("Delete failed");

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // ======================================================
  // RENDER UI
  // ======================================================

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <Filters filters={filters} setFilters={setFilters} yearOptions={yearOptions} />

      {importMsg && <div className="text-xs text-gray-600">{importMsg}</div>}

      {/* MONTH TILES */}
      <MonthTiles grouped={grouped} setFilters={setFilters} />

      {/* TABLE */}
      <RmaTable
        loading={loading}
        rows={pageRows}
        start={start}
        remove={remove}
        setEditRow={setEditRow}
      />

      {/* PAGINATION */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        total={total}
        shown={pageRows.length}
        start={start}
      />

      {/* EDIT MODAL */}
      {editRow && (
        <EditModal
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSave={(patch) => {
            // Updating rows locally happens in Part 3
          }}
        />
      )}
    </div>
  );
}
// =======================================
// RmaEntry.jsx — PART 3 / 4
// NEW RMA ENTRY FORM (With Grouped Device + Grouped SKU)
// =======================================

function RmaForm({ onSaved }) {
  const [org, setOrg] = useState("EMEA");
  const [skuQuery, setSkuQuery] = useState("");

  const [form, setForm] = useState({
    entry_date: fmtDate(Date.now()),
    ticket_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    reseller_customer: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    postcode: "",
    product_with_fault: "",
    serial_number: "",
    product_sku: "",
    device_name: "",
    rma_type: "",
    stock_type: "",
    quantity: 1,
    returned_reason: "",
    action: "",
    custom_tracking: "",
    rma_no: "",
    replacement_tracking: "",
    category: "",
    organization: "EMEA",
  });

  // US + EMEA stock mini-forms
  const [stockUs, setStockUs] = useState({ ...STOCK_DEFAULT_US });
  const [stockEmea, setStockEmea] = useState({ ...STOCK_DEFAULT_EMEA });

  // Keep organization mirrored inside form
  useEffect(() => {
    setForm((f) => ({ ...f, organization: org }));
  }, [org]);

  // =============================
  // AUTO-FILL product name on SKU change
  // =============================
  useEffect(() => {
    if (!form.product_sku) return;
    const name = SKU_BY_CODE.get(form.product_sku) || "";
    if (!name) return;
    setForm((f) => ({
      ...f,
      product_with_fault: f.product_with_fault || name,
    }));
  }, [form.product_sku]);

  const stockOptions = org === "US" ? STOCK_TYPES_US : STOCK_TYPES_EMEA;

  const update = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]:
        k === "quantity"
          ? Number(e.target.value || 0)
          : e.target.value,
    }));

  // =============================
  // Commit quick search SKU input
  // =============================
  function commitSkuFromQuery() {
    const raw = skuQuery.trim();
    if (!raw) return;

    const last = raw.includes("—") ? raw.split("—").pop().trim() : raw;
    let found = "";

    if (SKU_BY_CODE.has(last)) found = last;
    else if (CODE_BY_NAME.has(raw.toLowerCase()))
      found = CODE_BY_NAME.get(raw.toLowerCase());

    if (found) {
      const name = SKU_BY_CODE.get(found) || "";
      setForm((f) => ({
        ...f,
        product_sku: found,
        product_with_fault: f.product_with_fault || name,
      }));
      setSkuQuery(`${name} — ${found}`);
    }
  }

  // =============================
  // GROUPED DEVICE DROPDOWN
  // =============================
  const DEVICE_GROUPS = DEVICE_GROUPS; // from PART 1

  // =============================
  // GROUPED SKU DROPDOWN
  // =============================
  // Build grouped structure from PRODUCT_SKUS_GROUPED
  const SKU_GROUPS = Object.entries(PRODUCT_SKUS_GROUPED).map(
    ([group, items]) => ({
      group,
      items,
    })
  );

  // =============================
  // SAVE ENTRY
  // =============================
  async function save() {
    if (!form.entry_date) return alert("Entry date required");
    if (!form.device_name && !form.product_sku)
      return alert("You must select a product or SKU");

    // Fill product name from SKU if needed
    const name = form.product_sku ? SKU_BY_CODE.get(form.product_sku) : "";

    const payload = {
      ...form,
      product_with_fault: form.product_with_fault || name || "",
      entry_date: fmtDate(form.entry_date),
    };

    // Region-specific SKU: baseSKU -> region-suffixed variant
    payload.product_sku = toRegionSku(
      payload.product_sku,
      payload.organization,
      payload.stock_type
    );

    const res = await fetch(apiUrl(`/rma/entries`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await safeJson(res);
      return alert(err?.error || "Save failed");
    }

    alert("Saved successfully!");

    // Add to RMA stock if fields filled
    const isUs = org === "US";
    const stock = isUs ? { ...stockUs } : { ...stockEmea };

    const hasValues =
      Object.entries(stock).some(([k, v]) => k !== "notes" && Number(v) !== 0) ||
      (stock.notes || "").trim() !== "";

    if (hasValues) {
      const confirmAdd = confirm(`Add to ${org} RMA Stock as well?`);
      if (confirmAdd) {
        const entryMonth = toMonth(payload.entry_date);
        const stockBody = {
          month: entryMonth,
          device_name: payload.device_name || "—",
          ...numberizeAll(stock),
        };

        const path = apiUrl(isUs ? `/rma/us/stock` : `/rma/emea/stock`);
        const sres = await fetch(path, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stockBody),
        });

        if (!sres.ok) {
          alert("Stock save failed");
        } else {
          if (isUs) setStockUs({ ...STOCK_DEFAULT_US });
          else setStockEmea({ ...STOCK_DEFAULT_EMEA });
        }
      }
    }

    onSaved?.();
  }

  // ======================================
  // RENDER FORM
  // ======================================

  return (
    <div className="space-y-4">
      {/* =============================== */}
      {/*  HEADER CONTROLS */}
      {/* =============================== */}
      <div className="rounded-xl border p-3 flex flex-wrap gap-4 items-end">
        {/* Region */}
        <div>
          <div className="text-xs text-gray-600 mb-1">Organization</div>
          <select
            className="border rounded px-3 py-2"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          >
            {ORGS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Type */}
        <div>
          <div className="text-xs text-gray-600 mb-1">Stock Type</div>
          <select
            className="border rounded px-3 py-2"
            value={form.stock_type}
            onChange={update("stock_type")}
          >
            <option value="">Select…</option>
            {stockOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* RMA Type */}
        <div>
          <div className="text-xs text-gray-600 mb-1">RMA Type</div>
          <select
            className="border rounded px-3 py-2"
            value={form.rma_type}
            onChange={update("rma_type")}
          >
            <option value="">Select…</option>
            <option value="Warranty">Warranty</option>
            <option value="Out of Warranty">Out of Warranty</option>
            <option value="Advance Replacement">Advance Replacement</option>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <div className="text-xs text-gray-600 mb-1">Quantity</div>
          <input
            type="number"
            className="border rounded px-3 py-2 w-28"
            value={form.quantity}
            onChange={update("quantity")}
            min={1}
          />
        </div>
      </div>

      {/* =============================== */}
      {/*  ORGANIZATION-SPECIFIC RMA STOCK */}
      {/* =============================== */}
      <RmaStockForms
        org={org}
        stockUs={stockUs}
        stockEmea={stockEmea}
        setStockUs={setStockUs}
        setStockEmea={setStockEmea}
      />

      {/* =============================== */}
      {/* MAIN FORM TABLE */}
      {/* =============================== */}
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {renderRow("Sno", "(auto)")}
            {renderInput("Entry Date", "entry_date", form.entry_date, "date", update)}
            {renderInput("Ticket ID", "ticket_id", form.ticket_id, "text", update)}

            <Section label="Customer">
              {renderInput("First Name", "first_name", form.first_name, "text", update)}
              {renderInput("Last Name", "last_name", form.last_name, "text", update)}
              {renderInput("Email", "email", form.email, "email", update)}
              {renderInput("Phone", "phone", form.phone, "text", update)}
              {renderInput("Company", "company", form.company, "text", update)}
              {renderInput(
                "Reseller / Customer",
                "reseller_customer",
                form.reseller_customer,
                "text",
                update
              )}
              {renderInput("Address 1", "address1", form.address1, "text", update)}
              {renderInput("Address 2", "address2", form.address2, "text", update)}
              {renderInput("City", "city", form.city, "text", update)}
              {renderInput("State", "state", form.state, "text", update)}
              {renderInput("Country", "country", form.country, "text", update)}
              {renderInput("Postcode", "postcode", form.postcode, "text", update)}
            </Section>

            {/* =============================== */}
            {/* PRODUCT SECTION */}
            {/* =============================== */}
            <Section label="Product">
              {/* Grouped Device Dropdown */}
              <tr>
                <th className="w-56 bg-gray-50 px-3 py-2 font-medium">Device Name</th>
                <td className="px-3 py-2">
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={form.device_name}
                    onChange={update("device_name")}
                  >
                    <option value="">Select…</option>
                    {DEVICE_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.devices.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
              </tr>

              {/* Grouped SKU Dropdown */}
              <tr>
                <th className="w-56 bg-gray-50 px-3 py-2 font-medium">Product SKU</th>
                <td className="px-3 py-2 space-y-2">
                  {/* Quick Search */}
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Search SKU or product… then Enter"
                    value={skuQuery}
                    onChange={(e) => setSkuQuery(e.target.value)}
                    onBlur={commitSkuFromQuery}
                    onKeyDown={(e) => e.key === "Enter" && commitSkuFromQuery()}
                  />

                  {/* Grouped SKU dropdown */}
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={form.product_sku}
                    onChange={(e) => {
                      const code = e.target.value;
                      const name = SKU_BY_CODE.get(code) || "";
                      setForm((f) => ({
                        ...f,
                        product_sku: code,
                        product_with_fault: f.product_with_fault || name,
                      }));
                      setSkuQuery(`${name} — ${code}`);
                    }}
                  >
                    <option value="">Select SKU…</option>
                    {SKU_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.items.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.name} — {item.code}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
              </tr>

              {renderInput(
                "Product with Fault",
                "product_with_fault",
                form.product_with_fault,
                "text",
                update
              )}

              {renderInput(
                "Serial Number",
                "serial_number",
                form.serial_number,
                "text",
                update
              )}

              {renderSelect("Category", "category", form.category, CATEGORIES, update)}
            </Section>

            <Section label="Case Details">
              {renderInput(
                "Returned Reason",
                "returned_reason",
                form.returned_reason,
                "text",
                update
              )}
              {renderInput("Action", "action", form.action, "text", update)}
            </Section>

            <Section label="Tracking">
              {renderInput(
                "Customer Return Tracking",
                "custom_tracking",
                form.custom_tracking,
                "text",
                update
              )}
              {renderInput("RMA No", "rma_no", form.rma_no, "text", update)}
              {renderInput(
                "Replacement Tracking",
                "replacement_tracking",
                form.replacement_tracking,
                "text",
                update
              )}
            </Section>
          </tbody>
        </table>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-2">
        <button
          onClick={save}
          className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
        >
          Save
        </button>
        <button
          onClick={() => console.log(form)}
          className="px-4 py-2 rounded border"
        >
          Preview JSON
        </button>
      </div>
    </div>
  );
}
/* ========================= Edit Modal ========================= */

function EditModal({ initial, onClose, onSave, readOnly = false }) {
  const [form, setForm] = useState(buildForm(initial));

  useEffect(() => {
    setForm(buildForm(initial));
  }, [initial]);

  // Auto-fill product name when SKU changes
  useEffect(() => {
    if (!form.product_sku) return;
    const name = SKU_BY_CODE.get(form.product_sku) || "";
    setForm((f) => ({
      ...f,
      product_with_fault: f.product_with_fault || name,
    }));
  }, [form.product_sku]);

  const update = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: k === "quantity" ? Number(e.target.value || 0) : e.target.value,
    }));

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {readOnly ? "View RMA Entry" : "View / Edit RMA Entry"} #{initial.id}
            </h3>
            <div className="text-xs text-gray-500">
              {fullName || "—"} {form.entry_date ? `• ${fmtDate(form.entry_date)}` : ""}
            </div>
          </div>

          <button onClick={onClose} className="px-3 py-1 rounded border">
            Close
          </button>
        </div>

        {/* Scrollable content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
          {input("Entry date", "entry_date", form.entry_date, update, "date", readOnly)}
          {input("Ticket ID", "ticket_id", form.ticket_id, update, "text", readOnly)}

          {input("First Name", "first_name", form.first_name, update, "text", readOnly)}
          {input("Last Name", "last_name", form.last_name, update, "text", readOnly)}
          {input("Email", "email", form.email, update, "email", readOnly)}
          {input("Phone", "phone", form.phone, update, "text", readOnly)}
          {input("Company", "company", form.company, update, "text", readOnly)}
          {input("Reseller / Customer", "reseller_customer", form.reseller_customer, update, "text", readOnly)}
          {input("Address1", "address1", form.address1, update, "text", readOnly)}
          {input("Address2", "address2", form.address2, update, "text", readOnly)}
          {input("City", "city", form.city, update, "text", readOnly)}
          {input("State", "state", form.state, update, "text", readOnly)}
          {input("Country", "country", form.country, update, "text", readOnly)}
          {input("Postcode", "postcode", form.postcode, update, "text", readOnly)}

          {/* PRODUCT SKU WITH GROUPED DROPDOWN */}
          <label className="block">
            <div className="text-xs text-gray-600 mb-1">Product SKU</div>
            <select
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              value={form.product_sku}
              disabled={readOnly}
              onChange={(e) => {
                const code = e.target.value;
                const name = SKU_BY_CODE.get(code) || "";
                setForm((f) => ({
                  ...f,
                  product_sku: code,
                  product_with_fault: f.product_with_fault || name,
                }));
              }}
            >
              <option value="">Select SKU…</option>

              {PRODUCT_SKUS_GROUPED.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((sku) => (
                    <option key={sku.code} value={sku.code}>
                      {sku.name} — {sku.code}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {input("Product w/ Fault", "product_with_fault", form.product_with_fault, update, "text", readOnly)}
          {input("Serial Number", "serial_number", form.serial_number, update, "text", readOnly)}
          {input("Device Name", "device_name", form.device_name, update, "text", readOnly)}

          {select("Category", "category", form.category, CATEGORIES, update, readOnly)}
          {select("RMA Type", "rma_type", form.rma_type, ["Warranty", "Out of Warranty", "Advance Replacement"], update, readOnly)}

          {input("Stock Type", "stock_type", form.stock_type, update, "text", readOnly)}
          {input("Quantity", "quantity", form.quantity, update, "number", readOnly)}

          {input("Returned Reason", "returned_reason", form.returned_reason, update, "text", readOnly)}
          {input("Action", "action", form.action, update, "text", readOnly)}

          {input("Customer Return Tracking", "custom_tracking", form.custom_tracking, update, "text", readOnly)}
          {input("RMA No", "rma_no", form.rma_no, update, "text", readOnly)}
          {input("New Order #", "replacement_tracking", form.replacement_tracking, update, "text", readOnly)}
        </div>

        {/* FOOTER BUTTONS */}
        {!readOnly && (
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded border">
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  ...form,
                  product_with_fault: form.product_with_fault || SKU_BY_CODE.get(form.product_sku) || "",
                  entry_date: fmtDate(form.entry_date),
                  updated_at: new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Build form for EditModal */
function buildForm(initial) {
  return {
    entry_date: fmtDate(initial.entry_date),
    ticket_id: initial.ticket_id || "",
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    company: initial.company || "",
    reseller_customer: initial.reseller_customer || "",
    address1: initial.address1 || "",
    address2: initial.address2 || "",
    city: initial.city || "",
    state: initial.state || "",
    country: initial.country || "",
    postcode: initial.postcode || "",
    product_with_fault: initial.product_with_fault || "",
    serial_number: initial.serial_number || "",
    product_sku: initial.product_sku || "",
    device_name: initial.device_name || "",
    rma_type: initial.rma_type || "",
    stock_type: initial.stock_type || "",
    quantity: initial.quantity ?? 1,
    returned_reason: initial.returned_reason || "",
    action: initial.action || "",
    custom_tracking: initial.custom_tracking || "",
    rma_no: initial.rma_no || "",
    replacement_tracking: initial.replacement_tracking || "",
    category: initial.category || "",
  };
}
/* =======================================================
   Filters Section
   ======================================================= */

function Filters({ filters, setFilters }) {
  const update = (k) => (e) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg border">
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Search</label>
        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          placeholder="Name / Email / SKU / Serial / Ticket"
          value={filters.query}
          onChange={update("query")}
        />
      </div>

      <div>
        <label className="text-xs text-gray-600 mb-1 block">Category</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={filters.category}
          onChange={update("category")}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-600 mb-1 block">Region</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={filters.region}
          onChange={update("region")}
        >
          <option value="">All</option>
          {ORGS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-600 mb-1 block">RMA Type</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={filters.rma_type}
          onChange={update("rma_type")}
        >
          <option value="">All</option>
          <option value="Warranty">Warranty</option>
          <option value="Out of Warranty">Out of Warranty</option>
          <option value="Advance Replacement">Advance Replacement</option>
        </select>
      </div>
    </div>
  );
}

/* =======================================================
   Month Tiles
   ======================================================= */

function MonthTiles({ activeMonth, setActiveMonth }) {
  const months = [
    "All",
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {months.map((m) => (
        <button
          key={m}
          className={`px-3 py-1 rounded border text-sm ${
            activeMonth === m
              ? "bg-black text-white"
              : "bg-white hover:bg-gray-50"
          }`}
          onClick={() => setActiveMonth(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/* =======================================================
   Pagination
   ======================================================= */

function Pagination({ page, totalPages, setPage }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <button
        disabled={page <= 1}
        onClick={() => setPage((p) => p - 1)}
        className="px-3 py-1 border rounded disabled:opacity-40"
      >
        Prev
      </button>

      <div className="px-2 text-sm">
        Page {page} / {totalPages}
      </div>

      <button
        disabled={page >= totalPages}
        onClick={() => setPage((p) => p + 1)}
        className="px-3 py-1 border rounded disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

/* =======================================================
   CSV Tools (Buttons Only — Logic in PART 4C)
   ======================================================= */

function CSVTools({ rows, onImport }) {
  return (
    <div className="flex flex-wrap justify-between items-center py-3">

      {/* CSV Export */}
      <button
        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        onClick={() => downloadCSV(rows)}
      >
        Export CSV
      </button>

      {/* CSV Import */}
      <div>
        <label className="px-4 py-2 border rounded cursor-pointer bg-white hover:bg-gray-50">
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleCsvImport(e.target.files[0], onImport);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
/* =======================================================
    CSV EXPORT
   ======================================================= */

function downloadCSV(rows) {
  if (!rows?.length) {
    alert("No rows to export.");
    return;
  }

  const cols = Object.keys(rows[0]).filter((k) => k !== "id");
  const lines = [];

  lines.push(cols.join(","));

  for (const r of rows) {
    const row = cols.map((c) => csvEscape(r[c] ?? ""));
    lines.push(row.join(","));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "RMA_Export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* =======================================================
    CSV IMPORT
   ======================================================= */

async function handleCsvImport(file, onImport) {
  try {
    const text = await file.text();
    const { headers, records } = parseCsv(text);

    if (!headers.length) {
      alert("CSV appears empty.");
      return;
    }

    // Convert CSV rows into RMA objects
    const items = records.map((rec) => {
      const obj = {};
      for (const [k, v] of Object.entries(rec)) obj[k] = v.trim();

      // Ensure date safe format
      obj.entry_date = fmtDate(obj.entry_date);

      // Auto quantity numeric
      obj.quantity = Number(obj.quantity || 1);

      return obj;
    });

    if (onImport) onImport(items);
  } catch (err) {
    console.error("CSV import failed", err);
    alert("CSV import failed. Check console.");
  }
}

/* =======================================================
    Robust CSV Parser
   ======================================================= */
/**
 * Supports:
 * - quoted fields
 * - embedded commas
 * - embedded quotes
 * - newlines inside quotes
 */

function parseCsv(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch !== "\r") {
        cur += ch;
      }
    }
  }

  row.push(cur);
  rows.push(row);

  const headers = rows.shift().map((h) => h.trim());
  const records = rows.map((cells) => {
    const out = {};
    headers.forEach((h, i) => (out[h] = cells[i] || ""));
    return out;
  });

  return { headers, records };
}

/* =======================================================
    GROUPED SKU LIST
   ======================================================= */

const PRODUCT_SKUS_GROUPED = [
  {
    group: "NINJA Series",
    items: [
      { name: "Ninja", code: "ATOMNJA004" },
      { name: "Ninja V", code: "ATOMNJAV01" },
      { name: "Ninja V Plus", code: "ATOMNJVPL1" },
      { name: "Ninja Ultra", code: "ATOMNJAU01" },
      { name: "Ninja Phone", code: "ATOMNJPB01" },
      { name: "Ninja Flame", code: "ATOMNJAFL2" },
      { name: "Ninja Inferno", code: "ATOMNJAIN1" },
      { name: "Ninja Blade", code: "ATOMNJB001" },
    ],
  },
  {
    group: "SHINOBI Series",
    items: [
      { name: "Shinobi II", code: "ATOMSHB003" },
      { name: "Shinobi HDMI", code: "ATOMSHBH01" },
      { name: "Shinobi SDI", code: "ATOMSHBS01" },
      { name: "Shinobi 7", code: "ATOMSHB002" },
    ],
  },
  {
    group: "SHOGUN Series",
    items: [
      { name: "Shogun Connect", code: "ATOMSHGCO1" },
      { name: "Shogun (new)", code: "ATOMSHG002" },
      { name: "Shogun Ultra", code: "ATOMSHGU01" },
      { name: "Shogun Classic", code: "ATOMSHG701" },
      { name: "Shogun Inferno", code: "ATOMSHGIN2" },
      { name: "Shogun Flame", code: "ATOMSHGFL1" },
      { name: "Shogun", code: "ATOMSHG001" },
      { name: "Shogun Studio", code: "ATOMSHSTU01" },
      { name: "Shogun Studio 2", code: "ATOMSHSTU2" },
    ],
  },
  {
    group: "SUMO Series",
    items: [
      { name: "Sumo 19SE", code: "ATOMSUMSE1" },
      { name: "Sumo 19", code: "ATOMSUMO19" },
      { name: "Sumo 19M", code: "ATOMSUMO19M" },
    ],
  },
  {
    group: "SYNC / CONNECT Series",
    items: [
      { name: "Zato Connect", code: "ATOMZATC01" },
      { name: "UltraSync One", code: "ATOMSYON1" },
      { name: "UltraSync Blue", code: "ATOMSYBL1" },
      { name: "Atomos Connect", code: "ATOMCON003" },
    ],
  },
  {
    group: "BATTERY / POWER",
    items: [
      { name: "Battery Eliminator", code: "ATOMDCA001" },
      { name: "AtomX Battery", code: "ATOMBAT003" },
      { name: "AtomX Fast Charger", code: "ATOMFCGRS2" },
      { name: "Power Kit 2", code: "ATOMXPWKT2" },
      { name: "DC to Dtap cable", code: "ATOMDTPCB2" },
    ],
  },
  {
    group: "CABLES",
    items: [
      { name: "AtomFlex HDMI locking", code: "ATOM4K60L1" },
      { name: "AtomFlex HDMI locking", code: "ATOM4K60L2" },
      { name: "AtomFlex HDMI locking", code: "ATOM4K60L3" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C1" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C2" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C3" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C4" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C5" },
      { name: "AtomFlex HDMI", code: "ATOM4K60C6" },
      { name: "AtomFlex HDMI", code: "ATOMCAB007" },
      { name: "AtomFlex HDMI", code: "ATOMCAB008" },
      { name: "AtomFlex HDMI", code: "ATOMCAB009" },
      { name: "AtomFlex HDMI", code: "ATOMCAB010" },
      { name: "AtomFlex HDMI", code: "ATOMCAB011" },
      { name: "AtomFlex HDMI", code: "ATOMCAB012" },
      { name: "AtomFlex HDMI", code: "ATOMCAB013" },
      { name: "AtomFlex HDMI", code: "ATOMCAB014" },
      { name: "AtomFlex HDMI", code: "ATOMCAB015" },
    ],
  },
  {
    group: "ACCESSORIES",
    items: [
      { name: "Docking Station", code: "ATOMDCK004" },
      { name: "Accessory Kit Version II", code: "ATOMACCKT4" },
      { name: "AtomX Cast", code: "ATOMXCST01" },
    ],
  },
];

/* =======================================================
    SKU LOOKUP HELPERS
   ======================================================= */

const SKU_BY_CODE = new Map();
const CODE_BY_NAME = new Map();

PRODUCT_SKUS_GROUPED.forEach((group) => {
  group.items.forEach((p) => {
    SKU_BY_CODE.set(p.code, p.name);
    if (!CODE_BY_NAME.has(p.name.toLowerCase())) {
      CODE_BY_NAME.set(p.name.toLowerCase(), p.code);
    }
  });
});

/* =======================================================
    Helper: CSV Escape
   ======================================================= */

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[" ,\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* =======================================================
    Helper: Safe date format
   ======================================================= */

function fmtDate(v) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}
