// src/components/Sidebar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiChevronRight, FiChevronDown, FiX } from "react-icons/fi";

export default function Sidebar({ onSelect, onLogout, isOpen = false, onClose = () => {} }) {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [ticketsOpen, setTicketsOpen] = useState(!isViewer);
  const [backupOpen, setBackupOpen] = useState(false);
  const [rmaOpen, setRmaOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(!isViewer);

  const navigate = useNavigate();

  async function handleLogout() {
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("zdUser");
    localStorage.removeItem("zdSubdomain");
    localStorage.removeItem("role");
    try { onLogout?.(); } catch {}
    navigate("/login");
  }

  const handleMainTickets   = () => { onSelect("tickets");   onClose(); setTicketsOpen(v => !v);   };
  const handleMainBackup    = () => { onSelect("backup");    onClose(); setBackupOpen(v => !v);    };
  const handleMainRma       = () => { onSelect("rma");       onClose(); setRmaOpen(v => !v);       };
  const handleMainAnalytics = () => { onSelect("analytics"); onClose(); setAnalyticsOpen(v => !v); };
  const go = (key) => { onSelect(key); onClose(); };

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-72 max-w-[80%] bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-out shadow-lg
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:w-64 md:shadow-none
          flex flex-col p-4
        `}
      >
        {/* Mobile header */}
        <div className="mb-4 flex items-center justify-between md:hidden">
          <img src="../src/assets/atomosf.png" alt="atomos Logo" className="h-8" />
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100" aria-label="Close sidebar">
            <FiX />
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden md:flex items-center justify-center mb-4">
          <img src="../src/assets/atomosf.png" alt="atomos Logo" className="h-8" />
        </div>

        <nav className="flex-1 space-y-1">
          {/* 1) Zendesk Tickets (admins only) */}
          {!isViewer && (
            <>
              <button onClick={handleMainTickets} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100">
                <span className="font-medium">Zendesk Tickets</span>
                {ticketsOpen ? <FiChevronDown className="text-black" /> : <FiChevronRight className="text-black" />}
              </button>
              {ticketsOpen && (
                <div className="ml-2 pl-4 border-l border-gray-200 space-y-1 py-1">
                  <button onClick={() => go("tickets:tech-help")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Tech help</button>
                  <button onClick={() => go("tickets:data-recovery")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Data recovery</button>
                  <button onClick={() => go("tickets:warranty-claim")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Warranty claim</button>
                  <button onClick={() => go("tickets:general-support")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">General support</button>
                </div>
              )}
            </>
          )}

          {/* 2) RMA (always visible) — moved right after Zendesk Tickets */}
          <button onClick={handleMainRma} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100">
            <span className="font-medium">RMA</span>
            {rmaOpen ? <FiChevronDown className="text-black" /> : <FiChevronRight className="text-black" />}
          </button>
          {rmaOpen && (
            <div className="ml-2 pl-4 border-l border-gray-200 space-y-1 py-1">
              <button onClick={() => go("rma:entry")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">
                RMA Entry (Lists)
              </button>
              {!isViewer && (
                <>
                  <button onClick={() => go("rma:emea")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">
                    RMA Stock (EMEA)
                  </button>
                  <button onClick={() => go("rma:us")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">
                    RMA Stock (US)
                  </button>
                  <button onClick={() => go("rma:tickets")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">
                    RMA Tickets
                  </button>
                </>
              )}
            </div>
          )}

          {/* 3) Analytics (admins only) */}
          {!isViewer && (
            <>
              <button onClick={handleMainAnalytics} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100">
                <span className="font-medium">Analytics</span>
                {analyticsOpen ? <FiChevronDown className="text-black" /> : <FiChevronRight className="text-black" />}
              </button>
              {analyticsOpen && (
                <div className="ml-2 pl-4 border-l border-gray-200 space-y-1 py-1">
                  <button onClick={() => go("analytics:csat")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Zendesk CSAT Dashboard</button>
                  <button onClick={() => go("analytics:excel")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Excel → Auto Dashboard</button>
                </div>
              )}

              {/* 4) Products / Orders */}
              <button onClick={() => go("products")} className="w-full flex justify-between items-center px-3 py-2 rounded hover:bg-gray-100">
                Products <FiChevronRight className="text-black" />
              </button>
              <button onClick={() => go("orders")} className="w-full flex justify-between items-center px-3 py-2 rounded hover:bg-gray-100">
                Orders <FiChevronRight className="text-black" />
              </button>

              {/* 5) Backup & Restore */}
              <button onClick={handleMainBackup} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100">
                <span className="font-medium">Backup &amp; Restore</span>
                {backupOpen ? <FiChevronDown className="text-black" /> : <FiChevronRight className="text-black" />}
              </button>
              {backupOpen && (
                <div className="ml-2 pl-4 border-l border-gray-200 space-y-1 py-1">
                  <button onClick={() => go("backup:get")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Get backup from Zendesk</button>
                  <button onClick={() => go("backup:restore")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">Restore backup from DB</button>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Logout */}
        <button
          onClick={() => { handleLogout(); onClose(); }}
          className="mt-auto w-full flex justify-between items-center px-3 py-2 rounded bg-black text-white hover:bg-gray-800"
        >
          Logout <FiLogOut className="text-white" />
        </button>
      </div>
    </>
  );
}
