// PushFlow — shared auth helpers for login.html / register.html.
// Email + password only (no Google/GitHub OAuth) — talks directly to the
// PushFlow backend. No Firebase client SDK needed on the frontend for this.

// Same-origin deployment (frontend + backend on one Render service), so
// relative paths work — no separate API base URL needed.
const API_BASE = "";

/** Wraps fetch() with JSON handling + Authorization header when we have an access token. */
async function apiFetch(path, { method = "GET", body, auth: needsAuth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (needsAuth) {
    const token = localStorage.getItem("pf_access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include", // sends the HttpOnly refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { success: false, message: "Unexpected server response" };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

/** Stores the session after a successful login/register call. */
function storeSession(data) {
  if (data?.data?.accessToken) {
    localStorage.setItem("pf_access_token", data.data.accessToken);
  }
  if (data?.data?.user) {
    localStorage.setItem("pf_user", JSON.stringify(data.data.user));
  }
}

/** Email + password registration against our backend. */
async function registerWithEmail({ fname, lname, email, phone, password }) {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { fname, lname, email, phone, password },
  });
  storeSession(data);
  return data;
}

/** Email + password login against our backend. */
async function loginWithEmail({ email, password, remember }) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password, remember },
  });
  storeSession(data);
  return data;
}

function logout() {
  localStorage.removeItem("pf_access_token");
  localStorage.removeItem("pf_user");
  return apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("pf_user") || "null");
  } catch (e) {
    return null;
  }
}

function isLoggedIn() {
  return !!localStorage.getItem("pf_access_token");
}

// Expose on window so plain <script> blocks in each HTML page can use these.
window.PushFlowAuth = {
  registerWithEmail,
  loginWithEmail,
  logout,
  getStoredUser,
  isLoggedIn,
  apiFetch,
};

window.dispatchEvent(new Event("pushflow-auth-ready"));
