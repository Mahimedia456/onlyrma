import { useMemo, useState } from "react";

/* ---------- utils ---------- */
const formatUSD = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";

/* ---------- data (grouped exactly as requested) ---------- */
const DATA = [
  // =============== Sumo Series ===============
  {
    series: "Sumo Series",
    sections: [
      {
        name: "Sumo 19",
        items: [
          { title: "PCBA Main Board", price: 900 },
          { title: "XLR Audio and Power Board", price: 250 },
          { title: "LCD", price: 900 },
        ],
      },
      {
        name: "Sumo 19 SE",
        items: [
          { title: "PCBA Main Board", price: 900 },
          { title: "LCD", price: 1300 },
        ],
      },
      {
        name: "Common",
        items: [
          {
            title: "Power Adaptor (100_240VAC - 15VDC/6A SMPS 4pin XLR DC)",
            price: 100,
          },
        ],
      },
    ],
  },

  // =============== Ninja Series ===============
  {
    series: "Ninja Series",
    sections: [
      {
        name: "Ninja",
        items: [
          { title: "Main Board Service Assembly", price: 220 },
          { title: "Rear Housing", price: 125 },
          { title: "Battery Board", price: 100 },
        ],
      },
      {
        name: "Ninja V",
        items: [
          { title: "PCBA Main Board", price: 220 },
          { title: "SATA Board", price: 100 },
          { title: "LCD", price: 350 },
        ],
      },
      {
        name: "Ninja V Plus",
        items: [
          { title: "Audio Board", price: 100 },
          { title: "PCBA Main Board", price: 400 },
          { title: "LCD", price: 350 },
        ],
      },
      {
        name: "Ninja Ultra",
        items: [
          { title: "PCBA", price: 450 },
          { title: "LCD", price: 350 },
        ],
      },
      {
        name: "Common (Ninja Series)",
        items: [
          { title: "Power Cable (USB to 2.1mm PD)", price: 50 },
          { title: "Fan (Ninja V / Ninja V Plus / Ultra)", price: 65 },
          { title: "Fan (Ninja TX / TXGO)", price: 0 },
        ],
      },
    ],
  },

  // =============== Shogun Series ===============
  {
    series: "Shogun Series",
    sections: [
      {
        name: "Shogun 7",
        items: [
          { title: "PCBA for RMA", price: 700 },
          { title: "LCD", price: 450 },
        ],
      },
      {
        name: "Shogun Ultra",
        items: [
          { title: "PCBA for RMA", price: 800 },
          { title: "LCD", price: 400 },
          { title: "Fan", price: 0 },
        ],
      },
      {
        name: "Common (Shogun Series)",
        items: [
          { title: "Ninja Rear Housing", price: 0 },
          { title: "AirGlu Antenna", price: 35 },
          { title: "Wifi Antenna", price: 35 },
        ],
      },
    ],
  },

  // =============== Shinobi Series ===============
  {
    series: "Shinobi Series",
    sections: [
      {
        name: "Shinobi II",
        items: [
          { title: "PCBA", price: 220 },
          { title: "LCD", price: 270 },
        ],
      },
      {
        name: "Shinobi GO",
        items: [
          { title: "PCBA", price: 220 },
          { title: "LCD", price: 270 },
        ],
      },
      {
        name: "Shinobi 7",
        items: [
          { title: "PCBA", price: 260 },
          { title: "LCD", price: 310 },
        ],
      },
    ],
  },

  // =============== Legacy ===============
  {
    series: "Legacy",
    sections: [
      {
        name: "Shogun Inferno",
        items: [
          { title: "PCBA", price: 900 },
          { title: "LCD", price: 550 },
          { title: "Whole Unit", price: 400 },
        ],
      },
      {
        name: "Ninja Inferno",
        items: [
          { title: "PCBA", price: 600 },
          { title: "LCD", price: 400 },
          { title: "Whole Unit", price: 410 },
        ],
      },
      {
        name: "Shogun Studio 2",
        items: [
          { title: "PCBA", price: 1000 },
          { title: "Controller Board", price: 350 },
          { title: "LCD", price: 800 },
        ],
      },
      {
        name: "Shinobi (Legacy)",
        items: [
          { title: "HDMI PCBA", price: 250 },
          { title: "SDI PCBA", price: 350 },
          { title: "LCD", price: 350 },
          { title: "Whole Unit (Shinobi HDMI)", price: 280 },
          { title: "Whole Unit (Shinobi SDI)", price: 330 },
        ],
      },
      {
        name: "Zato",
        items: [
          { title: "Zato Connect PCBA", price: 250 },
          { title: "Zato Connect LCD", price: 2504 },
        ],
      },
    ],
  },
];

/* ---------- small UI atoms ---------- */
function Breadcrumbs({ crumbs, onCrumbClick }) {
  return (
    <nav className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-300">/</span>}
          <button
            className={`hover:underline ${i === crumbs.length - 1 ? "font-semibold text-gray-900 cursor-default hover:no-underline" : ""}`}
            onClick={() => (i === crumbs.length - 1 ? null : onCrumbClick(i))}
            disabled={i === crumbs.length - 1}
          >
            {c}
          </button>
        </span>
      ))}
    </nav>
  );
}

/* ---------- main component ---------- */
export default function RmaProductsExplorer() {
  // 0 = series list, 1 = models/sections list, 2 = parts list
  const [level, setLevel] = useState(0);
  const [q, setQ] = useState("");
  const [activeSeries, setActiveSeries] = useState(null); // { series, sections }
  const [activeSection, setActiveSection] = useState(null); // { name, items }

  const crumbs = useMemo(() => {
    const out = ["Series"];
    if (activeSeries) out.push(activeSeries.series);
    if (activeSection) out.push(activeSection.name);
    return out;
  }, [activeSeries, activeSection]);

  const handleCrumbClick = (idx) => {
    if (idx === 0) {
      setLevel(0);
      setActiveSeries(null);
      setActiveSection(null);
    } else if (idx === 1) {
      setLevel(1);
      setActiveSection(null);
    }
  };

  const seriesList = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return DATA;
    // search across series name + sections/parts
    return DATA.filter((s) => {
      const inSeries = s.series.toLowerCase().includes(query);
      const inSections = s.sections.some(
        (sec) =>
          sec.name.toLowerCase().includes(query) ||
          sec.items.some((it) => it.title.toLowerCase().includes(query))
      );
      return inSeries || inSections;
    });
  }, [q]);

  const sectionList = useMemo(() => {
    if (!activeSeries) return [];
    const query = q.trim().toLowerCase();
    const all = activeSeries.sections;
    if (!query) return all;
    return all.filter(
      (sec) =>
        sec.name.toLowerCase().includes(query) ||
        sec.items.some((it) => it.title.toLowerCase().includes(query))
    );
  }, [activeSeries, q]);

  const itemsList = useMemo(() => {
    if (!activeSection) return [];
    const query = q.trim().toLowerCase();
    const all = activeSection.items;
    if (!query) return all;
    return all.filter((it) => it.title.toLowerCase().includes(query));
  }, [activeSection, q]);

  const goSeries = (s) => {
    setActiveSeries(s);
    setActiveSection(null);
    setLevel(1);
  };
  const goSection = (sec) => {
    setActiveSection(sec);
    setLevel(2);
  };

  const resetToSeries = () => {
    setLevel(0);
    setActiveSeries(null);
    setActiveSection(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header + controls */}
      <div className="flex flex-col gap-2">
        <Breadcrumbs crumbs={crumbs} onCrumbClick={handleCrumbClick} />

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                level === 0
                  ? "Search series, models or parts…"
                  : level === 1
                  ? "Search models or parts…"
                  : "Search parts…"
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {level > 0 && (
            <button
              onClick={resetToSeries}
              className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium hover:bg-gray-50"
            >
              Back to all series
            </button>
          )}
        </div>
      </div>

      {/* LEVEL 0: Series list */}
      {level === 0 && (
        seriesList.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {seriesList.map((s) => (
              <button
                key={s.series}
                onClick={() => goSeries(s)}
                className="rounded-2xl border border-gray-200 bg-white text-left p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-gray-900">{s.series}</div>
                    <div className="text-xs text-gray-600">
                      {s.sections.length} models •{" "}
                      {s.sections.reduce((sum, sec) => sum + sec.items.length, 0)} parts
                    </div>
                  </div>
                  <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                    Explore
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* LEVEL 1: Sections/models within a series */}
      {level === 1 && activeSeries && (
        sectionList.length === 0 ? (
          <Empty />
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-900">{activeSeries.series}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {sectionList.map((sec) => (
                <button
                  key={sec.name}
                  onClick={() => goSection(sec)}
                  className="rounded-2xl border border-gray-200 bg-white text-left p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="text-base font-medium text-gray-900">{sec.name}</div>
                  <div className="mt-1 text-xs text-gray-600">{sec.items.length} parts</div>
                </button>
              ))}
            </div>
          </>
        )
      )}

      {/* LEVEL 2: Items/parts within a section */}
      {level === 2 && activeSection && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{activeSeries?.series}</h2>
              <div className="text-sm text-gray-600">{activeSection.name}</div>
            </div>
            <button
              onClick={() => setLevel(1)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium hover:bg-gray-50"
            >
              Back to models
            </button>
          </div>

          {/* Parts grid: 4 in a row */}
          {itemsList.length === 0 ? (
            <Empty />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {itemsList.map((it, idx) => (
                <div
                  key={`${activeSection.name}-${it.title}-${idx}`}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition p-4"
                >
                  <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                  <div className="mt-1 text-xs text-gray-600">{formatUSD(it.price)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
      No results.
    </div>
  );
}
