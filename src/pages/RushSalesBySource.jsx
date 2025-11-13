// src/pages/RushSalesBySource.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const TABLE = "rush_sales_by_source";

export default function RushSalesBySource() {
  const [tab, setTab] = useState("list");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 space-y-4">
      <div className="inline-flex rounded-xl border overflow-hidden">
        <TabButton active={tab === "list"} onClick={() => setTab("list")}>
          Sales by Source
        </TabButton>
        <TabButton active={tab === "new"} onClick={() => setTab("new")}>
          New Sales Entry
        </TabButton>
      </div>

      {tab === "list" ? (
        <RushSalesBySourceList refreshKey={refreshKey} />
      ) : (
        <RushSalesBySourceForm
          onCreated={() => {
            setRefreshKey((x) => x + 1);
            setTab("list");
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
      className={`px-4 py-2 text-sm font-medium ${
        active ? "bg-black text-white" : "bg-white hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ========================= LIST TAB ========================= */

function RushSalesBySourceList({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [yearFilter, setYearFilter] = useState("");

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("entry_date", { ascending: false }) // 🔑 filter on entry_date
        .order("id", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to load sales by source");
    } finally {
      setLoading(false);
    }
  }

  // reset page when filters / page size change
  useEffect(() => {
    setPage(1);
  }, [search, fromMonth, toMonth, fromDate, toDate, yearFilter, pageSize]);

  // build year dropdown from entry_date
  const yearOptions = useMemo(() => {
    const ys = new Set();
    for (const r of rows) {
      const y = getYear(r.entry_date);
      if (y) ys.add(y);
    }
    return Array.from(ys).sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        [
          r.source_code,
          r.source_code_description,
          r.product_code,
          r.product_description,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    // year filter (entry_date)
    if (yearFilter) {
      const yNum = Number(yearFilter);
      list = list.filter((r) => {
        const y = getYear(r.entry_date);
        if (!y) return false;
        return y === yNum;
      });
    }

    // month range (entry_date)
    if (fromMonth || toMonth) {
      list = list.filter((r) => {
        const key = getMonthKey(r.entry_date);
        if (!key) return true;
        if (fromMonth && key < fromMonth) return false;
        if (toMonth && key > toMonth) return false;
        return true;
      });
    }

    // date range (entry_date)
    if (fromDate || toDate) {
      list = list.filter((r) => {
        const s = normalizeDate(r.entry_date);
        if (!s) return true;
        if (fromDate && s < fromDate) return false;
        if (toDate && s > toDate) return false;
        return true;
      });
    }

    return list;
  }, [rows, search, yearFilter, fromMonth, toMonth, fromDate, toDate]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);
  const showingFrom = total === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageRows.length;

  function exportCSV() {
    if (!filtered.length) {
      alert("No rows to export.");
      return;
    }

    const headers = [
      "Source Code",
      "Source Code Description",
      "Product",
      "Description",
      "Unit Price",
      "# Sold",
      "Sales",
      "# Returned",
      "Returns",
      "# Net Units",
      "Net Sales",
      "Currency",
      "Report Date",
    ];

    const lines = filtered.map((r) =>
      [
        r.source_code,
        r.source_code_description,
        r.product_code,
        r.product_description,
        r.unit_price,
        r.units_sold,
        r.sales_amount,
        r.units_returned,
        r.returns_amount,
        r.net_units,
        r.net_sales,
        r.currency,
        r.report_date,
      ].map(csvEscape)
    );

    const csv =
      "\uFEFF" +
      [headers.map(csvEscape).join(","), ...lines.map((l) => l.join(","))].join(
        "\n"
      );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "rush_sales_by_source.csv",
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function openImport() {
    setImportMsg("");
    fileRef.current?.click();
  }

  async function handleImportChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setImporting(true);
      setImportMsg("Reading CSV...");
      const text = await file.text();

      const { headers, records } = parseCsv(text);
      if (!headers.length || !records.length) {
        setImportMsg("No data found in CSV.");
        setImporting(false);
        return;
      }

      const h = (name) =>
        headers.find((x) => x.toLowerCase() === name.toLowerCase());

      const todayIso = new Date().toISOString().slice(0, 10);

      const rowsToInsert = records.map((r) => ({
        source_code: r[h("Source Code")] || "",
        source_code_description: r[h("Source Code Description")] || "",
        product_code: r[h("Product")] || "",
        product_description: r[h("Description")] || "",
        unit_price: Number(r[h("Unit Price")] || 0),
        units_sold: Number(r[h("# Sold")] || 0),
        sales_amount: Number(r[h("Sales")] || 0),
        units_returned: Number(r[h("# Returned")] || 0),
        returns_amount: Number(r[h("Returns")] || 0),
        net_units: Number(r[h("# Net Units")] || 0),
        net_sales: Number(r[h("Net Sales")] || 0),
        currency: r[h("Currency")] || "USD",
        report_date: normalizeDate(r[h("Report Date")]),
        entry_date: normalizeDate(r[h("Entry Date")] || todayIso), // 🔑
      }));

      setImportMsg(`Importing ${rowsToInsert.length} row(s) into Supabase…`);

      const { error } = await supabase.from(TABLE).insert(rowsToInsert);
      if (error) throw error;

      setImportMsg(`Imported ${rowsToInsert.length} row(s) successfully.`);
      await fetchRows();
    } catch (err) {
      console.error(err);
      setImportMsg(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this sales entry?")) return;
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to delete entry");
    }
  }

  function clearFilters() {
    setSearch("");
    setFromMonth("");
    setToMonth("");
    setFromDate("");
    setToDate("");
    setYearFilter("");
  }

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs font-medium mb-1">Search</div>
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder="Source code, product, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Year selection (entry_date) */}
        <div>
          <div className="text-xs font-medium mb-1">Year (Entry Date)</div>
          <select
            className="border rounded px-3 py-2"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Month range (entry_date) */}
        <div>
          <div className="text-xs font-medium mb-1">From Month (Entry)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
          />
        </div>

        <div>
          <div className="text-xs font-medium mb-1">To Month (Entry)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={toMonth}
            onChange={(e) => setToMonth(e.target.value)}
          />
        </div>

        {/* Date range (entry_date) */}
        <div>
          <div className="text-xs font-medium mb-1">From Date (Entry)</div>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <div className="text-xs font-medium mb-1">To Date (Entry)</div>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <span>Rows per page:</span>
            <select
              className="border rounded px-2 py-1"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 25)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="rounded border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Clear filters
          </button>

          <button
            onClick={fetchRows}
            className="rounded border px-4 py-2 hover:bg-gray-50"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
            disabled={loading || importing}
          >
            Export CSV
          </button>
          <button
            onClick={openImport}
            className="rounded border px-4 py-2 hover:bg-gray-50"
            disabled={loading || importing}
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </div>

      {importMsg && <div className="text-xs text-gray-600">{importMsg}</div>}
      {err && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="border rounded overflow-auto">
        <table className="w-[1400px] max-w-none text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Source Code</Th>
              <Th>Source Desc</Th>
              <Th>Product</Th>
              <Th>Description</Th>
              <Th>Unit Price</Th>
              <Th># Sold</Th>
              <Th>Sales</Th>
              <Th># Returned</Th>
              <Th>Returns</Th>
              <Th># Net Units</Th>
              <Th>Net Sales</Th>
              <Th>Currency</Th>
              <Th>Report Date</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={15} className="p-6 text-center">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="p-6 text-center">
                  No sales entries
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr
                  key={r.id || `${r.source_code}-${r.product_code}-${i}`}
                  className="border-t hover:bg-gray-50"
                >
                  <Td>{startIndex + i + 1}</Td>
                  <Td>{r.source_code || "-"}</Td>
                  <Td>{r.source_code_description || "-"}</Td>
                  <Td>{r.product_code || "-"}</Td>
                  <Td>{r.product_description || "-"}</Td>
                  <Td>{r.unit_price ?? 0}</Td>
                  <Td>{r.units_sold ?? 0}</Td>
                  <Td>{r.sales_amount ?? 0}</Td>
                  <Td>{r.units_returned ?? 0}</Td>
                  <Td>{r.returns_amount ?? 0}</Td>
                  <Td>{r.net_units ?? 0}</Td>
                  <Td>{r.net_sales ?? 0}</Td>
                  <Td>{r.currency || "-"}</Td>
                  <Td>{fmtDate(r.report_date)}</Td>
                  <Td>
                    <button
                      className="text-red-600 text-xs hover:underline"
                      onClick={() => handleDelete(r.id)}
                    >
                      Delete
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
        <div>
          Showing {showingFrom}–{showingTo} of {total} row(s)
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= NEW ENTRY TAB ========================= */

function RushSalesBySourceForm({ onCreated }) {
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function blankForm() {
    return {
      source_code: "",
      source_code_description: "",
      product_code: "",
      product_description: "",
      unit_price: "",
      units_sold: "",
      sales_amount: "",
      units_returned: "",
      returns_amount: "",
      net_units: "",
      net_sales: "",
      currency: "USD",
      report_date: "",
      entry_date: "", // 🔑
    };
  }

  const updateForm = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const todayIso = new Date().toISOString().slice(0, 10);

      const payload = {
        ...form,
        unit_price: Number(form.unit_price || 0),
        units_sold: Number(form.units_sold || 0),
        sales_amount: Number(form.sales_amount || 0),
        units_returned: Number(form.units_returned || 0),
        returns_amount: Number(form.returns_amount || 0),
        net_units: Number(form.net_units || 0),
        net_sales: Number(form.net_sales || 0),
        report_date: normalizeDate(form.report_date),
        entry_date: normalizeDate(form.entry_date || todayIso),
      };

      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) throw error;

      setForm(blankForm());
      onCreated?.();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to create sales row");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
    >
      <div className="md:col-span-3 text-sm font-semibold">
        New Sales Entry
      </div>

      {err && (
        <div className="md:col-span-3 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {field("Source Code", "source_code", form.source_code, updateForm)}
      {field(
        "Source Code Description",
        "source_code_description",
        form.source_code_description,
        updateForm
      )}
      {field("Product Code", "product_code", form.product_code, updateForm)}

      {field(
        "Product Description",
        "product_description",
        form.product_description,
        updateForm
      )}
      {field("Unit Price", "unit_price", form.unit_price, updateForm, "number")}
      {field("# Sold", "units_sold", form.units_sold, updateForm, "number")}

      {field(
        "Sales Amount",
        "sales_amount",
        form.sales_amount,
        updateForm,
        "number"
      )}
      {field(
        "# Returned",
        "units_returned",
        form.units_returned,
        updateForm,
        "number"
      )}
      {field(
        "Returns Amount",
        "returns_amount",
        form.returns_amount,
        updateForm,
        "number"
      )}

      {field("Net Units", "net_units", form.net_units, updateForm, "number")}
      {field("Net Sales", "net_sales", form.net_sales, updateForm, "number")}
      {field("Currency", "currency", form.currency, updateForm)}

      {field("Report Date", "report_date", form.report_date, updateForm, "date")}
      {field("Entry Date", "entry_date", form.entry_date, updateForm, "date")}

      <div className="md:col-span-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setForm(blankForm())}
          className="px-4 py-2 rounded border"
          disabled={saving}
        >
          Clear
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
          disabled={saving}
        >
          {saving ? "Saving…" : "Add Entry"}
        </button>
      </div>
    </form>
  );
}

/* ========================= SHARED HELPERS ========================= */

function field(label, key, value, update, type = "text") {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-gray-600 mb-1">{label}</span>
      <input
        type={type}
        className="w-full border rounded px-3 py-2"
        value={type === "date" ? (value || "") : value}
        onChange={update(key)}
      />
    </label>
  );
}

const Th = ({ children }) => (
  <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
    {children}
  </th>
);
const Td = ({ children }) => (
  <td className="px-3 py-2 whitespace-nowrap align-top">{children}</td>
);

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString();
}

function getMonthKey(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getYear(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* Lightweight CSV parser */
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

  const headers = (rows.shift() || []).map((h) => String(h || "").trim());
  const records = rows
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""])));
  return { headers, records };
}
