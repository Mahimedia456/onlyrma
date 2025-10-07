// src/pages/LoginPage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginViewer } = useAuth();

  const [tab, setTab] = useState("zendesk"); // "zendesk" | "rma"
  const isZendesk = tab === "zendesk";

  // Zendesk form
  const [zd, setZd] = useState({
    email: "alex@codered-tech.com",
    token: "wwq0RELx5qj2ZxyFdocyMMdjaxTER6QL1ds0hGAZ",
    subdomain: "software-6493",
  });

  // RMA viewer form
  const [viewer, setViewer] = useState({
    email: "rush@mahimediasolutions.com",
    password: "aamirtest",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = useMemo(
    () => (isZendesk ? "Sign in to Zendesk" : "RMA Login"),
    [isZendesk]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (isZendesk) {
        await login({
          email: zd.email.trim(),
          token: zd.token.trim(),
          subdomain: zd.subdomain.trim(),
        });
      } else {
        await loginViewer({
          email: viewer.email.trim(),
          password: viewer.password,
        });
      }
      navigate("/dashboard");
    } catch (e2) {
      setErr(e2?.message || (isZendesk ? "Zendesk login failed" : "Viewer login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-xl border overflow-hidden">
          <TabButton active={isZendesk} onClick={() => setTab("zendesk")}>
            Zendesk Login
          </TabButton>
          <TabButton active={!isZendesk} onClick={() => setTab("rma")}>
            RMA Login
          </TabButton>
        </div>

        <h2 className="mb-4 text-center text-2xl font-semibold text-gray-800">
          {title}
        </h2>

        {err && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isZendesk ? (
            <>
              <Field label="Zendesk Email">
                <input
                  type="email"
                  value={zd.email}
                  onChange={(e) => setZd((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="API Token" hint="Zendesk Admin → Apps and Integrations → APIs → Add API token.">
                <input
                  type="password"
                  value={zd.token}
                  onChange={(e) => setZd((s) => ({ ...s, token: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
                  autoComplete="current-password"
                  required
                />
              </Field>

              <Field label="Zendesk Subdomain" hint={`API base: https://${zd.subdomain || "your-subdomain"}.zendesk.com/api/v2`}>
                <input
                  type="text"
                  value={zd.subdomain}
                  onChange={(e) => setZd((s) => ({ ...s, subdomain: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
                  placeholder="e.g. software-6493"
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Use your <b>restricted</b> RMA login. This account can view <b>RMA Entry → Lists</b> only.
              </p>
              <Field label="Email">
                <input
                  type="email"
                  value={viewer.email}
                  onChange={(e) => setViewer((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={viewer.password}
                  onChange={(e) => setViewer((s) => ({ ...s, password: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2 bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
          >
            {loading ? "Signing in…" : isZendesk ? "Login & Connect" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm ${
        active ? "bg-black text-white" : "bg-white hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
