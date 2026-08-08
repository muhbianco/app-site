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

  async function enableService(code, { termsAccepted = false, marketingOptIn = false } = {}) {
    const body = {
      terms_accepted: Boolean(termsAccepted),
      marketing_opt_in: Boolean(marketingOptIn),
    };
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

  async function agentWaStatus(code) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/status`
    );
    return jsonOrThrow(response, "Não foi possível consultar o status WhatsApp.");
  }

  async function setMarketingOptIn(code, accepted) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/agent-whatsapp/marketing-opt-in`,
      { method: "PUT", body: JSON.stringify({ accepted: Boolean(accepted) }) }
    );
    return jsonOrThrow(response, "Não foi possível atualizar o consentimento de marketing.");
  }

  async function disableService(code, { immediateRefund = false } = {}) {
    const response = await api(`${API_PREFIX}/services/${encodeURIComponent(code)}/disable`, {
      method: "POST",
      body: JSON.stringify({ immediate_refund: Boolean(immediateRefund) }),
    });
    return jsonOrThrow(response, "Não foi possível cancelar o serviço.");
  }

  async function reactivateService(code) {
    const response = await api(
      `${API_PREFIX}/services/${encodeURIComponent(code)}/reactivate`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível reativar a assinatura.");
  }

  // ---------- Modais de confirmação / aviso (substitui alert/confirm nativos) ----------
  let modalScrollY = 0;

  function syncModalScrollLock() {
    const anyOpen = Boolean(document.querySelector("dialog[open]"));
    const root = document.documentElement;
    if (anyOpen) {
      if (!root.classList.contains("modal-open")) {
        modalScrollY = window.scrollY || window.pageYOffset || 0;
        root.classList.add("modal-open");
        document.body.classList.add("modal-open");
        document.body.style.top = `-${modalScrollY}px`;
      }
      return;
    }
    if (!root.classList.contains("modal-open")) return;
    root.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
    document.body.style.top = "";
    window.scrollTo(0, modalScrollY);
  }

  function openAppDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    syncModalScrollLock();
  }

  function ensureAppConfirmDialog() {
    let dialog = document.getElementById("app-confirm-dialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "app-confirm-dialog";
    dialog.className = "terms-dialog";
    dialog.setAttribute("aria-labelledby", "app-confirm-title");
    dialog.innerHTML = `
      <form class="terms-dialog-card" method="dialog" id="app-confirm-form">
        <header class="terms-dialog-head">
          <h2 id="app-confirm-title">Confirmar</h2>
          <button type="button" class="btn btn-ghost btn-compact" id="app-confirm-x" aria-label="Fechar">
            Fechar
          </button>
        </header>
        <p class="hint" id="app-confirm-message"></p>
        <div class="balance-actions" id="app-confirm-actions">
          <button type="submit" class="btn btn-primary" id="app-confirm-ok" value="confirm">Confirmar</button>
          <button type="submit" class="btn btn-ghost" id="app-confirm-cancel" value="cancel">Cancelar</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    dialog.addEventListener("close", syncModalScrollLock);
    return dialog;
  }

  function confirmModal({
    title = "Confirmar",
    message = "",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
  } = {}) {
    return new Promise((resolve) => {
      const dialog = ensureAppConfirmDialog();
      const titleEl = dialog.querySelector("#app-confirm-title");
      const msgEl = dialog.querySelector("#app-confirm-message");
      const okBtn = dialog.querySelector("#app-confirm-ok");
      const cancelBtn = dialog.querySelector("#app-confirm-cancel");
      const closeBtn = dialog.querySelector("#app-confirm-x");
      const form = dialog.querySelector("#app-confirm-form");

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmLabel;
      okBtn.className = danger ? "btn btn-primary" : "btn btn-primary";
      if (cancelLabel) {
        cancelBtn.hidden = false;
        cancelBtn.textContent = cancelLabel;
      } else {
        cancelBtn.hidden = true;
      }

      const finish = (value) => {
        if (finish.settled) return;
        finish.settled = true;
        form.removeEventListener("submit", onSubmit);
        closeBtn.removeEventListener("click", onClose);
        dialog.removeEventListener("cancel", onEsc);
        if (dialog.open) dialog.close();
        resolve(value);
      };
      finish.settled = false;
      const onSubmit = (event) => {
        event.preventDefault();
        const submitter = event.submitter;
        const value = submitter && submitter.value === "confirm";
        finish(Boolean(value));
      };
      const onClose = () => finish(false);
      const onEsc = (event) => {
        event.preventDefault();
        finish(false);
      };

      form.addEventListener("submit", onSubmit);
      closeBtn.addEventListener("click", onClose);
      dialog.addEventListener("cancel", onEsc);
      openAppDialog(dialog);
    });
  }

  function alertModal({ title = "Aviso", message = "", okLabel = "OK" } = {}) {
    return confirmModal({
      title,
      message,
      confirmLabel: okLabel,
      cancelLabel: null,
    }).then(() => undefined);
  }

  /**
   * Header da área logada: avatar + engrenagem com dropdown (config, saldo, sair).
   * @param {{ root: HTMLElement, user?: object, settingsHref?: string, balanceHref?: string }} opts
   */
  function mountAccountMenu({
    root,
    user = null,
    settingsHref = "/conta.html#configuracoes",
    balanceHref = "/conta.html#saldo",
  } = {}) {
    if (!root) return null;

    root.innerHTML = `
      <div class="account-menu">
        <button type="button" class="account-menu-trigger" aria-expanded="false" aria-haspopup="menu" aria-controls="account-menu-dropdown" id="account-menu-trigger">
          <span class="account-menu-avatar" aria-hidden="true">
            <img class="account-menu-img" alt="" hidden />
            <span class="account-menu-fallback">?</span>
          </span>
          <span class="account-menu-gear" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
              <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
            </svg>
          </span>
        </button>
        <div class="account-menu-dropdown" id="account-menu-dropdown" role="menu" hidden>
          <div class="account-menu-meta">
            <strong class="account-menu-name">Conta</strong>
            <span class="account-menu-email"></span>
          </div>
          <a class="account-menu-item" role="menuitem" href="${settingsHref}">Configurações de conta</a>
          <a class="account-menu-item" role="menuitem" href="${balanceHref}">Adicionar saldo</a>
          <button type="button" class="account-menu-item account-menu-logout" role="menuitem">Sair</button>
        </div>
      </div>
    `;

    const menu = root.querySelector(".account-menu");
    const trigger = root.querySelector(".account-menu-trigger");
    const dropdown = root.querySelector(".account-menu-dropdown");
    const img = root.querySelector(".account-menu-img");
    const fallback = root.querySelector(".account-menu-fallback");
    const nameEl = root.querySelector(".account-menu-name");
    const emailEl = root.querySelector(".account-menu-email");
    const logoutBtn = root.querySelector(".account-menu-logout");

    function setOpen(open) {
      dropdown.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      menu.classList.toggle("is-open", open);
    }

    function applyUser(u) {
      if (!u) return;
      const first = (u.full_name || u.email || "?").trim().charAt(0).toUpperCase() || "?";
      fallback.textContent = first;
      nameEl.textContent = u.full_name || "Conta";
      emailEl.textContent = u.email || "";
      const src = avatarSrc(u.avatar_url);
      if (src) {
        img.hidden = false;
        img.src = src;
        img.alt = "";
        fallback.hidden = true;
      } else {
        img.hidden = true;
        img.removeAttribute("src");
        fallback.hidden = false;
      }
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(dropdown.hidden);
    });

    logoutBtn.addEventListener("click", async () => {
      setOpen(false);
      await logout();
      location.href = "/login.html";
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target)) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    dropdown.querySelectorAll("a.account-menu-item").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    if (user) applyUser(user);

    return {
      applyUser,
      setOpen,
      root: menu,
    };
  }

  async function kbSettings() {
    const response = await api(`${API_PREFIX}/personal-agent/settings`);
    return jsonOrThrow(response, "Não foi possível carregar o agente KB.");
  }

  async function kbPatchSettings(payload) {
    const response = await api(`${API_PREFIX}/personal-agent/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    return jsonOrThrow(response, "Não foi possível salvar as configurações.");
  }

  async function kbListDocuments(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.source_kind) query.set("source_kind", params.source_kind);
    if (params.active === true || params.active === false) {
      query.set("active", params.active ? "true" : "false");
    }
    const qs = query.toString();
    const response = await api(
      `${API_PREFIX}/personal-agent/documents${qs ? `?${qs}` : ""}`
    );
    return jsonOrThrow(response, "Não foi possível listar documentos.");
  }

  async function kbListTools() {
    const response = await api(`${API_PREFIX}/personal-agent/tools`);
    return jsonOrThrow(response, "Não foi possível listar ferramentas.");
  }

  async function kbCreateTool(payload) {
    const response = await api(`${API_PREFIX}/personal-agent/tools`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
    return jsonOrThrow(response, "Não foi possível criar a ferramenta.");
  }

  async function kbUpdateTool(toolId, payload) {
    const response = await api(
      `${API_PREFIX}/personal-agent/tools/${encodeURIComponent(toolId)}`,
      { method: "PATCH", body: JSON.stringify(payload || {}) }
    );
    return jsonOrThrow(response, "Não foi possível atualizar a ferramenta.");
  }

  async function kbDeleteTool(toolId) {
    const response = await api(
      `${API_PREFIX}/personal-agent/tools/${encodeURIComponent(toolId)}`,
      { method: "DELETE" }
    );
    return jsonOrThrow(response, "Não foi possível remover a ferramenta.");
  }

  async function kbTestTool(toolId, argumentsPayload) {
    const response = await api(
      `${API_PREFIX}/personal-agent/tools/${encodeURIComponent(toolId)}/test`,
      {
        method: "POST",
        body: JSON.stringify({ arguments: argumentsPayload || {} }),
      }
    );
    return jsonOrThrow(response, "Não foi possível testar a ferramenta.");
  }

  async function kbListSchedules() {
    const response = await api(`${API_PREFIX}/personal-agent/schedules`);
    return jsonOrThrow(response, "Não foi possível listar agendamentos.");
  }

  async function kbCreateSchedule(payload) {
    const response = await api(`${API_PREFIX}/personal-agent/schedules`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
    return jsonOrThrow(response, "Não foi possível criar o agendamento.");
  }

  async function kbUpdateSchedule(scheduleId, payload) {
    const response = await api(
      `${API_PREFIX}/personal-agent/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "PATCH", body: JSON.stringify(payload || {}) }
    );
    return jsonOrThrow(response, "Não foi possível atualizar o agendamento.");
  }

  async function kbDeleteSchedule(scheduleId) {
    const response = await api(
      `${API_PREFIX}/personal-agent/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "DELETE" }
    );
    return jsonOrThrow(response, "Não foi possível remover o agendamento.");
  }

  async function kbTestSchedule(scheduleId) {
    const response = await api(
      `${API_PREFIX}/personal-agent/schedules/${encodeURIComponent(scheduleId)}/test`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível testar o agendamento.");
  }

  async function kbUploadDocument(file, title) {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    const response = await api(`${API_PREFIX}/personal-agent/documents/upload`, {
      method: "POST",
      body: form,
    });
    return jsonOrThrow(response, "Não foi possível enviar o documento.");
  }

  async function kbIngestUrl(url, title) {
    const response = await api(`${API_PREFIX}/personal-agent/documents/url`, {
      method: "POST",
      body: JSON.stringify({ url, title: title || null }),
    });
    return jsonOrThrow(response, "Não foi possível ingerir a URL.");
  }

  async function kbActivateDocument(documentId) {
    const response = await api(
      `${API_PREFIX}/personal-agent/documents/${encodeURIComponent(documentId)}/activate`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível ativar a versão.");
  }

  async function kbArchiveDocument(documentId) {
    const response = await api(
      `${API_PREFIX}/personal-agent/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );
    return jsonOrThrow(response, "Não foi possível arquivar.");
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

  async function adminLlmTurns(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.user_id) qs.set("user_id", params.user_id);
    if (params.search) qs.set("search", params.search);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    const response = await api(`${API_PREFIX}/agents/admin/llm-turns?${qs.toString()}`);
    return jsonOrThrow(response, "Não foi possível carregar os turnos de LLM.");
  }

  async function adminListLlmModels(capability) {
    const qs = new URLSearchParams();
    if (capability) qs.set("capability", capability);
    const response = await api(
      `${API_PREFIX}/services/admin/llm-models?${qs.toString()}`
    );
    const data = await jsonOrThrow(response, "Não foi possível carregar os modelos.");
    return Array.isArray(data) ? data : [];
  }

  async function adminSyncLlmModels() {
    const response = await api(`${API_PREFIX}/services/admin/llm-models/sync`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível sincronizar os modelos.");
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

  async function adminListWhatsAppSenders() {
    const response = await api(`${API_PREFIX}/services/admin/whatsapp-senders`);
    return jsonOrThrow(response, "Não foi possível carregar os números oficiais.");
  }

  async function adminCreateWhatsAppSender({
    phone,
    phoneNumberId,
    wabaId,
    label,
    serviceId,
    accessToken,
  } = {}) {
    const body = {
      phone: String(phone || "").trim(),
      phone_number_id: String(phoneNumberId || "").trim(),
    };
    if (label) body.label = String(label).trim();
    if (serviceId) body.service_id = String(serviceId).trim();
    if (wabaId) body.waba_id = String(wabaId).trim();
    if (accessToken) body.access_token = String(accessToken).trim();
    const response = await api(`${API_PREFIX}/services/admin/whatsapp-senders`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return jsonOrThrow(response, "Não foi possível cadastrar o número oficial.");
  }

  async function adminUpdateWhatsAppSender(id, patch) {
    const body = {};
    if (patch.label !== undefined) body.label = patch.label;
    if (patch.service_id !== undefined) body.service_id = patch.service_id;
    if (patch.waba_id !== undefined) body.waba_id = patch.waba_id;
    if (patch.is_active !== undefined) body.is_active = Boolean(patch.is_active);
    if (patch.access_token !== undefined) body.access_token = patch.access_token;
    if (patch.clear_access_token) body.clear_access_token = true;
    const response = await api(
      `${API_PREFIX}/services/admin/whatsapp-senders/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    return jsonOrThrow(response, "Não foi possível atualizar o número oficial.");
  }

  async function adminSyncWhatsAppSenders() {
    const response = await api(`${API_PREFIX}/services/admin/whatsapp-senders/sync`, {
      method: "POST",
    });
    return jsonOrThrow(response, "Não foi possível sincronizar com a Meta.");
  }

  async function adminDeleteWhatsAppSender(id) {
    const response = await api(
      `${API_PREFIX}/services/admin/whatsapp-senders/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (response.status === 204) return null;
    return jsonOrThrow(response, "Não foi possível excluir o número oficial.");
  }

  async function adminListTemplates({ category, status } = {}) {
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    if (status) query.set("status", status);
    const qs = query.toString();
    const response = await api(`${API_PREFIX}/templates${qs ? `?${qs}` : ""}`);
    return jsonOrThrow(response, "Não foi possível carregar os templates.");
  }

  async function adminListTemplateEvents() {
    const response = await api(`${API_PREFIX}/templates/events`);
    return jsonOrThrow(response, "Não foi possível carregar os eventos de template.");
  }

  async function adminCreateTemplate(payload) {
    const response = await api(`${API_PREFIX}/templates`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return jsonOrThrow(response, "Não foi possível criar o template.");
  }

  async function adminUpdateTemplate(id, payload) {
    const response = await api(`${API_PREFIX}/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return jsonOrThrow(response, "Não foi possível atualizar o template.");
  }

  async function adminDeleteTemplate(id) {
    const response = await api(`${API_PREFIX}/templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.status === 204) return null;
    return jsonOrThrow(response, "Não foi possível excluir o template.");
  }

  async function adminSubmitTemplate(id) {
    const response = await api(
      `${API_PREFIX}/templates/${encodeURIComponent(id)}/submit`,
      { method: "POST" }
    );
    return jsonOrThrow(response, "Não foi possível enviar o template à Meta.");
  }

  async function adminSyncTemplates() {
    const response = await api(`${API_PREFIX}/templates/sync`, { method: "POST" });
    return jsonOrThrow(response, "Não foi possível sincronizar os templates.");
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
    agentWaStatus,
    setMarketingOptIn,
    disableService,
    reactivateService,
    openAppDialog,
    syncModalScrollLock,
    confirmModal,
    alertModal,
    mountAccountMenu,
    kbSettings,
    kbPatchSettings,
    kbListDocuments,
    kbListTools,
    kbCreateTool,
    kbUpdateTool,
    kbDeleteTool,
    kbTestTool,
    kbListSchedules,
    kbCreateSchedule,
    kbUpdateSchedule,
    kbDeleteSchedule,
    kbTestSchedule,
    kbUploadDocument,
    kbIngestUrl,
    kbActivateDocument,
    kbArchiveDocument,
    financeDashboard,
    financeEntries,
    adminListServices,
    adminListServiceSubscriptions,
    adminUpdateService,
    adminListTopups,
    adminListWallets,
    adminCreditWallet,
    adminLlmUsage,
    adminLlmTurns,
    adminListLlmModels,
    adminSyncLlmModels,
    adminRefundTopup,
    adminCancelTopup,
    adminListWhatsAppSenders,
    adminCreateWhatsAppSender,
    adminUpdateWhatsAppSender,
    adminSyncWhatsAppSenders,
    adminDeleteWhatsAppSender,
    adminListTemplates,
    adminListTemplateEvents,
    adminCreateTemplate,
    adminUpdateTemplate,
    adminDeleteTemplate,
    adminSubmitTemplate,
    adminSyncTemplates,
    cancelTopup,
    adminPauseSubscription,
    adminResumeSubscription,
    adminPingSubscription,
    adminCancelSubscription,
    api,
  };
})(window);
