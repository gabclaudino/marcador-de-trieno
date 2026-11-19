import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../api";
import { clearDraft, loadDraft, saveDraft, setKey, type Draft, type SetValues } from "../draft";
import { formatDate } from "../format";
import type { LastSession, SetInput, WorkoutDetail } from "../../shared/schemas";

const EMPTY: SetValues = { reps: "", weight: "" };
const REPS_RE = /^\d+$/;
const WEIGHT_RE = /^\d+([.,]\d+)?$/;

/** 62.5 -> "62,5" (como o usuário digita em pt-BR). */
const fmtKg = (n: number) => String(n).replace(".", ",");

export default function RunWorkout() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;

  // gcTime 0: ao reabrir o treino, sempre busca o "último treino" atualizado
  // (não pré-preenche com um cache antigo).
  const opts = { enabled: valid, gcTime: 0, refetchOnWindowFocus: false } as const;
  const workout = useQuery({ queryKey: ["run", "workout", id], queryFn: () => api.getWorkout(id), ...opts });
  const last = useQuery({ queryKey: ["run", "last", id], queryFn: () => api.lastSession(id), ...opts });

  const notFound =
    !valid || (workout.error instanceof ApiError && workout.error.status === 404);
  const failed = workout.isError || last.isError;
  const loading = workout.isPending || last.isPending;

  return (
    <>
      <Link to="/" className="btn btn-ghost btn-sm -ml-2 mb-2">
        ← Treinos
      </Link>

      {notFound ? (
        <p className="opacity-60">Treino não encontrado.</p>
      ) : failed ? (
        <div role="alert" className="alert alert-error alert-soft flex-col items-start">
          <p>Não foi possível carregar o treino.</p>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              workout.refetch();
              last.refetch();
            }}
          >
            Tentar de novo
          </button>
        </div>
      ) : loading ? (
        <p className="opacity-60">Carregando...</p>
      ) : (
        <RunForm workout={workout.data!} last={last.data ?? null} />
      )}
    </>
  );
}

function RunForm({ workout, last }: { workout: WorkoutDetail; last: LastSession | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Rascunho lido uma única vez, ao abrir a tela.
  const [initialDraft] = useState(() => loadDraft(workout.id));
  const [values, setValues] = useState<Draft>(initialDraft ?? {});
  const [showRestored, setShowRestored] = useState(initialDraft !== null);
  const [error, setError] = useState<string | null>(null);

  // Valores do último treino, por exercício e nº da série.
  const prefill = useMemo(() => {
    const map: Draft = {};
    if (!last) return map;
    for (const [exId, sets] of Object.entries(last.sets)) {
      for (const s of sets) {
        map[setKey(Number(exId), s.set_number)] = { reps: String(s.reps), weight: fmtKg(s.weight_kg) };
      }
    }
    return map;
  }, [last]);

  const valueOf = (exId: number, n: number): SetValues =>
    values[setKey(exId, n)] ?? prefill[setKey(exId, n)] ?? EMPTY;

  function change(exId: number, n: number, field: keyof SetValues, v: string) {
    const next = { ...values, [setKey(exId, n)]: { ...valueOf(exId, n), [field]: v } };
    setValues(next);
    saveDraft(workout.id, next);
  }

  function discardDraft() {
    clearDraft(workout.id);
    setValues({});
    setShowRestored(false);
  }

  const finish = useMutation({
    mutationFn: (sets: SetInput[]) =>
      api.createSession(workout.id, { performed_at: new Date().toISOString(), sets }),
    onSuccess: () => {
      clearDraft(workout.id);
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.removeQueries({ queryKey: ["run"] });
      navigate("/");
    },
    onError: () => setError("Não foi possível salvar o treino. Seus dados continuam aqui; tente de novo."),
  });

  function submit() {
    setError(null);
    const sets: SetInput[] = [];

    for (const ex of workout.exercises) {
      for (let n = 1; n <= ex.target_sets; n++) {
        const reps = valueOf(ex.id, n).reps.trim();
        const weight = valueOf(ex.id, n).weight.trim();
        if (reps === "" && weight === "") continue; // série não feita

        if (!REPS_RE.test(reps) || !WEIGHT_RE.test(weight)) {
          setError(`Revise a série ${n} de "${ex.name}": informe reps (número inteiro) e carga (kg).`);
          return;
        }
        sets.push({
          exercise_id: ex.id,
          set_number: n,
          reps: Number(reps),
          weight_kg: Number(weight.replace(",", ".")),
        });
      }
    }

    if (sets.length === 0) {
      setError("Preencha ao menos uma série.");
      return;
    }
    finish.mutate(sets);
  }

  if (workout.exercises.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2">{workout.name}</h1>
        <p className="opacity-60 mb-4">Este treino ainda não tem exercícios.</p>
        <Link to={`/workouts/${workout.id}/edit`} className="btn btn-primary">
          Editar treino
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold wrap-anywhere">{workout.name}</h1>
      <p className="opacity-60 mb-4">
        {last ? `Último treino: ${formatDate(last.performed_at)}` : "Primeiro treino: sem histórico ainda"}
      </p>

      {showRestored && (
        <div role="status" className="alert alert-info alert-soft mb-4 flex-wrap justify-between">
          <span>Rascunho restaurado.</span>
          <button type="button" className="btn btn-sm" onClick={discardDraft}>
            Descartar
          </button>
        </div>
      )}

      <ul className="grid gap-4">
        {workout.exercises.map((ex) => (
          <li key={ex.id} className="card card-border bg-base-200">
            <div className="card-body p-3 gap-2">
              <h2 className="font-semibold text-lg wrap-anywhere">{ex.name}</h2>

              <div className="grid grid-cols-[2.5rem_1fr_4rem_5rem] items-center gap-x-2 text-xs opacity-60">
                <span>Série</span>
                <span>Último</span>
                <span className="text-center">Reps</span>
                <span className="text-center">Carga (kg)</span>
              </div>

              {Array.from({ length: ex.target_sets }, (_, i) => i + 1).map((n) => {
                const ref = last?.sets[String(ex.id)]?.find((s) => s.set_number === n);
                const v = valueOf(ex.id, n);
                return (
                  <div key={n} className="grid grid-cols-[2.5rem_1fr_4rem_5rem] items-center gap-x-2">
                    <span className="font-medium">{n}</span>
                    <span className="text-sm opacity-60">
                      {ref ? `${ref.reps} × ${fmtKg(ref.weight_kg)} kg` : "—"}
                    </span>
                    <input
                      className="input w-full px-1 text-center"
                      type="text"
                      inputMode="numeric"
                      value={v.reps}
                      onChange={(e) => change(ex.id, n, "reps", e.target.value)}
                      aria-label={`${ex.name}, série ${n}, repetições`}
                    />
                    <input
                      className="input w-full px-1 text-center"
                      type="text"
                      inputMode="decimal"
                      value={v.weight}
                      onChange={(e) => change(ex.id, n, "weight", e.target.value)}
                      aria-label={`${ex.name}, série ${n}, carga em kg`}
                    />
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-4">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-base-300 bg-base-100/95 p-4 backdrop-blur">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={submit}
          disabled={finish.isPending}
        >
          {finish.isPending ? "Salvando..." : "Finalizar treino"}
        </button>
      </div>
    </>
  );
}
