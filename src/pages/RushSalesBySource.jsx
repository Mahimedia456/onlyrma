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

  const [yearFilter, setYearFilter] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    fetchRows();
  }, [refreshKey]);

  async function fetchRows() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
  }, [search, fromMonth, toMonth, fromDate, toDate, yearFilter, pageSize]);

  const yearOptions = useMemo(() => {
    const ys = new Set();
    rows.forEach((r) => {
      const y = getYear(r.created_at);
      if (y) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];

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
          .some((v) => v.toLowerCase().includes(q))
      );
    }

    list = list.filter((r) => {
      const d = normalize(r.created_at);
      const y = getYear(r.created_at);
      const m = getMonth(r.created_at);

      if (yearFilter && y !== Number(yearFilter)) return false;
      if (fromMonth && m < Number(fromMonth)) return false;
      if (toMonth && m > Number(toMonth)) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;

      return true;
    });

    return list;
  }, [rows, search, yearFilter, fromMonth, toMonth, fromDate, toDate]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);

  function exportCSV() {
    if (!filtered.length) return alert("No rows to export.");

    const headers = [
      "Source Code",
      "Source Desc",
      "Product Code",
      "Product Description",
      "Unit Price",
      "Units Sold",
      "Sales Amount",
      "Units Returned",
      "Returns Amount",
      "Net Units",
      "Net Sales",
      "Currency",
      "Created At",
    ];

    const csv =
      "\uFEFF" +
      [headers.join(","), ...filtered.map((r) =>
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
          normalize(r.created_at),
        ]
          .map(csvEscape)
          .join(",")
      )].join("\n");

    downloadFile("rush_sales_by_source.csv", csv);
  }

  function openImport() {
    fileRef.current?.click();
  }

  async function handleImportChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const { headers, records } = parseCsv(text);

    const h = (name) =>
  headers.find((x) => x.toLowerCase() === name.toLowerCase());

const today = new Date().toISOString().slice(0, 10);

const rowsToInsert = records.map((r) => {
  const reportDate = normalize(r[h("Report Date")]) || today;
  return {
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
    report_date: reportDate,           // optional, if column exists
    entry_date: reportDate,            // optional, if you have this column
    created_at: new Date().toISOString(),
  };
});

      const { error } = await supabase.from(TABLE).insert(rowsToInsert);
      if (error) throw error;

      fetchRows();
    } catch (e) {
      setImportMsg("Import failed: " + e.message);
    }
    setImporting(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete entry?")) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setRows((s) => s.filter((x) => x.id !== id));
  }

  function clearFilters() {
    setSearch("");
    setYearFilter("");
    setFromMonth("");
    setToMonth("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="space-y-3">
      {/* FILTERS */}
      <div className="flex flex-wrap items-end gap-3">

        <Input label="Search" value={search} setter={setSearch} w="w-64" />

        <Select label="Year" value={yearFilter} setter={setYearFilter}
          options={yearOptions.map((y) => [y, y])}
        />

        <Select label="From Month" value={fromMonth} setter={setFromMonth}
          options={months}
        />

        <Select label="To Month" value={toMonth} setter={setToMonth}
          options={months}
        />

        <DateInput label="From Date" value={fromDate} setter={setFromDate} />
        <DateInput label="To Date" value={toDate} setter={setToDate} />

        <div className="ml-auto flex gap-2">
          <button className="border px-3 py-2 text-xs" onClick={clearFilters}>
            Clear
          </button>
          <button className="border px-4 py-2" onClick={fetchRows}>
            Refresh
          </button>
          <button className="bg-black text-white px-4 py-2" onClick={exportCSV}>
            Export CSV
          </button>
          <button className="border px-4 py-2" onClick={openImport}>
            Import CSV
          </button>
          <input type="file" ref={fileRef} onChange={handleImportChange} className="hidden" />
        </div>
      </div>

      {importMsg && <div className="text-xs text-gray-600">{importMsg}</div>}

      {/* TABLE */}
      <div className="border rounded overflow-auto">
        <table className="min-w-[1400px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Source Code</Th>
              <Th>Description</Th>
              <Th>Product</Th>
              <Th>Product Desc</Th>
              <Th>Unit Price</Th>
              <Th>Sold</Th>
              <Th>Sales</Th>
              <Th>Returned</Th>
              <Th>Returns</Th>
              <Th>Net Units</Th>
              <Th>Net Sales</Th>
              <Th>Currency</Th>
              <Th>Created At</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan="15" className="p-6 text-center">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan="15" className="p-6 text-center">No entries</td></tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <Td>{startIndex + i + 1}</Td>
                  <Td>{r.source_code}</Td>
                  <Td>{r.source_code_description}</Td>
                  <Td>{r.product_code}</Td>
                  <Td>{r.product_description}</Td>
                  <Td>{r.unit_price}</Td>
                  <Td>{r.units_sold}</Td>
                  <Td>{r.sales_amount}</Td>
                  <Td>{r.units_returned}</Td>
                  <Td>{r.returns_amount}</Td>
                  <Td>{r.net_units}</Td>
                  <Td>{r.net_sales}</Td>
                  <Td>{r.currency}</Td>
                  <Td>{fmt(r.created_at)}</Td>
                  <Td>
                    <button className="text-red-600" onClick={() => handleDelete(r.id)}>
                      Delete
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-between text-xs px-1">
        <span>
          Showing {startIndex + 1}–{startIndex + pageRows.length} of {total}
        </span>
        <div className="flex gap-2">
          <button className="border px-3 py-1" disabled={safePage <= 1}
            onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>Page {safePage} / {totalPages || 1}</span>
          <button className="border px-3 py-1" disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= NEW ENTRY TAB ========================= */

function RushSalesBySourceForm({ onCreated }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
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
  });

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");

    try {
      const payload = {
        ...form,
        unit_price: Number(form.unit_price || 0),
        units_sold: Number(form.units_sold || 0),
        sales_amount: Number(form.sales_amount || 0),
        units_returned: Number(form.units_returned || 0),
        returns_amount: Number(form.returns_amount || 0),
        net_units: Number(form.net_units || 0),
        net_sales: Number(form.net_sales || 0),
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) throw error;

      onCreated();
      setForm({
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
      });

    } catch (e) {
      setErr(e.message);
    }

    setSaving(false);
  }

  return (
    <form
      onSubmit={submit}
      className="border p-4 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl"
    >
      <h2 className="md:col-span-3 font-semibold">New Sales Entry</h2>

      {err && <div className="md:col-span-3 text-red-600">{err}</div>}

      {Field("Source Code", "source_code", form.source_code, update)}
      {Field("Source Description", "source_code_description", form.source_code_description, update)}
      {Field("Product Code", "product_code", form.product_code, update)}

      {Field("Product Description", "product_description", form.product_description, update)}
      {Field("Unit Price", "unit_price", form.unit_price, update, "number")}
      {Field("Units Sold", "units_sold", form.units_sold, update, "number")}

      {Field("Sales Amount", "sales_amount", form.sales_amount, update, "number")}
      {Field("Units Returned", "units_returned", form.units_returned, update, "number")}
      {Field("Returns Amount", "returns_amount", form.returns_amount, update, "number")}

      {Field("Net Units", "net_units", form.net_units, update, "number")}
      {Field("Net Sales", "net_sales", form.net_sales, update, "number")}
      {Field("Currency", "currency", form.currency, update)}

      <div className="md:col-span-3 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {saving ? "Saving…" : "Add Entry"}
        </button>
      </div>
    </form>
  );
}

/* ========================= UI HELPERS ========================= */
const Th = ({ children }) => (
  <th className="px-3 py-2 text-xs font-semibold whitespace-nowrap">{children}</th>
);
const Td = ({ children }) => (
  <td className="px-3 py-2 whitespace-nowrap">{children}</td>
);

function Field(label, key, value, update, type = "text") {
  return (
    <label className="text-sm">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={update(key)}
      />
    </label>
  );
}

function Input({ label, value, setter, w = "" }) {
  return (
    <label className={`text-sm ${w}`}>
      <div className="text-xs mb-1">{label}</div>
      <input
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={(e) => setter(e.target.value)}
      />
    </label>
  );
}

function DateInput({ label, value, setter }) {
  return (
    <label className="text-sm">
      <div className="text-xs mb-1">{label}</div>
      <input
        type="date"
        className="border rounded px-3 py-2"
        value={value}
        onChange={(e) => setter(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, setter, options }) {
  return (
    <label className="text-sm">
      <div className="text-xs mb-1">{label}</div>
      <select
        className="border rounded px-3 py-2"
        value={value}
        onChange={(e) => setter(e.target.value)}
      >
        <option value="">All</option>
        {options.map(([val, text]) => (
          <option key={val} value={val}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function csvEscape(v) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ========================= DATE HELPERS ========================= */

const months = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

function normalize(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function getYear(date) {
  const d = new Date(date);
  return d.getFullYear();
}

function getMonth(date) {
  const d = new Date(date);
  return d.getMonth() + 1;
}

function fmt(date) {
  const d = new Date(date);
  return d.toLocaleDateString();
}

/* ========================= CSV PARSER ========================= */
function parseCsv(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur) row.push(cur);
  if (row.length) rows.push(row);

  const headers = rows.shift().map((h) => h.trim());
  const records = rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]))
  );

  return { headers, records };
}
