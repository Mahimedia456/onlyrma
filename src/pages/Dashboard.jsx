// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";

import Sidebar from "../components/Sidebar";
import AnalyticsCards from "../components/AnalyticsCards";
import TicketList from "../components/TicketList";
import TicketDetail from "../components/TicketDetail";
import ReadonlyTicketDetail from "../components/ReadonlyTicketDetail";
import ProductsList from "../components/ProductsList";
import OrdersTable from "../components/OrdersTable";
import BackupRestore from "../components/BackupRestore";
import { useAuth } from "@/contexts/AuthContext";

// RMA pages
import RmaTickets from "@/pages/RmaTickets";
import RmaEntry from "@/pages/RmaEntry";
import RmaStockEmea from "@/pages/RmaStockEmea";
import RmaStockUs from "@/pages/RmaStockUs";

// NEW: Analytics pages
import AnalyticsCsat from "@/pages/AnalyticsCsat";
import AnalyticsExcel from "@/pages/AnalyticsExcel";

export default function Dashboard() {
  const role = useMemo(() => (localStorage.getItem("role") || "admin").toLowerCase(), []);
  const isViewer = role === "viewer";

  const [view, setView] = useState(isViewer ? "rma-entry" : "tickets");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketCategory, setTicketCategory] = useState("");
  const [backupMode, setBackupMode] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    if (isViewer && view !== "rma-entry") setView("rma-entry");
  }, [isViewer, view]);

  const enrichTicket = (t) => {
    if (!t) return t;
    const n = Number(String(t.id).slice(-2));
    const statusPool = ["Processing", "Pending", "Shipped"];
    const erpStatus = statusPool[n % statusPool.length];
    return {
      ...t,
      type: t.type ?? "-",
      priority: t.priority ?? "Normal",
      tags: t.tags?.length ? t.tags : ["zendesk_accelerated_setup"],
      messages: t.messages ?? [
        { from: "Customer", time: "Yesterday 19:29", text: "Hello, I need help with my order." },
        { from: "Agent", time: "Today 10:05", text: "Thanks! Could you share your order ID so I can check ERP status?" },
      ],
      erp: t.erp ?? {
        orderId: `ERP-${1000 + (n % 50)}`,
        status: erpStatus,
        customer: {
          name: (t.requester || t.requesterLabel || "").toString().split("@")[0] || "Customer",
          email: t.requester || t.requesterLabel || "customer@example.com",
        },
        items: [
          { sku: "X123", name: "CFexpress™ v4 Type A", qty: (n % 3) + 1 },
          { sku: "Y456", name: "Card Reader CFast 2.0", qty: 1 },
        ],
        totals: { subtotal: "€199.00", shipping: "€10.00", total: "€209.00" },
        shipments: erpStatus === "Shipped" ? [{ id: `SHP-${2100 + (n % 90)}`, carrier: "DHL", tracking: "DHL123456789", eta: "3–5 days" }] : [],
        invoices: [{ id: `INV-${3100 + (n % 120)}`, amount: "€209.00" }],
      },
    };
  };

  const handleSelect = (key) => {
    setSidebarOpen(false);

    if (isViewer) {
      setView("rma-entry");
      setSelectedTicket(null);
      setTicketCategory("");
      setBackupMode("");
      return;
    }

    // Tickets (main or by category)
    if (key.startsWith("tickets:")) {
      const cat = key.split(":")[1] || "";
      setView("tickets");
      setTicketCategory(cat);
      setSelectedTicket(null);
      setBackupMode("");
      return;
    }
    if (key === "tickets") {
      setView("tickets");
      setTicketCategory("");
      setSelectedTicket(null);
      setBackupMode("");
      return;
    }

    // Backup
    if (key.startsWith("backup:")) {
      const mode = key.split(":")[1];
      setView("backup");
      setBackupMode(mode);
      setSelectedTicket(null);
      setTicketCategory("");
      return;
    }
    if (key === "backup") {
      setView("backup");
      setBackupMode("");
      setSelectedTicket(null);
      setTicketCategory("");
      return;
    }

    // RMA
    if (key === "rma:tickets") { setView("rma-tickets"); return; }
    if (key === "rma:entry")   { setView("rma-entry");   return; }
    if (key === "rma:emea")    { setView("rma-emea");    return; }
    if (key === "rma:us")      { setView("rma-us");      return; }

    // NEW: Analytics
    if (key === "analytics:csat")  { setView("analytics-csat");  return; }
    if (key === "analytics:excel") { setView("analytics-excel"); return; }

    // Fallback
    setView(key);
    setSelectedTicket(null);
    setTicketCategory("");
    setBackupMode("");
  };

  const openEditableTicket = (t) => {
    setSelectedTicket(enrichTicket(t));
    setView("tickets");
  };
  const openReadonlyTicket = (t) => {
    setSelectedTicket(enrichTicket(t));
    setView("readonly-ticket");
  };
  const backToBackupRestore = () => {
    setView("backup");
    setBackupMode("restore");
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

        {/* Viewer: only RMA Entry (Lists) */}
        {isViewer ? (
          <div className="bg-white rounded-lg shadow-md p-4">
            <RmaEntry mode="viewer" />
          </div>
        ) : (
          <>
            {/* Tickets list + Analytics cards */}
            {view === "tickets" && !selectedTicket && (
              <div className="space-y-4">
                <AnalyticsCards />
                <div className="bg-white rounded-lg shadow-md">
                  <TicketList
                    category={ticketCategory}
                    onSelectTicket={openEditableTicket}
                    onSelectTicketReadonly={openReadonlyTicket}
                  />
                </div>
              </div>
            )}

            {/* Ticket detail (editable) */}
            {view === "tickets" && selectedTicket && (
              <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />
            )}

            {/* Products */}
            {view === "products" && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <ProductsList />
              </div>
            )}

            {/* Orders */}
            {view === "orders" && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <OrdersTable />
              </div>
            )}

            {/* Backup & Restore */}
            {view === "backup" && (
              <BackupRestore mode={backupMode} onView={openReadonlyTicket} />
            )}

            {/* Ticket detail (readonly) */}
            {view === "readonly-ticket" && selectedTicket && (
              <ReadonlyTicketDetail ticket={selectedTicket} onBack={backToBackupRestore} />
            )}

            {/* RMA pages */}
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

            {/* NEW: Analytics pages */}
            {view === "analytics-csat" && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <AnalyticsCsat />
              </div>
            )}
            {view === "analytics-excel" && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <AnalyticsExcel />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
