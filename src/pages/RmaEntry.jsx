// src/pages/RmaEntry.jsx
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["product-fault", "warranty", "out-of-warranty", "other"];
const ORGS = ["US", "EMEA"];

const DEVICE_NAMES = [
  "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
  "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
  "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
  "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
];

// Product SKU catalog
const PRODUCT_SKUS = [
  { name: "Shinobi II", code: "ATOMSHB003" },
  { name: "Shinobi HDMI", code: "ATOMSHBH01" },
  { name: "Shinobi SDI", code: "ATOMSHBS01" },
  { name: "Shinobi 7", code: "ATOMSHB002" },
  { name: "Ninja V", code: "ATOMNJAV01" },
  { name: "Ninja V Plus", code: "ATOMNJVPL1" },
  { name: "Ninja (new)", code: "ATOMNJA004" },
  { name: "Ninja Ultra", code: "ATOMNJAU01" },
  { name: "Ninja Phone", code: "ATOMNJPB01" },
  { name: "Ninja Flame", code: "ATOMNJAFL2" },
  { name: "Ninja Inferno", code: "ATOMNJAIN1" },
  { name: "Ninja Blade", code: "ATOMNJB001" },
  { name: "Shogun Connect", code: "ATOMSHGCO1" },
  { name: "Shogun (new)", code: "ATOMSHG002" },
  { name: "Shogun Ultra", code: "ATOMSHGU01" },
  { name: "Shogun Classic", code: "ATOMSHG701" }, // duplicate code with Shogun 7
  { name: "Shogun 7", code: "ATOMSHG701" },
  { name: "Shogun Inferno", code: "ATOMSHGIN2" },
  { name: "Shogun Flame", code: "ATOMSHGFL1" },
  { name: "Shogun", code: "ATOMSHG001" },
  { name: "Shogun Studio", code: "ATOMSHSTU01" },
  { name: "Shogun Studio 2", code: "ATOMSHSTU2" },
  { name: "Sumo 19SE", code: "ATOMSUMSE1" },
  { name: "Sumo 19", code: "ATOMSUMO19" },
  { name: "Sumo 19M", code: "ATOMSUMO19M" },
  { name: "Samurai Blade", code: "ATOMSAM002" },
  { name: "Zato Connect", code: "ATOMZATC01" },
  { name: "Battery Eliminator", code: "ATOMDCA001" },
  { name: "AtomX Battery", code: "ATOMBAT003" },
  { name: "Docking Station", code: "ATOMDCK004" },
  { name: "AtomFlex HDMI locking", code: "ATOM4K60L1" },
  { name: "AtomFlex HDMI", code: "ATOM4K60C1" },
  { name: "AtomFlex HDMI", code: "ATOMCAB010" },
  { name: "AtomFlex HDMI", code: "ATOM4K60C2" },
  { name: "AtomFlex HDMI", code: "ATOMCAB015" },
  { name: "AtomFlex HDMI", code: "ATOM4K60C5" },
  { name: "AtomFlex HDMI", code: "ATOMCAB007" },
  { name: "AtomFlex HDMI", code: "ATOMCAB013" },
  { name: "UltraSync One", code: "ATOMSYON01" },
  { name: "Power Kit 2", code: "ATOMXPWKT2" },
  { name: "DC to Dtap cable", code: "ATOMDTPCB2" },
  { name: "AtomX Cast", code: "ATOMXCST01" },
  { name: "Accessory Kit Version II", code: "ATOMACCKT4" },
  { name: "Atomos Connect", code: "ATOMCON003" },
  { name: "AtomX fast charger", code: "ATOMFCGRS2" },
  { name: "UltraSync Blue (ROW)", code: "ATOMSYBL1" },
  { name: "AtomX Sync Module", code: "ATOMXSYNC1" },
].filter(Boolean);

// de-duplicate by code (keep first name that appears)
const SKU_BY_CODE = PRODUCT_SKUS.reduce((m, p) => m.set(p.code, m.get(p.code) || p.name), new Map());
// quick lookup name -> first code
const CODE_BY_NAME = PRODUCT_SKUS.reduce((m, p) => m.set(p.name.toLowerCase(), m.get(p.name.toLowerCase()) || p.code), new Map());

const STOCK_TYPES_US = [
  "D Stock Received","B-Stock Received","New Stock Sent","RMA/ B-Stock R-Stock Sent",
  "A Stock - Received","Awaiting Delivery from User","Receive Only","Awaiting Return from Rush",
];
const STOCK_TYPES_EMEA = [
  "D Stock - Received","B-stock Received","New Stock Sent","RMA/ B-Stock R-Stock Sent",
  "Awaiting Delivery from User","Receiving Only","Awaiting Return from Rush",
];

/** Ensure date is "YYYY-MM-DD" for <input type="date"> */
function fmtDate(v) {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const onlyDate = v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) return onlyDate;
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return "";
}

export default function RmaEntry() {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [tab, setTab] = useState("lists");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 space-y-4">
      <div className="inline-flex rounded-xl border overflow-hidden">
        <TabButton active={tab === "lists"} onClick={() => setTab("lists")}>RMA Lists</TabButton>
        {!isViewer && (
          <TabButton active={tab === "new"} onClick={() => setTab("new")}>New RMA Entry</TabButton>
        )}
      </div>

      {tab === "lists" ? (
        <RmaLists refreshKey={refreshKey} />
      ) : (
        <RmaForm
          onSaved={() => {
            setRefreshKey((x) => x + 1);
            setTab("lists");
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 ${active ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

/* ========================= RMA Lists (local DB) ========================= */
function RmaLists({ refreshKey }) {
  const API = import.meta.env.VITE_API_BASE || "";
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  const isViewer = role === "viewer";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ month: "", category: "" });
  const [editRow, setEditRow] = useState(null);

  // fetch list
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          month: filters.month || "",
          category: filters.category || "",
        });
        const res = await fetch(`${API}/api/rma/entries?${qs.toString()}`, { credentials: "include" });
        const data = await res.json();
        setRows(data?.entries || []);
      } catch (e) {
        console.error("entries fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, filters.month, filters.category, refreshKey]);

  // group for month tiles
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const d = new Date(r.entry_date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym).push(r);
    }
    return m;
  }, [rows]);

  function exportCSV() {
    if (!rows.length) return alert("No rows to export.");
    const cols = [
      "id","entry_date","rma_no","ticket_id","first_name","last_name","email","phone","company",
      "reseller_customer","address1","address2","city","state","country","postcode",
      "product_with_fault","serial_number","product_sku","device_name",
      "category","rma_type","stock_type","quantity","returned_reason","action",
      "custom_tracking","replacement_tracking","created_at","updated_at"
    ];
    const header = cols.join(",");
    const lines = rows.map(r => cols.map(c => csvEscape(r[c])).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const name = `RMA_Entries_${filters.month || "all"}.csv`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  async function remove(id) {
    if (!confirm("Delete this RMA entry?")) return;
    const res = await fetch(`${API}/api/rma/entries/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Delete failed");
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function saveEdit(id, patch) {
    const toSend = { ...patch, entry_date: fmtDate(patch.entry_date) || null };
    const res = await fetch(`${API}/api/rma/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(toSend),
    });
    if (!res.ok) return alert("Update failed");
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...toSend } : r)));
    setEditRow(null);
  }

  return (
    <div className="space-y-4">
      {/* Filters / export */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs mb-1">Month</label>
          <input
            type="month"
            className="border rounded px-3 py-2"
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs mb-1">RMA Category</label>
          <select
            className="border rounded px-3 py-2"
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={exportCSV} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800" disabled={loading}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Month tiles */}
      <div className="grid md:grid-cols-3 gap-3">
        {[...grouped.keys()].sort().map((ym) => {
          const list = grouped.get(ym) || [];
          const [y, m] = ym.split("-");
          const label = new Date(Number(y), Number(m) - 1).toLocaleString(undefined, { month: "long", year: "numeric" });
          return (
            <button
              key={ym}
              onClick={() => setFilters((f) => ({ ...f, month: ym }))}
              className="text-left rounded-xl border p-4 hover:bg-gray-50"
            >
              <div className="text-sm text-gray-500">{label}</div>
              <div className="text-2xl font-semibold">{list.length} RMAs</div>
            </button>
          );
        })}
      </div>

      {/* Full table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-[1400px] max-w-none text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>Entry Date</Th>
              <Th>RMA No</Th>
              <Th>Ticket ID</Th>
              <Th>First</Th>
              <Th>Last</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Company</Th>
              <Th>Reseller/Customer</Th>
              <Th>Address1</Th>
              <Th>Address2</Th>
              <Th>City</Th>
              <Th>State</Th>
              <Th>Country</Th>
              <Th>Postcode</Th>
              <Th>Product w/ Fault</Th>
              <Th>Serial</Th>
              <Th>Product SKU</Th>
              <Th>Device</Th>
              <Th>Category</Th>
              <Th>RMA Type</Th>
              <Th>Stock Type</Th>
              <Th>Qty</Th>
              <Th>Returned Reason</Th>
              <Th>Action</Th>
              <Th>Custom Tracking</Th>
              <Th>Replacement Tracking</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={29} className="p-6 text-center">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={29} className="p-6 text-center">No entries</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <Td>{i + 1}</Td>
                <Td>{r.entry_date ? new Date(r.entry_date).toLocaleDateString() : "-"}</Td>
                <Td>{r.rma_no || "-"}</Td>
                <Td>{r.ticket_id || "-"}</Td>
                <Td>{r.first_name || "-"}</Td>
                <Td>{r.last_name || "-"}</Td>
                <Td>{r.email || "-"}</Td>
                <Td>{r.phone || "-"}</Td>
                <Td>{r.company || "-"}</Td>
                <Td>{r.reseller_customer || "-"}</Td>
                <Td>{r.address1 || "-"}</Td>
                <Td>{r.address2 || "-"}</Td>
                <Td>{r.city || "-"}</Td>
                <Td>{r.state || "-"}</Td>
                <Td>{r.country || "-"}</Td>
                <Td>{r.postcode || "-"}</Td>
                <Td>{r.product_with_fault || "-"}</Td>
                <Td>{r.serial_number || "-"}</Td>
                <Td>{r.product_sku || "-"}</Td>
                <Td>{r.device_name || "-"}</Td>
                <Td>{r.category || "-"}</Td>
                <Td>{r.rma_type || "-"}</Td>
                <Td>{r.stock_type || "-"}</Td>
                <Td>{r.quantity ?? 0}</Td>
                <Td>{r.returned_reason || "-"}</Td>
                <Td>{r.action || "-"}</Td>
                <Td>{r.custom_tracking || "-"}</Td>
                <Td>{r.replacement_tracking || "-"}</Td>
                <Td>
                  <div className="flex gap-3">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => setEditRow(r)}
                    >
                      View / Edit
                    </button>
                    {!(localStorage.getItem("role") || "admin").toLowerCase().includes("viewer") && (
                      <button className="text-red-600 hover:underline" onClick={() => remove(r.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow && (
        <EditModal
          initial={editRow}
          readOnly={false}
          onClose={() => setEditRow(null)}
          onSave={(patch) => saveEdit(editRow.id, patch)}
        />
      )}
    </div>
  );
}

/* ========================= New RMA Entry ========================= */
function RmaForm({ onSaved }) {
  const [org, setOrg] = useState("EMEA");
  const [skuQuery, setSkuQuery] = useState(""); // used only for quick search
  const API = import.meta.env.VITE_API_BASE || "";

  const [form, setForm] = useState({
    entry_date: fmtDate(new Date()),
    ticket_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    reseller_customer: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    postcode: "",
    product_with_fault: "",
    serial_number: "",
    product_sku: "",
    device_name: "",
    rma_type: "",
    stock_type: "",
    quantity: 1,
    returned_reason: "",
    action: "",
    custom_tracking: "",
    rma_no: "",
    replacement_tracking: "",
    category: "",
    organization: "EMEA",
  });

  // keep organization mirror
  useEffect(() => setForm((f) => ({ ...f, organization: org })), [org]);

  // when product_sku changes, auto-fill product_with_fault
  useEffect(() => {
    if (!form.product_sku) return;
    const name = SKU_BY_CODE.get(form.product_sku) || "";
    setForm((f) => ({ ...f, product_with_fault: name || f.product_with_fault }));
  }, [form.product_sku]);

  const stockOptions = org === "US" ? STOCK_TYPES_US : STOCK_TYPES_EMEA;

  // parse skuQuery on blur/Enter into form.product_sku
  function commitSkuFromQuery() {
    const raw = skuQuery.trim();
    if (!raw) return;
    // accept either "Name — CODE" or just CODE or just Name
    const codeMatch = raw.split("—").pop().trim();
    let code = "";
    if (SKU_BY_CODE.has(codeMatch)) code = codeMatch;
    else if (CODE_BY_NAME.has(raw.toLowerCase())) code = CODE_BY_NAME.get(raw.toLowerCase());
    if (code) {
      const name = SKU_BY_CODE.get(code) || "";
      setForm((f) => ({ ...f, product_sku: code, product_with_fault: name || f.product_with_fault }));
      setSkuQuery(`${name} — ${code}`);
    }
  }

  const update = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === "quantity" ? Number(e.target.value || 0) : e.target.value }));

  async function save() {
    if (!form.entry_date) return alert("Entry date is required");
    if (!form.device_name && !form.product_sku) return alert("Choose Device Name or Product SKU");

    // ensure name is filled if SKU chosen
    const nameFromSku = form.product_sku ? (SKU_BY_CODE.get(form.product_sku) || "") : "";
    const payload = {
      ...form,
      product_with_fault: form.product_with_fault || nameFromSku || "",
      entry_date: fmtDate(form.entry_date),
    };

    const res = await fetch(`${API}/api/rma/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert("Saved");
      onSaved?.();
    } else {
      const err = await safeJson(res);
      alert(`Save failed: ${err?.error || res.statusText}`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-3 flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-gray-600 mb-1">Organization</div>
          <select value={org} onChange={(e) => setOrg(e.target.value)} className="border rounded px-3 py-2">
            {ORGS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">Stock Type (by org)</div>
          <select value={form.stock_type} onChange={update("stock_type")} className="border rounded px-3 py-2">
            <option value="">Select…</option>
            {stockOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">RMA Type</div>
          <select value={form.rma_type} onChange={update("rma_type")} className="border rounded px-3 py-2">
            <option value="">Select…</option>
            <option value="Warranty">Warranty</option>
            <option value="Out of Warranty">Out of Warranty</option>
            <option value="Advance Replacement">Advance Replacement</option>
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">Quantity</div>
          <input type="number" className="border rounded px-3 py-2 w-28" value={form.quantity} onChange={update("quantity")} min={1} />
        </div>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {renderRow("Sno", "(auto)")}
            {renderInput("Entry date", "entry_date", fmtDate(form.entry_date), "date", update)}
            {renderInput("Ticket ID", "ticket_id", form.ticket_id, "text", update)}

            <Section label="Customer">
              {renderInput("First Name", "first_name", form.first_name, "text", update)}
              {renderInput("Last Name", "last_name", form.last_name, "text", update)}
              {renderInput("Email", "email", form.email, "email", update)}
              {renderInput("Phone", "phone", form.phone, "text", update)}
              {renderInput("Company", "company", form.company, "text", update)}
              {renderInput("Reseller / Customer", "reseller_customer", form.reseller_customer, "text", update)}
              {renderInput("Address 1", "address1", form.address1, "text", update)}
              {renderInput("Address 2", "address2", form.address2, "text", update)}
              {renderInput("City", "city", form.city, "text", update)}
              {renderInput("State", "state", form.state, "text", update)}
              {renderInput("Country", "country", form.country, "text", update)}
              {renderInput("Postcode", "postcode", form.postcode, "text", update)}
            </Section>

            <Section label="Product">
              {/* Device Name */}
              <tr>
                <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">Device Name</th>
                <td className="px-3 py-2">
                  <select className="border rounded px-3 py-2 w-full" value={form.device_name} onChange={update("device_name")}>
                    <option value="">Select…</option>
                    {DEVICE_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
              </tr>

              {/* Product SKU (select) with optional quick search */}
              <tr>
                <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">Product SKU</th>
                <td className="px-3 py-2 space-y-2">
                  {/* quick search box */}
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Type name or code, then Enter or blur to apply…"
                    value={skuQuery}
                    onChange={(e) => setSkuQuery(e.target.value)}
                    onBlur={commitSkuFromQuery}
                    onKeyDown={(e) => { if (e.key === "Enter") commitSkuFromQuery(); }}
                    list="sku-list"
                  />
                  <datalist id="sku-list">
                    {PRODUCT_SKUS.slice(0, 200).map((p) => (
                      <option key={`${p.code}-${p.name}`} value={`${p.name} — ${p.code}`} />
                    ))}
                  </datalist>

                  {/* authoritative select that writes to form.product_sku */}
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={form.product_sku}
                    onChange={(e) => {
                      const code = e.target.value;
                      const name = SKU_BY_CODE.get(code) || "";
                      setForm((f) => ({ ...f, product_sku: code, product_with_fault: f.product_with_fault || name }));
                      setSkuQuery(name ? `${name} — ${code}` : code);
                    }}
                  >
                    <option value="">Select SKU…</option>
                    {Array.from(SKU_BY_CODE.entries()).map(([code, name]) => (
                      <option key={code} value={code}>{name} — {code}</option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* auto-fills from SKU if empty, but remains editable */}
              {renderInput("Product with fault", "product_with_fault", form.product_with_fault, "text", update)}
              {renderInput("Serial Number", "serial_number", form.serial_number, "text", update)}
              {renderSelect("Category", "category", form.category, CATEGORIES, update)}
            </Section>

            <Section label="Case Details">
              {renderInput("Returned Reason", "returned_reason", form.returned_reason, "text", update)}
              {renderInput("Action", "action", form.action, "text", update)}
            </Section>

            <Section label="Tracking">
              {renderInput("Custom Tracking", "custom_tracking", form.custom_tracking, "text", update)}
              {renderInput("RMA No", "rma_no", form.rma_no, "text", update)}
              {renderInput("Replacement Tracking", "replacement_tracking", form.replacement_tracking, "text", update)}
            </Section>
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800">Save</button>
        <button onClick={() => console.log(form)} className="px-4 py-2 rounded border">Preview JSON</button>
      </div>
    </div>
  );
}

/* ========================= Edit Modal ========================= */
function EditModal({ initial, onClose, onSave, readOnly = false }) {
  const [form, setForm] = useState(buildForm(initial));

  useEffect(() => { setForm(buildForm(initial)); }, [initial]);

  // keep name synced when SKU changes
  useEffect(() => {
    if (!form.product_sku) return;
    const name = SKU_BY_CODE.get(form.product_sku) || "";
    setForm((f) => ({ ...f, product_with_fault: f.product_with_fault || name }));
  }, [form.product_sku]);

  const update = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === "quantity" ? Number(e.target.value || 0) : e.target.value }));

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {readOnly ? "View RMA Entry" : "View / Edit RMA Entry"} #{initial.id}
            </h3>
            <div className="text-xs text-gray-500">
              {fullName || "—"} {form.entry_date ? `• ${fmtDate(form.entry_date)}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
          {input("Entry date", "entry_date", form.entry_date, update, "date", readOnly)}
          {input("Ticket ID", "ticket_id", form.ticket_id, update, "text", readOnly)}

          {input("First Name", "first_name", form.first_name, update, "text", readOnly)}
          {input("Last Name", "last_name", form.last_name, update, "text", readOnly)}
          {input("Email", "email", form.email, update, "email", readOnly)}
          {input("Phone", "phone", form.phone, update, "text", readOnly)}
          {input("Company", "company", form.company, update, "text", readOnly)}
          {input("Reseller/Customer", "reseller_customer", form.reseller_customer, update, "text", readOnly)}
          {input("Address1", "address1", form.address1, update, "text", readOnly)}
          {input("Address2", "address2", form.address2, update, "text", readOnly)}
          {input("City", "city", form.city, update, "text", readOnly)}
          {input("State", "state", form.state, update, "text", readOnly)}
          {input("Country", "country", form.country, update, "text", readOnly)}
          {input("Postcode", "postcode", form.postcode, update, "text", readOnly)}

          {/* Product fields */}
          <label className="block">
            <div className="text-xs text-gray-600 mb-1">Product SKU</div>
            <select
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              value={form.product_sku}
              onChange={(e) => {
                const code = e.target.value;
                const name = SKU_BY_CODE.get(code) || "";
                setForm((f) => ({ ...f, product_sku: code, product_with_fault: f.product_with_fault || name }));
              }}
              disabled={readOnly}
            >
              <option value="">Select SKU…</option>
              {Array.from(SKU_BY_CODE.entries()).map(([code, name]) => (
                <option key={code} value={code}>{name} — {code}</option>
              ))}
            </select>
          </label>

          {input("Product w/ Fault", "product_with_fault", form.product_with_fault, update, "text", readOnly)}
          {input("Serial Number", "serial_number", form.serial_number, update, "text", readOnly)}
          {input("Device Name", "device_name", form.device_name, update, "text", readOnly)}
          {select("Category", "category", form.category, CATEGORIES, update, readOnly)}

          {select("RMA Type", "rma_type", form.rma_type, ["Warranty","Out of Warranty","Advance Replacement"], update, readOnly)}
          {input("Stock Type", "stock_type", form.stock_type, update, "text", readOnly)}
          {input("Quantity", "quantity", form.quantity, update, "number", readOnly)}

          {input("Returned Reason", "returned_reason", form.returned_reason, update, "text", readOnly)}
          {input("Action", "action", form.action, update, "text", readOnly)}

          {/* Tracking */}
          {input("Custom Tracking", "custom_tracking", form.custom_tracking, update, "text", readOnly)}
          {input("RMA No", "rma_no", form.rma_no, update, "text", readOnly)}
          {input("Replacement Tracking", "replacement_tracking", form.replacement_tracking, update, "text", readOnly)}
        </div>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
            <button
              onClick={() =>
                onSave({
                  ...form,
                  // if SKU exists but name empty, auto-fill
                  product_with_fault: form.product_with_fault || (SKU_BY_CODE.get(form.product_sku) || ""),
                  entry_date: fmtDate(form.entry_date),
                  updated_at: new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildForm(initial) {
  return {
    entry_date: fmtDate(initial.entry_date),
    ticket_id: initial.ticket_id || "",
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    company: initial.company || "",
    reseller_customer: initial.reseller_customer || "",
    address1: initial.address1 || "",
    address2: initial.address2 || "",
    city: initial.city || "",
    state: initial.state || "",
    country: initial.country || "",
    postcode: initial.postcode || "",
    product_with_fault: initial.product_with_fault || "",
    serial_number: initial.serial_number || "",
    product_sku: initial.product_sku || "",
    device_name: initial.device_name || "",
    rma_type: initial.rma_type || "",
    stock_type: initial.stock_type || "",
    quantity: initial.quantity ?? 1,
    returned_reason: initial.returned_reason || "",
    action: initial.action || "",
    custom_tracking: initial.custom_tracking || "",
    rma_no: initial.rma_no || "",
    replacement_tracking: initial.replacement_tracking || "",
    category: initial.category || "",
  };
}

/* ---------- small helpers ---------- */
function Section({ label, children }) {
  return (
    <>
      <tr>
        <td colSpan={2} className="bg-gray-100 px-3 py-2 font-semibold">{label}</td>
      </tr>
      {children}
    </>
  );
}

function renderRow(label, value) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">{label}</th>
      <td className="px-3 py-2">{value}</td>
    </tr>
  );
}
function renderInput(label, key, value, type, update) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">{label}</th>
      <td className="px-3 py-2">
        <input
          type={type}
          className="border rounded px-3 py-2 w-full"
          value={type === "date" ? fmtDate(value) : value}
          onChange={update(key)}
        />
      </td>
    </tr>
  );
}
function renderSelect(label, key, value, options, update) {
  return (
    <tr>
      <th className="w-56 text-left bg-gray-50 px-3 py-2 font-medium">{label}</th>
      <td className="px-3 py-2">
        <select className="border rounded px-3 py-2 w-full" value={value} onChange={update(key)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
    </tr>
  );
}
const Th = ({ children }) => <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>;
const Td = ({ children }) => <td className="px-3 py-2">{children}</td>;

function input(label, key, value, update, type = "text", readOnly = false) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
        value={type === "date" ? fmtDate(value) : value}
        onChange={update(key)}
        disabled={readOnly}
      />
    </label>
  );
}

function select(label, key, value, options, update, readOnly = false) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <select
        className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
        value={value}
        onChange={update(key)}
        disabled={readOnly}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
