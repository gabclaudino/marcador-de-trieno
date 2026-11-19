import { Hono } from "hono";
import {
  CreateSessionSchema,
  type HistoryPoint,
  type LastSession,
  type SessionSummary,
  type SetResult,
} from "../../shared/schemas";
import type { AuthVariables } from "../auth";
import { parseId, parseJson } from "../http";

type App = Hono<{ Bindings: Env; Variables: AuthVariables }>;
const newApp = (): App => new Hono();

type SetRow = SetResult & { session_id: number; exercise_id: number };
type SessionRow = { id: number; performed_at: string };

/** Agrupa as séries por exercício: { [exercise_id]: [{ set_number, reps, weight_kg }] } */
function groupSets(rows: SetRow[]): Record<string, SetResult[]> {
  const out: Record<string, SetResult[]> = {};
  for (const r of rows) {
    (out[r.exercise_id] ??= []).push({
      set_number: r.set_number,
      reps: r.reps,
      weight_kg: r.weight_kg,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Montado em /api/workouts
// ---------------------------------------------------------------------------
export const workoutSessions = newApp();

// POST /api/workouts/:id/sessions — sessão + séries, de forma atômica
workoutSessions.post("/:id/sessions", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const body = await parseJson(c, CreateSessionSchema);
  if (!body.ok) return body.res;
  const db = c.env.DB;

  const workout = await db
    .prepare("SELECT 1 AS ok FROM workouts WHERE id = ? AND archived = 0")
    .bind(id.data)
    .first();
  if (!workout) return c.json({ error: "not_found" }, 404);

  // Todas as séries devem referenciar exercícios ativos deste treino.
  const { results } = await db
    .prepare("SELECT id FROM workout_exercises WHERE workout_id = ? AND archived = 0")
    .bind(id.data)
    .all<{ id: number }>();
  const valid = new Set(results.map((r) => r.id));
  if (!body.data.sets.every((s) => valid.has(s.exercise_id))) {
    return c.json({ error: "invalid_exercise" }, 400);
  }

  // Normaliza para ISO com milissegundos: a ordenação textual fica correta.
  const performedAt = new Date(body.data.performed_at).toISOString();

  // db.batch roda numa transação: ou grava tudo, ou nada.
  // O id da sessão recém-criada é a maior id de sessions (dentro da transação).
  const insertSession = db
    .prepare("INSERT INTO sessions (workout_id, performed_at) VALUES (?, ?)")
    .bind(id.data, performedAt);
  const insertSet = db.prepare(
    `INSERT INTO session_sets (session_id, exercise_id, set_number, reps, weight_kg)
     VALUES ((SELECT MAX(id) FROM sessions), ?, ?, ?, ?)`,
  );
  await db.batch([
    insertSession,
    ...body.data.sets.map((s) =>
      insertSet.bind(s.exercise_id, s.set_number, s.reps, s.weight_kg),
    ),
  ]);

  const created = await db
    .prepare("SELECT id, performed_at FROM sessions WHERE workout_id = ? ORDER BY id DESC LIMIT 1")
    .bind(id.data)
    .first<SessionRow>();
  return c.json({ session_id: created!.id, performed_at: created!.performed_at }, 201);
});

// GET /api/workouts/:id/last-session — última sessão (ou null)
workoutSessions.get("/:id/last-session", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const db = c.env.DB;

  const session = await db
    .prepare(
      `SELECT id, performed_at FROM sessions
        WHERE workout_id = ? ORDER BY performed_at DESC, id DESC LIMIT 1`,
    )
    .bind(id.data)
    .first<SessionRow>();
  if (!session) return c.json(null);

  const { results } = await db
    .prepare(
      `SELECT session_id, exercise_id, set_number, reps, weight_kg
         FROM session_sets WHERE session_id = ?
        ORDER BY exercise_id, set_number`,
    )
    .bind(session.id)
    .all<SetRow>();

  const body: LastSession = {
    session_id: session.id,
    performed_at: session.performed_at,
    sets: groupSets(results),
  };
  return c.json(body);
});

// GET /api/workouts/:id/sessions?limit=20&offset=0 — mais recentes primeiro
workoutSessions.get("/:id/sessions", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const db = c.env.DB;

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 100);
  const offset = Math.min(Math.max(Number(c.req.query("offset") ?? 0) || 0, 0), 100_000);

  const { results: sessions } = await db
    .prepare(
      `SELECT id, performed_at FROM sessions
        WHERE workout_id = ?
        ORDER BY performed_at DESC, id DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(id.data, limit, offset)
    .all<SessionRow>();
  if (sessions.length === 0) return c.json([] satisfies SessionSummary[]);

  const placeholders = sessions.map(() => "?").join(",");
  const { results: sets } = await db
    .prepare(
      `SELECT session_id, exercise_id, set_number, reps, weight_kg
         FROM session_sets WHERE session_id IN (${placeholders})
        ORDER BY exercise_id, set_number`,
    )
    .bind(...sessions.map((s) => s.id))
    .all<SetRow>();

  const bySession = new Map<number, SetRow[]>();
  for (const r of sets) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r);
    bySession.set(r.session_id, list);
  }

  const body: SessionSummary[] = sessions.map((s) => ({
    session_id: s.id,
    performed_at: s.performed_at,
    sets: groupSets(bySession.get(s.id) ?? []),
  }));
  return c.json(body);
});

// ---------------------------------------------------------------------------
// Montado em /api/exercises
// ---------------------------------------------------------------------------
export const exerciseHistory = newApp();

// GET /api/exercises/:id/history — carga máxima e total de reps por sessão
exerciseHistory.get("/:id/history", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const db = c.env.DB;

  const exists = await db
    .prepare("SELECT 1 AS ok FROM workout_exercises WHERE id = ?")
    .bind(id.data)
    .first();
  if (!exists) return c.json({ error: "not_found" }, 404);

  const { results } = await db
    .prepare(
      `SELECT s.id AS session_id,
              s.performed_at,
              MAX(ss.weight_kg) AS max_weight_kg,
              SUM(ss.reps) AS total_reps
         FROM session_sets ss
         JOIN sessions s ON s.id = ss.session_id
        WHERE ss.exercise_id = ?
        GROUP BY s.id
        ORDER BY s.performed_at, s.id`,
    )
    .bind(id.data)
    .all<HistoryPoint>();
  return c.json(results);
});
