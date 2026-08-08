# Contingência BSP — se a apelação Meta falhar

## Quando acionar

Depois de uma rejeição definitiva do Suporte Direto (ou ausência de botão de
revisão / resposta “unchanged”), sem criar um segundo portfólio “por fora”.

## O que o código já entrega (não desperdice)

A arquitetura atual (Cloud API client, `WhatsAppDispatcher`, templates,
opt-in/opt-out, janela de 24h, webhook oficial) continua válida com um BSP.
O BSP troca o caminho de credencial/endpoint; não a lógica de compliance.

## Critérios de escolha (nessa ordem)

1. SLA documentado de escalonamento junto à Meta (WABA Direct Support).
2. Disposição de onboarding **com histórico declarado** (ban anterior por
   cliente não oficial / protótipo).
3. Custo por conversação no volume inicial baixo.
4. Operação no Brasil (suporte e faturamento).

Candidatos comuns: Zenvia, Take Blip, Infobip, Gupshup, 360dialog, Twilio.

## O que declarar na conversa comercial

- Portfólio `785476310302762` e WABA `2435543643499568` desabilitados em
  2025-06-06 por política comercial / uso não autorizado em protótipo.
- Zero clientes, zero spam, remediação já no código.
- Intenção: produto próprio (assistente sob marca MuhBianco), não Tech Provider
  multi-tenant nesta fase.
- Pedido: onboarding em estrutura limpa **via BSP**, com número novo não-VoIP.

## Número

Não reutilizar o número digital banido. Preferir número móvel ou fixo
tradicional, registrado no WhatsApp Manager pelo fluxo do BSP.

## Checklist pós-contrato

- [ ] Credenciais Cloud API (ou proxy do BSP) em `WHATSAPP_*` / admin senders
- [ ] Webhook `https://api.muhbianco.com.br/api/latest/agents/webhooks/whatsapp`
- [ ] Submeter templates LOCAL_DRAFT (Admin → Templates → Enviar para aprovação)
- [ ] Warm-up: só conversas iniciadas pelo usuário nas primeiras semanas
- [ ] Monitorar quality rating do remetente no admin (sync com a Meta)
