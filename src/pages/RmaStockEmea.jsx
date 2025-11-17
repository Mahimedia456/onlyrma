// src/pages/RmaStockEmea.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/** Split composite device names like "Ninja Ultra & Atomos Connect" -> ["Ninja Ultra","Atomos Connect"] */
function splitDevices(name) {
  if (!name) return [];
  return String(name)
    .split(/[,/&]| and /i) // ',', '/', '&', ' and '
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lightweight session reader */
function useSessionRoleInline() {
  const [state, setState] = useState({
    ready: false,
    role: "viewer",
    user: null,
    error: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(apiUrl("/session"), {
          credentials: "include",
        });
        const d = await (async () => {
          try {
            return await r.json();
          } catch {
            return null;
          }
        })();
        if (!alive) return;
        if (!r.ok) {
          setState({
            ready: true,
            role: "viewer",
            user: null,
            error: d?.error || `HTTP ${r.status}`,
          });
        } else {
          setState({
            ready: true,
            role: d?.role || "viewer",
            user: d?.user || null,
            error: "",
          });
        }
      } catch (e) {
        if (!alive) return;
        setState({
          ready: true,
          role: "viewer",
          user: null,
          error: e?.message || "No session",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

// CSV header mapping for EMEA import
const HUMAN_TO_CANON_EMEA = {
  "Device Name": "device_name",
  "D Stock - Received": "d_stock_received",
  "B-stock Received": "b_stock_received",
  "New Stock Sent": "new_stock_sent",
  "RMA/ B-Stock R-Stock Sent": "rma_bstock_rstock_sent",
  "Awaiting Delivery from User": "awaiting_delivery_from_user",
  "Receiving Only": "receiving_only",
  "Awaiting Return from Rush": "awaiting_return_from_rush",
};

export default function RmaStockEmea() {
  const { ready, role, error } = useSessionRoleInline();

  const API = import.meta.env.VITE_API_BASE || "";
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank());

  // import state
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef(null);

  // pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Selected rows for mass delete
  const [selected, setSelected] = useState(new Set());

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(pageRows.map((r) => r.id)));
  }

  function unselectAll() {
    setSelected(new Set());
  }

  function blank() {
    return {
      d_stock_received: 0,
      b_stock_received: 0,
      new_stock_sent: 0,
      rma_bstock_rstock_sent: 0,
      awaiting_delivery_from_user: 0,
      receiving_only: 0,
      awaiting_return_from_rush: 0,
      notes: "",
    };
  }

  // 1) Base device list from existing stock API (server-known devices + built-ins)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl(`/rma/emea/devices`), {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("devices fetch failed", data);
          setDevices([]);
          return;
        }
        setDevices(data?.devices || []);
      } catch (e) {
        console.error("devices fetch failed", e);
        setDevices([]);
      }
    })();
  }, [API]);

  // 2) Add devices referenced in RMA entries for selected month
  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams({ month });
        const res = await fetch(
          apiUrl(`/rma/entries?${qs.toString()}`),
          { credentials: "include" }
        );
        const data = await safeJson(res);
        if (!res.ok || !data?.entries) return;

        const fromEntries = new Set();
        for (const e of data.entries) {
          for (const n of splitDevices(e.device_name))
            fromEntries.add(n);
        }

        setDevices((prev) =>
          Array.from(
            new Set([...(prev || []), ...fromEntries])
          ).sort()
        );
      } catch {
        // ignore
      }
    })();
  }, [API, month]);

  // Fetch EMEA stock
  useEffect(() => {
    (async () => {
      if (!month) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          month,
          ...(device ? { device_name: device } : {}),
        });
        const res = await fetch(
          apiUrl(`/rma/emea/stock?${qs.toString()}`),
          { credentials: "include" }
        );
        const data = await res.json();
        setRows(res.ok ? data?.items || [] : []);
        if (!res.ok) console.error("emea stock fetch failed", data);
      } catch (e) {
        console.error("emea stock fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, month, device]);

  // Search filtering
  const filteredRows = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.device_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, search]);

  // Totals
  const totals = useMemo(() => {
    const sum = (k) =>
      filteredRows.reduce(
        (s, r) => s + (Number(r[k]) || 0),
        0
      );
    return {
      d_stock_received: sum("d_stock_received"),
      b_stock_received: sum("b_stock_received"),
      new_stock_sent: sum("new_stock_sent"),
      rma_bstock_rstock_sent: sum("rma_bstock_rstock_sent"),
      awaiting_delivery_from_user: sum("awaiting_delivery_from_user"),
      receiving_only: sum("receiving_only"),
      awaiting_return_from_rush: sum("awaiting_return_from_rush"),
    };
  }, [filteredRows]);

  // Pagination derived
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, month, device, pageSize]);
  async function saveNew() {
    if (!device) return alert("Select a device");
    const payload = {
      month,
      device_name: device,
      ...numberize(form),
    };
    const res = await fetch(apiUrl(`/rma/emea/stock`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await safeJson(res);
      console.error("EMEA save failed", d);
      return alert("Save failed");
    }

    // re-fetch with current filters (month + device)
    const qs = new URLSearchParams({
      month,
      ...(device ? { device_name: device } : {}),
    });
    const r = await fetch(
      apiUrl(`/rma/emea/stock?${qs.toString()}`),
      { credentials: "include" }
    );
    const d = await r.json();
    setRows(d?.items || []);
    setForm(blank());
  }

  function numberize(obj) {
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

  async function updateRow(id, patch) {
    const res = await fetch(
      apiUrl(`/rma/emea/stock/${id}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(numberize(patch)),
      }
    );
    if (!res.ok) {
      const d = await safeJson(res);
      console.error("EMEA update failed", d);
      return alert("Update failed");
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      )
    );
  }

  // MASS DELETE SELECTED ROWS
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} row(s)?`)) return;

    let ok = 0;
    for (const id of selected) {
      const res = await fetch(
        apiUrl(`/rma/emea/stock/${id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (res.ok) ok++;
    }

    setRows((prev) =>
      prev.filter((r) => !selected.has(r.id))
    );
    setSelected(new Set());
    alert(`Deleted ${ok} row(s).`);
  }

  // CSV EXPORT (ALREADY FILTERED)
  function exportCSV() {
    if (!filteredRows.length)
      return alert(
        "No rows to export for current filters."
      );
    const cols = [
      "id",
      "month",
      "device_name",
      "d_stock_received",
      "b_stock_received",
      "new_stock_sent",
      "rma_bstock_rstock_sent",
      "awaiting_delivery_from_user",
      "receiving_only",
      "awaiting_return_from_rush",
      "notes",
      "created_at",
      "updated_at",
    ];
    const header = cols.join(",");
    const lines = filteredRows.map((r) =>
      cols.map((c) => csvEscape(r[c])).join(",")
    );
    const csv =
      "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const name = `RMA_EMEA_Stock_${
      month || "all"
    }.csv`;
    const a = Object.assign(
      document.createElement("a"),
      {
        href: URL.createObjectURL(blob),
        download: name,
      }
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // ---- IMPORT HANDLERS (EMEA) ----
  function openImport() {
    setImportMsg("");
    fileRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!file) return;

    try {
      if (!month)
        return alert(
          "Select a month before importing."
        );
      setImporting(true);
      setImportMsg("Reading CSV…");
      const text = await file.text();
      const { headers, records } = parseCsv(text);
      if (!headers.length || !records.length) {
        setImportMsg("No data found in CSV.");
        setImporting(false);
        return;
      }

      // Build items from CSV
      const items = records
        .map((row) => {
          const device_name = String(
            row["Device Name"] || ""
          ).trim();
          if (!device_name) return null;

          const obj = {
            month,
            device_name,
            notes: "",
          };

          for (const [
            human,
            canon,
          ] of Object.entries(HUMAN_TO_CANON_EMEA)) {
            if (human === "Device Name") continue;
            obj[canon] = row[human] ?? "";
          }
          return numberize(obj);
        })
        .filter(Boolean);

      if (!items.length) {
        setImportMsg(
          "No valid rows (Device Name missing)."
        );
        setImporting(false);
        return;
      }

      setImportMsg(
        `Uploading ${items.length} row(s)…`
      );

      let ok = 0;
      let failed = 0;
      for (const item of items) {
        const res = await fetch(
          apiUrl(`/rma/emea/stock`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(item),
          }
        );
        if (res.ok) ok++;
        else failed++;
      }

      setImportMsg(
        `Import finished: ${ok} success, ${failed} failed.`
      );

      // re-fetch current month/device
      const qs = new URLSearchParams({
        month,
        ...(device ? { device_name: device } : {}),
      });
      const r = await fetch(
        apiUrl(`/rma/emea/stock?${qs.toString()}`),
        { credentials: "include" }
      );
      const d = await r.json();
      setRows(d?.items || []);
    } catch (err) {
      console.error(err);
      setImportMsg(
        `Import error: ${err.message || err}`
      );
    } finally {
      setImporting(false);
    }
  }

  // -------- Render gates --------
  if (!ready)
    return (
      <PageShell>
        <div className="p-6">Loading session…</div>
      </PageShell>
    );
  if (error)
    return (
      <PageShell>
        <div className="p-6 text-red-600">
          Session error: {error}
        </div>
      </PageShell>
    );
  if (role !== "admin") {
    return (
      <PageShell>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2">
            Forbidden
          </h2>
          <p className="text-gray-600">
            This page is available to admin users
            only.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Filters / New row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium mb-1">
            Month
          </label>
          <input
            type="month"
            className="border rounded px-3 py-2 w-full"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium mb-1">
            Device
          </label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">All devices…</option>
            {devices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-medium mb-1">
            Search (Device Name)
          </label>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Search device name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Quick Inputs */}
        <Quick
          number
          label="D Stock - Received"
          value={form.d_stock_received}
          onChange={(v) =>
            setForm((f) => ({ ...f, d_stock_received: v }))
          }
        />
        <Quick
          number
          label="B-stock Received"
          value={form.b_stock_received}
          onChange={(v) =>
            setForm((f) => ({ ...f, b_stock_received: v }))
          }
        />
        <Quick
          number
          label="New Stock Sent"
          value={form.new_stock_sent}
          onChange={(v) =>
            setForm((f) => ({ ...f, new_stock_sent: v }))
          }
        />
        <Quick
          number
          label="RMA/ B-Stock R-Stock Sent"
          value={form.rma_bstock_rstock_sent}
          onChange={(v) =>
            setForm((f) => ({ ...f, rma_bstock_rstock_sent: v }))
          }
        />
        <Quick
          number
          label="Awaiting Delivery from User"
          value={form.awaiting_delivery_from_user}
          onChange={(v) =>
            setForm((f) => ({ ...f, awaiting_delivery_from_user: v }))
          }
        />
        <Quick
          number
          label="Receiving Only"
          value={form.receiving_only}
          onChange={(v) =>
            setForm((f) => ({ ...f, receiving_only: v }))
          }
        />
        <Quick
          number
          label="Awaiting Return from Rush"
          value={form.awaiting_return_from_rush}
          onChange={(v) =>
            setForm((f) => ({ ...f, awaiting_return_from_rush: v }))
          }
        />

        <div className="w-full md:flex-1">
          <label className="block text-xs font-medium mb-1">
            Notes
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </div>

        {/* ACTION BUTTONS */}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="rounded border px-4 py-2 hover:bg-gray-50"
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
            onChange={handleImportFile}
          />

          {/* DELETE SELECTED */}
          <button
            onClick={deleteSelected}
            className="rounded border border-red-600 text-red-600 px-4 py-2 hover:bg-red-50"
            disabled={selected.size === 0}
          >
            Delete Selected ({selected.size})
          </button>

          <button
            onClick={saveNew}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
          >
            Save
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="text-xs text-gray-600">{importMsg}</div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="D Stock - Recvd" value={totals.d_stock_received} />
        <KPI label="B-stock Recvd" value={totals.b_stock_received} />
        <KPI label="New Stock Sent" value={totals.new_stock_sent} />
        <KPI
          label="RMA/B-Stock Sent"
          value={totals.rma_bstock_rstock_sent}
        />
        <KPI
          label="Awaiting User"
          value={totals.awaiting_delivery_from_user}
        />
        <KPI label="Receiving Only" value={totals.receiving_only} />
        <KPI
          label="Awaiting Rush"
          value={totals.awaiting_return_from_rush}
        />
      </div>

      {/* MAIN TABLE */}
      <div className="border rounded overflow-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>
                <input
                  type="checkbox"
                  checked={
                    pageRows.length > 0 &&
                    pageRows.every((r) => selected.has(r.id))
                  }
                  onChange={(e) =>
                    e.target.checked
                      ? selectAllVisible()
                      : unselectAll()
                  }
                />
              </Th>
              <Th>Device Name</Th>
              <Th>D Stock - Received</Th>
              <Th>B-stock Received</Th>
              <Th>New Stock Sent</Th>
              <Th>RMA/ B-Stock R-Stock Sent</Th>
              <Th>Awaiting Delivery from User</Th>
              <Th>Receiving Only</Th>
              <Th>Awaiting Return from Rush</Th>
              <Th>Notes</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="p-6 text-center">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center">
                  No rows
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </Td>

                  <Td className="font-medium">{r.device_name}</Td>

                  {numCell(r, "d_stock_received", updateRow)}
                  {numCell(r, "b_stock_received", updateRow)}
                  {numCell(r, "new_stock_sent", updateRow)}
                  {numCell(r, "rma_bstock_rstock_sent", updateRow)}
                  {numCell(r, "awaiting_delivery_from_user", updateRow)}
                  {numCell(r, "receiving_only", updateRow)}
                  {numCell(r, "awaiting_return_from_rush", updateRow)}

                  <Td>
                    <input
                      className="border rounded px-2 py-1 w-48"
                      value={r.notes || ""}
                      onChange={(e) =>
                        updateRow(r.id, { notes: e.target.value })
                      }
                    />
                  </Td>

                  <Td>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm("Delete row?")) return;
                        const res = await fetch(
                          apiUrl(`/rma/emea/stock/${r.id}`),
                          {
                            method: "DELETE",
                            credentials: "include",
                          }
                        );
                        if (res.ok)
                          setRows((prev) =>
                            prev.filter((x) => x.id !== r.id)
                          );
                      }}
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
      <div className="flex flex-wrap justify-between items-center text-xs text-gray-600 gap-3 mt-4">
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
                setPageSize(Number(e.target.value) || 25)
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
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>

            <span>
              Page {safePage} of {totalPages}
            </span>

            <button
              className="px-2 py-1 border rounded"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
// ----------------- CELLS -----------------
function numCell(r, key, updater) {
  return (
    <Td>
      <input
        type="number"
        className="border rounded px-2 py-1 w-24"
        value={r[key] ?? 0}
        onChange={(e) =>
          updater(r.id, {
            [key]: Number(e.target.value || 0),
          })
        }
      />
    </Td>
  );
}

// ----------------- KPI BOX -----------------
function KPI({ label, value }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// ----------------- TABLE HEADER/TD -----------------
const Th = ({ children }) => (
  <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
    {children}
  </th>
);

const Td = ({ children, className = "" }) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className}`}>
    {children}
  </td>
);

// ----------------- QUICK INPUT COMPONENT -----------------
function Quick({ label, value, onChange, number = false }) {
  return (
    <label className="block w-40">
      <div className="text-xs font-medium mb-1">{label}</div>
      <input
        type={number ? "number" : "text"}
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={(e) =>
          onChange(number ? Number(e.target.value || 0) : e.target.value)
        }
      />
    </label>
  );
}

// ----------------- CSV ESCAPE -----------------
function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ----------------- SAFE JSON -----------------
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ----------------- CSV PARSER -----------------
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
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) =>
      Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
    );
  return { headers, records };
}

// ----------------- PAGE WRAPPER -----------------
function PageShell({ children }) {
  return <div className="space-y-4">{children}</div>;
}
