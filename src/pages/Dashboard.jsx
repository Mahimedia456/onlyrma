import { useEffect, useMemo, useState } from "react";
import { FiMenu } from "react-icons/fi";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

// RMA pages
import RmaEntry from "@/pages/RmaEntry";
import RmaStockEmea from "@/pages/RmaStockEmea";
import RmaStockUs from "@/pages/RmaStockUs";
import RmaProductsExplorer from "@/components/RmaProductsExplorer";


export default function Dashboard() {
  const role = useMemo(() => (localStorage.getItem("role") || "admin").toLowerCase(), []);
  const isViewer = role === "viewer";

  const [view, setView] = useState(isViewer ? "rma-entry" : "rma-entry");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    if (isViewer && view !== "rma-entry") setView("rma-entry");
  }, [isViewer, view]);

  const handleSelect = (key) => {
    setSidebarOpen(false);
    if (key === "rma:entry")   setView("rma-entry");
    if (key === "rma:emea")    setView("rma-emea");
    if (key === "rma:us")      setView("rma-us");
    if (key === "rma:product") setView("rma-product");
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
          <img src="https://www.angelbird.com/static/web/img/AB_Logo.svg" alt="Angelbird" className="h-6" />
        </div>

        {/* RMA views */}
        {view === "rma-entry"    && <div className="bg-white rounded-lg shadow-md p-4"><RmaEntry /></div>}
        {!isViewer && view === "rma-emea"     && <div className="bg-white rounded-lg shadow-md p-4"><RmaStockEmea /></div>}
        {!isViewer && view === "rma-us"       && <div className="bg-white rounded-lg shadow-md p-4"><RmaStockUs /></div>}
        {!isViewer && view === "rma-products" && <div className="bg-white rounded-lg shadow-md p-4"><RmaProducts /></div>}
        {!isViewer && view === "rma-product" && (
<div className="bg-white rounded-lg shadow-md p-4">
 <RmaProductsExplorer />
 </div>
)}
      </main>
    </div>
  );
}
