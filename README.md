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
- `CONTACT_EMAIL`

## Deploy

```bash
./build.sh prod
```

1. Portainer → Stacks → colar `docker-stack.yml`
2. Deploy (sem envs obrigatórios)
3. DNS: `muhbianco.com.br` e `www` apontando para a máquina do Traefik

Imagem: `muhrilobianco/app_site:latest`  
Repo: `muhbianco/app-site`
