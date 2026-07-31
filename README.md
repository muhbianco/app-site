# MuhBianco — Site portfólio

Site estático (HTML/CSS/JS + nginx) com home e página de contato.

## Stack

- **Frontend:** HTML estático
- **Servidor:** nginx:alpine
- **Deploy:** Docker Swarm + Traefik (`chatbot-net`)
- **Domínio:** `muhbianco.com.br` (+ redirect `www`)

## Local (sem Docker)

Abra `public/index.html` ou sirva a pasta:

```bash
npx --yes serve public
```

Antes de publicar, ajuste em `public/js/contact.js`:

- `WHATSAPP_NUMBER` — DDI+DDD+número (só dígitos)

O formulário de contato envia `POST /api/contato` (nginx) → webhook n8n  
`https://backn8n.hook.muhbianco.com.br/webhook/site-contato` → e-mail `contato@muhbianco.com.br`.

Cadastro da API Agents chama  
`https://backn8n.hook.muhbianco.com.br/webhook/site-verificacao-email`  
(workflow **MuhBianco Site — Verificação de e-mail**) para enviar o código com From `contato@muhbianco.com.br`.

## n8n (obrigatório uma vez)

Workflow: **MuhBianco Site — Contato** (`gWpBz0tV70eLenXG`)

1. Node **Send email** usa SMTP `mear.mind smtp` → `contato@muhbianco.com.br`
2. Ative o workflow (se ainda estiver inativo)
3. Reply-to = e-mail do visitante

Workflow: **MuhBianco Site — Verificação de e-mail** (`WUu55xGbqhD4LjU1`)

1. Webhook `POST /webhook/site-verificacao-email`
2. Mesma credencial SMTP; From `MuhBianco <contato@muhbianco.com.br>`
3. Body: `{ to, code, full_name, subject?, ttl_minutes?, secret? }`
4. Secret opcional: env `MUHBIANCO_EMAIL_WEBHOOK_SECRET` no n8n = `EMAIL_WEBHOOK_SECRET` na API
5. Ative o workflow

## Deploy

```bash
./build.sh prod
```

1. Portainer → Stacks → colar `docker-stack.yml`
2. Deploy (sem envs obrigatórios)
3. DNS: `muhbianco.com.br` e `www` apontando para a máquina do Traefik

Imagem: `muhrilobianco/app_site:latest`  
Repo: `muhbianco/app-site`
