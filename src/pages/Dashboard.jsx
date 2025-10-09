// src/pages/Dashboard.jsx
import { useMemo, useState, useEffect } from "react";
import { FiMenu } from "react-icons/fi";

import Sidebar from "../components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

// RMA pages only
import RmaTickets from "@/pages/RmaTickets";
import RmaEntry from "@/pages/RmaEntry";
import RmaStockEmea from "@/pages/RmaStockEmea";
import RmaStockUs from "@/pages/RmaStockUs";

export default function Dashboard() {
  const role = useMemo(() => (localStorage.getItem("role") || "admin").toLowerCase(), []);
  const isViewer = role === "viewer";

  const [view, setView] = useState("rma-entry"); // default to RMA Entry
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const { logout } = useAuth();

  useEffect(() => {
    if (isViewer && view !== "rma-entry") setView("rma-entry");
  }, [isViewer, view]);

  const handleSelect = (key) => {
    setSidebarOpen(false);
    if (isViewer) {
      setView("rma-entry");
      return;
    }
    if (key === "rma:tickets") { setView("rma-tickets"); return; }
    if (key === "rma:entry")   { setView("rma-entry");   return; }
    if (key === "rma:emea")    { setView("rma-emea");    return; }
    if (key === "rma:us")      { setView("rma-us");      return; }
    setView("rma-entry");
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

        {/* RMA pages only */}
        {view === "rma-tickets" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaTickets />
          </div>
        )}
        {view === "rma-entry" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaEntry />
          </div>
        )}
        {view === "rma-emea" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaStockEmea />
          </div>
        )}
        {view === "rma-us" && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaStockUs />
          </div>
        )}
      </main>
    </div>
  );
}
