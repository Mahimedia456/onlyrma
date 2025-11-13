// src/pages/RushProcessedOrders.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const TABLE = "rush_processed_orders";

export default function RushProcessedOrders() {
  const [tab, setTab] = useState("list");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 space-y-4">

      {/* Tabs */}
      <div className="inline-flex rounded-xl border overflow-hidden">
        <TabButton active={tab === "list"} onClick={() => setTab("list")}>
          Processed Orders
        </TabButton>
        <TabButton active={tab === "new"} onClick={() => setTab("new")}>
          New Processed Order
        </TabButton>
      </div>

      {tab === "list" ? (
        <RushProcessedOrdersList refreshKey={refreshKey} />
      ) : (
        <RushProcessedOrdersForm
          onCreated={() => {
            setRefreshKey(x => x + 1);
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

/* ============================================================
   LIST VIEW
============================================================ */

function RushProcessedOrdersList({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  // ENTRY DATE filters
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
    setErr("");

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("entry_date", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to load processed orders");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRow(id) {
    if (!confirm("Do you want to delete this entry?")) return;
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      setRows(prev => prev.filter(row => row.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, yearFilter, fromMonth, toMonth, fromDate, toDate, pageSize]);

  // Build year dropdown from entry_date
  const yearOptions = useMemo(() => {
    const ys = new Set();
    rows.forEach(r => {
      const y = getYear(r.entry_date);
      if (y) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => a - b);
  }, [rows]);

  // Filtering logic
  const filtered = useMemo(() => {
    let list = rows;

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        [
          r.order_no,
          r.invoice_part,
          r.alternate_order,
          r.purchase_order,
          r.customer_name,
          r.company,
          r.email,
          r.carrier_service,
          r.tracking_number,
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      );
    }

    // year filter
    if (yearFilter) {
      list = list.filter(r => getYear(r.entry_date) === Number(yearFilter));
    }

    // month range
    if (fromMonth || toMonth) {
      list = list.filter(r => {
        const key = getMonthKey(r.entry_date);
        if (!key) return false;
        if (fromMonth && key < fromMonth) return false;
        if (toMonth && key > toMonth) return false;
        return true;
      });
    }

    // date range
    if (fromDate || toDate) {
      list = list.filter(r => {
        const d = normalizeDate(r.entry_date);
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    }

    return list;
  }, [rows, search, yearFilter, fromMonth, toMonth, fromDate, toDate]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);

  function exportCSV() {
    if (!filtered.length) {
      alert("No rows to export.");
      return;
    }

    const headers = [
      "Order",
      "Invoice Part",
      "Order Date",
      "Invoice Date",
      "Alternate Order",
      "Purchase Order",
      "Name",
      "Company",
      "Email",
      "Units On Order",
      "Units Invoiced",
      "Units on Back Order",
      "Carrier / Service",
      "Tracking Number",
      "Serials",
    ];

    const lines = filtered.map(r =>
      [
        r.order_no,
        r.invoice_part,
        r.order_date,
        r.invoice_date,
        r.alternate_order,
        r.purchase_order,
        r.customer_name,
        r.company,
        r.email,
        r.units_on_order,
        r.units_invoiced,
        r.units_on_back_order,
        r.carrier_service,
        r.tracking_number,
        r.serials,
      ].map(csvEscape)
    );

    const csv =
      "\uFEFF" +
      [headers.join(","), ...lines.map(l => l.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "rush_processed_orders.csv",
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImport() {
    fileRef.current?.click();
  }

  async function handleImportChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setImporting(true);
      setImportMsg("Reading CSV…");

      const text = await file.text();
      const { headers, records } = parseCsv(text);

      const h = name =>
        headers.find(x => x.toLowerCase() === name.toLowerCase());

      const today = new Date().toISOString().slice(0, 10);

      const rowsToInsert = records.map(r => ({
        order_no: r[h("Order")] || "",
        invoice_part: r[h("Invoice Part")] || "",
        order_date: normalizeDate(r[h("Order Date")]),
        invoice_date: normalizeDate(r[h("Invoice Date")]),
        alternate_order: r[h("Alternate Order")] || "",
        purchase_order: r[h("Purchase Order")] || "",
        customer_name: r[h("Name")] || "",
        company: r[h("Company")] || "",
        email: r[h("Email")] || "",
        units_on_order: Number(r[h("Units On Order")] || 0),
        units_invoiced: Number(r[h("Units Invoiced")] || 0),
        units_on_back_order: Number(r[h("Units on Back Order")] || 0),
        carrier_service: r[h("Carrier / Service")] || "",
        tracking_number: r[h("Tracking Number")] || "",
        serials: r[h("Serials")] || "",
        entry_date: today,
      }));

      setImportMsg(`Importing ${rowsToInsert.length} rows…`);

      const { error } = await supabase.from(TABLE).insert(rowsToInsert);
      if (error) throw error;

      setImportMsg("Import completed successfully.");
      await fetchRows();
    } catch (err) {
      console.error(err);
      setImportMsg("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
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
    <div className="space-y-4">

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">

        {/* Search */}
        <div>
          <div className="text-xs mb-1 font-medium">Search</div>
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder="Order, company, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* YEAR */}
        <div>
          <div className="text-xs mb-1 font-medium">Year (Entry)</div>
          <select
            className="border rounded px-3 py-2"
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          >
            <option value="">All</option>
            {yearOptions.map(y => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* MONTH FROM */}
        <div>
          <div className="text-xs mb-1 font-medium">From Month (Entry)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={fromMonth}
            onChange={e => setFromMonth(e.target.value)}
          />
        </div>

        {/* MONTH TO */}
        <div>
          <div className="text-xs mb-1 font-medium">To Month (Entry)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={toMonth}
            onChange={e => setToMonth(e.target.value)}
          />
        </div>

        {/* DATE FROM */}
        <div>
          <div className="text-xs mb-1 font-medium">From Date (Entry)</div>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>

        {/* DATE TO */}
        <div>
          <div className="text-xs mb-1 font-medium">To Date (Entry)</div>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">

          <button
            className="rounded border px-3 py-2 text-xs"
            onClick={clearFilters}
          >
            Clear Filters
          </button>

          <button
            onClick={exportCSV}
            className="rounded bg-black text-white px-4 py-2"
          >
            Export CSV
          </button>

          <button
            onClick={openImport}
            className="rounded border px-4 py-2"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept=".csv"
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
        <table className="w-[1500px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Order</Th>
              <Th>Invoice Part</Th>
              <Th>Order Date</Th>
              <Th>Invoice Date</Th>
              <Th>Alternate</Th>
              <Th>PO</Th>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Units On</Th>
              <Th>Units Invoiced</Th>
              <Th>Back Order</Th>
              <Th>Carrier</Th>
              <Th>Tracking</Th>
              <Th>Serials</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={17} className="p-6 text-center">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="p-6 text-center">
                  No processed orders found
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <Td>{startIndex + i + 1}</Td>
                  <Td>{r.order_no}</Td>
                  <Td>{r.invoice_part}</Td>
                  <Td>{fmtDate(r.order_date)}</Td>
                  <Td>{fmtDate(r.invoice_date)}</Td>
                  <Td>{r.alternate_order}</Td>
                  <Td>{r.purchase_order}</Td>
                  <Td>{r.customer_name}</Td>
                  <Td>{r.company}</Td>
                  <Td>{r.email}</Td>
                  <Td>{r.units_on_order}</Td>
                  <Td>{r.units_invoiced}</Td>
                  <Td>{r.units_on_back_order}</Td>
                  <Td>{r.carrier_service}</Td>
                  <Td>{r.tracking_number}</Td>
                  <Td>{r.serials}</Td>
                  <Td>
                    <button
                      className="text-red-600 hover:underline text-xs"
                      onClick={() => deleteRow(r.id)}
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

      {/* Pagination */}
      <div className="flex justify-between text-xs text-gray-600">
        <div>
          Showing {pageRows.length ? startIndex + 1 : 0} –{" "}
          {startIndex + pageRows.length} of {total}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded"
            disabled={safePage <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Prev
          </button>

          <span>
            Page {safePage} of {totalPages}
          </span>

          <button
            className="px-2 py-1 border rounded"
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

    </div>
  );
}

/* ============================================================
   NEW ENTRY FORM
============================================================ */

function RushProcessedOrdersForm({ onCreated }) {
  const [form, setForm] = useState({
    order_no: "",
    invoice_part: "",
    order_date: "",
    invoice_date: "",
    alternate_order: "",
    purchase_order: "",
    customer_name: "",
    company: "",
    email: "",
    units_on_order: "",
    units_invoiced: "",
    units_on_back_order: "",
    carrier_service: "",
    tracking_number: "",
    serials: "",
    entry_date: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function update(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");

    try {
      const today = new Date().toISOString().slice(0, 10);

      const payload = {
        ...form,
        order_date: normalizeDate(form.order_date),
        invoice_date: normalizeDate(form.invoice_date),
        units_on_order: Number(form.units_on_order || 0),
        units_invoiced: Number(form.units_invoiced || 0),
        units_on_back_order: Number(form.units_on_back_order || 0),
        entry_date: normalizeDate(form.entry_date || today),
      };

      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) throw error;

      setForm({
        order_no: "",
        invoice_part: "",
        order_date: "",
        invoice_date: "",
        alternate_order: "",
        purchase_order: "",
        customer_name: "",
        company: "",
        email: "",
        units_on_order: "",
        units_invoiced: "",
        units_on_back_order: "",
        carrier_service: "",
        tracking_number: "",
        serials: "",
        entry_date: "",
      });

      onCreated();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
    >
      <div className="md:col-span-3 text-sm font-semibold">
        New Processed Order
      </div>

      {err && (
        <div className="md:col-span-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {field("Order #", "order_no", form.order_no, update)}
      {field("Invoice Part", "invoice_part", form.invoice_part, update)}
      {field("Alternate Order", "alternate_order", form.alternate_order, update)}

      {field("Order Date", "order_date", form.order_date, update, "date")}
      {field("Invoice Date", "invoice_date", form.invoice_date, update, "date")}
      {field("Purchase Order", "purchase_order", form.purchase_order, update)}

      {field("Name", "customer_name", form.customer_name, update)}
      {field("Company", "company", form.company, update)}
      {field("Email", "email", form.email, update, "email")}

      {field("Units On Order", "units_on_order", form.units_on_order, update, "number")}
      {field("Units Invoiced", "units_invoiced", form.units_invoiced, update, "number")}
      {field("Units on Back Order", "units_on_back_order", form.units_on_back_order, update, "number")}

      {field("Carrier / Service", "carrier_service", form.carrier_service, update)}
      {field("Tracking Number", "tracking_number", form.tracking_number, update)}

      <div className="md:col-span-2">
        {field("Serials", "serials", form.serials, update)}
      </div>

      {field("Entry Date", "entry_date", form.entry_date, update, "date")}

      <div className="md:col-span-3 flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 border rounded"
          onClick={() =>
            setForm({
              order_no: "",
              invoice_part: "",
              order_date: "",
              invoice_date: "",
              alternate_order: "",
              purchase_order: "",
              customer_name: "",
              company: "",
              email: "",
              units_on_order: "",
              units_invoiced: "",
              units_on_back_order: "",
              carrier_service: "",
              tracking_number: "",
              serials: "",
              entry_date: "",
            })
          }
        >
          Clear
        </button>

        <button
          type="submit"
          className="px-4 py-2 bg-black text-white rounded"
          disabled={saving}
        >
          {saving ? "Saving…" : "Add Order"}
        </button>
      </div>
    </form>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function field(label, key, value, update, type = "text") {
  return (
    <label className="block text-sm">
      <span className="text-xs text-gray-600 mb-1 block">{label}</span>
      <input
        type={type}
        className="border rounded px-3 py-2 w-full"
        value={type === "date" ? value || "" : value}
        onChange={update(key)}
      />
    </label>
  );
}

const Th = ({ children }) => (
  <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
    {children}
  </th>
);

const Td = ({ children }) => (
  <td className="px-3 py-2 whitespace-nowrap align-top">{children}</td>
);

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString();
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function getYear(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.getFullYear();
}

function getMonthKey(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// CSV Parser
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  const headers = lines.shift().split(",").map(h => h.trim());
  const records = lines.map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] || "";
    });
    return obj;
  });
  return { headers, records };
}
