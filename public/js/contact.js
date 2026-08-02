/**
 * Contato — envia para o n8n (webhook) e opcionalmente WhatsApp.
 * Tipos: agentes | orcamento | suporte (via ?tipo= ou #hash).
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
const interestSelect = document.getElementById("contact-interest");
const titleEl = document.getElementById("contact-title");
const ledeEl = document.getElementById("contact-lede");

const TYPE_PRESETS = {
  agentes: {
    title: "Agentes",
    lede: "Dúvida comercial do catálogo ou sugestão de um agente novo para a área logada.",
    match: /^Agente:/i,
    wa: "Olá! Vim pelo site sobre os agentes MuhBianco.",
  },
  agente: {
    title: "Sugerir um agente",
    lede: "Conta a dor que você quer resolver — usamos isso para priorizar o próximo agente.",
    match: /sugestão/i,
    preferValue: "Agente: sugestão de novo agente",
    wa: "Olá! Quero sugerir um agente novo na MuhBianco.",
  },
  orcamento: {
    title: "Pedido de orçamento",
    lede: "Projeto sob demanda: descreva o cenário que montamos a estimativa.",
    match: /^Orçamento:/i,
    wa: "Olá! Quero um orçamento de solução sob demanda.",
  },
  suporte: {
    title: "Suporte",
    lede: "Para quem já é cliente: conta, saldo, cobrança ou o agente em uso.",
    match: /^Suporte:/i,
    wa: "Olá! Preciso de suporte na conta MuhBianco.",
  },
};

function resolveTipo() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = (params.get("tipo") || "").trim().toLowerCase();
  if (fromQuery && TYPE_PRESETS[fromQuery]) return fromQuery;
  const hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (hash && TYPE_PRESETS[hash]) return hash;
  return "";
}

function applyTipoPreset(tipo) {
  const preset = TYPE_PRESETS[tipo];
  if (!preset || !interestSelect) return;

  if (titleEl) titleEl.textContent = preset.title;
  if (ledeEl) ledeEl.textContent = preset.lede;

  const options = Array.from(interestSelect.options);
  let chosen = null;
  if (preset.preferValue) {
    chosen = options.find((opt) => opt.value === preset.preferValue) || null;
  }
  if (!chosen) {
    chosen = options.find((opt) => opt.value && preset.match.test(opt.value)) || null;
  }
  if (chosen) {
    interestSelect.value = chosen.value;
  }

  if (waDirect) {
    waDirect.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(preset.wa)}`;
  }
}

if (waDirect) {
  waDirect.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Vim pelo site muhbianco.com.br.")}`;
}

if (emailDirect) {
  emailDirect.href = `mailto:${CONTACT_EMAIL}`;
  emailDirect.textContent = CONTACT_EMAIL;
}

applyTipoPreset(resolveTipo());

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
    return "Preencha nome, e-mail, tipo de contato e mensagem.";
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
    `Tipo: ${fields.interest}`,
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
    applyTipoPreset(resolveTipo());
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
