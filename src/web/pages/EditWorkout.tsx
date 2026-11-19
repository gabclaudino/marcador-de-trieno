import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../api";
import AddExerciseForm from "../components/AddExerciseForm";
import ExerciseRow from "../components/ExerciseRow";
import type { Exercise, UpdateExercise, WorkoutDetail } from "../../shared/schemas";

export default function EditWorkout() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;

  const workout = useQuery({
    queryKey: ["workout", id],
    queryFn: () => api.getWorkout(id),
    enabled: valid,
  });

  return (
    <>
      <Link to="/" className="btn btn-ghost btn-sm -ml-2 mb-2">
        ← Treinos
      </Link>

      {!valid || (workout.isError && workout.error instanceof ApiError && workout.error.status === 404) ? (
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
        <EditForm workout={workout.data} />
      )}
    </>
  );
}

function EditForm({ workout }: { workout: WorkoutDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const key = ["workout", workout.id] as const;
  const [name, setName] = useState(workout.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Marca se alguma gravação falhou desde o último clique em "Salvar".
  const failed = useRef(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["workouts"] });
  };

  const rename = useMutation({
    mutationFn: (n: string) => api.updateWorkout(workout.id, { name: n }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: () => {
      failed.current = true;
      setName(workout.name);
      setError("Não foi possível renomear o treino.");
    },
  });

  const archive = useMutation({
    mutationFn: () => api.updateWorkout(workout.id, { archived: true }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      navigate("/");
    },
    onError: () => {
      failed.current = true;
      setError("Não foi possível arquivar o treino.");
    },
  });

  const updateExercise = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateExercise; onFail: () => void }) =>
      api.updateExercise(id, data),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (_e, vars) => {
      failed.current = true;
      vars.onFail();
      setError("Não foi possível salvar o exercício.");
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.reorderExercises(workout.id, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WorkoutDetail>(key);
      if (previous) {
        const byId = new Map(previous.exercises.map((e) => [e.id, e]));
        queryClient.setQueryData<WorkoutDetail>(key, {
          ...previous,
          exercises: ids.map((i) => byId.get(i)!),
        });
      }
      return { previous };
    },
    onError: (_e, _ids, ctx) => {
      failed.current = true;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      setError("Não foi possível reordenar.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const removeExercise = useMutation({
    mutationFn: (ex: Exercise) => api.updateExercise(ex.id, { archived: true }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: () => {
      failed.current = true;
      setError("Não foi possível remover o exercício.");
    },
  });

  const busy = reorder.isPending || removeExercise.isPending;
  const { exercises } = workout;

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) return setName(workout.name);
    setName(trimmed);
    if (trimmed !== workout.name) rename.mutate(trimmed);
  }

  function move(exId: number, dir: -1 | 1) {
    const ids = exercises.map((e) => e.id);
    const i = ids.indexOf(exId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  }

  function remove(ex: Exercise) {
    if (window.confirm(`Remover "${ex.name}" do treino? O histórico é mantido.`)) {
      removeExercise.mutate(ex);
    }
  }

  /**
   * "Salvar": confirma o campo que ainda está sendo editado (o blur dispara a gravação),
   * espera todas as gravações em andamento terminarem e volta para a Home.
   * Se alguma falhar, fica na tela com a mensagem de erro.
   */
  async function save() {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    failed.current = false;
    setError(null);
    setSaving(true);

    (document.activeElement as HTMLElement | null)?.blur();
    await wait(0);
    const deadline = Date.now() + 10_000;
    while (queryClient.isMutating() > 0 && Date.now() < deadline) await wait(40);

    setSaving(false);
    if (failed.current) return; // a mensagem de erro já foi mostrada
    if (queryClient.isMutating() > 0) {
      setError("Demorou demais para salvar. Verifique a conexão e tente de novo.");
      return;
    }
    navigate("/");
  }

  function archiveWorkout() {
    if (window.confirm(`Arquivar o treino "${workout.name}"? O histórico é mantido.`)) {
      archive.mutate();
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Editar treino</h1>

      <label className="grid gap-1.5">
        <span className="opacity-60">Nome do treino</span>
        <input
          className="input w-full"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </label>

      <h2 className="text-lg font-bold mt-6 mb-3">Exercícios</h2>
      {exercises.length === 0 ? (
        <p className="opacity-60">Nenhum exercício ainda. Adicione o primeiro abaixo.</p>
      ) : (
        <ul className="grid gap-3">
          {exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              disabled={busy}
              onUpdate={(exId, data, onFail) => updateExercise.mutate({ id: exId, data, onFail })}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <div className="mt-6">
        <AddExerciseForm workoutId={workout.id} />
      </div>

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-4">
          {error}
        </div>
      )}

      <div className="mt-6 border-t border-base-300 pt-4">
        <button type="button" className="btn btn-error btn-outline" onClick={archiveWorkout} disabled={archive.isPending}>
          Arquivar treino
        </button>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-base-300 bg-base-100/95 p-4 backdrop-blur">
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </>
  );
}
