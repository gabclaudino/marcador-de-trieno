import { Hono } from "hono";
import { UpdateExerciseSchema } from "../../shared/schemas";
import type { AuthVariables } from "../auth";
import { buildUpdate, parseId, parseJson } from "../http";

export const exercises = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// PATCH /api/exercises/:id — editar nome, séries, posição ou arquivar
exercises.patch("/:id", async (c) => {
  const id = parseId(c);
  if (!id.ok) return id.res;
  const body = await parseJson(c, UpdateExerciseSchema);
  if (!body.ok) return body.res;

  const upd = buildUpdate(
    "workout_exercises",
    ["name", "target_sets", "position", "archived"],
    body.data,
  );
  if (!upd) return c.json({ error: "nothing_to_update" }, 400);

  const res = await c.env.DB.prepare(upd.sql)
    .bind(...upd.binds, id.data)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  const row = await c.env.DB.prepare(
    `SELECT id, workout_id, name, target_sets, position, archived
       FROM workout_exercises WHERE id = ?`,
  )
    .bind(id.data)
    .first();
  return c.json(row);
});
