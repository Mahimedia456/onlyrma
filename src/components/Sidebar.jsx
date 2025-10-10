import { useNavigate } from "react-router-dom";
import { FiLogOut, FiChevronRight, FiChevronDown, FiX } from "react-icons/fi";
import { useState } from "react";

export default function Sidebar({ onSelect, onLogout, isOpen = false, onClose = () => {} }) {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";
  const [rmaOpen, setRmaOpen] = useState(true);
  const navigate = useNavigate();

  async function handleLogout() {
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    try { onLogout?.(); } catch {}
    navigate("/login");
  }

  const handleMainRma = () => { onSelect("rma"); onClose(); setRmaOpen(v => !v); };
  const go = (key) => { onSelect(key); onClose(); };

  return (
    <>
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
          <img src="../src/assets/atomosf.png" alt="Logo" className="h-8" />
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100" aria-label="Close sidebar">
            <FiX />
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden md:flex items-center justify-center mb-4">
          <img src="../src/assets/atomosf.png" alt="Logo" className="h-8" />
        </div>

        <nav className="flex-1 space-y-1">
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
                 <button onClick={() => go("rma:product")} className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100">
RMA Products
</button>
                </>
              )}
            </div>
          )}
        </nav>

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
