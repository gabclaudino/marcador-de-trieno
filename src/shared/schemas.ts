import { z } from "zod";

// ---------- Primitivos ----------
const id = z.number().int().positive();
const name = z.string().trim().min(1).max(100);
const targetSets = z.number().int().min(1).max(20);
const reps = z.number().int().min(0).max(10_000);
const weightKg = z.number().min(0).max(5_000);

/** Tetos para impedir corpos gigantes (a API é só do dono, mas o D1 tem custo/limites). */
export const MAX_SETS_PER_SESSION = 500;
export const MAX_REORDER_IDS = 100;

// ---------- Entidades ----------
export const WorkoutSchema = z.object({
  id,
  name,
  position: z.number().int(),
});
export type Workout = z.infer<typeof WorkoutSchema>;

/** Item da listagem da Home. */
export const WorkoutListItemSchema = WorkoutSchema.extend({
  last_performed_at: z.string().nullable(),
});
export type WorkoutListItem = z.infer<typeof WorkoutListItemSchema>;

export const ExerciseSchema = z.object({
  id,
  workout_id: id,
  name,
  target_sets: targetSets,
  position: z.number().int(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const WorkoutDetailSchema = WorkoutSchema.extend({
  exercises: z.array(ExerciseSchema),
});
export type WorkoutDetail = z.infer<typeof WorkoutDetailSchema>;

// ---------- Payloads de entrada ----------
export const CreateWorkoutSchema = z.object({ name });
export type CreateWorkout = z.infer<typeof CreateWorkoutSchema>;

export const UpdateWorkoutSchema = z
  .object({
    name: name.optional(),
    position: z.number().int().min(0).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo");
export type UpdateWorkout = z.infer<typeof UpdateWorkoutSchema>;

export const CreateExerciseSchema = z.object({
  name,
  target_sets: targetSets.default(3),
});
export type CreateExercise = z.infer<typeof CreateExerciseSchema>;

export const UpdateExerciseSchema = z
  .object({
    name: name.optional(),
    target_sets: targetSets.optional(),
    position: z.number().int().min(0).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo");
export type UpdateExercise = z.infer<typeof UpdateExerciseSchema>;

/** Reordenação: ids dos exercícios na nova ordem. */
export const ReorderSchema = z.object({
  ids: z
    .array(id)
    .min(1)
    .max(MAX_REORDER_IDS)
    .refine((a) => new Set(a).size === a.length, "ids repetidos"),
});
export type Reorder = z.infer<typeof ReorderSchema>;

// ---------- Sessões ----------
export const SetInputSchema = z.object({
  exercise_id: id,
  set_number: z.number().int().min(1).max(20),
  reps,
  weight_kg: weightKg,
});
export type SetInput = z.infer<typeof SetInputSchema>;

export const CreateSessionSchema = z.object({
  performed_at: z.iso.datetime(),
  sets: z
    .array(SetInputSchema)
    .min(1)
    .max(MAX_SETS_PER_SESSION)
    .refine(
      (sets) =>
        new Set(sets.map((s) => `${s.exercise_id}:${s.set_number}`)).size === sets.length,
      "séries duplicadas (exercise_id + set_number)",
    ),
});
export type CreateSession = z.infer<typeof CreateSessionSchema>;

// ---------- Respostas de leitura ----------
export const SetResultSchema = z.object({
  set_number: z.number().int(),
  reps,
  weight_kg: weightKg,
});
export type SetResult = z.infer<typeof SetResultSchema>;

/** Resposta de GET /api/workouts/:id/last-session (ou null). */
export const LastSessionSchema = z.object({
  session_id: id,
  performed_at: z.string(),
  sets: z.record(z.string(), z.array(SetResultSchema)), // chave = exercise_id
});
export type LastSession = z.infer<typeof LastSessionSchema>;

/** Item de GET /api/workouts/:id/sessions (tela Resultados). */
export const SessionSummarySchema = LastSessionSchema;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/** Ponto de GET /api/exercises/:id/history. */
export const HistoryPointSchema = z.object({
  session_id: id,
  performed_at: z.string(),
  max_weight_kg: weightKg,
  total_reps: z.number().int(),
});
export type HistoryPoint = z.infer<typeof HistoryPointSchema>;
