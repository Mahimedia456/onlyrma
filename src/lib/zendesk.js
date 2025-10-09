// src/lib/zendesk.js
export async function zdGet(path, init = {}) {
  const url = apiUrl(`/zendesk?path=${encodeURIComponent(path)}`);
  const res = await fetch(url, {
    credentials: "include", // IMPORTANT: send session cookie to backend
    headers: { "X-Requested-With": "XMLHttpRequest", ...(init.headers || {}) },
    ...init,
  });

  // Handle auth/permission issues cleanly
  if (res.status === 401 || res.status === 403) {
    let details = null;
    try { details = await res.json(); } catch {}
    const err = new Error("ZD_FORBIDDEN");
    err.code = "ZD_FORBIDDEN";
    err.details = details;
    throw err;
  }

  if (!res.ok) {
    let details = null;
    try { details = await res.text(); } catch {}
    const err = new Error(`ZD_HTTP_${res.status}`);
    err.code = `ZD_HTTP_${res.status}`;
    err.details = details;
    throw err;
  }

  return res.json();
}
