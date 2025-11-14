// src/pages/RushReports.jsx

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Chart from "react-apexcharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function RushReports() {
  const [loading, setLoading] = useState(true);

  // Filters
  const [year, setYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Live datasets
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);

  const reportRef = useRef(null);

  /* ───────────────────────────────────────────────
      LOAD DATA FROM 3 TABLES ONLY
  ─────────────────────────────────────────────── */
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [o, s, i] = await Promise.all([
      supabase.from("rush_processed_orders").select("*"),
      supabase.from("rush_sales_by_source").select("*"),
      supabase.from("rush_inventory").select("*"),
    ]);

    if (!o.error) setOrders(o.data || []);
    if (!s.error) setSales(s.data || []);
    if (!i.error) setInventory(i.data || []);

    setLoading(false);
  }

  /* ───────────────────────────────────────────────
      YEAR OPTIONS from created_at
  ─────────────────────────────────────────────── */
  const yearOptions = useMemo(() => {
    const setY = new Set();

    orders.forEach((x) => setY.add(getYear(x.created_at)));
    sales.forEach((x) => setY.add(getYear(x.created_at)));

    return Array.from(setY)
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [orders, sales]);

  /* ───────────────────────────────────────────────
      APPLY FILTERS TO LIVE DATA (created_at)
  ─────────────────────────────────────────────── */

  function applyFilters(data) {
    return data.filter((row) => {
      const d = normalizeDate(row.created_at);
      if (!d) return false;

      const y = getYear(d);
      const m = getMonth(d);

      if (year && y !== Number(year)) return false;
      if (fromMonth && m < Number(fromMonth)) return false;
      if (toMonth && m > Number(toMonth)) return false;

      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;

      return true;
    });
  }

  const filteredOrders = applyFilters(orders);
  const filteredSales = applyFilters(sales);

  /* ───────────────────────────────────────────────
      MONTHLY AGGREGATED REPORT
  ─────────────────────────────────────────────── */
  const monthlyReport = useMemo(() => {
    const bucket = {};

    // Orders aggregation (rush_processed_orders)
    filteredOrders.forEach((o) => {
      const y = getYear(o.created_at);
      const m = getMonth(o.created_at);
      if (!y || !m) return;

      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = {
          year: y,
          month: m,
          total_orders: 0,
          total_sales: 0,
          net_sales: 0,
          units_on_order: 0,
          units_invoiced: 0,
          units_back_order: 0,
          units_sold: 0,
          units_returned: 0,
        };
      }

      // 1 row = 1 order
      bucket[key].total_orders += 1;
      bucket[key].units_on_order += Number(o.units_on_order || 0);
      bucket[key].units_invoiced += Number(o.units_invoiced || 0);
      bucket[key].units_back_order += Number(o.units_on_back_order || 0);
    });

    // Sales aggregation (rush_sales_by_source)
    filteredSales.forEach((s) => {
      const y = getYear(s.created_at);
      const m = getMonth(s.created_at);
      if (!y || !m) return;

      const key = `${y}-${m}`;

      if (!bucket[key]) {
        bucket[key] = {
          year: y,
          month: m,
          total_orders: 0,
          total_sales: 0,
          net_sales: 0,
          units_on_order: 0,
          units_invoiced: 0,
          units_back_order: 0,
          units_sold: 0,
          units_returned: 0,
        };
      }

      bucket[key].total_sales += Number(s.sales_amount || 0);
      bucket[key].net_sales += Number(s.net_sales || 0);
      bucket[key].units_sold += Number(s.units_sold || 0);
      bucket[key].units_returned += Number(s.units_returned || 0);
    });

    return Object.values(bucket).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [filteredOrders, filteredSales]);

  /* ───────────────────────────────────────────────
      KPI LIVE CALCULATIONS
  ─────────────────────────────────────────────── */
  const kpi = {
    // From processed_orders + sales (monthlyReport)
    totalOrders: monthlyReport.reduce((a, b) => a + b.total_orders, 0),
    unitsOnOrder: monthlyReport.reduce((a, b) => a + b.units_on_order, 0),
    unitsInvoiced: monthlyReport.reduce((a, b) => a + b.units_invoiced, 0),
    backOrders: monthlyReport.reduce((a, b) => a + b.units_back_order, 0),
    totalSales: monthlyReport.reduce((a, b) => a + b.total_sales, 0),
    netSales: monthlyReport.reduce((a, b) => a + b.net_sales, 0),
    unitsSold: monthlyReport.reduce((a, b) => a + b.units_sold, 0),
    unitsReturned: monthlyReport.reduce((a, b) => a + b.units_returned, 0),

    // From inventory table
    inventoryTotal: inventory.reduce(
      (a, b) => a + Number(b.total_net_on_shelf || 0),
      0
    ),
    availableStock: inventory.reduce(
      (a, b) => a + Number(b.available || 0),
      0
    ),
  };

  /* ───────────────────────────────────────────────
      CHARTS
  ─────────────────────────────────────────────── */

  const categories = monthlyReport.map((x) => `${x.year}-${pad(x.month)}`);

  const ordersChart = {
    series: [{ name: "Orders", data: monthlyReport.map((x) => x.total_orders) }],
    options: {
      chart: { toolbar: { show: false } },
      xaxis: { categories },
    },
  };

  const netSalesChart = {
    series: [{ name: "Net Sales", data: monthlyReport.map((x) => x.net_sales) }],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: { categories },
    },
  };

  // NEW: Units on order vs invoiced vs back order
  const unitsOrdersChart = {
    series: [
      { name: "Units On Order", data: monthlyReport.map((x) => x.units_on_order) },
      { name: "Units Invoiced", data: monthlyReport.map((x) => x.units_invoiced) },
      { name: "Back Orders", data: monthlyReport.map((x) => x.units_back_order) },
    ],
    options: {
      chart: { type: "bar", stacked: true, toolbar: { show: false } },
      xaxis: { categories },
    },
  };

  // NEW: Units sold vs returned
  const unitsSalesChart = {
    series: [
      { name: "Units Sold", data: monthlyReport.map((x) => x.units_sold) },
      { name: "Units Returned", data: monthlyReport.map((x) => x.units_returned) },
    ],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: { categories },
    },
  };

  // Sales by source (pie)
  const sourceMap = {};
  filteredSales.forEach((s) => {
    sourceMap[s.source_code] =
      (sourceMap[s.source_code] || 0) + Number(s.net_sales || 0);
  });

  const salesBySourceChart = {
    series: Object.values(sourceMap),
    options: {
      labels: Object.keys(sourceMap),
      chart: { type: "pie" },
    },
  };

  // Inventory chart
  const inventoryChart = {
    series: [
      { name: "Available", data: inventory.map((i) => i.available) },
      { name: "Committed", data: inventory.map((i) => i.committed) },
      { name: "Back Ordered", data: inventory.map((i) => i.back_ordered) },
    ],
    options: {
      chart: { type: "bar", stacked: true },
      xaxis: { categories: inventory.map((i) => i.stock_number) },
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
    pdf.save("rush_report.pdf");
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
  }

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  /* ───────────────────────────────────────────────
      UI STARTS
  ─────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-6" ref={reportRef}>
      {/* FILTER PANEL */}
      <div className="border p-4 rounded-xl bg-white grid grid-cols-1 md:grid-cols-5 gap-4">
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
          label="From Date (dd/mm/yyyy)"
          value={fromDate}
          setter={setFromDate}
        />

        <InputDate
          label="To Date (dd/mm/yyyy)"
          value={toDate}
          setter={setToDate}
        />

        {/* Clear filters button, full row */}
        <div className="md:col-span-5 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs px-3 py-2 border rounded hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <KPIGrid kpi={kpi} />

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox title="Monthly Orders" chart={ordersChart} type="line" />
        <ChartBox title="Net Sales" chart={netSalesChart} type="bar" />
        <ChartBox
          title="Units On Order vs Invoiced vs Back Orders"
          chart={unitsOrdersChart}
          type="bar"
        />
        <ChartBox
          title="Units Sold vs Units Returned"
          chart={unitsSalesChart}
          type="bar"
        />
        <ChartBox title="Sales by Source" chart={salesBySourceChart} type="pie" />
        <ChartBox title="Inventory Status" chart={inventoryChart} type="bar" />
      </div>

      <div className="text-right">
        <button
          onClick={downloadPDF}
          className="bg-black text-white px-5 py-3 rounded"
        >
          Download PDF
        </button>
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
  const items = [
    ["Total Orders", kpi.totalOrders],
    ["Units On Order", kpi.unitsOnOrder],
    ["Units Invoiced", kpi.unitsInvoiced],
    ["Back Orders", kpi.backOrders],
    ["Total Sales", "$" + kpi.totalSales.toLocaleString()],
    ["Net Sales", "$" + kpi.netSales.toLocaleString()],
    ["Units Sold", kpi.unitsSold],
    ["Units Returned", kpi.unitsReturned],
    ["Inventory Total", kpi.inventoryTotal],
    ["Available Stock", kpi.availableStock],
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="border p-4 rounded-xl bg-white text-center shadow-sm"
        >
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-bold">{value}</div>
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
