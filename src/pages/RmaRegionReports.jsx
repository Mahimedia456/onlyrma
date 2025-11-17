// src/pages/RmaRegionReports.jsx

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiUrl } from "@/lib/apiBase";

/**
 * Shared column definition – matches the Excel layout
 */
const COLUMNS = [
  { key: "product", label: "Product" },
  { key: "description", label: "Description" },
  { key: "rush_sent_out", label: "Rush sent out" },
  { key: "actual_rma_cases", label: "Actual RMA Cases" },
  { key: "d_stock_units_received", label: "D Stock units received" },

  // Receive Only (D/B/A stock)
  { key: "d_stock", label: "D - Stock" },
  { key: "b_stock", label: "B - Stock" },
  { key: "a_stock", label: "A - Stock" },

  { key: "pending_to_ship", label: "Pending to ship" },
  { key: "pending_to_receive", label: "Pending to receive" },
  {
    key: "google_drive_rma_case_total",
    label: "Google Drive RMA Case Total",
  },
  { key: "comments", label: "Comments" },
];

const NUMERIC_KEYS = [
  "rush_sent_out",
  "actual_rma_cases",
  "d_stock_units_received",
  "d_stock",
  "b_stock",
  "a_stock",
  "pending_to_ship",
  "pending_to_receive",
  "google_drive_rma_case_total",
];

export default function RmaRegionReports() {
  const [tab, setTab] = useState("emea"); // "emea" | "us"
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const [loading, setLoading] = useState(false);
  const [emeaRows, setEmeaRows] = useState([]);
  const [usRows, setUsRows] = useState([]);

  const reportRef = useRef(null);

  // Load when tab or month changes
  useEffect(() => {
    if (tab === "emea" && emeaRows.length === 0) {
      loadRegion("emea", month);
    }
    if (tab === "us" && usRows.length === 0) {
      loadRegion("us", month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    // Whenever month changes, reload the current tab
    loadRegion(tab, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function loadRegion(region, monthValue) {
    if (!monthValue) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ month: monthValue });
      const res = await fetch(
        apiUrl(`/rma/${region}/stock?${qs.toString()}`),
        { credentials: "include" }
      );
      const data = await safeJson(res);
      const items = Array.isArray(data?.items) ? data.items : [];

      // Map stock rows -> report rows (per device)
      const mapped = items.map((item) =>
        mapStockItemToReportRow(region, item)
      );

      if (region === "emea") setEmeaRows(mapped);
      if (region === "us") setUsRows(mapped);

      if (!res.ok) {
        console.error(`${region.toUpperCase()} stock fetch failed`, data);
      }
    } catch (err) {
      console.error("RMA region report error", err);
      if (region === "emea") setEmeaRows([]);
      if (region === "us") setUsRows([]);
    } finally {
      setLoading(false);
    }
  }

  const rows = tab === "emea" ? emeaRows : usRows;
  const title =
    tab === "emea"
      ? `EMEA RMA Report — ${month}`
      : `US RMA Report — ${month}`;

  const totals = computeTotals(rows);

  /* PDF export (current tab) */
  async function downloadPDF() {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const pdf = new jsPDF("l", "mm", "a4"); // landscape like Excel
    const imgData = canvas.toDataURL("image/png");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save(`${tab.toUpperCase()}_rma_report_${month}.pdf`);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Tabs like your other pages */}
      <div className="inline-flex rounded-xl border overflow-hidden bg-white">
        <TabButton active={tab === "emea"} onClick={() => setTab("emea")}>
          EMEA RMA Report
        </TabButton>
        <TabButton active={tab === "us"} onClick={() => setTab("us")}>
          US RMA Report
        </TabButton>
      </div>

      {/* Top bar: month + actions */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-xs font-medium mb-1">Month</div>
            <input
              type="month"
              className="border rounded px-3 py-2"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs font-medium mb-1 invisible">Refresh</div>
            <button
              onClick={() => loadRegion(tab, month)}
              className="px-3 py-2 border rounded text-xs hover:bg-gray-50"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={downloadPDF}
            className="px-4 py-2 rounded bg-black text-white text-sm hover:bg-gray-800"
            disabled={loading || rows.length === 0}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Main table + legend wrapped for PDF capture */}
      <div ref={reportRef} className="space-y-4">
        <div className="border rounded-xl bg-white overflow-auto">
          <table className="min-w-[1200px] w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left font-semibold text-gray-700 border-b"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-3 py-4 text-center"
                  >
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-3 py-4 text-center"
                  >
                    No data
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id || `${row.product}-${idx}`}
                    className="border-t hover:bg-gray-50"
                  >
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-1.5 align-top whitespace-nowrap"
                      >
                        {renderCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {/* Totals row (for numeric columns) */}
              {rows.length > 0 && (
                <tr className="border-t bg-gray-100 font-semibold">
                  {COLUMNS.map((col, i) => (
                    <td key={col.key} className="px-3 py-1.5">
                      {i === 0 && "Totals"}
                      {i > 0 && NUMERIC_KEYS.includes(col.key)
                        ? totals[col.key] ?? ""
                        : ""}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Explanatory legend (bottom like in Excel) */}
        <div className="grid sm:grid-cols-2 gap-3 text-[11px] text-gray-700">
          <LegendItem
            label="Rush sent Out"
            text="Units dispatched via Rush shipments."
          />
          <LegendItem
            label="Actual RMA Cases"
            text="Units that were received as RMA and replacement units have been sent out."
          />
          <LegendItem
            label="Receive Only D-Stock/B/A"
            text="Units received for D/B/A stock with no further action required."
          />
          <LegendItem
            label="Pending to Ship"
            text="Units that Rush still needs to dispatch (open replacements)."
          />
          <LegendItem
            label="Pending to Receive"
            text="Units that still need to be sent by the customer or reseller."
          />
          <LegendItem
            label="Google Drive RMA Case Total"
            text="Total RMA requests recorded in the Google Sheet (manually maintained)."
          />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Mapping logic ───────────────── */

/**
 * Map one stock row from EMEA/US stock endpoints into
 * the generic report row shape used by the table.
 *
 * This is where we “connect” RmaRegionReports to RmaStockEmea/RmaStockUs.
 */
function mapStockItemToReportRow(region, item) {
  const isUS = region === "us";

  // Common fields based on your stock pages
  // EMEA fields:
  //   device_name, d_stock_received, b_stock_received,
  //   new_stock_sent, rma_bstock_rstock_sent,
  //   awaiting_delivery_from_user, receiving_only,
  //   awaiting_return_from_rush, notes
  //
  // US extra fields:
  //   a_stock_received, receive_only
  return {
    id: item.id,
    product: item.device_name || "",
    description: "", // you can hook description here if you later add it
    rush_sent_out: toNum(item.new_stock_sent),
    actual_rma_cases: toNum(item.rma_bstock_rstock_sent),
    d_stock_units_received: toNum(item.d_stock_received),

    // Think of D/B/A stock here as “on hand” buckets.
    d_stock: toNum(item.d_stock_received),
    b_stock: toNum(item.b_stock_received),
    a_stock: isUS ? toNum(item.a_stock_received) : 0,

    // Pending to ship = waiting on Rush to send (awaiting_return_from_rush)
    pending_to_ship: toNum(item.awaiting_return_from_rush),

    // Pending to receive = waiting on customer (awaiting_delivery_from_user)
    pending_to_receive: toNum(
      item.awaiting_delivery_from_user || item.receive_only
    ),

    // Google drive cases are not in DB yet – keep 0 for now
    google_drive_rma_case_total: 0,

    comments: item.notes || "",
  };
}

function toNum(v) {
  const n = Number(v ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

/* ───────────────── UI helpers ───────────────── */

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm ${
        active
          ? "bg-black text-white"
          : "bg-white text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function LegendItem({ label, text }) {
  return (
    <div className="border rounded-lg p-2 bg-white">
      <div className="font-semibold">{label}</div>
      <div className="text-gray-600">{text}</div>
    </div>
  );
}

function renderCell(row, key) {
  const val = row[key];

  if (val == null || val === "") return "";

  if (NUMERIC_KEYS.includes(key)) {
    const num = Number(val);
    if (!Number.isNaN(num)) return num.toString();
  }

  return String(val);
}

function computeTotals(rows) {
  const totals = {};
  for (const key of NUMERIC_KEYS) totals[key] = 0;

  rows.forEach((row) => {
    NUMERIC_KEYS.forEach((k) => {
      const v = Number(row[k] ?? 0);
      if (!Number.isNaN(v)) totals[k] += v;
    });
  });

  return totals;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
