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

## n8n (obrigatório uma vez)

Workflow: **MuhBianco Site — Contato** (`gWpBz0tV70eLenXG`)

1. Abra o node **Enviar e-mail**
2. Conecte credencial **Gmail OAuth2** da conta que recebe (ex.: `muhbianco@gmail.com`) com permissão de enviar
3. Ative o workflow
4. O ImprovMX entrega `contato@` na sua caixa; o Gmail envia *para* `contato@` (reply-to = e-mail do visitante)

## Deploy

```bash
./build.sh prod
```

1. Portainer → Stacks → colar `docker-stack.yml`
2. Deploy (sem envs obrigatórios)
3. DNS: `muhbianco.com.br` e `www` apontando para a máquina do Traefik

Imagem: `muhrilobianco/app_site:latest`  
Repo: `muhbianco/app-site`
