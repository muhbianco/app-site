/**
 * Contato — envia para o n8n (webhook) e opcionalmente WhatsApp.
 * Ajuste WHATSAPP_NUMBER se mudar o número.
 */
const WHATSAPP_NUMBER = "5511910432912";
const CONTACT_EMAIL = "contato@muhbianco.com.br";
const CONTACT_WEBHOOK_URL = "/api/contato";

const form = document.getElementById("contact-form");
const statusEl = document.getElementById("form-status");
const btnSubmit = document.getElementById("btn-submit");
const btnWhatsapp = document.getElementById("btn-whatsapp");
const waDirect = document.getElementById("wa-direct");
const emailDirect = document.getElementById("email-direct");

if (waDirect) {
  waDirect.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Vim pelo site muhbianco.com.br.")}`;
}

if (emailDirect) {
  emailDirect.href = `mailto:${CONTACT_EMAIL}`;
  emailDirect.textContent = CONTACT_EMAIL;
}

function readForm() {
  const data = new FormData(form);
  return {
    name: String(data.get("name") || "").trim(),
    email: String(data.get("email") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    interest: String(data.get("interest") || "").trim(),
    message: String(data.get("message") || "").trim(),
    honeypot: String(data.get("honeypot") || "").trim(),
  };
}

function validate(fields) {
  if (!fields.name || !fields.email || !fields.interest || !fields.message) {
    return "Preencha nome, e-mail, interesse e mensagem.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return "Informe um e-mail válido.";
  }
  return "";
}

function buildMessage(fields) {
  return [
    `Olá! Contato pelo site muhbianco.com.br.`,
    ``,
    `Nome: ${fields.name}`,
    `E-mail: ${fields.email}`,
    fields.phone ? `Telefone: ${fields.phone}` : null,
    `Interesse: ${fields.interest}`,
    ``,
    fields.message,
  ]
    .filter(Boolean)
    .join("\n");
}

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function setLoading(loading) {
  if (!btnSubmit) return;
  btnSubmit.disabled = loading;
  btnSubmit.textContent = loading ? "Enviando…" : "Enviar mensagem";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = readForm();
  const error = validate(fields);
  if (error) {
    setStatus(error, true);
    return;
  }

  setLoading(true);
  setStatus("Enviando…");

  try {
    const response = await fetch(CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(fields),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || "Falha ao enviar. Tente WhatsApp ou e-mail direto.");
    }

    setStatus(payload?.message || "Mensagem enviada! Em breve retorno.");
    form.reset();
  } catch (err) {
    setStatus(err?.message || "Não foi possível enviar agora. Use WhatsApp ou e-mail.", true);
  } finally {
    setLoading(false);
  }
});

btnWhatsapp?.addEventListener("click", () => {
  const fields = readForm();
  const error = validate(fields);
  if (error) {
    setStatus(error, true);
    return;
  }

  const text = encodeURIComponent(buildMessage(fields));
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener,noreferrer");
  setStatus("Abrindo WhatsApp com sua mensagem…");
});
