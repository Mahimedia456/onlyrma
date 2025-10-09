// src/pages/RmaStockUs.jsx
import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/** Lightweight session reader */
function useSessionRoleInline() {
  const [state, setState] = useState({ ready: false, role: "viewer", user: null, error: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(apiUrl("/session"), { credentials: "include" });
        const d = await (async () => { try { return await r.json(); } catch { return null; } })();
        if (!alive) return;
        if (!r.ok) {
          setState({ ready: true, role: "viewer", user: null, error: d?.error || `HTTP ${r.status}` });
        } else {
          setState({ ready: true, role: d?.role || "viewer", user: d?.user || null, error: "" });
        }
      } catch (e) {
        if (!alive) return;
        setState({ ready: true, role: "viewer", user: null, error: e?.message || "No session" });
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}

export default function RmaStockUs() {
  const { ready, role, error } = useSessionRoleInline();

  const API = import.meta.env.VITE_API_BASE || "";
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank());

  function blank() {
    return {
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
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl(`/rma/us/devices`), { credentials: "include" });
        const data = await res.json();
        setDevices(res.ok ? (data?.devices || []) : []);
        if (!res.ok) console.error("US devices fetch failed", data);
      } catch (e) {
        console.error("US devices fetch failed", e);
        setDevices([]);
      }
    })();
  }, [API]);

  useEffect(() => {
    (async () => {
      if (!month) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ month, ...(device ? { device_name: device } : {}) });
        const res = await fetch(apiUrl(`/rma/us/stock?${qs.toString()}`), { credentials: "include" });
        const data = await res.json();
        setRows(res.ok ? (data?.items || []) : []);
        if (!res.ok) console.error("US stock fetch failed", data);
      } catch (e) {
        console.error("US stock fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, month, device]);

  const totals = useMemo(() => {
    const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return {
      d_stock_received: sum("d_stock_received"),
      b_stock_received: sum("b_stock_received"),
      new_stock_sent: sum("new_stock_sent"),
      rma_bstock_rstock_sent: sum("rma_bstock_rstock_sent"),
      a_stock_received: sum("a_stock_received"),
      awaiting_delivery_from_user: sum("awaiting_delivery_from_user"),
      receive_only: sum("receive_only"),
      awaiting_return_from_rush: sum("awaiting_return_from_rush"),
    };
  }, [rows]);

  async function saveNew() {
    if (!device) return alert("Select a device");
    const payload = { month, device_name: device, ...numberize(form) };
    const res = await fetch(apiUrl(`/rma/us/stock`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await safeJson(res);
      console.error("US save failed", d);
      return alert("Save failed");
    }
    const r = await fetch(apiUrl(`/rma/us/stock?month=${encodeURIComponent(month)}`), { credentials: "include" });
    const d = await r.json();
    setRows(d?.items || []);
    setForm(blank());
  }

  function numberize(obj) {
    const out = { ...obj };
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) out[k] = Number(v);
    }
    return out;
  }

  async function updateRow(id, patch) {
    const res = await fetch(apiUrl(`/rma/us/stock/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(numberize(patch)),
    });
    if (!res.ok) {
      const d = await safeJson(res);
      console.error("US update failed", d);
      return alert("Update failed");
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function exportCSV() {
    if (!rows.length) return alert("No rows to export.");
    const cols = [
      "id","month","device_name",
      "d_stock_received","b_stock_received","new_stock_sent","rma_bstock_rstock_sent",
      "a_stock_received","awaiting_delivery_from_user","receive_only","awaiting_return_from_rush",
      "notes","created_at","updated_at"
    ];
    const header = cols.join(",");
    const lines = rows.map(r => cols.map(c => csvEscape(r[c])).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const name = `RMA_US_Stock_${month || "all"}.csv`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // -------- Render gates (no early return → stable hooks) --------
  if (!ready) return <PageShell><div className="p-6">Loading session…</div></PageShell>;
  if (error) return <PageShell><div className="p-6 text-red-600">Session error: {error}</div></PageShell>;
  if (role !== "admin") {
    return (
      <PageShell>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2">Forbidden</h2>
          <p className="text-gray-600">This page is available to admin users only.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Filters / New row */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Month</label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Device</label>
          <select
            className="border rounded px-3 py-2"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">All devices…</option>
            {devices.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* New entry quick inputs */}
        <Quick number label="D Stock Received" value={form.d_stock_received} onChange={(v)=>setForm(f=>({...f,d_stock_received:v}))}/>
        <Quick number label="B-Stock Received" value={form.b_stock_received} onChange={(v)=>setForm(f=>({...f,b_stock_received:v}))}/>
        <Quick number label="New Stock Sent" value={form.new_stock_sent} onChange={(v)=>setForm(f=>({...f,new_stock_sent:v}))}/>
        <Quick number label="RMA/ B-Stock R-Stock Sent" value={form.rma_bstock_rstock_sent} onChange={(v)=>setForm(f=>({...f,rma_bstock_rstock_sent:v}))}/>
        <Quick number label="A Stock - Received" value={form.a_stock_received} onChange={(v)=>setForm(f=>({...f,a_stock_received:v}))}/>
        <Quick number label="Awaiting Delivery from User" value={form.awaiting_delivery_from_user} onChange={(v)=>setForm(f=>({...f,awaiting_delivery_from_user:v}))}/>
        <Quick number label="Receive Only" value={form.receive_only} onChange={(v)=>setForm(f=>({...f,receive_only:v}))}/>
        <Quick number label="Awaiting Return from Rush" value={form.awaiting_return_from_rush} onChange={(v)=>setForm(f=>({...f,awaiting_return_from_rush:v}))}/>

        <div className="w-full md:flex-1">
          <label className="block text-xs font-medium mb-1">Notes</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={exportCSV} className="rounded border px-4 py-2 hover:bg-gray-50" disabled={loading}>
            Export CSV
          </button>
          <button onClick={saveNew} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800">
            Save
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPI label="D Stock Recvd" value={totals.d_stock_received} />
        <KPI label="B-Stock Recvd" value={totals.b_stock_received} />
        <KPI label="New Stock Sent" value={totals.new_stock_sent} />
        <KPI label="RMA/B-Stock Sent" value={totals.rma_bstock_rstock_sent} />
        <KPI label="A Stock Recvd" value={totals.a_stock_received} />
        <KPI label="Awaiting User" value={totals.awaiting_delivery_from_user} />
        <KPI label="Receive Only" value={totals.receive_only} />
        <KPI label="Awaiting Rush" value={totals.awaiting_return_from_rush} />
      </div>

      {/* Grid */}
      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Device Name</Th>
              <Th>D Stock Received</Th>
              <Th>B-Stock Received</Th>
              <Th>New Stock Sent</Th>
              <Th>RMA/ B-Stock R-Stock Sent</Th>
              <Th>A Stock - Received</Th>
              <Th>Awaiting Delivery from User</Th>
              <Th>Receive Only</Th>
              <Th>Awaiting Return from Rush</Th>
              <Th>Notes</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="p-6 text-center">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="p-6 text-center">No rows</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                <Td className="font-medium">{r.device_name}</Td>
                {numCell(r, "d_stock_received", updateRow)}
                {numCell(r, "b_stock_received", updateRow)}
                {numCell(r, "new_stock_sent", updateRow)}
                {numCell(r, "rma_bstock_rstock_sent", updateRow)}
                {numCell(r, "a_stock_received", updateRow)}
                {numCell(r, "awaiting_delivery_from_user", updateRow)}
                {numCell(r, "receive_only", updateRow)}
                {numCell(r, "awaiting_return_from_rush", updateRow)}
                <Td>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={r.notes || ""}
                    onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                  />
                </Td>
                <Td>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={async () => {
                      if (!confirm("Delete row?")) return;
                      const res = await fetch(apiUrl(`/rma/us/stock/${r.id}`), { method: "DELETE", credentials: "include" });
                      if (res.ok) setRows((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                  >
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function numCell(r, key, updater) {
  return (
    <Td>
      <input
        type="number"
        className="border rounded px-2 py-1 w-24"
        value={r[key] ?? 0}
        onChange={(e) => updater(r.id, { [key]: Number(e.target.value || 0) })}
      />
    </Td>
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

const Th = ({ children }) => <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-3 py-2 ${className}`}>{children}</td>;

function Quick({ label, value, onChange, number = false }) {
  return (
    <label className="block">
      <div className="text-xs font-medium mb-1">{label}</div>
      <input
        type={number ? "number" : "text"}
        className="border rounded px-3 py-2 w-44"
        value={value}
        onChange={(e) => onChange(number ? Number(e.target.value || 0) : e.target.value)}
      />
    </label>
  );
}

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function PageShell({ children }) {
  return <div className="space-y-4">{children}</div>;
}
