/**
 * Contato — WhatsApp e e-mail.
 * Ajuste WHATSAPP_NUMBER (DDI+DDD+número, só dígitos) e CONTACT_EMAIL.
 */
const WHATSAPP_NUMBER = "5511999999999";
const CONTACT_EMAIL = "contato@muhbianco.com.br";

const form = document.getElementById("contact-form");
const statusEl = document.getElementById("form-status");
const btnEmail = document.getElementById("btn-email");
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

form?.addEventListener("submit", (event) => {
  event.preventDefault();
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

btnEmail?.addEventListener("click", () => {
  const fields = readForm();
  const error = validate(fields);
  if (error) {
    setStatus(error, true);
    return;
  }

  const subject = encodeURIComponent(`[MuhBianco] ${fields.interest} — ${fields.name}`);
  const body = encodeURIComponent(buildMessage(fields));
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  setStatus("Abrindo seu cliente de e-mail…");
});
