import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import NewWorkoutForm from "../components/NewWorkoutForm";
import WorkoutCard from "../components/WorkoutCard";

export default function Home() {
  const workouts = useQuery({ queryKey: ["workouts"], queryFn: api.listWorkouts });

  return (
    <main className="container">
      <h1>Meus treinos</h1>

      {workouts.isPending && <p className="muted">Carregando...</p>}

      {workouts.isError && (
        <div className="notice">
          <p>Não foi possível carregar os treinos.</p>
          <button type="button" className="btn" onClick={() => workouts.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {workouts.isSuccess &&
        (workouts.data.length === 0 ? (
          <p className="muted">Nenhum treino ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="card-list">
            {workouts.data.map((w) => (
              <WorkoutCard key={w.id} workout={w} />
            ))}
          </ul>
        ))}

      <div className="section">
        <NewWorkoutForm />
      </div>
    </main>
  );
}
