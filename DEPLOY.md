# DEPLOY — Cloudflare (Workers + D1 + Access)

Passos para publicar o app com acesso restrito ao dono. Tudo no free tier.
O código já está pronto: a API valida o JWT do Cloudflare Access (`src/worker/access.ts`)
e recusa (`401`) qualquer requisição sem login válido do e-mail do dono.

## Antes de começar
- Conta Cloudflare e um domínio já nela (ex.: `treino.seudominio.com`).
- Zero Trust habilitado (plano **Free**, até 50 usuários). Em alguns casos a Cloudflare
  pede um cartão para ativar o plano gratuito; não há cobrança.

## 1. Login e banco de dados

```powershell
npx wrangler login
```

```powershell
npx wrangler d1 create treino-db
```

Copie o `database_id` exibido e troque o placeholder (`0000...`) em `wrangler.jsonc`.

```powershell
npm run db:migrate:remote
```

## 2. Primeiro deploy

```powershell
npm run deploy
```

O Worker sobe **sem** URL pública (`workers_dev` e `preview_urls` estão desligados de propósito:
essas URLs ficariam fora do Access). Ele só responde pelo seu domínio, no passo seguinte.

## 3. Custom domain

Em `wrangler.jsonc`, descomente/adicione (com o seu domínio):

```jsonc
"routes": [{ "pattern": "treino.seudominio.com", "custom_domain": true }],
```

Depois rode `npm run deploy` de novo. A Cloudflare cria o DNS e o certificado sozinha.

## 4. Cloudflare Access (login)

No painel: **Zero Trust → Access → Applications → Add an application → Self-hosted**.

1. **Application domain:** `treino.seudominio.com` (domínio inteiro, sem path, para proteger o app e a API).
2. **Policy:** ação `Allow`, regra `Emails` = o seu e-mail. Não crie outras políticas.
3. **Login method:** *One-time PIN* (código por e-mail) ou Google.
4. **Session duration:** o maior valor disponível, para não pedir login toda hora no celular.
5. Salve e copie o **Application Audience (AUD) Tag** (aba *Overview* da application).
6. O **team domain** está em **Zero Trust → Settings → General** (formato `meutime.cloudflareaccess.com`).

## 5. Segredos do Worker

Os três valores ficam como *secrets* (não vão para o git).

```powershell
npx wrangler secret put ACCESS_TEAM_DOMAIN
```

```powershell
npx wrangler secret put ACCESS_AUD
```

```powershell
npx wrangler secret put OWNER_EMAIL
```

Cole o valor quando o comando pedir. Não é preciso novo deploy.

## 6. Conferir

- Aba anônima em `https://treino.seudominio.com`: deve cair na tela de login do Access.
- Depois do login com o seu e-mail: o app abre e funciona.
- `curl https://treino.seudominio.com/api/workouts` (sem login): não pode devolver dados.
- Celular e PC fazem login separadamente (mesmo e-mail).

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| App abre, mas a API devolve `401` | Secret errado/faltando (principalmente `ACCESS_AUD`), ou e-mail diferente do da policy. Veja `npx wrangler tail`: aparece `auth: ... precisam estar configurados` se faltar algum. |
| Site abre sem pedir login | A Access application não cobre o domínio certo, ou a policy está como `Bypass`. |
| `Error: no such table` na API | Faltou `npm run db:migrate:remote`. |

## Segurança (resumo)
- `DEV_BYPASS_AUTH` só existe em `.dev.vars` (ignorado pelo git e pelo deploy) e, mesmo que alguém
  o defina em produção, o middleware só o aceita para `localhost`/`127.0.0.1`.
- A API valida assinatura (RS256), `iss`, `aud`, expiração e o e-mail do dono; sem configuração, recusa tudo.
- Queries ao D1 são sempre parametrizadas.
