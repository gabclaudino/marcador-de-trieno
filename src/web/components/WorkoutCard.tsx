import { Link } from "react-router-dom";
import type { WorkoutListItem } from "../../shared/schemas";
import { formatDate } from "../format";

export default function WorkoutCard({ workout }: { workout: WorkoutListItem }) {
  return (
    <li className="card card-border bg-base-200 flex-row items-stretch overflow-hidden">
      <Link
        to={`/workouts/${workout.id}/run`}
        className="flex-1 min-w-0 flex flex-col gap-0.5 p-4 active:bg-base-300"
      >
        <span className="text-lg font-semibold wrap-anywhere">{workout.name}</span>
        <span className="text-sm opacity-60">
          {workout.last_performed_at
            ? `Último treino: ${formatDate(workout.last_performed_at)}`
            : "Nunca realizado"}
        </span>
      </Link>
      <Link
        to={`/workouts/${workout.id}/edit`}
        className="btn btn-ghost h-auto rounded-none border-0 border-l border-base-300 px-5"
        aria-label={`Editar ${workout.name}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </Link>
    </li>
  );
}
