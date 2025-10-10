// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    isLoggedIn: false,
    user: null,
    subdomain: "",
    role: localStorage.getItem("role") || "admin",
  });

  // session on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl("/session"), { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setState({
            loading: false,
            isLoggedIn: true,
            user: d.user || null,
            subdomain: "",
            role: d.role || "admin",
          });
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("role", d.role || "admin");
          return;
        }
      } catch {}
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      const role = localStorage.getItem("role") || "admin";
      setState({
        loading: false,
        isLoggedIn,
        user: null,
        subdomain: "",
        role,
      });
    })();
  }, []);

  // 🔁 keep cookie alive while user is active
  useEffect(() => {
    if (!state.isLoggedIn) return;
    const ping = () => fetch(apiUrl("/session/refresh"), { credentials: "include" }).catch(() => {});
    const id = setInterval(ping, 10 * 60 * 1000); // every 10 minutes
    const onFocus = () => ping();
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [state.isLoggedIn]);

  async function loginInternal({ email, password }) {
    const r = await fetch(apiUrl("/internal-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok || !d?.ok) throw new Error(d?.error || "Internal login failed");
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "admin");
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user || { email },
      subdomain: "",
      role: "admin",
    });
  }

  async function loginViewer({ email, password }) {
    const r = await fetch(apiUrl("/viewer-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok || !d?.ok) throw new Error(d?.error || "Viewer login failed");
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "viewer");
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user || { email },
      subdomain: "",
      role: "viewer",
    });
  }

  async function logout() {
    try { await fetch(apiUrl("/logout"), { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    setState({
      loading: false,
      isLoggedIn: false,
      user: null,
      subdomain: "",
      role: "admin",
    });
  }

  return (
    <AuthCtx.Provider value={{ ...state, loginInternal, loginViewer, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
