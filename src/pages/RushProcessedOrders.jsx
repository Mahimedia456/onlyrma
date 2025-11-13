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

function RushProcessedOrdersList({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

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
        .order("order_date", { ascending: false })
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

  useEffect(() => {
    setPage(1);
  }, [search, fromMonth, toMonth]);

  const filtered = useMemo(() => {
    let list = rows;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        [
          r.order_number,
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
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (fromMonth || toMonth) {
      list = list.filter((r) => {
        const key = getMonthKey(r.order_date);
        if (!key) return true;
        if (fromMonth && key < fromMonth) return false;
        if (toMonth && key > toMonth) return false;
        return true;
      });
    }

    return list;
  }, [rows, search, fromMonth, toMonth]);

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

    const lines = filtered.map((r) =>
      [
        r.order_number,
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
        r.units_back_order,
        r.carrier_service,
        r.tracking_number,
        r.serials,
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
      download: "rush_processed_orders.csv",
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

      const rowsToInsert = records.map((r) => ({
        order_number: r[h("Order")] || "",
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
        units_back_order: Number(r[h("Units on Back Order")] || 0),
        carrier_service: r[h("Carrier / Service")] || "",
        tracking_number: r[h("Tracking Number")] || "",
        serials: r[h("Serials")] || "",
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
    if (!window.confirm("Delete this processed order?")) return;
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to delete order");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs font-medium mb-1">Search</div>
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder="Order, email, company, tracking…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div>
          <div className="text-xs font-medium mb-1">From Month (Order)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
          />
        </div>

        <div>
          <div className="text-xs font-medium mb-1">To Month (Order)</div>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={toMonth}
            onChange={(e) => setToMonth(e.target.value)}
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
              <Th>Order</Th>
              <Th>Invoice Part</Th>
              <Th>Order Date</Th>
              <Th>Invoice Date</Th>
              <Th>Alt Order</Th>
              <Th>PO</Th>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Units On</Th>
              <Th>Units Invoiced</Th>
              <Th>Back Order</Th>
              <Th>Carrier / Service</Th>
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
                  No processed orders
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr
                  key={r.id || `${r.order_number}-${i}`}
                  className="border-t hover:bg-gray-50"
                >
                  <Td>{startIndex + i + 1}</Td>
                  <Td>{r.order_number || "-"}</Td>
                  <Td>{r.invoice_part || "-"}</Td>
                  <Td>{fmtDate(r.order_date)}</Td>
                  <Td>{fmtDate(r.invoice_date)}</Td>
                  <Td>{r.alternate_order || "-"}</Td>
                  <Td>{r.purchase_order || "-"}</Td>
                  <Td>{r.customer_name || "-"}</Td>
                  <Td>{r.company || "-"}</Td>
                  <Td>{r.email || "-"}</Td>
                  <Td>{r.units_on_order ?? 0}</Td>
                  <Td>{r.units_invoiced ?? 0}</Td>
                  <Td>{r.units_back_order ?? 0}</Td>
                  <Td>{r.carrier_service || "-"}</Td>
                  <Td>{r.tracking_number || "-"}</Td>
                  <Td>{r.serials || "-"}</Td>
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

function RushProcessedOrdersForm({ onCreated }) {
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function blankForm() {
    return {
      order_number: "",
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
      units_back_order: "",
      carrier_service: "",
      tracking_number: "",
      serials: "",
    };
  }

  const updateForm = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const payload = {
        ...form,
        order_date: normalizeDate(form.order_date),
        invoice_date: normalizeDate(form.invoice_date),
        units_on_order: Number(form.units_on_order || 0),
        units_invoiced: Number(form.units_invoiced || 0),
        units_back_order: Number(form.units_back_order || 0),
      };

      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) throw error;

      setForm(blankForm());
      onCreated?.();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to create order");
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
        New Processed Order
      </div>

      {err && (
        <div className="md:col-span-3 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {field("Order #", "order_number", form.order_number, updateForm)}
      {field("Invoice Part", "invoice_part", form.invoice_part, updateForm)}
      {field("Alternate Order", "alternate_order", form.alternate_order, updateForm)}

      {field("Order Date", "order_date", form.order_date, updateForm, "date")}
      {field("Invoice Date", "invoice_date", form.invoice_date, updateForm, "date")}
      {field("Purchase Order", "purchase_order", form.purchase_order, updateForm)}

      {field("Name", "customer_name", form.customer_name, updateForm)}
      {field("Company", "company", form.company, updateForm)}
      {field("Email", "email", form.email, updateForm, "email")}

      {field("Units On Order", "units_on_order", form.units_on_order, updateForm, "number")}
      {field("Units Invoiced", "units_invoiced", form.units_invoiced, updateForm, "number")}
      {field(
        "Units on Back Order",
        "units_back_order",
        form.units_back_order,
        updateForm,
        "number"
      )}

      {field(
        "Carrier / Service",
        "carrier_service",
        form.carrier_service,
        updateForm
      )}
      {field("Tracking Number", "tracking_number", form.tracking_number, updateForm)}
      <div className="md:col-span-2">
        {field("Serials", "serials", form.serials, updateForm)}
      </div>

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
          {saving ? "Saving…" : "Add Order"}
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

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* Lightweight CSV parser (same style as before) */
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
