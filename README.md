# Marcador de Treino

App pessoal para registrar as cargas do treino na academia. Pensado para o **celular** (durante o treino) e
com uma tela de **resultados** que funciona bem no **PC**. Roda 100% *serverless* no free tier da Cloudflare
(Workers + D1 + Access), sem servidor próprio e sem custo.

> Projeto de estudo/uso pessoal, com um único usuário (o dono). Não é multiusuário.

## Funcionalidades

- **Treinos configuráveis**: crie treinos (ex.: "Peito + Tríceps + Ombro"), adicione, renomeie, reordene e remova
  exercícios e defina o número de séries (1 a 20) de cada um.
- **Home** com a data do último treino realizado de cada treino.
- **Executar treino**: cada série mostra o que você fez da última vez (reps × kg) e os campos já vêm
  **pré-preenchidos** com esses valores. Há **rascunho automático** (se fechar o app no meio do treino, nada se perde).
- **Resultados**: gráfico de evolução de carga por exercício e histórico de sessões (celular e PC).
- **Arquivar em vez de apagar**: treinos e exercícios removidos somem das listas, mas o histórico é preservado.
- **Tema** claro (emerald) e escuro (dark), com botão de troca.
- **PWA**: instalável na tela inicial do celular; o app abre mesmo sem internet (os dados continuam exigindo conexão).
- **Acesso restrito ao dono** via Cloudflare Access, com validação do JWT também na API.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, TypeScript, Vite, React Router, TanStack Query |
| UI | Tailwind CSS v4 + daisyUI (temas `emerald` e `dark`), Recharts (gráficos) |
| PWA | `vite-plugin-pwa` (Workbox) |
| API | Cloudflare Workers + [Hono](https://hono.dev) |
| Validação | [Zod](https://zod.dev), com os schemas compartilhados entre front e API |
| Banco | Cloudflare D1 (SQLite) |
| Auth | Cloudflare Access + validação do JWT no Worker ([`jose`](https://github.com/panva/jose)) |
| Testes | Vitest |

Um único Worker serve o front (arquivos estáticos) e a API (`/api/*`) no mesmo domínio.

## Rodando localmente

Pré-requisitos: **Node.js 22+** e npm. Não é preciso conta Cloudflare para desenvolver.

```bash
npm install
cp .dev.vars.example .dev.vars    # liga o bypass de auth, só para desenvolvimento local
npm run db:migrate:local          # cria as tabelas no D1 local
npm run dev                       # http://localhost:5173
```

> No Windows (PowerShell), troque o `cp` por `Copy-Item .dev.vars.example .dev.vars`.

O `.dev.vars` está no `.gitignore`. O bypass (`DEV_BYPASS_AUTH=true`) só funciona em `localhost`/`127.0.0.1`;
em qualquer outro host ele é ignorado.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Front + Worker + D1 local, com hot reload |
| `npm run build` | Checa os tipos e gera o build de produção (`dist/`) |
| `npm run preview` | Serve o build localmente (aqui o service worker fica ativo) |
| `npm run typecheck` | Só a checagem de tipos (`tsc -b`) |
| `npm test` | Testes (Vitest) |
| `npm run pwa:icons` | Regenera os ícones PNG a partir de `public/icon.svg` |
| `npm run db:migrate:local` / `db:migrate:remote` | Aplica as migrations no D1 local / remoto |
| `npm run deploy` | Build + `wrangler deploy` |

## Estrutura

```
├── migrations/            # SQL do D1 (0001_init.sql)
├── public/                # ícones, theme-init.js e _headers (CSP e demais headers de segurança)
├── src/
│   ├── shared/schemas.ts  # schemas Zod + tipos (usados no front e na API)
│   ├── worker/            # API (Hono)
│   │   ├── index.ts       #   monta o app, headers e rotas
│   │   ├── auth.ts        #   middleware de autenticação
│   │   ├── access.ts      #   validação do JWT do Cloudflare Access
│   │   └── routes/        #   workouts, exercises, sessions
│   └── web/               # front (React)
│       ├── pages/         #   Home, EditWorkout, RunWorkout, Results
│       ├── components/    #   cards, linhas de exercício, layout, tema
│       ├── api.ts         #   cliente da API, tipado
│       └── draft.ts       #   rascunho do treino em andamento (localStorage)
├── wrangler.jsonc         # configuração do Worker/D1
└── vite.config.ts         # Vite + Tailwind + PWA + plugin da Cloudflare
```

## Modelo de dados (D1)

`workouts` → `workout_exercises` (exercícios de cada treino) e `workouts` → `sessions` → `session_sets`
(séries realizadas: exercício, nº da série, reps e carga). Remover = marcar `archived = 1`, nunca `DELETE`,
para o histórico continuar íntegro. Detalhes em [`migrations/0001_init.sql`](migrations/0001_init.sql).

## API

Tudo em `/api/*`, JSON, com entrada validada por Zod (erro de validação → `400`).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workouts` | Treinos ativos, com `last_performed_at` |
| POST | `/api/workouts` | Cria treino |
| GET / PATCH | `/api/workouts/:id` | Treino com exercícios / renomear, reordenar, arquivar |
| POST | `/api/workouts/:id/exercises` | Adiciona exercício |
| PUT | `/api/workouts/:id/order` | Reordena os exercícios (`{ ids: [...] }`) |
| PATCH | `/api/exercises/:id` | Edita nome, séries, posição ou arquiva |
| POST | `/api/workouts/:id/sessions` | Registra uma sessão (sessão + séries, de forma atômica) |
| GET | `/api/workouts/:id/last-session` | Última sessão do treino (ou `null`) |
| GET | `/api/workouts/:id/sessions` | Sessões passadas, paginadas (`limit`, `offset`) |
| GET | `/api/exercises/:id/history` | Evolução de carga do exercício (alimenta o gráfico) |

## Segurança

- **Cloudflare Access** protege o domínio inteiro (política `Allow` só para o e-mail do dono).
- A API **valida o JWT** do Access em toda requisição: assinatura (RS256), `iss`, `aud`, expiração e e-mail.
  Sem configuração, recusa tudo (falha fechada).
- `workers.dev` e URLs de preview ficam **desligados**, para só o domínio protegido responder.
- Queries sempre **parametrizadas**; entradas com **limites de tamanho**; API com `Cache-Control: no-store`.
- Front com **CSP restritiva** e demais headers (`public/_headers`).
- Segredos (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `OWNER_EMAIL`) ficam como *secrets* do Worker, nunca no repositório.

## Deploy

O passo a passo (login, banco D1, domínio, Access e secrets) está em **[DEPLOY.md](DEPLOY.md)**.

> **Importante:** dar `git push` **não** publica o app. O deploy é manual, com `npm run deploy`.

Se for reaproveitar este repositório (fork), troque no `wrangler.jsonc` o `database_id` e o domínio em `routes`
pelos da sua conta (`wrangler d1 create treino-db` gera um novo ID) e cadastre os seus secrets.

## Documentos

- [SPEC.md](SPEC.md): requisitos e decisões do projeto
- [PLANO.md](PLANO.md): plano de implementação por fases
- [DEPLOY.md](DEPLOY.md): como publicar na Cloudflare

## Licença

[MIT](LICENSE)
