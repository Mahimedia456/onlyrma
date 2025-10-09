// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    isLoggedIn: false,
    user: null,
    role: localStorage.getItem("role") || "admin", // "admin" | "viewer"
  });

  // On mount, try server session; if none, fall back to localStorage
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl("/session"), { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setState({
            loading: false,
            isLoggedIn: !!d?.ok,
            user: d?.user || null,
            role: d?.role || "admin",
          });
          if (d?.ok) {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("role", d.role || "admin");
            localStorage.setItem("userEmail", d.user?.email || "");
            return;
          }
        }
      } catch {}
      // fallback (client memory)
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      const role = localStorage.getItem("role") || "admin";
      const userEmail = localStorage.getItem("userEmail") || null;
      setState({
        loading: false,
        isLoggedIn,
        user: userEmail ? { email: userEmail } : null,
        role,
      });
    })();
  }, []);

  // INTERNAL ADMIN LOGIN (hardcoded creds)
  async function login({ email, password }) {
    const r = await fetch(apiUrl("/internal-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok || !d?.ok) {
      throw new Error(d?.error || "Internal login failed");
    }
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "admin");
    localStorage.setItem("userEmail", d.user?.email || email);
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user || { email },
      role: "admin",
    });
  }

  // VIEWER LOGIN (Rush)
  async function loginViewer({ email, password }) {
    const r = await fetch(apiUrl("/viewer-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok || !d?.ok) {
      throw new Error(d?.error || "Viewer login failed");
    }
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "viewer");
    localStorage.setItem("userEmail", d.user?.email || email);
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user || { email },
      role: "viewer",
    });
  }

  async function logout() {
    try { await fetch(apiUrl("/logout"), { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    localStorage.removeItem("userEmail");
    setState({
      loading: false,
      isLoggedIn: false,
      user: null,
      role: "admin",
    });
  }

  return (
    <AuthCtx.Provider value={{ ...state, login, loginViewer, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
