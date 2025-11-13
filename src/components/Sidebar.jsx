// src/components/Sidebar.jsx

import { useNavigate } from "react-router-dom";
import { FiLogOut, FiChevronRight, FiChevronDown, FiX } from "react-icons/fi";
import { useState } from "react";

export default function Sidebar({ onSelect, onLogout, isOpen = false, onClose = () => {} }) {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [rmaOpen, setRmaOpen] = useState(true);
  const [rushOpen, setRushOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    try {
      onLogout?.();
    } catch {}
    navigate("/login");
  }

  const go = (key) => {
    onSelect(key);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200
        transform transition-transform duration-200 shadow-lg
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:w-64 md:shadow-none flex flex-col p-4`}
      >
        {/* Mobile header */}
        <div className="mb-4 flex items-center justify-between md:hidden">
          <img src="../atomosf.png" alt="Logo" className="h-8" />
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100">
            <FiX />
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden md:flex items-center justify-center mb-4">
          <img src="../atomosf.png" alt="Logo" className="h-8" />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-2">

          {/* RMA SECTION */}
          <div>
            <button
              onClick={() => setRmaOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100"
            >
              <span className="font-medium">RMA</span>
              {rmaOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>

            {rmaOpen && (
              <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                <button onClick={() => go("rma:entry")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                  RMA Entry (Lists)
                </button>

                {!isViewer && (
                  <>
                    <button onClick={() => go("rma:emea")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                      RMA Stock (EMEA)
                    </button>
                    <button onClick={() => go("rma:us")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                      RMA Stock (US)
                    </button>
                    <button onClick={() => go("rma:product")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                      RMA Products
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RUSH SECTION */}
          {!isViewer && (
            <div>
              <button
                onClick={() => setRushOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100"
              >
                <span className="font-medium">Rush Order</span>
                {rushOpen ? <FiChevronDown /> : <FiChevronRight />}
              </button>

              {rushOpen && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  <button onClick={() => go("rush:sales")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                    Sales by SourceCode
                  </button>
                  <button onClick={() => go("rush:processed")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                    Processed Orders
                  </button>
                  <button onClick={() => go("rush:inventory")} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
                    Inventory
                  </button>
                </div>
              )}
            </div>
          )}

          {/* REPORTS SECTION */}
          {!isViewer && (
            <div>
              <button
                onClick={() => setReportsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100"
              >
                <span className="font-medium">Reports</span>
                {reportsOpen ? <FiChevronDown /> : <FiChevronRight />}
              </button>

              {reportsOpen && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  <button
                    onClick={() => go("reports:dashboard")}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                  >
                    Reports Dashboard
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Logout */}
        <button
          onClick={() => {
            handleLogout();
            onClose();
          }}
          className="mt-auto w-full flex justify-between items-center px-3 py-2 rounded bg-black text-white hover:bg-gray-800"
        >
          Logout <FiLogOut />
        </button>
      </div>
    </>
  );
}
