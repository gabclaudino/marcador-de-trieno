import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError, api } from "../api";
import { formatDate } from "../format";
import type { Exercise, SessionSummary } from "../../shared/schemas";

const PAGE_SIZE = 20;
const fmtKg = (n: number) => String(n).replace(".", ",");
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

type Metric = "max_weight_kg" | "total_reps";
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "max_weight_kg", label: "Carga máxima", unit: "kg" },
  { key: "total_reps", label: "Total de reps", unit: "reps" },
];

export default function Results() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;

  const workout = useQuery({
    queryKey: ["workout", id],
    queryFn: () => api.getWorkout(id),
    enabled: valid,
  });

  const notFound =
    !valid || (workout.error instanceof ApiError && workout.error.status === 404);

  return (
    <>
      <Link to="/" className="btn btn-ghost btn-sm -ml-2 mb-2">
        ← Treinos
      </Link>

      {notFound ? (
        <p className="opacity-60">Treino não encontrado.</p>
      ) : workout.isPending ? (
        <p className="opacity-60">Carregando...</p>
      ) : workout.isError ? (
        <div role="alert" className="alert alert-error alert-soft flex-col items-start">
          <p>Não foi possível carregar o treino.</p>
          <button type="button" className="btn btn-sm" onClick={() => workout.refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold wrap-anywhere">{workout.data.name}</h1>
          <p className="opacity-60 mb-4">Resultados</p>

          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <EvolutionChart exercises={workout.data.exercises} />
            <SessionList workoutId={id} exercises={workout.data.exercises} />
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Gráfico de evolução por exercício
// ---------------------------------------------------------------------------
function EvolutionChart({ exercises }: { exercises: Exercise[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("max_weight_kg");

  const exerciseId = selectedId ?? exercises[0]?.id ?? null;
  const history = useQuery({
    queryKey: ["history", exerciseId],
    queryFn: () => api.exerciseHistory(exerciseId!),
    enabled: exerciseId !== null,
  });
  const current = METRICS.find((m) => m.key === metric)!;

  return (
    <section className="card card-border bg-base-200">
      <div className="card-body p-4 gap-3">
        <h2 className="text-lg font-bold">Evolução</h2>

        {exercises.length === 0 ? (
          <p className="opacity-60">Este treino não tem exercícios.</p>
        ) : (
          <>
            <select
              className="select w-full"
              value={exerciseId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              aria-label="Exercício"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            <div className="join w-full">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`btn join-item flex-1 ${metric === m.key ? "btn-primary" : ""}`}
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {history.isPending ? (
              <p className="opacity-60">Carregando...</p>
            ) : history.isError ? (
              <p className="text-error">Não foi possível carregar o histórico.</p>
            ) : history.data.length === 0 ? (
              <p className="opacity-60">Sem registros deste exercício ainda.</p>
            ) : (
              <div className="h-64 w-full min-w-0 text-base-content">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="var(--color-base-300)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="performed_at"
                      tickFormatter={shortDate}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      stroke="var(--color-base-300)"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      allowDecimals={metric === "max_weight_kg"}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      stroke="var(--color-base-300)"
                    />
                    <Tooltip
                      labelFormatter={(v) => formatDate(String(v))}
                      formatter={(v) => [`${fmtKg(Number(v))} ${current.unit}`, current.label]}
                      contentStyle={{
                        background: "var(--color-base-100)",
                        border: "1px solid var(--color-base-300)",
                        borderRadius: 8,
                        color: "var(--color-base-content)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--color-primary)" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lista de sessões passadas
// ---------------------------------------------------------------------------
function SessionList({ workoutId, exercises }: { workoutId: number; exercises: Exercise[] }) {
  const sessions = useInfiniteQuery({
    queryKey: ["sessions", workoutId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.listSessions(workoutId, PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });

  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const all = sessions.data?.pages.flat() ?? [];

  return (
    <section>
      <h2 className="text-lg font-bold mb-3">Sessões</h2>

      {sessions.isPending ? (
        <p className="opacity-60">Carregando...</p>
      ) : sessions.isError ? (
        <div role="alert" className="alert alert-error alert-soft flex-col items-start">
          <p>Não foi possível carregar as sessões.</p>
          <button type="button" className="btn btn-sm" onClick={() => sessions.refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : all.length === 0 ? (
        <p className="opacity-60">Nenhum treino realizado ainda.</p>
      ) : (
        <>
          <ul className="grid gap-3">
            {all.map((s) => (
              <SessionCard key={s.session_id} session={s} names={names} />
            ))}
          </ul>
          {sessions.hasNextPage && (
            <button
              type="button"
              className="btn btn-block mt-4"
              onClick={() => sessions.fetchNextPage()}
              disabled={sessions.isFetchingNextPage}
            >
              {sessions.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function SessionCard({ session, names }: { session: SessionSummary; names: Map<number, string> }) {
  return (
    <li className="card card-border bg-base-200">
      <div className="card-body p-4 gap-2">
        <h3 className="font-semibold">{formatDate(session.performed_at)}</h3>
        <dl className="grid gap-2">
          {Object.entries(session.sets).map(([exId, sets]) => (
            <div key={exId}>
              <dt className="text-sm font-medium wrap-anywhere">
                {names.get(Number(exId)) ?? "Exercício removido"}
              </dt>
              <dd className="text-sm opacity-70">
                {sets.map((s) => `${s.reps} × ${fmtKg(s.weight_kg)} kg`).join("  ·  ")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
}
