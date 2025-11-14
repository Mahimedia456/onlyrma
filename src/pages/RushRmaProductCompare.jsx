// src/pages/RushRmaProductCompare.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

/**
 * Product-level comparison dashboard:
 * - Rush (Processed Orders + Sales) vs RMA Entries
 * - Region tabs: US (-O) and EMEA (-E) based on product code
 * - Live data + KPIs + charts + table
 */
export default function RushRmaProductCompare() {
  const [loading, setLoading] = useState(true);

  // Shared filters
  const [year, setYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeRegion, setActiveRegion] = useState("US"); // "US" | "EMEA"

  // Live datasets
  const [orders, setOrders] = useState([]);   // rush_processed_orders
  const [sales, setSales] = useState([]);     // rush_sales_by_source
  const [entries, setEntries] = useState([]); // rma/entries

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
        console.error("Product compare data fetch failed", e);
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
    sales.forEach((x) => setY.add(getYear(x.created_at)));
    entries.forEach((x) => setY.add(getYear(x.entry_date)));
    return Array.from(setY)
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [orders, sales, entries]);

  /* ───────────────────────────────────────────────
      DATE FILTERS
  ─────────────────────────────────────────────── */
  function applyFiltersByDate(dateValue) {
    const d = normalizeDate(dateValue);
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

  const filteredOrders = useMemo(
    () => orders.filter((o) => applyFiltersByDate(o.created_at)),
    [orders, year, fromMonth, toMonth, fromDate, toDate]
  );

  const filteredSales = useMemo(
    () => sales.filter((s) => applyFiltersByDate(s.created_at)),
    [sales, year, fromMonth, toMonth, fromDate, toDate]
  );

  const filteredEntries = useMemo(
    () => entries.filter((e) => applyFiltersByDate(e.entry_date)),
    [entries, year, fromMonth, toMonth, fromDate, toDate]
  );

  /* ───────────────────────────────────────────────
      PRODUCT-LEVEL AGGREGATION
      Region based on product code:
      - "-O" => US
      - "-E" => EMEA
  ─────────────────────────────────────────────── */

  const regionBuckets = useMemo(() => {
    const regions = {
      US: {},
      EMEA: {},
    };

    // Rush Processed Orders
    filteredOrders.forEach((o) => {
      const code = getProductCodeFromRush(o);
      if (!code) return;
      const region = getRegionFromProductCode(code);
      if (!region) return;

      if (!regions[region][code]) {
        regions[region][code] = baseProduct(code);
      }

      const bucket = regions[region][code];
      bucket.rush_orders += 1;
      bucket.rush_units_on_order += Number(o.units_on_order || 0);
      bucket.rush_units_invoiced += Number(o.units_invoiced || 0);
      bucket.rush_back_orders += Number(o.units_on_back_order || 0);
    });

    // Rush Sales
    filteredSales.forEach((s) => {
      const code = getProductCodeFromRush(s);
      if (!code) return;
      const region = getRegionFromProductCode(code);
      if (!region) return;

      if (!regions[region][code]) {
        regions[region][code] = baseProduct(code);
      }

      const bucket = regions[region][code];
      bucket.rush_net_sales += Number(s.net_sales || 0);
      bucket.rush_units_sold += Number(s.units_sold || 0);
      bucket.rush_units_returned += Number(s.units_returned || 0);
    });

    // RMA Entries
    filteredEntries.forEach((e) => {
      const code = getProductCodeFromRma(e);
      if (!code) return;
      const region = getRegionFromProductCode(code);
      if (!region) return;

      if (!regions[region][code]) {
        regions[region][code] = baseProduct(code);
      }

      const bucket = regions[region][code];
      bucket.rma_cases += 1;
      bucket.rma_qty += Number(e.quantity || 0);
    });

    // derive ratios
    ["US", "EMEA"].forEach((r) => {
      Object.values(regions[r]).forEach((p) => {
        if (p.rush_orders > 0) {
          p.rmas_per_100_orders = (p.rma_cases / p.rush_orders) * 100;
        }
        if (p.rush_units_sold > 0) {
          p.rmas_per_1000_units = (p.rma_qty / p.rush_units_sold) * 1000;
          p.return_rate = (p.rush_units_returned / p.rush_units_sold) * 100;
        }
      });
    });

    return regions;
  }, [filteredOrders, filteredSales, filteredEntries]);

  const activeProducts = useMemo(
    () => Object.values(regionBuckets[activeRegion] || {}),
    [regionBuckets, activeRegion]
  );

  /* ───────────────────────────────────────────────
      KPI CALCULATION (per region, based on active tab)
  ─────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    let totalOrders = 0;
    let totalNetSales = 0;
    let totalUnitsSold = 0;
    let totalUnitsReturned = 0;
    let totalRmaCases = 0;
    let totalRmaQty = 0;

    activeProducts.forEach((p) => {
      totalOrders += p.rush_orders;
      totalNetSales += p.rush_net_sales;
      totalUnitsSold += p.rush_units_sold;
      totalUnitsReturned += p.rush_units_returned;
      totalRmaCases += p.rma_cases;
      totalRmaQty += p.rma_qty;
    });

    const rmaPer100Orders =
      totalOrders > 0 ? (totalRmaCases / totalOrders) * 100 : 0;

    const rmaPer1000Units =
      totalUnitsSold > 0 ? (totalRmaQty / totalUnitsSold) * 1000 : 0;

    const returnRate =
      totalUnitsSold > 0 ? (totalUnitsReturned / totalUnitsSold) * 100 : 0;

    const netSalesPerRma =
      totalRmaCases > 0 ? totalNetSales / totalRmaCases : 0;

    return {
      totalOrders,
      totalNetSales,
      totalUnitsSold,
      totalUnitsReturned,
      totalRmaCases,
      totalRmaQty,
      rmaPer100Orders: rmaPer100Orders.toFixed(2),
      rmaPer1000Units: rmaPer1000Units.toFixed(1),
      returnRate: returnRate.toFixed(2),
      netSalesPerRma: netSalesPerRma.toFixed(2),
    };
  }, [activeProducts]);

  /* ───────────────────────────────────────────────
      CHART DATA (Top 10 products in active region)
  ─────────────────────────────────────────────── */

  const topByRma = [...activeProducts]
    .sort((a, b) => b.rma_cases - a.rma_cases)
    .slice(0, 10);

  const topBySales = [...activeProducts]
    .sort((a, b) => b.rush_net_sales - a.rush_net_sales)
    .slice(0, 10);

  const ordersVsRmaChart = {
    series: [
      {
        name: "Rush Orders",
        data: topByRma.map((p) => p.rush_orders),
      },
      {
        name: "RMA Cases",
        data: topByRma.map((p) => p.rma_cases),
      },
    ],
    options: {
      chart: { toolbar: { show: false } },
      xaxis: { categories: topByRma.map((p) => p.product_code) },
    },
  };

  const salesVsRmaQtyChart = {
    series: [
      {
        name: "Net Sales (k)",
        data: topBySales.map((p) => p.rush_net_sales / 1000),
      },
      {
        name: "RMA Qty",
        data: topBySales.map((p) => p.rma_qty),
      },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false }, stacked: false },
      xaxis: { categories: topBySales.map((p) => p.product_code) },
    },
  };

  const rmaShareChart = {
    series: activeProducts.map((p) => p.rma_cases),
    options: {
      labels: activeProducts.map((p) => p.product_code),
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
    pdf.save(`rush_rma_product_compare_${activeRegion}.pdf`);
  }

  /* Filters helpers */
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
  }

  if (loading && !orders.length && !sales.length && !entries.length) {
    return <div className="p-6 text-center">Loading product comparison...</div>;
  }

  /* ───────────────────────────────────────────────
      UI
  ─────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-6" ref={reportRef}>
      {/* REGION TABS */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setActiveRegion("US")}
          className={`px-4 py-2 text-sm rounded-full border ${
            activeRegion === "US"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          US (-O)
        </button>
        <button
          type="button"
          onClick={() => setActiveRegion("EMEA")}
          className={`px-4 py-2 text-sm rounded-full border ${
            activeRegion === "EMEA"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          EMEA (-E)
        </button>
      </div>

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

        <div className="md:col-span-2 flex justify-end gap-2 items-end">
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

      {/* KPIs */}
      <KPIGrid
        kpi={[
          ["Total Rush Orders", kpi.totalOrders],
          ["Total Net Sales", "$" + kpi.totalNetSales.toLocaleString()],
          ["Total Units Sold", kpi.totalUnitsSold],
          ["Total Units Returned", kpi.totalUnitsReturned],
          ["Total RMA Cases", kpi.totalRmaCases],
          ["Total RMA Qty", kpi.totalRmaQty],
          ["RMAs per 100 Orders", kpi.rmaPer100Orders],
          ["RMAs per 1000 Units", kpi.rmaPer1000Units],
          ["Return Rate (%)", kpi.returnRate],
          ["Net Sales per RMA", "$" + kpi.netSalesPerRma],
        ]}
      />

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox
          title={`Top Products by RMA vs Orders (${activeRegion})`}
          chart={ordersVsRmaChart}
          type="bar"
        />
        <ChartBox
          title={`Top Products by Sales vs RMA Qty (${activeRegion})`}
          chart={salesVsRmaQtyChart}
          type="bar"
        />
        <ChartBox
          title={`RMA Share by Product (${activeRegion})`}
          chart={rmaShareChart}
          type="pie"
        />
      </div>

      {/* TABLE */}
      <div className="border rounded-xl bg-white p-4 overflow-auto">
        <div className="text-sm font-semibold mb-2">
          Product Comparison Table – {activeRegion}
        </div>
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[11px]">
              <th className="border px-2 py-1 text-left">Product</th>
              <th className="border px-2 py-1 text-right">Rush Orders</th>
              <th className="border px-2 py-1 text-right">Units Sold</th>
              <th className="border px-2 py-1 text-right">Net Sales</th>
              <th className="border px-2 py-1 text-right">RMA Cases</th>
              <th className="border px-2 py-1 text-right">RMA Qty</th>
              <th className="border px-2 py-1 text-right">RMAs / 100 Orders</th>
              <th className="border px-2 py-1 text-right">RMAs / 1000 Units</th>
              <th className="border px-2 py-1 text-right">Return Rate %</th>
            </tr>
          </thead>
          <tbody>
            {activeProducts.map((p) => (
              <tr key={p.product_code} className="hover:bg-gray-50">
                <td className="border px-2 py-1">{p.product_code}</td>
                <td className="border px-2 py-1 text-right">
                  {p.rush_orders}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rush_units_sold}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rush_net_sales.toLocaleString()}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rma_cases}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rma_qty}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rmas_per_100_orders.toFixed(2)}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.rmas_per_1000_units.toFixed(1)}
                </td>
                <td className="border px-2 py-1 text-right">
                  {p.return_rate.toFixed(2)}
                </td>
              </tr>
            ))}

            {activeProducts.length === 0 && (
              <tr>
                <td
                  className="border px-2 py-3 text-center text-gray-500"
                  colSpan={9}
                >
                  No data found for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
function baseProduct(product_code) {
  return {
    product_code,
    rush_orders: 0,
    rush_units_on_order: 0,
    rush_units_invoiced: 0,
    rush_back_orders: 0,
    rush_net_sales: 0,
    rush_units_sold: 0,
    rush_units_returned: 0,
    rma_cases: 0,
    rma_qty: 0,
    rmas_per_100_orders: 0,
    rmas_per_1000_units: 0,
    return_rate: 0,
  };
}

function getProductCodeFromRush(row) {
  // Adjust if your column names differ
  return (
    row.product_code ||
    row.stock_number ||
    row.sku ||
    row.stocknumber ||
    null
  );
}

function getProductCodeFromRma(row) {
  // Adjust if your column names differ
  return (
    row.product_sku ||
    row.product_code ||
    row.stock_number ||
    row.sku ||
    row.device_name ||
    null
  );
}

function getRegionFromProductCode(code) {
  if (typeof code !== "string") return null;
  if (code.endsWith("-O")) return "US";
  if (code.endsWith("-E")) return "EMEA";
  return null;
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

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
