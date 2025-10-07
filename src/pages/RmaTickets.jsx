// src/pages/RmaTickets.jsx
import { useEffect, useMemo, useState } from "react";

export default function RmaTickets() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [viewId, setViewId] = useState(""); // Zendesk view selector
  const [filters, setFilters] = useState({
    category: "",
    supportType: "",
    from: "",
    to: "",
    month: "", // NEW: YYYY-MM
  });

  // Fetch Zendesk views for dropdown
  const [views, setViews] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/zd/views");
        const data = await res.json();
        setViews(data?.views || []);
      } catch (e) {}
    })();
  }, []);

  // Fetch tickets for selected view (server will call Zendesk and return tickets)
  useEffect(() => {
    if (!viewId) return;
    setLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({
          viewId,
          category: filters.category || "",
          supportType: filters.supportType || "",
          from: filters.from || "",
          to: filters.to || ""
        });
        const res = await fetch(`/api/rma/tickets?${qs.toString()}`);
        const data = await res.json();
        setRows(data?.tickets || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [viewId, filters.category, filters.supportType, filters.from, filters.to]); // (month is client-side only)

  // Client-side month filter
  const filteredRows = useMemo(() => {
    if (!filters.month) return rows;
    // Keep rows whose updated_at is in that YYYY-MM
    return rows.filter((r) => {
      const d = new Date(r.updated_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === filters.month;
    });
  }, [rows, filters.month]);

  const kpis = useMemo(() => {
    const list = filteredRows;
    const total = list.length;
    const warranty = list.filter(r => r.rmaType === "Warranty").length;
    const oow = list.filter(r => r.rmaType === "Out of Warranty").length;
    const pending = list.filter(r => r.status === "open" || r.status === "pending").length;
    return { total, warranty, oow, pending };
  }, [filteredRows]);

  function exportCSV() {
    const data = filteredRows;
    if (!data.length) {
      alert("No rows to export with current filters.");
      return;
    }
    // Decide columns to export
    const columns = [
      "id",
      "requester_name",
      "subject",
      "status",
      "rmaType",
      "category",
      "supportType",
      "updated_at",
    ];

    const header = columns.join(",");
    const lines = data.map((r) =>
      columns
        .map((c) => csvEscape(r[c]))
        .join(",")
    );
    // Add BOM for Excel compatibility
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Filename with month if present
    const monthPart = filters.month ? `_${filters.month}` : "";
    const filename = `RMA_Tickets${monthPart}.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  return (
    <div className="p-4 space-y-4">
      {/* Analytics header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total RMA Tickets" value={kpis.total} />
        <KPI label="Warranty" value={kpis.warranty} />
        <KPI label="Out of Warranty" value={kpis.oow} />
        <KPI label="Open/Pending" value={kpis.pending} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Zendesk View</label>
          <select
            value={viewId}
            onChange={(e) => setViewId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Select view…</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="border rounded px-3 py-2"
          >
            <option value="">All</option>
            <option value="product-fault">Product fault</option>
            <option value="warranty">Warranty</option>
            <option value="out-of-warranty">Out of warranty</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Support Type</label>
          <select
            value={filters.supportType}
            onChange={(e) => setFilters((f) => ({ ...f, supportType: e.target.value }))}
            className="border rounded px-3 py-2"
          >
            <option value="">All</option>
            <option value="tech-help">Tech help</option>
            <option value="data-recovery">Data recovery</option>
            <option value="warranty-claim">Warranty claim</option>
            <option value="general-support">General support</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>

        {/* NEW: Month filter (client-side) */}
        <div>
          <label className="block text-xs font-medium mb-1">Month</label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          />
        </div>

        {/* NEW: Export button */}
        <div className="ml-auto">
          <button
            onClick={exportCSV}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
            disabled={loading}
            title="Export filtered rows as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Results list (like TicketsList but separate component) */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Ticket ID</Th>
              <Th>Requester</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
              <Th>RMA Type</Th>
              <Th>Category</Th>
              <Th>Support Type</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center">
                  Loading…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center">
                  No tickets
                </td>
              </tr>
            ) : (
              filteredRows.map((r, i) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <Td>{i + 1}</Td>
                  <Td>{r.id}</Td>
                  <Td>{r.requester_name}</Td>
                  <Td>{r.subject}</Td>
                  <Td className="capitalize">{r.status}</Td>
                  <Td>{r.rmaType || "-"}</Td>
                  <Td>{r.category || "-"}</Td>
                  <Td>{r.supportType || "-"}</Td>
                  <Td>{new Date(r.updated_at).toLocaleString()}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
const Th = ({ children }) => (
  <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>
);
const Td = ({ children }) => <td className="px-3 py-2">{children}</td>;

// --- helpers ---
function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  // Escape double quotes and wrap if contains comma/quote/newline
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
