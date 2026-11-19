# PLANO — Implementação gradual

Cada fase termina em algo funcionando e testável. Só passe para a próxima quando o "Pronto quando" da atual estiver ok. Sugestão: um commit (ou mais) por fase.

Referência: [SPEC.md](SPEC.md).

---

## Fase 0 — Preparação
- [ ] Instalar Node.js LTS; `npx wrangler login`.
- [ ] Commitar `SPEC.md` e este plano.
- [ ] Criar `.gitignore` (`node_modules`, `dist`, `.wrangler`, `.dev.vars`).

**Pronto quando:** `node -v` e `npx wrangler whoami` funcionam.

## Fase 1 — Scaffold do projeto
- [ ] `package.json` com React, React Router, TanStack Query, Vite, TypeScript, Hono, Zod, Wrangler.
- [ ] `tsconfig` (front e worker), `vite.config.ts`.
- [ ] `wrangler.jsonc` com `assets` -> `dist` (SPA fallback) e `main` -> `src/worker/index.ts`.
- [ ] Estrutura de pastas da seção 3 da spec, com arquivos mínimos.
- [ ] Scripts: `dev`, `build`, `deploy`, `db:migrate:local`, `db:migrate:remote`.

**Pronto quando:** `npm run dev` abre uma página React e `GET /api/ping` responde JSON pelo Worker.

## Fase 2 — Banco e schemas compartilhados
- [ ] `wrangler d1 create treino-db`; `database_id` no `wrangler.jsonc`.
- [ ] `migrations/0001_init.sql` (seção 4 da spec).
- [ ] `npm run db:migrate:local`.
- [ ] `src/shared/schemas.ts`: schemas Zod e tipos (workout, exercise, session, set, payloads).

**Pronto quando:** tabelas existem no D1 local (`wrangler d1 execute ... "SELECT name FROM sqlite_master"`).

## Fase 3 — Auth (somente modo dev)
- [ ] Middleware `auth.ts` com `DEV_BYPASS_AUTH=true` via `.dev.vars`.
- [ ] Sem bypass e sem header, responder `401`.
- [ ] Deixar a validação real do JWT (com `jose`) como stub/TODO para a Fase 9.

**Pronto quando:** `/api/*` funciona local com bypass e retorna 401 sem ele.

## Fase 4 — API de treinos e exercícios
- [ ] `GET/POST /api/workouts` (com `last_performed_at`), `PATCH /api/workouts/:id`, `GET /api/workouts/:id`.
- [ ] `POST /api/workouts/:id/exercises`, `PATCH /api/exercises/:id`.
- [ ] Reordenação: definir contrato (ex.: `PUT /api/workouts/:id/order` com lista de ids) e atualizar `position` em `db.batch`.
- [ ] Arquivar em vez de apagar; listagens filtram `archived = 0`.
- [ ] Validação Zod -> `400`; queries sempre com `prepare().bind()`.

**Pronto quando:** fluxo completo testado com `curl` (criar treino, add exercício, reordenar, arquivar).

## Fase 5 — API de sessões
- [ ] `POST /api/workouts/:id/sessions`: sessão + séries atômicas com `db.batch`.
- [ ] `GET /api/workouts/:id/last-session` no formato da spec (ou `null`), tratando exercícios arquivados.
- [ ] `GET /api/workouts/:id/sessions` (paginada, mais recentes primeiro, com séries).
- [ ] `GET /api/exercises/:id/history` (série temporal de carga por exercício).

**Pronto quando:** registrar duas sessões via `curl` e ver `last-session` devolver a mais recente, e `sessions`/`history` listarem as duas.

## Fase 6 — Frontend base e Home
- [ ] `main.tsx` com Router + QueryClient; `api.ts` fetch tipado usando os tipos Zod.
- [ ] Layout mobile-first (viewport, CSS base, sem scroll horizontal), já responsivo: container centralizado com largura máxima em telas ≥ 768px.
- [ ] **Home:** cards com nome e "Último treino: dd/mm/aaaa" / "Nunca realizado"; botão "Novo treino".

**Pronto quando:** criar um treino pela UI e vê-lo listado.

## Fase 7 — Editar treino
- [ ] Renomear e arquivar treino.
- [ ] Exercícios: adicionar, renomear, arquivar, campo de séries (1–20).
- [ ] Reordenar com botões subir/descer.

**Pronto quando:** todas as edições persistem após recarregar.

## Fase 8 — Executar treino
- [ ] N linhas por exercício (`target_sets`), com referência discreta do último treino (reps × kg).
- [ ] Inputs pré-preenchidos com o último treino (`inputmode` numérico/decimal); vazios se não houver histórico.
- [ ] Rascunho em `localStorage` (restaura ao reabrir, limpa ao finalizar).
- [ ] "Finalizar treino" -> `POST` da sessão, invalida cache e volta para a Home.

**Pronto quando:** a data na Home atualiza e o treino seguinte mostra os valores da sessão anterior.

## Fase 9 — Resultados (celular e PC)
- [ ] Página `Results.tsx`, acessível pela Home por treino (somente leitura).
- [ ] Lista de sessões passadas com reps × kg por série.
- [ ] Gráfico de evolução de carga por exercício (Recharts), com seletor de exercício.
- [ ] Layout para tela larga (tabela e gráfico lado a lado em ≥ 768px); testar no navegador do PC e no celular.

**Pronto quando:** uma sessão registrada pela UI aparece na lista e no gráfico, legível tanto em 375px quanto em 1280px.

## Fase 10 — Segurança real e deploy
- [ ] Validação do JWT (`jose`): assinatura (JWKS do team domain), `aud`, `iss`, `email == OWNER_EMAIL`.
- [ ] Vars: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `OWNER_EMAIL`; garantir `DEV_BYPASS_AUTH` fora da produção.
- [ ] `db:migrate:remote`, `wrangler deploy`, custom domain `treino.<dominio>`.
- [ ] Cloudflare Access: application self-hosted + política Allow só para o seu e-mail; sessão com duração máxima.

**Pronto quando:** sem login o domínio não abre; com login o app funciona em produção, no celular e no PC (cada um faz o próprio login com o mesmo e-mail).

## Fase 11 — PWA
- [ ] `vite-plugin-pwa`: manifest (nome, ícones 192/512, `standalone`, `theme_color`).
- [ ] Service worker com cache do app shell; `/api/*` em `NetworkOnly`.
- [ ] Testar instalação no celular e ausência de zoom/scroll horizontal.

**Pronto quando:** "Adicionar à tela inicial" funciona e o app abre em modo standalone.

## Fase 12 — Extras da spec (opcional)
- [ ] Fila offline (IndexedDB) para enviar sessões sem sinal.
- [ ] Exportar JSON (backup).

---

## Checklist final (critérios de aceite)
Revisar a seção 10 da spec ao fim da Fase 11.
