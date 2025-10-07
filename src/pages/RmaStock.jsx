// src/pages/RmaStock.jsx
import { useEffect, useMemo, useState } from "react";

const CATEGORY_OPTIONS = ["product-fault", "warranty", "out-of-warranty", "other"];
const RMA_TYPE_OPTIONS = ["Warranty", "Out of Warranty", "Advance Replacement"];

export default function RmaStock() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7), // default to current YYYY-MM
    category: "",
    rma_type: "",
    stock_type: "",
  });

  const API = import.meta.env.VITE_API_BASE || "";

  useEffect(() => {
    (async () => {
      if (!filters.month) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          month: filters.month,
          category: filters.category || "",
        });
        const res = await fetch(`${API}/api/rma/entries?${qs.toString()}`, { credentials: "include" });
        const data = await res.json();
        const base = data?.entries || [];
        // client-side refine for rma_type/stock_type
        const refined = base.filter(r =>
          (!filters.rma_type || r.rma_type === filters.rma_type) &&
          (!filters.stock_type || (r.stock_type || "") === filters.stock_type)
        );
        setRows(refined);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters.month, filters.category, filters.rma_type, filters.stock_type]);

  // --- Analytics
  const kpis = useMemo(() => {
    const totalEntries = rows.length;
    const totalQty = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

    // qty by stock_type
    const qtyByStock = {};
    rows.forEach(r => {
      const k = r.stock_type || "—";
      qtyByStock[k] = (qtyByStock[k] || 0) + (Number(r.quantity) || 0);
    });

    // qty by rma_type
    const qtyByRmaType = {};
    rows.forEach(r => {
      const k = r.rma_type || "—";
      qtyByRmaType[k] = (qtyByRmaType[k] || 0) + (Number(r.quantity) || 0);
    });

    return { totalEntries, totalQty, qtyByStock, qtyByRmaType };
  }, [rows]);

  const [editRow, setEditRow] = useState(null);

  const onSaveEdit = async (patch) => {
    if (!editRow) return;
    const id = editRow.id;
    const res = await fetch(`${API}/api/rma/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("Update failed");
      return;
    }
    // update locally
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    setEditRow(null);
  };

  function exportCSV() {
    if (!rows.length) return alert("No rows to export.");
    const columns = [
      "id","entry_date","rma_no","ticket_id","first_name","last_name","email",
      "country","category","rma_type","stock_type","quantity","product_sku",
      "serial_number","device_name","returned_reason","action","replacement_tracking","custom_tracking"
    ];
    const header = columns.join(",");
    const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = `RMA_Stock_${filters.month || "all"}.csv`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Month</label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.month}
            onChange={(e) => setFilters(f => ({ ...f, month: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select
            className="border rounded px-3 py-2"
            value={filters.category}
            onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
          >
            <option value="">All</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">RMA Type</label>
          <select
            className="border rounded px-3 py-2"
            value={filters.rma_type}
            onChange={(e) => setFilters(f => ({ ...f, rma_type: e.target.value }))}
          >
            <option value="">All</option>
            {RMA_TYPE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Stock Type</label>
          <input
            className="border rounded px-3 py-2"
            placeholder="e.g., Refurbished, New, Repair"
            value={filters.stock_type}
            onChange={(e) => setFilters(f => ({ ...f, stock_type: e.target.value }))}
          />
        </div>

        <div className="ml-auto">
          <button onClick={exportCSV} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800" disabled={loading}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Entries" value={kpis.totalEntries} />
        <KPI label="Total Quantity" value={kpis.totalQty} />
        <Breakdown title="Qty by Stock Type" map={kpis.qtyByStock} />
        <Breakdown title="Qty by RMA Type" map={kpis.qtyByRmaType} />
      </div>

      {/* Entries table */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Entry Date</Th>
              <Th>RMA No</Th>
              <Th>Ticket</Th>
              <Th>Customer</Th>
              <Th>Country</Th>
              <Th>Category</Th>
              <Th>RMA Type</Th>
              <Th>Stock Type</Th>
              <Th>Qty</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="p-6 text-center">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="p-6 text-center">No entries</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <Td>{i + 1}</Td>
                <Td>{new Date(r.entry_date).toLocaleDateString()}</Td>
                <Td>{r.rma_no || "-"}</Td>
                <Td>{r.ticket_id || "-"}</Td>
                <Td>{[r.first_name, r.last_name].filter(Boolean).join(" ") || "-"}</Td>
                <Td>{r.country || "-"}</Td>
                <Td>{r.category || "-"}</Td>
                <Td>{r.rma_type || "-"}</Td>
                <Td>{r.stock_type || "-"}</Td>
                <Td>{r.quantity || 0}</Td>
                <Td>
                  <button className="text-blue-600 hover:underline" onClick={() => setEditRow(r)}>Edit</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editRow && (
        <EditModal
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSave={onSaveEdit}
        />
      )}
    </div>
  );
}

function KPI({ label, value }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Breakdown({ title, map }) {
  const entries = Object.entries(map || {});
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-2">{title}</div>
      {entries.length === 0 ? (
        <div className="text-sm text-gray-500">—</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="text-gray-700">{k}</span>
              <span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    stock_type: initial.stock_type || "",
    quantity: initial.quantity || 1,
    rma_no: initial.rma_no || "",
    replacement_tracking: initial.replacement_tracking || "",
    action: initial.action || "",
    returned_reason: initial.returned_reason || "",
    custom_tracking: initial.custom_tracking || "",
    product_sku: initial.product_sku || "",
    serial_number: initial.serial_number || "",
    device_name: initial.device_name || "",
  });
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit RMA Entry #{initial.id}</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {input("RMA No", "rma_no", form.rma_no, update)}
          {input("Stock Type", "stock_type", form.stock_type, update)}
          {input("Quantity", "quantity", form.quantity, update, "number")}
          {input("Replacement Tracking", "replacement_tracking", form.replacement_tracking, update)}
          {input("Action", "action", form.action, update)}
          {input("Returned Reason", "returned_reason", form.returned_reason, update)}
          {input("Custom Tracking", "custom_tracking", form.custom_tracking, update)}
          {input("Product SKU", "product_sku", form.product_sku, update)}
          {input("Serial Number", "serial_number", form.serial_number, update)}
          {input("Device Name", "device_name", form.device_name, update)}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button
            onClick={() => onSave({
              ...form,
              quantity: Number(form.quantity) || 0,
              updated_at: new Date().toISOString()
            })}
            className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function input(label, key, value, update, type = "text") {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input type={type} className="w-full border rounded px-3 py-2" value={value} onChange={update(key)} />
    </label>
  );
}

const Th = ({ children }) => <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>;
const Td = ({ children }) => <td className="px-3 py-2">{children}</td>;

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
