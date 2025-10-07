// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    isLoggedIn: false,
    user: null,
    subdomain: "",
    role: localStorage.getItem("role") || "admin",
  });

  // On mount, try server session; if none, fall back to localStorage for viewer
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/session", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setState({
            loading: false,
            isLoggedIn: true,
            user: d.user || null,
            subdomain: d.subdomain || "",
            role: d.role || "admin",
          });
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("zdUser", JSON.stringify(d.user || {}));
          localStorage.setItem("zdSubdomain", d.subdomain || "");
          localStorage.setItem("role", d.role || "admin");
          return;
        }
      } catch {}
      // fallback: local viewer stored creds
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      const role = localStorage.getItem("role") || "admin";
      const user = JSON.parse(localStorage.getItem("zdUser") || "null");
      const subdomain = localStorage.getItem("zdSubdomain") || "";
      setState({
        loading: false,
        isLoggedIn,
        user,
        subdomain,
        role,
      });
    })();
  }, []);

  // Zendesk login (existing flow)
  async function login({ email, token, subdomain }) {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, token, subdomain }),
    });
    const d = await r.json();
    if (!r.ok || !d?.ok) {
      throw new Error(d?.error || "Login failed");
    }
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("zdUser", JSON.stringify(d.user || {}));
    localStorage.setItem("zdSubdomain", d.subdomain || "");
    localStorage.setItem("role", d.role || "admin");
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user,
      subdomain: d.subdomain || "",
      role: d.role || "admin",
    });
  }

  // Viewer login (new)
  async function loginViewer({ email, password }) {
    const r = await fetch("/api/viewer-login", {
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
    localStorage.setItem("zdUser", JSON.stringify(d.user || { email }));
    localStorage.setItem("zdSubdomain", d.subdomain || "");
    localStorage.setItem("role", d.role || "viewer");
    setState({
      loading: false,
      isLoggedIn: true,
      user: d.user || { email },
      subdomain: d.subdomain || "",
      role: d.role || "viewer",
    });
  }

  async function logout() {
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("zdUser");
    localStorage.removeItem("zdSubdomain");
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
    <AuthCtx.Provider value={{ ...state, login, loginViewer, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
