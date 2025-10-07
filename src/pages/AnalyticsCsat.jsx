// src/pages/AnalyticsCsat.jsx
import { useEffect, useMemo, useState } from "react";
import { zdGet } from "@/lib/zendesk";
import { PieChart, Pie, Cell, Tooltip as RTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const PALETTES = {
  default: ["#111827", "#ef4444", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"],
  bright: ["#2563eb", "#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0891b2"],
  pastel: ["#60a5fa", "#86efac", "#fca5a5", "#fcd34d", "#c4b5fd", "#a5f3fc"],
};

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
};
const inRange = (dStr, from, to) => {
  if (!from && !to) return true;
  const d = new Date(dStr);
  if (isNaN(d)) return false;
  if (from && d < new Date(from)) return false;
  if (to) {
    const end = new Date(to); end.setHours(23,59,59,999);
    if (d > end) return false;
  }
  return true;
};

export default function AnalyticsCsat() {
  const [views, setViews] = useState([]);
  const [viewId, setViewId] = useState("");
  const [tickets, setTickets] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [scoreFilter, setScoreFilter] = useState(""); // '', 'good', 'bad'
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [paletteKey, setPaletteKey] = useState("default");
  const [search, setSearch] = useState("");

  // load views
  useEffect(() => {
    (async () => {
      try {
        const data = await zdGet("/api/zd/views");
        const list = data?.views || [];
        setViews(list);
        if (list.length) setViewId(String(list[0].id));
      } catch (e) {
        console.error("views fetch failed", e);
      }
    })();
  }, []);

  // month → set from/to
  useEffect(() => {
    if (!month) return;
    const [y, m] = month.split("-");
    const start = new Date(Number(y), Number(m) - 1, 1);
    const end = new Date(Number(y), Number(m), 0);
    setFrom(fmtDate(start));
    setTo(fmtDate(end));
  }, [month]);

  // tickets + satisfaction ratings
  useEffect(() => {
    if (!viewId) return;
    (async () => {
      setLoading(true);
      try {
        const tData = await zdGet(`/api/v2/views/${encodeURIComponent(viewId)}/tickets.json?per_page=100`);
        setTickets(Array.isArray(tData?.tickets) ? tData.tickets : []);

        // pull 2 pages of ratings (increase if needed)
        let all = [];
        let path = "/api/v2/satisfaction_ratings.json?sort_order=desc&per_page=100";
        for (let i = 0; i < 2; i++) {
          const r = await zdGet(path);
          all = all.concat(r?.satisfaction_ratings || []);
          if (!r?.next_page) break;
          const u = new URL(r.next_page);
          path = u.pathname + u.search;
        }
        setRatings(all);
      } catch (e) {
        console.error("tickets/ratings failed", e);
        setTickets([]);
        setRatings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [viewId]);

  // join ratings → last rating by ticket
  const ratingByTicket = useMemo(() => {
    const map = new Map();
    for (const r of ratings) {
      if (!r?.ticket_id) continue;
      const prev = map.get(r.ticket_id);
      if (!prev) map.set(r.ticket_id, r);
      else {
        const d1 = new Date(prev.created_at || prev.updated_at || 0).getTime();
        const d2 = new Date(r.created_at || r.updated_at || 0).getTime();
        if (d2 >= d1) map.set(r.ticket_id, r);
      }
    }
    return map;
  }, [ratings]);

  const joined = useMemo(() => tickets.map(t => {
    const r = ratingByTicket.get(t.id);
    return {
      ...t,
      csat: (r?.score || "").toLowerCase(),
      csat_comment: r?.comment || "",
      csat_at: r?.created_at || r?.updated_at || "",
    };
  }), [tickets, ratingByTicket]);

  const filtered = useMemo(() => {
    let list = joined;
    if (scoreFilter) list = list.filter(t => t.csat === scoreFilter);
    if (from || to) list = list.filter(t => inRange(t.updated_at || t.csat_at, from, to));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const s = `${t.subject || ""} ${t.description || ""} ${t.requester?.name || ""}`.toLowerCase();
        return s.includes(q) || String(t.id).includes(q);
      });
    }
    return list;
  }, [joined, scoreFilter, from, to, search]);

  const stats = useMemo(() => {
    const good = filtered.filter(t => t.csat === "good");
    const bad = filtered.filter(t => t.csat === "bad");
    const totalRated = good.length + bad.length;
    return {
      total: filtered.length,
      good: good.length,
      bad: bad.length,
      goodPct: totalRated ? Math.round((good.length / totalRated) * 100) : 0,
      badPct: totalRated ? Math.round((bad.length / totalRated) * 100) : 0,
      goodWithComments: good.filter(t => t.csat_comment?.trim()).length,
      badWithComments: bad.filter(t => t.csat_comment?.trim()).length,
    };
  }, [filtered]);

  const COLORS = PALETTES[paletteKey] || PALETTES.default;
  const pieData = [
    { name: "Good", value: stats.good },
    { name: "Bad", value: stats.bad },
  ];
  const barData = [
    { name: "Counts", All: stats.total, Rated: stats.good + stats.bad, Good: stats.good, Bad: stats.bad },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">View</div>
            <select className="border rounded px-3 py-2 w-64" value={viewId} onChange={(e) => setViewId(e.target.value)}>
              {views.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Score</div>
            <select className="border rounded px-3 py-2" value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
              <option value="">All</option>
              <option value="good">Good</option>
              <option value="bad">Bad</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Month</div>
            <input type="month" className="border rounded px-3 py-2" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">From</div>
            <input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">To</div>
            <input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-gray-500 mb-1">Search</div>
            <input className="border rounded px-3 py-2 w-full" placeholder="Subject, requester, #ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Palette</div>
            <select className="border rounded px-3 py-2" value={paletteKey} onChange={(e) => setPaletteKey(e.target.value)}>
              {Object.keys(PALETTES).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-500">{loading ? "Loading…" : `Tickets: ${filtered.length}`}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Good %" value={`${stats.goodPct}%`} />
        <Kpi label="Bad %" value={`${stats.badPct}%`} />
        <Kpi label="Good (w/ comments)" value={stats.goodWithComments} />
        <Kpi label="Bad (w/ comments)" value={stats.badWithComments} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="font-semibold mb-2">CSAT Split</div>
          <PieChart width={430} height={260}>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
            </Pie>
            <Legend />
            <RTooltip />
          </PieChart>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="font-semibold mb-2">Counts</div>
          <BarChart width={520} height={260} data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <RTooltip />
            <Legend />
            <Bar dataKey="All" fill={COLORS[0]} />
            <Bar dataKey="Rated" fill={COLORS[3]} />
            <Bar dataKey="Good" fill={COLORS[2]} />
            <Bar dataKey="Bad" fill={COLORS[1]} />
          </BarChart>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="p-3 font-semibold border-b">Tickets</div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <Th>#</Th><Th>Subject</Th><Th>Status</Th><Th>Updated</Th><Th>CSAT</Th><Th>Comment</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <Td className="font-medium">#{t.id}</Td>
                  <Td>{t.subject || "-"}</Td>
                  <Td>{t.status || "-"}</Td>
                  <Td>{t.updated_at ? new Date(t.updated_at).toLocaleString() : "-"}</Td>
                  <Td className={t.csat === "good" ? "text-green-600" : t.csat === "bad" ? "text-red-600" : ""}>
                    {t.csat || "-"}
                  </Td>
                  <Td className="max-w-[480px] truncate" title={t.csat_comment || ""}>
                    {t.csat_comment || "-"}
                  </Td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No tickets for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
const Th = ({ children }) => <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
