import { Hono } from "hono";
import {
  CreateExerciseSchema,
  CreateWorkoutSchema,
  ReorderSchema,
  UpdateWorkoutSchema,
  type Exercise,
  type Workout,
  type WorkoutListItem,
} from "../../shared/schemas";
import type { AuthVariables } from "../auth";
import { buildUpdate, parseId, parseJson } from "../http";

export const workouts = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const EXERCISE_COLS = "id, workout_id, name, target_sets, position";

// GET /api/workouts — treinos não arquivados + data do último treino
workouts.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT w.id, w.name, w.position, MAX(s.performed_at) AS last_performed_at
       FROM workouts w
       LEFT JOIN sessions s ON s.workout_id = w.id
      WHERE w.archived = 0
      GROUP BY w.id
      ORDER BY w.position, w.id`,
  ).all<WorkoutListItem>();
  return c.json(results);
});

// POST /api/workouts
workouts.post("/", async (c) => {
  const body = await parseJson(c, CreateWorkoutSchema);
  if (!body.ok) return body.res;

  const row = await c.env.DB.prepare(
    `INSERT INTO workouts (name, position)
     VALUES (?, (SELECT COALESCE(MAX(position), -1) + 1 FROM workouts))
     RETURNING id, name, position`,
  )
    .bind(body.data.name)
    .first<Workout>();
  return c.json(row, 201);
});

// GET /api/workouts/:id — treino com exercícios não arquivados
workouts.get("/:id", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;

  const workout = await c.env.DB.prepare(
    "SELECT id, name, position FROM workouts WHERE id = ? AND archived = 0",
  )
    .bind(id.data)
    .first<Workout>();
  if (!workout) return c.json({ error: "not_found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT ${EXERCISE_COLS} FROM workout_exercises
      WHERE workout_id = ? AND archived = 0
      ORDER BY position, id`,
  )
    .bind(id.data)
    .all<Exercise>();
  return c.json({ ...workout, exercises: results });
});

// PATCH /api/workouts/:id — renomear / reposicionar / arquivar
workouts.patch("/:id", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const body = await parseJson(c, UpdateWorkoutSchema);
  if (!body.ok) return body.res;

  const upd = buildUpdate("workouts", ["name", "position", "archived"], body.data);
  if (!upd) return c.json({ error: "nothing_to_update" }, 400);

  const res = await c.env.DB.prepare(upd.sql)
    .bind(...upd.binds, id.data)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  const row = await c.env.DB.prepare(
    "SELECT id, name, position, archived FROM workouts WHERE id = ?",
  )
    .bind(id.data)
    .first();
  return c.json(row);
});

// POST /api/workouts/:id/exercises
workouts.post("/:id/exercises", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const body = await parseJson(c, CreateExerciseSchema);
  if (!body.ok) return body.res;

  const exists = await c.env.DB.prepare(
    "SELECT 1 AS ok FROM workouts WHERE id = ? AND archived = 0",
  )
    .bind(id.data)
    .first();
  if (!exists) return c.json({ error: "not_found" }, 404);

  const row = await c.env.DB.prepare(
    `INSERT INTO workout_exercises (workout_id, name, target_sets, position)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1
                         FROM workout_exercises WHERE workout_id = ?))
     RETURNING ${EXERCISE_COLS}`,
  )
    .bind(id.data, body.data.name, body.data.target_sets, id.data)
    .first<Exercise>();
  return c.json(row, 201);
});

// PUT /api/workouts/:id/order — reordena exercícios (ids na nova ordem)
workouts.put("/:id/order", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const body = await parseJson(c, ReorderSchema);
  if (!body.ok) return body.res;

  const { results } = await c.env.DB.prepare(
    "SELECT id FROM workout_exercises WHERE workout_id = ? AND archived = 0",
  )
    .bind(id.data)
    .all<{ id: number }>();

  // A lista precisa conter exatamente os exercícios ativos do treino.
  const current = new Set(results.map((r) => r.id));
  const sent = body.data.ids;
  if (current.size === 0 || sent.length !== current.size || !sent.every((x) => current.has(x))) {
    return c.json({ error: "ids_mismatch" }, 400);
  }

  const stmt = c.env.DB.prepare(
    "UPDATE workout_exercises SET position = ? WHERE id = ? AND workout_id = ?",
  );
  await c.env.DB.batch(sent.map((exId, i) => stmt.bind(i, exId, id.data)));
  return c.json({ ok: true });
});
