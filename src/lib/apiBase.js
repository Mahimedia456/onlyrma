// src/lib/apiBase.js
export function apiUrl(path) {
  // Normalize input
  const p = String(path || "");

  // If caller passed a full URL, just return it
  if (/^https?:\/\//i.test(p)) return p;

  // Ensure it starts with "/api"
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.startsWith("/api") ? withSlash : `/api${withSlash}`;
}

export async function ensureJson(res) {
  const ct = res.headers.get("content-type") || "";

  // fast path: JSON + ok
  if (res.ok && ct.includes("application/json")) {
    return res.json();
  }

  // read raw once
  const raw = await res.text();

  if (!res.ok) {
    // try parse json error
    if (ct.includes("application/json")) {
      try {
        const data = JSON.parse(raw || "{}");
        const detail = data?.error || data?.message || JSON.stringify(data);
        throw new Error(detail || `HTTP ${res.status}`);
      } catch {
        /* fall through */
      }
    }
    const preview = raw.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(preview ? `HTTP ${res.status}: ${preview}` : `HTTP ${res.status}`);
  }

  // success but not JSON: try to parse if it claims JSON
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      throw new Error("Malformed JSON response.");
    }
  }

  throw new Error("Expected JSON but received non-JSON response.");
}
