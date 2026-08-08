# Portainer — chaves de ambiente da stack `api-agents`

A stack no Portainer embute os valores no YAML (não usa o formulário Env separado).
Ao editar manualmente, mantenha **somente** estas chaves WhatsApp — nunca recoleque `WUZAPI_*`.

## WhatsApp Cloud API (obrigatórias no YAML)

| Chave | Notas |
|-------|--------|
| `WHATSAPP_GRAPH_BASE_URL` | Default `https://graph.facebook.com/v21.0` |
| `WHATSAPP_ACCESS_TOKEN` | System user token Meta (vazio até a WABA liberar) |
| `WHATSAPP_APP_SECRET` | App secret (assinatura do webhook) |
| `WHATSAPP_VERIFY_TOKEN` | Token do GET de verificação do webhook |
| `WHATSAPP_WABA_ID` | ID da WABA |
| `WHATSAPP_PHONE_NUMBER_ID` | Seed do remetente se `whatsapp_senders` estiver vazio |
| `WHATSAPP_SENDER_PHONE` | Telefone E.164 do seed |
| `WHATSAPP_SENDER_LABEL` | Rótulo do seed |
| `WHATSAPP_SESSION_WINDOW_HOURS` | Default `24` |
| `WA_TEXT_DEBOUNCE_SECONDS` | Debounce de texto inbound |
| `WHATSAPP_WEBHOOK_URL` | Fallback n8n OTP (não é Cloud API) |
| `WHATSAPP_WEBHOOK_SECRET` | Secret do fallback n8n |
| `PHONE_VERIFICATION_TTL_MINUTES` | TTL do OTP |

## Removidas (não recolocar)

`WUZAPI_BASE_URL`, `WUZAPI_TOKEN`, `WUZAPI_HMAC_SECRET`, `WUZAPI_ADMIN_TOKEN`,
`WUZAPI_SHARED_USER_ID`, `WUZAPI_SHARED_PHONE`, `WUZAPI_SHARED_LABEL`

## Manutenção

- Prefira editar o bloco `x-app-env` e deixar API/worker/beat com `<<: *app_env`.
- Não cole o `docker-stack.yml` do Git (valores vazios) por cima da stack de prod.
- Fonte de verdade das *chaves*: `api-agents/docker-stack.yml` no Git.
