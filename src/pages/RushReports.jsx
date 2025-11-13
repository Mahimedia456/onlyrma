import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Chart from "react-apexcharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function RushReports() {
  const [loading, setLoading] = useState(true);

  // filters
  const [year, setYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // data sets
  const [master, setMaster] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);

  const reportRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [m, o, s, i] = await Promise.all([
      supabase.from("rush_reports_master").select("*"),
      supabase.from("rush_processed_orders").select("*"),
      supabase.from("rush_sales_by_source").select("*"),
      supabase.from("rush_inventory").select("*"),
    ]);

    if (m.error) console.error(m.error);
    if (o.error) console.error(o.error);
    if (s.error) console.error(s.error);
    if (i.error) console.error(i.error);

    setMaster(m.data || []);
    setOrders(o.data || []);
    setSales(s.data || []);
    setInventory(i.data || []);
    setLoading(false);
  }

  /* ───────────────────────────────────────────────
        FILTER LOGIC
  ─────────────────────────────────────────────── */
  function filterData() {
    let m = [...master];

    // filter by year
    if (year) {
      m = m.filter((x) => x.report_year === Number(year));
    }

    // filter by month range
    if (fromMonth || toMonth) {
      m = m.filter((x) => {
        const mm = Number(x.report_month);
        if (fromMonth && mm < Number(fromMonth)) return false;
        if (toMonth && mm > Number(toMonth)) return false;
        return true;
      });
    }

    // filter by date range (affects sales + orders charts)
    let filteredOrders = [...orders];
    let filteredSales = [...sales];

    if (fromDate) {
      filteredOrders = filteredOrders.filter(
        (x) => x.entry_date && x.entry_date >= fromDate
      );
      filteredSales = filteredSales.filter(
        (x) => x.report_date && x.report_date >= fromDate
      );
    }

    if (toDate) {
      filteredOrders = filteredOrders.filter(
        (x) => x.entry_date && x.entry_date <= toDate
      );
      filteredSales = filteredSales.filter(
        (x) => x.report_date && x.report_date <= toDate
      );
    }

    return { m, filteredOrders, filteredSales };
  }

  const { m: reportData, filteredOrders, filteredSales } = filterData();

  /* ───────────────────────────────────────────────
        KPI CALCULATIONS
  ─────────────────────────────────────────────── */
  const kpi = {
    totalOrders: reportData.reduce((a, b) => a + b.total_orders, 0),
    totalUnitsOnOrder: reportData.reduce((a, b) => a + b.total_units_on_order, 0),
    totalUnitsInvoiced: reportData.reduce((a, b) => a + b.total_units_invoiced, 0),
    totalBackOrder: reportData.reduce((a, b) => a + b.total_units_on_back_order, 0),
    totalSales: reportData.reduce((a, b) => a + Number(b.total_sales), 0),
    netSales: reportData.reduce((a, b) => a + Number(b.total_net_sales), 0),
    unitsSold: reportData.reduce((a, b) => a + Number(b.total_units_sold), 0),
    unitsReturned: reportData.reduce((a, b) => a + Number(b.total_units_returned), 0),
    inventoryTotal: inventory.reduce((a, b) => a + Number(b.total_net_on_shelf), 0),
    inventoryAvailable: inventory.reduce((a, b) => a + Number(b.available), 0),
    inventoryCommitted: inventory.reduce((a, b) => a + Number(b.committed), 0),
  };

  /* ───────────────────────────────────────────────
        CHARTS
  ─────────────────────────────────────────────── */

  // Monthly Orders Chart
  const ordersChart = {
    series: [
      {
        name: "Orders",
        data: reportData.map((x) => x.total_orders),
      },
    ],
    options: {
      chart: { id: "orders", toolbar: { show: false } },
      xaxis: {
        categories: reportData.map((x) => `${x.report_year}-${x.report_month}`),
      },
    },
  };

  // Net Sales Bar Chart
  const netSalesChart = {
    series: [{ name: "Net Sales", data: reportData.map((x) => x.total_net_sales) }],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      xaxis: {
        categories: reportData.map((x) => `${x.report_year}-${x.report_month}`),
      },
    },
  };

  // Sales by Source Pie Chart
  const salesBySourceMap = {};
  filteredSales.forEach((s) => {
    salesBySourceMap[s.source_code] = 
      (salesBySourceMap[s.source_code] || 0) + Number(s.net_sales);
  });

  const salesBySourceChart = {
    series: Object.values(salesBySourceMap),
    options: {
      labels: Object.keys(salesBySourceMap),
      chart: { type: "pie" },
    },
  };

  // Inventory Bar Chart
  const inventoryChart = {
    series: [
      {
        name: "Available",
        data: inventory.map((i) => i.available),
      },
      {
        name: "Committed",
        data: inventory.map((i) => i.committed),
      },
      {
        name: "Back Ordered",
        data: inventory.map((i) => i.back_ordered),
      },
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
    const input = reportRef.current;
    const canvas = await html2canvas(input, { scale: 2 });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save("rush_report.pdf");
  }

  if (loading) {
    return <div className="p-6 text-center">Loading Reports…</div>;
  }

  return (
    <div className="p-4 space-y-6" ref={reportRef}>

      {/* FILTERS */}
      <div className="border p-4 rounded-xl bg-white">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          <div>
            <div className="text-xs mb-1">Year</div>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs mb-1">From Month</div>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs mb-1">To Month</div>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs mb-1">From Date</div>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs mb-1">To Date</div>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {[
          ["Total Orders", kpi.totalOrders],
          ["Total Sales", "$" + kpi.totalSales.toLocaleString()],
          ["Net Sales", "$" + kpi.netSales.toLocaleString()],
          ["Units Sold", kpi.unitsSold],
          ["Units Returned", kpi.unitsReturned],
          ["Inventory Total", kpi.inventoryTotal],
          ["Available Stock", kpi.inventoryAvailable],
          ["Units Invoiced", kpi.totalUnitsInvoiced],
        ].map(([label, val]) => (
          <div
            key={label}
            className="border p-4 rounded-xl bg-white text-center shadow-sm"
          >
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold">{val}</div>
          </div>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="border p-4 rounded-xl bg-white">
          <div className="text-sm mb-2 font-semibold">Monthly Orders</div>
          <Chart options={ordersChart.options} series={ordersChart.series} type="line" height={300} />
        </div>

        <div className="border p-4 rounded-xl bg-white">
          <div className="text-sm mb-2 font-semibold">Net Sales</div>
          <Chart options={netSalesChart.options} series={netSalesChart.series} type="bar" height={300} />
        </div>

        <div className="border p-4 rounded-xl bg-white">
          <div className="text-sm mb-2 font-semibold">Sales by Source</div>
          <Chart options={salesBySourceChart.options} series={salesBySourceChart.series} type="pie" height={300} />
        </div>

        <div className="border p-4 rounded-xl bg-white">
          <div className="text-sm mb-2 font-semibold">Inventory Status</div>
          <Chart options={inventoryChart.options} series={inventoryChart.series} type="bar" height={300} />
        </div>
      </div>

      {/* PDF EXPORT */}
      <div className="text-right">
        <button
          className="bg-black text-white px-5 py-3 rounded"
          onClick={downloadPDF}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
