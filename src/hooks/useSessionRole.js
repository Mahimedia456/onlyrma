import { useEffect, useState } from "react";

/**
 * Reads session from /api/session and exposes { ready, role, user, error }.
 * - ready=false while loading
 * - role: 'admin' | 'viewer'
 */
export default function useSessionRole() {
  const [state, setState] = useState({
    ready: false,
    role: "viewer",
    user: null,
    error: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/session", { credentials: "include" });
        if (!r.ok) {
          const j = await safeJson(r);
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        const d = await r.json();
        if (!alive) return;
        setState({ ready: true, role: d.role || "viewer", user: d.user || null, error: "" });
      } catch (e) {
        if (!alive) return;
        setState({ ready: true, role: "viewer", user: null, error: e?.message || "No session" });
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}

async function safeJson(res) { try { return await res.json(); } catch { return null; } }
