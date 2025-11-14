// src/pages/RmaReports.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiUrl } from "@/lib/apiBase";

/* Same categories as RmaEntry */
const CATEGORIES = ["product-fault", "warranty", "out-of-warranty", "other"];
const ORGS = ["US", "EMEA"];
const RMA_TYPES = ["Warranty", "Out of Warranty", "Advance Replacement"];

export default function RmaReports() {
  const [loading, setLoading] = useState(true);

  // RMA filters
  const [year, setYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [org, setOrg] = useState(""); // All / US / EMEA

  // Stock filter (month-based)
  const [stockMonth, setStockMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  // Live datasets
  const [entries, setEntries] = useState([]);
  const [usStock, setUsStock] = useState([]);
  const [emeaStock, setEmeaStock] = useState([]);

  const reportRef = useRef(null);

  /* ───────────────────────────────────────────────
      LOAD RMA ENTRIES (LIVE)
  ─────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/rma/entries"), {
          credentials: "include",
        });
        const data = await safeJson(res);
        setEntries(data?.entries || []);
      } catch (e) {
        console.error("RMA entries fetch failed", e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ───────────────────────────────────────────────
      LOAD STOCK (US + EMEA) FOR SELECTED MONTH
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!stockMonth) return;

    (async () => {
      try {
        // US
        const resUs = await fetch(
          apiUrl(`/rma/us/stock?month=${encodeURIComponent(stockMonth)}`),
          { credentials: "include" }
        );
        const dataUs = await safeJson(resUs);
        setUsStock(resUs.ok ? dataUs?.items || [] : []);

        // EMEA
        const resEmea = await fetch(
          apiUrl(`/rma/emea/stock?month=${encodeURIComponent(stockMonth)}`),
          { credentials: "include" }
        );
        const dataEmea = await safeJson(resEmea);
        setEmeaStock(resEmea.ok ? dataEmea?.items || [] : []);
      } catch (e) {
        console.error("RMA stock fetch failed", e);
        setUsStock([]);
        setEmeaStock([]);
      }
    })();
  }, [stockMonth]);

  /* ───────────────────────────────────────────────
      YEAR OPTIONS from entry_date
  ─────────────────────────────────────────────── */
  const yearOptions = useMemo(() => {
    const setY = new Set();
    entries.forEach((x) => setY.add(getYear(x.entry_date)));
    return Array.from(setY)
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [entries]);

  /* ───────────────────────────────────────────────
      APPLY FILTERS TO RMA ENTRIES
  ─────────────────────────────────────────────── */
  function applyFilters(data) {
    return data.filter((row) => {
      const d = normalizeDate(row.entry_date);
      if (!d) return false;

      const y = getYear(d);
      const m = getMonth(d);

      if (year && y !== Number(year)) return false;
      if (fromMonth && m < Number(fromMonth)) return false;
      if (toMonth && m > Number(toMonth)) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (org && row.organization && row.organization !== org) return false;

      return true;
    });
  }

  const filteredEntries = applyFilters(entries);

  /* ───────────────────────────────────────────────
      MONTHLY AGGREGATED RMA DATA
  ─────────────────────────────────────────────── */
  const monthlyRma = useMemo(() => {
    const bucket = {};

    filteredEntries.forEach((e) => {
      const y = getYear(e.entry_date);
      const m = getMonth(e.entry_date);
      if (!y || !m) return;
      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = {
          year: y,
          month: m,
          rma_count: 0,
          qty_total: 0,
          warranty: 0,
          out_of_warranty: 0,
          advance_replacement: 0,
          us: 0,
          emea: 0,
        };
      }

      const qty = Number(e.quantity || 0);

      bucket[key].rma_count += 1;
      bucket[key].qty_total += qty;

      const rt = (e.rma_type || "").toLowerCase();
      if (rt === "warranty") bucket[key].warranty += 1;
      else if (rt === "out of warranty") bucket[key].out_of_warranty += 1;
      else if (rt === "advance replacement")
        bucket[key].advance_replacement += 1;

      const org = (e.organization || "").toUpperCase();
      if (org === "US") bucket[key].us += 1;
      if (org === "EMEA") bucket[key].emea += 1;
    });

    return Object.values(bucket).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [filteredEntries]);

  /* ───────────────────────────────────────────────
      KPI CALCULATIONS
  ─────────────────────────────────────────────── */
  const rmaKpi = useMemo(() => {
    const totalRmas = filteredEntries.length;
    const totalQty = filteredEntries.reduce(
      (sum, e) => sum + Number(e.quantity || 0),
      0
    );

    const warranty = filteredEntries.filter(
      (e) => (e.rma_type || "").toLowerCase() === "warranty"
    ).length;
    const outOfWarranty = filteredEntries.filter(
      (e) => (e.rma_type || "").toLowerCase() === "out of warranty"
    ).length;
    const advanceReplacement = filteredEntries.filter(
      (e) => (e.rma_type || "").toLowerCase() === "advance replacement"
    ).length;

    const us = filteredEntries.filter(
      (e) => (e.organization || "").toUpperCase() === "US"
    ).length;
    const emea = filteredEntries.filter(
      (e) => (e.organization || "").toUpperCase() === "EMEA"
    ).length;

    const uniqueDevices = new Set(
      filteredEntries
        .map((e) => (e.device_name || "").trim())
        .filter(Boolean)
    ).size;

    const monthsCount = monthlyRma.length || 1;
    const avgRmaPerMonth =
      monthsCount > 0 ? (totalRmas / monthsCount).toFixed(1) : 0;

    return {
      totalRmas,
      totalQty,
      warranty,
      outOfWarranty,
      advanceReplacement,
      us,
      emea,
      uniqueDevices,
      avgRmaPerMonth,
    };
  }, [filteredEntries, monthlyRma]);

  /* ───────────────────────────────────────────────
      STOCK KPI (US + EMEA FOR SELECTED MONTH)
  ─────────────────────────────────────────────── */
  const stockKpi = useMemo(() => {
    function sum(arr, key) {
      return arr.reduce((s, r) => s + Number(r[key] || 0), 0);
    }

    const usTotals = {
      d_stock_received: sum(usStock, "d_stock_received"),
      b_stock_received: sum(usStock, "b_stock_received"),
      new_stock_sent: sum(usStock, "new_stock_sent"),
      rma_bstock_rstock_sent: sum(usStock, "rma_bstock_rstock_sent"),
      a_stock_received: sum(usStock, "a_stock_received"),
      awaiting_delivery_from_user: sum(usStock, "awaiting_delivery_from_user"),
      receive_only: sum(usStock, "receive_only"),
      awaiting_return_from_rush: sum(usStock, "awaiting_return_from_rush"),
    };

    const emeaTotals = {
      d_stock_received: sum(emeaStock, "d_stock_received"),
      b_stock_received: sum(emeaStock, "b_stock_received"),
      new_stock_sent: sum(emeaStock, "new_stock_sent"),
      rma_bstock_rstock_sent: sum(emeaStock, "rma_bstock_rstock_sent"),
      awaiting_delivery_from_user: sum(emeaStock, "awaiting_delivery_from_user"),
      receiving_only: sum(emeaStock, "receiving_only"),
      awaiting_return_from_rush: sum(emeaStock, "awaiting_return_from_rush"),
    };

    return { usTotals, emeaTotals };
  }, [usStock, emeaStock]);

  /* ───────────────────────────────────────────────
      CHARTS (RMA)
  ─────────────────────────────────────────────── */
  const monthCategories = monthlyRma.map(
    (x) => `${x.year}-${pad(x.month)}`
  );

  const monthlyRmaChart = {
    series: [
      { name: "RMA Count", data: monthlyRma.map((x) => x.rma_count) },
    ],
    options: {
      chart: { toolbar: { show: false } },
      xaxis: { categories: monthCategories },
    },
  };

  const monthlyQtyChart = {
    series: [
      { name: "Quantity", data: monthlyRma.map((x) => x.qty_total) },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: { categories: monthCategories },
    },
  };

  // RMAs by Category
  const catMap = {};
  filteredEntries.forEach((e) => {
    const c = e.category || "Uncategorized";
    catMap[c] = (catMap[c] || 0) + 1;
  });
  const rmaByCategoryChart = {
    series: Object.values(catMap),
    options: {
      labels: Object.keys(catMap),
      chart: { type: "pie" },
    },
  };

  // RMAs by RMA Type
  const typeMap = {};
  filteredEntries.forEach((e) => {
    const t = e.rma_type || "Unknown";
    typeMap[t] = (typeMap[t] || 0) + 1;
  });
  const rmaByTypeChart = {
    series: Object.values(typeMap),
    options: {
      labels: Object.keys(typeMap),
      chart: { type: "donut" },
    },
  };

  // RMAs by Organization
  const orgMap = { US: 0, EMEA: 0, Other: 0 };
  filteredEntries.forEach((e) => {
    const o = (e.organization || "").toUpperCase();
    if (o === "US") orgMap.US += 1;
    else if (o === "EMEA") orgMap.EMEA += 1;
    else orgMap.Other += 1;
  });
  const rmaByOrgChart = {
    series: [orgMap.US, orgMap.EMEA, orgMap.Other],
    options: {
      labels: ["US", "EMEA", "Other"],
      chart: { type: "pie" },
    },
  };

  // Top Devices
  const deviceMap = {};
  filteredEntries.forEach((e) => {
    const d = e.device_name || "Unknown Device";
    deviceMap[d] = (deviceMap[d] || 0) + 1;
  });
  const topDevices = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topDevicesChart = {
    series: [{ name: "RMA Count", data: topDevices.map(([_, v]) => v) }],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: { categories: topDevices.map(([k]) => k) },
    },
  };

  /* ───────────────────────────────────────────────
      STOCK SUMMARY CHART (US vs EMEA)
  ─────────────────────────────────────────────── */
  const stockCategories = [
    "D Stock Received",
    "B-Stock Received",
    "New Stock Sent",
    "RMA/B-Stock Sent",
    "Awaiting Delivery",
    "Receive / Receiving Only",
    "Awaiting Rush",
  ];

  const stockSummaryChart = {
    series: [
      {
        name: "US",
        data: [
          stockKpi.usTotals.d_stock_received,
          stockKpi.usTotals.b_stock_received,
          stockKpi.usTotals.new_stock_sent,
          stockKpi.usTotals.rma_bstock_rstock_sent,
          stockKpi.usTotals.awaiting_delivery_from_user,
          stockKpi.usTotals.receive_only,
          stockKpi.usTotals.awaiting_return_from_rush,
        ],
      },
      {
        name: "EMEA",
        data: [
          stockKpi.emeaTotals.d_stock_received,
          stockKpi.emeaTotals.b_stock_received,
          stockKpi.emeaTotals.new_stock_sent,
          stockKpi.emeaTotals.rma_bstock_rstock_sent,
          stockKpi.emeaTotals.awaiting_delivery_from_user,
          stockKpi.emeaTotals.receiving_only,
          stockKpi.emeaTotals.awaiting_return_from_rush,
        ],
      },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false }, stacked: false },
      xaxis: { categories: stockCategories },
    },
  };

  /* ───────────────────────────────────────────────
      PDF EXPORT
  ─────────────────────────────────────────────── */
  async function downloadPDF() {
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const pdf = new jsPDF("p", "mm", "a4");
    const img = canvas.toDataURL("image/png");

    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 0, 0, width, height);
    pdf.save("rma_report_dashboard.pdf");
  }

  /* Month names */
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

  function clearFilters() {
    setYear("");
    setFromMonth("");
    setToMonth("");
    setFromDate("");
    setToDate("");
    setOrg("");
  }

  if (loading && !entries.length)
    return <div className="p-6 text-center">Loading...</div>;

  /* ───────────────────────────────────────────────
      UI STARTS
  ─────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-6" ref={reportRef}>
      {/* FILTER PANEL */}
      <div className="border p-4 rounded-xl bg-white grid grid-cols-1 md:grid-cols-6 gap-4">
        <Select
          label="Year"
          value={year}
          setter={setYear}
          options={yearOptions.map((y) => [y, y])}
        />

        <Select
          label="From Month"
          value={fromMonth}
          setter={setFromMonth}
          options={months}
        />

        <Select
          label="To Month"
          value={toMonth}
          setter={setToMonth}
          options={months}
        />

        <InputDate label="From Date (dd/mm/yyyy)" value={fromDate} setter={setFromDate} />

        <InputDate label="To Date (dd/mm/yyyy)" value={toDate} setter={setToDate} />

        <Select
          label="Organization"
          value={org}
          setter={setOrg}
          options={[["US", "US"], ["EMEA", "EMEA"]]}
        />

        {/* Stock Month + Buttons (full width on md) */}
        <div className="md:col-span-3 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs mb-1">Stock Month (US / EMEA)</div>
            <input
              type="month"
              className="border rounded px-3 py-2"
              value={stockMonth}
              onChange={(e) => setStockMonth(e.target.value)}
            />
          </div>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs px-3 py-2 border rounded hover:bg-gray-50"
            >
              Clear Filters
            </button>
            <button
              onClick={downloadPDF}
              className="bg-black text-white text-xs px-4 py-2 rounded"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* KPI GRID (RMA) */}
      <KPIGrid
        kpi={[
          ["Total RMAs", rmaKpi.totalRmas],
          ["Total Quantity", rmaKpi.totalQty],
          ["Warranty", rmaKpi.warranty],
          ["Out of Warranty", rmaKpi.outOfWarranty],
          ["Advance Replacement", rmaKpi.advanceReplacement],
          ["US RMAs", rmaKpi.us],
          ["EMEA RMAs", rmaKpi.emea],
          ["Unique Devices", rmaKpi.uniqueDevices],
          ["Avg RMAs / Month", rmaKpi.avgRmaPerMonth],
        ]}
      />

      {/* KPI GRID (STOCK) */}
      <KPIGrid
        title={`Stock (${stockMonth}) – US / EMEA`}
        kpi={[
          [
            "D Stock Received",
            `${stockKpi.usTotals.d_stock_received} / ${stockKpi.emeaTotals.d_stock_received}`,
          ],
          [
            "B-Stock Received",
            `${stockKpi.usTotals.b_stock_received} / ${stockKpi.emeaTotals.b_stock_received}`,
          ],
          [
            "New Stock Sent",
            `${stockKpi.usTotals.new_stock_sent} / ${stockKpi.emeaTotals.new_stock_sent}`,
          ],
          [
            "RMA/B-Stock Sent",
            `${stockKpi.usTotals.rma_bstock_rstock_sent} / ${stockKpi.emeaTotals.rma_bstock_rstock_sent}`,
          ],
          [
            "Awaiting Delivery",
            `${stockKpi.usTotals.awaiting_delivery_from_user} / ${stockKpi.emeaTotals.awaiting_delivery_from_user}`,
          ],
          [
            "Receive / Receiving Only",
            `${stockKpi.usTotals.receive_only} / ${stockKpi.emeaTotals.receiving_only}`,
          ],
          [
            "Awaiting Rush",
            `${stockKpi.usTotals.awaiting_return_from_rush} / ${stockKpi.emeaTotals.awaiting_return_from_rush}`,
          ],
        ]}
      />

      {/* CHARTS – RMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox title="Monthly RMAs" chart={monthlyRmaChart} type="line" />
        <ChartBox title="Monthly Quantity" chart={monthlyQtyChart} type="bar" />
        <ChartBox title="RMAs by Category" chart={rmaByCategoryChart} type="pie" />
        <ChartBox title="RMAs by RMA Type" chart={rmaByTypeChart} type="donut" />
        <ChartBox title="RMAs by Organization" chart={rmaByOrgChart} type="pie" />
        <ChartBox title="Top 10 Devices by RMA Count" chart={topDevicesChart} type="bar" />
      </div>

      {/* STOCK CHART */}
      <div className="grid grid-cols-1 gap-6">
        <ChartBox
          title={`Stock Summary (US vs EMEA) – ${stockMonth}`}
          chart={stockSummaryChart}
          type="bar"
        />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
    UI COMPONENTS
────────────────────────────────────────────── */
function Select({ label, value, setter, options }) {
  return (
    <div>
      <div className="text-xs mb-1">{label}</div>
      <select
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={(e) => setter(e.target.value)}
      >
        <option value="">All</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputDate({ label, value, setter }) {
  return (
    <div>
      <div className="text-xs mb-1">{label}</div>
      <input
        type="date"
        className="border rounded px-3 py-2 w-full"
        value={value}
        onChange={(e) => setter(e.target.value)}
      />
    </div>
  );
}

function KPIGrid({ kpi, title }) {
  return (
    <div className="space-y-2">
      {title && (
        <div className="text-sm font-semibold text-gray-700">{title}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpi.map(([label, value]) => (
          <div
            key={label}
            className="border p-4 rounded-xl bg-white text-center shadow-sm"
          >
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-bold break-words">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartBox({ title, chart, type }) {
  return (
    <div className="border p-4 rounded-xl bg-white">
      <div className="text-sm mb-2 font-semibold">{title}</div>
      <Chart
        options={chart.options}
        series={chart.series}
        type={type}
        height={300}
      />
    </div>
  );
}

/* ───────────────────────────────────────────────
    UTILS
────────────────────────────────────────────── */
function getYear(date) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

function getMonth(date) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.getMonth() + 1;
}

function normalizeDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
