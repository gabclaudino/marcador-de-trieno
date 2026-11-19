import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import NewWorkoutForm from "../components/NewWorkoutForm";
import WorkoutCard from "../components/WorkoutCard";

export default function Home() {
  const workouts = useQuery({ queryKey: ["workouts"], queryFn: api.listWorkouts });

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Meus treinos</h1>

      {workouts.isPending && <p className="opacity-60">Carregando...</p>}

      {workouts.isError && (
        <div role="alert" className="alert alert-error alert-soft flex-col items-start">
          <p>Não foi possível carregar os treinos.</p>
          <button type="button" className="btn btn-sm" onClick={() => workouts.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {workouts.isSuccess &&
        (workouts.data.length === 0 ? (
          <p className="opacity-60">Nenhum treino ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="grid gap-3">
            {workouts.data.map((w) => (
              <WorkoutCard key={w.id} workout={w} />
            ))}
          </ul>
        ))}

      <div className="mt-6">
        <NewWorkoutForm />
      </div>
    </>
  );
}
