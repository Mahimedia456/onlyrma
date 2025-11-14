// src/pages/RushRmaCompare.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

/**
 * Comparison dashboard:
 * - Rush (orders + sales)
 * - RMA entries
 * Same filters (year / month range / date range), so both sides are aligned.
 */
export default function RushRmaCompare() {
  const [loading, setLoading] = useState(true);

  // Shared filters for BOTH datasets
  const [year, setYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [org, setOrg] = useState(""); // Only applies to RMA (US/EMEA)

  // Live datasets
  const [orders, setOrders] = useState([]);      // rush_processed_orders
  const [sales, setSales] = useState([]);        // rush_sales_by_source
  const [entries, setEntries] = useState([]);    // rma/entries

  const reportRef = useRef(null);

  /* ───────────────────────────────────────────────
      LOAD DATA: Rush + RMA (LIVE)
  ─────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [oRes, sRes, rmaRes] = await Promise.all([
          supabase.from("rush_processed_orders").select("*"),
          supabase.from("rush_sales_by_source").select("*"),
          fetch(apiUrl("/rma/entries"), { credentials: "include" }),
        ]);

        if (!oRes.error) setOrders(oRes.data || []);
        if (!sRes.error) setSales(sRes.data || []);

        const rmaJson = await safeJson(rmaRes);
        setEntries(rmaRes.ok ? rmaJson?.entries || [] : []);
      } catch (e) {
        console.error("Compare data fetch failed", e);
        setOrders([]);
        setSales([]);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ───────────────────────────────────────────────
      YEAR OPTIONS from both data sets
  ─────────────────────────────────────────────── */
  const yearOptions = useMemo(() => {
    const setY = new Set();
    orders.forEach((x) => setY.add(getYear(x.created_at)));
    entries.forEach((x) => setY.add(getYear(x.entry_date)));
    return Array.from(setY)
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [orders, entries]);

  /* ───────────────────────────────────────────────
      APPLY FILTERS
  ─────────────────────────────────────────────── */

  function applyFiltersRush(rowDate) {
    const d = normalizeDate(rowDate);
    if (!d) return false;

    const y = getYear(d);
    const m = getMonth(d);

    if (year && y !== Number(year)) return false;
    if (fromMonth && m < Number(fromMonth)) return false;
    if (toMonth && m > Number(toMonth)) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;

    return true;
  }

  function applyFiltersRma(row) {
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
  }

  const filteredOrders = orders.filter((o) => applyFiltersRush(o.created_at));
  const filteredSales = sales.filter((s) => applyFiltersRush(s.created_at));
  const filteredEntries = entries.filter(applyFiltersRma);

  /* ───────────────────────────────────────────────
      MONTHLY COMBINED BUCKET (Rush + RMA)
  ─────────────────────────────────────────────── */
  const monthlyCombined = useMemo(() => {
    const bucket = {};

    // Rush Orders (rush_processed_orders)
    filteredOrders.forEach((o) => {
      const y = getYear(o.created_at);
      const m = getMonth(o.created_at);
      if (!y || !m) return;
      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = baseMonthly(y, m);
      }

      bucket[key].orders += 1;
      bucket[key].units_on_order += Number(o.units_on_order || 0);
      bucket[key].units_invoiced += Number(o.units_invoiced || 0);
      bucket[key].back_orders += Number(o.units_on_back_order || 0);
    });

    // Rush Sales (rush_sales_by_source)
    filteredSales.forEach((s) => {
      const y = getYear(s.created_at);
      const m = getMonth(s.created_at);
      if (!y || !m) return;
      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = baseMonthly(y, m);
      }

      bucket[key].net_sales += Number(s.net_sales || 0);
      bucket[key].units_sold += Number(s.units_sold || 0);
      bucket[key].units_returned += Number(s.units_returned || 0);
    });

    // RMA Entries
    filteredEntries.forEach((e) => {
      const y = getYear(e.entry_date);
      const m = getMonth(e.entry_date);
      if (!y || !m) return;
      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = baseMonthly(y, m);
      }

      bucket[key].rma_count += 1;
      bucket[key].rma_qty += Number(e.quantity || 0);
    });

    return Object.values(bucket).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [filteredOrders, filteredSales, filteredEntries]);

  /* ───────────────────────────────────────────────
      KPI CALCULATIONS
  ─────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    let totalOrders = 0;
    let totalNetSales = 0;
    let totalUnitsSold = 0;
    let totalUnitsReturned = 0;
    let totalRmas = 0;
    let totalRmaQty = 0;

    monthlyCombined.forEach((m) => {
      totalOrders += m.orders;
      totalNetSales += m.net_sales;
      totalUnitsSold += m.units_sold;
      totalUnitsReturned += m.units_returned;
      totalRmas += m.rma_count;
      totalRmaQty += m.rma_qty;
    });

    const monthsCount = monthlyCombined.length || 1;

    const rmaPer100Orders =
      totalOrders > 0 ? (totalRmas / totalOrders) * 100 : 0;

    const rmaPer1000Units =
      totalUnitsSold > 0 ? (totalRmaQty / totalUnitsSold) * 1000 : 0;

    const returnRate =
      totalUnitsSold > 0 ? (totalUnitsReturned / totalUnitsSold) * 100 : 0;

    const avgOrdersPerMonth = totalOrders / monthsCount;
    const avgRmasPerMonth = totalRmas / monthsCount;

    const netSalesPerRma = totalRmas > 0 ? totalNetSales / totalRmas : 0;

    return {
      totalOrders,
      totalNetSales,
      totalUnitsSold,
      totalUnitsReturned,
      totalRmas,
      totalRmaQty,
      rmaPer100Orders: rmaPer100Orders.toFixed(2),
      rmaPer1000Units: rmaPer1000Units.toFixed(1),
      returnRate: returnRate.toFixed(2),
      avgOrdersPerMonth: avgOrdersPerMonth.toFixed(1),
      avgRmasPerMonth: avgRmasPerMonth.toFixed(1),
      netSalesPerRma: netSalesPerRma.toFixed(2),
    };
  }, [monthlyCombined]);

  /* ───────────────────────────────────────────────
      CHARTS
  ─────────────────────────────────────────────── */
  const monthCategories = monthlyCombined.map(
    (x) => `${x.year}-${pad(x.month)}`
  );

  // Orders vs RMAs
  const ordersVsRmaChart = {
    series: [
      { name: "Orders", data: monthlyCombined.map((x) => x.orders) },
      { name: "RMA Count", data: monthlyCombined.map((x) => x.rma_count) },
    ],
    options: {
      chart: { toolbar: { show: false } },
      xaxis: { categories: monthCategories },
    },
  };

  // RMA rate (RMAs per 100 orders)
  const rmaRateChart = {
    series: [
      {
        name: "RMAs per 100 Orders",
        data: monthlyCombined.map((x) =>
          x.orders > 0 ? (x.rma_count / x.orders) * 100 : 0
        ),
      },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: { categories: monthCategories },
    },
  };

  // Net Sales vs RMA Quantity
  const salesVsRmaQtyChart = {
    series: [
      {
        name: "Net Sales (k)",
        data: monthlyCombined.map((x) => x.net_sales / 1000),
      },
      {
        name: "RMA Quantity",
        data: monthlyCombined.map((x) => x.rma_qty),
      },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false }, stacked: false },
      xaxis: { categories: monthCategories },
      yaxis: [
        {
          title: { text: "Net Sales (k)" },
        },
        {
          opposite: true,
          title: { text: "RMA Qty" },
        },
      ],
    },
  };

  // RMA by Category vs Sales by Source (two pies side-by-side)
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

  const sourceMap = {};
  filteredSales.forEach((s) => {
    const code = s.source_code || "Unknown";
    sourceMap[code] = (sourceMap[code] || 0) + Number(s.net_sales || 0);
  });
  const salesBySourceChart = {
    series: Object.values(sourceMap),
    options: {
      labels: Object.keys(sourceMap),
      chart: { type: "pie" },
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
    pdf.save("rush_rma_comparison.pdf");
  }

  /* Month names for filter dropdowns */
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

  if (loading && !orders.length && !entries.length) {
    return <div className="p-6 text-center">Loading comparison...</div>;
  }

  /* ───────────────────────────────────────────────
      UI
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
        <InputDate
          label="From Date"
          value={fromDate}
          setter={setFromDate}
        />
        <InputDate
          label="To Date"
          value={toDate}
          setter={setToDate}
        />
        <Select
          label="Organization (RMA only)"
          value={org}
          setter={setOrg}
          options={[
            ["US", "US"],
            ["EMEA", "EMEA"],
          ]}
        />

        <div className="md:col-span-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs px-3 py-2 border rounded hover:bg-gray-50"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={downloadPDF}
            className="bg-black text-white text-xs px-4 py-2 rounded"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      <KPIGrid
        kpi={[
          ["Total Orders", kpi.totalOrders],
          ["Total RMAs", kpi.totalRmas],
          ["Total RMA Qty", kpi.totalRmaQty],
          ["Total Net Sales", "$" + kpi.totalNetSales.toLocaleString()],
          ["Total Units Sold", kpi.totalUnitsSold],
          ["Total Units Returned", kpi.totalUnitsReturned],
          ["RMAs per 100 Orders", kpi.rmaPer100Orders],
          ["RMAs per 1000 Units", kpi.rmaPer1000Units],
          ["Return Rate (%)", kpi.returnRate],
          ["Avg Orders / Month", kpi.avgOrdersPerMonth],
          ["Avg RMAs / Month", kpi.avgRmasPerMonth],
          ["Net Sales per RMA", "$" + kpi.netSalesPerRma],
        ]}
      />

      {/* MAIN COMPARISON CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox
          title="Orders vs RMA Count (Monthly)"
          chart={ordersVsRmaChart}
          type="line"
        />
        <ChartBox
          title="RMAs per 100 Orders (Monthly)"
          chart={rmaRateChart}
          type="bar"
        />
        <ChartBox
          title="Net Sales (k) vs RMA Quantity"
          chart={salesVsRmaQtyChart}
          type="bar"
        />
        <ChartBox
          title="RMA by Category"
          chart={rmaByCategoryChart}
          type="pie"
        />
        <ChartBox
          title="Sales by Source"
          chart={salesBySourceChart}
          type="pie"
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

function KPIGrid({ kpi }) {
  return (
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
  );
}

function ChartBox({ title, chart, type }) {
  return (
    <div className="border p-4 rounded-xl bg-white">
      <div className="text-sm mb-2 font-semibold">{title}</div>
      <Chart options={chart.options} series={chart.series} type={type} height={300} />
    </div>
  );
}

/* ───────────────────────────────────────────────
    UTILS
────────────────────────────────────────────── */
function baseMonthly(year, month) {
  return {
    year,
    month,
    orders: 0,
    units_on_order: 0,
    units_invoiced: 0,
    back_orders: 0,
    net_sales: 0,
    units_sold: 0,
    units_returned: 0,
    rma_count: 0,
    rma_qty: 0,
  };
}

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
