import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import {
  DEVICE_NAMES,
  PRODUCT_SKUS,
  SKU_BY_CODE,
  CODE_BY_NAME,
} from "@/data/rmaSkuCatalog";

const CATEGORIES = ["product-fault", "warranty", "out-of-warranty", "other"];
const ORGS = ["US", "EMEA"];



// Product SKU catalog (base codes only; region variants are derived)




const STOCK_TYPES_US = [
  "D Stock Received",
  "B-Stock Received",
  "New Stock Sent",
  "RMA/ B-Stock R-Stock Sent",
  "A Stock - Received",
  "Awaiting Delivery from User",
  "Receive Only",
  "Awaiting Return from Rush",
];
const STOCK_TYPES_EMEA = [
  "D Stock - Received",
  "B-stock Received",
  "New Stock Sent",
  "RMA/ B-Stock R-Stock Sent",
  "Awaiting Delivery from User",
  "Receiving Only",
  "Awaiting Return from Rush",
];

// union for filter dropdown
const STOCK_FILTER_OPTIONS = Array.from(
  new Set([...STOCK_TYPES_US, ...STOCK_TYPES_EMEA])
);

// --- STOCK default forms (by org) ---
const STOCK_DEFAULT_US = {
  d_stock_received: 0,
  b_stock_received: 0,
  new_stock_sent: 0,
  rma_bstock_rstock_sent: 0,
  a_stock_received: 0,
  awaiting_delivery_from_user: 0,
  receive_only: 0,
  awaiting_return_from_rush: 0,
  notes: "",
};

const STOCK_DEFAULT_EMEA = {
  d_stock_received: 0,
  b_stock_received: 0,
  new_stock_sent: 0,
  rma_bstock_rstock_sent: 0,
  awaiting_delivery_from_user: 0,
  receiving_only: 0,
  awaiting_return_from_rush: 0,
  notes: "",
};

// date → YYYY-MM for stock tables
function toMonth(v) {
  const d =
    typeof v === "string"
      ? new Date(v)
      : v instanceof Date
      ? v
      : null;
  if (!d || isNaN(d.getTime()))
    return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}

// coerce numeric-like strings to numbers
function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (
      typeof v === "string" &&
      v.trim() !== "" &&
      !isNaN(Number(v))
    )
      out[k] = Number(v);
  }
  return out;
}

/** Ensure date is "YYYY-MM-DD" for <input type="date"> */
function fmtDate(v) {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const onlyDate = v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) return onlyDate;
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime()))
    return v.toISOString().slice(0, 10);
  return "";
}

export default function RmaEntry() {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [tab, setTab] = useState("lists");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 space-y-4">
      <div className="inline-flex rounded-xl border overflow-hidden">
        <TabButton
          active={tab === "lists"}
          onClick={() => setTab("lists")}
        >
          RMA Lists
        </TabButton>
        {!isViewer && (
          <TabButton
            active={tab === "new"}
            onClick={() => setTab("new")}
          >
            New RMA Entry
          </TabButton>
        )}
      </div>

      {tab === "lists" ? (
        <RmaLists refreshKey={refreshKey} />
      ) : (
        <RmaForm
          onSaved={() => {
            setRefreshKey((x) => x + 1);
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
        active
          ? "bg-black text-white"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ========================= RMA Lists (local DB) ========================= */
function RmaLists({ refreshKey }) {
  const API = import.meta.env.VITE_API_BASE || "";
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // filters: server-side (month, category) + client-side (others)
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

  // pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // import state
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef(null);

  // fetch list (server still only uses month + category)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          month: filters.month || "",
          category: filters.category || "",
        });
        const res = await fetch(
          apiUrl(`/rma/entries?${qs.toString()}`),
          { credentials: "include" }
        );
        const data = await safeJson(res);
        setRows(data?.entries || []);
      } catch (e) {
        console.error("entries fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, filters.month, filters.category, refreshKey]);

  // group for month tiles
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const d = new Date(r.entry_date);
      if (isNaN(d)) continue;
      const ym = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym).push(r);
    }
    return m;
  }, [rows]);

  // year dropdown (from entry_date)
  const yearOptions = useMemo(() => {
    const ys = new Set();
    rows.forEach((r) => {
      const y = getYear(r.entry_date);
      if (y) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => a - b);
  }, [rows]);

  /* ---------- EXPORT (client-side, only filtered rows) ---------- */
  async function exportCSV() {
    if (!filteredRows.length) {
      alert("No rows to export for selected filters.");
      return;
    }

    const cols = [
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
    lines.push(cols.join(","));
    for (const r of filteredRows) {
      const vals = cols.map((k) => csvEscape(r?.[k] ?? ""));
      lines.push(vals.join(","));
    }

    const blob = new Blob(
      ["\uFEFF" + lines.join("\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const a = document.createElement("a");
    const parts = [];
    if (filters.month) parts.push(filters.month);
    if (filters.category) parts.push(filters.category);
    if (filters.organization) parts.push(filters.organization);
    const suffix = parts.length ? parts.join("_") : "filtered";
    a.href = URL.createObjectURL(blob);
    a.download = `RMA_Entries_${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- TEMPLATE DOWNLOAD (server first, then client fallback) ---------- */
  async function downloadTemplate() {
    const url = apiUrl(`/rma/entries/template.csv`);

    // Try server CSV
    try {
      const res = await fetch(url, { credentials: "include" });
      if (
        res.ok &&
        (res.headers.get("content-type") || "").includes("text/csv")
      ) {
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "rma_entries_template.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    } catch {}

    // Fallback: generate template with your exact headers
    const headers = Object.keys(HUMAN_TO_CANON);
    const blob = new Blob(
      ["\uFEFF" + headers.join(",") + "\n"],
      { type: "text/csv;charset=utf-8" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rma_entries_template_client.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- IMPORT (CSV with your headers) ---------- */
  function openImportDialog() {
    setImportMsg("");
    fileRef.current?.click();
  }

  async function handleImportFile(e) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow picking same file twice
    if (!f) return;

    try {
      setImporting(true);
      setImportMsg("Reading file…");
      const text = await f.text();

      const { headers, records } = parseCsv(text);
      if (!headers.length || !records.length) {
        setImportMsg("No data found in CSV.");
        setImporting(false);
        return;
      }

      // Build mapping from YOUR headers -> canonical DB keys
      const h2c = HUMAN_TO_CANON; // exact header strings
      // quick index header -> position
      const idx = new Map(
        headers.map((h, i) => [h.trim(), i])
      );

      const get = (row, header) => {
        const pos = idx.get(header);
        return pos == null ? "" : row[pos] ?? "";
      };

      const items = records.map((rowObj) => {
        const rowArr = headers.map((h) => rowObj[h] ?? "");
        const obj = {};
        for (const [human, canon] of Object.entries(h2c)) {
          obj[canon] = get(rowArr, human);
        }
        // Transform/normalize (date, quantity, etc.)
        obj.entry_date = fmtDate(obj.entry_date) || null;
        const q = Number(obj.quantity || 0);
        obj.quantity =
          Number.isFinite(q) && q > 0 ? q : 0;
        return obj;
      });

      // send as JSON { items: [...] } — matches server route
      setImportMsg(`Uploading ${items.length} row(s)…`);
      const res = await fetch(`${API}/api/rma/entries/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      const data = await safeJson(res);

      if (res.status === 207) {
        const ok = data?.imported ?? 0;
        const failed = data?.failed ?? 0;
        setImportMsg(
          `Partial import: ${ok} imported, ${failed} failed (see console).`
        );
        console.log("Import report:", data?.report);
      } else if (!res.ok) {
        throw new Error(data?.error || "Import failed");
      } else {
        setImportMsg(
          `Imported ${data?.imported ?? items.length} row(s) successfully.`
        );
      }

      // Refresh table (respect server filters month/category)
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          month: filters.month || "",
          category: filters.category || "",
        });
        const r = await fetch(
          apiUrl(`/rma/entries?${qs.toString()}`),
          { credentials: "include" }
        );
        const j = await safeJson(r);
        setRows(j?.entries || []);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setImportMsg(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this RMA entry?")) return;
    const res = await fetch(
      apiUrl(`/rma/entries/${id}`),
      { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) return alert("Delete failed");
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  async function deleteSelected() {
    if (!selectedIds.length) {
      alert("No rows selected.");
      return;
    }
    if (
      !confirm(
        `Delete ${selectedIds.length} selected entr${
          selectedIds.length === 1 ? "y" : "ies"
        }?`
      )
    )
      return;

    setLoading(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(apiUrl(`/rma/entries/${id}`), {
            method: "DELETE",
            credentials: "include",
          })
        )
      );
      setRows((prev) =>
        prev.filter((r) => !selectedIds.includes(r.id))
      );
      setSelectedIds([]);
    } catch (e) {
      console.error("Bulk delete failed", e);
      alert("Bulk delete failed, see console for details.");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(id, patch) {
    const role = (localStorage.getItem("role") || "admin").toLowerCase();
    const before = rows.find((r) => r.id === id) || {};
    const toSend = {
      ...patch,
      entry_date: fmtDate(patch.entry_date) || null,
    };

    const res = await fetch(apiUrl(`/rma/entries/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(toSend),
    });

    if (!res.ok) {
      const e = await safeJson(res);
      alert(`Update failed: ${e?.error || res.statusText}`);
      return;
    }

    // Update UI
    const after = { ...before, ...toSend };
    setRows((prev) =>
      prev.map((r) => (r.id === id ? after : r))
    );
    setEditRow(null);

    // If viewer -> email diff
    if (role === "viewer") {
      const changed = {};
      const keys = new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ]);
      for (const k of keys) {
        const a = before?.[k];
        const b = after?.[k];
        if (String(a ?? "") !== String(b ?? "")) {
          changed[k] = {
            before: a ?? "",
            after: b ?? "",
          };
        }
      }
      // If something changed, notify
      if (Object.keys(changed).length > 0) {
        try {
          await fetch("/api/notify-update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id,
              changed,
              entry_date: after.entry_date,
              who: "viewer",
            }),
          });
        } catch (err) {
          console.warn("notify-update failed", err);
        }
      }
    }
  }

  // client-side filtering (Rush style)
  const filteredRows = useMemo(() => {
    let list = rows;

    // search in multiple columns
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
          r.serial_number,
          r.custom_tracking,
          r.replacement_tracking,
        ]
          .filter(Boolean)
          .some((v) =>
            String(v).toLowerCase().includes(q)
          )
      );
    }

    // category (extra safety even though server uses it)
    if (filters.category) {
      list = list.filter(
        (r) => r.category === filters.category
      );
    }

    // organization (region)
    if (filters.organization) {
      list = list.filter(
        (r) =>
          (r.organization || "").toUpperCase() ===
          filters.organization.toUpperCase()
      );
    }

    // stock_type filter
    if (filters.stock_type) {
      list = list.filter(
        (r) => r.stock_type === filters.stock_type
      );
    }

    // year filter (entry_date)
    if (filters.year) {
      const yNum = Number(filters.year);
      list = list.filter(
        (r) => getYear(r.entry_date) === yNum
      );
    }

    // month range (entry_date)
    if (filters.fromMonth || filters.toMonth) {
      list = list.filter((r) => {
        const key = getMonthKey(r.entry_date);
        if (!key) return false;
        if (filters.fromMonth && key < filters.fromMonth)
          return false;
        if (filters.toMonth && key > filters.toMonth)
          return false;
        return true;
      });
    }

    // date range (entry_date)
    if (filters.fromDate || filters.toDate) {
      list = list.filter((r) => {
        const d = normalizeDate(r.entry_date);
        if (!d) return false;
        if (filters.fromDate && d < filters.fromDate)
          return false;
        if (filters.toDate && d > filters.toDate)
          return false;
        return true;
      });
    }

    return list;
  }, [rows, filters]);

  // pagination derived from filteredRows
  const total = filteredRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );
  const safePage = Math.min(
    Math.max(1, page),
    totalPages
  );
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(
    startIndex,
    startIndex + pageSize
  );

  // reset page + selection when filters / pageSize change
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [
    filters.search,
    filters.year,
    filters.fromMonth,
    filters.toMonth,
    filters.fromDate,
    filters.toDate,
    filters.category,
    filters.stock_type,
    filters.organization,
    filters.month,
    pageSize,
  ]);

  function clearFilters() {
    setFilters({
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
  }

  function isSelected(id) {
    return selectedIds.includes(id);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  const allPageSelected =
    pageRows.length > 0 &&
    pageRows.every((r) => isSelected(r.id));

  function toggleSelectAllCurrentPage() {
    if (allPageSelected) {
      // unselect all on this page
      const idsOnPage = new Set(pageRows.map((r) => r.id));
      setSelectedIds((prev) =>
        prev.filter((id) => !idsOnPage.has(id))
      );
    } else {
      // add all on this page
      setSelectedIds((prev) => {
        const s = new Set(prev);
        pageRows.forEach((r) => s.add(r.id));
        return Array.from(s);
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters / actions */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div>
          <label className="block text-xs mb-1">
            Search
          </label>
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder="RMA, ticket, name, email, company…"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                search: e.target.value,
              }))
            }
          />
        </div>

        {/* Month (server + client) */}
        <div>
          <label className="block text-xs mb-1">
            Month (Entry Date)
          </label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.month}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                month: e.target.value,
              }))
            }
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs mb-1">
            Year (Entry Date)
          </label>
          <select
            className="border rounded px-3 py-2"
            value={filters.year}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                year: e.target.value,
              }))
            }
          >
            <option value="">All</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* From Month */}
        <div>
          <label className="block text-xs mb-1">
            From Month (Entry)
          </label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.fromMonth}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                fromMonth: e.target.value,
              }))
            }
          />
        </div>

        {/* To Month */}
        <div>
          <label className="block text-xs mb-1">
            To Month (Entry)
          </label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.toMonth}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                toMonth: e.target.value,
              }))
            }
          />
        </div>

        {/* From Date */}
        <div>
          <label className="block text-xs mb-1">
            From Date (Entry)
          </label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={filters.fromDate}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                fromDate: e.target.value,
              }))
            }
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-xs mb-1">
            To Date (Entry)
          </label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={filters.toDate}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                toDate: e.target.value,
              }))
            }
          />
        </div>

        {/* RMA Category */}
        <div>
          <label className="block text-xs mb-1">
            RMA Category
          </label>
          <select
            className="border rounded px-3 py-2"
            value={filters.category}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                category: e.target.value,
              }))
            }
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Type filter */}
        <div>
          <label className="block text-xs mb-1">
            Stock Type
          </label>
          <select
            className="border rounded px-3 py-2"
            value={filters.stock_type}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                stock_type: e.target.value,
              }))
            }
          >
            <option value="">All</option>
            {STOCK_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Region / Organization filter */}
        <div>
          <label className="block text-xs mb-1">
            Region / Organization
          </label>
          <select
            className="border rounded px-3 py-2"
            value={filters.organization}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                organization: e.target.value,
              }))
            }
          >
            <option value="">All</option>
            {ORGS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="rounded border px-3 py-2 hover:bg-gray-50"
            disabled={loading || importing}
          >
            Clear filters
          </button>

          <button
            onClick={exportCSV}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
            disabled={loading || importing}
          >
            Export CSV
          </button>

          {!isViewer && (
            <>
              <button
                onClick={downloadTemplate}
                className="rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={loading || importing}
              >
                Download Template (CSV)
              </button>

              <button
                onClick={openImportDialog}
                className="rounded border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={loading || importing}
                title="Import RMA entries from a CSV file"
              >
                {importing ? "Importing…" : "Import CSV"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />

              <button
                onClick={deleteSelected}
                className="rounded border px-4 py-2 hover:bg-red-50 disabled:opacity-60 text-red-700"
                disabled={
                  loading || importing || !selectedIds.length
                }
                title="Delete all selected RMA entries"
              >
                Delete Selected
              </button>
            </>
          )}
        </div>
      </div>

      {importMsg && (
        <div className="text-xs text-gray-600">
          {importMsg}
        </div>
      )}

      {/* Month tiles */}
      <div className="grid md:grid-cols-3 gap-3">
        {[...grouped.keys()]
          .sort()
          .map((ym) => {
            const list = grouped.get(ym) || [];
            const [y, m] = ym.split("-");
            const label = new Date(
              Number(y),
              Number(m) - 1
            ).toLocaleString(undefined, {
              month: "long",
              year: "numeric",
            });
            return (
              <button
                key={ym}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    month: ym,
                  }))
                }
                className="text-left rounded-xl border p-4 hover:bg-gray-50"
              >
                <div className="text-sm text-gray-500">
                  {label}
                </div>
                <div className="text-2xl font-semibold">
                  {list.length} RMAs
                </div>
              </button>
            );
          })}
      </div>

      {/* Full table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-[1400px] max-w-none text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllCurrentPage}
                />
              </Th>
              <Th>#</Th>
              <Th>Entry Date</Th>
              <Th>RMA No</Th>
              <Th>Ticket ID</Th>
              <Th>First</Th>
              <Th>Last</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Company</Th>
              <Th>Reseller/Customer</Th>
              <Th>Address1</Th>
              <Th>Address2</Th>
              <Th>City</Th>
              <Th>State</Th>
              <Th>Country</Th>
              <Th>Postcode</Th>
              <Th>Product w/ Fault</Th>
              <Th>Serial</Th>
              <Th>Product SKU</Th>
              <Th>Device</Th>
              <Th>Category</Th>
              <Th>RMA Type</Th>
              <Th>Stock Type</Th>
              <Th>Qty</Th>
              <Th>Returned Reason</Th>
              <Th>Action</Th>
              <Th>Customer Return Tracking</Th>
              <Th>New Order #</Th>
              <Th>Region</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={31}
                  className="p-6 text-center"
                >
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={31}
                  className="p-6 text-center"
                >
                  No entries
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-gray-50"
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={isSelected(r.id)}
                      onChange={() =>
                        toggleSelect(r.id)
                      }
                    />
                  </Td>
                  <Td>{startIndex + i + 1}</Td>
                  <Td>
                    {r.entry_date
                      ? new Date(
                          r.entry_date
                        ).toLocaleDateString()
                      : "-"}
                  </Td>
                  <Td>{r.rma_no || "-"}</Td>
                  <Td>{r.ticket_id || "-"}</Td>
                  <Td>{r.first_name || "-"}</Td>
                  <Td>{r.last_name || "-"}</Td>
                  <Td>{r.email || "-"}</Td>
                  <Td>{r.phone || "-"}</Td>
                  <Td>{r.company || "-"}</Td>
                  <Td>
                    {r.reseller_customer || "-"}
                  </Td>
                  <Td>{r.address1 || "-"}</Td>
                  <Td>{r.address2 || "-"}</Td>
                  <Td>{r.city || "-"}</Td>
                  <Td>{r.state || "-"}</Td>
                  <Td>{r.country || "-"}</Td>
                  <Td>{r.postcode || "-"}</Td>
                  <Td>
                    {r.product_with_fault || "-"}
                  </Td>
                  <Td>{r.serial_number || "-"}</Td>
                  <Td>{r.product_sku || "-"}</Td>
                  <Td>{r.device_name || "-"}</Td>
                  <Td>{r.category || "-"}</Td>
                  <Td>{r.rma_type || "-"}</Td>
                  <Td>{r.stock_type || "-"}</Td>
                  <Td>{r.quantity ?? 0}</Td>
                  <Td>{r.returned_reason || "-"}</Td>
                  <Td>{r.action || "-"}</Td>
                  <Td>{r.custom_tracking || "-"}</Td>
                  <Td>
                    {r.replacement_tracking || "-"}
                  </Td>
                  <Td>
                    {r.organization || "-"}
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setEditRow(r)}
                      >
                        View / Edit
                      </button>
                      {role !== "viewer" && (
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => remove(r.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-xs text-gray-600">
        <div>
          Showing{" "}
          {pageRows.length ? startIndex + 1 : 0} –{" "}
          {startIndex + pageRows.length} of {total}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span>Rows per page:</span>
            <select
              className="border rounded px-2 py-1"
              value={pageSize}
              onChange={(e) =>
                setPageSize(
                  Number(e.target.value) || 25
                )
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 border rounded"
              disabled={safePage <= 1}
              onClick={() =>
                setPage((p) => p - 1)
              }
            >
              Prev
            </button>

            <span>
              Page {safePage} of {totalPages}
            </span>

            <button
              className="px-2 py-1 border rounded"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((p) => p + 1)
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editRow && (
        <EditModal
          initial={editRow}
          readOnly={false}
          onClose={() => setEditRow(null)}
          onSave={(patch) => saveEdit(editRow.id, patch)}
        />
      )}
    </div>
  );
}

/* ========================= New RMA Entry ========================= */
function RmaForm({ onSaved }) {
  const [org, setOrg] = useState("EMEA");
  const [skuQuery, setSkuQuery] = useState(""); // used only for quick search

  const [form, setForm] = useState({
    entry_date: fmtDate(new Date()),
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

  // org-specific stock forms
  const [stockUs, setStockUs] = useState({
    ...STOCK_DEFAULT_US,
  });
  const [stockEmea, setStockEmea] = useState({
    ...STOCK_DEFAULT_EMEA,
  });

  // keep organization mirror
  useEffect(
    () =>
      setForm((f) => ({
        ...f,
        organization: org,
      })),
    [org]
  );

  // when product_sku changes, auto-fill product_with_fault
  useEffect(() => {
    if (!form.product_sku) return;
    const name =
      SKU_BY_CODE.get(form.product_sku) || "";
    setForm((f) => ({
      ...f,
      product_with_fault:
        name || f.product_with_fault,
    }));
  }, [form.product_sku]);

  const stockOptions =
    org === "US" ? STOCK_TYPES_US : STOCK_TYPES_EMEA;

  // parse skuQuery on blur/Enter into form.product_sku
  function commitSkuFromQuery() {
    const raw = skuQuery.trim();
    if (!raw) return;
    const codeMatch = raw.split("—").pop().trim();
    let code = "";
    if (SKU_BY_CODE.has(codeMatch))
      code = codeMatch;
    else if (CODE_BY_NAME.has(raw.toLowerCase()))
      code = CODE_BY_NAME.get(raw.toLowerCase());
    if (code) {
      const name = SKU_BY_CODE.get(code) || "";
      setForm((f) => ({
        ...f,
        product_sku: code,
        product_with_fault:
          name || f.product_with_fault,
      }));
      setSkuQuery(`${name} — ${code}`);
    }
  }

  const update = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]:
        k === "quantity"
          ? Number(e.target.value || 0)
          : e.target.value,
    }));

  async function save() {
    if (!form.entry_date)
      return alert("Entry date is required");
    if (!form.device_name && !form.product_sku)
      return alert(
        "Choose Device Name or Product SKU"
      );

    // ensure product name from SKU when not typed
    const nameFromSku = form.product_sku
      ? SKU_BY_CODE.get(form.product_sku) || ""
      : "";
    const payload = {
      ...form,
      product_with_fault:
        form.product_with_fault ||
        nameFromSku ||
        "",
      entry_date: fmtDate(form.entry_date),
    };

    // derive region-specific SKU variant, based on org + stock type
    payload.product_sku = toRegionSku(
      payload.product_sku,
      payload.organization,
      payload.stock_type
    );

    const res = await fetch(apiUrl(`/rma/entries`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await safeJson(res);
      return alert(
        `Save failed: ${err?.error || res.statusText}`
      );
    }

    // Saved entry OK
    alert("RMA Entry saved");

    // If user wants, also post a stock row
    const usingUs = org === "US";
    const stock = usingUs
      ? { ...stockUs }
      : { ...stockEmea };

    // Only add if at least one numeric is non-zero OR notes present
    const hasNumbers =
      Object.entries(stock).some(
        ([k, v]) =>
          k !== "notes" && Number(v || 0) !== 0
      ) ||
      (stock.notes || "").trim() !== "";

    if (hasNumbers) {
      const doAdd = confirm(
        `Also add this to RMA Stock for ${org}?`
      );
      if (doAdd) {
        const month = toMonth(payload.entry_date); // YYYY-MM
        const device_name =
          payload.device_name || "—";
        const body = {
          month,
          device_name,
          ...numberizeAll(stock),
        };

        const path = usingUs
          ? apiUrl(`/rma/us/stock`)
          : apiUrl(`/rma/emea/stock`);
        const sres = await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!sres.ok) {
          const derr = await safeJson(sres);
          console.error("Stock save failed", derr);
          alert("Stock save failed");
        } else {
          // reset mini stock form
          usingUs
            ? setStockUs({ ...STOCK_DEFAULT_US })
            : setStockEmea({ ...STOCK_DEFAULT_EMEA });
        }
      }
    }

    // done
    onSaved?.();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-3 flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-gray-600 mb-1">
            Organization
          </div>
          <select
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {ORGS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">
            Stock Type (by org)
          </div>
          <select
            value={form.stock_type}
            onChange={update("stock_type")}
            className="border rounded px-3 py-2"
          >
            <option value="">Select…</option>
            {stockOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">
            RMA Type
          </div>
          <select
            value={form.rma_type}
            onChange={update("rma_type")}
            className="border rounded px-3 py-2"
          >
            <option value="">Select…</option>
            <option value="Warranty">
              Warranty
            </option>
            <option value="Out of Warranty">
              Out of Warranty
            </option>
            <option value="Advance Replacement">
              Advance Replacement
            </option>
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">
            Quantity
          </div>
          <input
            type="number"
            className="border rounded px-3 py-2 w-28"
            value={form.quantity}
            onChange={update("quantity")}
            min={1}
          />
        </div>
      </div>

      {/* --- Org-specific RMA Stock (inline) --- */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="text-sm font-semibold">
          RMA Stock (by Organization)
        </div>
        {org === "US" ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Num
              label="D Stock Received"
              value={stockUs.d_stock_received}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  d_stock_received: v,
                }))
              }
            />
            <Num
              label="B-Stock Received"
              value={stockUs.b_stock_received}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  b_stock_received: v,
                }))
              }
            />
            <Num
              label="New Stock Sent"
              value={stockUs.new_stock_sent}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  new_stock_sent: v,
                }))
              }
            />
            <Num
              label="RMA/ B-Stock R-Stock Sent"
              value={stockUs.rma_bstock_rstock_sent}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  rma_bstock_rstock_sent: v,
                }))
              }
            />
            <Num
              label="A Stock - Received"
              value={stockUs.a_stock_received}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  a_stock_received: v,
                }))
              }
            />
            <Num
              label="Awaiting Delivery from User"
              value={
                stockUs.awaiting_delivery_from_user
              }
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  awaiting_delivery_from_user: v,
                }))
              }
            />
            <Num
              label="Receive Only"
              value={stockUs.receive_only}
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  receive_only: v,
                }))
              }
            />
            <Num
              label="Awaiting Return from Rush"
              value={
                stockUs.awaiting_return_from_rush
              }
              onChange={(v) =>
                setStockUs((s) => ({
                  ...s,
                  awaiting_return_from_rush: v,
                }))
              }
            />
            <div className="col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">
                Notes
              </label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={stockUs.notes}
                onChange={(e) =>
                  setStockUs((s) => ({
                    ...s,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Num
              label="D Stock - Received"
              value={stockEmea.d_stock_received}
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  d_stock_received: v,
                }))
              }
            />
            <Num
              label="B-stock Received"
              value={stockEmea.b_stock_received}
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  b_stock_received: v,
                }))
              }
            />
            <Num
              label="New Stock Sent"
              value={stockEmea.new_stock_sent}
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  new_stock_sent: v,
                }))
              }
            />
            <Num
              label="RMA/ B-Stock R-Stock Sent"
              value={
                stockEmea.rma_bstock_rstock_sent
              }
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  rma_bstock_rstock_sent: v,
                }))
              }
            />
            <Num
              label="Awaiting Delivery from User"
              value={
                stockEmea.awaiting_delivery_from_user
              }
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  awaiting_delivery_from_user: v,
                }))
              }
            />
            <Num
              label="Receiving Only"
              value={stockEmea.receiving_only}
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  receiving_only: v,
                }))
              }
            />
            <Num
              label="Awaiting Return from Rush"
              value={
                stockEmea.awaiting_return_from_rush
              }
              onChange={(v) =>
                setStockEmea((s) => ({
                  ...s,
                  awaiting_return_from_rush: v,
                }))
              }
            />
            <div className="col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">
                Notes
              </label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={stockEmea.notes}
                onChange={(e) =>
                  setStockEmea((s) => ({
                    ...s,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        )}
        <div className="text-xs text-gray-500">
          Tip: These are optional. If filled, you’ll be
          prompted to add them to the RMA Stock table after
          saving this entry.
        </div>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {renderRow("Sno", "(auto)")}
            {renderInput(
              "Entry date",
              "entry_date",
              fmtDate(form.entry_date),
              "date",
              update
            )}
            {renderInput(
              "Ticket ID",
              "ticket_id",
              form.ticket_id,
              "text",
              update
            )}

            <Section label="Customer">
              {renderInput(
                "First Name",
                "first_name",
                form.first_name,
                "text",
                update
              )}
              {renderInput(
                "Last Name",
                "last_name",
                form.last_name,
                "text",
                update
              )}
              {renderInput(
                "Email",
                "email",
                form.email,
                "email",
                update
              )}
              {renderInput(
                "Phone",
                "phone",
                form.phone,
                "text",
                update
              )}
              {renderInput(
                "Company",
                "company",
                form.company,
                "text",
                update
              )}
              {renderInput(
                "Reseller / Customer",
                "reseller_customer",
                form.reseller_customer,
                "text",
                update
              )}
              {renderInput(
                "Address 1",
                "address1",
                form.address1,
                "text",
                update
              )}
              {renderInput(
                "Address 2",
                "address2",
                form.address2,
                "text",
                update
              )}
              {renderInput(
                "City",
                "city",
                form.city,
                "text",
                update
              )}
              {renderInput(
                "State",
                "state",
                form.state,
                "text",
                update
              )}
              {renderInput(
                "Country",
                "country",
                form.country,
                "text",
                update
              )}
              {renderInput(
                "Postcode",
                "postcode",
                form.postcode,
                "text",
                update
              )}
            </Section>

            <Section label="Product">
              {/* Device Name */}
              <tr>
                <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">
                  Device Name
                </th>
                <td className="px-3 py-2">
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={form.device_name}
                    onChange={update("device_name")}
                  >
                    <option value="">Select…</option>
                    {DEVICE_NAMES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* Product SKU (select) with optional quick search */}
              <tr>
                <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">
                  Product SKU
                </th>
                <td className="px-3 py-2 space-y-2">
                  {/* quick search box */}
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Type name or code, then Enter or blur to apply…"
                    value={skuQuery}
                    onChange={(e) =>
                      setSkuQuery(e.target.value)
                    }
                    onBlur={commitSkuFromQuery}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        commitSkuFromQuery();
                    }}
                    list="sku-list"
                  />
                  <datalist id="sku-list">
                    {PRODUCT_SKUS.slice(0, 200).map(
                      (p) => (
                        <option
                          key={`${p.code}-${p.name}`}
                          value={`${p.name} — ${p.code}`}
                        />
                      )
                    )}
                  </datalist>

                  {/* authoritative select that writes to form.product_sku */}
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={form.product_sku}
                    onChange={(e) => {
                      const code = e.target.value;
                      const name =
                        SKU_BY_CODE.get(code) || "";
                      setForm((f) => ({
                        ...f,
                        product_sku: code,
                        product_with_fault:
                          f.product_with_fault || name,
                      }));
                      setSkuQuery(
                        name
                          ? `${name} — ${code}`
                          : code
                      );
                    }}
                  >
                    <option value="">
                      Select SKU…
                    </option>
                    {Array.from(
                      SKU_BY_CODE.entries()
                    ).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name} — {code}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* auto-fills from SKU if empty, but remains editable */}
              {renderInput(
                "Product with fault",
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
              {renderSelect(
                "Category",
                "category",
                form.category,
                CATEGORIES,
                update
              )}
            </Section>

            <Section label="Case Details">
              {renderInput(
                "Returned Reason",
                "returned_reason",
                form.returned_reason,
                "text",
                update
              )}
              {renderInput(
                "Action",
                "action",
                form.action,
                "text",
                update
              )}
            </Section>

            <Section label="Tracking">
              {renderInput(
                "Custom Tracking",
                "custom_tracking",
                form.custom_tracking,
                "text",
                update
              )}
              {renderInput(
                "RMA No",
                "rma_no",
                form.rma_no,
                "text",
                update
              )}
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

  // keep name synced when SKU changes
  useEffect(() => {
    if (!form.product_sku) return;
    const name =
      SKU_BY_CODE.get(form.product_sku) || "";
    setForm((f) => ({
      ...f,
      product_with_fault:
        f.product_with_fault || name,
    }));
  }, [form.product_sku]);

  const update = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]:
        k === "quantity"
          ? Number(e.target.value || 0)
          : e.target.value,
    }));

  const fullName = [form.first_name, form.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {readOnly
                ? "View RMA Entry"
                : "View / Edit RMA Entry"}{" "}
              #{initial.id}
            </h3>
            <div className="text-xs text-gray-500">
              {fullName || "—"}{" "}
              {form.entry_date
                ? `• ${fmtDate(
                    form.entry_date
                  )}`
                : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
          {input(
            "Entry date",
            "entry_date",
            form.entry_date,
            update,
            "date",
            readOnly
          )}
          {input(
            "Ticket ID",
            "ticket_id",
            form.ticket_id,
            update,
            "text",
            readOnly
          )}

          {input(
            "First Name",
            "first_name",
            form.first_name,
            update,
            "text",
            readOnly
          )}
          {input(
            "Last Name",
            "last_name",
            form.last_name,
            update,
            "text",
            readOnly
          )}
          {input(
            "Email",
            "email",
            form.email,
            update,
            "email",
            readOnly
          )}
          {input(
            "Phone",
            "phone",
            form.phone,
            update,
            "text",
            readOnly
          )}
          {input(
            "Company",
            "company",
            form.company,
            update,
            "text",
            readOnly
          )}
          {input(
            "Reseller/Customer",
            "reseller_customer",
            form.reseller_customer,
            update,
            "text",
            readOnly
          )}
          {input(
            "Address1",
            "address1",
            form.address1,
            update,
            "text",
            readOnly
          )}
          {input(
            "Address2",
            "address2",
            form.address2,
            update,
            "text",
            readOnly
          )}
          {input(
            "City",
            "city",
            form.city,
            update,
            "text",
            readOnly
          )}
          {input(
            "State",
            "state",
            form.state,
            update,
            "text",
            readOnly
          )}
          {input(
            "Country",
            "country",
            form.country,
            update,
            "text",
            readOnly
          )}
          {input(
            "Postcode",
            "postcode",
            form.postcode,
            update,
            "text",
            readOnly
          )}

          {/* Product fields */}
          <label className="block">
            <div className="text-xs text-gray-600 mb-1">
              Product SKU
            </div>
            <select
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              value={form.product_sku}
              onChange={(e) => {
                const code = e.target.value;
                const name =
                  SKU_BY_CODE.get(code) || "";
                setForm((f) => ({
                  ...f,
                  product_sku: code,
                  product_with_fault:
                    f.product_with_fault || name,
                }));
              }}
              disabled={readOnly}
            >
              <option value="">
                Select SKU…
              </option>
              {Array.from(
                SKU_BY_CODE.entries()
              ).map(([code, name]) => (
                <option key={code} value={code}>
                  {name} — {code}
                </option>
              ))}
            </select>
          </label>

          {input(
            "Product w/ Fault",
            "product_with_fault",
            form.product_with_fault,
            update,
            "text",
            readOnly
          )}
          {input(
            "Serial Number",
            "serial_number",
            form.serial_number,
            update,
            "text",
            readOnly
          )}
          {input(
            "Device Name",
            "device_name",
            form.device_name,
            update,
            "text",
            readOnly
          )}
          {select(
            "Category",
            "category",
            form.category,
            CATEGORIES,
            update,
            readOnly
          )}

          {select(
            "RMA Type",
            "rma_type",
            form.rma_type,
            [
              "Warranty",
              "Out of Warranty",
              "Advance Replacement",
            ],
            update,
            readOnly
          )}
          {input(
            "Stock Type",
            "stock_type",
            form.stock_type,
            update,
            "text",
            readOnly
          )}
          {input(
            "Quantity",
            "quantity",
            form.quantity,
            update,
            "number",
            readOnly
          )}

          {input(
            "Returned Reason",
            "returned_reason",
            form.returned_reason,
            update,
            "text",
            readOnly
          )}
          {input(
            "Action",
            "action",
            form.action,
            update,
            "text",
            readOnly
          )}

          {/* Tracking */}
          {input(
            "Customer Return Tracking",
            "custom_tracking",
            form.custom_tracking,
            update,
            "text",
            readOnly
          )}
          {input(
            "RMA No",
            "rma_no",
            form.rma_no,
            update,
            "text",
            readOnly
          )}
          {input(
            "New Order #",
            "replacement_tracking",
            form.replacement_tracking,
            update,
            "text",
            readOnly
          )}
        </div>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded border"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  ...form,
                  product_with_fault:
                    form.product_with_fault ||
                    (SKU_BY_CODE.get(
                      form.product_sku
                    ) || ""),
                  entry_date: fmtDate(
                    form.entry_date
                  ),
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

function buildForm(initial) {
  return {
    entry_date: fmtDate(initial.entry_date),
    ticket_id: initial.ticket_id || "",
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    company: initial.company || "",
    reseller_customer:
      initial.reseller_customer || "",
    address1: initial.address1 || "",
    address2: initial.address2 || "",
    city: initial.city || "",
    state: initial.state || "",
    country: initial.country || "",
    postcode: initial.postcode || "",
    product_with_fault:
      initial.product_with_fault || "",
    serial_number: initial.serial_number || "",
    product_sku: initial.product_sku || "",
    device_name: initial.device_name || "",
    rma_type: initial.rma_type || "",
    stock_type: initial.stock_type || "",
    quantity: initial.quantity ?? 1,
    returned_reason:
      initial.returned_reason || "",
    action: initial.action || "",
    custom_tracking:
      initial.custom_tracking || "",
    rma_no: initial.rma_no || "",
    replacement_tracking:
      initial.replacement_tracking || "",
    category: initial.category || "",
  };
}

/* ---------- REGION SKU HELPER (US / EMEA, Stock / B-Stock / R-Stock) ---------- */
/**
 * For a given base product SKU + region + stock_type, derive the
 * region-specific SKU variant using suffixes, e.g.:
 * US:
 *   normal RMA => -O
 *   B-Stock    => -B-O
 *   R-Stock    => -R-O
 * EMEA:
 *   normal RMA => -E
 *   B-Stock    => -B-E
 *   R-Stock    => -R-E
 *
 * Existing variant codes (already ending in -O, -E, -B-O, -B-E, -R-O, -R-E, -US)
 * are passed through unchanged.
 */
function toRegionSku(baseSku, org, stockType) {
  if (!baseSku) return baseSku;
  if (isVariantSku(baseSku)) return baseSku;

  const region = (org || "").toUpperCase();
  const stock = (stockType || "").toLowerCase();

  const isR = stock.includes("r-stock");
  const isB = !isR && stock.includes("b-stock");

  if (region === "US") {
    if (isR) return `${baseSku}-R-O`;
    if (isB) return `${baseSku}-B-O`;
    return `${baseSku}-O`;
  }

  if (region === "EMEA") {
    if (isR) return `${baseSku}-R-E`;
    if (isB) return `${baseSku}-B-E`;
    return `${baseSku}-E`;
  }

  return baseSku;
}

function isVariantSku(code) {
  if (!code) return false;
  return /-(?:O|E|US|B-O|B-E|R-O|R-E)$/i.test(
    code.trim()
  );
}

/* ---------- HUMAN HEADERS -> CANONICAL KEYS (for CSV import) ---------- */
const HUMAN_TO_CANON = {
  Date: "entry_date",
  Ticket: "ticket_id",
  "First Name": "first_name",
  "Last Name": "last_name",
  Email: "email",
  Phone: "phone",
  "Company (if Applicable)": "company",
  "Reseller / Customer": "reseller_customer",
  "Address 1": "address1",
  "Address 2": "address2",
  City: "city",
  "State (use 2 digit code)": "state",
  Country: "country",
  "Post Code": "postcode",
  "Product with fault": "product_with_fault",
  "Serial Number of faulty product":
    "serial_number",
  "Product SKU for replacement (no more ninja's without my approval)":
    "product_sku",
  "Device Name": "device_name",
  "RMA Type": "rma_type",
  "Stock Type": "stock_type",
  Quantity: "quantity",
  "Return Reason (Subject)":
    "returned_reason",
  Action: "action",
  "Customer Return Tracking Number (REQUIRED)":
    "custom_tracking",
  "RMA NO# (from RO)": "rma_no",
  "New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)":
    "replacement_tracking",
};

/* ---------- small helpers ---------- */
function Section({ label, children }) {
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className="bg-gray-100 px-3 py-2 font-semibold"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}

function renderRow(label, value) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">
        {label}
      </th>
      <td className="px-3 py-2">{value}</td>
    </tr>
  );
}
function renderInput(
  label,
  key,
  value,
  type,
  update
) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">
        {label}
      </th>
      <td className="px-3 py-2">
        <input
          type={type}
          className="border rounded px-3 py-2 w-full"
          value={type === "date" ? fmtDate(value) : value}
          onChange={update(key)}
        />
      </td>
    </tr>
  );
}
function renderSelect(
  label,
  key,
  value,
  options,
  update
) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">
        {label}
      </th>
      <td className="px-3 py-2">
        <select
          className="border rounded px-3 py-2 w-full"
          value={value}
          onChange={update(key)}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

const Th = ({ children }) => (
  <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
    {children}
  </th>
);
const Td = ({ children }) => (
  <td className="px-3 py-2 whitespace-nowrap align-top">
    {children}
  </td>
);

function input(
  label,
  key,
  value,
  update,
  type = "text",
  readOnly = false
) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">
        {label}
      </div>
      <input
        type={type}
        className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
        value={type === "date" ? fmtDate(value) : value}
        onChange={update(key)}
        disabled={readOnly}
      />
    </label>
  );
}

function select(
  label,
  key,
  value,
  options,
  update,
  readOnly = false
) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">
        {label}
      </div>
      <select
        className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
        value={value}
        onChange={update(key)}
        disabled={readOnly}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* Robust CSV parser supporting quotes, commas, newlines in fields */
function parseCsv(text) {
  const rows = [];
  let i = 0,
    cur = "",
    inQ = false,
    row = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  pushCell();
  if (row.length) pushRow();

  const headers = (rows.shift() || []).map((h) =>
    String(h || "").trim()
  );
  const records = rows
    .filter((r) =>
      r.some((c) => String(c).trim() !== "")
    )
    .map((r) =>
      Object.fromEntries(
        headers.map((h, idx) => [h, r[idx] ?? ""])
      )
    );
  return { headers, records };
}

function Num({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">
        {label}
      </div>
      <input
        type="number"
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value || 0))
        }
      />
    </label>
  );
}

/* extra date helpers for filters (entry_date) */
function getYear(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.getFullYear();
}

function getMonthKey(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
