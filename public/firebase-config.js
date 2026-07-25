// PushFlow — Firebase client init + shared auth helpers.
// Loaded by login.html / register.html before their own inline scripts.
//
// Uses REDIRECT-based OAuth (not popup) because mobile browsers frequently
// close popups before the sign-in flow completes, producing
// "auth/popup-closed-by-user" even on a successful click. Redirect avoids
// that entirely: the whole page navigates to Google/GitHub and back.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Values from Firebase Console → Project settings → General → Your apps → Web app config.
const firebaseConfig = {
  apiKey: "AIzaSyALItdxW7kw1WqhIoyQNp2zPQcxcEkrKCE",
  authDomain: "pushflow-f2109.firebaseapp.com",
  projectId: "pushflow-f2109",
  storageBucket: "pushflow-f2109.firebasestorage.app",
  messagingSenderId: "560757168168",
  appId: "1:560757168168:web:afbd447c1d9b3944c7bd1d",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

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

/** Stores the session after a successful login/register/oauth call. */
function storeSession(data) {
  if (data?.data?.accessToken) {
    localStorage.setItem("pf_access_token", data.data.accessToken);
  }
  if (data?.data?.user) {
    localStorage.setItem("pf_user", JSON.stringify(data.data.user));
  }
}

/** Email + password registration against our backend. */
async function registerWithEmail({ fname, lname, email, password }) {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { fname, lname, email, password },
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

/** Kicks off Google sign-in via full-page redirect (completes on next page load). */
function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  sessionStorage.setItem("pf_oauth_provider", "google");
  return signInWithRedirect(auth, provider);
}

/** Kicks off GitHub sign-in via full-page redirect (completes on next page load). */
function signInWithGithub() {
  const provider = new GithubAuthProvider();
  sessionStorage.setItem("pf_oauth_provider", "github");
  return signInWithRedirect(auth, provider);
}

/**
 * Call this once on page load (login.html / register.html) to finish an
 * OAuth redirect flow, if one is in progress. Returns null if there was no
 * pending redirect result.
 */
async function completeOAuthRedirect() {
  const provider = sessionStorage.getItem("pf_oauth_provider");
  if (!provider) return null;

  try {
    const result = await getRedirectResult(auth);
    if (!result || !result.user) return null;

    const idToken = await result.user.getIdToken();
    const endpoint = provider === "github" ? "/api/auth/github" : "/api/auth/google";
    const data = await apiFetch(endpoint, { method: "POST", body: { idToken } });
    storeSession(data);
    return data;
  } finally {
    sessionStorage.removeItem("pf_oauth_provider");
  }
}

async function forgotPassword(email) {
  return apiFetch("/api/auth/forgot-password", { method: "POST", body: { email } });
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

// Expose on window so plain <script> blocks in each HTML page can use these
// without every page needing to become a module.
window.PushFlowAuth = {
  registerWithEmail,
  loginWithEmail,
  signInWithGoogle,
  signInWithGithub,
  completeOAuthRedirect,
  forgotPassword,
  logout,
  getStoredUser,
  isLoggedIn,
  apiFetch,
};

// Signal that auth helpers are ready, in case a page's inline script runs
// before this module finishes loading (modules are deferred by default).
window.dispatchEvent(new Event("pushflow-auth-ready"));
