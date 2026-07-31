/**
 * Sessão no apex (muhbianco.com.br): tokens no sessionStorage.
 * Access curto + refresh com rotação via API.
 */
(function (global) {
  const API_BASE = global.API_BASE || "https://api.muhbianco.com.br";
  const API_PREFIX = "/api/latest";
  const STORAGE_KEY = "mb_session";

  function readSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function saveTokens(payload) {
    const expiresAt = Date.now() + Number(payload.expires_in || 900) * 1000;
    writeSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      token_type: payload.token_type || "bearer",
      scopes: payload.scopes || [],
      expires_at: expiresAt,
    });
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const session = readSession();
    if (session?.access_token && options.auth !== false) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401 && options.auth !== false && session?.refresh_token) {
      const refreshed = await refresh();
      if (refreshed) {
        headers.set("Authorization", `Bearer ${readSession().access_token}`);
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    return response;
  }

  async function loginWithPassword(email, password) {
    const body = new URLSearchParams({
      username: email,
      password,
    });
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível entrar.");
      err.code = data.error || null;
      err.details = data.details || null;
      throw err;
    }
    saveTokens(data);
    return data;
  }

  async function register(email, password, fullName) {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível criar a conta.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function verifyEmail(email, code) {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: String(code).trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Código inválido.");
      err.code = data.error || null;
      throw err;
    }
    saveTokens(data);
    return data;
  }

  async function resendVerification(email) {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível reenviar o código.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function refresh() {
    const session = readSession();
    if (!session?.refresh_token) return false;
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) {
      clearSession();
      return false;
    }
    const data = await response.json();
    saveTokens(data);
    return true;
  }

  async function logout() {
    const session = readSession();
    try {
      if (session?.access_token) {
        await api(`${API_PREFIX}/auth/logout`, {
          method: "POST",
          body: JSON.stringify({ refresh_token: session.refresh_token || null }),
        });
      }
    } catch {
      /* ignore */
    }
    clearSession();
  }

  async function me() {
    const response = await api(`${API_PREFIX}/users/me`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Sessão inválida.");
    }
    return response.json();
  }

  async function providers() {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/providers`);
    if (!response.ok) return { password: true, google: false, discord: false };
    return response.json();
  }

  function isLoggedIn() {
    return Boolean(readSession()?.access_token);
  }

  function requireAuth(redirectTo = "/login.html") {
    if (!isLoggedIn()) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `${redirectTo}?next=${next}`;
      return false;
    }
    return true;
  }

  function oauthStart(provider, intent = "login") {
    const mode = intent === "signup" ? "signup" : "login";
    location.href = `${API_BASE}${API_PREFIX}/auth/${provider}/login?intent=${mode}`;
  }

  async function uploadAvatar(file) {
    const body = new FormData();
    body.append("file", file);
    const response = await api(`${API_PREFIX}/users/me/avatar`, {
      method: "POST",
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Não foi possível enviar a foto.");
    }
    return data;
  }

  function avatarSrc(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
  }

  async function wallet() {
    const response = await api(`${API_PREFIX}/billing/wallet`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Não foi possível ler o saldo.");
    return data;
  }

  async function billingOptions() {
    const response = await fetch(`${API_BASE}${API_PREFIX}/billing/options`);
    if (!response.ok) {
      return { amounts_cents: [2000, 5000, 10000], mercadopago_enabled: false };
    }
    return response.json();
  }

  async function createTopup(amountCents) {
    const response = await api(`${API_PREFIX}/billing/topups`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: amountCents }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Não foi possível criar a recarga.");
    return data;
  }

  async function getTopup(id, sync = true) {
    const response = await api(
      `${API_PREFIX}/billing/topups/${encodeURIComponent(id)}?sync=${sync ? "true" : "false"}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Recarga não encontrada.");
    return data;
  }

  async function listTopups() {
    const response = await api(`${API_PREFIX}/billing/topups`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Não foi possível carregar as transações.");
    }
    return Array.isArray(data) ? data : [];
  }

  global.MuhAuth = {
    API_BASE,
    API_PREFIX,
    saveTokens,
    clearSession,
    readSession,
    loginWithPassword,
    register,
    verifyEmail,
    resendVerification,
    refresh,
    logout,
    me,
    providers,
    isLoggedIn,
    requireAuth,
    oauthStart,
    uploadAvatar,
    avatarSrc,
    wallet,
    billingOptions,
    createTopup,
    getTopup,
    listTopups,
    api,
  };
})(window);
