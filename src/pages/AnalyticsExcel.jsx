// src/pages/AnalyticsExcel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, AreaChart, Area,
} from "recharts";

/* ===================== Constants ===================== */
const PALETTES = {
  bright: ["#2563eb","#16a34a","#f97316","#dc2626","#7c3aed","#0891b2","#f43f5e","#22c55e","#0ea5e9","#f59e0b"],
  pastel: ["#60a5fa","#86efac","#fca5a5","#fcd34d","#c4b5fd","#a5f3fc","#93c5fd","#fda4af","#fde68a","#d8b4fe"],
  night:  ["#111827","#1f2937","#374151","#2563eb","#14b8a6","#a78bfa","#f59e0b","#ef4444","#22c55e","#0ea5e9"],
};
const CHART_TYPES = ["donut", "rose", "radial", "bar-v", "bar-h"];
const SIZES = { compact: 280, medium: 360, roomy: 440 };

/* ===================== Helpers ===================== */
function fmt(n){ if(n==null||isNaN(n)) return "0"; return Intl.NumberFormat().format(Number(n)); }
function wrap(s,n=22){ if(!s) return ""; return s.length<=n?s:s.slice(0,n-1)+"…"; }
function toNum(v){ if(typeof v==="number") return isFinite(v)?v:0; if(typeof v!=="string") return 0; const s=v.replace(/[, %]/g,""); const n=Number(s); return isFinite(n)?n:0; }
function sliceLabel(total){ return (entry)=>{ const pct=(entry?.value/(total||1))*100; return pct>=4?`${wrap(entry.name,14)} (${pct.toFixed(0)}%)`:""; }; }
function detectColumn(cols, patterns, fallback = "") {
  if (!cols || !cols.length) return fallback;
  const tryList = Array.isArray(patterns) ? patterns : [patterns];
  for (const p of tryList) {
    const re = new RegExp(p, "i");
    const hit = cols.find(c => re.test(String(c)));
    if (hit) return hit;
  }
  return fallback || cols[0] || "";
}

/* build a best-effort mapping for a sheet */
function buildGuessForSheet(sheet) {
  const cols = sheet?.headers || [];
  const guess = {
    labelKey: detectColumn(cols, ["ticket.?id|id|subject|title|name|label"], cols[0] || ""),
    statusKey: detectColumn(cols, ["status$|ticket.?status"]),
    satKey: detectColumn(cols, ["satisfaction|csat|good|bad|rating"]),
    assigneeKey: detectColumn(cols, ["assignee|assigned|agent|owner"]),
    firstRespMinKey: detectColumn(cols, ["first.?response.*min|first.?reply.*min|response time.*min","first response time \\(min\\)"]),
  };
  return guess;
}

/* aggregate a sheet by label using measure */
function buildAggregates({ rows, labelKey, measure, numericKey, search }) {
  const filterText = (search || "").trim().toLowerCase();
  const M = new Map();
  for (const r of rows) {
    const name = String(r[labelKey] ?? "").trim();
    if (!name) continue;
    if (filterText && !name.toLowerCase().includes(filterText)) continue;
    if (measure === "count") {
      M.set(name, (M.get(name) ?? 0) + 1);
    } else {
      const v = toNum(r[numericKey]);
      M.set(name, (M.get(name) ?? 0) + v);
    }
  }
  let data = [...M.entries()].map(([name, value]) => ({ name, value }));
  const total = data.reduce((t, d) => t + d.value, 0);
  data.sort((a,b)=>b.value-a.value);
  return { list: data, total, rowsCount: rows.length, distinct: data.length };
}

/* ===================== Component ===================== */
export default function AnalyticsExcel() {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState([]);                      // [{ name, rows, headers }]
  const [sheetIx, setSheetIx] = useState(0);                     // current sheet index

  const [paletteKey, setPaletteKey] = useState("bright");
  const [globalSize, setGlobalSize] = useState("medium");

  const [mappingBySheet, setMappingBySheet] = useState({});      // { [name]: {labelKey,statusKey,satKey,assigneeKey,firstRespMinKey} }
  const [lockMapping, setLockMapping] = useState(false);

  const [controlsBySheet, setControlsBySheet] = useState({});    // chart controls per sheet
  const [generated, setGenerated] = useState({});                // generated flags + snapshots

  /* comparison */
  const [compareSheets, setCompareSheets] = useState([]);        // selected sheet names for comparison (2–5)
  const [compareMeasure, setCompareMeasure] = useState("count");
  const [compareTopN, setCompareTopN] = useState(10);

  const CH = SIZES[globalSize] || 360;
  const COLORS = PALETTES[paletteKey] || PALETTES.bright;

  /* ---------- Load file ---------- */
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const out = [];
      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })?.[0] || [];
        out.push({ name, rows, headers });
      });
      setSheets(out);
      setSheetIx(0);
      /* seed mapping + controls per sheet */
      const map = {};
      const ctr = {};
      out.forEach(s => {
        map[s.name] = buildGuessForSheet(s);
        ctr[s.name] = { chartType: "donut", measure: "count", topN: 20, minPct: 0, sortDir: "desc", search: "", barOrientation: "h", showValues: false };
      });
      setMappingBySheet(map);
      setControlsBySheet(ctr);
      setGenerated({});
      setCompareSheets([]);
    };
    reader.readAsArrayBuffer(f);
  }

  /* ---------- React to sheet change / lock mapping ---------- */
  useEffect(() => {
    if (!sheets.length) return;
    const s = sheets[sheetIx];
    if (!s) return;
    setMappingBySheet(prev => {
      if (lockMapping) {
        const first = sheets[0]?.name;
        if (first && prev[first]) return { ...prev, [s.name]: { ...prev[first] } };
      }
      if (prev[s.name]) return prev;
      return { ...prev, [s.name]: buildGuessForSheet(s) };
    });
  }, [sheetIx, sheets, lockMapping]);

  /* ---------- Current sheet derived ---------- */
  const theSheet = sheets[sheetIx];
  const cols = theSheet?.headers || [];
  const curMap = theSheet ? (mappingBySheet[theSheet.name] || {}) : {};
  const curCtl = theSheet ? (controlsBySheet[theSheet.name] || {}) : {};

  /* ---------- Build per-sheet data when generated ---------- */
  const built = useMemo(() => {
    if (!theSheet || !generated[theSheet.name]) return null;
    const numericKey = findNumericKey(theSheet, curMap, curCtl.measure);
    return buildForView(theSheet, curMap, curCtl, numericKey);
  }, [theSheet, curMap, curCtl, generated]);

  function findNumericKey(sheet, map, measure) {
    if (measure === "sum") {
      const guess = sheet.headers.find(h => sheet.rows.some(r => toNum(r[h]) !== 0));
      return guess || "";
    }
    return ""; // not needed for count
  }

  function buildForView(sheet, map, ctl, numericKey) {
    const agg = buildAggregates({
      rows: sheet.rows,
      labelKey: map.labelKey || sheet.headers[0],
      measure: ctl.measure,
      numericKey,
      search: ctl.search,
    });
    /* topN + min% grouping */
    const total = agg.total || 1;
    const minVal = (ctl.minPct / 100) * total;
    const baseTop = (ctl.topN && ctl.topN > 0 ? agg.list.slice(0, ctl.topN) : agg.list).filter(d => d.value >= minVal);
    const tail = agg.list.filter(d => !baseTop.includes(d));
    const tailSum = tail.reduce((t, d) => t + d.value, 0);
    const list = tailSum > 0 ? [...baseTop, { name: "Other", value: tailSum, _other: true, children: tail }] : baseTop;
    return { list, full: agg.list, total: agg.total, rowsCount: agg.rowsCount, distinct: agg.distinct };
  }

  /* ---------- Generate / Regenerate ---------- */
  function generate() {
    if (!theSheet) return;
    if (curCtl.measure === "sum") {
      const key = findNumericKey(theSheet, curMap, curCtl.measure);
      if (!key) { alert("No numeric column detected for SUM on this sheet."); return; }
    }
    setGenerated(m => ({ ...m, [theSheet.name]: true }));
  }
  function regenerate() { if (theSheet) setGenerated(m => ({ ...m, [theSheet.name]: true })); }
  function clearGen() { if (theSheet) setGenerated(m => { const { [theSheet.name]:_, ...rest } = m; return rest; }); }

  /* ---------- Export PDF (multi-page) ---------- */
  async function exportPdf() {
    const node = document.querySelector("#excel-capture-root");
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#fff", useCORS: true });
    const pdf = new jsPDF("p","pt","a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW - 40;
    const imgH = (canvas.height * imgW) / canvas.width;

    let yPos = 0;
    const sliceH = Math.floor((canvas.width * (pageH - 40)) / imgW);
    let first = true;

    while (yPos < canvas.height) {
      const h = Math.min(sliceH, canvas.height - yPos);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext("2d").drawImage(canvas, 0, yPos, canvas.width, h, 0, 0, canvas.width, h);
      const img = slice.toDataURL("image/png");
      if (!first) pdf.addPage();
      pdf.addImage(img, "PNG", 20, 20, imgW, (h * imgW) / canvas.width);
      yPos += h;
      first = false;
    }
    pdf.save(fileName ? fileName.replace(/\.[^.]+$/, "") + "_dashboard.pdf" : "dashboard.pdf");
  }

  /* ---------- Comparison Mode data ---------- */
  const compareData = useMemo(() => {
    if (!compareSheets.length) return null;
    if (compareSheets.length < 2 || compareSheets.length > 5) return null;

    // Build per sheet aggregation
    const per = compareSheets.map(name => {
      const s = sheets.find(x => x.name === name);
      if (!s) return null;
      const map = mappingBySheet[name] || buildGuessForSheet(s);
      const numericKey = compareMeasure === "sum"
        ? (s.headers.find(h => s.rows.some(r => toNum(r[h]) !== 0)) || "")
        : "";
      const agg = buildAggregates({ rows: s.rows, labelKey: map.labelKey || s.headers[0], measure: compareMeasure, numericKey });
      return { name, agg };
    }).filter(Boolean);

    if (!per.length) return null;

    // Determine top labels overall
    const overall = new Map();
    per.forEach(({ agg }) => {
      agg.list.forEach(({ name, value }) => {
        overall.set(name, (overall.get(name) || 0) + value);
      });
    });
    const topLabels = [...overall.entries()].sort((a,b)=>b[1]-a[1]).slice(0, compareTopN).map(([k]) => k);

    // Build table rows: { label, sheet1, sheet2, ... }
    const table = topLabels.map(label => {
      const row = { label };
      per.forEach(({ name, agg }) => {
        const hit = agg.list.find(d => d.name === label);
        row[name] = hit ? hit.value : 0;
      });
      return row;
    });

    return { per, topLabels, table };
  }, [compareSheets, sheets, mappingBySheet, compareMeasure, compareTopN]);

  /* ===================== Render ===================== */
  return (
    <div className="space-y-3">
      {/* Top controls */}
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">File</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
          {fileName && <span className="px-2 py-1 rounded bg-gray-100 text-xs">{fileName}</span>}

          {sheets.length > 0 && (
            <>
              <label className="ml-3 text-sm text-gray-600">Sheet</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={sheetIx}
                onChange={(e)=>setSheetIx(Number(e.target.value))}
              >
                {sheets.map((s,i)=><option key={s.name} value={i}>{s.name}</option>)}
              </select>
            </>
          )}

          <label className="ml-3 text-sm text-gray-600">Palette</label>
          <select className="border rounded px-2 py-1 text-sm" value={paletteKey} onChange={(e)=>setPaletteKey(e.target.value)}>
            {Object.keys(PALETTES).map((k)=> <option key={k} value={k}>{k}</option>)}
          </select>

          <label className="ml-3 text-sm text-gray-600">Size</label>
          <select className="border rounded px-2 py-1 text-sm" value={globalSize} onChange={(e)=>setGlobalSize(e.target.value)}>
            {Object.keys(SIZES).map((k)=> <option key={k} value={k}>{k}</option>)}
          </select>

          <label className="ml-3 text-sm text-gray-600 flex items-center gap-2">
            <input type="checkbox" checked={lockMapping} onChange={()=>setLockMapping(v=>!v)} />
            Lock mapping across sheets
          </label>

          <button onClick={exportPdf} className="ml-auto rounded border px-3 py-1.5 text-sm bg-white hover:bg-gray-50">
            Export PDF
          </button>
        </div>
      </div>

      {/* Mapping + per sheet controls */}
      {theSheet ? (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Ticket label" value={curMap.labelKey || ""} onChange={(v)=>setMappingBySheet(m=>({ ...m, [theSheet.name]: { ...m[theSheet.name], labelKey: v } }))} options={theSheet.headers}/>
            <Select label="Status" value={curMap.statusKey || ""} onChange={(v)=>setMappingBySheet(m=>({ ...m, [theSheet.name]: { ...m[theSheet.name], statusKey: v } }))} options={["",...theSheet.headers]} />
            <Select label="Satisfaction" value={curMap.satKey || ""} onChange={(v)=>setMappingBySheet(m=>({ ...m, [theSheet.name]: { ...m[theSheet.name], satKey: v } }))} options={["",...theSheet.headers]} />
            <Select label="Assignee" value={curMap.assigneeKey || ""} onChange={(v)=>setMappingBySheet(m=>({ ...m, [theSheet.name]: { ...m[theSheet.name], assigneeKey: v } }))} options={["",...theSheet.headers]} />
            <Select label="First response (min)" value={curMap.firstRespMinKey || ""} onChange={(v)=>setMappingBySheet(m=>({ ...m, [theSheet.name]: { ...m[theSheet.name], firstRespMinKey: v } }))} options={["",...theSheet.headers]} />

            <button
              className="rounded border px-2 py-1 text-xs bg-white hover:bg-gray-50"
              onClick={()=>setMappingBySheet(m=>({ ...m, [theSheet.name]: buildGuessForSheet(theSheet) }))}
            >
              Auto-detect (this sheet)
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select label="Chart" value={curCtl.chartType} options={CHART_TYPES} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], chartType: v } }))} />
            <Select label="Measure" value={curCtl.measure} options={["count","sum"]} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], measure: v } }))} />
            <Select label="Top N" value={String(curCtl.topN)} options={["10","20","30","50","100","0"]} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], topN: Number(v) } }))} />
            <Number label="Group <% " value={curCtl.minPct} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], minPct: v } }))} min={0} max={25} />
            <Select label="Sort" value={curCtl.sortDir} options={["desc","asc"]} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], sortDir: v } }))} />
            <Select label="Bar" value={curCtl.barOrientation} options={["h","v"]} onChange={(v)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], barOrientation: v } }))} />
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={!!curCtl.showValues} onChange={()=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], showValues: !c[theSheet.name].showValues } }))} />
              values
            </label>
            <input
              className="border rounded px-2 py-1 text-xs"
              placeholder="Filter labels"
              value={curCtl.search || ""}
              onChange={(e)=>setControlsBySheet(c=>({ ...c, [theSheet.name]: { ...c[theSheet.name], search: e.target.value } }))}
              style={{width: 160}}
            />

            {!generated[theSheet.name] ? (
              <button onClick={generate} className="ml-auto rounded bg-black text-white text-xs px-3 py-1.5 hover:bg-gray-800">Generate</button>
            ) : (
              <>
                <button onClick={regenerate} className="ml-auto rounded border text-xs px-3 py-1.5 hover:bg-gray-50">Regenerate</button>
                <button onClick={clearGen} className="rounded border text-xs px-3 py-1.5 hover:bg-gray-50">Clear</button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Capture root for PDF */}
      <div id="excel-capture-root" className="space-y-4">
        {/* Per-sheet view */}
        {theSheet && generated[theSheet.name] && built ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <HeaderRow title={theSheet.name} meta={`Label: ${curMap.labelKey || theSheet.headers[0]}`} />
            <KpisRow built={built} colors={COLORS} />
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div style={{height: CH}}>
                <ResponsiveContainer width="100%" height="100%">
                  {renderPrimaryChart(built, curCtl, COLORS)}
                </ResponsiveContainer>
              </div>
              <div style={{height: CH}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={built.full} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" width={200} tickFormatter={(s)=>wrap(s, 22)} />
                    <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
                    <Legend />
                    <Bar dataKey="value" name={curCtl.measure==="count"?"count":"value"} radius={[6,6,6,6]}>
                      {built.full.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto mt-3">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>{curMap.labelKey || "Label"}</Th>
                    <Th className="w-32 text-right">{curCtl.measure==="count"?"Count":"Value"}</Th>
                    <Th className="w-24 text-right">%</Th>
                  </tr>
                </thead>
                <tbody>
                  {built.full.map((row) => {
                    const pct = ((row.value / (built.total || 1)) * 100) || 0;
                    return (
                      <tr key={row.name} className="border-t hover:bg-gray-50">
                        <Td>{row.name}</Td>
                        <Td className="text-right">{fmt(row.value)}</Td>
                        <Td className="text-right">{pct.toFixed(1)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : sheets.length > 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
            Choose options and click <b>Generate</b> to render this sheet.
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
            Upload an Excel/CSV to begin.
          </div>
        )}

        {/* Comparison Mode */}
        {sheets.length > 0 && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="font-semibold">Compare sheets</div>
              <div className="text-xs text-gray-500">Pick 2–5 sheets</div>
              <Select
                label=""
                value=""
                options={[]}
                onChange={()=>{}}
              />
              <div className="flex flex-wrap gap-2">
                {sheets.map(s => (
                  <label key={s.name} className="text-xs flex items-center gap-2 border rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={compareSheets.includes(s.name)}
                      onChange={(e)=>{
                        setCompareSheets(prev => {
                          if (e.target.checked) return [...new Set([...prev, s.name])].slice(0,5);
                          return prev.filter(x => x !== s.name);
                        });
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <Select label="Measure" value={compareMeasure} options={["count","sum"]} onChange={setCompareMeasure} />
              <Select label="Top N" value={String(compareTopN)} options={["5","10","15","20"]} onChange={(v)=>setCompareTopN(Number(v))} />
            </div>

            {!compareData ? (
              <div className="text-xs text-gray-500">Select 2–5 sheets to compare.</div>
            ) : (
              <>
                <HeaderRow title="Comparison" meta={`${compareData.topLabels.length} labels (Top ${compareTopN})`} />

                <div style={{ height: CH }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compareData.table} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <Legend />
                      <RTooltip />
                      {compareData.per.map((p, i) => (
                        <Bar key={p.name} dataKey={p.name} stackId={undefined} name={p.name} radius={[6,6,0,0]} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Small multiples donut per sheet */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {compareData.per.map((p, i) => {
                    const filtered = p.agg.list.filter(d => compareData.topLabels.includes(d.name));
                    const total = filtered.reduce((t,d)=>t+d.value,0) || 1;
                    return (
                      <div key={p.name} className="rounded-xl border p-3">
                        <div className="text-sm font-medium mb-1">{p.name}</div>
                        <div style={{ height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={filtered} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={1} label={sliceLabel(total)}>
                                {filtered.map((_,j)=><Cell key={j} fill={COLORS[j%COLORS.length]} />)}
                              </Pie>
                              <Legend wrapperStyle={{fontSize:12}} />
                              <RTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Comparison table */}
                <div className="overflow-auto mt-3">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Label</Th>
                        {compareData.per.map(p => <Th key={p.name} className="text-right">{p.name}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.table.map(row => (
                        <tr key={row.label} className="border-t hover:bg-gray-50">
                          <Td>{row.label}</Td>
                          {compareData.per.map(p => <Td key={p.name} className="text-right">{fmt(row[p.name] || 0)}</Td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== UI Bits ===================== */
function HeaderRow({ title, meta }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="text-base font-semibold">{title}</div>
      {meta ? <div className="text-xs text-gray-500">{meta}</div> : null}
    </div>
  );
}

function KpisRow({ built, colors }) {
  const dataSorted = built.full.slice().reverse();
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi label="Rows" value={built.rowsCount} />
      <Kpi label="Distinct labels" value={built.distinct} />
      <Kpi label="Total" value={fmt(built.total)} />
      <Kpi label="Shown" value={built.full.length} />
      <div className="rounded-lg border bg-white p-2">
        <div className="text-xs text-gray-500 mb-1">Distribution</div>
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dataSorted}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis hide dataKey="name" />
              <YAxis hide />
              <Area dataKey="value" type="monotone" fill={colors[0]} stroke={colors[0]} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function renderPrimaryChart(built, ctl, COLORS) {
  const mode = ctl.chartType;
  if (mode === "donut") {
    return (
      <PieChart>
        <Pie data={built.list} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="70%" paddingAngle={2} label={sliceLabel(built.total)}>
          {built.list.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} opacity={d._other?0.6:1} />)}
        </Pie>
        <Legend wrapperStyle={{fontSize:12}} />
        <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
      </PieChart>
    );
  }
  if (mode === "rose") {
    return (
      <PieChart>
        <Pie data={built.list} dataKey="value" nameKey="name" startAngle={90} endAngle={-270} outerRadius="80%" label={sliceLabel(built.total)}>
          {built.list.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} opacity={d._other?0.6:1} />)}
        </Pie>
        <Legend wrapperStyle={{fontSize:12}} />
        <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
      </PieChart>
    );
  }
  if (mode === "radial") {
    const domainMax = Math.max(...built.full.map(d=>d.value)) || 1;
    return (
      <RadialBarChart innerRadius="25%" outerRadius="85%" barCategoryGap="10%" data={built.full}>
        <PolarAngleAxis type="number" domain={[0, domainMax]} tick={false} />
        <RadialBar dataKey="value" background>
          {built.full.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
        </RadialBar>
        <Legend wrapperStyle={{fontSize:12}} />
        <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
      </RadialBarChart>
    );
  }
  // Bars
  if (mode === "bar-v") {
    return (
      <BarChart data={built.full.slice(0, 20)} margin={{top:10,right:10,left:10,bottom:10}}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} />
        <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
        <Legend />
        <Bar dataKey="value" radius={[6,6,0,0]} label={ctl.showValues?{position:"top",formatter:(v)=>fmt(v)}:false}>
          {built.full.slice(0,20).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
        </Bar>
      </BarChart>
    );
  }
  // bar-h
  return (
    <BarChart data={built.full.slice(0, 20)} layout="vertical" margin={{top:10,right:10,left:140,bottom:10}}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" tickFormatter={fmt} allowDecimals={false} />
      <YAxis type="category" dataKey="name" width={200} tickFormatter={(s)=>wrap(s, 22)} />
      <RTooltip formatter={(v,n,p)=>[fmt(v),p?.payload?.name]} />
      <Legend />
      <Bar dataKey="value" radius={[6,6,6,6]} label={ctl.showValues?{position:"right",formatter:(v)=>fmt(v)}:false}>
        {built.full.slice(0,20).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
      </Bar>
    </BarChart>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs text-gray-600 flex items-center gap-1">
      {label && <span>{label}</span>}
      <select className="border rounded px-2 py-1 text-xs" value={value} onChange={(e)=>onChange(e.target.value)}>
        {options.map((o)=> <option key={String(o)} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Number({ label, value, onChange, min=0, max=100 }) {
  return (
    <label className="text-xs text-gray-600 flex items-center gap-1">
      {label}
      <input
        type="number" className="w-16 border rounded px-2 py-1 text-xs"
        min={min} max={max} value={value}
        onChange={(e)=>onChange(Math.max(min, Math.min(max, Number(e.target.value)||0)))}
      />
    </label>
  );
}
function Kpi({ label, value }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-xl leading-tight">{String(value ?? "—")}</div>
    </div>
  );
}
const Th = ({ children, className = "" }) => (
  <th className={`text-left px-3 py-2 font-medium text-gray-600 ${className}`}>{children}</th>
);
const Td = ({ children, className = "" }) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);
