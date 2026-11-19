# SPEC — App de Treino (tracker de cargas)

App pessoal e privado para registrar cargas de treino na academia. Uso principal no celular (durante o treino), com acesso também pelo PC para consultar resultados e evolução. Um único usuário (o dono), em vários dispositivos, sem servidor para ligar/desligar e sem custo.

## 1. Objetivo e requisitos

- Definir treinos configuráveis (ex.: "Peito + Tríceps + Ombro").
- Em cada treino: adicionar/remover/reordenar exercícios e definir o nº de séries por exercício.
- A home mostra a data do último treino realizado de cada treino.
- Ao abrir um treino, mostrar as séries do último treino (reps e carga de cada série) ao lado dos campos da sessão atual.
- Acesso restrito ao dono (um único usuário).
- Sempre disponível (serverless), custo zero (free tier Cloudflare).
- Registro no celular: UI mobile-first, instalável como PWA.
- Consulta no PC: a mesma UI é responsiva (sem app separado) e há uma tela de Resultados com histórico de sessões e evolução de carga por exercício.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite, PWA (`vite-plugin-pwa`) |
| Roteamento | React Router |
| Dados no cliente | TanStack Query |
| API | Cloudflare Workers + Hono (TypeScript) |
| Validação | Zod (compartilhado entre front e API) |
| Banco | Cloudflare D1 (SQLite) |
| Auth | Cloudflare Access (Zero Trust) + validação do JWT no Worker |
| Deploy | Um único projeto Worker com static assets (front + API no mesmo domínio), via `wrangler` |
| Domínio | Domínio já existente no Cloudflare, ex.: `treino.<dominio>` |

Sem servidor próprio, sem TURN, sem MongoDB.

## 3. Estrutura do repositório

```
/
├── wrangler.jsonc
├── package.json
├── migrations/
│   └── 0001_init.sql
├── src/
│   ├── worker/
│   │   ├── index.ts          # app Hono, rotas /api/*
│   │   ├── auth.ts           # validação do JWT do Cloudflare Access
│   │   ├── routes/
│   │   │   ├── workouts.ts
│   │   │   ├── sessions.ts
│   │   │   └── exercises.ts
│   │   └── env.d.ts
│   ├── shared/
│   │   └── schemas.ts        # schemas Zod + tipos
│   └── web/
│       ├── main.tsx
│       ├── api.ts            # cliente fetch tipado
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── EditWorkout.tsx
│       │   ├── RunWorkout.tsx
│       │   └── Results.tsx
│       └── components/
└── vite.config.ts
```

## 4. Modelo de dados (D1)

`migrations/0001_init.sql`:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 20),
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  performed_at TEXT NOT NULL            -- ISO 8601 UTC
);

CREATE TABLE session_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
  UNIQUE (session_id, exercise_id, set_number)
);

CREATE INDEX idx_we_workout ON workout_exercises(workout_id, position);
CREATE INDEX idx_sessions_workout ON sessions(workout_id, performed_at DESC);
CREATE INDEX idx_sets_session ON session_sets(session_id);
```

Regras:
- Remover treino ou exercício = **arquivar** (`archived = 1`), nunca `DELETE`, para preservar o histórico. Listagens filtram `archived = 0`.
- Renomear exercício altera só `workout_exercises.name` (o histórico acompanha por `exercise_id`).

## 5. API (`/api/*`)

Todas as rotas passam pelo middleware de auth (seção 6). Respostas em JSON. Entradas validadas com Zod; erro de validação retorna `400`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workouts` | Lista treinos não arquivados com `last_performed_at` (`MAX(sessions.performed_at)`) |
| POST | `/api/workouts` | Cria treino `{ name }` |
| PATCH | `/api/workouts/:id` | Renomeia/reordena/arquiva |
| GET | `/api/workouts/:id` | Treino com seus exercícios (não arquivados, ordenados por `position`) |
| POST | `/api/workouts/:id/exercises` | Adiciona exercício `{ name, target_sets }` |
| PATCH | `/api/exercises/:id` | Edita `name`, `target_sets`, `position`, `archived` |
| GET | `/api/workouts/:id/last-session` | Última sessão do treino com as séries por exercício (ou `null`) |
| POST | `/api/workouts/:id/sessions` | Registra sessão `{ performed_at, sets: [{ exercise_id, set_number, reps, weight_kg }] }` |
| GET | `/api/workouts/:id/sessions` | Lista paginada de sessões do treino (mais recentes primeiro), com as séries de cada uma |
| GET | `/api/exercises/:id/history` | Histórico de cargas do exercício (gráfico da tela Resultados) |

Detalhes:
- `POST .../sessions` deve inserir a sessão e todas as séries de forma **atômica** (`db.batch`).
- `last-session` retorna `{ session_id, performed_at, sets: { [exercise_id]: [{ set_number, reps, weight_kg }] } }`.
- Reordenação: o cliente envia a lista de ids na nova ordem; a API atualiza `position` em batch.

## 6. Autenticação e segurança

- O domínio/rota inteiro fica atrás de uma **Cloudflare Access application**, com política `Allow` apenas para o e-mail do dono (login por one-time PIN ou Google).
- Duração da sessão do Access configurada no máximo permitido, para não pedir login com frequência no celular. O login é por dispositivo/navegador: o PC faz o próprio login (mesmo e-mail), sem alteração no Worker.
- No Worker, o middleware `auth.ts` **valida o header `Cf-Access-Jwt-Assertion`**:
  - verificar assinatura com as chaves públicas de `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`;
  - verificar `aud` (AUD tag da application) e `iss`;
  - verificar que o claim `email` é igual ao e-mail do dono (var de ambiente `OWNER_EMAIL`);
  - qualquer falha responde `401`.
- Variáveis em `wrangler.jsonc`/secrets: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `OWNER_EMAIL`.
- Sem CORS aberto: front e API ficam na mesma origem.
- Usar sempre queries parametrizadas do D1 (`prepare().bind()`), nunca concatenar strings.
- Em dev local (`wrangler dev`), permitir um bypass de auth controlado por var `DEV_BYPASS_AUTH=true`, que **nunca** deve estar ativa em produção.

## 7. Telas (mobile-first, responsivas para desktop)

Layout base pensado para celular. Em telas largas (≥ 768px) o conteúdo fica centralizado com largura máxima (~720px) e a tela de Resultados usa o espaço extra (tabela/gráfico lado a lado). Alvos de toque grandes no celular; nada depende de hover.

### 7.1 Home
- Lista de treinos (cards): nome + "Último treino: dd/mm/aaaa" (ou "Nunca realizado").
- Botão "Novo treino".
- Toque no card abre `RunWorkout`; ícone de edição abre `EditWorkout`.

### 7.2 Editar treino
- Editar nome do treino; arquivar treino.
- Lista de exercícios: adicionar, remover (arquivar), renomear, reordenar (botões subir/descer; drag-and-drop opcional).
- Por exercício: campo numérico de nº de séries (1–20).

### 7.3 Executar treino
- Para cada exercício, N linhas (N = `target_sets`), cada uma com:
  - referência do último treino: "reps × kg" daquela série (somente leitura, visualmente discreta);
  - inputs de `reps` e `weight_kg` da sessão atual, **pré-preenchidos com os valores do último treino**.
- Inputs numéricos (`inputmode="decimal"` para carga, `numeric` para reps).
- Botão "Finalizar treino" envia `POST /api/workouts/:id/sessions`.
- Se o exercício não tinha séries no treino anterior, os campos começam vazios.
- Rascunho da sessão em andamento salvo em `localStorage`, para não perder dados se o app for fechado ou recarregado durante o treino; limpo ao finalizar.

### 7.4 Resultados (celular e PC)
- Acessível pela Home (por treino).
- Lista de sessões passadas do treino (data + reps × kg por série de cada exercício), via `/api/workouts/:id/sessions`.
- Gráfico de evolução de carga por exercício (Recharts), via `/api/exercises/:id/history`.
- Somente leitura. Os dados vêm sempre do servidor, então o que foi registrado no celular aparece no PC.

### 7.5 Fase 2 (opcional)
- Fila offline (IndexedDB) para enviar sessões quando o sinal voltar.
- Botão exportar JSON (backup).

## 8. PWA

- `manifest` com nome, ícones (192/512), `display: standalone`, `theme_color`.
- Service worker (Workbox via `vite-plugin-pwa`) com cache do app shell; chamadas `/api/*` sempre `NetworkOnly`.
- Instalável via "Adicionar à tela inicial".

## 9. Deploy e configuração

1. `wrangler d1 create treino-db` e colocar o `database_id` no `wrangler.jsonc`.
2. `wrangler d1 migrations apply treino-db --remote`.
3. `wrangler.jsonc`: `assets` apontando para `dist` do Vite, com fallback SPA (`not_found_handling: "single-page-application"`); Worker tratando `/api/*`.
4. `wrangler deploy`.
5. Em Workers → Settings → Domains & Routes, adicionar custom domain `treino.<dominio>`.
6. Zero Trust → Access → Applications: criar application self-hosted para `treino.<dominio>`, com política Allow para o e-mail do dono; copiar AUD tag e team domain para as vars do Worker.
7. Scripts no `package.json`: `dev` (Vite + `wrangler dev`), `build`, `deploy`, `db:migrate:local`, `db:migrate:remote`.

## 10. Critérios de aceite

- [ ] Sem login válido do dono, nenhuma rota (nem o front) é acessível.
- [ ] Criar treino, adicionar/remover/reordenar exercícios e definir nº de séries funciona e persiste.
- [ ] A home mostra a data do último treino de cada treino.
- [ ] Ao abrir um treino, as séries do último treino aparecem (reps e carga por série) e pré-preenchem a sessão atual.
- [ ] Finalizar treino grava sessão + séries atomicamente e atualiza a data na home.
- [ ] Arquivar exercício/treino não apaga histórico.
- [ ] Fechar e reabrir o app no celular mantém todos os dados.
- [ ] App instalável como PWA e utilizável em tela de celular sem zoom/scroll horizontal.
- [ ] No PC (login próprio com o mesmo e-mail), a UI fica legível em tela larga e a tela Resultados mostra o histórico e o gráfico de evolução, incluindo sessões registradas no celular.
- [ ] Nenhum custo: apenas free tier Cloudflare (Workers, D1, Access).

## 11. Fora de escopo

- Multiusuário, cadastro e senhas próprias (um único dono, mas vários dispositivos).
- Sincronização de rascunho em andamento entre dispositivos (o rascunho fica no `localStorage` de cada aparelho).
- Edição de sessões passadas pelo PC (a tela Resultados é só leitura).
- Servidor próprio, TURN, MongoDB ou qualquer serviço pago.
- App nativo.
