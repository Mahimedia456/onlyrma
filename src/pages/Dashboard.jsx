// src/pages/Dashboard.jsx

import { useEffect, useMemo, useState } from "react";
import { FiMenu } from "react-icons/fi";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

// RMA pages
import RmaEntry from "@/pages/RmaEntry";
import RmaStockEmea from "@/pages/RmaStockEmea";
import RmaStockUs from "@/pages/RmaStockUs";
import RmaProductsExplorer from "@/components/RmaProductsExplorer";

// Rush Order pages
import RushInventory from "@/pages/RushInventory";
import RushProcessedOrders from "@/pages/RushProcessedOrders";
import RushSalesBySource from "@/pages/RushSalesBySource";

// Reports
import RushReports from "@/pages/RushReports";

export default function Dashboard() {
  const role = useMemo(
    () => (localStorage.getItem("role") || "admin").toLowerCase(),
    []
  );
  const isViewer = role === "viewer";

  const [view, setView] = useState("rma-entry");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  const handleSelect = (key) => {
    setSidebarOpen(false);

    // RMA
    if (key === "rma:entry") setView("rma-entry");
    if (key === "rma:emea") setView("rma-emea");
    if (key === "rma:us") setView("rma-us");
    if (key === "rma:product") setView("rma-product");

    // Rush
    if (key === "rush:sales") setView("rush-sales");
    if (key === "rush:processed") setView("rush-processed");
    if (key === "rush:inventory") setView("rush-inventory");

    // REPORTS
    if (key === "reports:dashboard") setView("reports-dashboard");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        onSelect={handleSelect}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Mobile header */}
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"
            aria-label="Open menu"
          >
            <FiMenu />
          </button>
          <img src="/atomosf.png" alt="Angelbird" className="h-6" />
        </div>

        {/* RMA Pages */}
        {view === "rma-entry" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaEntry />
          </div>
        )}
        {!isViewer && view === "rma-emea" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaStockEmea />
          </div>
        )}
        {!isViewer && view === "rma-us" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaStockUs />
          </div>
        )}
        {!isViewer && view === "rma-product" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaProductsExplorer />
          </div>
        )}

        {/* Rush */}
        {!isViewer && view === "rush-sales" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RushSalesBySource />
          </div>
        )}
        {!isViewer && view === "rush-processed" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RushProcessedOrders />
          </div>
        )}
        {!isViewer && view === "rush-inventory" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RushInventory />
          </div>
        )}

        {/* Reports Dashboard */}
        {!isViewer && view === "reports-dashboard" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RushReports />
          </div>
        )}
      </main>
    </div>
  );
}
