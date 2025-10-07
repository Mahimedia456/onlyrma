// src/utils/zendeskRole.js
export function isZendeskUserLocal() {
  // Should be set during Zendesk login
  return !!localStorage.getItem("zdUser");
}

export function computeIsViewer(roleFromStorageOrSession, isZendesk) {
  // Rush users: honor stored role
  // Zendesk users: treat as admin in the UI
  const role = (roleFromStorageOrSession || "admin").toLowerCase();
  if (isZendesk) return false;
  return role === "viewer";
}
