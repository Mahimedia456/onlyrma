import { useMemo, useState } from "react";

/* ---------- helpers ---------- */
const IMG = (t) =>
  `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(t)}`;

const formatUSD = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";

/* ---------- data (exactly your final grouping) ---------- */
const DATA = [
  /* ============================ Sumo Series ============================ */
  {
    series: "Sumo Series",
    sections: [
      {
        name: "Sumo 19",
        items: [
          { title: "PCBA Main Board", price: 900, image: IMG("Sumo 19 Main Board") },
          { title: "XLR Audio and Power Board", price: 250, image: IMG("Sumo XLR/Power") },
          { title: "LCD", price: 900, image: IMG("Sumo 19 LCD") },
        ],
      },
      {
        name: "Sumo 19 SE",
        items: [
          { title: "PCBA Main Board", price: 900, image: IMG("Sumo 19SE Main Board") },
          { title: "LCD", price: 1300, image: IMG("Sumo 19SE LCD") },
        ],
      },
      {
        name: "Common",
        items: [
          {
            title: "Power Adaptor (100_240VAC - 15VDC/6A SMPS 4pin XLR DC)",
            price: 100,
            image: IMG("Sumo Power Adapter"),
          },
        ],
      },
    ],
  },

  /* ============================ Ninja Series ============================ */
  {
    series: "Ninja Series",
    sections: [
      {
        name: "Ninja",
        items: [
          { title: "Main Board Service Assembly", price: 220, image: IMG("Ninja Main Board") },
          { title: "Rear Housing", price: 125, image: IMG("Ninja Rear Housing") },
          { title: "Battery Board", price: 100, image: IMG("Ninja Battery Board") },
        ],
      },
      {
        name: "Ninja V",
        items: [
          { title: "PCBA Main Board", price: 220, image: IMG("Ninja V Main Board") },
          { title: "SATA Board", price: 100, image: IMG("Ninja V SATA Board") },
          { title: "LCD", price: 350, image: IMG("Ninja V LCD") },
        ],
      },
      {
        name: "Ninja V Plus",
        items: [
          { title: "Audio Board", price: 100, image: IMG("Ninja V+ Audio Board") },
          { title: "PCBA Main Board", price: 400, image: IMG("Ninja V+ Main Board") },
          { title: "LCD", price: 350, image: IMG("Ninja V+ LCD") },
        ],
      },
      {
        name: "Ninja Ultra",
        items: [
          { title: "PCBA", price: 450, image: IMG("Ninja Ultra PCBA") },
          { title: "LCD", price: 350, image: IMG("Ninja Ultra LCD") },
        ],
      },
      {
        name: "Common (Ninja Series)",
        items: [
          { title: "Power Cable (USB to 2.1mm PD)", price: 50, image: IMG("Ninja Power Cable") },
          {
            title: "Fan (Ninja V / Ninja V Plus / Ultra)",
            price: 65,
            image: IMG("Ninja Fan V/V+/Ultra"),
          },
          { title: "Fan (Ninja TX / TXGO)", price: 0, image: IMG("Ninja Fan TX/TXGO") },
        ],
      },
    ],
  },

  /* ============================ Shogun Series ============================ */
  {
    series: "Shogun Series",
    sections: [
      {
        name: "Shogun 7",
        items: [
          { title: "PCBA for RMA", price: 700, image: IMG("Shogun 7 PCBA") },
          { title: "LCD", price: 450, image: IMG("Shogun 7 LCD") },
        ],
      },
      {
        name: "Shogun Ultra",
        items: [
          { title: "PCBA for RMA", price: 800, image: IMG("Shogun Ultra PCBA") },
          { title: "LCD", price: 400, image: IMG("Shogun Ultra LCD") },
          { title: "Fan", price: 0, image: IMG("Shogun Ultra Fan") },
        ],
      },
      {
        name: "Common (Shogun Series)",
        items: [
          { title: "Ninja Rear Housing", price: 0, image: IMG("Ninja Rear Housing (Shogun use)") },
          { title: "AirGlu Antenna", price: 35, image: IMG("AirGlu Antenna") },
          { title: "Wifi Antenna", price: 35, image: IMG("Wifi Antenna") },
        ],
      },
    ],
  },

  /* ============================ Shinobi Series ============================ */
  {
    series: "Shinobi Series",
    sections: [
      {
        name: "Shinobi II",
        items: [
          { title: "PCBA", price: 220, image: IMG("Shinobi II PCBA") },
          { title: "LCD", price: 270, image: IMG("Shinobi II LCD") },
        ],
      },
      {
        name: "Shinobi GO",
        items: [
          { title: "PCBA", price: 220, image: IMG("Shinobi GO PCBA") },
          { title: "LCD", price: 270, image: IMG("Shinobi GO LCD") },
        ],
      },
      {
        name: "Shinobi 7",
        items: [
          { title: "PCBA", price: 260, image: IMG("Shinobi 7 PCBA") },
          { title: "LCD", price: 310, image: IMG("Shinobi 7 LCD") },
        ],
      },
    ],
  },

  /* ============================ Legacy ============================ */
  {
    series: "Legacy",
    sections: [
      {
        name: "Shogun Inferno",
        items: [
          { title: "PCBA", price: 900, image: IMG("Shogun Inferno PCBA") },
          { title: "LCD", price: 550, image: IMG("Shogun Inferno LCD") },
          { title: "Whole Unit", price: 400, image: IMG("Shogun Inferno Whole Unit") },
        ],
      },
      {
        name: "Ninja Inferno",
        items: [
          { title: "PCBA", price: 600, image: IMG("Ninja Inferno PCBA") },
          { title: "LCD", price: 400, image: IMG("Ninja Inferno LCD") },
          { title: "Whole Unit", price: 410, image: IMG("Ninja Inferno Whole Unit") },
        ],
      },
      {
        name: "Shogun Studio 2",
        items: [
          { title: "PCBA", price: 1000, image: IMG("Shogun Studio 2 PCBA") },
          { title: "Controller Board", price: 350, image: IMG("Shogun Studio 2 Controller") },
          { title: "LCD", price: 800, image: IMG("Shogun Studio 2 LCD") },
        ],
      },
      {
        name: "Shinobi (Legacy)",
        items: [
          { title: "HDMI PCBA", price: 250, image: IMG("Shinobi HDMI PCBA") },
          { title: "SDI PCBA", price: 350, image: IMG("Shinobi SDI PCBA") },
          { title: "LCD", price: 350, image: IMG("Shinobi LCD") },
          { title: "Whole Unit (Shinobi HDMI)", price: 280, image: IMG("Shinobi HDMI Unit") },
          { title: "Whole Unit (Shinobi SDI)", price: 330, image: IMG("Shinobi SDI Unit") },
        ],
      },
      {
        name: "Zato",
        items: [
          { title: "Zato Connect PCBA", price: 250, image: IMG("Zato PCBA") },
          { title: "Zato Connect LCD", price: 2504, image: IMG("Zato LCD") },
        ],
      },
    ],
  },
];

/* ---------- component ---------- */
export default function RmaProducts() {
  const [seriesFilter, setSeriesFilter] = useState("All series");
  const [q, setQ] = useState("");

  const seriesOptions = useMemo(
    () => ["All series", ...DATA.map((s) => s.series)],
    []
  );

  // Flatten for search, but keep hierarchy for rendering
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const seriesOk = (s) =>
      seriesFilter === "All series" || s.series === seriesFilter;

    // deep filter: remove sections that end up empty due to search
    return DATA
      .filter(seriesOk)
      .map((s) => {
        const sections = s.sections
          .map((sec) => {
            const items = sec.items.filter((it) => {
              if (!query) return true;
              return (
                it.title.toLowerCase().includes(query) ||
                sec.name.toLowerCase().includes(query) ||
                s.series.toLowerCase().includes(query)
              );
            });
            return { ...sec, items };
          })
          .filter((sec) => sec.items.length > 0);
        return { ...s, sections };
      })
      .filter((s) => s.sections.length > 0);
  }, [seriesFilter, q]);

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search parts or models…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="sm:w-64">
          <label className="mb-1 block text-sm font-medium text-gray-700">Series</label>
          <select
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
          >
            {seriesOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
          No matching products.
        </div>
      ) : (
        filtered.map((block) => (
          <section key={block.series} className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">{block.series}</h2>

            {block.sections.map((sec) => (
              <div key={sec.name} className="space-y-3">
                <h3 className="text-base font-medium text-gray-800">{sec.name}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sec.items.map((it, idx) => (
                    <div
                      key={`${sec.name}-${it.title}-${idx}`}
                      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                        <img
                          src={it.image}
                          alt={it.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="p-4">
                        <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                        <div className="mt-1 text-xs text-gray-600">{formatUSD(it.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
