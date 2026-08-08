# Checklist — derrubar a infraestrutura não oficial (WuzAPI)

Execute **antes** de abrir a contestação na Meta. Enquanto houver sessão
multi-device ativa ligada ao CNPJ/CPF, o sinal de reincidência permanece.

## Produção

- [ ] Parar o stack/container do WuzAPI (`wuzapi.muhbianco.com.br`)
- [ ] Logout de todas as instâncias / sessões ainda conectadas
- [ ] Remover DNS `wuzapi.muhbianco.com.br` (ou apontar para página offline)
- [ ] Revogar tokens antigos (`WUZAPI_TOKEN`, `WUZAPI_ADMIN_TOKEN`, HMAC)
- [ ] Remover variáveis `WUZAPI_*` dos secrets do Portainer / Docker Swarm
- [ ] Confirmar que `docker-stack.yml` e `.env` de produção usam só `WHATSAPP_*`
- [ ] Desativar workflow n8n que falava com WuzAPI (OTP pode ficar no fallback
      n8n **só** se apontar para Cloud API depois; não reativar whatsmeow)

## Código (já feito neste repositório)

- Pacote `app/services/whatsapp/` no lugar de `wuzapi_client.py`
- Tabela `whatsapp_senders` (migration 0025)
- Templates + dispatcher (migration 0026)
- UI admin/conta sem QR/pareamento/expor
- Documentos legais: `privacidade.html`, `termos.html`

## Verificação rápida

```text
rg -i "wuzapi|whatsmeow" muhbianco_site --glob '!**/venv/**' --glob '!**/.venv/**'
```

Esperado: zero matches em código/config (exceto este doc e o dossiê histórico).
