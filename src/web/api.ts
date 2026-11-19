import type {
  CreateExercise,
  CreateSession,
  CreateWorkout,
  Exercise,
  HistoryPoint,
  LastSession,
  SessionSummary,
  UpdateExercise,
  UpdateWorkout,
  Workout,
  WorkoutDetail,
  WorkoutListItem,
} from "../shared/schemas";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, code);
  }
  return res.json() as Promise<T>;
}

export const api = {
  ping: () => request<{ ok: boolean; time: string }>("GET", "/api/ping"),

  // Treinos
  listWorkouts: () => request<WorkoutListItem[]>("GET", "/api/workouts"),
  getWorkout: (id: number) => request<WorkoutDetail>("GET", `/api/workouts/${id}`),
  createWorkout: (data: CreateWorkout) => request<Workout>("POST", "/api/workouts", data),
  updateWorkout: (id: number, data: UpdateWorkout) =>
    request<Workout>("PATCH", `/api/workouts/${id}`, data),

  // Exercícios
  createExercise: (workoutId: number, data: CreateExercise) =>
    request<Exercise>("POST", `/api/workouts/${workoutId}/exercises`, data),
  updateExercise: (id: number, data: UpdateExercise) =>
    request<Exercise>("PATCH", `/api/exercises/${id}`, data),
  reorderExercises: (workoutId: number, ids: number[]) =>
    request<{ ok: true }>("PUT", `/api/workouts/${workoutId}/order`, { ids }),

  // Sessões
  lastSession: (workoutId: number) =>
    request<LastSession | null>("GET", `/api/workouts/${workoutId}/last-session`),
  listSessions: (workoutId: number, limit = 20, offset = 0) =>
    request<SessionSummary[]>(
      "GET",
      `/api/workouts/${workoutId}/sessions?limit=${limit}&offset=${offset}`,
    ),
  createSession: (workoutId: number, data: CreateSession) =>
    request<{ session_id: number; performed_at: string }>(
      "POST",
      `/api/workouts/${workoutId}/sessions`,
      data,
    ),
  exerciseHistory: (exerciseId: number) =>
    request<HistoryPoint[]>("GET", `/api/exercises/${exerciseId}/history`),
};
