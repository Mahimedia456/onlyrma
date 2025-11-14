import { useMemo, useState } from "react";
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
import RmaRegionReports from "@/pages/RmaRegionReports";
import RushRmaCompare from "@/pages/RushRmaCompare";
import RushRmaProductCompare from "@/pages/RushRmaProductCompare";

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

    // Reports
    if (key === "reports:dashboard") setView("reports-dashboard");
    if (key === "reports:rma-regions") setView("reports-rma-regions");
    if (key === "reports:comparison") setView("reports-comparison");
    if (key === "reports:product-comparison") setView("reports-product-comparison");
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
          <Page>
            <RmaEntry />
          </Page>
        )}
        {!isViewer && view === "rma-emea" && (
          <Page>
            <RmaStockEmea />
          </Page>
        )}
        {!isViewer && view === "rma-us" && (
          <Page>
            <RmaStockUs />
          </Page>
        )}
        {!isViewer && view === "rma-product" && (
          <Page>
            <RmaProductsExplorer />
          </Page>
        )}

        {/* Rush */}
        {!isViewer && view === "rush-sales" && (
          <Page>
            <RushSalesBySource />
          </Page>
        )}
        {!isViewer && view === "rush-processed" && (
          <Page>
            <RushProcessedOrders />
          </Page>
        )}
        {!isViewer && view === "rush-inventory" && (
          <Page>
            <RushInventory />
          </Page>
        )}

        {/* Reports */}
        {!isViewer && view === "reports-dashboard" && (
          <Page>
            <RushReports />
          </Page>
        )}
        {!isViewer && view === "reports-rma-regions" && (
          <Page>
            <RmaRegionReports />
          </Page>
        )}
        {!isViewer && view === "reports-comparison" && (
          <Page>
            <RushRmaCompare />
          </Page>
        )}
        {!isViewer && view === "reports-product-comparison" && (
          <Page>
            <RushRmaProductCompare />
          </Page>
        )}
      </main>
    </div>
  );
}

function Page({ children }) {
  return <div className="bg-white rounded-lg shadow-md p-4">{children}</div>;
}
