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
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fieldErrors = data.details && Array.isArray(data.details.campos)
        ? data.details.campos.map((item) => item.erro).filter(Boolean)
        : [];
      const message =
        fieldErrors[0] || data.message || "Não foi possível criar a conta.";
      const err = new Error(message);
      err.code = data.error || null;
      err.details = data.details || null;
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

  async function requestPasswordReset(email) {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível pedir a redefinição.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function confirmPasswordReset(token, newPassword, confirmPassword) {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível redefinir a senha.");
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

  function oauthStart(provider) {
    location.href = `${API_BASE}${API_PREFIX}/auth/${provider}/login`;
  }

  async function sendEmailVerification() {
    const response = await api(`${API_PREFIX}/users/me/email-verification`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível enviar o código.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function confirmEmailVerification(code) {
    const response = await api(`${API_PREFIX}/users/me/email-verification/confirm`, {
      method: "POST",
      body: JSON.stringify({ code: String(code).trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Código inválido.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function sendPhoneVerification(phone) {
    const response = await api(`${API_PREFIX}/users/me/phone-verification`, {
      method: "POST",
      body: JSON.stringify({ phone: String(phone).trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Não foi possível enviar o código.");
      err.code = data.error || null;
      throw err;
    }
    return data;
  }

  async function confirmPhoneVerification(code) {
    const response = await api(`${API_PREFIX}/users/me/phone-verification/confirm`, {
      method: "POST",
      body: JSON.stringify({ code: String(code).trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Código inválido.");
      err.code = data.error || null;
      throw err;
    }
    return data;
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

  async function listLedger(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.direction) qs.set("direction", params.direction);
    if (params.entry_type) qs.set("entry_type", params.entry_type);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    const response = await api(`${API_PREFIX}/billing/ledger?${qs.toString()}`);
    return jsonOrThrow(response, "Não foi possível carregar o extrato.");
  }

  async function adminListLedger(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.direction) qs.set("direction", params.direction);
    if (params.entry_type) qs.set("entry_type", params.entry_type);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    const response = await api(`${API_PREFIX}/billing/admin/ledger?${qs.toString()}`);
    return jsonOrThrow(response, "Não foi possível carregar o extrato.");
  }

  async function jsonOrThrow(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || fallback);
      err.code = data.error || null;
      err.details = data.details || null;
      throw err;
    }
    return data;
  }

  async function listServices() {
    const response = await api(`${API_PREFIX}/services`);
    const data = await jsonOrThrow(response, "Não foi possível carregar os serviços.");
    return Array.isArray(data) ? data : [];
  }

  async function enableService(code, { termsAccepted = false, waMode = null } = {}) {
    const body = { terms_accepted: Boolean(termsAccepted) };
    if (waMode) body.wa_mode = waMode;
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/enable`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return jsonOrThrow(response, "Não foi possível habilitar o serviço.");
  }

  async function addServicePhone(code, phone) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/phones`, {
      method: "POST",
      body: JSON.stringify({ phone: String(phone).trim() }),
    });
    return jsonOrThrow(response, "Não foi possível adicionar o número.");
  }

  async function confirmServiceExtraPhone(code, phone, verificationCode) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/phones/confirm`,
      {
        method: "POST",
        body: JSON.stringify({
          phone: String(phone).trim(),
          code: String(verificationCode).trim(),
        }),
      }
    );
    return jsonOrThrow(response, "Código inválido.");
  }

  async function removeServicePhone(code, bindingId) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/phones/${encodeURIComponent(bindingId)}`,
      { method: "DELETE" }
    );
    return jsonOrThrow(response, "Não foi possível remover o número.");
  }

  async function resendServiceCode(code) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/resend-code`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível reenviar o código.");
  }

  async function confirmServicePhone(code, verificationCode) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/confirm-phone`,
      { method: "POST", body: JSON.stringify({ code: String(verificationCode).trim() }) }
    );
    return jsonOrThrow(response, "Código inválido.");
  }

  async function pauseService(code) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/pause`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível pausar o agente.");
  }

  async function resumeService(code) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/resume`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível retomar o agente.");
  }

  async function pingServiceContact(code) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/ping-contact`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível enviar a mensagem do agente.");
  }

  async function updateServicePreferences(code, preferences) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/preferences`,
      { method: "PATCH", body: JSON.stringify(preferences) }
    );
    return jsonOrThrow(response, "Não foi possível salvar as preferências.");
  }

  async function setAgentWaMode(code, waMode) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/mode`,
      { method: "POST", body: JSON.stringify({ wa_mode: waMode }) }
    );
    return jsonOrThrow(response, "Não foi possível alterar o modo WhatsApp.");
  }

  async function agentWaStatus(code) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/status`
    );
    return jsonOrThrow(response, "Não foi possível consultar o status WhatsApp.");
  }

  async function agentWaQr(code) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/qr`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível gerar o QR.");
  }

  async function agentWaPair(code, phone) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/pair`,
      { method: "POST", body: JSON.stringify({ phone }) }
    );
    return jsonOrThrow(response, "Não foi possível pedir o código de pareamento.");
  }

  async function disableService(code, { immediateRefund = false } = {}) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/disable`, {
      method: "POST",
      body: JSON.stringify({ immediate_refund: Boolean(immediateRefund) }),
    });
    return jsonOrThrow(response, "Não foi possível cancelar o serviço.");
  }

  async function kbSettings() {
    const response = await api(`${API_PREFIX}/kb/settings`);
    return jsonOrThrow(response, "Não foi possível carregar o agente KB.");
  }

  async function kbPatchSettings(payload) {
    const response = await api(`${API_PREFIX}/kb/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    return jsonOrThrow(response, "Não foi possível salvar as configurações.");
  }

  async function kbListDocuments() {
    const response = await api(`${API_PREFIX}/kb/documents`);
    return jsonOrThrow(response, "Não foi possível listar documentos.");
  }

  async function kbUploadDocument(file, title) {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    const response = await api(`${API_PREFIX}/kb/documents/upload`, {
      method: "POST",
      body: form,
    });
    return jsonOrThrow(response, "Não foi possível enviar o documento.");
  }

  async function kbIngestUrl(url, title) {
    const response = await api(`${API_PREFIX}/kb/documents/url`, {
      method: "POST",
      body: JSON.stringify({ url, title: title || null }),
    });
    return jsonOrThrow(response, "Não foi possível ingerir a URL.");
  }

  async function kbActivateDocument(documentId) {
    const response = await api(
      `${API_PREFIX}/kb/documents/${encodeURIComponent(documentId)}/activate`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível ativar a versão.");
  }

  async function kbArchiveDocument(documentId) {
    const response = await api(
      `${API_PREFIX}/kb/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );
    return jsonOrThrow(response, "Não foi possível arquivar.");
  }

  async function kbSetWaMode(waMode) {
    const response = await api(`${API_PREFIX}/kb/whatsapp/mode`, {
      method: "POST",
      body: JSON.stringify({ wa_mode: waMode }),
    });
    return jsonOrThrow(response, "Não foi possível alterar o modo WhatsApp.");
  }

  async function kbWaQr() {
    const response = await api(`${API_PREFIX}/kb/whatsapp/qr`, { method: "POST" });
    return jsonOrThrow(response, "Não foi possível gerar o QR.");
  }

  async function kbWaPair(phone) {
    const form = new FormData();
    form.append("phone", phone);
    const response = await api(`${API_PREFIX}/kb/whatsapp/pair`, {
      method: "POST",
      body: form,
    });
    return jsonOrThrow(response, "Não foi possível pedir o código.");
  }

  async function adminListServices() {
    const response = await api(`${API_PREFIX}/services/admin/catalog`);
    const data = await jsonOrThrow(response, "Não foi possível carregar o catálogo.");
    return Array.isArray(data) ? data : [];
  }

  async function adminListServiceSubscriptions(serviceId, params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const response = await api(
      `${API_PREFIX}/services/admin/catalog/${encodeURIComponent(serviceId)}/subscriptions?${qs.toString()}`
    );
    return jsonOrThrow(response, "Não foi possível carregar os assinantes do serviço.");
  }

  async function adminUpdateService(serviceId, payload) {
    const response = await api(
      `${API_PREFIX}/services/admin/catalog/${encodeURIComponent(serviceId)}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
    return jsonOrThrow(response, "Não foi possível salvar o serviço.");
  }

  async function adminListTopups(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    const response = await api(`${API_PREFIX}/billing/admin/topups?${qs.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Não foi possível carregar as transações.");
    }
    return data;
  }

  async function adminListWallets(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.is_active === true || params.is_active === false) {
      qs.set("is_active", String(params.is_active));
    }
    const response = await api(`${API_PREFIX}/billing/admin/wallets?${qs.toString()}`);
    return jsonOrThrow(response, "Não foi possível carregar os usuários.");
  }

  async function adminCreditWallet(userId, { amountCents, description, idempotencyKey } = {}) {
    const body = { amount_cents: Number(amountCents) };
    if (description) body.description = String(description).trim();
    if (idempotencyKey) body.idempotency_key = String(idempotencyKey);
    const response = await api(
      `${API_PREFIX}/billing/admin/wallets/${encodeURIComponent(userId)}/credit`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return jsonOrThrow(response, "Não foi possível conceder o saldo.");
  }

  async function adminLlmUsage(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    if (params.only_with_usage === false) qs.set("only_with_usage", "false");
    const response = await api(`${API_PREFIX}/agents/admin/llm-usage?${qs.toString()}`);
    return jsonOrThrow(response, "Não foi possível carregar o uso de LLM.");
  }

  async function adminRefundTopup(id) {
    const response = await api(`${API_PREFIX}/billing/admin/topups/${encodeURIComponent(id)}/refund`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Não foi possível estornar.");
    return data;
  }

  async function adminCancelTopup(id) {
    const response = await api(`${API_PREFIX}/billing/admin/topups/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Não foi possível cancelar.");
    return data;
  }

  async function cancelTopup(id) {
    const response = await api(`${API_PREFIX}/billing/topups/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível cancelar a recarga.");
  }

  async function adminPauseSubscription(userServiceId) {
    const response = await api(
      `${API_PREFIX}/services/admin/subscriptions/${encodeURIComponent(userServiceId)}/pause`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível pausar o agente.");
  }

  async function adminResumeSubscription(userServiceId) {
    const response = await api(
      `${API_PREFIX}/services/admin/subscriptions/${encodeURIComponent(userServiceId)}/resume`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível retomar o agente.");
  }

  async function adminPingSubscription(userServiceId) {
    const response = await api(
      `${API_PREFIX}/services/admin/subscriptions/${encodeURIComponent(userServiceId)}/ping-contact`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível enviar a mensagem do agente.");
  }

  async function adminCancelSubscription(userServiceId) {
    const response = await api(
      `${API_PREFIX}/services/admin/subscriptions/${encodeURIComponent(userServiceId)}/cancel`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível cancelar a assinatura.");
  }

  async function financeDashboard() {
    const response = await api(`${API_PREFIX}/finance/dashboard`);
    return jsonOrThrow(response, "Não foi possível carregar o dashboard financeiro.");
  }

  async function financeEntries(params = {}) {
    const query = new URLSearchParams();
    if (params.inicio) query.set("inicio", params.inicio);
    if (params.fim) query.set("fim", params.fim);
    if (params.tipo) query.set("tipo", params.tipo);
    if (params.status) query.set("status", params.status);
    if (params.item) query.set("item", params.item);
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    // Compat: callers antigos ainda podem passar limite.
    if (params.limite && !params.page_size) query.set("page_size", String(params.limite));
    const qs = query.toString();
    const response = await api(
      `${API_PREFIX}/finance/entries${qs ? `?${qs}` : ""}`
    );
    return jsonOrThrow(response, "Não foi possível carregar os lançamentos.");
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
    requestPasswordReset,
    confirmPasswordReset,
    refresh,
    logout,
    me,
    providers,
    isLoggedIn,
    requireAuth,
    oauthStart,
    sendEmailVerification,
    confirmEmailVerification,
    sendPhoneVerification,
    confirmPhoneVerification,
    uploadAvatar,
    avatarSrc,
    wallet,
    billingOptions,
    createTopup,
    getTopup,
    listTopups,
    listLedger,
    adminListLedger,
    listServices,
    enableService,
    addServicePhone,
    confirmServiceExtraPhone,
    removeServicePhone,
    resendServiceCode,
    confirmServicePhone,
    pauseService,
    resumeService,
    pingServiceContact,
    updateServicePreferences,
    setAgentWaMode,
    agentWaStatus,
    agentWaQr,
    agentWaPair,
    disableService,
    kbSettings,
    kbPatchSettings,
    kbListDocuments,
    kbUploadDocument,
    kbIngestUrl,
    kbActivateDocument,
    kbArchiveDocument,
    kbSetWaMode,
    kbWaQr,
    kbWaPair,
    financeDashboard,
    financeEntries,
    adminListServices,
    adminListServiceSubscriptions,
    adminUpdateService,
    adminListTopups,
    adminListWallets,
    adminCreditWallet,
    adminLlmUsage,
    adminRefundTopup,
    adminCancelTopup,
    cancelTopup,
    adminPauseSubscription,
    adminResumeSubscription,
    adminPingSubscription,
    adminCancelSubscription,
    api,
  };
})(window);
